import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { readLeafDeclaration } from "../src/leaf-declarations.js";
import { buildInstallPlan } from "../src/planner.js";
import { addLeafRepository } from "../src/repository-registry.js";
import {
  accountWorkRepository,
  approveWork,
  beginWork,
  readWorkRepositories,
  recordWorkDecision,
} from "../src/work.js";
import {
  decisionAccountingIssues,
  framingIssues,
  parseWorkSpec,
  serializeWorkSpec,
} from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("a repository's own rules and its own skills are readable from the centre", async () => {
  const { leaf } = await installPair();
  await writeFile(
    join(leaf, "AGENTS.md"),
    "# dnd-api\n\n"
      + "> CODE NAVIGATION — query the graph FIRST (BINDING, RULE #2)\n\n"
      + "<!-- wfctl:begin -->\nmanaged workflow block\n<!-- wfctl:end -->\n\n"
      + "## Local deploy\n\nRun the stack with the repo script, never by hand.\n",
    "utf8",
  );
  await writeSkill(leaf, "grpc-contracts", "Use when changing protobuf contracts here.");

  const declaration = await readLeafDeclaration("lukachi/api", leaf);

  // The maintainer's own text, and only that: the block this workflow manages
  // is its own words and repeating them back teaches a reader nothing.
  assert.match(declaration.instructions, /BINDING, RULE #2/);
  assert.match(declaration.instructions, /Run the stack with the repo script/);
  assert.doesNotMatch(declaration.instructions, /managed workflow block/);
  assert.match(declaration.instructionsSha256, /^[0-9a-f]{64}$/);

  // Skills the installer owns are listed in the lock file; the difference is
  // exactly what this repository added for itself.
  assert.deepEqual(declaration.skills.map((skill) => skill.name), ["grpc-contracts"]);
  assert.match(declaration.skills[0]!.description, /protobuf contracts/);
});

test("a repository with no rules of its own says so rather than reporting the workflow's", async () => {
  const { leaf } = await installPair();
  const declaration = await readLeafDeclaration("lukachi/api", leaf);

  assert.equal(declaration.instructions.includes("wfctl:begin"), false);
  assert.equal(declaration.instructionsSha256, "");
  assert.deepEqual(declaration.skills, []);
});

test("framing approval is blocked until every bound repository is accounted for", async () => {
  const { knowledge, leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "shared-contract",
    title: "Shared contract",
    mode: "full",
    distributionRoot,
  });
  await alignKnowledge(started.specPath);

  await assert.rejects(
    approveWork({
      target: leaf,
      id: started.id,
      stage: "framing",
      by: "human:test-maintainer",
      method: "interactive",
    }),
    /has not been accounted for/,
    "a framing settles what the work is; it may not settle it blind",
  );

  await accountWorkRepository({
    target: knowledge,
    id: started.id,
    repository: "lukachi/api",
    note: "Its own rules require the graph before any read, which the plan follows.",
  });
  const approval = await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
  });
  assert.match(approval.receipt, /^[0-9a-f]{64}$/);
});

test("a repository this work does not touch is accounted for by saying so", async () => {
  const { knowledge, leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "untouched-repo",
    title: "Untouched repo",
    mode: "full",
    distributionRoot,
  });
  await alignKnowledge(started.specPath);

  await assert.rejects(
    accountWorkRepository({
      target: knowledge,
      id: started.id,
      repository: "lukachi/api",
      untouched: "   ",
    }),
    /Say what this repository's own rules require|why the work does not touch it/,
    "an empty reason is the silence the gate exists to refuse",
  );

  await accountWorkRepository({
    target: knowledge,
    id: started.id,
    repository: "lukachi/api",
    untouched: "The contract change is confined to the client; nothing here reads it.",
  });
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.deepEqual(framingIssues(document), []);
});

test("a receipt goes stale when the repository changes its own rules afterwards", async () => {
  const { knowledge, leaf } = await installPair();
  await writeFile(join(leaf, "AGENTS.md"), "# api\n\nRead the deploy notes first.\n", "utf8");
  const started = await beginWork({
    target: leaf,
    slug: "stale-rules",
    title: "Stale rules",
    mode: "full",
    distributionRoot,
  });
  await accountWorkRepository({
    target: knowledge,
    id: started.id,
    repository: "lukachi/api",
    note: "Deploy notes read; this work does not deploy.",
  });

  const before = await readWorkRepositories(knowledge, started.id);
  assert.equal(before.repositories[0]?.stale, false);

  await writeFile(
    join(leaf, "AGENTS.md"),
    "# api\n\nRead the deploy notes first.\n\n## New rule\n\nNever touch the seam directly.\n",
    "utf8",
  );

  const after = await readWorkRepositories(knowledge, started.id);
  // The receipt now describes rules that are no longer the rules. Nothing can
  // re-derive what the agent concluded from the old text, so it is reported.
  assert.equal(after.repositories[0]?.stale, true);
  assert.notEqual(
    after.repositories[0]?.accounted?.instructions_sha256,
    after.repositories[0]?.instructionsSha256,
  );
});

