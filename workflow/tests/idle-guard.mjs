import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guard = join(root, "templates/runtime/idle-guard.sh");
const hook = join(root, "templates/runtime/guard-background-bash.mjs");

function runGuard(command, idle) {
  return spawnSync("bash", [guard, "--shell", command], {
    encoding: "utf8",
    env: { ...process.env, IDLE: String(idle), IDLE_GUARD_POLL: "1" },
    timeout: 60_000,
  });
}

function askHook(payload) {
  const result = spawnSync("node", [hook], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, "the hook must never fail a tool call");
  return result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
}

// A talkative command is healthy however long it runs, and its exit code is the
// caller's answer, not the guard's.
const talkative = runGuard(
  'for i in 1 2 3 4 5; do echo "step $i"; sleep 1; done; exit 7',
  3,
);
assert.equal(talkative.status, 7, "the guard must not swallow the exit code");
assert.match(talkative.stdout, /step 5/);
assert.doesNotMatch(talkative.stderr, /no output for/);

// The watch must not tax a command that finishes immediately.
const started = Date.now();
const quick = runGuard("echo hi", 600);
assert.equal(quick.status, 0);
assert.ok(
  Date.now() - started < 1500,
  `a fast command must not wait on the watch (took ${Date.now() - started}ms)`,
);

// I/O-bound work consumes almost no CPU while progressing normally, so a CPU
// stall must never be a trigger on its own.
const chatty = runGuard("for i in 1 2 3 4 5 6; do echo tick; sleep 1; done", 3);
assert.equal(chatty.status, 0, "a low-CPU command that keeps reporting is healthy");
assert.doesNotMatch(chatty.stderr, /idle-guard:/);

// A silent command is reported, never judged, and keeps running.
const silent = runGuard("sleep 45", 3);
assert.equal(silent.status, 125);
assert.match(silent.stderr, /no output for \d+s/);
assert.match(silent.stderr, /prompt to check, not a verdict/);
assert.match(silent.stderr, /still running, untouched/);
assert.match(silent.stderr, /Do NOT kill or restart on this/);
assert.match(silent.stderr, /re-arm : IDLE=/, "a one-shot watch would go blind after the first report");
assert.match(silent.stderr, /cpu/, "the report must carry the waiting-versus-working evidence");

const reportedPid = /pid *: (\d+)/.exec(silent.stderr)?.[1];
assert.ok(reportedPid, "the report must name the process it is about");
execFileSync("kill", ["-KILL", reportedPid], { stdio: "ignore" });

// The hook wraps background commands only, and never twice.
const wrapped = askHook({
  tool_name: "Bash",
  tool_input: { command: "python3 work.py", run_in_background: true },
});
assert.match(
  wrapped.hookSpecificOutput.updatedInput.command,
  /idle-guard\.sh' --shell 'python3 work\.py'/,
);
assert.equal(wrapped.hookSpecificOutput.permissionDecision, "allow");

// Foreground commands are wrapped too: the host promotes one to the background
// once it runs long enough, and the watch has to already be in place by then.
const foreground = askHook({ tool_name: "Bash", tool_input: { command: "ls" } });
assert.match(foreground.hookSpecificOutput.updatedInput.command, /idle-guard\.sh' --shell 'ls'/);
assert.equal(
  askHook({
    tool_name: "Bash",
    tool_input: {
      command: "IDLE=600 bash /x/idle-guard.sh --shell 'ls'",
      run_in_background: true,
    },
  }),
  undefined,
  "an already watched command must not be wrapped again",
);
assert.equal(
  askHook({ tool_name: "Read", tool_input: { file_path: "/x" } }),
  undefined,
);

// Quoting must survive a command that contains quotes, or the wrapper corrupts
// the work it is supposed to watch.
const quoted = askHook({
  tool_name: "Bash",
  tool_input: { command: `echo 'it'"'"'s here'`, run_in_background: true },
});
const executed = spawnSync("bash", ["-c", quoted.hookSpecificOutput.updatedInput.command], {
  encoding: "utf8",
  env: { ...process.env, IDLE: "30" },
  timeout: 30_000,
});
assert.match(executed.stdout, /it's here/);

// Malformed input must abstain rather than break every shell call.
const garbage = spawnSync("node", [hook], { input: "not json", encoding: "utf8" });
assert.equal(garbage.status, 0);
assert.equal(garbage.stdout.trim(), "");

process.stdout.write("idle-guard: reports silence, judges nothing, watches every shell command\n");
