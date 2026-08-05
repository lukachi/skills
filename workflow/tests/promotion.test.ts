import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { validateKnowledge } from "../src/knowledge.js";
import { buildInstallPlan } from "../src/planner.js";
import { promoteTrajectory } from "../src/promotion.js";
import { declareVision } from "../src/vision.js";
import { serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("a subject with no declared vision cannot be promoted", async () => {
  const target = await knowledgeRepository("wfctl-promote-novision-");
  await writeTrajectory(target, "traj-equipment");

  await assert.rejects(
    () => promoteTrajectory({ target, trajectory: "traj-equipment" }),
    /has no declared vision/,
  );
});

test("a promoted page carries what it is, where it is going, and the gap", async () => {
  const target = await knowledgeRepository("wfctl-promote-ok-");
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Equipment should be composable and authorable.",
    method: "attested",
    attested: "yes, that one",
  });

  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.equal(result.path, "knowledge/areas/characters/equipment.md");
  assert.equal(result.created, true);

  const page = await readFile(join(target, result.path), "utf8");
  assert.match(page, /^title: Equipment$/m);
  assert.match(page, /vision: vision-equipment/);
  assert.match(page, /## Where this is going/);
  assert.match(page, /Equipment should be composable and authorable\.\[\^1\]/);
  assert.match(page, /kind: trajectory-vision/);
  assert.match(page, /alignment: drifted/, "an open gap is drift, not alignment");
  assert.match(page, /Equip logic is written by hand\./, "the gap reaches the page");
});

test("the draft refuses to validate until its unwritten sections are written", async () => {
  const target = await knowledgeRepository("wfctl-promote-draft-");
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });
  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.ok(result.awaitingAuthor.length >= 5, JSON.stringify(result.awaitingAuthor));

  const validation = await validateKnowledge(target, [result.path]);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.errors.some((issue) => /still carries author markers/.test(issue.message)),
    true,
    JSON.stringify(validation.errors),
  );

  // The only remaining failure is the marker: everything mechanical is supplied.
  assert.deepEqual(
    validation.errors
      .filter((issue) => !/still carries author markers/.test(issue.message))
      .map((issue) => issue.message),
    [],
  );
});

test("raw observations cannot become evidence, and the loss is counted", async () => {
  const target = await knowledgeRepository("wfctl-promote-raw-");
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });

  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.equal(result.droppedRawSources, 1);
  const page = await readFile(join(target, result.path), "utf8");
  assert.doesNotMatch(page, /raw\//, "curated knowledge may never cite untrusted input");
});

test("promotion never deletes, and names the pages nothing claims", async () => {
  const target = await knowledgeRepository("wfctl-promote-unclaimed-");
  await mkdir(join(target, "knowledge/areas/characters/capabilities"), { recursive: true });
  await writeFile(
    join(target, "knowledge/areas/characters/capabilities/old.md"),
    "---\nid: x\n---\n\n# Old\n",
    "utf8",
  );
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });

  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.deepEqual(result.unclaimed, ["knowledge/areas/characters/capabilities/old.md"]);
  await readFile(join(target, "knowledge/areas/characters/capabilities/old.md"), "utf8");
});

test("a claimed replacement that is not on disk is reported, not assumed", async () => {
  const target = await knowledgeRepository("wfctl-promote-replaces-");
  await writeTrajectory(target, "traj-equipment", {
    replaces: ["knowledge/areas/characters/capabilities/gone.md"],
  });
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });

  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.deepEqual(result.replaces, [{
    path: "knowledge/areas/characters/capabilities/gone.md",
    present: false,
  }]);
});

test("an existing page is not overwritten without being asked", async () => {
  const target = await knowledgeRepository("wfctl-promote-force-");
  await writeTrajectory(target, "traj-equipment");
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });

  await promoteTrajectory({ target, trajectory: "traj-equipment" });
  await assert.rejects(
    () => promoteTrajectory({ target, trajectory: "traj-equipment" }),
    /already exists; pass --force/,
  );
  const again = await promoteTrajectory({ target, trajectory: "traj-equipment", force: true });
  assert.equal(again.created, false);
});

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
    observations: [
      {
        id: "obs-design",
        at: "2026-07-11T00:00:00.000Z",
        read_at: "2026-08-04T00:00:00.000Z",
        source: { kind: "raw", resource: "raw/api/design.md" },
        says: "The design scoped equipment as service plumbing.",
      },
      {
        id: "obs-loadout",
        at: "2026-08-02T00:00:00.000Z",
        read_at: "2026-08-04T00:00:00.000Z",
        source: {
          kind: "source-code",
          resource: `git:lukachi/dnd-api@${"a".repeat(40)}#crates/rules-core/src/loadout.rs`,
        },
        says: "A shield and a two-handed weapon can be worn together.",
      },
    ],
    findings: [{
      id: "fin-shield",
      situation: "The validator permitted a two-handed weapon beside a shield.",
      period: { from: "2026-07-11T00:00:00.000Z", to: null },
      observations: ["obs-loadout"],
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
