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
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
