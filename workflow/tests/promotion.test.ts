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

test("a subject with no declared direction still gets the page its evidence supports", async () => {
  const target = await knowledgeRepository("wfctl-promote-novision-");
  await writeTrajectory(target, "traj-equipment");

  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.equal(result.direction, "undeclared");
  assert.equal(result.path, "knowledge/areas/characters/equipment.md");

  const page = await readFile(join(target, result.path), "utf8");
  assert.match(page, /^title: Equipment$/m);
  assert.match(page, /## Current behavior/, "what it does today is the point of the page");
  assert.match(page, /Gear reaches a fight/);
  assert.doesNotMatch(page, /^ {2}vision:/m, "no direction was declared, so none is cited");
  assert.doesNotMatch(page, /kind: trajectory-vision/, "and none is a source");
  assert.match(page, /intent: not-applicable/, "accepted intent is the maintainer's word");
  assert.match(
    page,
    /alignment: not-applicable/,
    "drift is distance from an intent, and none is stated",
  );
  assert.match(page, /No direction has been declared for this subject/);
  assert.match(page, /Equip logic is written by hand\./, "the open gap still reaches the page");
});

test("the undeclared page validates on everything except its author markers", async () => {
  const target = await knowledgeRepository("wfctl-promote-novision-valid-");
  await writeTrajectory(target, "traj-equipment");
  const result = await promoteTrajectory({ target, trajectory: "traj-equipment" });

  const validation = await validateKnowledge(target, [result.path]);
  assert.deepEqual(
    validation.errors
      .filter((issue) => !/still carries author markers/.test(issue.message))
      .map((issue) => issue.message),
    [],
    "an undeclared page is a legal page, not a page that limps",
  );
});

test("declaring the direction later adds the second half to the same page", async () => {
  const target = await knowledgeRepository("wfctl-promote-latevision-");
  await writeTrajectory(target, "traj-equipment");
  const first = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.equal(first.direction, "undeclared");
  assert.doesNotMatch(
    await readFile(join(target, first.path), "utf8"),
    /Equipment should be composable/,
  );

  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Equipment should be composable and authorable.",
    method: "attested",
    attested: "yes, that one",
  });
  const second = await promoteTrajectory({
    target,
    trajectory: "traj-equipment",
    force: true,
  });
  assert.equal(second.direction, "declared");
  assert.equal(second.created, false, "the same page, not a second one");

  const page = await readFile(join(target, second.path), "utf8");
  assert.match(page, /Equipment should be composable and authorable\.\[\^1\]/);
  assert.match(page, /intent: accepted/);
  assert.match(page, /alignment: drifted/);
});

test("a subject with no direction and nothing citable is refused", async () => {
  const target = await knowledgeRepository("wfctl-promote-nosources-");
  await writeTrajectory(target, "traj-equipment", {
    observations: [{
      id: "obs-design",
      at: "2026-07-11T00:00:00.000Z",
      read_at: "2026-08-04T00:00:00.000Z",
      source: { kind: "raw", resource: "raw/api/design.md" },
      says: "The design scoped equipment as service plumbing.",
    }],
    findings: [],
    gaps: [],
  });

  await assert.rejects(
    () => promoteTrajectory({ target, trajectory: "traj-equipment" }),
    /nothing citable to rest on/,
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

test("promoting again keeps what a person wrote and refreshes what it generated", async () => {
  const target = await knowledgeRepository("wfctl-promote-preserve-");
  await writeTrajectory(target, "traj-equipment");
  const first = await promoteTrajectory({ target, trajectory: "traj-equipment" });

  // What an author does between the two runs: fill the sections no record in
  // this pipeline holds. Rewriting the file wholesale destroyed exactly this.
  const authored = (await readFile(join(target, first.path), "utf8"))
    .replace(
      "<!-- AUTHOR: name the audiences; no record in this pipeline carries them -->",
      "- **Players**, who carry whatever the fight lets them carry.",
    )
    .replace(
      "<!-- AUTHOR: define the terms this subject owns, as the product uses them -->",
      "- **A loadout** — what a character has on them when a fight starts.",
    )
    .replace(
      "<!-- AUTHOR: one concrete example a person would recognise -->",
      "A character walks in with a shield and a two-handed sword, and nothing objects.",
    );
  await writeFile(join(target, first.path), authored, "utf8");

  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Equipment should be composable and authorable.",
    method: "attested",
    attested: "yes",
  });
  const second = await promoteTrajectory({
    target,
    trajectory: "traj-equipment",
    force: true,
  });

  const page = await readFile(join(target, second.path), "utf8");
  assert.match(page, /- \*\*Players\*\*, who carry whatever the fight lets them carry\./);
  assert.match(page, /- \*\*A loadout\*\* — what a character has on them when a fight starts\./);
  assert.match(page, /A character walks in with a shield and a two-handed sword/);
  assert.deepEqual(second.preserved, ["Who it serves", "Domain language", "Examples"]);

  // And the generated half did refresh, which is the reason to run again at all.
  assert.match(page, /Equipment should be composable and authorable\.\[\^1\]/);
  assert.match(page, /intent: accepted/);
  // A section the author never filled still comes back marked and still asks.
  assert.match(page, /AUTHOR: state the rules a reader can rely on/);
  assert.equal(
    second.awaitingAuthor.some((entry) => /name the audiences/.test(entry)),
    false,
    "a filled section must not be asked for again",
  );
});

test("a citation in a kept section is reported when the sources move under it", async () => {
  const target = await knowledgeRepository("wfctl-promote-footnote-");
  await writeTrajectory(target, "traj-equipment");
  const first = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  await writeFile(
    join(target, first.path),
    (await readFile(join(target, first.path), "utf8")).replace(
      "<!-- AUTHOR: name the audiences; no record in this pipeline carries them -->",
      "- **Players**, and the shield rule they meet[^1].",
    ),
    "utf8",
  );

  // Declaring a direction prepends the vision as source 1, so every pinned
  // source shifts down and the author's [^1] now names something else.
  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Composable and authorable.",
    method: "attested",
    attested: "yes",
  });
  const second = await promoteTrajectory({
    target,
    trajectory: "traj-equipment",
    force: true,
  });

  assert.equal(second.citationsMayHaveShifted, true);
  assert.match(
    await readFile(join(target, second.path), "utf8"),
    /- \*\*Players\*\*, and the shield rule they meet\[\^1\]\./,
    "the text is kept as written; only the caller is told the numbering moved",
  );
});

