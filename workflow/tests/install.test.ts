import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { applyInstallPlan } from "../src/applier.js";
import type { ToolRunner } from "../src/dependencies.js";
import {
  doctorPassed,
  qmdModelCacheCheck,
  runDoctor,
} from "../src/doctor.js";
import { writeKnowledgeGraph } from "../src/knowledge-graph.js";
import { writeClaimLedger } from "../src/claim-ledger.js";
import { buildInstallPlan, hashContent } from "../src/planner.js";
import {
  addLeafRepository,
  listRepositoryConnections,
  resolveReconstructionLeaves,
  selectLeafRepository,
} from "../src/repository-registry.js";
import { installSkills } from "../src/skill-installer.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("installs a knowledge profile and converges to an unchanged plan", async () => {
  const target = await temporaryDirectory("wfctl-knowledge-");
  const first = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(first.operations.some((operation) => operation.status === "conflict"), false);
  await applyInstallPlan(first);

  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  assert.match(agents, /wfctl:begin/);
  assert.match(agents, /before inspecting, searching, planning/);
  assert.match(agents, /official native `graphify` skill/);
  assert.match(agents, /Invoke `operate-project-knowledge` as the default entry point/);
  assert.match(agents, /invoke\s+`explore-project-knowledge`/i);
  assert.match(agents, /natural-language request as the user interface/);
  assert.equal(await readlink(join(target, "CLAUDE.md")), "AGENTS.md");
  assert.match(await readFile(join(target, "knowledge/index.md"), "utf8"), /okf_version/);
  assert.match(await readFile(join(target, "knowledge/areas/index.md"), "utf8"), /primary durable decomposition/);
  assert.match(
    await readFile(join(target, "knowledge/product/flows/index.md"), "utf8"),
    /genuinely cross several Areas/,
  );
  await assert.rejects(access(join(target, "knowledge/domains/index.md")));
  const qmd = await readFile(join(target, ".qmd/index.yml"), "utf8");
  const qmdConfig = parse(qmd) as {
    collections: Record<string, {
      path: string;
      includeByDefault: boolean;
    }>;
    models: Record<string, string>;
  };
  assert.deepEqual(Object.keys(qmdConfig.collections), [
    "knowledge",
    "changes",
    "intake",
    "reconstruction",
    "raw",
  ]);
  assert.equal(qmdConfig.collections.knowledge?.path, join(target, "knowledge"));
  assert.equal(qmdConfig.collections.knowledge?.includeByDefault, true);
  assert.equal(qmdConfig.collections.raw?.includeByDefault, false);
  assert.match(qmdConfig.models.embed ?? "", /embeddinggemma-300M/);
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /OKF and the stricter workflow profile/,
  );
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /Knowledge repository practice/,
  );
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /knowledge\/areas\/<area>\/index\.md/,
  );
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /The normal optional manual CLI entry points are `wfctl init knowledge`, `wfctl/,
  );
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /What to ask the knowledge agent/,
  );
  assert.match(
    await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8"),
    /I am new to this project/,
  );
  const second = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(
    second.operations.every((operation) => operation.status === "unchanged"),
    true,
  );

  const configPath = join(target, ".workflow/config.json");
  const previousConfig = JSON.parse(await readFile(configPath, "utf8")) as {
    installedVersion: string;
  };
  previousConfig.installedVersion = "0.2.0";
  await writeFile(configPath, `${JSON.stringify(previousConfig, null, 2)}\n`, "utf8");
  const upgrade = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.ok(upgrade.operations.some((operation) =>
    operation.path === ".workflow/config.json"
    && operation.status === "update"
    && /0\.5\.0/.test(operation.reason)
  ));
});

test("renders a profile-specific leaf guide with the configured knowledge path", async () => {
  const root = await temporaryDirectory("wfctl-leaf-guide-");
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
  await mkdir(knowledge);
  await mkdir(leaf);
  await writeFile(join(leaf, ".gitignore"), "node_modules/\n", "utf8");
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

  const guide = await readFile(join(leaf, "PROJECT_WORKFLOW.md"), "utf8");
  assert.match(guide, /Leaf repository practice/);
  assert.match(guide, /Project knowledge: `\.\.\/knowledge`/);
  assert.match(guide, /Your normal interface is conversation/);
  assert.match(guide, /Multiple inputs, one promotion gate/);
  assert.match(guide, /Graphify boundary/);
  assert.match(guide, /changes\/active/);
  assert.equal(
    await readFile(join(leaf, ".gitignore"), "utf8"),
    "node_modules/\n\n# wfctl:begin\ngraphify-out/\n# wfctl:end\n",
  );
  assert.match(
    await readFile(join(leaf, ".graphifyignore"), "utf8"),
    /\.agents\/[\s\S]*\.claude\/[\s\S]*\.workflow\/[\s\S]*skills-lock\.json/,
  );
});

test("preserves existing instructions and leaves skill directories to the skills CLI", async () => {
  const target = await temporaryDirectory("wfctl-preserve-");
  await writeFile(join(target, "AGENTS.md"), "# Existing agents\n", "utf8");
  await writeFile(join(target, "CLAUDE.md"), "# Existing Claude\n", "utf8");
  await mkdir(join(target, ".claude/skills"), { recursive: true });
  await mkdir(join(target, ".claude/skills/custom-skill"), { recursive: true });

  const plan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(plan.operations.some((operation) => operation.status === "conflict"), false);
  await applyInstallPlan(plan);

  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), /^# Existing agents/m);
  assert.match(await readFile(join(target, "CLAUDE.md"), "utf8"), /^# Existing Claude/m);
  await access(join(target, ".claude/skills/custom-skill"));
  await assert.rejects(access(join(target, ".claude/skills/analyze-with-graphify")));
  await assert.rejects(access(join(target, ".agents/skills")));

  const syncPlan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  await applyInstallPlan(syncPlan);
  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), /^# Existing agents/m);
  assert.match(await readFile(join(target, "CLAUDE.md"), "utf8"), /^# Existing Claude/m);
  await access(join(target, ".claude/skills/custom-skill"));
});

test("reports a conflict when an owned file was locally modified", async () => {
  const target = await temporaryDirectory("wfctl-conflict-");
  const first = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  await applyInstallPlan(first);
  const owned = join(target, ".workflow/rules/evidence-first.md");
  await writeFile(owned, `${await readFile(owned, "utf8")}\nLocal edit.\n`, "utf8");

  const second = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  const conflict = second.operations.find((operation) =>
    operation.path === ".workflow/rules/evidence-first.md"
  );
  assert.equal(conflict?.status, "conflict");
  assert.match(conflict?.reason ?? "", /locally modified/);
});

test("deletes only obsolete files that still match workflow ownership", async () => {
  const target = await temporaryDirectory("wfctl-obsolete-");
  await applyInstallPlan(await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  }));
  const obsoletePath = ".workflow/rules/obsolete.md";
  const obsoleteContent = "obsolete workflow file\n";
  await writeFile(join(target, obsoletePath), obsoleteContent, "utf8");
  const statePath = join(target, ".workflow/state.json");
  const state = JSON.parse(await readFile(statePath, "utf8")) as {
    files: Record<string, { sha256: string }>;
  };
  state.files[obsoletePath] = { sha256: hashContent(obsoleteContent) };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const deletePlan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(
    deletePlan.operations.find((operation) => operation.path === obsoletePath)?.status,
    "delete",
  );
  await applyInstallPlan(deletePlan);
  await assert.rejects(access(join(target, obsoletePath)));

  await writeFile(join(target, obsoletePath), obsoleteContent, "utf8");
  const nextState = JSON.parse(await readFile(statePath, "utf8")) as {
    files: Record<string, { sha256: string }>;
  };
  nextState.files[obsoletePath] = { sha256: hashContent(obsoleteContent) };
  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await writeFile(join(target, obsoletePath), "maintainer edit\n", "utf8");
  const conflictPlan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(
    conflictPlan.operations.find((operation) => operation.path === obsoletePath)?.status,
    "conflict",
  );
});

test("rolls back earlier files when a later planned write drifts", async () => {
  const target = await temporaryDirectory("wfctl-rollback-");
  await writeFile(join(target, "first.txt"), "first-old\n", "utf8");
  await writeFile(join(target, "second.txt"), "second-old\n", "utf8");
  const plan = {
    target,
    profile: "knowledge" as const,
    operations: [
      {
        kind: "file" as const,
        path: "first.txt",
        status: "update" as const,
        reason: "test update",
        content: "first-new\n",
        expectedHash: hashContent("first-old\n"),
        track: true,
      },
      {
        kind: "file" as const,
        path: "second.txt",
        status: "update" as const,
        reason: "test update",
        content: "second-new\n",
        expectedHash: hashContent("second-old\n"),
        track: true,
      },
    ],
  };
  await writeFile(join(target, "second.txt"), "second-drifted\n", "utf8");
  await assert.rejects(applyInstallPlan(plan), /changed after planning/);
  assert.equal(await readFile(join(target, "first.txt"), "utf8"), "first-old\n");
  assert.equal(await readFile(join(target, "second.txt"), "utf8"), "second-drifted\n");
});

test("preserves a pre-existing maintainer guide outside the managed block", async () => {
  const target = await temporaryDirectory("wfctl-guide-conflict-");
  await writeFile(join(target, "PROJECT_WORKFLOW.md"), "# Existing workflow\n", "utf8");

  const plan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  const guideOperation = plan.operations.find((operation) =>
    operation.path === "PROJECT_WORKFLOW.md"
  );
  assert.equal(guideOperation?.status, "update");
  await applyInstallPlan(plan);
  const guide = await readFile(join(target, "PROJECT_WORKFLOW.md"), "utf8");
  assert.match(guide, /^# Existing workflow/m);
  assert.match(guide, /<!-- wfctl:begin -->/);
  assert.match(guide, /## Review gates/);
});

test("doctor accepts initialized knowledge and leaf repositories", async () => {
  const root = await temporaryDirectory("wfctl-doctor-");
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
  await mkdir(knowledge);
  await mkdir(leaf);
  execFileSync("git", ["-C", knowledge, "init", "-q"]);
  execFileSync("git", ["-C", leaf, "init", "-q"]);

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
  await addLeafRepository(knowledge, leaf);
  await writeKnowledgeGraph(knowledge);
  await writeClaimLedger(knowledge);
  await mkdir(join(leaf, "graphify-out"));
  await writeFile(
    join(leaf, "graphify-out/graph.json"),
    '{"nodes":[{"id":"root"}],"links":[]}\n',
    "utf8",
  );

  installSkills({
    target: knowledge,
    distributionRoot,
    profile: "knowledge",
    scope: "project",
    agents: ["codex", "claude"],
    yes: true,
  });
  installSkills({
    target: leaf,
    distributionRoot,
    profile: "leaf",
    scope: "project",
    agents: ["codex", "claude"],
    yes: true,
  });

  await access(join(knowledge, ".agents/skills/operate-project-knowledge/SKILL.md"));
  await access(join(knowledge, ".claude/skills/operate-project-knowledge/SKILL.md"));
  await access(join(knowledge, ".agents/skills/explore-project-knowledge/SKILL.md"));
  await access(join(knowledge, ".claude/skills/explore-project-knowledge/SKILL.md"));
  await access(join(knowledge, ".agents/skills/qmd/SKILL.md"));
  await access(join(knowledge, ".claude/skills/qmd/SKILL.md"));
  await access(join(knowledge, ".agents/skills/process-raw-intake/SKILL.md"));
  await access(join(knowledge, ".agents/skills/reconstruct-project-knowledge/SKILL.md"));
  await access(join(knowledge, ".agents/skills/curate-product-knowledge/SKILL.md"));
  await access(join(knowledge, ".agents/skills/curate-engineering-knowledge/SKILL.md"));
  await access(join(knowledge, ".agents/skills/verify-knowledge-quality/SKILL.md"));
  await access(join(leaf, ".agents/skills/setup-workflow-environment/SKILL.md"));
  await access(join(leaf, ".agents/skills/explore-project-knowledge/SKILL.md"));
  await access(join(leaf, ".claude/skills/explore-project-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/analyze-with-graphify/SKILL.md"));
  await access(join(leaf, ".agents/skills/align-project-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/manage-project-work/SKILL.md"));
  await access(join(leaf, ".agents/skills/verify-project-work/SKILL.md"));
  await access(join(leaf, ".agents/skills/curate-project-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/curate-product-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/curate-engineering-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/verify-knowledge-quality/SKILL.md"));
  await assert.rejects(access(join(leaf, ".agents/skills/operate-project-knowledge/SKILL.md")));
  await assert.rejects(access(join(leaf, ".agents/skills/process-raw-intake/SKILL.md")));
  await assert.rejects(
    access(join(leaf, ".agents/skills/reconstruct-project-knowledge/SKILL.md")),
  );

  const knowledgeReport = await runDoctor(knowledge, { runner: healthyToolRunner });
  assert.equal(doctorPassed(knowledgeReport), true);
  assert.ok(knowledgeReport.checks.some((check) =>
    check.name === "knowledge-graph" && check.status === "pass"
  ));
  assert.ok(knowledgeReport.checks.some((check) =>
    check.name === "repository-registry"
    && check.status === "pass"
    && /selection is deferred/.test(check.message)
  ));
  const leafReport = await runDoctor(leaf, { runner: healthyToolRunner });
  assert.equal(
    doctorPassed(leafReport),
    true,
    JSON.stringify(leafReport.checks.filter((check) => check.status === "fail")),
  );
  assert.ok(leafReport.checks.some((check) =>
    check.name === "repository-connection"
    && check.status === "pass"
    && /selection is deferred/.test(check.message)
    && !/inactive/i.test(check.message)
  ));

  const rootIndex = join(knowledge, "knowledge/index.md");
  await writeFile(
    rootIndex,
    `${await readFile(rootIndex, "utf8")}\n<!-- knowledge changed -->\n`,
    "utf8",
  );
  const staleGraph = await runDoctor(knowledge, { runner: healthyToolRunner });
  assert.ok(staleGraph.checks.some((check) =>
    check.name === "knowledge-graph"
    && check.status === "fail"
    && /wfctl knowledge build/.test(check.message)
  ));
});

test("doctor fails clearly when QMD is unavailable", async () => {
  const target = await temporaryDirectory("wfctl-qmd-doctor-");
  execFileSync("git", ["-C", target, "init", "-q"]);
  await applyInstallPlan(await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  }));

  const report = await runDoctor(target, {
    runner: (command) => ({
      status: command === "qmd" ? 1 : 0,
      stdout: "",
      stderr: command === "qmd" ? "command not found" : "",
    }),
  });
  assert.equal(doctorPassed(report), false);
  assert.ok(report.checks.some((check) =>
    check.name === "qmd-version"
    && check.status === "fail"
    && /bun install -g @tobilu\/qmd@2\.5\.3/.test(check.message)
  ));
});

test("doctor rejects a leaf without a local Graphify graph", async () => {
  const root = await temporaryDirectory("wfctl-leaf-graph-");
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
  await mkdir(knowledge);
  await mkdir(leaf);
  execFileSync("git", ["-C", knowledge, "init", "-q"]);
  execFileSync("git", ["-C", leaf, "init", "-q"]);
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
  await writeKnowledgeGraph(knowledge);
  await writeClaimLedger(knowledge);

  const report = await runDoctor(leaf, { runner: healthyToolRunner });
  assert.equal(doctorPassed(report), false);
  assert.ok(report.checks.some((check) =>
    check.name === "graphify-graph"
    && check.status === "fail"
    && /graphify update \./.test(check.message)
  ));
});

test("doctor ignores QMD etag metadata but rejects real model-cache failures", () => {
  const etagFalsePositive = qmdModelCacheCheck(
    "⚠ model cache: invalid 1: embedding: hf:example/model.gguf "
      + "(/Users/test/.cache/qmd/models/model.gguf.etag: not valid GGUF "
      + '(expected magic "GGUF", got "\\"9d3", 0 KB)). '
      + "Next: run `qmd pull --refresh` (or remove the bad cached file)",
  );
  assert.deepEqual(etagFalsePositive, {
    name: "qmd-models",
    status: "pass",
    message: "Semantic models are ready",
  });

  const invalidModel = qmdModelCacheCheck(
    "⚠ model cache: invalid 1: embedding: hf:example/model.gguf "
      + "(/Users/test/.cache/qmd/models/model.gguf: not valid GGUF "
      + '(expected magic "GGUF", got "<!DO", 318 MB)). '
      + "Next: run `qmd pull --refresh` (or remove the bad cached file)",
  );
  assert.equal(invalidModel.status, "warn");
  assert.match(invalidModel.message, /qmd pull --refresh/);

  const missingModel = qmdModelCacheCheck(
    "⚠ model cache: missing 1/3: embedding: hf:example/model.gguf. "
      + "Next: run `qmd pull`",
  );
  assert.equal(missingModel.status, "warn");
  assert.match(missingModel.message, /qmd pull/);
});

test("registers many worktrees without silently changing the active selection", async () => {
  const root = await temporaryDirectory("wfctl-registry-worktrees-");
  const knowledge = join(root, "knowledge");
  const main = join(root, "project");
  const feature = join(root, "project-feature");
  await mkdir(knowledge);
  await mkdir(main);
  execFileSync("git", ["-C", knowledge, "init", "-q"]);
  execFileSync("git", ["-C", main, "init", "-q"]);
  execFileSync("git", ["-C", main, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", main, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", main, "config", "commit.gpgsign", "false"]);
  await writeFile(join(main, "seed.ts"), "export const seed = true;\n", "utf8");
  execFileSync("git", ["-C", main, "add", "seed.ts"]);
  execFileSync("git", ["-C", main, "commit", "-q", "-m", "seed"]);
  execFileSync(
    "git",
    ["-C", main, "worktree", "add", "-q", "-b", "feature/registry", feature],
  );
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  const registrations = [];
  for (const leaf of [main, feature]) {
    await applyInstallPlan(await buildInstallPlan({
      target: leaf,
      profile: "leaf",
      knowledge,
      distributionRoot,
    }));
    registrations.push(await addLeafRepository(knowledge, leaf));
  }
  assert.deepEqual(
    registrations.map((entry) => entry.selection),
    ["deferred", "deferred"],
  );

  let connections = await listRepositoryConnections(knowledge);
  assert.equal(connections.length, 1);
  assert.equal(connections[0]?.checkouts.length, 2);
  assert.equal(connections[0]?.activeRoot, undefined);
  await assert.rejects(
    resolveReconstructionLeaves(knowledge, [], "baseline"),
    /no active reconstruction checkout/,
  );

  const selectedFeature = await selectLeafRepository(knowledge, feature);
  assert.equal(selectedFeature.selection, "selected");
  assert.deepEqual(
    await resolveReconstructionLeaves(knowledge, [], "baseline"),
    [await realpath(feature)],
  );
  const refreshedMain = await addLeafRepository(knowledge, main);
  assert.equal(refreshedMain.selection, "alternative");
  connections = await listRepositoryConnections(knowledge);
  assert.equal(connections[0]?.activeRoot, await realpath(feature));
  assert.equal(
    connections[0]?.checkouts.find((entry) => entry.active)?.root,
    await realpath(feature),
  );
  assert.deepEqual(
    connections[0]?.checkouts.map((entry) => entry.selection).sort(),
    ["alternative", "selected"],
  );

  const selectedMain = await selectLeafRepository(knowledge, main);
  assert.equal(selectedMain.selection, "selected");
  assert.deepEqual(
    await resolveReconstructionLeaves(knowledge, [], "baseline"),
    [await realpath(main)],
  );
});

const healthyToolRunner: ToolRunner = (command, args) => {
  if (command === "git" && args[0] === "check-ignore") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (command === "graphify") {
    return { status: 0, stdout: "graphify 0.9.26\n", stderr: "" };
  }
  if (command === "qmd" && args[0] === "--version") {
    return { status: 0, stdout: "qmd 2.5.3\n", stderr: "" };
  }
  if (command === "qmd" && args[0] === "status") {
    return {
      status: 0,
      stdout: "QMD Status\nDocuments\n  Total: 11 files indexed\n",
      stderr: "",
    };
  }
  if (command === "qmd" && args[0] === "doctor") {
    return {
      status: 0,
      stdout:
        "QMD Doctor\n✓ model cache: 3 active models are downloaded and valid GGUF\n"
        + "✓ embedding freshness: all active documents match current fingerprint\n",
      stderr: "",
    };
  }
  return { status: 1, stdout: "", stderr: `unexpected command: ${command}` };
};

async function temporaryDirectory(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}
