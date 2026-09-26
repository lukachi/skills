import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { canonical, contains } from "./paths-resolve.js";
import { withLock, writeAtomic } from "./lock.js";

export const MANAGED_BEGIN = "<!-- wfctl:begin -->";
export const MANAGED_END = "<!-- wfctl:end -->";

/** Installation places an optional skill and a short instruction block. */
export const INSTALL_SCHEMA_VERSION = 2;

/** Recognize old project runtime files during an explicit update. */
export const RUNTIME_DIR = ".workflow/runtime";

/**
 * Both agent conventions get the same optional skill.
 */
export const SKILL_DIRS = [".claude/skills/wfctl", ".agents/skills/wfctl"];

/** Directories used by the current knowledge and change-record commands. */
export const KNOWLEDGE_DIRECTORIES = [
  "knowledge",
  "changes/active",
  "changes/archive",
  "reconstruction/raw",
  "reconstruction/active",
  "reconstruction/archive",
  "trajectories",
];

export interface InstallOperation {
  kind: "create-directory" | "write" | "skip-unchanged";
  path: string;
}

export interface InstallPlan {
  target: string;
  operations: InstallOperation[];
  /** Files owned by wfctl that the current package no longer ships. */
  obsolete: string[];
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

/** Plan the current package files and retired owned files. */
export async function planInstall(options: {
  target: string;
  distribution: string;
  version: string;
}): Promise<InstallPlan> {
  const state = await readInstallState(options.target);
  const operations: InstallOperation[] = [];

  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve(options.target, directory);
    const present = await stat(path).then(
      (entry) => entry.isDirectory(),
      () => false,
    );
    if (!present) operations.push({ kind: "create-directory", path: directory });
  }

  const installable: { path: string; content: string }[] = [];
  for (const file of await collect(resolve(options.distribution, "templates/skill/wfctl"))) {
    if (!["SKILL.md", "references/commands.md", "references/tidying.md"].includes(file.path)) continue;
    for (const directory of SKILL_DIRS) {
      installable.push({ path: join(directory, file.path), content: file.content });
    }
  }
  /** Recovery notes and tool scratch state stay local. */
  installable.push({
    path: ".workflow/.gitignore",
    content: await readFile(resolve(options.distribution, "templates/workflow/gitignore"), "utf8"),
  });

  for (const file of installable) {
    const rel = file.path;
    const current = await readIfPresent(resolve(options.target, rel));
    const next = hash(file.content);

    if (current === undefined) {
      operations.push({ kind: "write", path: rel });
      continue;
    }
    if (hash(current) === next) {
      operations.push({ kind: "skip-unchanged", path: rel });
      continue;
    }
    operations.push({ kind: "write", path: rel });
  }

  /**
   * Anything the recorded state owns that this version does not ship. Checked
   * against disk, because a maintainer who already removed one does not need
   * to be told about it again.
   */
  const shipped = new Set(installable.map((file) => file.path));
  const obsolete = new Set<string>();
  for (const rel of Object.keys(state?.files ?? {})) {
    if (shipped.has(rel)) continue;
    const path = resolve(options.target, rel);
    if (!contains(options.target, path) || path === resolve(options.target)) {
      throw new GateRefusal(`Invalid installed file path: ${rel}.`, "Repair .workflow/state.json before updating.");
    }
    if ((await readIfPresent(path)) === undefined) continue;
    obsolete.add(rel);
  }
  for (const name of ["guard-stop.mjs", "guard-write.mjs", "guard-background-bash.mjs", "hook-input.mjs", "idle-guard.sh"]) {
    const rel = join(RUNTIME_DIR, name);
    if ((await readIfPresent(resolve(options.target, rel))) !== undefined) obsolete.add(rel);
  }
  if ((await readIfPresent(resolve(options.target, ".workflow/guards.json"))) !== undefined) {
    obsolete.add(".workflow/guards.json");
  }

  return { target: options.target, operations, obsolete: [...obsolete].sort() };
}

export interface ApplyResult {
  written: string[];
  created: string[];
  skipped: string[];
  removed: string[];
  /** Hook entries a previous version wrote, which this install replaced. */
  replacedHooks: string[];
}

