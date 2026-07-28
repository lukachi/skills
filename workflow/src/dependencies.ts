import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isGitRepository } from "./git.js";
import type { DoctorCheck, Profile } from "./types.js";

export const MIN_QMD_VERSION = "2.5.3";

export interface ToolCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ToolCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export type ToolRunner = (
  command: string,
  args: string[],
  options?: ToolCommandOptions,
) => ToolCommandResult;

export type AsyncToolRunner = (
  command: string,
  args: string[],
  options?: ToolCommandOptions,
) => Promise<ToolCommandResult>;

export const runTool: ToolRunner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
};

export const runToolAsync: AsyncToolRunner = (command, args, options = {}) =>
  new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        resolveResult({ status: null, stdout, stderr, error });
      }
    });
    child.on("close", (status) => {
      if (!settled) {
        settled = true;
        resolveResult({ status, stdout, stderr });
      }
    });
  });

export function runInstallPreflight(input: {
  target: string;
  profile: Profile;
  knowledge?: string;
  initializeGit?: boolean;
  requireQmdSkill: boolean;
  runner?: ToolRunner;
}): DoctorCheck[] {
  const target = resolve(input.target);
  const runner = input.runner ?? runTool;
  const checks: DoctorCheck[] = [];
  const gitRepository = isGitRepository(target);

  checks.push({
    name: "git",
    status: gitRepository || input.initializeGit ? "pass" : "fail",
    message: gitRepository
      ? "Git repository detected"
      : input.initializeGit
      ? "Git repository will be initialized before installation"
      : input.profile === "knowledge"
      ? "Target is not a Git repository; rerun with --init-git or initialize Git first"
      : "Target must be an existing Git repository",
  });
  checks.push(qmdVersionCheck(runner));

  if (input.requireQmdSkill) {
    try {
      const source = resolveQmdSkillSource(runner);
      checks.push({
        name: "qmd-native-skill",
        status: "pass",
        message: `Version-matched QMD skill found at ${source}`,
      });
    } catch (error) {
      checks.push({
        name: "qmd-native-skill",
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (input.profile === "leaf") {
    const graphify = runner("graphify", ["--version"], { cwd: target });
    checks.push({
      name: "graphify-cli",
      status: graphify.status === 0 ? "pass" : "fail",
      message: graphify.status === 0
        ? `Graphify is available${toolVersionSuffix(graphify.stdout)}`
        : "Graphify is required for a leaf repository; install it before initialization",
    });

    const knowledge = input.knowledge ? resolve(input.knowledge) : undefined;
    const configured = knowledge
      ? isGitRepository(knowledge)
        && existsSync(join(knowledge, ".qmd/index.yml"))
        && existsSync(join(knowledge, "knowledge/index.md"))
      : false;
    checks.push({
      name: "knowledge-repository",
      status: configured ? "pass" : "fail",
      message: configured
        ? `Initialized knowledge repository found at ${knowledge}`
        : "Leaf initialization requires an initialized knowledge repository",
    });
  }

  return checks;
}

export function qmdVersionCheck(runner: ToolRunner = runTool): DoctorCheck {
  const result = runner("qmd", ["--version"]);
  if (result.status !== 0) {
    return {
      name: "qmd-version",
      status: "fail",
      message:
        `QMD >= ${MIN_QMD_VERSION} is required; install it with bun install -g @tobilu/qmd@${MIN_QMD_VERSION}`,
    };
  }
  const version = parseQmdVersion(result.stdout || result.stderr);
  if (!version) {
    return {
      name: "qmd-version",
      status: "fail",
      message: `Cannot parse QMD version from: ${(result.stdout || result.stderr).trim()}`,
    };
  }
  const supported = compareVersions(version, MIN_QMD_VERSION) >= 0;
  return {
    name: "qmd-version",
    status: supported ? "pass" : "fail",
    message: supported
      ? `QMD ${version} satisfies >= ${MIN_QMD_VERSION}`
      : `QMD ${version} is too old; run bun install -g @tobilu/qmd@${MIN_QMD_VERSION}`,
  };
}

export function resolveQmdSkillSource(runner: ToolRunner = runTool): string {
  const result = runner("qmd", ["skills", "path", "qmd"]);
  if (result.status !== 0) {
    throw new Error(
      `QMD cannot expose its native skill: ${commandFailure(result)}`,
    );
  }
  const source = resolve(result.stdout.trim());
  if (!existsSync(join(source, "SKILL.md"))) {
    throw new Error(`QMD returned an invalid native skill path: ${source}`);
  }
  return source;
}

export function updateQmdIndex(
  knowledgeRoot: string,
  runner: ToolRunner = runTool,
): ToolCommandResult {
  return runner("qmd", ["update"], { cwd: resolve(knowledgeRoot) });
}

export function updateGraphifyGraph(
  sourceRoot: string,
  runner: ToolRunner = runTool,
): ToolCommandResult {
  return runner("graphify", ["update", "."], { cwd: resolve(sourceRoot) });
}

export function updateGraphifyGraphAsync(
  sourceRoot: string,
  runner: AsyncToolRunner = runToolAsync,
): Promise<ToolCommandResult> {
  return runner("graphify", ["update", "."], { cwd: resolve(sourceRoot) });
}

export function parseQmdVersion(output: string): string | undefined {
  return output.match(/\bqmd\s+(\d+\.\d+\.\d+)\b/i)?.[1];
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

export function commandFailure(result: ToolCommandResult): string {
  return [
    result.error?.message,
    result.stderr.trim(),
    result.stdout.trim(),
  ].find((detail) => detail)
    ?? `exit status ${result.status ?? "unknown"}`;
}

function toolVersionSuffix(output: string): string {
  const version = output.trim();
  return version ? ` (${version})` : "";
}
