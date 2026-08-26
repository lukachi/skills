import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCheckpoint, renderBrief, renderHandoff } from "../src/core/checkpoint.js";
import { GateRefusal, assertNotParked, assertReached, assertRecall } from "../src/core/gates.js";
import { FlowOpenError, closeFlow, currentFlow, listFlows, mutateFlow, openFlow } from "../src/core/flow.js";
import {
  RECALL_ITEMS,
  isAnswered,
  recordAnswer,
  recordRoute,
  renderCounterLine,
  shortfallFor,
} from "../src/core/recall.js";
import { deriveBlocker, renderStep } from "../src/core/steps.js";
import { assertWriteAllowed } from "../src/core/paths.js";
import { assertReviewUsable, renderReviewerBrief, type Review } from "../src/core/verify.js";
import type { FlowRecord } from "../src/core/types.js";

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "wfctl-core-"));
}

test("a second flow is refused while one is open, and the refusal names the capture route", async () => {
  const target = await root();
  await openFlow(target, { kind: "work", title: "first thing", attested: "they asked for it" });

  await assert.rejects(
    () => openFlow(target, { kind: "work", title: "a bug I noticed", attested: "they asked for it" }),
    (error: unknown) => {
      assert.ok(error instanceof FlowOpenError);
      assert.match(error.message, /out of scope/);
      assert.match(error.remedy, /wfctl capture/);
      return true;
    },
  );
});

test("closing clears the pointer and drops the checkpoint", async () => {
  const target = await root();
  const flow = await openFlow(target, { kind: "work", title: "something", attested: "they asked for it" });
  await mutateFlow(target, flow.id, (current) => ({
    ...current,
    checkpoint: buildCheckpoint({
      summary: "s",
      handoff: "h",
      lastAction: "l",
      nextAction: "n",
      actor: "agent:test",
    }),
  }));

  const closed = await closeFlow(target, flow.id);
  assert.equal(closed.checkpoint, undefined);
  assert.equal(await currentFlow(target), undefined);
  assert.equal((await listFlows(target)).length, 1);
});

test("an answer without a source does not count as answered", () => {
  let recall = recordAnswer(
    { answers: [], counters: { qmd: 0, graphify: 0, grep: 0, read: 0, maintainer: 0 }, covered: [], written: [] },
    { item: "E14", answer: "nothing contradicts it", route: "qmd", source: "", at: "now" },
  );
  assert.equal(isAnswered(recall, "E14"), false);

  recall = recordAnswer(recall, {
    item: "E14",
    answer: "nothing contradicts it",
    route: "qmd",
    source: "knowledge/areas/billing/index.md",
    at: "now",
  });
  assert.equal(isAnswered(recall, "E14"), true);
});

test("the align step demands group E and at least one qmd query", () => {
  const flow = base();
  flow.step = "aligned";

  const before = shortfallFor("aligned", flow.recall);
  assert.ok(before.missingItems.some((item) => item.id === "E14"));
  assert.ok(before.missingFloor.some((entry) => entry.route === "qmd"));

  for (const item of RECALL_ITEMS.filter((entry) => entry.group === "E")) {
    flow.recall = recordAnswer(flow.recall, {
      item: item.id,
      answer: "checked",
      route: "qmd",
      source: "knowledge/index.md",
      at: "now",
    });
  }

  const after = shortfallFor("aligned", flow.recall);
  assert.equal(after.missingItems.length, 0);
  assert.equal(after.missingFloor.length, 0);
});

test("implementation requires a graph traversal, and grep does not substitute", () => {
  const flow = base();
  flow.step = "implement";
  for (const item of RECALL_ITEMS.filter((entry) => entry.group === "D")) {
    flow.recall = recordAnswer(flow.recall, {
      item: item.id,
      answer: "checked",
      route: "grep",
      source: "src/thing.ts",
      at: "now",
    });
  }

  assert.throws(() => assertRecall(flow, "implement"), GateRefusal);

  flow.recall = recordRoute(flow.recall, "graphify", ["src/thing.ts"]);
  assert.doesNotThrow(() => assertRecall(flow, "implement"));
});

test("every gate refusal names the command that clears it", () => {
  const flow = base();
  flow.parked = { at: "now", reason: "client rebuild first" };

  assert.throws(
    () => assertNotParked(flow),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.remedy, /wfctl work release/);
      assert.match(error.render(), /remedy:/);
      return true;
    },
  );
});

test("a step cannot be entered before its precondition", () => {
  const flow = base();
  flow.step = "opened";
  assert.throws(() => assertReached(flow, "verified"), GateRefusal);
  flow.step = "implement";
  assert.doesNotThrow(() => assertReached(flow, "verified"));
});

test("a blocker is derived from position, and parking awaits the maintainer", () => {
  const flow = base();
  flow.step = "opened";
  const first = deriveBlocker(flow);
  assert.equal(first?.awaits, "agent");

  flow.parked = { at: "now", reason: "not yet" };
  const parked = deriveBlocker(flow);
  assert.equal(parked?.awaits, "maintainer");
  assert.match(parked?.remedy ?? "", /release/);

  flow.closedAt = "now";
  assert.equal(deriveBlocker(flow), undefined);
});

