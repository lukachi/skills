import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { withLock, writeAtomic } from "./lock.js";

export const MANAGED_BEGIN = "<!-- wfctl:begin -->";
export const MANAGED_END = "<!-- wfctl:end -->";

/**
 * The hooks are the half of this design the CLI cannot supply.
 *
 * A command can only instruct at its own call site. An agent that never runs
 * one — that opens a session and starts editing — is reached by nothing else,
 * which is why the session start, the write and the turn boundary are hooks and
 * not commands.
 */
export const HOOK_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: "*",
        hooks: [{ type: "command", command: "wfctl brief" }],
      },
    ],
    PreToolUse: [
      {
        matcher: "Edit|Write|MultiEdit",
        hooks: [
          {
            type: "command",
            command:
              '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-write.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-write.mjs" || true',
          },
        ],
      },
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command:
              '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" || true',
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "*",
        hooks: [
          {
            type: "command",
            command:
              '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" || true',
          },
        ],
      },
    ],
  },
} as const;

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

/**
 * Guidance is NOT installed.
 *
 * It ships inside the CLI and is read from there, so upgrading wfctl upgrades
 * the guidance: nothing to refresh, nothing to drift, and no edited-copy
 * conflict to resolve. Copying it into every project bought a per-project
 * override nobody asked for and cost an upgrade step to keep it current.
 *
 * The runtime guards are different — the host executes them by path from inside
 * the project — so those are installed.
 */
export const RUNTIME_DIR = ".workflow/runtime";

/**
 * The skill is installed; the guidance it points at is not.
 *
 * They answer different questions. The skill is the map — which flow this is,
 * when to start one, what the maintainer decides — and the agent needs it
 * before running anything, so it has to be discoverable in the project. The
 * guidance is what a state demands at the moment it is reached, and the tool
 * delivers that itself.
 *
 * Both agent conventions get a copy, because a project may run either.
 */
export const SKILL_DIRS = [".claude/skills/wfctl", ".agents/skills/wfctl"];
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
  /**
   * Files a previous version installed that this one no longer ships.
   *
   * They are reported, never deleted. Twenty-five obsolete skills and a rules
   * directory survived a fresh install of the version that removed them,
   * because nothing compared what was recorded against what is shipped — and
   * an install that quietly leaves a predecessor behind is indistinguishable
   * from one that never ran.
   */
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

  const installable: { path: string; content: string }[] = [];
  for (const file of await collect(resolve(options.distribution, "templates/runtime"))) {
    installable.push({ path: join(RUNTIME_DIR, file.path), content: file.content });
  }
  for (const file of await collect(resolve(options.distribution, "templates/skill/wfctl"))) {
    for (const directory of SKILL_DIRS) {
      installable.push({ path: join(directory, file.path), content: file.content });
    }
  }
  /**
   * The runtime guards keep per-session memory under `.workflow/current/`, and
   * `wfctl knowledge build` puts its rebuilt artifacts there. 0.8.0 shipped the
   * ignore file and this version dropped it, so every session dirtied the tree
   * with hook state — while the guard's own comment still said the directory
   * was ignored.
   */
  installable.push({
    path: ".workflow/.gitignore",
    content: await readFile(resolve(options.distribution, "templates/workflow/gitignore"), "utf8"),
  });

  for (const file of installable) {
    const rel = file.path;
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

  /**
   * Anything the recorded state owns that this version does not ship. Checked
   * against disk, because a maintainer who already removed one does not need
   * to be told about it again.
   */
  const shipped = new Set(installable.map((file) => file.path));
  const obsolete: string[] = [];
  for (const rel of Object.keys(state?.files ?? {})) {
    if (shipped.has(rel)) continue;
    if ((await readIfPresent(resolve(options.target, rel))) === undefined) continue;
    obsolete.push(rel);
  }
  obsolete.push(...(await strandedSkills(options.target)));

  return { target: options.target, operations, edited, obsolete: obsolete.sort() };
}

/**
 * Skills a previous version installed, which its state file never recorded.
 *
 * 0.8.0 installed twenty-four skills and tracked them in `skills-lock.json`
 * rather than in `state.json`, so comparing recorded files against shipped
 * files could not see them and every one survived a fresh install of the
 * version that deleted the concept. This version installs exactly one skill
 * into each convention, so any sibling is either a predecessor's or the
 * project's own — which is precisely why they are reported and never removed.
 */
async function strandedSkills(target: string): Promise<string[]> {
  const found: string[] = [];
  const parents = new Set(SKILL_DIRS.map((directory) => dirname(directory)));
  const ours = new Set(SKILL_DIRS.map((directory) => directory.split("/").pop()));

  for (const parent of parents) {
    let entries;
    try {
      entries = await readdir(resolve(target, parent), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ours.has(entry.name)) continue;
      found.push(join(parent, entry.name));
    }
  }

  // Unambiguously a predecessor's: nothing else writes it.
  if ((await readIfPresent(resolve(target, "skills-lock.json"))) !== undefined) {
    found.push("skills-lock.json");
  }
  return found.sort();
}