export async function applyInstall(
  plan: InstallPlan,
  options: { distribution: string; version: string },
): Promise<ApplyResult> {
  const result: ApplyResult = {
    written: [], created: [], skipped: [],
    removed: [], replacedHooks: [],
  };
  const state: InstallState = (await readInstallState(plan.target)) ?? {
    schemaVersion: INSTALL_SCHEMA_VERSION,
    installedVersion: options.version,
    files: {},
  };
  state.installedVersion = options.version;
  state.schemaVersion = INSTALL_SCHEMA_VERSION;

  for (const operation of plan.operations) {
    const absolute = resolve(plan.target, operation.path);

    if (operation.kind === "create-directory") {
      await mkdir(absolute, { recursive: true });
      result.created.push(operation.path);
      continue;
    }
    if (operation.kind === "skip-unchanged") {
      result.skipped.push(operation.path);
      state.files[operation.path] = { sha256: hash(await readFile(absolute, "utf8")) };
      continue;
    }

    const skillDir = SKILL_DIRS.find((directory) => operation.path.startsWith(`${directory}/`));
    const source = operation.path === ".workflow/.gitignore"
      ? resolve(options.distribution, "templates/workflow/gitignore")
      : resolve(
            options.distribution,
            "templates/skill/wfctl",
            relative(skillDir ?? "", operation.path),
          );
    const content = await readFile(source, "utf8");
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }

  for (const rel of plan.obsolete) {
    const path = resolve(plan.target, rel);
    if (!contains(plan.target, path) || path === resolve(plan.target)) {
      throw new GateRefusal(`Refusing to remove ${rel}.`, "Use a path inside the installation target.");
    }
    await rm(path, { force: true });
    delete state.files[rel];
    result.removed.push(rel);
  }
  const currentFiles = new Set(plan.operations
    .filter((operation) => operation.kind !== "create-directory")
    .map((operation) => operation.path));
  state.files = Object.fromEntries(Object.entries(state.files)
    .filter(([path]) => currentFiles.has(path)));
  await rmdir(resolve(plan.target, RUNTIME_DIR)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOTEMPTY" && error.code !== "ENOENT") throw error;
  });

  /**
   * Record what was written before anything else can refuse.
   *
   * Files were written first and the state recorded last, so a refusal in the
   * hook merge left a full tree with no state.json — and a missing recorded
   * hash reads as "safe to overwrite", which silently destroyed maintainer
   * edits on the next run.
   */
  await mkdir(resolve(plan.target, ".workflow"), { recursive: true });
  await writeFile(
    resolve(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );

  result.replacedHooks = await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);
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


/**
 * Remove only hooks recognized as belonging to an earlier wfctl installation.
 *
 * The file belongs to the project, not to this tool, so entries it did not
 * write are preserved and its own are removed by command. A settings file
 * rewritten wholesale would silently drop whatever the maintainer configured,
 * and they would find out the next time something they rely on did not run.
 */
export async function installHooks(target: string): Promise<string[]> {
  if ((await readIfPresent(resolve(target, ".claude/settings.json"))) === undefined) return [];
  return withLock(resolve(target, ".claude/settings.json"), () => installHooksLocked(target));
}

/**
 * Whether a hook entry was written by any version of this tool.
 *
 * Ownership used to be the exact command string of the version doing the
 * installing, so no upgrade ever recognised its predecessor's hook: 0.8.0's
 * `wfctl brief --hook` survived a 0.9.0 install, which then appended
 * `wfctl brief` beside it and briefed twice every session. An identity that
 * changes whenever the command text changes is not an identity.
 *
 * Both families are narrow on purpose. A hook that invokes `wfctl` itself, or
 * one that runs a guard out of the runtime directory this tool installs, is
 * ours whatever version wrote it. Anything else in the file belongs to the
 * project and is never touched.
 */
function looksInstalled(command: string): boolean {
  return /(^|[;&|\s])wfctl\s+(brief(?:\s+--hook)?|hook\s+write)(?=\s|$)/.test(command)
    || command.includes(`$CLAUDE_PROJECT_DIR/${RUNTIME_DIR}/`);
}

