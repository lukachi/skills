import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { errorMessage, readConfig, resolveKnowledgeRoot } from "./config.js";
import { isGitRepository } from "./git.js";
import { validateKnowledge } from "./knowledge.js";
import { buildInstallPlan, skillsForProfile } from "./planner.js";
import type { DoctorCheck, DoctorReport } from "./types.js";

export interface DoctorOptions {
  graphifyAvailable?: boolean;
  qmdAvailable?: boolean;
}

export async function runDoctor(
  targetInput: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const target = resolve(targetInput);
  const checks: DoctorCheck[] = [];
  let config;

  try {
    config = await readConfig(target);
    checks.push({ name: "config", status: "pass", message: `${config.profile} profile` });
  } catch (error) {
    checks.push({ name: "config", status: "fail", message: errorMessage(error) });
    return { target, checks };
  }

  const gitRepository = isGitRepository(target);
  checks.push({
    name: "git",
    status: gitRepository ? "pass" : "fail",
    message: gitRepository ? "Git repository detected" : "Target is not a Git worktree",
  });

  if (config.profile === "leaf") {
    const graphifyAvailable = options.graphifyAvailable
      ?? spawnSync("graphify", ["--version"], { stdio: "ignore" }).status === 0;
    checks.push({
      name: "graphify-cli",
      status: graphifyAvailable ? "pass" : "fail",
      message: graphifyAvailable ? "Graphify is available" : "Graphify is not available",
    });

    checks.push(await pathCheck(
      "graphify-graph",
      join(target, "graphify-out/graph.json"),
      "warn",
      "Graphify graph is ready",
      "Graphify graph has not been built",
    ));
  }

  if (config.skills?.scope === "project") {
    for (const skill of skillsForProfile(config.profile)) {
      if (config.skills.agents.includes("codex")) {
        checks.push(await pathCheck(
          `codex-skill-${skill}`,
          join(target, ".agents/skills", skill, "SKILL.md"),
          "fail",
          `Codex skill ${skill} is installed`,
          `Codex skill ${skill} is missing`,
        ));
      }
      if (config.skills.agents.includes("claude")) {
        checks.push(await pathCheck(
          `claude-skill-${skill}`,
          join(target, ".claude/skills", skill, "SKILL.md"),
          "fail",
          `Claude skill ${skill} is installed`,
          `Claude skill ${skill} is missing`,
        ));
      }
    }
  } else if (config.skills?.scope === "user") {
    checks.push({
      name: "user-skills",
      status: "warn",
      message: "User-scope skills are managed by the skills CLI outside this repository",
    });
  }

  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const qmdAvailable = options.qmdAvailable
    ?? spawnSync("qmd", ["--version"], { stdio: "ignore" }).status === 0;
  checks.push({
    name: "qmd-cli",
    status: qmdAvailable ? "pass" : "fail",
    message: qmdAvailable
      ? "QMD is available"
      : "QMD is missing; install it with bun install -g @tobilu/qmd",
  });
  checks.push(await pathCheck(
    "qmd-index-config",
    join(knowledgeRoot, ".qmd/index.yml"),
    "fail",
    `Project-local QMD collections found at ${knowledgeRoot}`,
    `Project-local QMD configuration is missing at ${knowledgeRoot}`,
  ));

  checks.push(await pathCheck(
    "knowledge",
    join(knowledgeRoot, "knowledge/index.md"),
    "fail",
    `Knowledge bundle found at ${knowledgeRoot}`,
    `Knowledge bundle is missing at ${knowledgeRoot}`,
  ));

  checks.push(await pathCheck(
    "maintainer-guide",
    join(target, "PROJECT_WORKFLOW.md"),
    "fail",
    "Maintainer guide is present",
    "PROJECT_WORKFLOW.md is missing",
  ));

  if (config.profile === "knowledge") {
    for (
      const directory of [
        "raw",
        "intake/cases/active",
        "intake/cases/archive",
        "changes/active",
        "changes/archive",
        "changes/inbox",
      ]
    ) {
      checks.push(await pathCheck(
        `knowledge-${directory}`,
        join(target, directory),
        "fail",
        `${directory} exists`,
        `${directory} is missing`,
      ));
    }
    try {
      const validation = await validateKnowledge(target);
      checks.push({
        name: "curated-knowledge",
        status: validation.valid ? "pass" : "fail",
        message: validation.valid
          ? `${validation.files} curated Markdown file(s) satisfy the trust profile`
          : `${validation.errors.length} curated knowledge validation error(s)`,
      });
    } catch (error) {
      checks.push({
        name: "curated-knowledge",
        status: "fail",
        message: errorMessage(error),
      });
    }
  }

  try {
    const plan = await buildInstallPlan({
      target,
      profile: config.profile,
      ...(config.profile === "leaf" ? { knowledge: knowledgeRoot } : {}),
      ...(config.skills ? { skills: config.skills } : {}),
    });
    const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
    const pending = plan.operations.filter((operation) =>
      operation.status === "create" || operation.status === "update"
    );
    if (conflicts.length > 0) {
      checks.push({
        name: "installation",
        status: "fail",
        message: `${conflicts.length} workflow conflict(s)`,
      });
    } else if (pending.length > 0) {
      checks.push({
        name: "installation",
        status: "warn",
        message: `${pending.length} workflow update(s) pending`,
      });
    } else {
      checks.push({
        name: "installation",
        status: "pass",
        message: "Workflow assets are current",
      });
    }
  } catch (error) {
    checks.push({ name: "installation", status: "fail", message: errorMessage(error) });
  }

  return { target, profile: config.profile, checks };
}

export function doctorPassed(report: DoctorReport): boolean {
  return report.checks.every((check) => check.status !== "fail");
}

async function pathCheck(
  name: string,
  path: string,
  missingStatus: DoctorCheck["status"],
  presentMessage: string,
  missingMessage: string,
): Promise<DoctorCheck> {
  try {
    await access(path, constants.F_OK);
    return { name, status: "pass", message: presentMessage };
  } catch {
    return { name, status: missingStatus, message: missingMessage };
  }
}
