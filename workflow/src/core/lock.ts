import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

/**
 * A lock that describes its holder from the instant it exists.
 *
 * This was a directory created by `mkdir` and then filled in by a second write,
 * which left a window in which the lock existed and said nothing. Every attempt
 * to handle that window failed differently. Judging an undescribed lock by the
 * caller's own stopwatch made an orphan unreclaimable forever. Judging it by the
 * directory's age let several callers reclaim at once and delete each other's
 * fresh locks. Renaming it aside made the take atomic and still let a caller act
 * on a judgment formed before the lock it took existed, because a lock with no
 * holder file is indistinguishable from any other lock with no holder file.
 *
 * `link` removes the window. The holder is written to a temporary file first
 * and then linked into place: the link either succeeds — and the lock is
 * complete and identified in the same instant — or it fails because somebody
 * else holds it. There is no state in between, so a lock that appears between
 * one caller's judgment and its action carries a different token and is
 * recognised as a different lock.
 */
async function readHolderAt(path: string): Promise<Holder | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Holder;
    return typeof parsed?.token === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function readHolder(target: string): Promise<Holder | undefined> {
  return readHolderAt(lockPath(target));
}

/** Whether a holder is one whose process is provably gone. */
function isAbandonedHolder(holder: Holder): boolean {
  // A pid the OS has since handed to an unrelated process would otherwise look
  // alive forever; the age bound is the backstop for that and nothing else.
  if (Date.now() - holder.at > STALE_AFTER_MS) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch {
    return true;
  }
}

/** Try to take the lock. Resolves true when this call now holds it. */
async function take(target: string, token: string): Promise<boolean> {
  const path = lockPath(target);
  const temporary = `${path}.${process.pid}.${token}.tmp`;
  await writeFile(temporary, JSON.stringify({ pid: process.pid, token, at: Date.now() }), "utf8");
  try {
    await link(temporary, path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

/**
 * Remove an abandoned lock, and only the one that was judged.
 *
 * The holder is re-read immediately before the removal, so a lock taken since
 * the judgment — which necessarily carries a different token — is left alone.
 */
async function reclaim(target: string, judged: Holder | undefined): Promise<void> {
  const path = lockPath(target);
  const now = await readHolder(target);

  /**
   * An unreadable lock is corrupt, and corrupt is abandoned.
   *
   * `link` puts a complete file in place in one step, so there is no moment at
   * which a live lock is half-written — which means an unreadable one is
   * damage, not a race. Leaving it alone was the previous bug in its newest
   * shape: nothing judged it abandoned, so nothing ever removed it and the
   * record could not be written again.
   */
  if (judged && (!now || now.token !== judged.token)) return;
  if (!judged && now) return;

  /**
   * Move it aside, then look at what was moved.
   *
   * Deleting by path is not a compare-and-delete: several callers judge one
   * dead holder at the same instant, the first removes it, a second takes the
   * lock for real, and a third's removal — decided before that lock existed —
   * deletes it. Two callers are then inside the critical section and one
   * increment is lost, silently, which is the whole failure this lock exists to
   * prevent.
   *
   * `rename` has one winner, and the winner holds the file rather than the
   * path. If what it took turns out to be alive, it goes back.
   */
  const aside = `${path}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
  try {
    await rename(path, aside);
  } catch {
    return;
  }

  const taken = await readHolderAt(aside);
  if (taken && !isAbandonedHolder(taken)) {
    try {
      await rename(aside, path);
      return;
    } catch {
      // Refilled while we held it; there is nowhere to put it back.
    }
  }
  await rm(aside, { force: true }).catch(() => undefined);
}

export async function withLock<T>(target: string, work: () => Promise<T>): Promise<T> {
  const path = lockPath(target);
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + WAIT_MS;
  await mkdir(dirname(path), { recursive: true });

  for (;;) {
    if (await take(target, token)) break;

    /**
     * A reclaim attempt falls through to the wait rather than looping straight
     * back, so a removal that cannot succeed spins against the deadline instead
     * of spinning against the CPU.
     */
    const holder = await readHolder(target);
    if (!holder || isAbandonedHolder(holder)) {
      await reclaim(target, holder);
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

  try {
    return await work();
  } finally {
    // Release only while the lock is still ours.
    const holder = await readHolder(target);
    if (holder?.token === token) {
      await rm(path, { force: true }).catch(() => undefined);
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