async function installHooksLocked(target: string): Promise<string[]> {
  const path = resolve(target, ".claude/settings.json");
  const existing = await readIfPresent(path);

  let settings: Record<string, unknown> = {};
  if (existing) {
    try {
      settings = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      throw new GateRefusal(
        `${path} is not valid JSON, so its hooks cannot be merged.`,
        "Repair the file, then run init again.",
      );
    }
  }

  if (Array.isArray(settings) || typeof settings !== "object" || settings === null) {
    throw new GateRefusal(
      `${path} is not a JSON object, so its hooks cannot be merged.`,
      "Repair the file, then run init again.",
      "Merging into an array would have written the hooks onto a property that " +
        "JSON.stringify discards, leaving the install reporting success with no " +
        "hooks at all.",
    );
  }

  const existingHooks = settings.hooks;
  if (existingHooks !== undefined && (typeof existingHooks !== "object" || existingHooks === null || Array.isArray(existingHooks))) {
    throw new GateRefusal(
      `${path} has a "hooks" value that is not an object.`,
      "Repair the file, then run init again.",
    );
  }

  const replaced: string[] = [];
  const hooks = { ...((existingHooks ?? {}) as Record<string, unknown>) };
  for (const [event, value] of Object.entries(hooks)) {
    if (!Array.isArray(value)) continue;
    const remaining: unknown[] = [];
    for (const entry of value) {
      const record = entry as { hooks?: unknown } | null;
      if (!record || !Array.isArray(record.hooks)) {
        remaining.push(entry);
        continue;
      }
      const kept = record.hooks.filter((hook: unknown) => {
        const command = (hook as { command?: unknown } | null)?.command;
        if (typeof command !== "string" || !looksInstalled(command)) return true;
        replaced.push(`${event}: ${command}`);
        return false;
      });
      if (kept.length > 0) remaining.push({ ...record, hooks: kept });
    }
    if (remaining.length > 0) hooks[event] = remaining;
    else delete hooks[event];
  }
  if (replaced.length === 0) return replaced;
  if (Object.keys(hooks).length > 0) settings.hooks = hooks;
  else delete settings.hooks;
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
  return replaced;
}

/**
 * Write the managed block into both agent conventions.
 *
 * It is the one instruction that cannot arrive from a command, because it is
 * what tells the agent that commands are where instructions come from. Content
 * outside the markers is the maintainer's and is preserved.
 */
export async function installManagedBlock(target: string, distribution: string): Promise<void> {
  const body = (await readFile(resolve(distribution, "templates/agents/managed.md"), "utf8")).trim();
  const block = `${MANAGED_BEGIN}\n${body}\n${MANAGED_END}\n`;

  /**
   * Two names, one file when the maintainer has linked them.
   *
   * `CLAUDE.md` symlinked to `AGENTS.md` is a common way to keep one set of
   * instructions, and writing both names turned the link into a second regular
   * file — so the two drifted from the next edit onward, silently, and the
   * maintainer's arrangement was undone by an upgrade. Writing through the link
   * keeps it: the second name resolves to the first and is already done.
   */
  const written = new Set<string>();
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve(target, name);
    const real = canonical(path);
    if (written.has(real)) continue;
    written.add(real);

    const existing = await readIfPresent(path);

    if (existing === undefined) {
      await writeFile(path, block, "utf8");
      continue;
    }
    const begin = existing.indexOf(MANAGED_BEGIN);
    const end = existing.indexOf(MANAGED_END);

    /**
     * An unbalanced or duplicated marker set stops the install.
     *
     * Appending a second block past a begin with no end produced a file with
     * two begins and one end; the next run then replaced everything between
     * the first begin and that end, taking the maintainer's text with it.
     */
    const begins = existing.split(MANAGED_BEGIN).length - 1;
    const ends = existing.split(MANAGED_END).length - 1;
    if (begins !== ends || begins > 1 || (begins === 1 && end < begin)) {
      throw new GateRefusal(
        `${name} has an unbalanced wfctl marker block.`,
        `Repair the markers in ${name} so one ${MANAGED_BEGIN} is followed by one ${MANAGED_END}, then run init again.`,
        `Found ${begins} begin marker(s) and ${ends} end marker(s). Writing past ` +
          "that would move the boundary and take your own text with it.",
      );
    }

    if (begin >= 0 && end > begin) {
      const next =
        existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile(path, next, "utf8");
      continue;
    }
    await writeFile(path, `${existing.trimEnd()}\n\n${block}`, "utf8");
  }
}
