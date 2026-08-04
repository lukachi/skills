import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { hashContent } from "./planner.js";
import type { InstallPlan, PlanOperation, WorkflowState } from "./types.js";
import { STATE_SCHEMA_VERSION, WORKFLOW_VERSION } from "./types.js";

export interface ApplyResult {
  changed: number;
  /**
   * Every path this run wrote, deleted, or created, in plan order.
   *
   * A count cannot be committed. Reporting only "48 changes" left the agent
   * with nothing to stage, so an upgrade's files were swept into whatever
   * unrelated commit came next — eight workflow assets inside a sixty-nine file
   * feature commit, in one observed case.
   */
  changedPaths: string[];
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

  const changedPaths: string[] = [];
  const backups: string[] = [];
  const backupRoot = join(
    plan.target,
    ".workflow/backups",
    new Date().toISOString().replaceAll(":", "-"),
  );
  const rollbackRoot = await mkdtemp(join(tmpdir(), "wfctl-apply-"));
  const applied: RollbackSnapshot[] = [];
  const statePath = join(plan.target, ".workflow/state.json");
  const stateSnapshot = await snapshotPath(statePath, rollbackRoot, "state");
  try {
    for (const operation of plan.operations) {
      if (operation.status === "unchanged") {
        continue;
      }
      await assertExpectedState(plan.target, operation);
      const snapshot = await snapshotPath(
        join(plan.target, operation.path),
        rollbackRoot,
        `operation-${applied.length}`,
      );
      if (operation.backup) {
        const backupPath = join(backupRoot, operation.path);
        await mkdir(dirname(backupPath), { recursive: true });
        await copyFile(join(plan.target, operation.path), backupPath);
        backups.push(backupPath);
      }
      applied.push(snapshot);
      await applyOperation(plan.target, operation);
      changedPaths.push(operation.path);
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
    await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
    return { changed: changedPaths.length, changedPaths, statePath, backups };
  } catch (error) {
    let rollbackError: unknown;
    try {
      await restoreSnapshot(stateSnapshot);
      for (const snapshot of applied.reverse()) {
        await restoreSnapshot(snapshot);
      }
    } catch (caught) {
      rollbackError = caught;
    }
    if (rollbackError) {
      throw new Error(
        `Installation failed and rollback was incomplete: ${String(error)}; rollback: ${String(rollbackError)}`,
      );
    }
    throw error;
  } finally {
    await rm(rollbackRoot, { recursive: true, force: true });
  }
}

async function applyOperation(target: string, operation: PlanOperation): Promise<void> {
  const absolute = join(target, operation.path);
  if (operation.kind === "directory") {
    await mkdir(absolute, { recursive: true });
    return;
  }
  if (operation.kind === "delete") {
    await unlink(absolute);
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

interface RollbackSnapshot {
  path: string;
  kind: "absent" | "file" | "symlink" | "directory";
  backupPath?: string;
  linkTarget?: string;
}

async function snapshotPath(
  path: string,
  root: string,
  name: string,
): Promise<RollbackSnapshot> {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      return { path, kind: "symlink", linkTarget: await readlink(path) };
    }
    if (stat.isDirectory()) {
      return { path, kind: "directory" };
    }
    if (!stat.isFile()) {
      throw new Error(`Cannot transactionally snapshot unsupported path: ${path}`);
    }
    const backupPath = join(root, name);
    await copyFile(path, backupPath);
    return { path, kind: "file", backupPath };
  } catch (error) {
    if (isMissing(error)) {
      return { path, kind: "absent" };
    }
    throw error;
  }
}

async function restoreSnapshot(snapshot: RollbackSnapshot): Promise<void> {
  if (snapshot.kind === "absent") {
    await removeCurrent(snapshot.path);
    return;
  }
  if (snapshot.kind === "directory") {
    try {
      const stat = await lstat(snapshot.path);
      if (stat.isDirectory()) {
        return;
      }
      await removeCurrent(snapshot.path);
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }
    await mkdir(snapshot.path, { recursive: true });
    return;
  }
  await removeCurrent(snapshot.path);
  await mkdir(dirname(snapshot.path), { recursive: true });
  if (snapshot.kind === "symlink") {
    await symlink(snapshot.linkTarget!, snapshot.path);
  } else {
    await copyFile(snapshot.backupPath!, snapshot.path);
  }
}

async function removeCurrent(path: string): Promise<void> {
  try {
    const stat = await lstat(path);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      await rmdir(path);
    } else {
      await unlink(path);
    }
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }
}
