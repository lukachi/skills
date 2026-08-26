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

/**
 * A test that passes with the implementation stubbed out.
 *
 * It carries a status for the same reason a finding does. This was a bare
 * string, refused unconditionally, and it was the only thing a reviewer could
 * report that had no way to be answered — so an honest review of work whose
 * weak tests belong to somebody else wedged the flow permanently: verification
 * refused on the survivor, closure refused for want of a verification, and
 * dropping the fence refused because the work had moved. Three commands, each
 * naming another that refused.
 *
 * The remedy it printed was "fix the tests", which is right when the tests are
 * yours and impossible when they are upstream's and the fence does not reach
 * them. A weak test is a fact about the work; whether this change is the place
 * to repair it is a judgment, and judgments are recorded here the way every
 * other one is — acceptable, never silently.
 */
export interface StubSurvivor {
  /** The test, and what stubbing it proved. */
  test: string;
  status: "open" | "accepted";
  /** Required when accepted. */
  acceptedBecause?: string;
}

export interface Finding {
  lens: VerifyLens;
  summary: string;
  failure: string;
  status: "open" | "accepted";
  /** Required when accepted. An accepted finding is never silent. */
  acceptedBecause?: string;
}

/**
 * Whether the stub pass was actually run, and what it found.
 *
 * An empty `stubSurvivors` meant two different things and the tool could not
 * tell them apart: "I stubbed the implementation and every test went red", and
 * "I never stubbed anything". The second is the more likely of the two, because
 * the instruction to stub lived only in a document the reviewer may never have
 * opened — the brief this tool generates never mentioned it, and nothing printed
 * that brief anyway.
 *
 * So the reviewer says. This is the same rule the empty-review check already
 * applies to attacks: a reviewer that broke nothing must still say what it
 * tried, because silence and success must not look the same.
 *
 * `ran: false` is allowed and carries its reason, so a suite that genuinely
 * cannot be stubbed reports that instead of wedging the flow.
 */
export interface StubPass {
  ran: boolean;
  /** What was stubbed and what happened, or why it could not be. */
  note: string;
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
  stubSurvivors: StubSurvivor[];
  /** Whether the stub pass ran at all. Absent is refused, not assumed. */
  stubPass?: StubPass;
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

  /**
   * Silence about the stub pass is not a pass.
   *
   * This is the check the whole page rests on — it needs no judgment and it
   * catches most fake green — and it was reported by a field that defaulted to
   * empty. A reviewer that never stubbed anything returned `[]` and the gate
   * congratulated it.
   */
  if (!review.stubPass) {
    throw new GateRefusal(
      "The review does not say whether the stub pass ran.",
      'Add "stubPass": { "ran": true, "note": "<what was stubbed and what went red>" }',
      "Stub each implementation under review to a constant and run the tests " +
        "again. Anything still green asserts nothing. An empty stubSurvivors " +
        "list means both 'I stubbed and everything failed correctly' and 'I " +
        "never stubbed', and this tool cannot tell them apart.\n\n" +
        'If the suite cannot be stubbed, say so: "ran": false with the reason.',
    );
  }
  if (!review.stubPass.note.trim()) {
    throw new GateRefusal(
      review.stubPass.ran
        ? "The stub pass ran and the review does not say what it found."
        : "The stub pass did not run and the review does not say why.",
      'Record it in "stubPass": { "note": "<what was stubbed and what happened>" }',
      "A pass with no account of itself is indistinguishable from one that was " +
        "not run.",
    );
  }

  /**
   * A survivor is answered the same way a finding is: repaired, or accepted
   * with a reason. Both are legal moves and the refusal names both, because a
   * refusal offering only the impossible one is a wall.
   */
  const unknownStub = review.stubSurvivors.filter(
    (survivor) => survivor.status !== "open" && survivor.status !== "accepted",
  );
  if (unknownStub.length > 0) {
    throw new GateRefusal(
      `${unknownStub.length} stub survivor(s) declare a status that is not open or accepted.`,
      "Set each to open, or to accepted with a reason.",
      unknownStub.map((survivor) => `  ${String(survivor.status)}: ${survivor.test}`).join("\n"),
    );
  }

  const openStubs = review.stubSurvivors.filter((survivor) => survivor.status === "open");
  if (openStubs.length > 0) {
    throw new GateRefusal(
      `${openStubs.length} test(s) still pass with the implementation stubbed.`,
      'Repair the test, or accept it in the artifact: "status": "accepted", "acceptedBecause": "<why not here>"',
      `Those tests assert nothing:\n${openStubs.map((survivor) => `  ${survivor.test}`).join("\n")}\n\n` +
        "Accepting is for a test this work does not own — one that belongs to a " +
        "repository outside the fence, or to a suite this change did not author. " +
        "It records the weakness rather than repairing it, and the reason is read " +
        "by whoever meets it next.",
    );
  }

  const silentStubs = review.stubSurvivors.filter(
    (survivor) => survivor.status === "accepted" && !survivor.acceptedBecause?.trim(),
  );
  if (silentStubs.length > 0) {
    throw new GateRefusal(
      `${silentStubs.length} stub survivor(s) were accepted without a reason.`,
      "Record the reason in the artifact, then verify again.",
      "A test that asserts nothing may be accepted, never silently.",
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
    "RUN THE STUB PASS. Replace each implementation under review with a constant",
    "and run the tests again. Anything still green asserts nothing, and this is",
    "the highest-yield check here: it needs no judgment and it catches most fake",
    "green. Report it whether or not it found something — an empty list with no",
    "account of the pass is indistinguishable from never having run it.",
    "",
    "You will not be given the implementer's reasoning. Do not ask for it.",
    "",
    "Return this shape, and nothing else:",
    "",
    JSON.stringify(
      {
        reviewer: "agent:<who you are, and not the implementer>",
        fixedPoint,
        framingDigest: "<the digest the framing was approved at>",
        attacks: [
          {
            lens,
            target: "what this attack tried to break",
            test: "the test source, verbatim",
            output: "what running it produced",
            broke: false,
          },
        ],
        findings: [
          {
            lens,
            summary: "one sentence",
            failure: "inputs or state → wrong output",
            status: "open",
            acceptedBecause: "required only when status is accepted",
          },
        ],
        stubPass: { ran: true, note: "what was stubbed, and what went red" },
        stubSurvivors: [
          { test: "which test survived, and what stubbing it proved", status: "open" },
        ],
      },
      null,
      2,
    ),
    "",
    "A stub survivor is answered like a finding: repair it, or accept it with a",
    "reason. Accepting is for a test this work does not own.",
  ].join("\n");
}
