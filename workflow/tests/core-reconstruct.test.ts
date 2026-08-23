import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { GateRefusal } from "../src/core/gates.js";
import {
  addRepository,
  readRegistry,
  removeRepository,
  renderRegistry,
} from "../src/core/registry.js";
import {
  assertAdjudicated,
  assertCrawlComplete,
  assertProbed,
  assertTrajectoriesExist,
  hasBaseline,
  rawInventory,
  remaining,
  renderOutcome,
  STAGE_PRESENCE,
  type ReconstructionCase,
} from "../src/core/reconstruct.js";
import { appendEvent, deriveGap, listTrajectories, renderTrajectory } from "../src/core/trajectory.js";
import { walkToVerified } from "./helpers.js";

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "wfctl-recon-"));
}

function emptyCase(): ReconstructionCase {
  return {
    id: "2026-08-23-reconstruct",
    stage: "scope",
    createdAt: "now",
    repositories: [],
    rawPaths: [],
    coverage: { inScope: [], read: [], excluded: [] },
    claims: [],
    contradictions: [],
    trajectories: [],
    probes: [],
    hadBaseline: false,
  };
}

/* -------------------------------------------------------------- registry */

test("a repository is registered once per worktree, and the duplicate is named", async () => {
  const target = await root();
  await addRepository(target, {
    repository: "o/r",
    checkout: "main",
    path: "/checkouts/r",
    worktreeId: "main",
  });
  await addRepository(target, {
    repository: "o/r",
    checkout: "feature",
    path: "/checkouts/r-feature",
    worktreeId: "wt-1",
  });
  assert.equal((await readRegistry(target)).length, 2);

  await assert.rejects(
    () =>
      addRepository(target, {
        repository: "o/r",
        checkout: "again",
        path: "/elsewhere",
        worktreeId: "main",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.message, /already registered at \/checkouts\/r/);
      return true;
    },
  );
});

test("removing an unregistered repository is refused rather than silently ignored", async () => {
  const target = await root();
  await assert.rejects(() => removeRepository(target, "o/missing"), GateRefusal);
});

test("an empty registry says how to fill it", () => {
  assert.match(renderRegistry([]), /wfctl repo add/);
});

/* ---------------------------------------------------------------- shape */

test("whether a baseline exists is observed, never chosen", async () => {
  const target = await root();
  assert.equal(await hasBaseline(target), false);

  await mkdir(resolve(target, "knowledge/areas/billing"), { recursive: true });
  await writeFile(resolve(target, "knowledge/index.md"), "# index\n", "utf8");
  assert.equal(await hasBaseline(target), false, "an index alone is not a baseline");

  await writeFile(resolve(target, "knowledge/areas/billing/index.md"), "# billing\n", "utf8");
  assert.equal(await hasBaseline(target), true);
});

test("the maintainer is present at three stages and absent from the long part", () => {
  assert.equal(STAGE_PRESENCE.scope, "maintainer");
  assert.equal(STAGE_PRESENCE.crawl, "nobody");
  assert.equal(STAGE_PRESENCE.assemble, "nobody");
  assert.equal(STAGE_PRESENCE.adjudicate, "maintainer");
  assert.equal(STAGE_PRESENCE.promote, "maintainer");
});

test("raw material is inventoried from under reconstruction, not from the root", async () => {
  const target = await root();
  await mkdir(resolve(target, "reconstruction/raw/notes"), { recursive: true });
  await writeFile(resolve(target, "reconstruction/raw/notes/a.md"), "x", "utf8");
  const found = await rawInventory(target);
  assert.deepEqual(found, ["notes/a.md"]);
});

/* ----------------------------------------------------------- the gates */

