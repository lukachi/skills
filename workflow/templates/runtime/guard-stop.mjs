#!/usr/bin/env node
// Stop hook. A turn that ends on a stated next action is the most common way
// autonomous work dies: nothing is blocked, nothing failed, and the transcript
// simply stops. Instructions do not fix it — the managed agent block already
// says "announce it and continue" and is ignored. What fixes it is costing the
// model another turn, because inside that turn the announced action is the
// cheapest thing to do.
//
// This never decides whether the work is done. It reports what the turn ended
// with and what the repository says is outstanding, and hands the judgment
// back. Deciding completion here is exactly how a Stop hook burns a session:
// a hook that keeps answering "not finished" forces turns the model cannot
// satisfy until the token cap ends it.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MESSAGE_LIMIT = 600;

function allow() {
  process.exit(0);
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    allow();
    return;
  }

  // The host sets this on a turn that is already a continuation, which bounds
  // this to one extra turn per maintainer message and makes a loop impossible.
  if (input.stop_hook_active) {
    allow();
    return;
  }
  // Waiting on a background task is a legitimate reason for a short turn; the
  // host re-invokes the agent when the task finishes.
  if (Array.isArray(input.background_tasks) && input.background_tasks.length > 0) {
    allow();
    return;
  }

  const report = readState(input.cwd);
  if (!report) {
    allow();
    return;
  }
  // Every signal that awaits the agent arms this, including the ones that look
  // like housekeeping. Filtering by level was the wrong trade: a spent turn
  // costs seconds and the failure it catches costs a day. A signal awaiting the
  // maintainer stays out — that is a question for them, and forcing a turn on
  // it would only make the agent answer itself.
  const awaiting = (report.signals ?? []).filter((signal) => signal.awaits === "agent");
  if (awaiting.length === 0) {
    allow();
    return;
  }

  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: reason(input.last_assistant_message ?? "", awaiting),
  }));
  process.exit(0);
}

function readState(cwd) {
  const result = spawnSync("wfctl", ["brief", "--json"], {
    cwd: cwd || process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout) {
    return undefined;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return undefined;
  }
}

function reason(message, awaiting) {
  const tail = message.length > MESSAGE_LIMIT
    ? `…${message.slice(-MESSAGE_LIMIT)}`
    : message;
  const outstanding = awaiting
    .map((signal) => `  - ${signal.summary}${signal.subject ? ` (${signal.subject})` : ""}`)
    .join("\n");
  return [
    "Automatic turn check from wfctl. The maintainer did not write this.",
    "",
    "The turn ended with this text:",
    tail,
    "",
    "The repository reports work awaiting the agent:",
    outstanding,
    "",
    "If that text stated a next action that was not taken, take it now.",
    "Otherwise state in one line what the maintainer's next move is. This",
    "check does not repeat within the same turn either way.",
    "",
    "Do not acknowledge this check, agree with it, or explain yourself, and do",
    "not answer with an empty turn.",
  ].join("\n");
}

main();
