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
  assert.equal(existsSync(join(packaged, "skills/manage-project-work/SKILL.md")), true);
  assert.equal(existsSync(join(packaged, "rules/common/workflow-routing.md")), true);
  assert.equal(existsSync(join(packaged, "templates/knowledge/knowledge/index.md")), true);

  const target = join(sandbox, "consumer");
  const plan = spawnSync(
    "node",
    [
      join(packaged, "dist/cli.js"),
      "plan",
      "knowledge",
      "--target",
      target,
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  const summary = JSON.parse(plan.stdout);
  assert.equal(summary.profile, "knowledge");
  assert.ok(summary.counts.create > 0);

  process.stdout.write("package: ok\n");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
