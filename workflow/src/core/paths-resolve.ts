import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

/**
 * Where a write will actually land.
 *
 * Every fence in this tool compares a target against a directory, and every
 * comparison was wrong in the same way: `realpathSync` on the whole path throws
 * when the last component does not exist, and the fallback then returned the
 * path as given. That is the branch **every file an agent is about to create**
 * takes — so a symlink whose target did not exist yet was reported as living
 * where the link sits rather than where it points, and a dangling link inside
 * the repository wrote into `knowledge/`, the promotion queue and the
 * trajectory store with no output at all.
 *
 * The last component is therefore resolved with `lstat`/`readlink`, which
 * answer for a link whether or not its target exists.
 */
export function canonical(path: string): string {
  let current = resolve(path);
  const trailing: string[] = [];

  for (let depth = 0; depth < 64; depth += 1) {
    // A symlink is followed even when it dangles; that is the whole point.
    try {
      if (lstatSync(current).isSymbolicLink()) {
        const target = readlinkSync(current);
        current = isAbsolute(target) ? target : resolve(dirname(current), target);
        continue;
      }
    } catch {
      // Not there at all: fall through and resolve what is.
    }

    try {
      return [realpathSync.native(current), ...trailing].join(sep);
    } catch {
      const parent = dirname(current);
      if (parent === current) return [current, ...trailing].join(sep);
      trailing.unshift(current.slice(parent.length + 1));
      current = parent;
    }
  }
  return resolve(path);
}

/** Whether `target` is `base` or sits underneath it, both fully resolved. */
export function contains(base: string, target: string): boolean {
  const root = canonical(base);
  const path = canonical(target);
  return path === root || path.startsWith(`${root}${sep}`);
}


/**
 * Find the knowledge repository this invocation belongs to.
 *
 * Every fence compared against `process.cwd()`, and there was no root
 * discovery — so running `wfctl` one directory down removed all of them at
 * once, and `init` there created a second knowledge repository nested inside
 * the curated-knowledge directory of the first. A repository is identified by
 * the state file the installer writes.
 */
export function findRepositoryRoot(from: string): string {
  const { existsSync } = requireFs();
  let current = canonical(from);
  for (let depth = 0; depth < 32; depth += 1) {
    if (existsSync(resolve(current, ".workflow/state.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return canonical(from);
}

function requireFs(): { existsSync: (path: string) => boolean } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return { existsSync: (path: string) => { try { lstatSync(path); return true; } catch { return false; } } };
}
