import { readFile } from "node:fs/promises";
import { GateRefusal } from "./gates.js";
import { VERIFY_LENSES, type Attack, type Finding, type Review, type VerifyLens } from "./verify.js";

/**
 * wfctl does not spawn the reviewer.
 *
 * Spawning would tie this tool to one host's agent API, and the property that
 * matters is not who started the review — it is that the review was produced by
 * something other than the agent under review, and that its claims are backed by
 * tests somebody can run again.
 *
 * So the agent spawns it, and wfctl checks what comes back. That check is the
 * part the implementing agent cannot satisfy by asserting anything.
 */
export interface ReviewArtifact {
  reviewer: string;
  fixedPoint: string;
  framingDigest: string;
  attacks: Attack[];
  findings: Finding[];
  stubSurvivors: string[];
}

function fail(message: string, remedy: string, detail?: string): never {
  throw new GateRefusal(message, remedy, detail);
}

/**
 * Parse and validate a returned review.
 *
 * Every refusal here is a way an agent has actually reported a review it did not
 * do: no reviewer, an attack with no test, a test with no output, a lens outside
 * the set. None of them are typos — they are what a summary looks like when it
 * is written instead of run.
 */
export async function readReviewArtifact(path: string, actor: string): Promise<Review> {
  const raw = await readFile(path, "utf8").catch(() => {
    fail(`No review artifact at ${path}.`, "wfctl work verify --review <path to the returned artifact>");
  });

  let parsed: ReviewArtifact;
  try {
    parsed = JSON.parse(raw) as ReviewArtifact;
  } catch {
    fail(
      `The review artifact at ${path} is not valid JSON.`,
      "Have the reviewer return the artifact verbatim rather than summarizing it.",
    );
  }

  if (!parsed.reviewer?.trim()) {
    fail("The review names no reviewer.", "Have the reviewer record its own identity.");
  }

  /**
   * The independence check. It is weak on purpose — it proves the artifact did
   * not come from the actor running the command, and nothing more. A stronger
   * claim would need to know what the host actually spawned, which this tool
   * cannot see and should not pretend to.
   */
  if (parsed.reviewer.trim() === actor) {
    fail(
      "The review was produced by the agent under review.",
      "Delegate the review to a separate agent and pass back its artifact.",
      "The agent that wrote the tests can write the review that approves them.",
    );
  }

  for (const [index, attack] of (parsed.attacks ?? []).entries()) {
    if (!VERIFY_LENSES.includes(attack.lens as VerifyLens)) {
      fail(
        `Attack ${index + 1} declares an unknown lens ${String(attack.lens)}.`,
        `Use one of: ${VERIFY_LENSES.join(", ")}`,
      );
    }
    if (!attack.test?.trim()) {
      fail(
        `Attack ${index + 1} carries no test.`,
        "Every attack is an executable test, written and run.",
        "A prose finding is settled by whoever writes more confidently. A test is settled by running it.",
      );
    }
    if (!attack.output?.trim()) {
      fail(
        `Attack ${index + 1} carries a test that was never run.`,
        "Run each attack and return its output.",
      );
    }
    if (!attack.target?.trim()) {
      fail(`Attack ${index + 1} does not say what it tried to break.`, "Record the target of each attack.");
    }
  }

  return {
    fixedPoint: parsed.fixedPoint ?? "",
    framingDigest: parsed.framingDigest ?? "",
    reviewer: parsed.reviewer.trim(),
    attacks: parsed.attacks ?? [],
    findings: parsed.findings ?? [],
    stubSurvivors: parsed.stubSurvivors ?? [],
  };
}
