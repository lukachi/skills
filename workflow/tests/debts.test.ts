import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { collectDebts, scheduleDebt } from "../src/debts.js";
import { buildInstallPlan } from "../src/planner.js";
import { declareVision } from "../src/vision.js";
import { collectWorkflowState } from "../src/state.js";
import { STATE_COLLECTORS } from "../src/state-collectors.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the ledger names every debt, and says which have direction behind them", async () => {
  const target = await knowledgeRepository("wfctl-debts-list-");
  await writeTrajectory(target, "traj-equipment");
  await writeTrajectory(target, "traj-money", { subject: "Money", area: "characters" });
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });

  const ledger = await collectDebts(target);
  assert.equal(ledger.debts.length, 2);
  assert.deepEqual(
    ledger.debts.map((debt) => debt.trajectory).sort(),
    ["traj-equipment", "traj-money"],
  );
  // One subject has a vision and one does not, and the ledger must not present
  // them as equivalent: a debt owed against nothing has no direction to close it.
  assert.deepEqual(ledger.directionless.map((debt) => debt.trajectory), ["traj-money"]);
  assert.equal(ledger.settled.length, 0);
  assert.equal(ledger.dangling.length, 0);
});

test("a debt cannot be scheduled against a bundle that does not exist", async () => {
  const target = await knowledgeRepository("wfctl-debts-missing-");
  await writeTrajectory(target, "traj-equipment");

  await assert.rejects(
    () =>
      scheduleDebt({
        target,
        trajectory: "traj-equipment",
        gap: "1",
        work: "2026-08-06-nothing-here",
      }),
    /No open change bundle named/,
  );
});

test("scheduling names the work in the record the debt lives in", async () => {
  const target = await knowledgeRepository("wfctl-debts-schedule-");
  await writeTrajectory(target, "traj-equipment");
  await openBundle(target, "2026-08-06-equip-authoring");

  const result = await scheduleDebt({
    target,
    trajectory: "traj-equipment",
    gap: "1",
    work: "2026-08-06-equip-authoring",
  });
  assert.equal(result.previousStatus, "open");
  assert.equal(result.work, "2026-08-06-equip-authoring");

  const document = parseWorkSpec(await readFile(join(target, "trajectories/traj-equipment.md"), "utf8"));
  const gaps = document.metadata.gaps as Array<Record<string, unknown>>;
  assert.equal(gaps[0]!.status, "to-close");
  assert.equal(gaps[0]!.work, "2026-08-06-equip-authoring");

  const ledger = await collectDebts(target);
  assert.equal(ledger.debts[0]!.workState, "active");
});

test("a debt is addressable by a phrase, and an ambiguous phrase is refused", async () => {
  const target = await knowledgeRepository("wfctl-debts-phrase-");
  await writeTrajectory(target, "traj-equipment", {
    gaps: [
      { kind: "direction-debt", statement: "Equip logic is written by hand.", status: "open", work: "" },
      { kind: "direction-debt", statement: "Equip slots are written by hand.", status: "open", work: "" },
    ],
  });
  await openBundle(target, "2026-08-06-equip-authoring");

  await assert.rejects(
    () =>
      scheduleDebt({
        target,
        trajectory: "traj-equipment",
        gap: "written by hand",
        work: "2026-08-06-equip-authoring",
      }),
    /matches 2 debts/,
  );
  const result = await scheduleDebt({
    target,
    trajectory: "traj-equipment",
    gap: "slots",
    work: "2026-08-06-equip-authoring",
  });
  assert.match(result.statement, /Equip slots/);
});

test("two bundles cannot claim one debt", async () => {
  const target = await knowledgeRepository("wfctl-debts-contested-");
  await writeTrajectory(target, "traj-equipment");
  await openBundle(target, "2026-08-06-first");
  await openBundle(target, "2026-08-06-second");

  await scheduleDebt({
    target,
    trajectory: "traj-equipment",
    gap: "1",
    work: "2026-08-06-first",
  });
  await assert.rejects(
    () =>
      scheduleDebt({
        target,
        trajectory: "traj-equipment",
        gap: "1",
        work: "2026-08-06-second",
      }),
    /already being closed by/,
  );
});

test("a debt whose work has landed is reported, not struck off", async () => {
  const target = await knowledgeRepository("wfctl-debts-settled-");
  await writeTrajectory(target, "traj-equipment", {
    gaps: [{
      kind: "direction-debt",
      statement: "Equip logic is written by hand.",
      status: "to-close",
      work: "2026-08-06-equip-authoring",
    }],
  });
  await mkdir(join(target, "changes/archive/2026-08-06-equip-authoring"), { recursive: true });

  const ledger = await collectDebts(target);
  assert.equal(ledger.settled.length, 1);
  // The debt is still there. It ends when the subject is re-read at a new pin
  // and is no longer true, never because a bundle closed.
  assert.equal(ledger.debts[0]!.status, "to-close");
  assert.equal(ledger.debts[0]!.workState, "archived");
});

