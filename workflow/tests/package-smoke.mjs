import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(join(tmpdir(), "wfctl-package-"));
const stripAnsi = (value) => value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

try {
  const packed = spawnSync(
    "bun",
    ["pm", "pack", "--destination", sandbox],
    { cwd: packageRoot, encoding: "utf8" },
  );
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);

  const archive = readdirSync(sandbox).find((entry) => entry.endsWith(".tgz"));
  assert.ok(archive, "bun pm pack did not produce an archive");

  const extracted = spawnSync(
    "tar",
    ["-xzf", join(sandbox, archive), "-C", sandbox],
    { encoding: "utf8" },
  );
  assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);

  const packaged = join(sandbox, "package");
  assert.equal(existsSync(join(packaged, "GETTING_STARTED.md")), true);
  assert.equal(existsSync(join(packaged, "skills/manage-project-work/SKILL.md")), true);
  assert.equal(
    existsSync(join(packaged, "skills/operate-project-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/process-raw-intake/SKILL.md")),
    true,
  );
  assert.equal(existsSync(join(packaged, "rules/leaf/workflow-routing.md")), true);
  assert.equal(existsSync(join(packaged, "templates/knowledge/knowledge/index.md")), true);
  assert.equal(existsSync(join(packaged, "templates/guides/common.md")), true);

  const target = join(sandbox, "consumer");
  const mainHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "--help"],
    { encoding: "utf8" },
  );
  assert.equal(mainHelp.status, 0, mainHelp.stderr || mainHelp.stdout);
  assert.match(stripAnsi(mainHelp.stdout), /init\s+\[knowledge\|leaf\]/);
  assert.match(stripAnsi(mainHelp.stdout), /Maintenance:/);
  assert.match(stripAnsi(mainHelp.stdout), /Knowledge operations:/);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+plan\s/m);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+apply\s/m);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+sync\s/m);

  const initHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "init", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(initHelp.status, 0, initHelp.stderr || initHelp.stdout);
  assert.match(
    stripAnsi(initHelp.stdout),
    /Repository kind: knowledge \(central knowledge base\) or leaf/,
  );

  const missingProfile = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "init"],
    { encoding: "utf8" },
  );
  assert.equal(missingProfile.status, 1, missingProfile.stderr || missingProfile.stdout);
  assert.match(missingProfile.stderr, /Repository kind is required/);

  const git = spawnSync("git", ["init", "-q", target], { encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr || git.stdout);
  const plan = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "init",
      "knowledge",
      "--target",
      target,
      "--skills",
      "none",
      "--dry-run",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const summary = JSON.parse(plan.stdout);
  assert.equal(summary.profile, "knowledge");
  assert.ok(summary.counts.create > 0);

  const renderedGuide = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "init",
      "knowledge",
      "--target",
      target,
      "--print-instructions",
      "guide",
    ],
    { encoding: "utf8" },
  );
  assert.equal(renderedGuide.status, 0, renderedGuide.stderr || renderedGuide.stdout);
  assert.match(renderedGuide.stdout, /## Review gates/);

  const initialized = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "init",
      "knowledge",
      "--target",
      target,
      "--skills",
      "none",
      "--yes",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  assert.equal(existsSync(join(target, "PROJECT_WORKFLOW.md")), true);
  assert.equal(existsSync(join(target, ".qmd/index.yml")), true);
  assert.equal(existsSync(join(target, "changes/active")), true);
  assert.equal(existsSync(join(target, "changes/inbox")), true);
  assert.equal(existsSync(join(target, "intake/cases/active")), true);
  assert.equal(
    existsSync(join(target, ".workflow/current/knowledge-graph.json")),
    true,
  );

  const knowledgeHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(knowledgeHelp.status, 0, knowledgeHelp.stderr || knowledgeHelp.stdout);
  assert.match(stripAnsi(knowledgeHelp.stdout), /^\s+build\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+scan\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+mark\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+coverage\s/m);

  const graphBuild = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "knowledge",
      "build",
      "--target",
      target,
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(graphBuild.status, 0, graphBuild.stderr || graphBuild.stdout);
  assert.equal(JSON.parse(graphBuild.stdout).built, true);
  assert.equal(
    existsSync(join(target, ".workflow/current/knowledge-graph.json")),
    true,
  );

  process.stdout.write("package: ok\n");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
