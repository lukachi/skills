import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = mkdtempSync(join(tmpdir(), "wfctl-qmd-integration-"));
const leaf = mkdtempSync(join(tmpdir(), "wfctl-leaf-integration-"));
const marker = `raw-only-${Date.now()}-${Math.random().toString(16).slice(2)}`;

try {
  run("git", ["init", "-q", target]);
  const initialized = run("node", [
    join(packageRoot, "dist/cli.js"),
    "init",
    "knowledge",
    "--target",
    target,
    "--yes",
    "--json",
  ]);
  const report = JSON.parse(initialized.stdout);
  assert.equal(
    report.preflight.some((check) =>
      check.name === "qmd-version" && check.status === "pass"
    ),
    true,
  );
  assert.equal(
    report.preflight.some((check) =>
      check.name === "qmd-native-skill" && check.status === "pass"
    ),
    true,
  );
  assert.equal(existsSync(join(target, ".agents/skills/qmd/SKILL.md")), true);
  assert.equal(existsSync(join(target, ".claude/skills/qmd/SKILL.md")), true);
  assert.equal(
    report.check.checks.some((check) =>
      check.name === "qmd-bm25-index" && check.status === "pass"
    ),
    true,
  );

  writeFileSync(join(target, "raw/only-in-raw.md"), `# Raw only\n\n${marker}\n`);
  run("qmd", ["update"], target);

  const unscoped = JSON.parse(
    run("qmd", ["search", marker, "--format", "json"], target).stdout,
  );
  assert.deepEqual(unscoped, [], "unscoped QMD search leaked raw input");

  const raw = JSON.parse(
    run("qmd", ["search", marker, "-c", "raw", "--format", "json"], target)
      .stdout,
  );
  assert.equal(raw.length, 1, "explicit raw search did not find the marker");
  assert.match(JSON.stringify(raw[0]), /only-in-raw\.md/);

  const status = run("qmd", ["status"], target);
  assert.match(status.stdout, /knowledge \(qmd:\/\/knowledge\/\)/);
  assert.match(status.stdout, /raw \(qmd:\/\/raw\/\)/);
  const doctor = run(
    "qmd",
    ["doctor"],
    target,
    { QMD_DOCTOR_DEVICE_PROBE: "0", NO_COLOR: "1" },
  );
  assert.match(doctor.stdout, /index config: 5 collections configured/);

  run("git", ["init", "-q", leaf]);
  writeFileSync(
    join(leaf, "main.ts"),
    "export function ready(): boolean {\n  return true;\n}\n",
  );
  const leafInitialized = JSON.parse(
    run("node", [
      join(packageRoot, "dist/cli.js"),
      "init",
      "leaf",
      "--target",
      leaf,
      "--knowledge",
      target,
      "--yes",
      "--json",
    ]).stdout,
  );
  assert.equal(
    leafInitialized.check.checks.some((check) =>
      check.name === "graphify-update" && check.status === "pass"
    ),
    true,
  );
  assert.equal(
    leafInitialized.check.checks.some((check) =>
      check.name === "graphify-graph" && check.status === "pass"
    ),
    true,
  );
  assert.equal(existsSync(join(leaf, "graphify-out/graph.json")), true);
  assert.match(
    readFileSync(join(leaf, ".gitignore"), "utf8"),
    /graphify-out\//,
  );

  process.stdout.write("qmd: real integration ok\n");
} finally {
  rmSync(target, { recursive: true, force: true });
  rmSync(leaf, { recursive: true, force: true });
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
  );
  return result;
}
