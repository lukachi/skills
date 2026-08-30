#!/usr/bin/env node
// PreToolUse hook for the tools that write files — the host's editing tools,
// and the shell.
//
// This is the only mechanism that reaches an agent which never runs a command.
// The CLI can only instruct at its own call sites, so an agent that skips
// straight to editing is untouched by everything else — the edit itself has to
// be the call site.
//
// It watches the shell for the same reason. Matching only `Edit|Write` was an
// assumption about how agents write files, and one session broke it completely:
// 606 tool calls, none of them an edit, 179 files written through `cat > x.ts`
// and `python3 - <<PY`. Every refusal this guard carries — a curated page
// written by hand, a record fabricated into the promotion queue — was
// unenforced for anything that went through a heredoc.
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
import { resolve } from "node:path";
import {
  projectDir,
  readPayload,
  shellCommand,
  shellBaseDir,
  shellWriteTargets,
  writeTargets,
} from "./hook-input.mjs";

const payload = readPayload();
/**
 * A shell command's targets are read relative to where the command runs, which
 * is nearly always a `cd` into a leaf checkout rather than the knowledge
 * repository. Resolving them against the wrong root put the guard's answer in
 * the wrong repository.
 */
const named = writeTargets(payload);
const shell = named.length > 0 ? [] : shellWriteTargets(payload);
const targets = named.length > 0 ? named : shell;

/**
 * A wfctl call with both streams thrown away.
 *
 * The whole design says the tool instructs at its own call sites, and in one
 * session 35 of 58 wfctl calls ended in `>/dev/null 2>&1` — added for tidiness,
 * and it switched the entire channel off. Every next action, remedy and counter
 * went to the bin, and nothing anywhere reported that it had.
 *
 * This is the one place that can say so, because a hook's output is not the
 * command's to redirect. It fires only on total silence: discarding stdout
 * while keeping stderr still leaves every refusal readable, and that is a
 * reasonable thing to do.
 */
const silenced = /\bwfctl\b[^\n;|&]*?(?:>\s*\/dev\/null\s*2>&1|&>\s*\/dev\/null|2>&1\s*>\s*\/dev\/null)/.test(
  shellCommand(payload),
);
if (silenced) {
  process.stdout.write(
    [
      "[wfctl] that call discards everything the tool says back.",
      "",
      "wfctl answers at its call sites — the next action, the remedy, what the",
      "state now demands. `>/dev/null 2>&1` is the whole channel. Drop the",
      "redirect, or keep stderr so refusals still reach you.",
    ].join("\n"),
  );
}

if (targets.length === 0) process.exit(0);

// Pass what has already been written this unit, so the guard can go quiet on
// known ground. Without it every edit was a "first write" and re-emitted the
// whole implement page.
const written = process.env.WFCTL_WRITTEN ? process.env.WFCTL_WRITTEN.split(":") : [];
const cwd = projectDir(payload);

/**
 * wfctl is always run from the knowledge repository; only the target is made
 * absolute against where the shell command runs.
 *
 * Spawning it in the leaf instead was the first attempt and it cannot work —
 * wfctl resolves its records from the directory it starts in, so a guard that
 * ran it inside a checkout would ask a repository that holds no flow.
 */
const base = shell.length > 0 ? shellBaseDir(payload, cwd) : cwd;
const located = targets.map((target) => (target.startsWith("/") ? target : resolve(base, target)));

const notices = [];

for (const target of located) {
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
