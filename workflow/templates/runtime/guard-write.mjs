#!/usr/bin/env node
// PreToolUse hook for Edit and Write.
//
// This is the only mechanism that reaches an agent which never runs a command.
// The CLI can only instruct at its own call sites, so an agent that skips
// straight to editing is untouched by everything else — the edit itself has to
// be the call site.
//
// It does not fire on every edit. Firing per edit would slow the work to
// nothing and be ignored within the hour. It fires when the ground changes: the
// first write of a unit, and afterwards only when a file is touched that no
// traversal or query has covered.
import { spawnSync } from "node:child_process";

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

const target = input?.tool_input?.file_path ?? input?.tool_input?.path;
if (!target) process.exit(0);

const result = spawnSync("wfctl", ["hook", "write", "--target", target], {
  encoding: "utf8",
  cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
});

// A missing or broken wfctl must never block an edit. The guard reports; it
// does not own whether work can proceed.
if (result.error || result.status === null) process.exit(0);

const text = (result.stdout ?? "").trim();
if (!text) process.exit(0);

if (result.status === 2) {
  process.stderr.write(text);
  process.exit(2);
}

process.stdout.write(text);
process.exit(0);
