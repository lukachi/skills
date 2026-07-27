import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { readRepositoryMetadata } from "../src/git.js";
import { buildInstallPlan } from "../src/planner.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";
import { beginWork, flushWork, verifyWork } from "../src/work.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("runs the completed central work lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-work-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "leaf-repo");
  await mkdir(knowledge);
  await mkdir(leaf);
  initializeGit(knowledge);
  initializeGit(leaf);

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
  await mkdir(join(leaf, "graphify-out"));
  await writeFile(join(leaf, "graphify-out/graph.json"), "{}\n", "utf8");

  const started = await beginWork({
    target: leaf,
    slug: "world-loop",
    title: "World loop",
    mode: "full",
    knowledgeRef: "knowledge/index.md",
    graphQuery: "Trace the world loop",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });

  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  document.metadata.status = "completed";
  document.metadata.verification = {
    result: "passed",
    acceptance_reviewed: true,
    implementation_reviewed: true,
    checks: [{ command: "bun run test", result: "passed" }],
    unresolved: [],
  };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");

  const verified = await verifyWork(leaf, started.id);
  assert.deepEqual(verified.issues, []);

  const flushed = await flushWork({
    target: leaf,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  const raw = await readFile(flushed.rawPath, "utf8");
  assert.match(raw, /type: Work Record/);
  assert.match(raw, /outcome: completed/);
  assert.match(raw, /checkout: leaf-repo/);
  assert.match(raw, /worktree: false/);
  await access(join(flushed.archivePath, "SPEC.md"));
  await assert.rejects(access(started.pointerPath));
});

test("allows a lightweight handoff to flush as partial or abandoned", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-handoff-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "leaf-repo");
  await mkdir(knowledge);
  await mkdir(leaf);
  initializeGit(knowledge);
  initializeGit(leaf);
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

  for (const [index, outcome] of (["partial", "abandoned"] as const).entries()) {
    const started = await beginWork({
      target: leaf,
      slug: `small-handoff-${outcome}`,
      title: `Small ${outcome} handoff`,
      mode: "handoff",
      distributionRoot,
      now: new Date(`2026-07-28T1${index}:00:00.000Z`),
    });
    const flushed = await flushWork({
      target: leaf,
      id: started.id,
      outcome,
      now: new Date(`2026-07-28T1${index + 2}:00:00.000Z`),
    });
    assert.match(await readFile(flushed.rawPath, "utf8"), new RegExp(`outcome: ${outcome}`));
  }
});

test("detects linked Git worktrees in flush metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-worktree-"));
  const main = join(root, "main");
  const feature = join(root, "feature");
  await mkdir(main);
  initializeGit(main);
  execFileSync("git", ["-C", main, "worktree", "add", "-b", "feature", feature], {
    stdio: "ignore",
  });

  const metadata = readRepositoryMetadata(feature);
  assert.equal(metadata.worktree, true);
  assert.equal(metadata.checkout, "feature");
  assert.equal(metadata.branch, "feature");
  assert.notEqual(metadata.commit, "unknown");
});

function initializeGit(root: string): void {
  execFileSync("git", ["-C", root, "init", "-q"]);
  writeFileSync(join(root, "seed.txt"), "seed\n");
  execFileSync("git", ["-C", root, "add", "seed.txt"]);
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=wfctl tests",
      "-c",
      "user.email=wfctl@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "-q",
      "-m",
      "seed",
    ],
  );
}
