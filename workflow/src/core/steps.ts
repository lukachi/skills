import { isSatisfied, renderCounterLine, shortfallFor } from "./recall.js";
import type { FlowRecord, WorkStep } from "./types.js";
import { WORK_STEPS } from "./types.js";

/**
 * The `work` state machine.
 *
 * The agent is never asked to know this sequence. Each step emits what the next
 * one needs, and the next one refuses until it exists, so missing a step is not
 * something you can do by not knowing about it — it is a refusal you cannot get
 * past. Knowledge of the flow stops being a requirement for following it.
 */
export interface StepDefinition {
  step: WorkStep;
  /** What the agent must settle here, in the maintainer's terms. */
  demands: string;
  /** The command that records it. */
  command: string;
  /** Whether the step may be skipped, and when. */
  optionalWhen?: (flow: FlowRecord) => boolean;
}

export const WORK_STEP_DEFINITIONS: readonly StepDefinition[] = [
  {
    step: "opened",
    demands:
      "Whether this work is significant or lightweight. Significant work changes behaviour, " +
      "meaning, contracts, data, or operations; lightweight work is local and preserves both " +
      "behaviour and contracts. Put the distinction to the maintainer in your own words — do " +
      "not read this out, and do not decide it yourself.",
    command: "wfctl work start --title \"<what this is>\" --weight <significant|lightweight>",
  },
  {
    step: "aligned",
    demands:
      "What the project already says about this subject. If nothing is written yet, record " +
      "that nothing covers it — an empty corpus passes a conflict check silently, and that " +
      "reads exactly like a check that found nothing wrong.",
    command: "wfctl work step aligned",
  },
  {
    step: "framed",
    demands:
      "What the work is: the outcome, the boundary, and the acceptance criteria. This is the " +
      "cheapest moment to change the scope and the last one where it is free.",
    command: "wfctl work step framed",
  },
  {
    step: "split",
    demands:
      "The units of delivery, sized by scope and coherence. Not by what fits in a session — " +
      "that framing made agents stop halfway through a context that was still wide open.",
    command: "wfctl work issue create --title \"<what it delivers>\"",
    optionalWhen: (flow) => flow.weight === "lightweight",
  },
  {
    step: "implement",
    demands: "One slice at a time, in the checkout the claim binds.",
    command: "wfctl work issue claim <id> --repository <owner/name>",
  },
  {
    step: "verified",
    demands:
      "An adversarial review, run by a separate agent, whose every attack is an executable " +
      "test. You cannot run it yourself: the agent that wrote the tests can write the review " +
      "that approves them.",
    command: "wfctl work verify --review <artifact>",
  },
  {
    step: "closed",
    demands:
      "Nothing from anybody. Every part of 'is this done' is already answered by the checks, " +
      "and asking the maintainer to confirm arithmetic is not a decision.",
    command: "wfctl work close --outcome <completed|partial|abandoned>",
  },
  {
    step: "promoted",
    demands:
      "What the project now says about itself. This one is the maintainer's, and it is the " +
      "second and last thing they are asked.",
    command: "wfctl work promote --subject \"<product subject>\" --summary \"<what it now does>\"",
  },
];

export function definitionFor(step: WorkStep): StepDefinition {
  const found = WORK_STEP_DEFINITIONS.find((definition) => definition.step === step);
  if (!found) throw new Error(`Unknown step ${step}`);
  return found;
}

export function nextStep(step: WorkStep): WorkStep | undefined {
  const index = WORK_STEPS.indexOf(step);
  return index >= 0 ? WORK_STEPS[index + 1] : undefined;
}

/**
 * A blocker is derived, never stored.
 *
 * Where the flow stands in this sequence *is* the blocker: a flow at `framed`
 * with no approval is waiting on the maintainer, and no field has to say so. A
 * stored blocker is a sentence that was true once and stays in the record after
 * it stops being true, which is how a repository ends up reporting work that
 * finished days ago.
 */
export interface DerivedBlocker {
  step: WorkStep;
  awaits: "maintainer" | "agent";
  summary: string;
  remedy: string;
}

