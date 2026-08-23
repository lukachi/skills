import type { FlowRecord } from "./types.js";
import { GateRefusal } from "./gates.js";

/**
 * Adversarial verification.
 *
 * The agent writes the criteria, writes the tests, writes the code, and then
 * reports that its tests pass its criteria. Every term in that sentence has the
 * same author, so green means "I agreed with myself" and no amount of gate
 * checking reaches it — the gates check that artifacts exist and hash correctly,
 * not that anything was true.
 *
 * Three properties break the loop, and all three are required. Any one alone is
 * theatre.
 */

export const VERIFY_LENSES = [
  "intent",
  "correctness",
  "contract",
  "failure-paths",
  "state-and-data",
  "delivery-reality",
  "test-integrity",
] as const;
export type VerifyLens = (typeof VERIFY_LENSES)[number];

export const LENS_QUESTIONS: Record<VerifyLens, string> = {
  intent: "Does the diff do what the framing asked, and only that?",
  correctness: "Which input makes this produce the wrong answer?",
  contract: "What existing caller breaks? What shape changed?",
  "failure-paths": "What happens on error, empty, concurrent, retried, partial?",
  "state-and-data": "What happens to data written by the previous version?",
  "delivery-reality": "Is the only caller a test, fixture, demo, or mock?",
  "test-integrity": "Would these tests catch a broken implementation?",
};

/**
 * An attack is an executable test, never prose.
 *
 * Prose findings are the failure mode this replaces: the reviewer asserts a
 * problem, the implementer disagrees, and whoever writes more confidently wins.
 * A test that runs settles it without either of them, and the main agent
 * receives evidence it can re-run rather than a claim it can restate.
 */
export interface Attack {
  lens: VerifyLens;
  /** What this attack tried to break, in one sentence. */
  target: string;
  /** The test source. Ephemeral — never added to the suite. */
  test: string;
  /** What running it produced. */
  output: string;
  /** True when the attack succeeded, i.e. the work is broken. */
  broke: boolean;
}

export interface Finding {
  lens: VerifyLens;
  summary: string;
  failure: string;
  status: "open" | "accepted";
  /** Required when accepted. An accepted finding is never silent. */
  acceptedBecause?: string;
}

export interface Review {
  /** The revision the first claim was made at. Fixed before the work existed. */
  fixedPoint: string;
  /** The acceptance digest as approved, not as the record now reads. */
  framingDigest: string;
  reviewer: string;
  attacks: Attack[];
  findings: Finding[];
  /**
   * Which tests still passed when the implementation was stubbed to a constant.
   * Those tests assert nothing, and this is the single highest-yield check on
   * this page: it needs no judgment and it catches most fake green.
   */
  stubSurvivors: string[];
}

/**
 * The verification gate.
 *
 * Note what it refuses on. Not "findings exist" — a clean diff is allowed to be
 * clean. What it refuses is an *empty* review: no findings and no recorded
 * attacks, which is indistinguishable from a review that never ran. Silence and
 * success must not look the same.
 */
export function assertReviewUsable(flow: FlowRecord, review: Review): void {
  if (review.reviewer.trim().length === 0) {
    throw new GateRefusal(
      "The review records no reviewer.",
      "wfctl work verify --review <artifact naming its reviewer>",
      "The implementing agent cannot review its own work: the agent that wrote " +
        "the tests can write the review that approves them.",
    );
  }

  if (review.attacks.length === 0 && review.findings.length === 0) {
    throw new GateRefusal(
      "The review is empty: no findings and no recorded attacks.",
      "wfctl work verify --review <artifact carrying its attacks>",
      'A reviewer that broke nothing must still say what it tried. "Looks ' +
        'correct" is not an allowed answer.',
    );
  }

  if (review.stubSurvivors.length > 0) {
    throw new GateRefusal(
      `${review.stubSurvivors.length} test(s) still pass with the implementation stubbed.`,
      "Fix the tests, then re-run the review.",
      `Those tests assert nothing:\n  ${review.stubSurvivors.join("\n  ")}`,
    );
  }

  /**
   * An attack whose own output says it broke the work is a finding.
   *
   * `broke` was never inspected, so a review could carry the evidence that the
   * work is wrong and still be accepted — the one thing an adversarial round
   * exists to prevent.
   */
  const broke = review.attacks.filter((attack) => attack.broke);
  if (broke.length > 0) {
    throw new GateRefusal(
      `${broke.length} attack(s) broke the work.`,
      "Fix what they broke, then run the review again.",
      broke.map((attack) => `  [${attack.lens}] ${attack.target}\n    ${attack.output}`).join("\n"),
    );
  }

  /**
   * Only the literal "open" was refused, so `blocking`, `rejected`, an empty
   * string and null all passed — a review could carry a finding that says the
   * work is wrong and be accepted for spelling it differently.
   */
  const unknown = review.findings.filter(
    (finding) => finding.status !== "open" && finding.status !== "accepted",
  );
  if (unknown.length > 0) {
    throw new GateRefusal(
      `${unknown.length} finding(s) declare a status that is not open or accepted.`,
      "Set each to open, or to accepted with a reason.",
      unknown.map((finding) => `  [${finding.lens}] ${String(finding.status)}: ${finding.summary}`).join("\n"),
    );
  }

  const open = review.findings.filter((finding) => finding.status === "open");
  if (open.length > 0) {
    throw new GateRefusal(
      `${open.length} finding(s) are unresolved.`,
      "Resolve them, or accept each with a recorded reason.",
      open.map((finding) => `  [${finding.lens}] ${finding.summary}`).join("\n"),
    );
  }

  const silent = review.findings.filter(
    (finding) => finding.status === "accepted" && !finding.acceptedBecause?.trim(),
  );
  if (silent.length > 0) {
    throw new GateRefusal(
      `${silent.length} finding(s) were accepted without a reason.`,
      "Record the reason in the artifact's finding, then verify again.",
      "A finding may be accepted, never silently.",
    );
  }

  if (flow.framingDigest && flow.framingDigest !== review.framingDigest) {
    throw new GateRefusal(
      "The acceptance criteria have changed since the framing was approved.",
      "wfctl work close --outcome partial   (the framing they approved no longer matches)",
      "This is the one case where closure returns to the maintainer: delivery " +
        "no longer matches the framing they agreed to.",
    );
  }
}

/**
 * The brief handed to the review subagent.
 *
 * It receives the diff, the framing, and the repository. It does not receive
 * the implementation session or the discovery ledger — rationalization is what
 * leaks through a shared context, and an agent shown its own justification will
 * accept it.
 */
export function renderReviewerBrief(lens: VerifyLens, fixedPoint: string): string {
  return [
    `You are reviewing work at the fixed point ${fixedPoint}.`,
    "",
    `Lens: ${lens} — ${LENS_QUESTIONS[lens]}`,
    "",
    "Your goal is to break this work, not to confirm it.",
    "",
    "Every attack must be an executable test. Write it, run it, and return the",
    "source, its output, and whether it broke the work. If you could not break",
    "it, say exactly what you tried and why it held.",
    "",
    "Also read the diff backwards: for each changed file, ask what the framing",
    "said about it. That direction finds work nobody asked for.",
    "",
    "You will not be given the implementer's reasoning. Do not ask for it.",
  ].join("\n");
}
