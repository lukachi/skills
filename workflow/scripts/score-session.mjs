/**
 * Score a real agent session against what the tool should have made easy.
 *
 * This replaces most of the eval corpus. Ninety-four of its criteria were prose
 * judgments — "preserves the exceptions rather than smoothing them away" — that
 * no script can check and only a model could, and a harness that both supplies
 * the prompt and judges the answer proves nothing. So the corpus sat at zero
 * recorded runs and warned on every `check`, which is worse than absent: a
 * warning nobody can clear teaches you to skip warnings.
 *
 * Reading one real transcript found a defect that eighteen evals would not
 * have. Every signal it took was mechanical — which commands ran, which were
 * refused, how many attempts a step needed, whether a turn ended with state
 * written down — so it is scoreable, against work that actually happened rather
 * than against prompts somebody invented.
 *
 *   bun run score ~/.claude/projects/<project>/<session>.jsonl
 *   bun run score <dir>            # every transcript in a directory
 *
 * Findings are about the tool, not the agent. "This step took four attempts" is
 * a claim that the tool made a step hard, and every one it reports here has
 * turned out to be a defect in the tool rather than in the agent following it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Up to three words, because `work step framed` and `work issue create` are
// where the interesting failures are and two words stops short of both.
const WFCTL = /\bwfctl\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})/g;
const USAGE_BANNER = "wfctl — project workflow";

function transcripts(target) {
  const path = resolve(target);
  if (statSync(path).isDirectory()) {
    return readdirSync(path)
      .filter((entry) => entry.endsWith(".jsonl"))
      .map((entry) => join(path, entry));
  }
  return [path];
}

/** Every tool call and its result, in order, with the wfctl calls picked out. */
function readSession(path) {
  const turns = [];
  const pending = new Map();

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry.message ?? {};
    const content = message.content;

    if (message.role === "assistant" && typeof entry.uuid === "string") {
      turns.push({ kind: "assistant", text: textOf(content), calls: [] });
    }
    /**
     * The turn guard reaches the transcript as a user message rather than a
     * tool result — the host feeds its block reason back in as if the
     * maintainer had spoken, which is exactly what the guard's own text warns
     * the agent about.
     */
    if (message.role === "user" && typeof content === "string"
      && content.includes("Automatic turn check from wfctl")) {
      turns.push({ kind: "stop-guard", text: content });
    }
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      /**
       * Writes are watched as closely as commands.
       *
       * Several behaviours the eval corpus described in prose are plainly
       * visible here: a flow record edited by hand to get past a refusal, a
       * bundle directory made because a folder was easier than a command, a
       * curated page written straight into `knowledge/` instead of through
       * promotion. Each was a rule somebody hoped would be read; each is a path
       * in a tool call.
       */
      if (block.type === "tool_use" && ["Write", "Edit", "MultiEdit"].includes(block.name)) {
        const target = block.input?.file_path ?? "";
        if (target) turns.push({ kind: "write", target });
      }
      if (block.type === "tool_use" && block.name === "Bash") {
        const command = block.input?.command ?? "";
        const invocations = [...command.matchAll(WFCTL)].map((match) => match[1]);
        if (invocations.length > 0) {
          pending.set(block.id, { invocations, command });
        }
      }
      if (block.type === "tool_result" && pending.has(block.tool_use_id)) {
        const call = pending.get(block.tool_use_id);
        pending.delete(block.tool_use_id);
        turns.push({ kind: "wfctl", ...call, output: textOf(block.content) });
      }
      if (block.type === "tool_result" && typeof block.content !== "undefined") {
        const text = textOf(block.content);
        if (text.includes("Automatic turn check from wfctl")) {
          turns.push({ kind: "stop-guard", text });
        }
      }
    }
  }
  return turns;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
}

/**
 * A command the tool has no dispatch for.
 *
 * The agent guessed a name. Every guess is a place the real command was not
 * where it looked, which is a fact about the surface rather than about the
 * agent.
 */
function invented(calls) {
  return calls
    .filter((call) => call.output.includes(USAGE_BANNER) || /wfctl has no command/.test(call.output))
    .map((call) => call.invocations[0]);
}

