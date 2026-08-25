// What a hook was handed, read once and in one place.
//
// The guards used to reach into the payload themselves — `tool_input.file_path`
// in one, `tool_input.command` in another, `CLAUDE_PROJECT_DIR` in a third — so
// the shape of a host's hook payload was a fact spread across three files, none
// of which said which host it assumed.
//
// It assumed Claude Code, and that assumption is not free. Codex sends the same
// payload for a shell call and a different one for an edit: its editing tool is
// `apply_patch`, and the files it touches are named inside a patch body rather
// than in a `file_path` field. A guard reading `file_path` there sees nothing,
// finds no target, and exits zero — the write proceeds unchecked, and nothing
// anywhere reports that the guard did not run.
//
// So the payload is read here, and the guards ask questions instead: what is
// being written, which shell command is about to run, where is the project.
import { readFileSync } from "node:fs";

/** The hook payload on stdin, or an empty object when there is nothing to read. */
export function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

/**
 * The repository the session is working in.
 *
 * `CLAUDE_PROJECT_DIR` is set by one host and by nothing else. Every payload
 * carries `cwd`, so that is the answer wherever the variable is absent, and the
 * process's own directory is the last resort.
 */
export function projectDir(payload) {
  return process.env.CLAUDE_PROJECT_DIR ?? payload?.cwd ?? process.cwd();
}

/**
 * Every file a patch names.
 *
 * The header lines are the whole grammar. `Move to:` is included because a page
 * moved into curated knowledge lands there just as completely as one written
 * there, and a guard that only read `Update File:` would let the destination
 * through unexamined.
 */
function patchTargets(patch) {
  const targets = [];
  for (const line of patch.split("\n")) {
    const header = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line) ?? /^\*\*\* Move to: (.+)$/.exec(line);
    if (header?.[1]) targets.push(header[1].trim());
  }
  return targets;
}

/**
 * The files this tool call would write, in the order it names them.
 *
 * Empty for anything that is not a write, which is what makes this safe to call
 * on every payload: a guard asks what is being written and gets nothing back
 * when the answer is nothing.
 */
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

export function writeTargets(payload) {
  const input = payload?.tool_input;
  if (!input) return [];

  if (payload.tool_name === "apply_patch") {
    return typeof input.command === "string" ? patchTargets(input.command) : [];
  }

  /**
   * The tool is named, never inferred from the fields it carries.
   *
   * A host's matcher used to be the only thing keeping this guard off `Read`,
   * which carries a `file_path` like every write does. That worked while one
   * host's matcher list was the whole story and stopped working the moment a
   * second host had different tool names — reading a curated page would have
   * been refused as though it were an attempt to write one.
   */
  if (!WRITE_TOOLS.has(payload.tool_name)) return [];

  const named = input.file_path ?? input.path;
  return typeof named === "string" && named ? [named] : [];
}

/**
 * The shell command this tool call would run, or an empty string.
 *
 * Both hosts report a shell call as `Bash` with a string `command` — measured,
 * not assumed. The name is checked rather than the shape so that a future tool
 * carrying an unrelated `command` field cannot be mistaken for a shell.
 */
export function shellCommand(payload) {
  if (payload?.tool_name !== "Bash") return "";
  const command = payload?.tool_input?.command;
  return typeof command === "string" ? command : "";
}
