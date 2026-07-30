import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = mkdtempSync(join(tmpdir(), "wfctl-reconstruction-real-"));
const leaf = mkdtempSync(join(tmpdir(), "wfctl-reconstruction-real-leaf-"));

try {
  initializeGit(knowledge);
  initializeGit(leaf);
  mkdirSync(join(knowledge, ".workflow"), { recursive: true });
  writeFileSync(
    join(knowledge, ".workflow/config.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      profile: "knowledge",
      installedVersion: "0.3.0",
      skills: { scope: "none", agents: [] },
    }, null, 2)}\n`,
  );
  run("git", ["-C", knowledge, "add", "."]);
  run("git", ["-C", knowledge, "commit", "-q", "-m", "initialize knowledge"]);

  mkdirSync(join(leaf, ".workflow"), { recursive: true });
  mkdirSync(join(leaf, "src"), { recursive: true });
  writeFileSync(
    join(leaf, ".workflow/config.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      profile: "leaf",
      installedVersion: "0.3.0",
      skills: { scope: "none", agents: [] },
      knowledge: { path: knowledge },
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(leaf, "src/main.ts"),
    "export function greet(name: string): string {\n  return `Hello ${name}`;\n}\n",
  );
  writeFileSync(join(leaf, ".gitignore"), "graphify-out/\n");
  run("git", ["-C", leaf, "add", "."]);
  run("git", ["-C", leaf, "commit", "-q", "-m", "initialize source"]);
  run("node", [
    join(packageRoot, "dist/cli.js"),
    "knowledge",
    "sources",
    "add",
    "--target",
    knowledge,
    "--leaf",
    leaf,
    "--json",
  ]);

  const started = run("node", [
    join(packageRoot, "dist/cli.js"),
    "knowledge",
    "reconstruct",
    "start",
    "real-baseline",
    "--target",
    knowledge,
    "--title",
    "Real Graphify baseline",
    "--leaf",
    leaf,
    "--json",
  ]);
  const result = JSON.parse(started.stdout);
  assert.equal(result.repositories.length, 1);
  assert.ok(result.repositories[0].graphNodes > 0);
  assert.ok(result.repositories[0].trackedFiles > 0);
  assert.equal(existsSync(result.repositories[0].coverage), true);
  assert.equal(existsSync(join(leaf, "graphify-out/graph.json")), true);

  const coverage = JSON.parse(run("node", [
    join(packageRoot, "dist/cli.js"),
    "knowledge",
    "reconstruct",
    "coverage",
    result.id,
    "--target",
    knowledge,
    "--json",
  ]).stdout);
  assert.equal(
    coverage.repositories[0].outstandingFiles.length,
    result.repositories[0].trackedFiles,
  );
  const pinnedRead = JSON.parse(run("node", [
    join(packageRoot, "dist/cli.js"),
    "knowledge",
    "reconstruct",
    "read",
    result.id,
    "src/main.ts",
    "--target",
    knowledge,
    "--repository",
    result.repositories[0].repository,
    "--json",
  ]).stdout);
  assert.equal(pinnedRead.complete, true);
  assert.match(pinnedRead.content, /export function greet/);

  const caseText = readFileSync(result.path, "utf8");
  assert.doesNotMatch(caseText, new RegExp(escapeRegExp(leaf)));
  const bindingPath = join(
    knowledge,
    ".workflow/current/reconstruction",
    `${result.id}.json`,
  );
  assert.match(readFileSync(bindingPath, "utf8"), new RegExp(escapeRegExp(leaf)));

  const closed = run("node", [
    join(packageRoot, "dist/cli.js"),
    "knowledge",
    "reconstruct",
    "close",
    result.id,
    "--target",
    knowledge,
    "--outcome",
    "partial",
    "--json",
  ]);
  assert.equal(JSON.parse(closed.stdout).outcome, "partial");
  assert.equal(existsSync(bindingPath), false);
  process.stdout.write("reconstruction: real Graphify lifecycle ok\n");
} finally {
  rmSync(knowledge, { recursive: true, force: true });
  rmSync(leaf, { recursive: true, force: true });
}

function initializeGit(target) {
  run("git", ["-C", target, "init", "-q"]);
  run("git", ["-C", target, "config", "user.name", "wfctl integration"]);
  run("git", ["-C", target, "config", "user.email", "wfctl@example.invalid"]);
  run("git", ["-C", target, "config", "commit.gpgsign", "false"]);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
