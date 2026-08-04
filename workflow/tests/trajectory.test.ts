import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { buildInstallPlan } from "../src/planner.js";
import { compileTrajectories, writeTrajectoryGraph } from "../src/trajectory.js";
import { declareVision, visionRecordPath } from "../src/vision.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("a well-formed trajectory compiles and sums child gaps upward", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-ok-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    edges: [],
    gaps: [gap({ statement: "Equip logic is hardcoded." })],
  });
  await writeTrajectory(target, "attunement", {
    subject: "Attunement",
    edges: [{ kind: "part-of", target: "equipment", primary: true }],
    gaps: [
      gap({ statement: "Attunement has no effect in a fight.", status: "deferred", work: "" }),
      gap({ statement: "Nothing performs attunement.", status: "deferred", work: "" }),
    ],
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
  assert.equal(result.graph.stats.trajectories, 2);
  assert.equal(result.graph.stats.roots, 1);

  const equipment = result.graph.trajectories.find((entry) => entry.id === "equipment");
  const attunement = result.graph.trajectories.find((entry) => entry.id === "attunement");
  assert.equal(attunement?.gapWeight, 2);
  assert.equal(equipment?.gapWeight, 3, "a parent carries its own gap plus its children's");

  const written = await writeTrajectoryGraph(target);
  assert.match(written.path, /trajectory-graph\.json$/);
});

test("a cause that claims a reason must carry evidence for it", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-cause-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    findings: [finding({ cause: { kind: "drift", evidence: [], note: "Nobody decided." } })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /cause\.kind is drift and carries no evidence/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("not-found is the honest escape and needs no cause evidence", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-notfound-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    findings: [finding({
      cause: { kind: "not-found", evidence: [], note: "No decision record was located." },
    })],
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
});

test("a subject named for an implementation identifier is rejected", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-subject-");
  for (const subject of [
    "engine-isolation",
    "services/combat/src/domain/encounter.rs",
    "rules_core::Loadout",
    "characters_client.rs",
  ]) {
    await writeTrajectory(target, "engine", { subject });
    const result = await compileTrajectories(target);
    assert.equal(
      result.errors.some((issue) => /is an implementation identifier/.test(issue.message)),
      true,
      `${subject} should be rejected: ${JSON.stringify(result.errors)}`,
    );
  }
});

test("a gap cannot be accepted; accepting edits the vision instead", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-accept-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    gaps: [gap({ status: "accept", work: "" })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /gap status accept does not exist/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a debt scheduled for closure must name the work that closes it", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-work-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    gaps: [gap({ status: "to-close", work: "" })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /is to-close and names no work/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("part-of may not cycle, because vision inherits along it", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-cycle-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    edges: [{ kind: "part-of", target: "attunement", primary: true }],
  });
  await writeTrajectory(target, "attunement", {
    subject: "Attunement",
    edges: [{ kind: "part-of", target: "equipment", primary: true }],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /part-of forms a cycle/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("exactly one part-of parent inherits vision", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-primary-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await writeTrajectory(target, "characters", { subject: "Characters" });
  await writeTrajectory(target, "attunement", {
    subject: "Attunement",
    edges: [
      { kind: "part-of", target: "equipment", primary: true },
      { kind: "part-of", target: "characters", primary: true },
    ],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /exactly one part-of edge must be primary/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("only part-of carries inheritance, so nothing else may be primary", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-nonprimary-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await writeTrajectory(target, "combat", {
    subject: "Combat",
    edges: [{ kind: "depends-on", target: "equipment", primary: true }],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /only part-of inherits vision/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a finding may not reference an observation that does not exist", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-obs-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    findings: [finding({ observations: ["obs-missing"] })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) =>
      /references an unknown observation: obs-missing/.test(issue.message)
    ),
    true,
    JSON.stringify(result.errors),
  );
});

test("roots without a vision become the maintainer queue, worst gap first", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pending-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    gaps: [gap({ statement: "One." })],
  });
  await writeTrajectory(target, "combat", {
    subject: "Combat",
    gaps: [gap({ statement: "One." }), gap({ statement: "Two." }), gap({ statement: "Three." })],
  });
  await writeTrajectory(target, "authoring", {
    subject: "Authoring",
    gaps: [gap({ statement: "Many." }), gap({ statement: "More." })],
  });
  await declareTestVision(target, {
    id: "vision-authoring",
    trajectory: "authoring",
    statement: "Authoring should be one surface an author never leaves.",
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.pending.map((entry) => entry.id),
    ["combat", "equipment"],
    "a trajectory with a declared vision is not in the queue, and the worst gap leads",
  );
});

test("what the source shows now is a statement about a named revision", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pin-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    now: { pinned: "", read_at: "2026-08-04T00:00:00.000Z", state: "Gear reaches a fight." },
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /now\.pinned is required/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("the graph refuses to build while a structural error remains", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-refuse-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    findings: [finding({ cause: { kind: "defect", evidence: [], note: "" } })],
  });

  await assert.rejects(
    () => writeTrajectoryGraph(target),
    /Cannot build trajectory graph/,
  );
});