export interface ApplyResult {
  written: string[];
  created: string[];
  skipped: string[];
  conflicts: string[];
  /** Owned by a previous version and no longer shipped. Reported, not removed. */
  obsolete: string[];
  /** Hook entries a previous version wrote, which this install replaced. */
  replacedHooks: string[];
}

export async function applyInstall(
  plan: InstallPlan,
  options: { distribution: string; version: string },
): Promise<ApplyResult> {
  const result: ApplyResult = {
    written: [], created: [], skipped: [], conflicts: [],
    obsolete: plan.obsolete, replacedHooks: [],
  };
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

    const runtime = operation.path.startsWith(`${RUNTIME_DIR}/`);
    const skillDir = SKILL_DIRS.find((directory) => operation.path.startsWith(`${directory}/`));
    const source = operation.path === ".workflow/.gitignore"
      ? resolve(options.distribution, "templates/workflow/gitignore")
      : runtime
        ? resolve(options.distribution, "templates/runtime", relative(RUNTIME_DIR, operation.path))
        : resolve(
            options.distribution,
            "templates/skill/wfctl",
            relative(skillDir ?? "", operation.path),
          );
    const content = await readFile(source, "utf8");
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 0o755);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }

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
 * Merge the hooks into the agent's settings without touching anything else.
 *
 * The file belongs to the project, not to this tool, so entries it did not
 * write are preserved and its own are replaced by matcher. A settings file
 * rewritten wholesale would silently drop whatever the maintainer configured,
 * and they would find out the next time something they rely on did not run.
 */
