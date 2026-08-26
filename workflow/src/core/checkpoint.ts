import { GateRefusal } from "./gates.js";
import { summariseKit } from "./kit.js";
import { deriveBlocker } from "./steps.js";
import type { Checkpoint, FlowRecord, Note } from "./types.js";

/**
 * Checkpoint, brief and handoff are one thing under one name.
 *
 * They were three nouns before, and nobody could say which did what. The
 * maintainer had to ask for "the brief and the handoff"; the agent wrote one
 * and not the other. There is now a single act — `wfctl checkpoint` — and two
 * renderings of its result: the brief is the index, the handoff is the body.
 */
export interface CheckpointInput {
  summary?: string | undefined;
  handoff?: string | undefined;
  lastAction?: string | undefined;
  nextAction?: string | undefined;
  actor: string;
  todo?: string[] | undefined;
}

/**
 * A checkpoint problem is a refusal like any other.
 *
 * It was its own error class, which the command layer's handler did not catch,
 * so a missing field surfaced as a stack trace — and the remedy it carried
 * named `--nextaction`, a flag the parser has never accepted.
 */
export class CheckpointError extends GateRefusal {}

/**
 * Text that cannot forge the lines around it.
 *
 * `renderBrief` and `renderHandoff` join fields with newlines, so a body
 * carrying its own `last:` / `next:` / `awaits maintainer:` lines produced a
 * second, counterfeit trailer — printed *above* the real one, under the brief's
 * own claim that the state above is authoritative. A reader scanning for
 * `next:` acts on the first match.
 *
 * This is not far-fetched. A handoff that quotes an error, a review finding or
 * the previous brief — all natural things to record — produces it by accident.
 *
 * Single-line fields lose their newlines outright. The body keeps its shape,
 * because a handoff that cannot hold a paragraph is not a handoff, so its lines
 * are prefixed instead: indented text cannot be mistaken for the tool's own.
 * Control characters go in every case; an ANSI escape in a session brief can
 * clear the screen the state was printed on.
 */
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/**
 * Characters that occupy no space and say nothing.
 *
 * `String.trim` does not strip U+200B, so a checkpoint of four zero-width
 * spaces passed the "an empty one recalls nothing" gate, rendered as blank
 * `last:` and `next:` lines, and permanently silenced the brief's "No
 * checkpoint yet" — the only prompt in the system. It reads as a checkpoint
 * that happens to be blank rather than one that was faked.
 */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g;

/** Whether a field carries anything a reader could act on. */
export function meaningful(value: string): boolean {
  return value.replace(INVISIBLE, "").replace(CONTROL, "").trim().length > 0;
}

function oneLine(value: string): string {
  return value.replace(CONTROL, "").replace(/\s*\n+\s*/g, " ").trim();
}

export function fenceBody(value: string): string {
  return value
    .replace(CONTROL, "")
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : `  ${line}`))
    .join("\n");
}

/**
 * A field the caller did not name keeps what it had.
 *
 * All four were required, so correcting the next action meant retyping the
 * handoff — and a tool that charges four fields for a one-word correction gets
 * used at the end of a session instead of during it. Absence now means "leave
 * it", which is what an agent updating one thing actually means.
 */
function carry(next: string | undefined, previous: string | undefined): string {
  if (next !== undefined && meaningful(next)) return next;
  return previous ?? "";
}

/**
 * Build the head checkpoint, on top of whatever the last one said.
 *
 * Nothing here is mandatory any more. A checkpoint that records only what just
 * happened is a real checkpoint, and refusing it taught the agent that
 * checkpointing is expensive — which is the opposite of the habit this tool
 * exists to produce. What is missing is shown by the brief instead, where it
 * costs a reader nothing and blocks no one.
 */
export function buildCheckpoint(
  input: CheckpointInput,
  previous?: Checkpoint,
  now = new Date(),
): Checkpoint {
  return {
    summary: oneLine(carry(input.summary, previous?.summary)),
    handoff: carry(input.handoff, previous?.handoff).replace(CONTROL, "").trim(),
    lastAction: oneLine(carry(input.lastAction, previous?.lastAction)),
    nextAction: oneLine(carry(input.nextAction, previous?.nextAction)),
    actor: oneLine(input.actor),
    updatedAt: now.toISOString(),
    /**
     * Carried unless this call names its own.
     *
     * `todo` was replaced wholesale, so the second checkpoint of a session
     * deleted the jobs the first had recorded — and checkpointing often is the
     * thing this workflow asks for most. Doing it correctly was what lost them.
     */
    todo:
      input.todo && input.todo.length > 0
        ? input.todo.map(oneLine).filter((item) => item.length > 0)
        : (previous?.todo ?? []),
  };
}