test("a pointer at a path that does not exist is an error, not a citation", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pointer-");
  await mkdir(join(target, "raw"), { recursive: true });
  await writeFile(join(target, "raw", "notes.md"), "# notes\n", "utf8");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    observations: [observation({ source: { kind: "raw", resource: "raw/missing.md" } })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) =>
      /points at a path that does not exist: raw\/missing\.md/.test(issue.message)
    ),
    true,
    JSON.stringify(result.errors),
  );
});

test("a resolvable pointer passes and a line suffix does not break it", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pointer-ok-");
  await mkdir(join(target, "raw"), { recursive: true });
  await writeFile(join(target, "raw", "notes.md"), "# notes\n", "utf8");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    observations: [observation({ source: { kind: "raw", resource: "raw/notes.md:1037" } })],
    findings: [finding({ cause: { kind: "decision", evidence: ["raw/notes.md"], note: "x" } })],
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
});

test("a malformed pinned pointer is rejected outright", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pinned-bad-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    observations: [observation({
      source: { kind: "source-code", resource: "git:lukachi/dnd-api@34cf66c#src/lib.rs" },
    })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /malformed pinned pointer/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a pinned pointer with no connected checkout is reported unverified, not passed", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-pinned-warn-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    observations: [observation({
      source: {
        kind: "source-code",
        resource: `git:lukachi/absent@${"a".repeat(40)}#src/lib.rs`,
      },
    })],
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
  assert.equal(
    result.warnings.some((issue) => /no checkout of it is connected/.test(issue.message)),
    true,
    JSON.stringify(result.warnings),
  );
});

test("a case reference must name a case that exists", async () => {
  const target = await initializedKnowledgeRepository("wfctl-trajectory-case-ref-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    observations: [observation({
      source: { kind: "maintainer", resource: "intake-case:never-existed" },
    })],
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /names a case that does not exist/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a declared vision satisfies the root and leaves the queue empty", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-ok-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-equipment",
    trajectory: "equipment",
    statement: "Equipment's effect on a character should be composable and authorable.",
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.pending, []);
  assert.equal(result.graph.trajectories[0]?.vision, "vision-equipment");
  assert.equal(result.graph.stats.visions, 1);
});

test("a trajectory may not name its vision; the vision names the trajectory", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-direction-");
  await writeTrajectory(target, "equipment", {
    subject: "Equipment",
    vision: "vision-equipment",
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /a trajectory does not name its vision/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a hand-written vision has no durable record and is rejected", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-forged-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await writeFile(
    join(target, "trajectories", "vision-forged.md"),
    serializeWorkSpec({
      metadata: {
        kind: "vision",
        id: "vision-forged",
        trajectory: "equipment",
        declared_by: "human:nzafat",
        at: "2026-08-04T00:00:00.000Z",
        method: "interactive",
        supersedes: "",
        receipt: "0".repeat(64),
      },
      body: "# vision-forged\n\nSomething the agent decided on its own.\n",
    }),
    "utf8",
  );

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /has no durable record/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("an edited vision document no longer matches its receipt", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-edited-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-equipment",
    trajectory: "equipment",
    statement: "Composable and authorable.",
  });
  const path = join(target, "trajectories", "vision-equipment.md");
  const document = parseWorkSpec(await readFile(path, "utf8"));
  document.metadata.declared_by = "human:someone-else";
  await writeFile(path, serializeWorkSpec(document), "utf8");

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) =>
      /does not match the recorded declaration's trajectory or actor/.test(issue.message)
    ),
    true,
    JSON.stringify(result.errors),
  );
});

test("only a maintainer declares direction", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-actor-");
  await assert.rejects(
    () =>
      declareVision({
        knowledgeRoot: target,
        id: "vision-equipment",
        trajectory: "equipment",
        declaredBy: "agent/claude-opus-5",
        statement: "Composable and authorable.",
        method: "token",
      }),
    /requires --by human:/,
  );
});

test("a superseded vision steps aside and the successor becomes current", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-lineage-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-equipment-v1",
    trajectory: "equipment",
    statement: "Equipment should be authorable.",
  });
  await declareTestVision(target, {
    id: "vision-equipment-v2",
    trajectory: "equipment",
    statement: "Equipment should be authorable and composable with world effects.",
    supersedes: "vision-equipment-v1",
  });

  const result = await compileTrajectories(target);
  assert.deepEqual(result.errors, []);
  assert.equal(result.graph.trajectories[0]?.vision, "vision-equipment-v2");
  assert.equal(
    result.graph.visions.find((entry) => entry.id === "vision-equipment-v1")?.supersededBy,
    "vision-equipment-v2",
  );
});

