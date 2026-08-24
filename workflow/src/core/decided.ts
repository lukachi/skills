import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { listTrajectories } from "./trajectory.js";

/**
 * Has the maintainer already answered this?
 *
 * Recall item A1 is this lookup, and the interview guidance says to run it
 * before every question. Without it the agent asks again, and asking again
 * spends the maintainer's turn on the agent's bookkeeping — worse, a second
 * answer given without the first in view is how a settled direction quietly
 * reverses.
 *
 * Most answers are not on a curated page. They are in the record that asked
 * the question, which is why a knowledge search alone reads like a question
 * nobody has answered.
 */
export interface Decision {
  /** Where it was settled, in the maintainer's terms. */
  where: string;
  /** Their own words where they were recorded, otherwise what the record says. */
  said: string;
  at?: string;
  /** The file it came from. */
  path: string;
}

const LANES = [
  { dir: "knowledge", label: "a curated page" },
  { dir: "changes/active", label: "an open record" },
  { dir: "changes/promotion", label: "a record awaiting promotion" },
  { dir: "changes/archive", label: "a closed record" },
  { dir: "changes/inbox", label: "a capture" },
] as const;

/**
 * The words worth matching on.
 *
 * Dropping everything of three characters or fewer made SSO, API, CLI, MFA,
 * TLS and RPC permanently unsearchable — and the empty result was then reported
 * as "nobody has settled this", which is the opposite of the truth. Only
 * ordinary filler is dropped, and never the whole subject.
 */
const FILLER = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "is", "it",
  "we", "our", "be", "do", "does", "how", "what", "why", "should",
]);

function terms(subject: string): string[] {
  const words = subject
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 0);
  const meaningful = words.filter((term) => !FILLER.has(term));
  return meaningful.length > 0 ? meaningful : words;
}

function score(body: string, want: string[]): number {
  const text = body.toLowerCase();
  return want.filter((term) => text.includes(term)).length;
}

/**
 * Pull the sentence that carries the answer rather than the whole file.
 *
 * A packet that hands back four records in full is a reading task, and the
 * agent asked this question precisely to avoid one.
 */
function excerpt(body: string, want: string[]): string {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  const best = lines
    .map((line) => ({ line: line.trim(), hits: score(line, want) }))
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits)[0];
  return best?.line.replace(/^[-*#>|\s]+/, "").slice(0, 300) ?? "";
}

async function walk(root: string, dir: string): Promise<string[]> {
  const base = resolve(root, dir);
  try {
    const entries = await readdir(base, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => relative(root, join(entry.parentPath ?? base, entry.name)));
  } catch {
    return [];
  }
}

export async function findDecisions(root: string, subject: string): Promise<Decision[]> {
  const want = terms(subject);
  if (want.length === 0) return [];

  const found: Decision[] = [];

  for (const lane of LANES) {
    for (const path of await walk(root, lane.dir)) {
      const body = await readFile(resolve(root, path), "utf8").catch(() => "");
      if (score(body, want) < Math.min(2, want.length)) continue;
      const said = excerpt(body, want);
      if (!said) continue;
      const at = /\b(20\d{2}-\d{2}-\d{2})/.exec(body)?.[1];
      found.push({ where: lane.label, said, path, ...(at ? { at } : {}) });
    }
  }

  /**
   * A declared direction is the strongest of the four, because it is the one
   * the maintainer decided rather than the one an agent recovered.
   */
  for (const trajectory of await listTrajectories(root)) {
    if (score(trajectory.subject, want) === 0) continue;
    for (const event of trajectory.events.filter((entry) => entry.axis === "vision")) {
      found.push({
        where: "a declared direction",
        said: event.summary,
        path: `trajectories/${trajectory.id}.json`,
        ...(event.at ? { at: event.at.slice(0, 10) } : {}),
      });
    }
  }

  return found;
}

export function renderDecisions(subject: string, decisions: Decision[]): string {
  if (decisions.length === 0) {
    return [
      `Nothing recorded about "${subject}".`,
      "",
      "That is a real answer: it means nobody has settled this, so it is a",
      "question worth their turn. Say so when you ask, rather than asking as",
      "though you had not looked.",
    ].join("\n");
  }

  return [
    `${decisions.length} place(s) already say something about "${subject}":`,
    "",
    ...decisions.map((decision) =>
      [
        `${decision.at ?? "undated"}  ${decision.where}`,
        `  "${decision.said}"`,
        `  ${decision.path}`,
      ].join("\n"),
    ),
    "",
    "Cite the promoted page where there is one and the record where there is not,",
    "and say which. Asking again spends their turn on your bookkeeping.",
  ].join("\n");
}
