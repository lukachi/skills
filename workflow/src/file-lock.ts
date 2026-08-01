import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_MS = 50;
const DEFAULT_STALE_MS = 5 * 60_000;

interface LockRecord {
  token: string;
  pid: number;
  createdAt: string;
}

export interface FileLockOptions {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
}

export async function withFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  options: FileLockOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const token = randomUUID();
  const startedAt = Date.now();
  await mkdir(dirname(lockPath), { recursive: true });

  while (true) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        const record: LockRecord = {
          token,
          pid: process.pid,
          createdAt: new Date().toISOString(),
        };
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) {
        throw error;
      }
      if (await canRecoverStaleLock(lockPath, staleMs)) {
        try {
          await unlink(lockPath);
          continue;
        } catch (unlinkError) {
          if (!hasCode(unlinkError, "ENOENT")) {
            throw unlinkError;
          }
          continue;
        }
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(
          `Timed out waiting for workflow state lock: ${lockPath}`,
        );
      }
      await delay(retryMs);
    }
  }

  try {
    return await operation();
  } finally {
    await releaseOwnedLock(lockPath, token);
  }
}

async function canRecoverStaleLock(
  lockPath: string,
  staleMs: number,
): Promise<boolean> {
  try {
    const info = await stat(lockPath);
    if (Date.now() - info.mtimeMs < staleMs) {
      return false;
    }
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as unknown;
    if (!isLockRecord(parsed)) {
      return true;
    }
    return !isProcessAlive(parsed.pid);
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return false;
    }
    return false;
  }
}

async function releaseOwnedLock(lockPath: string, token: string): Promise<void> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as unknown;
    if (!isLockRecord(parsed) || parsed.token !== token) {
      return;
    }
    await unlink(lockPath);
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return hasCode(error, "EPERM");
  }
}

function isLockRecord(value: unknown): value is LockRecord {
  return typeof value === "object"
    && value !== null
    && typeof (value as { token?: unknown }).token === "string"
    && typeof (value as { pid?: unknown }).pid === "number"
    && typeof (value as { createdAt?: unknown }).createdAt === "string";
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}
