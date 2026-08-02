#!/usr/bin/env node
// PreToolUse hook: put a silence watch around every background shell command.
//
// A background command has no deadline and no stall detection, so a command
// that never finishes is simply never heard from again. The watch does not
// judge the command; it reports silence so the agent can check. Foreground
// commands are left alone — they carry their own limit.
//
// This runs before every tool call, so it must never fail and never block:
// any unexpected input produces no decision and the call proceeds unchanged.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "idle-guard.sh");
const IDLE_SECONDS = process.env.WFCTL_IDLE_GUARD_SECONDS || "600";

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  if (payload?.tool_name !== "Bash") {
    return;
  }
  const input = payload.tool_input;
  if (!input || input.run_in_background !== true) {
    return;
  }
  const command = typeof input.command === "string" ? input.command : "";
  if (!command.trim() || command.includes("idle-guard.sh")) {
    return;
  }

  process.stdout.write(`${
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: {
          ...input,
          command: `IDLE=${IDLE_SECONDS} bash ${shellQuote(GUARD)} --shell ${
            shellQuote(command)
          }`,
        },
      },
    })
  }\n`);
}

try {
  main();
} catch {
  // A hook that fails is worse than a hook that abstains.
}
process.exit(0);
