import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guard = join(root, "templates/runtime/guard-stop.mjs");

/**
 * The guard shells out to `wfctl brief --json`, so the state under test is a
 * stub on PATH whose output the test rewrites between calls. That keeps every
 * case here about the decision and none of it about the collectors, which have
 * their own tests.
 */
function workspace() {
  const base = mkdtempSync(join(tmpdir(), "wfctl-stop-guard-"));
  const bin = join(base, "bin");
  mkdirSync(bin, { recursive: true });
  const state = (report) => {
    const stub = report === undefined
      ? "#!/bin/sh\nexit 1\n"
      : `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(report)}\nJSON\n`;
    writeFileSync(join(bin, "wfctl"), stub, "utf8");
    chmodSync(join(bin, "wfctl"), 0o755);
  };
  const ask = (payload) => {
    const result = spawnSync("node", [guard], {
      input: JSON.stringify({ cwd: base, ...payload }),
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
      timeout: 30_000,
    });
    assert.equal(result.status, 0, "the guard must never fail a turn");
    return result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
  };
  return { base, bin, state, ask };
}

function report(level, awaits, facts) {
  return {
    signals: [{
      id: "work.active",
      domain: "work",
      level,
      summary: "A change bundle is open",
      subject: "demo",
      awaits,
      ...(facts ? { facts } : {}),
    }],
    capabilities: [],
    degraded: [],
  };
}

const open = report("attention", "agent");

{
  const w = workspace();
  w.state(open);
  assert.equal(
    w.ask({ last_assistant_message: "Moving on to wave 5." })?.decision,
    "block",
    "a turn ending while work awaits the agent is re-entered",
  );
}

{
  // The failure this bound was rewritten for: re-enter, do real work, stop
  // again, and the run parks itself for the night with the frontier full.
  const w = workspace();
  w.state(report("attention", "agent", { filesReviewed: 10 }));
  assert.equal(
    w.ask({ prompt_id: "p", last_assistant_message: "read ten" })?.decision,
    "block",
  );
  w.state(report("attention", "agent", { filesReviewed: 41 }));
  assert.equal(
    w.ask({
      prompt_id: "p",
      stop_hook_active: true,
      last_assistant_message: "read forty-one",
    })?.decision,
    "block",
    "a continuation that moved the repository earns another one",
  );
}

{
  const w = workspace();
  w.state(open);
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "x" }),
    undefined,
    "a continuation that changed nothing observable is released",
  );
}

{
  const w = workspace();
  w.state(open);
  let blocks = 0;
  for (let turn = 0; turn < 40; turn += 1) {
    // Every turn moves the state, so only the hard ceiling can end this.
    w.state(report("attention", "agent", { filesReviewed: turn }));
    const decision = w.ask({
      prompt_id: "p",
      stop_hook_active: turn > 0,
      last_assistant_message: `progress ${turn}`,
    });
    if (!decision) {
      break;
    }
    blocks += 1;
  }
  assert.ok(blocks > 1, "steady progress must survive past a single re-entry");
  assert.ok(blocks <= 7, `the ceiling must end the turn, got ${blocks} blocks`);
}

{
  // A repository that moves for reasons unrelated to this turn would otherwise
  // re-enter forever against an agent repeating itself.
  const w = workspace();
  w.state(report("attention", "agent", { filesReviewed: 1 }));
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "same" })?.decision, "block");
  w.state(report("attention", "agent", { filesReviewed: 2 }));
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "same" }),
    undefined,
    "an unchanged answer releases even while the state moves",
  );
}

{
  const w = workspace();
  w.state(open);
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  assert.equal(
    w.ask({ prompt_id: "next", last_assistant_message: "x" })?.decision,
    "block",
    "a new maintainer message starts its own count",
  );
}

{
  const w = workspace();
  w.state(open);
  assert.equal(
    w.ask({ background_tasks: [{ id: "1" }], last_assistant_message: "x" }),
    undefined,
    "waiting on a background task is a legitimate short turn",
  );
}

{
  const w = workspace();
  w.state(report("attention", "maintainer"));
  assert.equal(
    w.ask({ last_assistant_message: "x" }),
    undefined,
    "a signal awaiting the maintainer is a question for them, not a task",
  );
}

{
  const w = workspace();
  w.state({ signals: [], capabilities: [], degraded: [] });
  assert.equal(w.ask({ last_assistant_message: "x" }), undefined, "an idle repository ends the turn");
}

{
  const w = workspace();
  w.state(undefined);
  assert.equal(
    w.ask({ last_assistant_message: "x" }),
    undefined,
    "an unreadable state never traps the session",
  );
}

{
  // Progress-based re-entry needs durable memory. Without it the guard must
  // degrade to the weaker single re-entry rather than risk a turn that cannot
  // end.
  const w = workspace();
  w.state(open);
  mkdirSync(join(w.base, ".workflow"), { recursive: true });
  writeFileSync(join(w.base, ".workflow/current"), "not a directory\n", "utf8");
  assert.equal(w.ask({ prompt_id: "p", last_assistant_message: "x" })?.decision, "block");
  assert.equal(
    w.ask({ prompt_id: "p", stop_hook_active: true, last_assistant_message: "x" }),
    undefined,
    "an unwritable memory falls back to one re-entry",
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
  w.state(open);
  const decision = w.ask({ last_assistant_message: "x".repeat(5000) });
  assert.ok(
    decision.reason.length < 2500,
    "the quoted turn is truncated so a long report cannot dominate the reason",
  );
  assert.ok(
    decision.reason.includes("A change bundle is open (demo)"),
    "the reason names the outstanding work rather than asserting a verdict",
  );
}

process.stdout.write(
  "stop-guard: re-enters while the repository moves, judges no completion\n",
);
