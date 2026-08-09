import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  approvalIssues,
  approvalReceiptDigest,
  approvalRecordPath,
  readApproval,
  recordApproval,
} from "../src/approval.js";
import { resolveTodo } from "../src/work-spec.js";

test("an attested approval records what the maintainer actually said", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-approval-attested-"));
  const record = await recordApproval({
    knowledgeRoot: root,
    id: "2026-08-06-licence",
    stage: "framing",
    by: "human:nzafat",
    method: "attested",
    attested: "да, я одобряю те два решения",
    session: "session of 2026-08-06",
  });

  assert.equal(record.method, "attested");
  assert.equal(record.attested, "да, я одобряю те два решения");
  assert.equal(record.session, "session of 2026-08-06");
  const stored = JSON.parse(
    await readFile(approvalRecordPath(root, "2026-08-06-licence", "framing"), "utf8"),
  );
  assert.equal(stored.attested, "да, я одобряю те два решения");
  assert.deepEqual(await readApproval(root, "2026-08-06-licence", "framing"), record);
});

test("an attestation with nothing in it is refused", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-approval-empty-"));
  await assert.rejects(
    () =>
      recordApproval({
        knowledgeRoot: root,
        id: "x",
        stage: "framing",
        by: "human:nzafat",
        method: "attested",
        attested: "   ",
      }),
    /requires the maintainer's own answer/,
  );
});

test("a token approval may not also carry an attestation", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-approval-mixed-"));
  await assert.rejects(
    () =>
      recordApproval({
        knowledgeRoot: root,
        id: "x",
        stage: "framing",
        by: "human:nzafat",
        method: "token",
        attested: "sure",
      }),
    /carries its own proof/,
  );
});

test("the attestation changes the digest, and its absence leaves it untouched", () => {
  const base = {
    id: "x",
    stage: "framing" as const,
    by: "human:nzafat",
    at: "2026-08-06T00:00:00.000Z",
    method: "interactive" as const,
  };
  // Every receipt written before attested approvals existed must keep verifying,
  // so the attestation joins the digest only when there is one.
  assert.equal(approvalReceiptDigest(base), approvalReceiptDigest({ ...base, attested: "" }));
  assert.notEqual(approvalReceiptDigest(base), approvalReceiptDigest({ ...base, attested: "yes" }));
});

test("an attested receipt whose words were deleted is reported", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-approval-stripped-"));
  const record = await recordApproval({
    knowledgeRoot: root,
    id: "2026-08-06-licence",
    stage: "framing",
    by: "human:nzafat",
    method: "attested",
    attested: "yes",
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    approvalRecordPath(root, "2026-08-06-licence", "framing"),
    `${JSON.stringify({ ...record, attested: "" }, null, 2)}\n`,
    "utf8",
  );

  const issues = await approvalIssues(root, "2026-08-06-licence", {
    metadata: {
      workflow_version: 5,
      maintainer_review: {
        framing: {
          status: "approved",
          by: record.by,
          at: record.at,
          method: record.method,
          receipt: record.receipt,
        },
      },
    },
    body: "",
  });
  assert.equal(
    issues.some((issue) => /carries no record of what was said/.test(issue)),
    true,
    JSON.stringify(issues),
  );
});

test("a checkpoint list survives a write that says nothing about it", () => {
  const carried = ["rename the fixture directory", "recheck the pinned revision"];
  assert.deepEqual(resolveTodo(carried, undefined), carried);
  assert.deepEqual(resolveTodo(carried, {}), carried);
});

test("a checkpoint list is appended to, dropped from, and replaced", () => {
  const carried = ["rename the fixture directory", "recheck the pinned revision"];
  assert.deepEqual(resolveTodo(carried, { add: ["retire the old page"] }), [
    ...carried,
    "retire the old page",
  ]);
  assert.deepEqual(resolveTodo(carried, { drop: ["FIXTURE"] }), [
    "recheck the pinned revision",
  ]);
  assert.deepEqual(resolveTodo(carried, { set: ["one thing"] }), ["one thing"]);
  assert.deepEqual(resolveTodo(carried, { set: [] }), []);
  // Duplicates and blank entries are the two ways a list rots into noise.
  assert.deepEqual(resolveTodo(["a", "a", "  "], { add: ["a", "b"] }), ["a", "b"]);
});

test("the framing gate reports an unwritten framing instead of echoing the template", async () => {
  const { readWorkGate, renderWorkGate } = await import("../src/work-ask.js");
  const root = await mkdtemp(join(tmpdir(), "wfctl-gate-empty-"));
  await writeBundle(root, "2026-08-06-licence", template());

  const gate = await readWorkGate(root, "2026-08-06-licence", {
    distributionRoot: distributionRoot(),
  });
  assert.deepEqual(gate.doing, []);
  assert.deepEqual(gate.notDoing, []);
  assert.deepEqual(gate.doneWhen, []);
  const rendered = renderWorkGate(gate);
  assert.doesNotMatch(rendered, /Define included behavior/);
  assert.match(rendered, /excludes nothing/);
});

