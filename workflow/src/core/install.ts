import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

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

  const bundles: { source: string; prefix: string }[] = [
    { source: "templates/guidance", prefix: GUIDANCE_DIR },
    { source: "templates/runtime", prefix: RUNTIME_DIR },
  ];

  const guidance: { path: string; content: string }[] = [];
  for (const bundle of bundles) {
    for (const file of await collect(resolve(options.distribution, bundle.source))) {
      guidance.push({ path: join(bundle.prefix, file.path), content: file.content });
    }
  }

  for (const file of guidance) {
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

    const runtime = operation.path.startsWith(`${RUNTIME_DIR}/`);
    const source = resolve(
      options.distribution,
      runtime ? "templates/runtime" : "templates/guidance",
      relative(runtime ? RUNTIME_DIR : GUIDANCE_DIR, operation.path),
    );
    const content = await readFile(source, "utf8");
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 0o755);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }

  await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);

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


/**
 * Merge the hooks into the agent's settings without touching anything else.
 *
 * The file belongs to the project, not to this tool, so entries it did not
 * write are preserved and its own are replaced by matcher. A settings file
 * rewritten wholesale would silently drop whatever the maintainer configured,
 * and they would find out the next time something they rely on did not run.
 */
export async function installHooks(target: string): Promise<void> {
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

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  for (const [event, entries] of Object.entries(HOOK_SETTINGS.hooks)) {
    const ours = entries as unknown as { matcher: string }[];
    const theirs = ((hooks[event] ?? []) as { matcher?: string }[]).filter(
      (entry) => !ours.some((entry_) => entry_.matcher === entry.matcher),
    );
    hooks[event] = [...theirs, ...ours];
  }
  settings.hooks = hooks;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
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
    if (begin >= 0 && end > begin) {
      const next =
        existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile(path, next, "utf8");
      continue;
    }
    await writeFile(path, `${existing.trimEnd()}\n\n${block}`, "utf8");
  }
}