test("coverage is a number, and the crawl gate names what is left", () => {
  const record = emptyCase();
  record.coverage = {
    inScope: ["a.ts", "b.ts", "c.ts"],
    read: ["a.ts"],
    excluded: [{ path: "b.ts", reason: "generated" }],
  };
  assert.deepEqual(remaining(record.coverage), ["c.ts"]);
  assert.throws(
    () => assertCrawlComplete(record),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /c\.ts/);
      assert.match(error.remedy, /reconstruct read/);
      return true;
    },
  );

  record.coverage.read.push("c.ts");
  assert.doesNotThrow(() => assertCrawlComplete(record));
});

test("nothing may be written before a trajectory exists", () => {
  const record = emptyCase();
  assert.throws(
    () => assertTrajectoriesExist(record),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /before the material that contradicts it/);
      return true;
    },
  );
  record.trajectories = ["billing"];
  assert.doesNotThrow(() => assertTrajectoriesExist(record));
});

test("contradictions found while reading are resolved later, not during the crawl", () => {
  const record = emptyCase();
  record.contradictions = [{ id: "C1", subject: "refunds", sides: ["code says x", "note says y"] }];
  assert.throws(() => assertAdjudicated(record), /unresolved/);

  record.contradictions[0]!.resolution = "the note is stale";
  assert.doesNotThrow(() => assertAdjudicated(record));
});

test("a probe asked by the agent that wrote the pages is refused", () => {
  const record = emptyCase();
  assert.throws(() => assertProbed(record, "agent:me"), /No omission probe/);

  record.probes = [{ question: "what does billing do?", pages: ["p.md"], asker: "agent:me", passed: true }];
  assert.throws(
    () => assertProbed(record, "agent:me"),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /returns what you already know/);
      return true;
    },
  );

  record.probes = [{ question: "what does billing do?", pages: ["p.md"], asker: "agent:other", passed: false }];
  assert.throws(() => assertProbed(record, "agent:me"), /did not pass/);

  record.probes[0]!.passed = true;
  assert.doesNotThrow(() => assertProbed(record, "agent:me"));
});

test("a pass that changed nothing still records what it checked", () => {
  const record = emptyCase();
  record.repositories = [
    {
      repository: "o/r",
      checkout: "main",
      path: "/r",
      worktreeId: "main",
      revision: "abc123",
      dirty: true,
    },
  ];
  const rendered = renderOutcome(record);
  assert.match(rendered, /Nothing moved/);
  assert.match(rendered, /abc123 \(dirty\)/);
});

/* ----------------------------------------------------------- the spine */

test("a subject's line is appended to by both cases", async () => {
  const target = await root();
  await appendEvent(target, "Billing", {
    summary: "customers should be able to refund a single item",
    axis: "intent",
    claims: ["c1"],
  });
  await appendEvent(target, "Billing", {
    summary: "refunds cancel the whole order",
    axis: "delivery",
    claims: ["c2"],
  });
  await appendEvent(target, "Billing", {
    summary: "part-refunds shipped",
    axis: "delivery",
    claims: [],
    change: "2026-08-23-work-part-refunds",
  });

  const [trajectory] = await listTrajectories(target);
  assert.ok(trajectory);
  assert.equal(trajectory.subject, "Billing");
  assert.equal(trajectory.events.length, 3);
  assert.match(renderTrajectory(trajectory), /← 2026-08-23-work-part-refunds/);
});

test("the gap is derived from the line rather than stored on it", async () => {
  const target = await root();
  await appendEvent(target, "Refunds", { summary: "partial refunds", axis: "intent", claims: [] });
  await appendEvent(target, "Refunds", { summary: "whole-order only", axis: "delivery", claims: [] });
  await appendEvent(target, "Refunds", { summary: "self-serve refunds", axis: "vision", claims: [] });

  const [trajectory] = await listTrajectories(target);
  assert.ok(trajectory);
  const gap = deriveGap(trajectory);
  assert.deepEqual(gap.delivery, ["partial refunds"]);
  assert.deepEqual(gap.direction, ["self-serve refunds"]);
  assert.ok(!("gap" in trajectory));
});

