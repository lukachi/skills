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
//
// One tool call may write several files — a patch names each one — so every
// target is checked and the first refusal is the answer. Checking only the
// first would let a patch pass a harmless file and carry a curated page in
// behind it.
import { spawnSync } from "node:child_process";
import { projectDir, readPayload, writeTargets } from "./hook-input.mjs";

const payload = readPayload();
const targets = writeTargets(payload);
if (targets.length === 0) process.exit(0);

// Pass what has already been written this unit, so the guard can go quiet on
// known ground. Without it every edit was a "first write" and re-emitted the
// whole implement page.
const written = process.env.WFCTL_WRITTEN ? process.env.WFCTL_WRITTEN.split(":") : [];
const cwd = projectDir(payload);

const notices = [];

for (const target of targets) {
  const result = spawnSync(
    "wfctl",
    ["hook", "write", "--target", target, ...written.flatMap((path) => ["--written", path])],
    { encoding: "utf8", cwd },
  );

  // A missing or broken wfctl must never block an edit. The guard reports; it
  // does not own whether work can proceed.
  //
  // Only spawn errors were treated as "broken" before, so any wfctl that exited 2
  // for its own reasons — not installed properly, a module it could not find —
  // denied the edit. Exit 2 is trusted as a refusal only when the output looks
  // like one, which is what a real refusal always carries.
  if (result.error || result.status === null) continue;

  const text = (result.stdout ?? "").trim();
  if (!text) continue;

  if (result.status === 2 && /^remedy:/m.test(text)) {
    process.stderr.write(text);
    process.exit(2);
  }

  if (result.status !== 0) continue;
  notices.push(text);
}

if (notices.length > 0) process.stdout.write(notices.join("\n\n"));
process.exit(0);
