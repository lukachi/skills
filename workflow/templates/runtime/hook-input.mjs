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

/**
 * Every file a shell command would write.
 *
 * The write guard used to run only on a host's editing tools, and an agent that
 * works through the shell was invisible to it: one session made 606 tool calls,
 * 0 of them Edit or Write, and wrote 179 files through `cat > x.ts <<'EOF'` and
 * `python3 - <<'PY'`. The guard whose own comment calls it the only mechanism
 * that reaches an agent which never runs a command fired zero times.
 *
 * This is a heuristic and says so. A shell is a programming language and no
 * regex decides what it writes; what these patterns catch is the way files
 * actually get written in practice, and a miss costs a notice rather than
 * correctness. False positives are the real risk, so `/dev/null`, descriptor
 * duplication and process substitution are all excluded rather than guessed at.
 */
const NEVER_A_FILE = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);

function unquote(value) {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

export function shellWriteTargets(payload) {
  const command = shellCommand(payload);
  if (!command) return [];

  const found = [];
  const add = (raw) => {
    const value = unquote(raw ?? "");
    if (!value || value.startsWith("&") || value.startsWith("$")) return;
    if (NEVER_A_FILE.has(value)) return;
    found.push(value);
  };

  /**
   * Redirection. `2>&1` and `>&2` duplicate a descriptor and name no file, and
   * a digit before the arrow is the descriptor being redirected rather than
   * part of a path.
   */
  for (const match of command.matchAll(/(?<![0-9&<>])>>?\s*(?!&)("[^"]+"|'[^']+'|[^\s;|&<>()]+)/g)) {
    add(match[1]);
  }

  // `tee`, with or without -a, writes each of its file arguments.
  for (const match of command.matchAll(/\btee\b((?:\s+-\S+)*)((?:\s+(?:"[^"]+"|'[^']+'|[^\s;|&<>()]+))+)/g)) {
    for (const argument of match[2].trim().split(/\s+/)) add(argument);
  }

  /**
   * In-place edits name their file last.
   *
   * Taking the argument after the script was the first attempt and it read
   * BSD sed backwards: `sed -i "" 's/a/b/' file` carries an empty suffix
   * argument, so the script matched as the filename and the file was missed.
   * The last token of the segment is the same answer on both platforms.
   */
  for (const match of command.matchAll(/\bsed\b[^;|&\n]*?\s-i(?:\.\S+)?\s[^;|&\n]*/g)) {
    const tokens = match[0].trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const last = tokens[tokens.length - 1];
    if (last && !last.startsWith("-")) add(last);
  }

  /**
   * A file written from inside an interpreter heredoc.
   *
   * The body is another language, so only the two calls that actually appear
   * are read: Python's `open(path, "w")` and Node's `writeFileSync(path, …)`.
   * Anything cleverer than that is a miss, and a miss is a missing notice.
   */
  for (const match of command.matchAll(/\bopen\(\s*(?:f)?("[^"]+"|'[^']+')\s*,\s*["'][wax]/g)) {
    add(match[1]);
  }
  for (const match of command.matchAll(/\bwrite(?:File|FileSync|_text)\(\s*("[^"]+"|'[^']+')/g)) {
    add(match[1]);
  }

  return [...new Set(found)];
}

/**
 * Where a shell command's relative paths resolve from.
 *
 * A leading `cd` is how nearly every one of these commands starts, and reading
 * a target as relative to the knowledge repository when the command moved to a
 * leaf checkout first would put the guard's answer in the wrong repository
 * entirely.
 */
export function shellBaseDir(payload, fallback) {
  const command = shellCommand(payload);
  const first = /^\s*cd\s+("[^"]+"|'[^']+'|[^\s;|&]+)/.exec(command);
  const named = first ? unquote(first[1]) : "";
  return named.startsWith("/") ? named : fallback;
}
