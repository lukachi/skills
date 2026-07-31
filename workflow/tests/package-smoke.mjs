import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
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
  assert.equal(existsSync(join(packaged, "README.md")), true);
  assert.equal(existsSync(join(packaged, "IDEA.md")), true);
  assert.equal(existsSync(join(packaged, "THIRD_PARTY.md")), true);
  assert.equal(existsSync(join(packaged, "docs/01-installation.md")), true);
  assert.equal(existsSync(join(packaged, "docs/07-maintainer-control.md")), true);
  assert.equal(existsSync(join(packaged, "spec/ENGINE.md")), true);
  assert.equal(existsSync(join(packaged, "spec/KNOWLEDGE.md")), true);
  assert.equal(existsSync(join(packaged, "spec/WORK.md")), true);
  assert.equal(existsSync(join(packaged, "spec/RECONSTRUCTION.md")), true);
  assert.equal(existsSync(join(packaged, "spec/CLI.md")), true);
  assert.equal(existsSync(join(packaged, "spec/DEVELOPMENT.md")), true);
  assert.equal(existsSync(join(packaged, "spec/VERIFICATION.md")), true);

  const userGuides = readdirSync(join(packaged, "docs"))
    .filter((entry) => entry.endsWith(".md"))
    .sort();
  assert.deepEqual(userGuides, [
    "01-installation.md",
    "02-daily-work.md",
    "03-knowledge-repository.md",
    "04-reading-project-knowledge.md",
    "05-existing-project.md",
    "06-raw-material.md",
    "07-maintainer-control.md",
  ]);

  const packageReadme = readFileSync(join(packaged, "README.md"), "utf8");
  assert.ok(
    packageReadme.split("\n").length <= 120,
    "README.md must remain a short introduction",
  );
  assert.match(packageReadme, /project collaboration and knowledge workflow/i);
  assert.match(packageReadme, /maintainer\/product road/i);
  assert.match(packageReadme, /engineering road/i);
  for (const guide of userGuides) {
    const content = readFileSync(join(packaged, "docs", guide), "utf8");
    assert.match(content, /## Use this when/);
    assert.match(content, /## Problem/);
    assert.match(content, /## Outcome/);
    assert.ok(
      content.split("\n").length <= 180,
      `${guide} must remain a focused user guide`,
    );
  }
  assert.equal(
    existsSync(join(packaged, "evals/knowledge-views/trigger-evals.json")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "evals/knowledge-views/behavior-evals.json")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "evals/knowledge-routing/trigger-evals.json")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "evals/knowledge-routing/behavior-evals.json")),
    true,
  );
  assert.equal(existsSync(join(packaged, "LICENSE")), true);
  assert.equal(existsSync(join(packaged, "skills/manage-project-work/SKILL.md")), true);
  assert.equal(existsSync(join(packaged, "skills/specify-project-change/SKILL.md")), true);
  assert.equal(existsSync(join(packaged, "skills/split-project-change/SKILL.md")), true);
  assert.equal(existsSync(join(packaged, "skills/implement-work-item/SKILL.md")), true);
  assert.equal(
    existsSync(join(packaged, "skills/operate-project-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/explore-project-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/process-raw-intake/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/reconstruct-project-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/curate-product-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/curate-engineering-knowledge/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/verify-knowledge-quality/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/shape-project-direction/SKILL.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/research-project-context/SKILL.md")),
    true,
  );
  assert.equal(existsSync(join(packaged, "rules/leaf/workflow-routing.md")), true);
  assert.equal(existsSync(join(packaged, "templates/knowledge/knowledge/index.md")), true);
  assert.equal(existsSync(join(packaged, "templates/guides/common.md")), true);
  assert.equal(existsSync(join(packaged, "vendor/mattpocock/upstream.json")), true);
  assert.equal(existsSync(join(packaged, "vendor/mattpocock/LICENSE")), true);

  const target = join(sandbox, "consumer");
  const mainHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "--help"],
    { encoding: "utf8" },
  );
  assert.equal(mainHelp.status, 0, mainHelp.stderr || mainHelp.stdout);
  assert.match(
    stripAnsi(mainHelp.stdout),
    /Maintainers normally use init; installed agents own the remaining commands/,
  );
  assert.match(stripAnsi(mainHelp.stdout), /init\s+\[knowledge\|leaf\]/);
  assert.match(stripAnsi(mainHelp.stdout), /Maintenance:/);
  assert.match(stripAnsi(mainHelp.stdout), /Knowledge operations:/);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+plan\s/m);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+apply\s/m);
  assert.doesNotMatch(stripAnsi(mainHelp.stdout), /^\s+sync\s/m);

  const workHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "work", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(workHelp.status, 0, workHelp.stderr || workHelp.stdout);
  assert.match(stripAnsi(workHelp.stdout), /^\s+context\s/m);
  assert.match(stripAnsi(workHelp.stdout), /^\s+issue\s/m);
  assert.match(stripAnsi(workHelp.stdout), /^\s+map\s/m);
  assert.match(stripAnsi(workHelp.stdout), /^\s+review\s/m);

  const sourcesHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "sources", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(sourcesHelp.status, 0, sourcesHelp.stderr || sourcesHelp.stdout);
  assert.match(stripAnsi(sourcesHelp.stdout), /^\s+add\s/m);
  assert.match(stripAnsi(sourcesHelp.stdout), /^\s+select\s/m);
  assert.match(stripAnsi(sourcesHelp.stdout), /^\s+list\s/m);
  assert.doesNotMatch(stripAnsi(sourcesHelp.stdout), /^\s+connect\s/m);

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
  assert.equal(existsSync(join(target, "reconstruction/active")), true);
  assert.equal(
    existsSync(join(target, ".workflow/current/knowledge-graph.json")),
    true,
  );
  assert.equal(
    existsSync(join(target, ".workflow/current/claim-ledger.json")),
    true,
  );

  const knowledgeHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(knowledgeHelp.status, 0, knowledgeHelp.stderr || knowledgeHelp.stdout);
  assert.match(stripAnsi(knowledgeHelp.stdout), /^\s+build\s/m);
  assert.match(stripAnsi(knowledgeHelp.stdout), /^\s+reconstruct\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+scan\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+mark\s/m);
  assert.doesNotMatch(stripAnsi(knowledgeHelp.stdout), /^\s+coverage\s/m);

  const caseHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "case", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(caseHelp.status, 0, caseHelp.stderr || caseHelp.stdout);
  assert.match(stripAnsi(caseHelp.stdout), /^\s+migrate\s/m);
  assert.match(stripAnsi(caseHelp.stdout), /^\s+probe\s/m);

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
  assert.equal(
    existsSync(join(target, ".workflow/current/claim-ledger.json")),
    true,
  );

  process.stdout.write("package: ok\n");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
