import { isSatisfied, renderCounterLine, shortfallFor } from "./recall.js";
import { definitionFor } from "./steps.js";
import type { FlowRecord, WorkStep } from "./types.js";

/**
 * A refusal that does not name its own remedy costs the agent a turn and
 * teaches it nothing. Every refusal in this rewrite carries the exact command
 * that clears it — the previous implementation's worst messages named the one
 * command that destroyed the record's accounting and not the one that cost
 * nothing.
 */
export class GateRefusal extends Error {
  constructor(
    message: string,
    readonly remedy: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "GateRefusal";
  }

  render(): string {
    return [this.message, this.detail, `remedy: ${this.remedy}`]
      .filter((part): part is string => Boolean(part))
      .join("\n");
  }
}

/** Steps that may not be entered until the prior one is recorded. */
const PRECONDITION: Partial<Record<WorkStep, WorkStep>> = {
  aligned: "opened",
  framed: "aligned",
  split: "framed",
  implement: "framed",
  verified: "implement",
  closed: "verified",
  promoted: "closed",
};

export function assertReached(flow: FlowRecord, step: WorkStep): void {
  const required = PRECONDITION[step];
  if (!required) return;

  const order = ["opened", "aligned", "framed", "split", "implement", "verified", "closed", "promoted"];
  if (order.indexOf(flow.step) < order.indexOf(required)) {
    const definition = definitionFor(required);
    throw new GateRefusal(
      `This flow is at ${flow.step}; ${step} needs ${required} recorded first.`,
      definition.command,
      definition.demands,
    );
  }
}

/**
 * The recall gate.
 *
 * It checks answered items, never operations performed — an operation count is
 * satisfied by one empty query, and an agent in a hurry will produce exactly
 * that. An answer can be shallow, but it cannot be absent, and shallow shows.
 */
export function assertRecall(flow: FlowRecord, step: WorkStep): void {
  const shortfall = shortfallFor(step, flow.recall);
  if (isSatisfied(shortfall)) return;

  throw new GateRefusal(
    `Recall is incomplete for ${step}.`,
    "wfctl recall answer <item> --answer \"<what you found>\" --route <qmd|graphify|grep|read|maintainer> --source \"<where>\"",
    `${renderCounterLine(step, flow.recall)}\n\nwfctl guide recall — why this checklist exists`,
  );
}

/**
 * `verified` needs a review on the record.
 *
 * Without this the adversarial round is optional: the step advances on nothing,
 * and closure follows it.
 */
export function assertReviewed(flow: FlowRecord, step: WorkStep): void {
  if (step !== "verified" && step !== "closed" && step !== "promoted") return;
  if (flow.review) return;
  throw new GateRefusal(
    "No review is on record for this work.",
    "wfctl work verify --review <artifact from a separate agent>",
    "The agent that wrote the tests can write the review that approves them, so " +
      "the review is produced elsewhere and this checks what came back.",
  );
}

export function assertNotParked(flow: FlowRecord): void {
  if (!flow.parked) return;
  throw new GateRefusal(
    `Flow ${flow.id} is parked: ${flow.parked.reason}`,
    `wfctl work release ${flow.id}`,
    "Approving a framing settles what the work is, never that it begins. The " +
      "condition that held it ending is not the same as being told to go.",
  );
}

/**
 * The handoff receipt.
 *
 * The brief prints the bound flow's handoff, but a session may start from a
 * truncated one or resume after compaction. Pointing at the handoff is the
 * branch this rewrite removes, so the gate requires that it was actually
 * fetched before anything material happens.
 */
export function assertHandoffRead(read: boolean, flowId: string): void {
  if (read) return;
  throw new GateRefusal(
    "This flow's handoff has not been read in this session.",
    `wfctl handoff ${flowId}`,
    "Resuming from conversation memory is how work is repeated and decisions are reversed.",
  );
}
