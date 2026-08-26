import { isSatisfied, renderCounterLine, shortfallFor } from "./recall.js";
import { definitionFor } from "./steps.js";
import { WORK_STEPS, type FlowRecord, type WorkStep } from "./types.js";

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

    /**
     * A blank remedy is a bug, and it must fail here rather than reach an agent.
     *
     * The paragraph above is a rule the type system cannot hold: `remedy` is a
     * string, and `""` is a string. A refusal that renders `remedy:` with
     * nothing after it is the exact failure this class was written to prevent,
     * and it would ship looking like a working refusal.
     *
     * Codex refuses a hook decision of `block` that carries no reason, which is
     * the same rule one layer out. Ours was prose; this makes it a check.
     */
    if (!remedy.trim()) {
      throw new Error(`A refusal must name the command that clears it: ${message}`);
    }
  }

  render(): string {
    return [this.message, this.detail, `remedy: ${this.remedy}`]
      .filter((part): part is string => Boolean(part))
      .join("\n");
  }
}

/** Steps that may not be entered until the prior one is recorded. */
const PRECONDITION: Partial<Record<WorkStep, WorkStep>> = {
  framed: "opened",
  verified: "framed",
  closed: "verified",
  promoted: "closed",
};

export function assertReached(flow: FlowRecord, step: WorkStep): void {
  const required = PRECONDITION[step];
  if (!required) return;

  const order: readonly string[] = WORK_STEPS;
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
    'wfctl work release --attested "<what they said>"',
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
/**
 * A step does not advance on a checkpoint describing an earlier one.
 *
 * The checkpoint was rendered and never enforced: `grep` for it found render
 * sites and one delete, and no refusal, gate or exit code depended on one
 * existing. A whole flow ran start to promote with `checkpoint: None`, and
 * across five hundred lines of output the tool never once printed the command
 * that would have fixed it — it appeared only as prose inside guidance, which
 * is the delivery this rewrite exists to replace.
 *
 * The check is staleness rather than existence, because a checkpoint written at
 * `opened` and left there is what a fresh session then acts on: its `next:`
 * names a step already passed, and following it literally hits a refusal that
 * cannot clear. So each step wants a checkpoint written since the last one was
 * recorded.
 */
export function assertCheckpointCurrent(flow: FlowRecord, step: WorkStep): void {
  /**
   * Re-recording the step the flow is already on asks for nothing.
   *
   * It moves nothing, so demanding a fresh checkpoint for it recreates the loop
   * this gate's own history describes: the stamp restarts the clock, the only
   * way out is another checkpoint, and the next re-run invalidates that one
   * too. A real session spent nine attempts inside it.
   */
  if (flow.step === step) return;
  /**
   * Nothing is exempt any more.
   *
   * `aligned` was, because opening a flow cannot require a checkpoint of the
   * flow it is opening. `framed` inherits its position and not its exemption:
   * by the time framing is recorded, the agent has read the corpus and settled
   * a contract with the maintainer, and "write down what you found before I
   * record this" is exactly what that moment is worth.
   */
  const checkpoint = flow.checkpoint;
  if (!checkpoint) {
    throw new GateRefusal(
      `This flow has no checkpoint, and ${step} is not reachable without one.`,
      'wfctl checkpoint "<what has happened since>"',
      "The checkpoint is the only thing a session that is not this one recovers " +
        "from. Work whose state lives in a conversation is lost with the " +
        "conversation, and nothing reports that it was.",
    );
  }
  if (checkpoint.updatedAt < (flow.steppedAt ?? "")) {
    throw new GateRefusal(
      `The checkpoint predates this flow reaching ${flow.step}.`,
      'wfctl checkpoint "<what has happened since>"',
      `It was written at ${checkpoint.updatedAt} and says the next action is ` +
        `"${checkpoint.nextAction}". A session resuming here would act on that.`,
    );
  }
}

/**
 * There is no handoff receipt, and there was never a working one.
 *
 * `assertHandoffRead` lived here with no call site, and `CommandContext` carried
 * a `handoffRead` field nothing set or read, while `checkpoint.ts` stated as
 * fact that "the gate checks that it was fetched". Dead code shaped exactly
 * like a guarantee is worse than an absent one: it is the thing a reader stops
 * worrying about.
 *
 * It cannot be built as the tool stands. Every `wfctl` invocation is its own
 * process and none of them is told which session it belongs to, so a receipt on
 * disk could only answer "has anyone, ever, run `wfctl handoff`" — which is not
 * the question. The question is whether *this* session received the body, and
 * answering it needs a session identifier the CLI is never given.
 *
 * What actually made the handoff go missing was mechanical, and is fixed: the
 * brief was truncated at 64KB whenever its output was piped, which is exactly
 * how the session-start hook runs it. A receipt would have caught the symptom
 * of that and hidden the cause.
 */