test("the brief prints the bound flow's handoff in full and others as one line", () => {
  const bound = base();
  bound.id = "bound";
  bound.checkpoint = buildCheckpoint({
    summary: "one line",
    handoff: "the long body that a fresh session needs",
    lastAction: "did a thing",
    nextAction: "do the next thing",
    actor: "agent:test",
  });

  const other = base();
  other.id = "other";
  other.checkpoint = buildCheckpoint({
    summary: "other summary",
    handoff: "a body nobody should be shown here",
    lastAction: "l",
    nextAction: "n",
    actor: "agent:test",
  });

  const brief = renderBrief([bound, other], "bound");
  assert.match(brief, /the long body that a fresh session needs/);
  assert.match(brief, /other summary/);
  assert.doesNotMatch(brief, /a body nobody should be shown here/);
});

test("a checkpoint missing its body is refused", () => {
  assert.throws(() =>
    buildCheckpoint({
      summary: "s",
      handoff: "   ",
      lastAction: "l",
      nextAction: "n",
      actor: "agent:test",
    }),
  );
});

test("the counter line names the missing items", () => {
  const flow = base();
  flow.step = "aligned";
  const line = renderCounterLine("aligned", flow.recall);
  assert.match(line, /recall: 0\/3 required answered/);
  assert.match(line, /E14/);
});

test("the step render carries the demand, the command and the counters", () => {
  const flow = base();
  const rendered = renderStep(flow);
  assert.match(rendered, /significant or lightweight/);
  assert.match(rendered, /wfctl work start/);
  assert.match(rendered, /recall:/);
});

test("the handoff is fetchable on its own", () => {
  const flow = base();
  flow.checkpoint = buildCheckpoint({
    summary: "s",
    handoff: "body",
    lastAction: "l",
    nextAction: "n",
    actor: "agent:test",
  });
  assert.match(renderHandoff(flow), /body/);
});

function base(): FlowRecord {
  return {
    schemaVersion: 1,
    id: "2026-08-23-work-thing",
    kind: "work",
    title: "thing",
    attested: { words: "they asked for it", at: "now" },
    step: "opened",
    createdAt: "now",
    updatedAt: "now",
    members: [],
    repositories: [],
    issues: [],
    recall: { answers: [], counters: { qmd: 0, graphify: 0, grep: 0, read: 0, maintainer: 0 }, covered: [], written: [] },
  };
}

test("a curated page cannot be written straight into knowledge/", () => {
  assert.throws(
    () =>
      assertWriteAllowed({
        knowledgeRoot: "/k",
        target: "/k/knowledge/areas/billing/index.md",
        bundleId: "b1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.remedy, /promotion draft/);
      return true;
    },
  );
});

test("a bundle directory cannot be created by hand while no flow is open", () => {
  assert.throws(
    () => assertWriteAllowed({ knowledgeRoot: "/k", target: "/k/changes/active/invented/change.md" }),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.remedy, /work start/);
      return true;
    },
  );
});

test("a second bundle is refused inside an open flow, and routed to capture", () => {
  assert.throws(
    () =>
      assertWriteAllowed({
        knowledgeRoot: "/k",
        target: "/k/changes/active/another/change.md",
        bundleId: "mine",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.remedy, /wfctl capture/);
      return true;
    },
  );
});

test("leaf paths are untouched by the write gate", () => {
  assert.doesNotThrow(() =>
    assertWriteAllowed({ knowledgeRoot: "/k", target: "/leaf/src/thing.ts", bundleId: "b1" }),
  );
});

test("an empty review is refused, but a clean one is not", () => {
  const flow = base();
  const review: Review = {
    fixedPoint: "abc123",
    framingDigest: "",
    reviewer: "agent:reviewer",
    attacks: [],
    findings: [],
    stubSurvivors: [],
  };
  assert.throws(() => assertReviewUsable(flow, review), GateRefusal);

  review.attacks = [
    {
      lens: "correctness" as const,
      target: "negative quantities",
      test: "expect(fn(-1)).toThrow()",
      output: "pass",
      broke: false,
    },
  ];
  assert.doesNotThrow(() => assertReviewUsable(flow, review));
});

test("tests that survive stubbing block verification", () => {
  const flow = base();
  assert.throws(
    () =>
      assertReviewUsable(flow, {
        fixedPoint: "abc",
        framingDigest: "",
        reviewer: "agent:reviewer",
        attacks: [],
        findings: [{ lens: "intent", summary: "s", failure: "f", status: "accepted", acceptedBecause: "ok" }],
        stubSurvivors: [{ test: "tests/thing.test.ts:12", status: "open" }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /assert nothing/);
      return true;
    },
  );
});

test("an accepted finding without a reason is refused", () => {
  const flow = base();
  assert.throws(
    () =>
      assertReviewUsable(flow, {
        fixedPoint: "abc",
        framingDigest: "",
        reviewer: "agent:reviewer",
        attacks: [],
        findings: [{ lens: "intent", summary: "s", failure: "f", status: "accepted" }],
        stubSurvivors: [],
      }),
    GateRefusal,
  );
});

test("a reworded framing routes closure back to the maintainer", () => {
  const flow = base();
  flow.framingDigest = "approved-digest";
  assert.throws(
    () =>
      assertReviewUsable(flow, {
        fixedPoint: "abc",
        framingDigest: "different",
        reviewer: "agent:reviewer",
        attacks: [],
        findings: [],
        stubSurvivors: [],
      }),
    GateRefusal,
  );
});

test("the reviewer brief withholds the implementer's reasoning", () => {
  const brief = renderReviewerBrief("contract", "abc123");
  assert.match(brief, /break this work, not to confirm/);
  assert.match(brief, /executable test/);
  assert.match(brief, /will not be given the implementer's reasoning/);
});