test("an empty knowledge base is a legal answer, and silence is not", async () => {
  const { leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "no-baseline",
    title: "No baseline",
    mode: "full",
    distributionRoot,
  });

  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.equal(
    framingIssues(document).some((issue) => /knowledge_alignment must name/.test(issue)),
    true,
  );

  // Most first tasks in a real repository run before anyone pays for a
  // reconstruction. Demanding a concept path there leaves one way through:
  // invent one, which reads exactly like a real one.
  document.metadata.knowledge_alignment = {
    reviewed: [],
    conflicts: [],
    covered: false,
    basis: "No curated concept covers this Area; the contract rests on the pinned source.",
  };
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  const reread = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.equal(
    reread.metadata.knowledge_alignment !== undefined
      && framingIssues(reread).some((issue) => /knowledge_alignment/.test(issue)),
    false,
  );

  // Absence without saying what the work rested on instead is still silence.
  (reread.metadata.knowledge_alignment as Record<string, unknown>).basis = "";
  assert.equal(
    framingIssues(reread).some((issue) => /basis must say/.test(issue)),
    true,
  );
});

async function alignKnowledge(specPath: string): Promise<void> {
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
}

async function writeSkill(root: string, name: string, description: string): Promise<void> {
  const path = join(root, ".claude/skills", name, "SKILL.md");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`, "utf8");
}

async function installPair(): Promise<{ knowledge: string; leaf: string }> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-leaf-decl-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "api");
  for (const [path, remote] of [[knowledge, ""], [leaf, "git@github.com:lukachi/api.git"]]) {
    await mkdir(path!, { recursive: true });
    execFileSync("git", ["-C", path!, "init", "-q"]);
    execFileSync("git", ["-C", path!, "config", "user.name", "wfctl tests"]);
    execFileSync("git", ["-C", path!, "config", "user.email", "wfctl@example.invalid"]);
    execFileSync("git", ["-C", path!, "config", "commit.gpgsign", "false"]);
    if (remote) {
      execFileSync("git", ["-C", path!, "remote", "add", "origin", remote]);
    }
  }
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  await applyInstallPlan(await buildInstallPlan({
    target: leaf,
    profile: "leaf",
    knowledge,
    distributionRoot,
  }));
  execFileSync("git", ["-C", leaf, "add", "-A"]);
  execFileSync("git", ["-C", leaf, "commit", "-q", "-m", "initialize workflow"]);
  await addLeafRepository(knowledge, leaf);
  return { knowledge, leaf };
}

test("a bundle cannot archive its decisions unaccounted for", async () => {
  const { leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "decides-something",
    title: "Decides something",
    mode: "full",
    distributionRoot,
  });

  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.equal(
    decisionAccountingIssues(document).some((issue) =>
      /must account for what this work decided/.test(issue)
    ),
    true,
    "silence is what let five recorded answers archive into a place nobody reads",
  );

  await recordWorkDecision({
    target: leaf,
    id: started.id,
    what: "An effect belongs to the thing that bears it.",
    said: "map.md#ISSUE-001",
    disposition: "promoted",
    into: "knowledge/decisions/effects-belong-to-what-bears-them.md",
  });
  assert.deepEqual(
    decisionAccountingIssues(parseWorkSpec(await readFile(started.specPath, "utf8"))),
    [],
  );
});

test("settling nothing durable is an answer, and an empty list alone is not", async () => {
  const { leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "settles-nothing",
    title: "Settles nothing",
    mode: "full",
    distributionRoot,
  });

  // Written by hand, which is the only way an empty list reaches the record
  // without a reason: the command refuses to produce one.
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  (document.metadata.knowledge_promotion as Record<string, unknown>).decisions = [];
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  assert.equal(
    decisionAccountingIssues(parseWorkSpec(await readFile(started.specPath, "utf8")))
      .some((issue) => /say why this work settled nothing/.test(issue)),
    true,
  );

  await recordWorkDecision({
    target: leaf,
    id: started.id,
    none: "A rename with no behaviour change settles no question.",
    what: "",
    said: "",
    disposition: "none",
  });
  assert.deepEqual(
    decisionAccountingIssues(parseWorkSpec(await readFile(started.specPath, "utf8"))),
    [],
  );
});

test("a decision recorded without saying where it was said is refused", async () => {
  const { leaf } = await installPair();
  const started = await beginWork({
    target: leaf,
    slug: "no-origin",
    title: "No origin",
    mode: "full",
    distributionRoot,
  });

  await assert.rejects(
    recordWorkDecision({
      target: leaf,
      id: started.id,
      what: "Something was decided.",
      said: "  ",
      disposition: "promoted",
      into: "knowledge/decisions/x.md",
    }),
    /a decision with no origin cannot be weighed later/,
  );
  await assert.rejects(
    recordWorkDecision({
      target: leaf,
      id: started.id,
      what: "Something was decided.",
      said: "maintainer_review.framing",
      disposition: "promoted",
    }),
    /Name the concept that now carries this decision/,
  );
});