export function deriveBlocker(flow: FlowRecord): DerivedBlocker | undefined {
  if (flow.closedAt) return undefined;

  if (flow.parked) {
    return {
      step: flow.step,
      awaits: "maintainer",
      summary: `Parked: ${flow.parked.reason}`,
      remedy: 'wfctl work release --attested "<what they said>"',
    };
  }

  /**
   * A step whose answer is already recorded is not what the flow is waiting on.
   *
   * `brief` demanded the weight on a flow opened with one, and offered to
   * re-run `work start` on an already-open flow to supply it.
   */
  if (flow.step === "opened" && flow.weight) {
    const following = nextStep("opened");
    if (following) {
      const next = definitionFor(following);
      return { step: following, awaits: "agent", summary: next.demands, remedy: next.command };
    }
  }

  const definition = definitionFor(flow.step);
  const shortfall = shortfallFor(flow.step, flow.recall);
  if (!isSatisfied(shortfall)) {
    return {
      step: flow.step,
      awaits: "agent",
      summary: `Recall incomplete for ${flow.step}.`,
      remedy: "wfctl recall answer <item> --answer ... --route ... --source ...",
    };
  }

  /**
   * A step whose work is already recorded is not what the flow waits on.
   * `brief` at `verified` asked for the review it had just accepted, and never
   * named drafting or closing — so an agent driving off the brief alone could
   * reach `verified` and never leave it.
   */
  if (flow.step === "verified" && flow.review) {
    return {
      step: "closed",
      awaits: "agent",
      summary:
        "Draft the pages this work changes, then close. Closure asks nobody: the " +
        "checks have already answered it.",
      remedy: 'wfctl work promotion draft "<area>/<page>.md"',
    };
  }

  if (flow.step === "closed") {
    return {
      step: "promoted",
      awaits: "maintainer",
      summary: definitionFor("promoted").demands,
      remedy: definitionFor("promoted").command,
    };
  }

  const awaitsMaintainer = flow.step === "framed" || flow.step === "promoted";
  return {
    step: flow.step,
    awaits: awaitsMaintainer ? "maintainer" : "agent",
    summary: definition.demands,
    remedy: definition.command,
  };
}

/**
 * What the CLI prints when a step is entered: the demand, the command that
 * records it, and the counter line. Printed together on purpose — the counter
 * line is what tells the agent it has been moving quickly through checks it did
 * not actually perform.
 */
/**
 * What this state demands, and the one command to run next.
 *
 * It used to print the command that had just succeeded — an agent following
 * `next:` literally re-ran the step it was already past and hit the recall
 * refusal, forever. The step's own command belongs under the demand it
 * satisfies; `next:` is the step after it.
 */
export function renderStep(flow: FlowRecord): string {
  const definition = definitionFor(flow.step);
  const following = nextStep(flow.step);
  const shortfall = shortfallFor(flow.step, flow.recall);

  /**
   * The checkpoint is named where it is needed, not only where it is refused.
   *
   * The next step wants one written since this step was reached, and an agent
   * that meets that as a refusal has already tried to move. Printing it here
   * puts the demand in front of the work rather than behind it — the whole
   * reason instructions come from the tool rather than from a document.
   */
  const checkpointStale =
    flow.step !== "opened" && (flow.checkpoint?.updatedAt ?? "") < (flow.steppedAt ?? "");

  const next = !isSatisfied(shortfall)
    ? "wfctl recall answer <item> --answer \"<what you found>\" --route <route> --source \"<where>\""
    : checkpointStale
      ? 'wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \\\n'
        + '        --last "<last completed action>" --next "<the exact next action>"'
      : (following ? definitionFor(following).command : "wfctl work close --outcome <completed|partial|abandoned>");

  return [
    `flow ${flow.id}  ·  step ${flow.step}`,
    "",
    definition.demands,
    "",
    `record it with: ${definition.command}`,
    `next: ${next}`,
    "",
    renderCounterLine(flow.step, flow.recall),
  ].join("\n");
}
