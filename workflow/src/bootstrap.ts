import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { collectFiles, findDistributionRoot } from "./assets.js";
import { errorMessage, isMissingFileError } from "./config.js";
import { hashContent } from "./planner.js";
import { WORKFLOW_VERSION } from "./types.js";

export type BootstrapAgent = "codex" | "claude" | "both";
type ConcreteAgent = Exclude<BootstrapAgent, "both">;

export interface BootstrapOptions {
  agent: BootstrapAgent;
  codexSkillsRoot?: string;
  claudeSkillsRoot?: string;
  distributionRoot?: string;
}

export interface BootstrapOperation {
  agent: ConcreteAgent;
  path: string;
  relativePath: string;
  status: "create" | "update" | "unchanged" | "conflict";
  reason: string;
  content?: string;
  expectedHash?: string;
}

export interface BootstrapTarget {
  agent: ConcreteAgent;
  skillsRoot: string;
  skillRoot: string;
  statePath: string;
}

export interface BootstrapPlan {
  agent: BootstrapAgent;
  targets: BootstrapTarget[];
  operations: BootstrapOperation[];
}

export interface BootstrapApplyResult {
  changed: number;
  statePaths: string[];
}

interface BootstrapState {
  schemaVersion: 1;
  installedVersion: string;
  files: Record<string, { sha256: string }>;
}

const SETUP_SKILL = "setup-workflow-environment";

export async function buildBootstrapPlan(
  options: BootstrapOptions,
): Promise<BootstrapPlan> {
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const sourceRoot = join(distributionRoot, "skills", SETUP_SKILL);
  const sourceFiles = await collectFiles(sourceRoot);
  if (sourceFiles.length === 0) {
    throw new Error(`Bootstrap skill is missing from distribution: ${sourceRoot}`);
  }

  const targets = bootstrapTargets(options);
  const operations: BootstrapOperation[] = [];

  for (const target of targets) {
    const state = await readBootstrapState(target.statePath);
    for (const relativePath of sourceFiles) {
      const content = await readFile(join(sourceRoot, relativePath), "utf8");
      operations.push(await planBootstrapFile(target, relativePath, content, state));
    }
  }

  return {
    agent: options.agent,
    targets,
    operations: operations.sort((left, right) =>
      left.agent.localeCompare(right.agent) || left.path.localeCompare(right.path)
    ),
  };
}

export async function applyBootstrapPlan(
  plan: BootstrapPlan,
): Promise<BootstrapApplyResult> {
  const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to apply ${conflicts.length} bootstrap conflict(s): ${
        conflicts.map((operation) => operation.path).join(", ")
      }`,
    );
  }

  let changed = 0;
  for (const operation of plan.operations) {
    if (operation.status === "unchanged") {
      continue;
    }
    await assertExpectedState(operation);
    await writeAtomic(operation.path, operation.content ?? "");
    changed += 1;
  }

  const statePaths: string[] = [];
  for (const target of plan.targets) {
    const files: BootstrapState["files"] = {};
    for (const operation of plan.operations) {
      if (operation.agent === target.agent && operation.content !== undefined) {
        files[operation.relativePath] = { sha256: hashContent(operation.content) };
      }
    }
    const state: BootstrapState = {
      schemaVersion: 1,
      installedVersion: WORKFLOW_VERSION,
      files,
    };
    await writeAtomic(target.statePath, `${JSON.stringify(state, null, 2)}\n`);
    statePaths.push(target.statePath);
  }

  return { changed, statePaths };
}

export function summarizeBootstrapPlan(plan: BootstrapPlan): Record<string, unknown> {
  const counts = Object.fromEntries(
    ["create", "update", "unchanged", "conflict"].map((status) => [
      status,
      plan.operations.filter((operation) => operation.status === status).length,
    ]),
  );
  return {
    agent: plan.agent,
    targets: plan.targets.map(({ agent, skillsRoot, skillRoot }) => ({
      agent,
      skillsRoot,
      skillRoot,
    })),
    counts,
    operations: plan.operations.map(
      ({ content: _content, expectedHash: _expectedHash, ...operation }) => operation,
    ),
  };
}

function bootstrapTargets(options: BootstrapOptions): BootstrapTarget[] {
  const requested: ConcreteAgent[] = options.agent === "both"
    ? ["codex", "claude"]
    : [options.agent];
  return requested.map((agent) => {
    const configured = agent === "codex"
      ? options.codexSkillsRoot
      : options.claudeSkillsRoot;
    const defaultRoot = agent === "codex"
      ? join(homedir(), ".agents/skills")
      : join(homedir(), ".claude/skills");
    const skillsRoot = resolve(configured ?? defaultRoot);
    const skillRoot = join(skillsRoot, SETUP_SKILL);
    return {
      agent,
      skillsRoot,
      skillRoot,
      statePath: join(skillRoot, ".wfctl-state.json"),
    };
  });
}

async function planBootstrapFile(
  target: BootstrapTarget,
  relativePath: string,
  content: string,
  state: BootstrapState | undefined,
): Promise<BootstrapOperation> {
  const path = join(target.skillRoot, relativePath);
  const desiredHash = hashContent(content);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "conflict",
        reason: "destination exists and is not a regular file",
      };
    }
    const currentHash = hashContent(await readFile(path));
    if (currentHash === desiredHash) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "unchanged",
        reason: "bootstrap skill file is current",
        content,
        expectedHash: currentHash,
      };
    }
    const installedHash = state?.files[relativePath]?.sha256;
    if (installedHash && installedHash === currentHash) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "update",
        reason: "managed bootstrap skill file matches the installed version",
        content,
        expectedHash: currentHash,
      };
    }
    return {
      agent: target.agent,
      path,
      relativePath,
      status: "conflict",
      reason: installedHash
        ? "managed bootstrap skill file was locally modified"
        : "destination exists without wfctl ownership",
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        agent: target.agent,
        path,
        relativePath,
        status: "create",
        reason: "bootstrap skill file is absent",
        content,
      };
    }
    return {
      agent: target.agent,
      path,
      relativePath,
      status: "conflict",
      reason: `cannot inspect bootstrap skill file: ${errorMessage(error)}`,
    };
  }
}

async function readBootstrapState(path: string): Promise<BootstrapState | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<BootstrapState>;
    if (parsed.schemaVersion !== 1 || !parsed.files) {
      throw new Error("invalid state shape");
    }
    return parsed as BootstrapState;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new Error(`Cannot read bootstrap state ${path}: ${errorMessage(error)}`);
  }
}

async function assertExpectedState(operation: BootstrapOperation): Promise<void> {
  if (operation.status === "create") {
    try {
      await lstat(operation.path);
      throw new Error(`${operation.path} appeared after planning`);
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }
      throw error;
    }
  }

  if (operation.expectedHash) {
    const currentHash = hashContent(await readFile(operation.path));
    if (currentHash !== operation.expectedHash) {
      throw new Error(`${operation.path} changed after planning`);
    }
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.wfctl-${randomUUID()}.tmp`);
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}
