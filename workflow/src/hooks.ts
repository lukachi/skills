import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { isMissingFileError } from "./config.js";

export const SESSION_BRIEF_COMMAND = "wfctl brief --hook";
export const SESSION_START_EVENT = "SessionStart";

/**
 * Anchored on the project directory rather than an absolute path, because this
 * settings file is committed and shared. The existence test keeps a session
 * started outside an installed repository from failing every shell call.
 */
export const BACKGROUND_GUARD_COMMAND =
  '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" ] '
  + '&& node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" || true';
export const PRE_TOOL_USE_EVENT = "PreToolUse";

export const STOP_GUARD_COMMAND =
  '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" ] '
  + '&& node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" || true';
export const STOP_EVENT = "Stop";

export type HookOutcome = "installed" | "already-installed" | "removed" | "absent";

export interface HookResult {
  path: string;
  outcome: HookOutcome;
  command: string;
}

interface HookEntry {
  type?: string;
  command?: string;
}

interface HookMatcher {
  matcher?: string;
  hooks?: HookEntry[];
}

/**
 * The agent settings file belongs to the maintainer, so wfctl edits exactly one
 * entry inside it and leaves every other key untouched. The command string is
 * the identity: an entry that already runs it is never duplicated.
 */
export async function installHookEntry(
  target: string,
  eventName: string,
  matcher: string,
  command: string,
): Promise<HookResult> {
  const path = settingsPath(target);
  const settings = await readSettings(path);
  const hooks = asRecord(settings.hooks) ?? {};
  const event = asMatchers(hooks[eventName]);

  if (event.some((entry) => runsCommand(entry, command))) {
    return { path, outcome: "already-installed", command };
  }

  const next = {
    ...settings,
    hooks: {
      ...hooks,
      [eventName]: [
        ...event,
        { matcher, hooks: [{ type: "command", command }] },
      ],
    },
  };
  await writeSettings(path, next);
  return { path, outcome: "installed", command };
}

export function installSessionBriefHook(
  target: string,
  command = SESSION_BRIEF_COMMAND,
): Promise<HookResult> {
  return installHookEntry(target, SESSION_START_EVENT, "*", command);
}

/**
 * Installed with the rest of the workflow rather than on request: a background
 * command that stops reporting is invisible until someone notices hours later,
 * and that is not a per-project preference.
 */
export function installBackgroundGuardHook(target: string): Promise<HookResult> {
  return installHookEntry(
    target,
    PRE_TOOL_USE_EVENT,
    "Bash",
    BACKGROUND_GUARD_COMMAND,
  );
}

/**
 * Installed with the rest of the workflow for the same reason as the silence
 * watch: a turn that ends on a stated next action costs hours and looks like
 * nothing went wrong. The guard never judges completion; it costs one turn.
 */
export function installStopGuardHook(target: string): Promise<HookResult> {
  return installHookEntry(target, STOP_EVENT, "*", STOP_GUARD_COMMAND);
}

export function stopGuardHookInstalled(target: string): Promise<boolean> {
  return hookEntryInstalled(target, STOP_EVENT, STOP_GUARD_COMMAND);
}

export async function removeHookEntry(
  target: string,
  eventName: string,
  command: string,
): Promise<HookResult> {
  const path = settingsPath(target);
  const settings = await readSettings(path);
  const hooks = asRecord(settings.hooks);
  if (!hooks) {
    return { path, outcome: "absent", command };
  }
  const event = asMatchers(hooks[eventName]);
  const before = countEntries(event);
  // A maintainer may have added their own command beside this one, so drop the
  // matched entry and keep the matcher whenever anything else survives in it.
  const kept = event
    .map((matcher) => ({
      ...matcher,
      hooks: (matcher.hooks ?? []).filter((entry) => entry.command !== command),
    }))
    .filter((matcher) => (matcher.hooks ?? []).length > 0);
  if (countEntries(kept) === before) {
    return { path, outcome: "absent", command };
  }

  const remaining: Record<string, unknown> = { ...hooks };
  if (kept.length > 0) {
    remaining[eventName] = kept;
  } else {
    delete remaining[eventName];
  }
  const next: Record<string, unknown> = { ...settings };
  if (Object.keys(remaining).length > 0) {
    next.hooks = remaining;
  } else {
    delete next.hooks;
  }
  await writeSettings(path, next);
  return { path, outcome: "removed", command };
}

export function removeSessionBriefHook(
  target: string,
  command = SESSION_BRIEF_COMMAND,
): Promise<HookResult> {
  return removeHookEntry(target, SESSION_START_EVENT, command);
}

export async function hookEntryInstalled(
  target: string,
  eventName: string,
  command: string,
): Promise<boolean> {
  const settings = await readSettings(settingsPath(target));
  const hooks = asRecord(settings.hooks);
  return asMatchers(hooks?.[eventName]).some((entry) => runsCommand(entry, command));
}

export function sessionBriefHookInstalled(
  target: string,
  command = SESSION_BRIEF_COMMAND,
): Promise<boolean> {
  return hookEntryInstalled(target, SESSION_START_EVENT, command);
}

export function backgroundGuardHookInstalled(target: string): Promise<boolean> {
  return hookEntryInstalled(target, PRE_TOOL_USE_EVENT, BACKGROUND_GUARD_COMMAND);
}

/**
 * The SessionStart envelope Claude Code reads from hook stdout. Text stays a
 * separate concern: whatever the caller renders becomes the injected context.
 */
export function sessionStartEnvelope(context: string): string {
  return `${
    JSON.stringify(
      {
        hookSpecificOutput: {
          hookEventName: SESSION_START_EVENT,
          additionalContext: context,
        },
      },
      null,
      2,
    )
  }\n`;
}

function settingsPath(target: string): string {
  return join(target, ".claude/settings.json");
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }
    throw error;
  }
  if (content.trim() === "") {
    return {};
  }
  const parsed: unknown = JSON.parse(content);
  const settings = asRecord(parsed);
  if (!settings) {
    throw new Error(`${path} must contain a JSON object`);
  }
  return settings;
}

async function writeSettings(path: string, settings: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.wfctl-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function countEntries(matchers: readonly HookMatcher[]): number {
  return matchers.reduce((total, matcher) => total + (matcher.hooks ?? []).length, 0);
}

function runsCommand(matcher: HookMatcher, command: string): boolean {
  return (matcher.hooks ?? []).some((entry) => entry.command === command);
}

function asMatchers(value: unknown): HookMatcher[] {
  return Array.isArray(value) ? value.filter(isRecord) as HookMatcher[] : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
