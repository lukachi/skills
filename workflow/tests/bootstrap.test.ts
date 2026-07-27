import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyBootstrapPlan,
  buildBootstrapPlan,
} from "../src/bootstrap.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("installs and converges the setup skill for Codex and Claude user roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-bootstrap-"));
  const codexSkillsRoot = join(root, ".agents/skills");
  const claudeSkillsRoot = join(root, ".claude/skills");
  const options = {
    agent: "both" as const,
    codexSkillsRoot,
    claudeSkillsRoot,
    distributionRoot,
  };

  const first = await buildBootstrapPlan(options);
  assert.equal(first.operations.some((operation) => operation.status === "conflict"), false);
  assert.equal(first.operations.every((operation) => operation.status === "create"), true);
  await applyBootstrapPlan(first);

  for (const skillsRoot of [codexSkillsRoot, claudeSkillsRoot]) {
    const skillRoot = join(skillsRoot, "setup-workflow-environment");
    assert.match(await readFile(join(skillRoot, "SKILL.md"), "utf8"), /knowledge repository/);
    assert.match(await readFile(join(skillRoot, ".wfctl-state.json"), "utf8"), /installedVersion/);
  }

  const second = await buildBootstrapPlan(options);
  assert.equal(
    second.operations.every((operation) => operation.status === "unchanged"),
    true,
  );
});

test("refuses to overwrite a modified user bootstrap skill", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-bootstrap-conflict-"));
  const codexSkillsRoot = join(root, ".agents/skills");
  const options = {
    agent: "codex" as const,
    codexSkillsRoot,
    distributionRoot,
  };
  await applyBootstrapPlan(await buildBootstrapPlan(options));

  const skillPath = join(codexSkillsRoot, "setup-workflow-environment/SKILL.md");
  await writeFile(skillPath, `${await readFile(skillPath, "utf8")}\nLocal edit.\n`, "utf8");

  const plan = await buildBootstrapPlan(options);
  const conflict = plan.operations.find((operation) =>
    operation.relativePath === "SKILL.md"
  );
  assert.equal(conflict?.status, "conflict");
  assert.match(conflict?.reason ?? "", /locally modified/);
  await assert.rejects(applyBootstrapPlan(plan), /Refusing to apply/);
});
