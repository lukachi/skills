import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cases = [
  { name: "node", command: "node", args: ["dist/cli.js", "--version"] },
  { name: "bun", command: "bun", args: ["dist/cli.js", "--version"] },
  { name: "deno", command: "deno", args: ["run", "-A", "dist/cli.js", "--version"] },
];

for (const runtime of cases) {
  const result = spawnSync(runtime.command, runtime.args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    throw new Error(`${runtime.name} is required for the wfctl runtime matrix`);
  }
  assert.equal(
    result.status,
    0,
    `${runtime.name} failed:\n${result.stderr || result.stdout}`,
  );
  assert.match(result.stdout, /0\.1\.0/, `${runtime.name} did not print wfctl version`);

  const target = mkdtempSync(join(tmpdir(), `wfctl-${runtime.name}-`));
  const planArgs = runtime.name === "deno"
    ? ["run", "-A", "dist/cli.js", "plan", "knowledge", "--target", target, "--json"]
    : ["dist/cli.js", "plan", "knowledge", "--target", target, "--json"];
  const plan = spawnSync(runtime.command, planArgs, { encoding: "utf8" });
  assert.equal(plan.status, 0, `${runtime.name} plan failed:\n${plan.stderr || plan.stdout}`);
  const parsed = JSON.parse(plan.stdout);
  assert.equal(parsed.profile, "knowledge");
  assert.ok(parsed.counts.create > 0);

  const applyArgs = runtime.name === "deno"
    ? ["run", "-A", "dist/cli.js", "init", "knowledge", "--target", target, "--json"]
    : ["dist/cli.js", "init", "knowledge", "--target", target, "--json"];
  const applied = spawnSync(runtime.command, applyArgs, { encoding: "utf8" });
  assert.equal(
    applied.status,
    0,
    `${runtime.name} apply failed:\n${applied.stderr || applied.stdout}`,
  );
  assert.equal(existsSync(join(target, "AGENTS.md")), true);
  assert.equal(readlinkSync(join(target, "CLAUDE.md")), "AGENTS.md");

  const converged = spawnSync(runtime.command, planArgs, { encoding: "utf8" });
  assert.equal(
    converged.status,
    0,
    `${runtime.name} converged plan failed:\n${converged.stderr || converged.stdout}`,
  );
  assert.equal(JSON.parse(converged.stdout).counts.create, 0);
  process.stdout.write(`${runtime.name}: ok\n`);
}
