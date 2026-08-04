import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, lstat, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  installSkills,
  installSkillsTransactional,
} from "../src/skill-installer.js";

import type { ToolRunner } from "../src/dependencies.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Stands in for QMD's native skill directory. This suite is about the installer
 * placing a third-party skill under both agent roots and rolling it back, which
 * is true whatever the source is; resolving the real one needs `qmd` on PATH,
 * and the unit job does not have it. `tests/qmd-integration.mjs` covers the
 * real resolution in the job that installs QMD.
 */
const qmdSkillSourceRunner: ToolRunner = (command, args) => {
  if (command === "qmd" && args.join(" ") === "skills path qmd") {
    const skill = join(mkdtempSync(join(tmpdir(), "wfctl-qmd-skill-")), "qmd");
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      join(skill, "SKILL.md"),
      "---\nname: qmd\ndescription: Retrieve Markdown through the QMD index.\n---\n\n"
        + "# QMD\n\nFixture stand-in for the native skill.\n",
      "utf8",
    );
    return { status: 0, stdout: `${skill}\n`, stderr: "" };
  }
  return { status: 1, stdout: "", stderr: `unexpected command: ${command}` };
};

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
    runner: qmdSkillSourceRunner,
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
    runner: qmdSkillSourceRunner,
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
    runner: qmdSkillSourceRunner,
  });
  await writeFile(skillPath, "simulated later installation failure\n", "utf8");
  transaction.rollback();
  assert.equal(await readFile(skillPath, "utf8"), original);
});
