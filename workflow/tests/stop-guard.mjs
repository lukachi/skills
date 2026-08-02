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
 * stub on PATH. That keeps every case here about the decision and none of it
 * about the collectors, which have their own tests.
 */
function workspace(report) {
  const base = mkdtempSync(join(tmpdir(), "wfctl-stop-guard-"));
  const bin = join(base, "bin");
  mkdirSync(bin, { recursive: true });
  const stub = report === undefined
    ? "#!/bin/sh\nexit 1\n"
    : `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(report)}\nJSON\n`;
  writeFileSync(join(bin, "wfctl"), stub, "utf8");
  chmodSync(join(bin, "wfctl"), 0o755);
  return { base, bin };
}

function ask(payload, report) {
  const { base, bin } = workspace(report);
  const result = spawnSync("node", [guard], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
    timeout: 30_000,
  });
  assert.equal(result.status, 0, "the guard must never fail a turn");
  return {
    decision: result.stdout.trim() ? JSON.parse(result.stdout) : undefined,
    cwd: base,
  };
}

function signal(level, awaits) {
  return {
    id: "work.active",
    domain: "work",
    level,
    summary: "A change bundle is open",
    subject: "demo",
    awaits,
  };
}

const open = { signals: [signal("attention", "agent")], capabilities: [], degraded: [] };

// Blocking is the whole point, but only when the repository says the agent
// still owns something.
assert.equal(
  ask({ last_assistant_message: "Moving on to wave 5." }, open).decision?.decision,
  "block",
  "a turn ending while attention-level work awaits the agent is re-entered",
);

// The host sets this on a continuation. Blocking again is how a Stop hook
// burns a session to its token cap.
assert.equal(
  ask({ stop_hook_active: true, last_assistant_message: "x" }, open).decision,
  undefined,
  "a continuation turn is never blocked again",
);

assert.equal(
  ask({ background_tasks: [{ id: "1" }], last_assistant_message: "x" }, open).decision,
  undefined,
  "waiting on a background task is a legitimate short turn",
);

assert.equal(
  ask({ last_assistant_message: "x" }, {
    signals: [signal("info", "agent")],
    capabilities: [],
    degraded: [],
  }).decision,
  undefined,
  "housekeeping is not work in progress: an info signal never costs a turn",
);

assert.equal(
  ask({ last_assistant_message: "x" }, {
    signals: [signal("attention", "maintainer")],
    capabilities: [],
    degraded: [],
  }).decision,
  undefined,
  "a signal awaiting the maintainer is a question for them, not a task",
);

assert.equal(
  ask({ last_assistant_message: "x" }, { signals: [], capabilities: [], degraded: [] })
    .decision,
  undefined,
  "an idle repository ends the turn",
);

assert.equal(
  ask({ last_assistant_message: "x" }, undefined).decision,
  undefined,
  "an unreadable state never traps the session",
);

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
  const long = "x".repeat(5000);
  const { decision } = ask({ last_assistant_message: long }, open);
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
  "stop-guard: re-enters an ended turn once, judges no completion\n",
);