/** Flags rejected because they belong to another command, or to none. */
function misplacedFlags(calls) {
  return calls
    .filter((call) => /does not read --|Unknown flag/.test(call.output))
    .map((call) => {
      const named = /(\w[\w-]*) does not read (--[\w-]+)/.exec(call.output);
      return named ? `${named[1]} ${named[2]}` : call.invocations[0];
    });
}

/**
 * Steps that took more than one attempt.
 *
 * Each refusal names a remedy, so a step reached on the second try is the
 * design working. A step that takes four is the tool arguing with itself, and
 * the loop that produced exactly that — re-recording a step restarting the
 * clock its own checkpoint gate measured against — is why this exists.
 */
function stepAttempts(calls) {
  const attempts = new Map();
  for (const call of calls) {
    const step = /^work step (\w+)/.exec(call.invocations[0] ?? "");
    if (!step) continue;
    const record = attempts.get(step[1]) ?? { tries: 0, refusals: [] };
    record.tries += 1;
    const why = refusalMessage(call.output);
    if (why) record.refusals.push(why);
    attempts.set(step[1], record);
  }
  return [...attempts].filter(([, record]) => record.tries > 2);
}

/**
 * The sentence a refusal opens with.
 *
 * Command output is guidance first and the refusal last, so the first non-empty
 * line of the whole output is usually a paragraph of prose from an unrelated
 * section. What identifies the refusal is the `remedy:` line, and its message
 * is what sits immediately above it.
 */
function refusalMessage(output) {
  const lines = output.split("\n");
  const remedy = lines.findIndex((line) => line.startsWith("remedy: "));
  if (remedy < 0) return undefined;

  /**
   * A refusal renders as message, then detail, then remedy, with no blank line
   * between them, and the guidance above it is separated by one. So the block
   * runs from `remedy:` up to the first blank line, and the message is its top
   * — not the line directly above `remedy:`, which is the tail of the detail.
   */
  let top = remedy;
  while (top > 0 && (lines[top - 1]?.trim().length ?? 0) > 0) top -= 1;
  return lines[top]?.trim().slice(0, 90);
}

