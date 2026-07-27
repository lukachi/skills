import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { errorMessage, readConfig, resolveKnowledgeRoot } from "./config.js";
import { isGitRepository } from "./git.js";
import { buildInstallPlan } from "./planner.js";
import type { DoctorCheck, DoctorReport } from "./types.js";

export interface DoctorOptions {
  graphifyAvailable?: boolean;
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

  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  checks.push(await pathCheck(
    "knowledge",
    join(knowledgeRoot, "knowledge/index.md"),
    "fail",
    `Knowledge bundle found at ${knowledgeRoot}`,
    `Knowledge bundle is missing at ${knowledgeRoot}`,
  ));

  if (config.profile === "knowledge") {
    for (const directory of ["raw", "changes/active", "changes/archive"]) {
      checks.push(await pathCheck(
        `knowledge-${directory}`,
        join(target, directory),
        "fail",
        `${directory} exists`,
        `${directory} is missing`,
      ));
    }
  }

  try {
    const plan = await buildInstallPlan({
      target,
      profile: config.profile,
      ...(config.profile === "leaf" ? { knowledge: knowledgeRoot } : {}),
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
