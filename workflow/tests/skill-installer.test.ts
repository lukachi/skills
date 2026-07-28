import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, lstat, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  installSkills,
  installSkillsTransactional,
} from "../src/skill-installer.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("delegates project skill placement to the pinned skills CLI", async () => {
  const target = await mkdtemp(join(tmpdir(), "wfctl-skills-"));
  execFileSync("git", ["-C", target, "init", "-q"]);

  installSkills({
    target,
    distributionRoot,
    profile: "leaf",
    scope: "project",
    agents: ["codex", "claude"],
    yes: true,
  });

  await access(join(target, ".agents/skills/manage-project-work/SKILL.md"));
  await access(join(target, ".claude/skills/manage-project-work/SKILL.md"));
  await access(join(target, ".agents/skills/qmd/SKILL.md"));
  await access(join(target, ".claude/skills/qmd/SKILL.md"));
  assert.equal(
    (await lstat(join(target, ".agents/skills/manage-project-work"))).isSymbolicLink(),
    false,
  );
  assert.equal(
    (await lstat(join(target, ".claude/skills/manage-project-work"))).isSymbolicLink(),
    false,
  );
  await access(join(target, "skills-lock.json"));
  installSkills({
    target,
    distributionRoot,
    profile: "leaf",
    scope: "project",
    agents: ["codex", "claude"],
    yes: true,
  });
  await access(join(target, ".agents/skills/manage-project-work/SKILL.md"));
  await access(join(target, ".claude/skills/manage-project-work/SKILL.md"));

  const skillPath = join(target, ".agents/skills/manage-project-work/SKILL.md");
  const original = await readFile(skillPath, "utf8");
  const transaction = installSkillsTransactional({
    target,
    distributionRoot,
    profile: "leaf",
    scope: "project",
    agents: ["codex", "claude"],
    yes: true,
  });
  await writeFile(skillPath, "simulated later installation failure\n", "utf8");
  transaction.rollback();
  assert.equal(await readFile(skillPath, "utf8"), original);
});
