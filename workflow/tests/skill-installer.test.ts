import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, lstat, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { installSkills } from "../src/skill-installer.js";

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
  assert.equal(
    (await lstat(join(target, ".agents/skills/manage-project-work"))).isSymbolicLink(),
    false,
  );
  assert.equal(
    (await lstat(join(target, ".claude/skills/manage-project-work"))).isSymbolicLink(),
    false,
  );
  await access(join(target, "skills-lock.json"));
  await assert.rejects(
    async () =>
      installSkills({
        target,
        distributionRoot,
        profile: "leaf",
        scope: "project",
        agents: ["codex", "claude"],
        yes: true,
      }),
    /Refusing non-interactive skill replacement/,
  );
});
