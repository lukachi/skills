import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guard = join(root, "templates/runtime/guard-stop.mjs");

/**
 * The guard reads its payload and its own memory file, and nothing else.
 *
 * It used to shell out to `wfctl brief --json`, and every case here was really
 * a case about the collectors. What it asks now is a question about the turn,
 * so the workspace is a directory and the payload is the whole input.
 */
function workspace() {
  const base = mkdtempSync(join(tmpdir(), "wfctl-stop-guard-"));
  const ask = (payload) => {
    const result = spawnSync("node", [guard], {
      input: JSON.stringify({ cwd: base, ...payload }),
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.status, 0, "the guard must never fail a turn");
    return result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
  };
  /** What `wfctl continue` does, without needing the built CLI on PATH. */
  const refill = () => {
    const path = join(base, ".workflow/current/hooks/stop-guard.json");
    const carried = JSON.parse(readFileSync(path, "utf8"));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ ...carried, budget: 1 })}\n`, "utf8");
  };
  return { base, ask, refill };
}

{
  const w = workspace();
  assert.equal(
    w.ask({ prompt_id: "p", last_assistant_message: "Moving on to wave 5." })?.decision,
    "block",
    "a turn that ends is checked, whatever the bundle says",
  );
}

{
  // The whole reason the bundle came out. A repository where every signal
  // awaits the maintainer is the normal state of a repository, and it used to
  // mean this guard allowed every stop in the session without a word.
  const w = workspace();
  assert.equal(
    w.ask({ prompt_id: "p", last_assistant_message: "I'll start on the parser now." })?.decision,
    "block",
    "no bundle state is consulted, so none of it can silence the check",
  );
}

{
  const w = workspace();
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "y" }),
    undefined,
    "one catch per maintainer message: the second stop is clean",
  );
}

{
  const w = workspace();
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  w.refill();
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "y" })?.decision,
    "block",
    "an agent that says it is still working is watched again",
  );
}

{
  const w = workspace();
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "same" })?.decision, "block");
  w.refill();
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "same" }),
    undefined,
    "a repeated answer releases even after a refill — that is a stuck agent",
  );
}

{
  const w = workspace();
  let blocks = 0;
  for (let turn = 0; turn < 140; turn += 1) {
    const decision = w.ask({
      prompt_id: "p",
      stop_hook_active: turn > 0,
      last_assistant_message: `progress ${turn}`,
    });
    if (!decision) break;
    blocks += 1;
    w.refill();
  }
  assert.ok(blocks > 20, `a run that keeps refilling must not be capped early, got ${blocks}`);
  assert.ok(blocks <= 101, `the ceiling must end the turn, got ${blocks} blocks`);
}

{
  const w = workspace();
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  assert.equal(
    w.ask({ prompt_id: "next", last_assistant_message: "x" })?.decision,
    "block",
    "a new maintainer message refills the budget",
  );
}

{
  const w = workspace();
  assert.equal(
    w.ask({ background_tasks: [{ id: "1" }], last_assistant_message: "x" }),
    undefined,
    "waiting on a background task is a legitimate short turn",
  );
}

{
  const w = workspace();
  mkdirSync(join(w.base, ".workflow"), { recursive: true });
  writeFileSync(join(w.base, ".workflow/guards.json"), JSON.stringify({ stop: false }), "utf8");
  assert.equal(
    w.ask({ prompt_id: "p", last_assistant_message: "x" }),
    undefined,
    "the maintainer's switch is obeyed",
  );
}

{
  // Without durable memory the budget cannot be spent, so a block could repeat
  // without bound. Allowing costs one missed catch.
  const w = workspace();
  mkdirSync(join(w.base, ".workflow"), { recursive: true });
  writeFileSync(join(w.base, ".workflow/current"), "not a directory\n", "utf8");
  assert.equal(
    w.ask({ prompt_id: "p", last_assistant_message: "x" }),
    undefined,
    "an unwritable memory never traps the session",
  );
}

{
  const result = spawnSync("node", [guard], {
    input: "not json",
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "", "malformed input ends the turn");
}

{
  const w = workspace();
  const decision = w.ask({ prompt_id: "p", last_assistant_message: "x".repeat(5000) });
  assert.ok(
    decision.reason.length < 2500,
    "the quoted turn is truncated so a long report cannot dominate the reason",
  );
  assert.ok(
    decision.reason.includes("stated a next action"),
    "the first catch names the failure it exists for, with the turn as evidence",
  );
  assert.ok(
    decision.reason.includes("wfctl continue"),
    "and names the one command that re-arms it",
  );
}

{
  // A wall of identical thirty-line messages is what makes the maintainer
  // scroll for the one turn that mattered.
  const w = workspace();
  const first = w.ask({ prompt_id: "p", last_assistant_message: "a" }).reason;
  w.refill();
  const second = w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "b" }).reason;
  assert.ok(
    second.length < first.length / 2,
    `a fire the agent asked for is short: ${second.length} vs ${first.length}`,
  );
}

process.stdout.write(
  "stop-guard: checks the turn, one catch per message, refilled by the agent\n",
);
