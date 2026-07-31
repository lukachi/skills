import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(join(tmpdir(), "wfctl-preflight-"));
const target = join(sandbox, "target");
const bin = join(sandbox, "bin");

try {
  mkdirSync(target);
  mkdirSync(bin);
  run("git", ["init", "-q", target]);
  const qmd = join(bin, "qmd");
  writeFileSync(qmd, "#!/bin/sh\nprintf 'qmd 2.5.2\\n'\n");
  chmodSync(qmd, 0o755);

  const result = spawnSync(
    "node",
    [
      join(packageRoot, "dist/cli.js"),
      "init",
      "knowledge",
      "--target",
      target,
      "--skills",
      "none",
      "--yes",
      "--json",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
    },
  );
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false);
  assert.equal(
    report.preflight.some((check) =>
      check.name === "qmd-version" && check.status === "fail"
    ),
    true,
  );
  assert.equal(existsSync(join(target, ".workflow")), false);
  assert.equal(existsSync(join(target, "AGENTS.md")), false);
  process.stdout.write("preflight: stops before writes\n");

  writeFileSync(qmd, "#!/bin/sh\nprintf 'qmd 2.5.3\\n'\n");

  const missingGitTarget = join(sandbox, "missing-git");
  mkdirSync(missingGitTarget);
  const missingGit = wfctl([
    "init",
    "knowledge",
    "--target",
    missingGitTarget,
    "--skills",
    "none",
    "--yes",
    "--json",
  ]);
  assert.equal(missingGit.status, 2, missingGit.stderr || missingGit.stdout);
  const missingGitReport = JSON.parse(missingGit.stdout);
  assert.match(
    missingGitReport.preflight.find((check) => check.name === "git").message,
    /--init-git/,
  );
  assert.equal(existsSync(join(missingGitTarget, ".git")), false);

  const dryRunTarget = join(sandbox, "dry-run-git");
  mkdirSync(dryRunTarget);
  const dryRun = wfctl([
    "init",
    "knowledge",
    "--target",
    dryRunTarget,
    "--skills",
    "none",
    "--init-git",
    "--dry-run",
    "--json",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  const dryRunReport = JSON.parse(dryRun.stdout);
  assert.match(
    dryRunReport.preflight.find((check) => check.name === "git").message,
    /will be initialized/,
  );
  assert.equal(existsSync(join(dryRunTarget, ".git")), false);

  const initializedTarget = join(sandbox, "initialized-git");
  mkdirSync(initializedTarget);
  const initialized = wfctl([
    "init",
    "knowledge",
    "--target",
    initializedTarget,
    "--skills",
    "none",
    "--init-git",
    "--yes",
    "--json",
  ]);
  assert.equal(initialized.status, 2, initialized.stderr || initialized.stdout);
  assert.equal(JSON.parse(initialized.stdout).applied.changed > 0, true);
  assert.equal(isGitRepository(initializedTarget), true);
  assert.equal(existsSync(join(initializedTarget, "AGENTS.md")), true);
  const humanCheck = wfctl(["check", "--target", initializedTarget]);
  assert.equal(humanCheck.status, 2, humanCheck.stderr || humanCheck.stdout);
  assert.match(humanCheck.stdout, /Workflow health/);
  assert.match(humanCheck.stdout, /Knowledge retrieval/);
  assert.match(humanCheck.stdout, /Next step · Enable semantic search/);
  assert.match(humanCheck.stdout, /qmd doctor/);
  assert.match(humanCheck.stdout, /qmd embed/);
  assert.match(humanCheck.stdout, /Summary/);
  assert.doesNotMatch(humanCheck.stdout, /model cache: missing/);

  const graphify = join(bin, "graphify");
  writeFileSync(graphify, "#!/bin/sh\nexit 127\n");
  chmodSync(graphify, 0o755);
  writeFileSync(
    qmd,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  printf 'qmd 2.5.3\\n'\nelse\n  printf '%s\\n' '${join(packageRoot, "skills/setup-workflow-environment")}'\nfi\n`,
  );
  const knowledge = join(sandbox, "knowledge");
  const graphifyLeaf = join(sandbox, "graphify-leaf");
  mkdirSync(knowledge);
  mkdirSync(join(knowledge, ".qmd"));
  mkdirSync(join(knowledge, "knowledge"));
  writeFileSync(join(knowledge, ".qmd/index.yml"), "collections: {}\n");
  writeFileSync(join(knowledge, "knowledge/index.md"), "# Knowledge\n");
  run("git", ["init", "-q", knowledge]);
  mkdirSync(graphifyLeaf);
  run("git", ["init", "-q", graphifyLeaf]);

  const missingGraphifyJson = wfctl([
    "init",
    "leaf",
    "--target",
    graphifyLeaf,
    "--knowledge",
    knowledge,
    "--skills",
    "project",
    "--agents",
    "both",
    "--yes",
    "--json",
  ]);
  assert.equal(
    missingGraphifyJson.status,
    2,
    missingGraphifyJson.stderr || missingGraphifyJson.stdout,
  );
  const missingGraphifyReport = JSON.parse(missingGraphifyJson.stdout);
  const graphifyCheck = missingGraphifyReport.preflight.find((check) =>
    check.name === "graphify-cli"
  );
  assert.equal(graphifyCheck.status, "fail");
  assert.deepEqual(
    graphifyCheck.remediation.steps.flatMap((step) =>
      step.command ? [step.command] : []
    ),
    [
      "uv tool install graphifyy",
      "graphify install --platform codex",
      "graphify install --platform claude",
    ],
  );
  assert.equal(existsSync(join(graphifyLeaf, ".workflow")), false);

  const missingGraphifyHuman = wfctl([
    "init",
    "leaf",
    "--target",
    graphifyLeaf,
    "--knowledge",
    knowledge,
    "--skills",
    "project",
    "--agents",
    "codex",
    "--dry-run",
  ]);
  assert.equal(
    missingGraphifyHuman.status,
    2,
    missingGraphifyHuman.stderr || missingGraphifyHuman.stdout,
  );
  assert.match(missingGraphifyHuman.stdout, /Next step · Install Graphify/);
  assert.match(missingGraphifyHuman.stdout, /uv tool install graphifyy/);
  assert.match(
    missingGraphifyHuman.stdout,
    /graphify install --platform codex/,
  );
  assert.match(missingGraphifyHuman.stdout, /Restart the coding agent/);
  assert.match(missingGraphifyHuman.stdout, /Run the same wfctl command again/);

  const leafTarget = join(sandbox, "leaf");
  mkdirSync(leafTarget);
  const leaf = wfctl([
    "init",
    "leaf",
    "--target",
    leafTarget,
    "--skills",
    "none",
    "--init-git",
    "--dry-run",
    "--json",
  ]);
  assert.equal(leaf.status, 1, leaf.stderr || leaf.stdout);
  assert.match(leaf.stderr, /only available for knowledge repositories/);
  assert.equal(existsSync(join(leafTarget, ".git")), false);
  process.stdout.write("preflight: knowledge Git initialization is explicit and dry-run safe\n");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

function wfctl(args) {
  return spawnSync("node", [join(packageRoot, "dist/cli.js"), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
  });
}

function isGitRepository(path) {
  const result = spawnSync(
    "git",
    ["-C", path, "rev-parse", "--is-inside-work-tree"],
    { encoding: "utf8" },
  );
  return result.status === 0 && result.stdout.trim() === "true";
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