/** Refusals by their remedy, so the ones the tool hands out most are visible. */
function refusals(calls) {
  const counts = new Map();
  for (const call of calls) {
    for (const line of call.output.split("\n")) {
      if (!line.startsWith("remedy: ")) continue;
      const remedy = line.slice(8).split("\n")[0].slice(0, 80);
      counts.set(remedy, (counts.get(remedy) ?? 0) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1]);
}

/**
 * Whether each turn the guard forced actually moved anything.
 *
 * A re-entry that produces no further tool call is a turn the guard spent for
 * nothing, and enough of those means the guard is firing on a state it should
 * release on.
 */
function guardValue(turns) {
  let fired = 0;
  let productive = 0;
  for (const [index, turn] of turns.entries()) {
    if (turn.kind !== "stop-guard") continue;
    fired += 1;
    if (turns.slice(index + 1).some((later) => later.kind === "wfctl")) productive += 1;
  }
  return { fired, productive };
}

/**
 * Writes that went where a command should have taken them.
 *
 * The write guard refuses these when it is installed and armed. Seeing one in a
 * transcript therefore means either the guard was off, or the agent reached
 * ground the guard does not cover — both worth knowing, and neither visible
 * from the tool's own output.
 */
const BY_HAND = [
  [/\.workflow\/flows\/.*\.json$/, "edited a flow record by hand"],
  [/\/knowledge\/.+\.md$/, "wrote a page straight into curated knowledge"],
  [/\/changes\/active\/[^/]+\/(?!promotion\/)/, "wrote inside a bundle by hand"],
  [/\/changes\/archive\//, "wrote into the archive by hand"],
];

function writesByHand(turns) {
  const found = [];
  for (const turn of turns) {
    if (turn.kind !== "write") continue;
    for (const [pattern, what] of BY_HAND) {
      if (pattern.test(turn.target)) found.push(`${what}: ${turn.target.split("/").slice(-3).join("/")}`);
    }
  }
  return found;
}

/**
 * Turns that ended having learned something and written none of it down.
 *
 * A turn that ran commands and then stopped without a checkpoint is the failure
 * the whole checkpoint mechanism exists for, and it is countable: work between
 * one checkpoint and the end of a turn, with no checkpoint closing it.
 */
function unwrittenTurns(turns) {
  let sinceCheckpoint = 0;
  let unwritten = 0;
  for (const turn of turns) {
    if (turn.kind === "wfctl") {
      if (turn.invocations[0] === "checkpoint") sinceCheckpoint = 0;
      else sinceCheckpoint += 1;
    }
    if (turn.kind === "stop-guard" && sinceCheckpoint > 0) unwritten += 1;
  }
  return unwritten;
}

function report(path, turns) {
  const calls = turns.filter((turn) => turn.kind === "wfctl");
  const lines = [`${path}`, `  ${calls.length} wfctl call(s), ${turns.length} recorded turn(s)`];

  if (calls.length === 0) {
    lines.push("  no wfctl usage in this transcript");
    return { lines, findings: 0 };
  }

  let findings = 0;

  const guessed = invented(calls);
  if (guessed.length > 0) {
    findings += guessed.length;
    lines.push(`  ${guessed.length} invented command(s): ${[...new Set(guessed)].join(", ")}`);
    lines.push("    The agent looked for these and they were not there.");
  }

  const flags = misplacedFlags(calls);
  if (flags.length > 0) {
    findings += flags.length;
    lines.push(`  ${flags.length} misplaced flag(s): ${[...new Set(flags)].join(", ")}`);
  }

  const loops = stepAttempts(calls);
  for (const [step, record] of loops) {
    findings += 1;
    lines.push(`  \`work step ${step}\` took ${record.tries} attempts:`);
    if (record.refusals.length === 0) {
      // Re-running a step that succeeds each time is its own signal: something
      // sent the agent back to a step it had already recorded.
      lines.push("    none of them refused — the agent was sent back to a step it had reached");
    }
    for (const why of [...new Set(record.refusals)]) lines.push(`    ${why}`);
  }

  const guard = guardValue(turns);
  if (guard.fired > 0) {
    lines.push(`  turn guard fired ${guard.fired}x, ${guard.productive} followed by more work`);
    if (guard.productive < guard.fired) {
      findings += guard.fired - guard.productive;
      lines.push("    A re-entry that moves nothing is a turn spent for nothing.");
    }
  }

  const byHand = writesByHand(turns);
  if (byHand.length > 0) {
    findings += byHand.length;
    lines.push(`  ${byHand.length} write(s) that a command should have made:`);
    for (const what of [...new Set(byHand)]) lines.push(`    ${what}`);
  }

  const unwritten = unwrittenTurns(turns);
  if (unwritten > 0) {
    findings += unwritten;
    lines.push(`  ${unwritten} turn(s) ended with work done since the last checkpoint`);
  }

  const checkpoints = calls.filter((call) => call.invocations[0] === "checkpoint").length;
  lines.push(`  ${checkpoints} checkpoint(s) written`);
  if (checkpoints === 0) {
    findings += 1;
    lines.push("    Nothing a later session could resume from was recorded.");
  }

  const top = refusals(calls).slice(0, 5);
  if (top.length > 0) {
    lines.push("  refusals, most frequent first:");
    for (const [remedy, count] of top) lines.push(`    ${count}x  ${remedy}`);
  }

  return { lines, findings };
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  process.stderr.write("usage: bun run score <session.jsonl | directory>\n");
  process.exit(2);
}

let total = 0;
for (const target of targets.flatMap(transcripts)) {
  const { lines, findings } = report(target, readSession(target));
  total += findings;
  process.stdout.write(`${lines.join("\n")}\n\n`);
}

process.stdout.write(
  total === 0
    ? "nothing to answer for: no invented commands, no refusal loops, no spent turns\n"
    : `${total} thing(s) the tool made harder than it should have\n`,
);