test("two current visions for one subject is a conflict, not an addition", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-two-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-equipment-a",
    trajectory: "equipment",
    statement: "One direction.",
  });
  await declareTestVision(target, {
    id: "vision-equipment-b",
    trajectory: "equipment",
    statement: "A different direction.",
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /has more than one current vision/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a supersession lineage may not cycle", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-cycle-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-a",
    trajectory: "equipment",
    statement: "First.",
    supersedes: "vision-b",
  });
  await declareTestVision(target, {
    id: "vision-b",
    trajectory: "equipment",
    statement: "Second.",
    supersedes: "vision-a",
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /supersession forms a cycle/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("a lineage stays on one subject", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-crosswire-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await writeTrajectory(target, "combat", { subject: "Combat" });
  await declareTestVision(target, {
    id: "vision-combat",
    trajectory: "combat",
    statement: "A fight should read clearly.",
  });
  await declareTestVision(target, {
    id: "vision-equipment",
    trajectory: "equipment",
    statement: "Equipment should be authorable.",
    supersedes: "vision-combat",
  });

  const result = await compileTrajectories(target);
  assert.equal(
    result.errors.some((issue) => /a lineage stays on one subject/.test(issue.message)),
    true,
    JSON.stringify(result.errors),
  );
});

test("the durable vision record lands outside the authored document", async () => {
  const target = await initializedKnowledgeRepository("wfctl-vision-record-");
  await writeTrajectory(target, "equipment", { subject: "Equipment" });
  await declareTestVision(target, {
    id: "vision-equipment",
    trajectory: "equipment",
    statement: "Composable and authorable.",
  });
  const record = JSON.parse(
    await readFile(visionRecordPath(target, "vision-equipment"), "utf8"),
  ) as Record<string, unknown>;
  assert.equal(record.declaredBy, "human:nzafat");
  assert.equal(record.trajectory, "equipment");
  assert.match(String(record.receipt), /^[0-9a-f]{64}$/);
});

function observation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "obs-h1-flagged",
    at: "2026-07-11T00:00:00.000Z",
    read_at: "2026-08-04T00:00:00.000Z",
    source: {
      kind: "raw",
      resource: "raw/api/world-loop-review/05-equipment-and-inventory.md",
    },
    says: "Shield is not a hand slot, so a two-handed weapon beside a shield would be permitted.",
    ...overrides,
  };
}

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fin-shield-hole-open",
    situation: "The loadout validator permitted a two-handed weapon beside a shield.",
    period: { from: "2026-07-11T00:00:00.000Z", to: null },
    observations: ["obs-h1-flagged"],
    cause: {
      kind: "decision",
      evidence: ["raw/api/world-loop-review/PROGRESS.md:1037"],
      note: "Listed as deferred in the equipment plan — scheduled, not missed.",
    },
    scope_limits: ["What the projected sheet does with the shield's armour was not traced."],
    ...overrides,
  };
}

function gap(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "direction-debt",
    statement: "Equip logic is hardcoded.",
    status: "to-close",
    work: "changes/inbox/equip-logic-must-become-authorable.md",
    ...overrides,
  };
}

async function writeTrajectory(
  target: string,
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const metadata: Record<string, unknown> = {
    id,
    area: "characters",
    subject: "Equipment",
    conceived: {
      at: "2026-07-11T00:00:00.000Z",
      from: ["obs-h1-flagged"],
      statement: "Equipment was scoped as service plumbing around an engine that already had it.",
    },
    now: {
      pinned: "dnd-api@34cf66cb",
      read_at: "2026-08-04T00:00:00.000Z",
      state: "Gear reaches a fight; two recorded rules do not hold.",
    },
    observations: [observation()],
    findings: [finding()],
    gaps: [],
    edges: [],
    ...overrides,
  };
  const path = join(target, "trajectories", `${id}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    serializeWorkSpec({ metadata, body: `# ${metadata.subject as string}\n` }),
    "utf8",
  );
}

async function declareTestVision(
  target: string,
  input: { id: string; trajectory: string; statement: string; supersedes?: string },
): Promise<void> {
  await declareVision({
    knowledgeRoot: target,
    id: input.id,
    trajectory: input.trajectory,
    declaredBy: "human:nzafat",
    statement: input.statement,
    method: "token",
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  });
}

async function initializedKnowledgeRepository(prefix: string): Promise<string> {
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
  // Pointers are resolved, so the fixtures must cite material that exists.
  await mkdir(join(target, "raw/api/world-loop-review"), { recursive: true });
  for (const name of ["05-equipment-and-inventory.md", "PROGRESS.md"]) {
    await writeFile(join(target, "raw/api/world-loop-review", name), `# ${name}\n`, "utf8");
  }
  return target;
}
