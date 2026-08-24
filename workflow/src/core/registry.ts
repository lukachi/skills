import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * The repository registry.
 *
 * Registering is its own operation, not part of installation and not part of
 * reconstruction. A project keeps several checkouts and worktrees so different
 * work can run at once, and they appear over time — an installation that
 * captured them once would be wrong by the end of the week.
 *
 * Nothing is written into the leaf. There is no leaf installation to write to;
 * the knowledge repository simply records where each checkout is.
 */
export const REGISTRY_PATH = ".workflow/repositories.json";

export interface RegisteredRepository {
  /** Portable identity, e.g. `owner/name`. */
  repository: string;
  /** The name this checkout is referred to by. */
  checkout: string;
  /** Machine-local path. Ignored by Git, like every other local binding. */
  path: string;
  /** Worktree identity, so several checkouts of one repository stay distinct. */
  worktreeId: string;
}

/**
 * What to call this checkout on screen.
 *
 * `worktreeId` is the lookup key and defaults to `main`, so printing it
 * labelled a checkout sitting on `brand/icons` as `main` — and the label is how
 * the agent names the checkout it is about to write in. The checkout name is
 * the label; it falls back to the key when the two are the same.
 */
export function label(entry: { checkout: string; worktreeId: string }): string {
  return entry.checkout || entry.worktreeId;
}

export async function readRegistry(root: string): Promise<RegisteredRepository[]> {
  try {
    const raw = await readFile(resolve(root, REGISTRY_PATH), "utf8");
    const parsed = JSON.parse(raw) as { repositories?: RegisteredRepository[] };
    return parsed.repositories ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeRegistry(
  root: string,
  repositories: RegisteredRepository[],
): Promise<void> {
  const path = resolve(root, REGISTRY_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ repositories }, null, 2)}\n`, "utf8");
}

export async function addRepository(
  root: string,
  entry: RegisteredRepository,
): Promise<RegisteredRepository[]> {
  for (const [field, value] of Object.entries(entry)) {
    if (!String(value).trim()) {
      throw new GateRefusal(
        `A registered repository needs its ${field}.`,
        'wfctl repo add <owner/name> --path <dir> [--checkout <name>] [--worktree <id>]',
      );
    }
  }

  const existing = await readRegistry(root);
  const duplicate = existing.find(
    (candidate) =>
      candidate.repository === entry.repository && candidate.worktreeId === entry.worktreeId,
  );
  if (duplicate) {
    throw new GateRefusal(
      `${entry.repository} worktree ${entry.worktreeId} is already registered at ${duplicate.path}.`,
      `wfctl repo remove ${entry.repository} --worktree ${entry.worktreeId}`,
      "Two checkouts of one repository are distinct only by worktree identity. " +
        "Registering the same one twice makes the second silently shadow the first.",
    );
  }

  const next = [...existing, entry].sort(
    (left, right) =>
      left.repository.localeCompare(right.repository) ||
      left.worktreeId.localeCompare(right.worktreeId),
  );
  await writeRegistry(root, next);
  return next;
}

export async function removeRepository(
  root: string,
  repository: string,
  worktreeId?: string,
): Promise<RegisteredRepository[]> {
  const existing = await readRegistry(root);
  const next = existing.filter(
    (entry) =>
      entry.repository !== repository ||
      (worktreeId !== undefined && entry.worktreeId !== worktreeId),
  );
  if (next.length === existing.length) {
    throw new GateRefusal(`${repository} is not registered.`, "wfctl repo list");
  }
  await writeRegistry(root, next);
  return next;
}

export function renderRegistry(repositories: RegisteredRepository[]): string {
  if (repositories.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]",
    ].join("\n");
  }
  return repositories
    .map((entry) => `${entry.repository}  ${label(entry).padEnd(14)}  ${entry.path}`)
    .join("\n");
}