/** A note is anything at all, so the only thing refused is nothing at all. */
export function buildNote(
  text: string,
  actor: string,
  about?: string | undefined,
  now = new Date(),
): Note {
  if (!meaningful(text)) {
    throw new CheckpointError(
      "A note with nothing in it recalls nothing.",
      'wfctl checkpoint "<what you want to remember>"',
    );
  }
  const note: Note = {
    at: now.toISOString(),
    actor: oneLine(actor),
    text: text.replace(CONTROL, "").trim(),
  };
  if (about && meaningful(about)) note.about = oneLine(about);
  return note;
}

/**
 * How long the work has gone unrecorded, in words.
 *
 * This is the whole mechanism for the habit, and it is deliberately not a gate.
 * An agent that is shown the drift writes; an agent that is refused learns to
 * avoid the command that refuses it.
 */
export function driftLine(since: string | undefined, now = new Date()): string | undefined {
  /**
   * Silence when there is nothing to be behind on.
   *
   * An earlier version fired the moment a flow existed, so the first command
   * after `work start` was already being told it had written nothing — which is
   * true and useless, and a warning that is always on is a warning nobody
   * reads. The caller passes the flow's own age when nothing has been written,
   * so the gap is measured from the same place either way.
   */
  if (!since) return undefined;
  const minutes = Math.floor((now.getTime() - new Date(since).getTime()) / 60000);
  if (Number.isNaN(minutes) || minutes < 20) return undefined;
  if (minutes < 120) return `${minutes} minutes since anything was written down`;
  return `${Math.floor(minutes / 60)} hours since anything was written down`;
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
export interface BriefExtras {
  /** Records waiting on the maintainer's promotion decision. */
  queued?: string[];
  /** Captures marked as needing them. */
  awaitingCaptures?: number;
  /** An open reconstruction, which is not a flow and was invisible here. */
  reconstruction?: { id: string; stage: string };
  /** Flow records that cannot be parsed, named rather than silently absent. */
  unreadable?: { id: string; problem: string }[];
  /**
   * Bundles no flow holds.
   *
   * The brief reported the promotion queue and the capture inbox and never
   * these, so a repository could hold four bundles nothing could reach and say
   * "No flow is open" — the tool unable to report that work had been stranded,
   * which is why nobody noticed the flow could not bind one.
   */
  stranded?: string[];
}

/**
 * The most recent moment anything was written down — or, failing that, the
 * moment the flow opened.
 *
 * Opening counts because the question this answers is "how long has this been
 * running with nothing recorded", and a flow that has just started is not
 * behind on anything.
 */
export function lastWritten(flow: FlowRecord): string | undefined {
  const stamps = [
    flow.createdAt,
    flow.checkpoint?.updatedAt,
    ...(flow.notes ?? []).map((note) => note.at),
    ...(flow.findings ?? []).map((finding) => finding.at),
    ...(flow.artifacts ?? []).map((artifact) => artifact.at),
  ].filter((value): value is string => Boolean(value));
  if (stamps.length === 0) return undefined;
  return stamps.sort().at(-1);
}

export function renderBrief(
  flows: FlowRecord[],
  currentId: string | undefined,
  extras: BriefExtras = {},
): string {
  const open = flows.filter((flow) => !flow.closedAt);

  /**
   * Everything awaiting somebody, not only the pointed-at flow.
   *
   * The brief reported "No flow is open" while a record sat in the promotion
   * queue and a capture waited on the maintainer — and its own text promises to
   * mark what awaits them. What it omits, nobody sees.
   */
  const waiting: string[] = [];
  if (extras.reconstruction) {
    waiting.push(
      `reconstruction ${extras.reconstruction.id} · stage ${extras.reconstruction.stage}` +
        `\n  awaits agent: wfctl reconstruct status`,
    );
  }
  for (const id of extras.queued ?? []) {
    waiting.push(
      `${id} waits in the promotion queue` +
        `\n  awaits maintainer: what the project now says about itself` +
        `\n  remedy: wfctl work promote --subject "<product subject>" --summary "<what it now does>"`,
    );
  }
  if (extras.awaitingCaptures) {
    waiting.push(
      `${extras.awaitingCaptures} capture(s) await the maintainer` +
        `\n  remedy: put them one decision at a time, not as a backlog`,
    );
  }
  for (const broken of extras.unreadable ?? []) {
    waiting.push(
      `${broken.id} cannot be read: ${broken.problem}` +
        `\n  awaits agent: repair .workflow/flows/${broken.id}.json` +
        `\n  remedy: open that file — a record left with merge-conflict markers is the usual cause`,
    );
  }
  for (const id of extras.stranded ?? []) {
    waiting.push(
      `${id} has no flow, so nothing can reach it` +
        `\n  awaits maintainer: whether this work resumes at all` +
        `\n  remedy: wfctl work adopt ${id} --weight <significant|lightweight> --attested "<what they said>"`,
    );
  }

  if (open.length === 0) {
    return [
      "No flow is open.",
      ...(waiting.length > 0 ? ["", ...waiting] : []),
      "",
      "Nothing here holds session state, because state belongs to a flow. If you",
      "are resuming work, it is one of the bundles above; if you are starting it,",
      "open the fence first and checkpoint inside it.",
      "",
      "Start one explicitly when the maintainer asks for work, and record what",
      "they said — a bundle exists because they asked for it:",
      '  wfctl work start --title "<what this is>" --weight <significant|lightweight> \\',
      '    --attested "<what they said>"',
      "  wfctl reconstruct start",
    ].join("\n");
  }

  const lines: string[] = [];
  const current = open.find((flow) => flow.id === currentId);

  if (current) {
    lines.push(`flow ${current.id}  ·  ${current.kind}  ·  step ${current.step}`);
    lines.push(current.title);
    lines.push("");
    if (current.checkpoint) {
      if (current.checkpoint.handoff) {
        lines.push(fenceBody(current.checkpoint.handoff));
        lines.push("");
      }
      /**
       * A field nobody filled says so, and names the one flag that fills it.
       *
       * Printing an empty `next:` was worse than printing nothing: it reads as
       * a next action that happens to be blank rather than one never recorded,
       * and it is the line recovery depends on most.
       */
      lines.push(
        current.checkpoint.lastAction
          ? `last: ${current.checkpoint.lastAction}`
          : 'last: not recorded   ·   wfctl checkpoint --last "<what you just finished>"',
      );
      lines.push(
        current.checkpoint.nextAction
          ? `next: ${current.checkpoint.nextAction}`
          : 'next: not recorded   ·   wfctl checkpoint --next "<the exact next action>"',
      );
      if (current.checkpoint.todo.length > 0) {
        lines.push("todo:");
        for (const item of current.checkpoint.todo) lines.push(`  - ${item}`);
      }
    } else {
      lines.push("Nothing written down for this flow yet.");
      lines.push('  wfctl checkpoint "<whatever you would not want to look up again>"');
    }

    /**
     * What the work found, produced and wrote down — the parts of the record
     * that are not the four checkpoint fields.
     *
     * The brief used to render a paragraph and a step, so everything else the
     * session knew lived in the conversation and died with it. These are
     * indexes, not contents: the counts and the openings, with the command that
     * reads the rest.
     */
    const equipped = summariseKit(current.kit ?? []);
    if (equipped) {
      lines.push("");
      lines.push(equipped);
    }

    const openFindings = (current.findings ?? []).filter((finding) => finding.status === "open");
    if (openFindings.length > 0) {
      lines.push("");
      lines.push(`findings, ${openFindings.length} open and this work's to settle:`);
      for (const finding of openFindings.slice(0, 5)) {
        lines.push(`  ${finding.id}  ${finding.what}`);
      }
      if (openFindings.length > 5) lines.push(`  … ${openFindings.length - 5} more: wfctl finding list`);
    }

    const standing = (current.artifacts ?? []).filter((artifact) => !artifact.supersededBy);
    if (standing.length > 0) {
      lines.push("");
      lines.push("artifacts this work stands on:");
      for (const artifact of standing.slice(0, 6)) {
        lines.push(`  ${artifact.path}`);
        lines.push(`    ${artifact.what}`);
      }
      if (standing.length > 6) lines.push(`  … ${standing.length - 6} more: wfctl artifact list`);
    }

    const notes = current.notes ?? [];
    if (notes.length > 0) {
      lines.push("");
      lines.push(`written down, ${notes.length} note(s), most recent last:`);
      for (const note of notes.slice(-4)) {
        lines.push(fenceBody(note.text));
      }
      if (notes.length > 4) lines.push(`  … all of them: wfctl notes`);
    }

    const drift = driftLine(lastWritten(current));
    if (drift) {
      lines.push("");
      lines.push(`⚠ ${drift}.`);
      lines.push('  wfctl checkpoint "<what has happened since>"');
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
      lines.push(`    close it with: wfctl flow close ${flow.id}`);
    }
  }

  if (waiting.length > 0) {
    lines.push("");
    lines.push(...waiting);
  }

  return lines.join("\n");
}

/**
 * The handoff on its own, for the receipt the next command requires.
 *
 * Pointing an agent at a file it should read is the branch this rewrite exists
 * to remove, so the handoff is never merely referenced: it is either printed by
 * the brief or fetched by this.
 *
 * Nothing verifies that it was received. This comment used to claim a gate
 * checked that, and no such gate was ever called — see `gates.ts` for why one
 * cannot be built without a session identifier.
 */
export function renderHandoff(flow: FlowRecord): string {
  if (!flow.checkpoint) {
    return `Flow ${flow.id} has no checkpoint.`;
  }
  return [
    `flow ${flow.id}  ·  step ${flow.step}`,
    "",
    fenceBody(flow.checkpoint.handoff),
    "",
    `last: ${flow.checkpoint.lastAction}`,
    `next: ${flow.checkpoint.nextAction}`,
    `actor: ${flow.checkpoint.actor}   updated: ${flow.checkpoint.updatedAt}`,
  ].join("\n");
}
