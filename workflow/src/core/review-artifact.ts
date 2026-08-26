import { readFile } from "node:fs/promises";
import { GateRefusal } from "./gates.js";
import {
  VERIFY_LENSES,
  type Attack,
  type Finding,
  type Review,
  type StubPass,
  type StubSurvivor,
  type VerifyLens,
} from "./verify.js";

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
  stubSurvivors: unknown;
  stubPass?: unknown;
}

/**
 * Read the survivors, whatever shape the reviewer chose.
 *
 * This was typed `string[]` and validated by nothing, so a reviewer returning
 * its own reasonable shape — `{target, stub, result}` — produced a refusal that
 * printed `[object Object]` once per entry. The agent was told two of its tests
 * assert nothing and shown neither, which is a refusal that cannot be acted on
 * even in principle.
 *
 * A bare string is the short form and means unresolved. `target` is accepted
 * beside `test` because that is the word a reviewer reaches for and refusing it
 * would only move the wall.
 */
function readStubSurvivors(raw: unknown): StubSurvivor[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    fail(
      "stubSurvivors is not a list.",
      'Return a list of strings, or of {"test": "...", "status": "open"|"accepted"}.',
    );
  }

  return raw.map((entry, index) => {
    if (typeof entry === "string") {
      if (!entry.trim()) {
        fail(`Stub survivor ${index + 1} is empty.`, "Say which test survived, and what stubbing it proved.");
      }
      return { test: entry, status: "open" as const };
    }

    if (typeof entry !== "object" || entry === null) {
      fail(
        `Stub survivor ${index + 1} is a ${typeof entry}, not a test.`,
        'Return a string, or {"test": "...", "status": "open"|"accepted"}.',
      );
    }

    const record = entry as Record<string, unknown>;
    const named = record.test ?? record.target;
    if (typeof named !== "string" || !named.trim()) {
      fail(
        `Stub survivor ${index + 1} does not say which test survived.`,
        'Give it a "test" naming the test and what stubbing it proved.',
        `It carries: ${Object.keys(record).join(", ") || "nothing"}`,
      );
    }

    /**
     * The whole entry is kept in the description when the reviewer wrote more
     * than a name. Dropping the extra keys would discard the evidence — the
     * stub that was applied and what the suite did under it — which is the part
     * that lets a maintainer judge whether accepting is honest.
     */
    const extra = Object.entries(record)
      .filter(([key]) => !["test", "target", "status", "acceptedBecause"].includes(key))
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

    const survivor: StubSurvivor = {
      test: [named, ...extra].join("\n    "),
      status: (record.status ?? "open") as StubSurvivor["status"],
    };
    if (typeof record.acceptedBecause === "string") survivor.acceptedBecause = record.acceptedBecause;
    return survivor;
  });
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

  /**
   * Read only a shape that says something. A truthy object with no `ran` is not
   * an answer, and letting it through would restore the ambiguity this field
   * exists to remove.
   */
  let stubPass: StubPass | undefined;
  const reported = parsed.stubPass;
  if (reported !== undefined && reported !== null) {
    if (typeof reported !== "object") {
      fail(
        `stubPass is a ${typeof reported}, not a report.`,
        'Return "stubPass": { "ran": true|false, "note": "<what happened>" }',
      );
    }
    const record = reported as Record<string, unknown>;
    if (typeof record.ran !== "boolean") {
      fail(
        "stubPass does not say whether the pass ran.",
        'Set "ran" to true or false. False carries the reason it could not run.',
      );
    }
    stubPass = {
      ran: record.ran,
      note: typeof record.note === "string" ? record.note : "",
    };
  }

  return {
    fixedPoint: parsed.fixedPoint ?? "",
    framingDigest: parsed.framingDigest ?? "",
    reviewer: parsed.reviewer.trim(),
    attacks: parsed.attacks ?? [],
    findings: parsed.findings ?? [],
    stubSurvivors: readStubSurvivors(parsed.stubSurvivors),
    ...(stubPass ? { stubPass } : {}),
  };
}