test("an event needs a subject and a summary", async () => {
  const target = await root();
  await assert.rejects(() => appendEvent(target, "", { summary: "x", axis: "intent", claims: [] }), GateRefusal);
  await assert.rejects(
    () => appendEvent(target, "Billing", { summary: "  ", axis: "intent", claims: [] }),
    GateRefusal,
  );
});

test("promotion writes the pages and appends to the subject's line", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["work", "start", "--title", "part refunds", "--weight", "significant"], ctx);
  await walkToVerified(ctx);
  await run(["work", "promotion", "draft", "areas/billing/index.md"], ctx);
  await run(["work", "close", "--outcome", "completed"], ctx);

  const without = await run(["work", "promote"], ctx);
  assert.equal(without.exitCode, 2);
  assert.match(without.stdout, /rediscovered by the next reconstruction/);

  const promoted = await run(
    ["work", "promote", "--subject", "Billing", "--summary", "refunds can be partial"],
    ctx,
  );
  assert.equal(promoted.exitCode, 0);
  assert.match(promoted.stdout, /promoted and archived/);
  assert.match(promoted.stdout, /refunds can be partial/);

  const [trajectory] = await listTrajectories(ctx.root);
  assert.ok(trajectory);
  assert.equal(trajectory.events[0]?.axis, "delivery");
  assert.match(trajectory.events[0]?.change ?? "", /work-part-refunds/);
});

test("the whole reconstruction walks stage by stage, and each gate names its remedy", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:crawler" };

  await run(["repo", "add", "o/r", "--path", "/checkouts/r"], ctx);
  const started = await run(["reconstruct", "start"], ctx);
  assert.match(started.stdout, /first baseline/);
  assert.match(started.stdout, /One question, not four/);

  await run(
    ["reconstruct", "scope", "--repository", "o/r", "--revision", "abc123", "--in", "a.ts", "--in", "b.ts"],
    ctx,
  );

  // The crawl records contradictions instead of asking about them.
  const noted = await run(
    ["reconstruct", "contradiction", "--subject", "refunds", "--side", "code says whole order", "--side", "note says partial"],
    ctx,
  );
  assert.match(noted.stdout, /to adjudicate after the crawl/);

  const early = await run(["reconstruct", "stage"], ctx);
  assert.equal(early.exitCode, 2);
  assert.match(early.stdout, /neither read nor excluded/);

  await run(["reconstruct", "read", "a.ts"], ctx);
  await run(["reconstruct", "exclude", "b.ts", "--reason", "generated"], ctx);

  const toAssemble = await run(["reconstruct", "stage"], ctx);
  assert.equal(toAssemble.exitCode, 0);
  assert.match(toAssemble.stdout, /stage assemble/);
  assert.match(toAssemble.stdout, /runs unattended/);

  // Nothing may be written before a subject's line exists.
  const noSubject = await run(["reconstruct", "stage"], ctx);
  assert.equal(noSubject.exitCode, 2);
  assert.match(noSubject.stdout, /before the material that contradicts it/);

  await run(["trajectory", "append", "--subject", "Refunds", "--summary", "whole order only", "--axis", "delivery"], ctx);
  await run(["reconstruct", "subject", "refunds"], ctx);

  const toAdjudicate = await run(["reconstruct", "stage"], ctx);
  assert.match(toAdjudicate.stdout, /stage adjudicate/);
  assert.match(toAdjudicate.stdout, /needs the maintainer/);

  const unresolved = await run(["reconstruct", "stage"], ctx);
  assert.equal(unresolved.exitCode, 2);
  assert.match(unresolved.stdout, /unresolved/);

  await run(["reconstruct", "resolve", "C001", "--resolution", "the note is stale"], ctx);
  await run(["reconstruct", "stage"], ctx);  // write
  await run(["reconstruct", "stage"], ctx);  // probe

  // A self-asked probe is refused where it is recorded, not two commands later
  // at the gate — accepting it there left the case wedged with no way to remove it.
  const selfProbe = await run(
    ["reconstruct", "probe", "--question", "what do refunds do?", "--page", "p.md", "--asker", "agent:crawler", "--passed"],
    ctx,
  );
  assert.equal(selfProbe.exitCode, 2);
  assert.match(selfProbe.stdout, /returns what you already know/);

  const delegated = await run(
    ["reconstruct", "probe", "--question", "what do refunds do?", "--page", "p.md", "--asker", "agent:prober", "--passed"],
    ctx,
  );
  assert.equal(delegated.exitCode, 0);

  const promoted = await run(["reconstruct", "stage"], ctx);
  assert.equal(promoted.exitCode, 0);
  assert.match(promoted.stdout, /stage promote/);

  const closed = await run(["reconstruct", "close"], ctx);
  assert.equal(closed.exitCode, 0);
  assert.match(closed.stdout, /archived at/);
});

