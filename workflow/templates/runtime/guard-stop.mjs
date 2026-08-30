#!/usr/bin/env node
// Stop hook.
//
// A turn that ends on a stated next action is the most common way autonomous
// work dies: nothing is blocked, nothing failed, and the transcript simply
// stops. Instructions do not fix it — the managed agent block already says
// "announce it and continue" and is ignored. What fixes it is costing the model
// another turn, because inside that turn the announced action is the cheapest
// thing to do.
//
// It asks one question, of the turn: did you say you were about to do
// something, and then stop? The evidence is the turn's own last message, which
// is handed straight back.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not read the bundle. For most of
// a month it armed on `wfctl brief --json` signals awaiting the agent, which
// made it a second opinion about work state — the checkpoint's job — and left
// the utterance test with nothing behind it. In a repository whose signals all
// awaited the maintainer it then fired 204 times in one session and allowed
// every one of them, silently. Whether a bundle has open units is not evidence
// about whether this turn should have ended.
//
// THE BUDGET. One catch per maintainer message. A guard that can fire twice
// unprompted is a guard that can argue with an agent that is right, and the
// maintainer is sitting there anyway. If the agent is genuinely mid-flight it
// says so with `wfctl continue`, which refills the budget and re-arms this for
// the next stop. That is the whole protocol: the refill is the agent's answer,
// taken as an act rather than read out of prose, so nothing here has to judge
// anything.
//
// Neither branch can strand a run. Not refilling means the next stop is clean,
// which is what an agent waiting on a person wants. Refilling means it is still
// working, and being caught again is what it just asked for.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectDir, readPayload } from "./hook-input.mjs";

const MESSAGE_LIMIT = 600;
/**
 * A runaway backstop and nothing more. The budget bounds this to one fire per
 * maintainer message on its own; only an agent refilling in a loop can reach
 * here, and then the turn still has to end.
 */
const MAX_FIRES = 100;
const BLOCK_HISTORY = 50;

function allow() {
  process.exit(0);
}

function main() {
  const input = readPayload();

  // Waiting on a background task is a legitimate reason for a short turn; the
  // host re-invokes the agent when the task finishes.
  if (Array.isArray(input.background_tasks) && input.background_tasks.length > 0) {
    allow();
    return;
  }

  /**
   * The turn is the evidence, so no turn means nothing to ask about.
   *
   * This also covers a payload that did not parse and a host that does not
   * supply the field. The old guard got that for free by failing to read state
   * and allowing; asking about the turn instead, it has to be said.
   */
  const message = typeof input.last_assistant_message === "string"
    ? input.last_assistant_message
    : "";
  if (!message.trim()) {
    allow();
    return;
  }

  const cwd = projectDir(input);
  // Turned off deliberately. `wfctl guards` owns the switch, so every surface
  // that reports on this guard reports the same answer.
  if (disabled(cwd)) {
    allow();
    return;
  }

  const key = `${input.session_id ?? ""}:${input.prompt_id ?? ""}`;
  const carried = readMemory(cwd);
  /**
   * A new maintainer message refills the budget.
   *
   * Without this the guard is spent after its first catch and never fires
   * again for the rest of the session, which is the same as not being
   * installed.
   */
  const fresh = carried.key !== key;
  const budget = fresh ? 1 : carried.budget;
  const fires = fresh ? 0 : carried.fires;

  if (budget <= 0) {
    // The agent was caught once and chose not to refill. That is it saying it
    // is waiting on the maintainer, and it does not get asked twice.
    allow();
    return;
  }

  const answer = createHash("sha256").update(message).digest("hex");

  if (!fresh && carried.answer === answer) {
    // The same answer to the same question. Asking again buys nothing and is
    // what a genuinely stuck agent looks like from out here.
    writeMemory(cwd, { key, budget: 0, fires, answer });
    allow();
    return;
  }

  if (fires >= MAX_FIRES) {
    writeMemory(cwd, { key, budget: 0, fires, answer });
    allow();
    return;
  }

  const spent = writeMemory(cwd, { key, budget: budget - 1, fires: fires + 1, answer });
  if (!spent) {
    // Without durable memory the budget cannot be spent, so a block here could
    // repeat without bound. Allowing costs one missed catch; the alternative
    // costs the session.
    allow();
    return;
  }

  recordBlock(cwd, {
    at: new Date().toISOString(),
    session: input.session_id ?? "",
    fire: fires + 1,
  });

  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: reason(message, fires),
  }));
  process.exit(0);
}

