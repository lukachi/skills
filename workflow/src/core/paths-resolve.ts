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
const MAX_LINKS = 64;

/**
 * Resolve the deepest ancestor that exists and re-attach the rest.
 *
 * This is the whole answer for a path that is about to be created, and it is
 * also the only honest answer when link-following gives out. The exhaustion
 * branch used to return `resolve(path)` — lexical, never canonicalised — so a
 * symlink cycle anywhere in a path produced an answer in the *unresolved*
 * namespace. On any host where the repository sits under a symlinked prefix
 * (`/tmp` -> `/private/tmp`, `/var` -> `/private/var`) that answer compares
 * unequal to every canonical base, `relative()` returns a `..` path, and the
 * write guard reads it as outside the repository and allows it. A cycle made
 * every fence fail open.
 */
function settle(from: string, trailing: readonly string[]): string {
  let node = from;
  const rest = [...trailing];
  for (;;) {
    try {
      return [realpathSync.native(node), ...rest].join(sep);
    } catch {
      const parent = dirname(node);
      if (parent === node) return [node, ...rest].join(sep);
      rest.unshift(node.slice(parent.length + 1));
      node = parent;
    }
  }
}

export function canonical(path: string): string {
  let current = resolve(path);
  const trailing: string[] = [];

  for (let depth = 0; depth < MAX_LINKS; depth += 1) {
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
    return settle(current, trailing);
  }

  // Out of link budget: a cycle, or a chain deeper than any real tree. Answer
  // in the canonical namespace anyway — `realpathSync` fails on the cycle and
  // `settle` climbs to the nearest ancestor that resolves.
  return settle(current, trailing);
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
  let current = canonical(from);
  for (let depth = 0; depth < 32; depth += 1) {
    if (exists(resolve(current, ".workflow/state.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return canonical(from);
}

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
