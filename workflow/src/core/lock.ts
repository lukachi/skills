import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * Serialize writes to one record.
 *
 * Every mutation here is read-modify-write on a JSON file. Six concurrent
 * `issue create` calls all reported success and three units survived — with
 * their ids reused, so a claim recorded against `U002` afterwards pointed at
 * different work. Nothing was lost loudly; it was lost silently, which is the
 * only kind that matters.
 *
 * This is a local advisory lock and nothing more. Teams sharing a knowledge
 * repository through Git still coordinate through Git: pretending a lock file
 * is a distributed lock would be a worse lie than having none.
 */
const STALE_AFTER_MS = 30_000;
const RETRY_MS = 15;
const WAIT_MS = 5_000;

interface Holder {
  pid: number;
  at: number;
}

function lockPath(target: string): string {
  return `${target}.lock`;
}

function holderPath(target: string): string {
  return `${lockPath(target)}/holder.json`;
}

async function readHolder(path: string): Promise<Holder | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Holder;
  } catch {
    return undefined;
  }
}

/**
 * A lock whose holder died is not a lock.
 *
 * Crashing mid-write must not wedge the repository for everyone after — the
 * fix would be deleting a file nobody documented, which is exactly the sort of
 * hand-repair this workflow refuses elsewhere.
 */
function stale(holder: Holder | undefined, now: number): boolean {
  if (!holder) return false;
  if (now - holder.at > STALE_AFTER_MS) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch {
    return true;
  }
}

/**
 * The lock is a directory, not a file.
 *
 * A file created with `wx` is atomic to create and *not* atomic to fill, so a
 * waiter could open it in the window before its contents landed, read nothing,
 * conclude the holder was dead, and delete a live lock. Both writers then
 * proceeded and one update disappeared — the exact failure this exists to
 * prevent, reintroduced by the mechanism preventing it.
 *
 * `mkdir` without `recursive` is atomic and carries no contents to race on. The
 * holder is written inside afterwards, and its absence means "just taken",
 * never "abandoned".
 */
export async function withLock<T>(target: string, work: () => Promise<T>): Promise<T> {
  const path = lockPath(resolve(target));
  const deadline = Date.now() + WAIT_MS;
  await mkdir(dirname(path), { recursive: true });

  for (;;) {
    try {
      await mkdir(path);
      await writeFile(holderPath(target), JSON.stringify({ pid: process.pid, at: Date.now() }));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      if (await abandoned(target)) {
        await rm(path, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw new GateRefusal(
          `${target} is being written by another session.`,
          "Wait for it to finish, then try again.",
          "Two sessions writing one record lose each other's work without either " +
            "being told.",
        );
      }
      await new Promise((wake) => setTimeout(wake, RETRY_MS));
    }
  }

  try {
    return await work();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

/**
 * A holder that has not written itself yet is holding, not gone.
 *
 * Falling back on the directory's own age covers the case where a process died
 * between creating it and describing itself.
 */
async function abandoned(target: string): Promise<boolean> {
  const holder = await readHolder(holderPath(target));
  if (holder) return stale(holder, Date.now());

  const created = await stat(lockPath(target)).catch(() => undefined);
  if (!created) return true;
  return Date.now() - created.mtimeMs > STALE_AFTER_MS;
}


/**
 * Write a file so no reader ever sees it half-written.
 *
 * A bare `writeFile` truncates and then fills, so a concurrent reader could
 * observe an empty or partial file — two of forty-eight units were lost that
 * way, and a crash mid-write would have truncated the record permanently.
 * Rename is atomic within a filesystem, so a reader sees either the old file or
 * the new one.
 */
export async function writeAtomic(path: string, body: string): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, body, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(temporary, path);
}