test("the framing gate carries the four things approval fixes and nothing else", async () => {
  const { readWorkGate, renderWorkGate } = await import("../src/work-ask.js");
  const root = await mkdtemp(join(tmpdir(), "wfctl-gate-full-"));
  await writeBundle(
    root,
    "2026-08-06-licence",
    `---
workflow_version: 5
id: "2026-08-06-licence"
title: "Carry the licence statement, and move the product name"
acceptance:
  - id: AC-01
    criterion: The licence statement appears verbatim in every repository that ships the rules.
    status: pending
  - id: AC-02
    criterion: A forked catalog carries the statement without a separate step.
    status: pending
maintainer_review:
  framing:
    status: pending
---

# Summary

The licence statement goes in first, then the name moves where moving it is cheap.

# Scope

## In

- The licence statement, in every repository and inside the content pack.
- The product name in the five places where nothing has been installed yet.

## Out

- The fork name inside content identifiers. That is its own axis.
- Any claim that the engine covers the reference mechanics.
`,
  );

  const gate = await readWorkGate(root, "2026-08-06-licence", {
    distributionRoot: distributionRoot(),
  });
  assert.equal(gate.approved, false);
  assert.equal(gate.doing.length, 2);
  assert.equal(gate.notDoing.length, 2);
  assert.equal(gate.doneWhen.length, 2);
  assert.match(gate.order, /licence statement goes in first/);

  const rendered = renderWorkGate(gate);
  assert.match(rendered, /A forked catalog carries the statement/);
  // Nothing from the bookkeeping half of the record reaches the maintainer.
  for (const token of ["workflow_version", "maintainer_review", "AC-01", "acceptance:", "status:"]) {
    assert.doesNotMatch(rendered, new RegExp(token), `${token} is bookkeeping`);
  }
});

test("the completion gate carries the four things accepting one fixes", async () => {
  const { readWorkGate, renderWorkGate } = await import("../src/work-ask.js");
  const root = await mkdtemp(join(tmpdir(), "wfctl-gate-done-"));
  await writeBundle(
    root,
    "2026-08-09-legendary-offer",
    `---
workflow_version: 5
id: "2026-08-09-legendary-offer"
title: "A monster can act between turns"
acceptance:
  - id: AC-01
    criterion: A player sees the offer and can decline it without ending their turn.
    status: verified
  - id: AC-02
    criterion: The offer survives a reconnect mid-fight.
    status: pending
verification:
  result: passed
  unresolved:
    - The showcase scene renders the banner; nothing exercises it against a live fight.
knowledge_promotion:
  status: complete
  concepts:
    - knowledge/areas/combat/legendary-actions.md
  decisions:
    - what: An effect belongs to the thing that bears it, not to the turn that made it.
      said: map.md#ISSUE-001
      disposition: promoted
      into: knowledge/decisions/effects-belong-to-what-bears-them.md
    - what: Renaming the field settles nothing beyond this work.
      said: maintainer_review.completion
      disposition: not-durable
maintainer_review:
  completion:
    status: pending
---

# Summary

The monster acts between turns, and the player can say no.

# Uncertainty and fog

- Reconnect during an open offer is untested against a real client.
`,
  );

  const gate = await readWorkGate(root, "2026-08-09-legendary-offer", {
    stage: "completion",
    distributionRoot: distributionRoot(),
  });
  assert.deepEqual(gate.delivered.length, 1);
  assert.deepEqual(gate.undelivered.length, 1);
  assert.equal(gate.carried.length, 2, "the structured risk and the authored one both count");
  // A decision that settles nothing beyond this work is accounted for and is not
  // news: printing it would put the maintainer's own bookkeeping back in front
  // of them.
  assert.deepEqual(gate.learned, [
    "An effect belongs to the thing that bears it, not to the turn that made it.",
  ]);

  const rendered = renderWorkGate(gate);
  assert.match(rendered, /A player sees the offer and can decline it/);
  assert.match(rendered, /survives a reconnect/);
  assert.match(rendered, /nothing is undone by saying no/);
  // The evidence stays in the record. The decision was never about a path, an
  // identifier, or a schema value, so the render has no way to print one.
  for (const token of ["AC-01", "AC-02", "knowledge/", ".md", "verification", "status:"]) {
    assert.doesNotMatch(rendered, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), token);
  }
});

test("a completion that settled nothing durable says so, and silence does not", async () => {
  const { readWorkGate, renderWorkGate } = await import("../src/work-ask.js");
  const root = await mkdtemp(join(tmpdir(), "wfctl-gate-nothing-"));
  const head = `---
workflow_version: 5
id: "2026-08-09-rename"
title: "Rename the field"
acceptance: []
knowledge_promotion:
  decisions: []`;
  const tail = `
maintainer_review:
  completion:
    status: pending
---

# Summary

A rename, and nothing else.
`;

  await writeBundle(root, "2026-08-09-rename", `${head}${tail}`);
  const silent = renderWorkGate(
    await readWorkGate(root, "2026-08-09-rename", {
      stage: "completion",
      distributionRoot: distributionRoot(),
    }),
  );
  assert.match(silent, /does not account for what this work decided/);

  await writeBundle(
    root,
    "2026-08-09-rename",
    `${head}\n  decisions_none: "A rename with no behaviour change settles no question."${tail}`,
  );
  const answered = renderWorkGate(
    await readWorkGate(root, "2026-08-09-rename", {
      stage: "completion",
      distributionRoot: distributionRoot(),
    }),
  );
  assert.match(answered, /settles no question/);
  assert.doesNotMatch(answered, /does not account for/);
});

function distributionRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function template(): string {
  return `---
workflow_version: 5
id: "2026-08-06-licence"
title: "Untouched"
acceptance: []
maintainer_review:
  framing:
    status: pending
---

# Summary

State the intended outcome and why it matters.

# Scope

## In

- Define included behavior.

## Out

- Define explicit exclusions.
`;
}

async function writeBundle(root: string, id: string, content: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(root, "changes/active", id), { recursive: true });
  await writeFile(join(root, "changes/active", id, "change.md"), content, "utf8");
}