export async function installHooks(target: string): Promise<string[]> {
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
  return /(^|[;&|\s])wfctl\s/.test(command)
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

  /**
   * Ownership is the command we install, never the matcher.
   *
   * Matching on the matcher string deleted any maintainer entry that happened
   * to use `*`, `Bash` or `Edit|Write|MultiEdit` — which is most of them. What
   * wfctl owns is the specific command it wrote, and nothing else in the file
   * is its business.
   */
  const ourCommands = new Set(
    Object.values(HOOK_SETTINGS.hooks)
      .flat()
      .flatMap((entry) => entry.hooks as readonly { command: string }[])
      .map((hook) => hook.command),
  );

  const commandsOf = (entry: unknown): string[] => {
    const hooks = (entry as { hooks?: { command?: string }[] } | null)?.hooks;
    if (!Array.isArray(hooks) || hooks.length === 0) return [];
    return hooks
      .map((hook) => hook?.command)
      .filter((command): command is string => typeof command === "string");
  };

  const isOurs = (entry: unknown): boolean => {
    const commands = commandsOf(entry);
    if (commands.length === 0) return false;
    return commands.every((command) => ourCommands.has(command) || looksInstalled(command));
  };

  /** Ours, but not what this version writes: a predecessor's, and reported. */
  const replaced: string[] = [];

  const off = new Set(await disabledGuards(target));
  const skip = new Set(
    [...off].map((guard) => (guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard}.mjs`)),
  );

  const hooks = { ...((existingHooks ?? {}) as Record<string, unknown[]>) };
  for (const [event, entries] of Object.entries(HOOK_SETTINGS.hooks)) {
    const current = hooks[event];
    const mine = (Array.isArray(current) ? current : []).filter((entry) => isOurs(entry));
    for (const entry of mine) {
      for (const command of commandsOf(entry)) {
        if (!ourCommands.has(command)) replaced.push(`${event}: ${command}`);
      }
    }
    const theirs = (Array.isArray(current) ? current : []).filter((entry) => !isOurs(entry));
    /**
     * An upgrade never re-arms a guard the maintainer turned off. Doing so
     * silently reversed their decision on every install.
     */
    const ours = (entries as readonly { hooks: readonly { command: string }[] }[]).filter(
      (entry) => !entry.hooks.some((hook) => [...skip].some((name) => hook.command.includes(name))),
    );
    hooks[event] = [...theirs, ...ours];
  }
  settings.hooks = hooks;

  await mkdir(dirname(path), { recursive: true });
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

  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve(target, name);
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

/* ------------------------------------------------------------------ hooks */

export const GUARD_NAMES = ["stop", "write", "bash"] as const;
export type GuardName = (typeof GUARD_NAMES)[number];

const GUARD_EVENTS: Record<GuardName, { event: string; matcher: string; describes: string }> = {
  stop: {
    event: "Stop",
    matcher: "*",
    describes: "re-enters a turn that ends while work still awaits the agent",
  },
  write: {
    event: "PreToolUse",
    matcher: "Edit|Write|MultiEdit",
    describes: "delivers the unit's scope on the first write, and refuses writes by hand",
  },
  bash: {
    event: "PreToolUse",
    matcher: "Bash",
    describes: "reports a background command that has gone silent",
  },
};

async function readSettings(target: string): Promise<Record<string, unknown>> {
  const raw = await readIfPresent(resolve(target, ".claude/settings.json"));
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GateRefusal(
      `${resolve(target, ".claude/settings.json")} is not valid JSON.`,
      "Repair the file, then try again.",
    );
  }
  if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
    throw new GateRefusal(
      `${resolve(target, ".claude/settings.json")} is not a JSON object.`,
      "Repair the file, then try again.",
    );
  }
  return parsed as Record<string, unknown>;
}

/**
 * Which guards are installed, and which are turned off.
 *
 * A guard that cannot be turned off gets turned off by hand — by editing the
 * settings file, which then looks like a maintainer entry and survives the next
 * upgrade forever. Making the switch part of the tool keeps the state
 * observable and reversible.
 */
export async function guardStatus(target: string): Promise<
  { guard: GuardName; installed: boolean; describes: string }[]
> {
  const settings = await readSettings(target);
  const hooks = (settings.hooks ?? {}) as Record<string, { matcher?: string; hooks?: { command?: string }[] }[]>;

  const choices = await readGuardChoices(target);

  return GUARD_NAMES.map((guard) => {
    const { event, matcher, describes } = GUARD_EVENTS[guard];
    const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
    const armed = entries.some(
      (entry) =>
        entry.matcher === matcher &&
        (entry.hooks ?? []).some((hook) => (hook.command ?? "").includes(scriptFor(guard))),
    );
    // The recorded choice wins where the two disagree: a guard turned off is
    // off even if a settings entry is still present.
    const installed = choices[guard] === false ? false : armed;
    return { guard, installed, describes };
  });
}

function scriptFor(guard: GuardName): string {
  return guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard}.mjs`;
}

export async function setGuard(
  target: string,
  guard: GuardName,
  enabled: boolean,
): Promise<string> {
  return withLock(resolve(target, ".claude/settings.json"), () =>
    setGuardLocked(target, guard, enabled),
  );
}

async function setGuardLocked(
  target: string,
  guard: GuardName,
  enabled: boolean,
): Promise<string> {
  const path = resolve(target, ".claude/settings.json");
  const settings = await readSettings(target);
  const hooks = { ...((settings.hooks ?? {}) as Record<string, unknown[]>) };
  const { event, matcher } = GUARD_EVENTS[guard];
  const script = scriptFor(guard);

  const entries = Array.isArray(hooks[event]) ? [...(hooks[event] as unknown[])] : [];

  /**
   * Ours is the exact command we install, never a substring.
   *
   * Matching on `includes` deleted a maintainer hook that merely mentioned our
   * script path — theirs vanished and `guards on` did not bring it back.
   */
  const ourCommand = ((HOOK_SETTINGS.hooks as Record<string, readonly { hooks: readonly { command: string }[] }[]>)[event] ?? [])
    .flatMap((entry) => entry.hooks.map((hook) => hook.command))
    .find((command) => command.includes(script));
  const isThisGuard = (entry: unknown): boolean =>
    ((entry as { hooks?: { command?: string }[] } | null)?.hooks ?? []).some(
      (hook) => hook.command === ourCommand,
    );

  const others = entries.filter((entry) => !isThisGuard(entry));

  /**
   * The decision is recorded durably, not implied by an absent entry.
   *
   * "Off" meant removing the settings entry, which the next `init` unhelpfully
   * put back — the guard's own comment predicted exactly that. The record is
   * what both `init` and the guards themselves consult now.
   */
  await recordGuardChoice(target, guard, enabled);

  if (!enabled) {
    hooks[event] = others;
    settings.hooks = hooks;
    await mkdir(dirname(path), { recursive: true });
    await writeAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
    return `${guard} guard off, and it stays off across upgrades.`;
  }

  const ours = (HOOK_SETTINGS.hooks as Record<string, readonly unknown[]>)[event]?.find((entry) =>
    isThisGuard(entry),
  );
  if (!ours) {
    throw new GateRefusal(`No installed definition for the ${guard} guard.`, "wfctl init knowledge");
  }
  hooks[event] = [...others, ours];
  settings.hooks = hooks;
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
  return `${guard} guard on. Restart the session for it to take effect.`;
}

export const GUARD_CHOICES = ".workflow/guards.json";

async function readGuardChoices(target: string): Promise<Record<string, boolean>> {
  const raw = await readIfPresent(resolve(target, GUARD_CHOICES));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

async function recordGuardChoice(
  target: string,
  guard: GuardName,
  enabled: boolean,
): Promise<void> {
  const choices = { ...(await readGuardChoices(target)), [guard]: enabled };
  const path = resolve(target, GUARD_CHOICES);
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(choices, null, 2)}\n`);
}

/** Guards the maintainer turned off, which an upgrade must not re-arm. */
export async function disabledGuards(target: string): Promise<GuardName[]> {
  const choices = await readGuardChoices(target);
  return GUARD_NAMES.filter((guard) => choices[guard] === false);
}

export function renderGuards(
  status: { guard: GuardName; installed: boolean; describes: string }[],
): string {
  return [
    ...status.map(
      (entry) =>
        `${entry.installed ? "on " : "off"}  ${entry.guard.padEnd(6)}  ${entry.describes}`,
    ),
    "",
    "wfctl guards on <stop|write|bash>   ·   wfctl guards off <stop|write|bash>",
    "",
    "Turning one off is a decision worth recording. The stop guard is the only",
    "mechanism that catches a turn ending on work nobody is waiting for.",
  ].join("\n");
}