/**
 * Every block. Deciding whether this guard needs a way to end a turn that is
 * not a blocker takes evidence about the blocks it actually makes, and the only
 * alternative on offer was re-reading session transcripts by hand.
 *
 * Bounded and rewritten whole: a log nobody prunes becomes its own problem.
 */
function recordBlock(cwd, entry) {
  try {
    const path = join(cwd, ".workflow/current/hooks/stop-guard-blocks.json");
    let history = [];
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    } catch {
      // A first block, or a file this run is about to replace anyway.
    }
    history.push(entry);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(history.slice(-BLOCK_HISTORY), null, 1)}\n`, "utf8");
    renameSync(temporary, path);
  } catch {
    // Recording is for us, never for the turn.
  }
}

// One switch, and `wfctl guards` owns it.
function disabled(cwd) {
  try {
    const choices = JSON.parse(readFileSync(join(cwd, ".workflow/guards.json"), "utf8"));
    return choices.stop === false;
  } catch {
    return false;
  }
}

/**
 * Under `.workflow/current/`, which is gitignored, but one level down: in a leaf
 * repository wfctl reads every `*.json` at the top of that directory as an
 * active-work binding, so a state file left there broke every `wfctl work`
 * command with "Unsupported or malformed active work binding". A subdirectory
 * is invisible to that scan.
 *
 * `.workflow/runtime/` looks like the obvious home and is the wrong one: it
 * holds installed assets that upgrades own and Git tracks, so mutable state
 * there both dirties the tree and turns every upgrade into a conflict.
 */
function memoryPath(cwd) {
  return join(cwd, ".workflow/current/hooks/stop-guard.json");
}

function readMemory(cwd) {
  try {
    const value = JSON.parse(readFileSync(memoryPath(cwd), "utf8"));
    return {
      key: typeof value.key === "string" ? value.key : "",
      budget: Number.isInteger(value.budget) ? value.budget : 0,
      fires: Number.isInteger(value.fires) ? value.fires : 0,
      answer: typeof value.answer === "string" ? value.answer : "",
    };
  } catch {
    return { key: "", budget: 0, fires: 0, answer: "" };
  }
}

function writeMemory(cwd, value) {
  try {
    const path = memoryPath(cwd);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value)}\n`, "utf8");
    renameSync(temporary, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The message, and why it is two lengths.
 *
 * The first catch of a maintainer message carries the whole thing. Anything
 * after it is a fire the agent asked for by refilling, and it already knows why
 * — repeating thirty lines there buries the one message the maintainer is
 * scrolling for.
 *
 * Written as targets rather than bans. Steering by prohibition drags the
 * forbidden behaviour into context and makes it more available: the ban
 * half-reads as an instruction to do the thing.
 */
function reason(message, fires) {
  const tail = message.length > MESSAGE_LIMIT
    ? `…${message.slice(-MESSAGE_LIMIT)}`
    : message;

  if (fires > 0) {
    return [
      "wfctl turn check. You asked to be watched again, so: the turn ended.",
      "",
      "If it named something you have not done, do it now. If you are waiting on",
      "the maintainer, say what you need in one line and end.",
      "",
      "  wfctl continue     still working, watch me again",
    ].join("\n");
  }

  return [
    "Automatic turn check from wfctl. This is the workflow speaking, not the",
    "maintainer.",
    "",
    "The turn ended with this text:",
    tail,
    "",
    "If that text stated a next action and did not take it, take it now — inside",
    "this turn, where it is the cheapest thing to do. That is the failure this",
    "check exists for: nothing was blocked, nothing failed, and the work simply",
    "stopped.",
    "",
    "Ending a turn hands control to the maintainer. If that is what you want,",
    "say what you need from them in one line and end. This check will not fire",
    "again until they write to you.",
    "",
    "If you are still working, say so and it re-arms for your next stop:",
    "",
    "  wfctl continue",
    "",
    "Whichever you do, the state of the work belongs in the record rather than",
    "in a message — prose is not state, and an explanation that lives only in a",
    "turn goes with the session:",
    "",
    "  wfctl checkpoint \"<what has happened since>\"",
    "",
    "Do not stop to protect context. That fear is what made runs park themselves",
    "halfway through a window that was still wide open; the checkpoint is what",
    "recovery reads, and it costs one command.",
  ].join("\n");
}

main();