test("an engineering link survives, and its default does not count as authored", async () => {
  const target = await knowledgeRepository("wfctl-promote-engineering-");
  await writeTrajectory(target, "traj-equipment");
  const first = await promoteTrajectory({ target, trajectory: "traj-equipment" });
  assert.equal(first.preserved.length, 0, "nothing existed to keep");

  const rerun = await promoteTrajectory({ target, trajectory: "traj-equipment", force: true });
  assert.equal(
    rerun.preserved.includes("Engineering details"),
    false,
    "the generated default is not somebody's work",
  );
  assert.equal(
    rerun.awaitingAuthor.some((entry) => /Engineering details/.test(entry)),
    true,
  );

  await writeFile(
    join(target, first.path),
    (await readFile(join(target, first.path), "utf8")).replace(
      "## Engineering details\n\nNot applicable.",
      "## Engineering details\n\n- [How equipment is stored](../../architecture/loadout.md)",
    ),
    "utf8",
  );
  const third = await promoteTrajectory({ target, trajectory: "traj-equipment", force: true });
  assert.equal(third.preserved.includes("Engineering details"), true);
  assert.match(
    await readFile(join(target, third.path), "utf8"),
    /\[How equipment is stored\]\(\.\.\/\.\.\/architecture\/loadout\.md\)/,
  );
  assert.equal(
    third.awaitingAuthor.some((entry) => /Engineering details/.test(entry)),
    false,
    "asking for work already done is asking twice",
  );
});

test("a page an author finished still validates after the direction arrives", async () => {
  const target = await knowledgeRepository("wfctl-promote-roundtrip-");
  await writeTrajectory(target, "traj-equipment");
  const first = await promoteTrajectory({ target, trajectory: "traj-equipment" });

  let page = await readFile(join(target, first.path), "utf8");
  for (const [marker, answer] of [
    ["name the audiences; no record in this pipeline carries them", "- **Players**, who carry what a fight lets them."],
    ["define the terms this subject owns, as the product uses them", "- **A loadout** — what a character wears into a fight."],
    ["state the rules a reader can rely on, or link them", "- What an item does is written by hand today."],
    ["state what this subject does not cover", "It does not cover what an item is worth, which belongs to World."],
    ["one concrete example a person would recognise", "A shield and a two-handed sword, worn together, and nothing objects."],
  ] as const) {
    page = page.replace(`<!-- AUTHOR: ${marker} -->`, answer);
  }
  await writeFile(join(target, first.path), page, "utf8");
  assert.equal((await validateKnowledge(target, [first.path])).valid, true, "the author finished it");

  await declareVision({
    knowledgeRoot: target,
    trajectory: "traj-equipment",
    declaredBy: "human:nzafat",
    statement: "Equipment should be composable and authorable.",
    method: "attested",
    attested: "yes",
  });
  const second = await promoteTrajectory({ target, trajectory: "traj-equipment", force: true });

  // The whole point: a finished page stays finished. Before this, the second run
  // emptied five sections and the page went back to failing validation.
  const validation = await validateKnowledge(target, [second.path]);
  assert.deepEqual(validation.errors.map((issue) => issue.message), []);
  assert.equal(validation.valid, true);
  assert.deepEqual(
    second.preserved,
    ["Who it serves", "Domain language", "Rules and outcomes", "Boundaries and exceptions", "Examples"],
  );
  // The one thing still asked for is the engineering link, which no engineering
  // page exists to receive. It is a suggestion, not a validation failure.
  assert.deepEqual(
    second.awaitingAuthor,
    ["Engineering details says not-applicable; link the engineering concepts if any exist"],
  );
});
