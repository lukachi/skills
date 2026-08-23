import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * Installation, after the leaf profile was removed.
 *
 * There is one profile. The agent is bootstrapped in the knowledge repository
 * and edits leaf code from there as an orchestrator, so a leaf never needed its
 * own installation — and measurement said it never used one: the rules, skills
 * and hooks placed in leaves went unread, because the work was not happening
 * there.
 *
 * What is installed is no longer a set of skills. It is the guidance bundle the
 * CLI reads from, the runtime hooks, and one managed block that says how to use
 * the CLI. Nothing here is loaded by the agent deciding to load it.
 */
export const INSTALL_SCHEMA_VERSION = 1;

export const GUIDANCE_DIR = ".workflow/guidance";
export const RUNTIME_DIR = ".workflow/runtime";
export const FLOWS_DIR = ".workflow/flows";

/**
 * The knowledge repository's shape.
 *
 * `intake/` is gone: it ran once, and everything after it went to the capture
 * inbox, so it is absorbed into reconstruction rather than kept as a third case
 * nobody enters. Raw material moves under `reconstruction/` with it — it is that
 * module's input, and having it at the root implied a lane of its own.
 */
export const KNOWLEDGE_DIRECTORIES = [
  "knowledge",
  "changes/active",
  "changes/promotion",
  "changes/archive",
  "changes/archive/captures",
  "changes/inbox",
  "reconstruction/raw",
  "reconstruction/active",
  "reconstruction/archive",
  "trajectories",
  GUIDANCE_DIR,
  RUNTIME_DIR,
  FLOWS_DIR,
];

export interface InstallOperation {
  kind: "create-directory" | "write" | "skip-unchanged" | "conflict";
  path: string;
  /** Why a conflict stops the install, in the maintainer's terms. */
  reason?: string;
}

export interface InstallPlan {
  target: string;
  operations: InstallOperation[];
  /** Files whose recorded hash no longer matches what is on disk. */
  edited: string[];
}

export interface InstallState {
  schemaVersion: number;
  installedVersion: string;
  files: Record<string, { sha256: string }>;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function collect(root: string, prefix = ""): Promise<{ path: string; content: string }[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files: { path: string; content: string }[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collect(root, rel)));
      continue;
    }
    files.push({ path: rel, content: await readFile(join(root, rel), "utf8") });
  }
  return files;
}

export async function readInstallState(target: string): Promise<InstallState | undefined> {
  const raw = await readIfPresent(resolve(target, ".workflow/state.json"));
  return raw ? (JSON.parse(raw) as InstallState) : undefined;
}

/**
 * Plan before writing.
 *
 * An owned file is replaced only when what is on disk still hashes to what was
 * installed. A file the maintainer edited is reported and left alone: silently
 * overwriting one is how an upgrade destroys work nobody remembers doing, and
 * the failure is invisible until something behaves differently for no reason.
 */
export async function planInstall(options: {
  target: string;
  distribution: string;
  version: string;
}): Promise<InstallPlan> {
  const state = await readInstallState(options.target);
  const operations: InstallOperation[] = [];
  const edited: string[] = [];

  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve(options.target, directory);
    const present = await stat(path).then(
      (entry) => entry.isDirectory(),
      () => false,
    );
    if (!present) operations.push({ kind: "create-directory", path: directory });
  }

  const guidance = await collect(resolve(options.distribution, "templates/guidance"));
  for (const file of guidance) {
    const rel = join(GUIDANCE_DIR, file.path);
    const current = await readIfPresent(resolve(options.target, rel));
    const recorded = state?.files[rel]?.sha256;
    const next = hash(file.content);

    if (current === undefined) {
      operations.push({ kind: "write", path: rel });
      continue;
    }
    if (hash(current) === next) {
      operations.push({ kind: "skip-unchanged", path: rel });
      continue;
    }
    if (recorded && hash(current) !== recorded) {
      edited.push(rel);
      operations.push({
        kind: "conflict",
        path: rel,
        reason: "edited since it was installed; it will not be replaced silently",
      });
      continue;
    }
    operations.push({ kind: "write", path: rel });
  }

  return { target: options.target, operations, edited };
}

export interface ApplyResult {
  written: string[];
  created: string[];
  skipped: string[];
  conflicts: string[];
}

export async function applyInstall(
  plan: InstallPlan,
  options: { distribution: string; version: string },
): Promise<ApplyResult> {
  const result: ApplyResult = { written: [], created: [], skipped: [], conflicts: [] };
  const state: InstallState = (await readInstallState(plan.target)) ?? {
    schemaVersion: INSTALL_SCHEMA_VERSION,
    installedVersion: options.version,
    files: {},
  };
  state.installedVersion = options.version;

  for (const operation of plan.operations) {
    const absolute = resolve(plan.target, operation.path);

    if (operation.kind === "create-directory") {
      await mkdir(absolute, { recursive: true });
      result.created.push(operation.path);
      continue;
    }
    if (operation.kind === "skip-unchanged") {
      result.skipped.push(operation.path);
      continue;
    }
    if (operation.kind === "conflict") {
      result.conflicts.push(operation.path);
      continue;
    }

    const source = resolve(
      options.distribution,
      "templates/guidance",
      relative(GUIDANCE_DIR, operation.path),
    );
    const content = await readFile(source, "utf8");
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }

  await mkdir(resolve(plan.target, ".workflow"), { recursive: true });
  await writeFile(
    resolve(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  return result;
}

/**
 * A leaf can no longer be initialized, and the refusal says why rather than
 * reporting an unknown option. Somebody will try it — the two-profile
 * installation was the documented shape for a long time.
 */
export function assertProfileSupported(profile: string): void {
  if (profile === "knowledge") return;
  if (profile === "leaf") {
    throw new GateRefusal(
      "There is no leaf installation any more.",
      "wfctl init knowledge   (run in the knowledge repository)",
      "The agent is bootstrapped in the knowledge repository and edits leaf code " +
        "from there. Register the repository instead of installing into it.",
    );
  }
  throw new GateRefusal(`Unknown profile ${profile}.`, "wfctl init knowledge");
}