test("a scheduled debt naming a vanished bundle reads as handled and is flagged", async () => {
  const target = await knowledgeRepository("wfctl-debts-dangling-");
  await writeTrajectory(target, "traj-equipment", {
    gaps: [{
      kind: "direction-debt",
      statement: "Equip logic is written by hand.",
      status: "to-close",
      work: "2026-08-06-deleted-by-hand",
    }],
  });

  const ledger = await collectDebts(target);
  assert.deepEqual(ledger.dangling.map((debt) => debt.work), ["2026-08-06-deleted-by-hand"]);
});

async function openBundle(target: string, id: string): Promise<void> {
  await mkdir(join(target, "changes/active", id), { recursive: true });
  await writeFile(
    join(target, "changes/active", id, "change.md"),
    serializeWorkSpec({ metadata: { id, title: id }, body: `# ${id}\n` }),
    "utf8",
  );
}

async function writeTrajectory(
  target: string,
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await mkdir(join(target, "raw/api"), { recursive: true });
  await writeFile(join(target, "raw/api/design.md"), "# design\n", "utf8");
  const metadata: Record<string, unknown> = {
    id,
    area: "characters",
    subject: "Equipment",
    conceived: {
      at: "2026-07-11T00:00:00.000Z",
      from: ["obs-design"],
      statement: "Equipment was scoped as plumbing around an engine that already had it.",
    },
    now: {
      pinned: "dnd-api@34cf66cb",
      read_at: "2026-08-04T00:00:00.000Z",
      state: "Gear reaches a fight; what an item does is written by hand.",
    },
    observations: [{
      id: "obs-design",
      at: "2026-07-11T00:00:00.000Z",
      read_at: "2026-08-04T00:00:00.000Z",
      source: { kind: "raw", resource: "raw/api/design.md" },
      says: "The design scoped equipment as service plumbing.",
    }],
    findings: [{
      id: "fin-shield",
      situation: "The validator permitted a two-handed weapon beside a shield.",
      period: { from: "2026-07-11T00:00:00.000Z", to: null },
      observations: ["obs-design"],
      cause: {
        kind: "decision",
        evidence: ["raw/api/design.md"],
        note: "Deferred deliberately in the plan.",
      },
      scope_limits: ["What the sheet does with the shield was not traced."],
    }],
    gaps: [{
      kind: "direction-debt",
      statement: "Equip logic is written by hand.",
      status: "open",
      work: "",
    }],
    edges: [],
    ...overrides,
  };
  const path = join(target, "trajectories", `${id}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeWorkSpec({ metadata, body: "# Equipment\n" }), "utf8");
}

async function knowledgeRepository(prefix: string): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), prefix));
  execFileSync("git", ["-C", target, "init", "-q"]);
  execFileSync("git", ["-C", target, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", target, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", target, "config", "commit.gpgsign", "false"]);
  await applyInstallPlan(await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  }));
  await mkdir(join(target, "knowledge/areas/characters"), { recursive: true });
  await writeFile(
    join(target, "knowledge/areas/characters/index.md"),
    "---\nid: characters.index\n---\n\n# Characters\n",
    "utf8",
  );
  return target;
}

test("the brief holds the debt gate shut until every subject has a direction", async () => {
  const target = await knowledgeRepository("wfctl-debts-gate-");
  await writeTrajectory(target, "traj-equipment");
  await writeTrajectory(target, "traj-money", { subject: "Money" });

  const before = await collectWorkflowState(target, { collectors: STATE_COLLECTORS });
  const ids = (report: typeof before) => report.signals.map((signal) => signal.id);
  // Debts are owed against a declared direction. Ordering them while subjects
  // still lack one asks the maintainer to rank work against no standard, so the
  // vision gate is the only one open.
  assert.equal(ids(before).includes("trajectory.awaiting-vision"), true, JSON.stringify(ids(before)));
  assert.equal(ids(before).includes("trajectory.debts-unscheduled"), false);

  for (const trajectory of ["traj-equipment", "traj-money"]) {
    await declareVision({
      knowledgeRoot: target,
      trajectory,
      declaredBy: "human:nzafat",
      statement: "Composable and authorable.",
      method: "attested",
      attested: "yes",
    });
  }

  const after = await collectWorkflowState(target, { collectors: STATE_COLLECTORS });
  assert.equal(ids(after).includes("trajectory.awaiting-vision"), false);
  const debts = after.signals.find((signal) => signal.id === "trajectory.debts-unscheduled");
  // Now it is due, and it is the maintainer's: which of these matter, in what
  // order. Nothing announced it before this collector existed, so an agent read
  // the brief, saw an open bundle and no debts at all, and went there instead.
  assert.equal(debts?.awaits, "maintainer");
  assert.equal(debts?.facts?.open, 2);
  assert.equal(debts?.facts?.scheduled, 0);
});

test("a scheduled debt stops being unscheduled, and the gate says so", async () => {
  const target = await knowledgeRepository("wfctl-debts-gate-scheduled-");
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });
  await openBundle(target, "2026-08-06-equip-authoring");
  await scheduleDebt({
    target,
    trajectory: "traj-equipment",
    gap: "1",
    work: "2026-08-06-equip-authoring",
  });

  const report = await collectWorkflowState(target, { collectors: STATE_COLLECTORS });
  assert.equal(
    report.signals.some((signal) => signal.id === "trajectory.debts-unscheduled"),
    false,
    "nothing is owed and unclaimed, so the maintainer is asked nothing",
  );
});
