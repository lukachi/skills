import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { hashContent } from "./planner.js";
import type { InstallPlan, PlanOperation, WorkflowState } from "./types.js";
import { STATE_SCHEMA_VERSION, WORKFLOW_VERSION } from "./types.js";

export interface ApplyResult {
  changed: number;
  statePath: string;
  backups: string[];
}

export async function applyInstallPlan(plan: InstallPlan): Promise<ApplyResult> {
  const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to apply ${conflicts.length} conflict(s): ${conflicts.map((item) => item.path).join(", ")}`,
    );
  }

  let changed = 0;
  const backups: string[] = [];
  const backupRoot = join(
    plan.target,
    ".workflow/backups",
    new Date().toISOString().replaceAll(":", "-"),
  );
  for (const operation of plan.operations) {
    if (operation.status === "unchanged") {
      continue;
    }
    await assertExpectedState(plan.target, operation);
    if (operation.backup) {
      const backupPath = join(backupRoot, operation.path);
      await mkdir(dirname(backupPath), { recursive: true });
      await copyFile(join(plan.target, operation.path), backupPath);
      backups.push(backupPath);
    }
    await applyOperation(plan.target, operation);
    changed += 1;
  }

  const files: WorkflowState["files"] = {};
  for (const operation of plan.operations) {
    if (operation.track && operation.content !== undefined) {
      files[operation.path] = { sha256: hashContent(operation.content) };
    }
  }
  const state: WorkflowState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    installedVersion: WORKFLOW_VERSION,
    profile: plan.profile,
    files,
  };
  const statePath = join(plan.target, ".workflow/state.json");
  await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);

  return { changed, statePath, backups };
}

async function applyOperation(target: string, operation: PlanOperation): Promise<void> {
  const absolute = join(target, operation.path);
  if (operation.kind === "directory") {
    await mkdir(absolute, { recursive: true });
    return;
  }
  if (operation.kind === "symlink") {
    if (!operation.linkTarget) {
      throw new Error(`Missing symlink target for ${operation.path}`);
    }
    await mkdir(dirname(absolute), { recursive: true });
    await symlink(operation.linkTarget, absolute);
    return;
  }
  if (operation.content === undefined) {
    throw new Error(`Missing content for ${operation.path}`);
  }
  await writeAtomic(absolute, operation.content);
}

async function assertExpectedState(target: string, operation: PlanOperation): Promise<void> {
  const absolute = join(target, operation.path);
  if (operation.status === "create") {
    try {
      await lstat(absolute);
      throw new Error(`${operation.path} appeared after planning`);
    } catch (error) {
      if (isMissing(error)) {
        return;
      }
      throw error;
    }
  }

  if (operation.expectedHash) {
    const current = await readFile(absolute);
    if (hashContent(current) !== operation.expectedHash) {
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

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
