import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * Serialize writes to one record.
 *
 * Every mutation here is read-modify-write on a JSON file, and without this,
 * concurrent callers each read the same state and the last one wins — units
 * lost with their ids reused, coverage understated, captures overwritten.
 * Nothing failed loudly; it was lost silently, which is the only kind that
 * matters.
 *
 * The previous version did not actually exclude. Two mistakes:
 *
 * - a lock whose directory vanished between the `EEXIST` and the check was read
 *   as abandoned, and the reclaim then deleted a *third* process's fresh lock;
 * - the release deleted whichever lock was present rather than its own, so a
 *   holder that had already been stolen from deleted the thief's.
 *
 * Both are fixed by identity: the holder writes a token, the release removes
 * the lock only while that token is still its own, and reclaiming requires a
 * holder that is present and provably gone.
 *
 * This is a local advisory lock and nothing more. Teams sharing a knowledge
 * repository through Git still coordinate through Git; pretending a lock file
 * is a distributed lock would be a worse lie than having none.
 */
const STALE_AFTER_MS = 30_000;
const RETRY_MS = 10;
const WAIT_MS = 10_000;

interface Holder {
  pid: number;
  token: string;
  at: number;
}

function lockPath(target: string): string {
  return `${resolve(target)}.lock`;
}

function holderPath(target: string): string {
  return `${lockPath(target)}/holder.json`;
}

async function readHolder(target: string): Promise<Holder | undefined> {
  try {
    const parsed = JSON.parse(await readFile(holderPath(target), "utf8")) as Holder;
    return typeof parsed?.token === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A holder is abandoned only when it is *there* and its process is gone.
 *
 * An absent holder file means the lock was taken microseconds ago and has not
 * described itself yet — treating that as abandoned is what let two callers in.
 * The one case that must not wedge the repository forever is a process that
 * died between creating the directory and writing the file, which the age bound
 * covers.
 */
async function abandoned(target: string, since: number): Promise<boolean> {
  const holder = await readHolder(target);
  if (!holder) return Date.now() - since > STALE_AFTER_MS;
  if (Date.now() - holder.at > STALE_AFTER_MS) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch {
    return true;
  }
}

export async function withLock<T>(target: string, work: () => Promise<T>): Promise<T> {
  const path = lockPath(target);
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + WAIT_MS;
  const waitingSince = Date.now();
  await mkdir(dirname(path), { recursive: true });

  for (;;) {
    try {
      // Atomic: exactly one caller creates the directory.
      await mkdir(path);
      await writeFile(holderPath(target), JSON.stringify({ pid: process.pid, token, at: Date.now() }));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      if (await abandoned(target, waitingSince)) {
        /**
         * Reclaim only the holder we judged. Deleting the directory outright
         * would take whatever a live caller had created in the meantime.
         */
        const stale = await readHolder(target);
        await rm(holderPath(target), { force: true }).catch(() => undefined);
        const now = await readHolder(target);
        if (!now || now.token === stale?.token) {
          await rm(path, { recursive: true, force: true }).catch(() => undefined);
        }
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
      await new Promise((wake) => setTimeout(wake, RETRY_MS + Math.floor(Math.random() * RETRY_MS)));
    }
  }

  try {
    return await work();
  } finally {
    // Release only while the lock is still ours.
    const holder = await readHolder(target);
    if (!holder || holder.token === token) {
      await rm(path, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * Write a file so no reader ever sees it half-written.
 *
 * A bare `writeFile` truncates and then fills, so a concurrent reader can
 * observe an empty or partial file and a crash mid-write truncates the record
 * permanently. Rename is atomic within a filesystem.
 */
export async function writeAtomic(path: string, body: string): Promise<void> {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, body, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(temporary, path);
}
