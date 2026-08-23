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

function assertLocalMarkdownLinks(path) {
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) {
      continue;
    }
    const local = target.split("#", 1)[0];
    assert.equal(
      existsSync(resolve(dirname(path), local)),
      true,
      `${path} links to missing ${target}`,
    );
  }
}

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
  assert.equal(existsSync(join(packaged, "docs/01-setup.md")), true);
  assert.equal(existsSync(join(packaged, "docs/04-your-part.md")), true);
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
  // Four guides, one per situation the maintainer is actually in: setting up,
  // working in knowledge, working in a source repository, and deciding.
  assert.deepEqual(userGuides, [
    "01-setup.md",
    "02-knowledge-repository.md",
    "03-leaf-repository.md",
    "04-your-part.md",
  ]);

  const packageReadme = readFileSync(join(packaged, "README.md"), "utf8");
  assert.ok(
    packageReadme.split("\n").length <= 120,
    "README.md must remain a short introduction",
  );
  assert.match(packageReadme, /project collaboration and knowledge workflow/i);
  assert.match(packageReadme, /maintainer\/product road/i);
  assert.match(packageReadme, /engineering road/i);
  assert.match(packageReadme, /Matt Pocock/i);
  assert.match(packageReadme.replaceAll("\n", " "), /one attributed workflow/i);
  for (const guide of userGuides) {
    const content = readFileSync(join(packaged, "docs", guide), "utf8");
    // Every guide must say when it applies and what the maintainer decides in
    // it. Normative behavior belongs in spec/, not restated here.
    assert.match(content, /## Use this when/);
    assert.match(content, /## What you decide|^- what the project is for/m);
    assert.ok(
      content.split("\n").length <= 260,
      `${guide} must remain a focused user guide`,
    );
    assertLocalMarkdownLinks(join(packaged, "docs", guide));
  }
  assertLocalMarkdownLinks(join(packaged, "README.md"));
  assertLocalMarkdownLinks(join(packaged, "THIRD_PARTY.md"));
  for (
    const suite of [
      "knowledge-views",
      "knowledge-routing",
      "work-lifecycle",
      "session-recovery",
    ]
  ) {
    for (const kind of ["trigger", "behavior"]) {
      assert.equal(
        existsSync(join(packaged, `evals/${suite}/${kind}-evals.json`)),
        true,
        `packaged artifact is missing evals/${suite}/${kind}-evals.json`,
      );
    }
  }
  assert.equal(existsSync(join(packaged, "evals/README.md")), true);
  assert.equal(existsSync(join(packaged, "LICENSE")), true);
  assert.equal(existsSync(join(packaged, "skills/manage-project-work/SKILL.md")), true);
  assert.equal(
    existsSync(join(packaged, "skills/manage-project-work/assets/capture.md")),
    true,
  );
  assert.equal(
    existsSync(join(packaged, "skills/manage-project-work/assets/handoff.md")),
    false,
  );
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
  const upstream = JSON.parse(
    readFileSync(join(packaged, "vendor/mattpocock/upstream.json"), "utf8"),
  );
  assert.equal(upstream.distribution.installOriginalSuite, false);
  assert.equal(upstream.distribution.fetchMutableUpstreamAtInstall, false);
  assert.equal(upstream.derivations.length, 5);

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
  assert.match(stripAnsi(workHelp.stdout), /^\s+capture\s/m);
  assert.match(stripAnsi(workHelp.stdout), /^\s+checkpoint\s/m);
  assert.doesNotMatch(stripAnsi(workHelp.stdout), /^\s+handoff\s/m);

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

  const reconstructHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "reconstruct", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(reconstructHelp.status, 0, reconstructHelp.stderr || reconstructHelp.stdout);
  assert.match(stripAnsi(reconstructHelp.stdout), /^\s+raw-scope\s/m);

  const workstreamHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "reconstruct", "workstream", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(workstreamHelp.status, 0, workstreamHelp.stderr || workstreamHelp.stdout);
  assert.match(stripAnsi(workstreamHelp.stdout), /^\s+escalate\s/m);

  const workstreamCreateHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "reconstruct", "workstream", "create", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(
    workstreamCreateHelp.status,
    0,
    workstreamCreateHelp.stderr || workstreamCreateHelp.stdout,
  );
  assert.match(stripAnsi(workstreamCreateHelp.stdout), /--workload/);
  assert.match(stripAnsi(workstreamCreateHelp.stdout), /--profile/);
  assert.match(stripAnsi(workstreamCreateHelp.stdout), /--routing-reason/);

  const workstreamEscalateHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "reconstruct", "workstream", "escalate", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(
    workstreamEscalateHelp.status,
    0,
    workstreamEscalateHelp.stderr || workstreamEscalateHelp.stdout,
  );
  assert.match(stripAnsi(workstreamEscalateHelp.stdout), /--trigger/);
  assert.match(stripAnsi(workstreamEscalateHelp.stdout), /--action/);

  const intakeStartHelp = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "knowledge", "case", "start", "--help"],
    { encoding: "utf8" },
  );
  assert.equal(intakeStartHelp.status, 0, intakeStartHelp.stderr || intakeStartHelp.stdout);
  assert.match(stripAnsi(intakeStartHelp.stdout), /--reconstruction/);

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

  // Against an empty directory, and never the default target. Run from the
  // workflow repository's own root this asserted nothing: the cwd is already an
  // installed leaf, so `init` read its profile from the config, reached the
  // confirmation prompt, and failed non-interactively with an unrelated message.
  const missingProfile = spawnSync(
    "node",
    [join(packaged, "dist/cli.js"), "init", "--target", target],
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
  assert.equal(existsSync(join(target, "changes/archive/captures")), true);
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

  const captureAdd = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "capture",
      "add",
      "package-smoke",
      "--target",
      target,
      "--title",
      "Package smoke capture",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(captureAdd.status, 0, captureAdd.stderr || captureAdd.stdout);
  const captured = JSON.parse(captureAdd.stdout);
  assert.equal(existsSync(captured.path), true);

  const captureList = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "capture",
      "list",
      "--target",
      target,
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(captureList.status, 0, captureList.stderr || captureList.stdout);
  assert.deepEqual(
    JSON.parse(captureList.stdout).captures.map((entry) => entry.id),
    [captured.id],
  );

  const captureResolve = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "capture",
      "resolve",
      captured.id,
      "--target",
      target,
      "--outcome",
      "discarded",
      "--reason",
      "Package smoke lifecycle completed.",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(
    captureResolve.status,
    0,
    captureResolve.stderr || captureResolve.stdout,
  );
  assert.equal(existsSync(JSON.parse(captureResolve.stdout).archivePath), true);

  const workStart = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "start",
      "package-checkpoint",
      "--target",
      target,
      "--title",
      "Package checkpoint smoke",
      "--mode",
      "full",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(workStart.status, 0, workStart.stderr || workStart.stdout);
  const startedWork = JSON.parse(workStart.stdout);
  const checkpoint = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "checkpoint",
      startedWork.id,
      "--target",
      target,
      "--actor",
      "agent:package-smoke",
      "--state",
      "The package checkpoint command ran.",
      "--last",
      "Created the packaged work bundle.",
      "--next",
      "Inspect the packaged context output.",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(checkpoint.status, 0, checkpoint.stderr || checkpoint.stdout);
  assert.equal(JSON.parse(checkpoint.stdout).valid, true);
  const workContext = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "work",
      "context",
      "--target",
      target,
      "--stage",
      "resume",
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(workContext.status, 0, workContext.stderr || workContext.stdout);
  assert.equal(JSON.parse(workContext.stdout).id, startedWork.id);
  assert.equal(JSON.parse(workContext.stdout).checkpoints[0].valid, true);

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
