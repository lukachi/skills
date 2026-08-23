import { deriveBlocker } from "./steps.js";
import type { Checkpoint, FlowRecord } from "./types.js";

/**
 * Checkpoint, brief and handoff are one thing under one name.
 *
 * They were three nouns before, and nobody could say which did what. The
 * maintainer had to ask for "the brief and the handoff"; the agent wrote one
 * and not the other. There is now a single act — `wfctl checkpoint` — and two
 * renderings of its result: the brief is the index, the handoff is the body.
 */
export interface CheckpointInput {
  summary: string;
  handoff: string;
  lastAction: string;
  nextAction: string;
  actor: string;
  todo?: string[];
}

export class CheckpointError extends Error {
  constructor(
    message: string,
    readonly remedy: string,
  ) {
    super(message);
    this.name = "CheckpointError";
  }
}

export function buildCheckpoint(input: CheckpointInput, now = new Date()): Checkpoint {
  for (const [field, value] of Object.entries({
    summary: input.summary,
    handoff: input.handoff,
    lastAction: input.lastAction,
    nextAction: input.nextAction,
  })) {
    if (!value || value.trim().length === 0) {
      throw new CheckpointError(
        `A checkpoint needs ${field}; an empty one recalls nothing.`,
        `wfctl checkpoint --${field.toLowerCase()} "<...>"`,
      );
    }
  }

  return {
    summary: input.summary.trim(),
    handoff: input.handoff.trim(),
    lastAction: input.lastAction.trim(),
    nextAction: input.nextAction.trim(),
    actor: input.actor,
    updatedAt: now.toISOString(),
    todo: input.todo ?? [],
  };
}

/**
 * The brief, as the session-start hook emits it.
 *
 * The bound flow's handoff is printed in full and every other flow gets one
 * line. That asymmetry is the whole design: a brief that grew with the number
 * of open records used to be truncated by the host, and a truncated brief reads
 * exactly like a complete one while carrying a fraction of the state. Only the
 * flow in hand can be long, and there is only ever one of those.
 */
export function renderBrief(flows: FlowRecord[], currentId: string | undefined): string {
  const open = flows.filter((flow) => !flow.closedAt);
  if (open.length === 0) {
    return [
      "No flow is open.",
      "",
      "Start one explicitly when the maintainer asks for work:",
      "  wfctl work start --title \"<what this is>\"",
      "  wfctl reconstruct start --title \"<what this is>\"",
    ].join("\n");
  }

  const lines: string[] = [];
  const current = open.find((flow) => flow.id === currentId);

  if (current) {
    lines.push(`flow ${current.id}  ·  ${current.kind}  ·  step ${current.step}`);
    lines.push(current.title);
    lines.push("");
    if (current.checkpoint) {
      lines.push(current.checkpoint.handoff);
      lines.push("");
      lines.push(`last: ${current.checkpoint.lastAction}`);
      lines.push(`next: ${current.checkpoint.nextAction}`);
      if (current.checkpoint.todo.length > 0) {
        lines.push("todo:");
        for (const item of current.checkpoint.todo) lines.push(`  - ${item}`);
      }
    } else {
      lines.push("No checkpoint yet. Write one before this session does anything material.");
    }

    const blocker = deriveBlocker(current);
    if (blocker) {
      lines.push("");
      lines.push(`awaits ${blocker.awaits}: ${blocker.summary}`);
      lines.push(`remedy: ${blocker.remedy}`);
    }
  }

  const others = open.filter((flow) => flow.id !== currentId);
  if (others.length > 0) {
    lines.push("");
    lines.push("other open flows:");
    for (const flow of others) {
      const summary = flow.checkpoint?.summary ?? "no checkpoint";
      lines.push(`  ${flow.id}  ·  ${flow.step}  ·  ${summary}`);
    }
  }

  return lines.join("\n");
}

/**
 * The handoff on its own, for the receipt the next command requires.
 *
 * Pointing an agent at a file it should read is the branch this rewrite exists
 * to remove, so the handoff is never merely referenced: it is either printed by
 * the brief or fetched by this, and the gate checks that it was fetched.
 */
export function renderHandoff(flow: FlowRecord): string {
  if (!flow.checkpoint) {
    return `Flow ${flow.id} has no checkpoint.`;
  }
  return [
    `flow ${flow.id}  ·  step ${flow.step}`,
    "",
    flow.checkpoint.handoff,
    "",
    `last: ${flow.checkpoint.lastAction}`,
    `next: ${flow.checkpoint.nextAction}`,
    `actor: ${flow.checkpoint.actor}   updated: ${flow.checkpoint.updatedAt}`,
  ].join("\n");
}