test("closing early is refused; every stage gate runs on the way past", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);
  await run(["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--in", "x.ts"], ctx);
  await run(["reconstruct", "contradiction", "--subject", "s", "--side", "one", "--side", "two"], ctx);

  const early = await run(["reconstruct", "close"], ctx);
  assert.equal(early.exitCode, 2);
  assert.match(early.stdout, /closing needs it at promote/);
});

test("a second reconstruction cannot overwrite an open one", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);
  const second = await run(["reconstruct", "start"], ctx);
  assert.equal(second.exitCode, 2);
  assert.match(second.stdout, /already open/);
});

test("--raw all puts the raw material in scope", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await mkdir(resolve(ctx.root, "reconstruction/raw"), { recursive: true });
  await writeFile(resolve(ctx.root, "reconstruction/raw/note.md"), "history", "utf8");
  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);

  const scoped = await run(
    ["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--raw", "all"],
    ctx,
  );
  assert.match(scoped.stdout, /1 left/);
});

test("the scope is settled once", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);
  await run(["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--in", "x.ts", "--in", "y.ts"], ctx);

  const shrink = await run(["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--in", "x.ts"], ctx);
  assert.equal(shrink.exitCode, 2);
  assert.match(shrink.stdout, /settled when this case entered crawl/);
});

test("unknown enum values are refused rather than stored", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["work", "start", "--title", "t", "--weight", "significant"], ctx);

  const axis = await run(["trajectory", "append", "--subject", "S", "--summary", "s", "--axis", "banana"], ctx);
  assert.equal(axis.exitCode, 2);
  assert.match(axis.stdout, /not a valid axis/);

  const route = await run(["recall", "answer", "E14", "--answer", "a", "--route", "qmd2", "--source", "s"], ctx);
  assert.equal(route.exitCode, 2);
  assert.match(route.stdout, /not a valid route/);

  const dropped = await run(["work", "issue", "create", "--title", "--satisfies", "AC-01"], ctx);
  assert.equal(dropped.exitCode, 2);
  assert.match(dropped.stdout, /given without a value/);
});

test("an exclusion without a reason is refused", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);
  await run(["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--in", "x.ts"], ctx);

  const result = await run(["reconstruct", "exclude", "x.ts"], ctx);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /indistinguishable from a file nobody got to/);
});

test("reading outside the agreed scope is refused", async () => {
  const { run } = await import("../src/core/cli.js");
  const assets = resolve(import.meta.dirname, "..", "templates", "guidance");
  const ctx = { root: await root(), assets, actor: "agent:test" };

  await run(["repo", "add", "o/r", "--path", "/r"], ctx);
  await run(["reconstruct", "start"], ctx);
  await run(["reconstruct", "scope", "--repository", "o/r", "--revision", "a", "--in", "x.ts"], ctx);

  const result = await run(["reconstruct", "read", "y.ts"], ctx);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /not in this case's scope/);
});
