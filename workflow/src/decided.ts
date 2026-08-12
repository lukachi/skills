import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { isMissingFileError } from "./config.js";
import { isRecord, parseWorkSpec, serializeWorkSpec } from "./work-spec.js";

/**
 * Everything the maintainer has already settled, wherever it happens to live.
 *
 * An answer they gave has four possible homes and no single door. A promoted
 * decision page is the intended one; the bundle that asked the question is where
 * it always lands first; a resolved Wayfinder map holds one entry per answer;
 * and a capture holds the ones nobody has routed yet. In this project twenty-two
 * of twenty-six recorded decisions had never reached a page, so the three
 * unintended homes were where the answers actually were.
 *
 * That is not a retrieval problem to be solved with better search habits. It is
 * a cost problem: finding them meant knowing the `changes` QMD collection
 * exists, knowing the flag that selects it, and guessing the maintainer's own
 * wording. Three conditions, and an audit that asked thirty-one questions met
 * none of them — then asked about a direction attested six days earlier and
 * about a consequence its own completed work had recorded.
 *
 * So this reads the four homes directly and ranks by overlap, which is dumber
 * than semantic search and has the one property that matters here: it works
 * without an embedding pass, without a collection name, and without the agent
 * knowing any of that.
 */

export type DecisionHome = "page" | "bundle" | "map" | "delivered" | "capture";

export interface PriorDecision {
  /** What was decided, in the words it was recorded in. */
  what: string;
  /** Which of the four homes this came out of. */
  home: DecisionHome;
  /** The record it lives in, for an audit rather than for a packet. */
  where: string;
  /** Where the maintainer said it, when the record names that separately. */
  said: string;
  /** ISO date the record carries, when it carries one. */
  at: string;
  /** Whether a curated page carries it, so a reader knows what they are citing. */
  onAPage: boolean;
  /** Overlapping terms, so a caller can say why this matched. */
  matched: string[];
}

export interface DecidedResult {
  terms: string[];
  decisions: PriorDecision[];
  /** Every decision read, so an empty result can say what it searched. */
  searched: number;
}

export async function findDecisions(
  targetInput: string,
  query: string,
  limit = 10,
): Promise<DecidedResult> {
  const target = resolve(targetInput);
  const terms = tokenize(query);
  const all = [
    ...await fromPages(target),
    ...await fromBundles(target),
    ...await fromCaptures(target),
  ];
  const scored = all
    .map((decision) => {
      const haystack = new Set(tokenize(`${decision.what} ${decision.where}`));
      const matched = terms.filter((term) => haystack.has(term));
      return { decision: { ...decision, matched }, score: matched.length };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || homeRank(left.decision.home) - homeRank(right.decision.home)
      || left.decision.what.localeCompare(right.decision.what)
    );
  return {
    terms,
    searched: all.length,
    decisions: scored.slice(0, limit).map((entry) => entry.decision),
  };
}

/**
 * A promoted page outranks the same answer read out of an archive, because one
 * is what the corpus teaches and the other is what it forgot to.
 */
function homeRank(home: DecisionHome): number {
  return ["page", "bundle", "map", "delivered", "capture"].indexOf(home);
}

const STOP = new Set([
  "the","a","an","and","or","of","to","in","is","it","that","this","for","on","as","at","by",
  "with","from","be","are","was","were","not","but","its","their","they","them","what","which",
  "when","where","who","how","all","any","can","must","should","would","has","have","had","do",
  "does","did","will","one","two","own","into","than","then","there","these","those","only",
]);

function tokenize(value: string): string[] {
  const seen = new Set<string>();
  for (const word of value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []) {
    const stem = word.replace(/(ies|es|s)$/u, (suffix) => (suffix === "ies" ? "y" : ""));
    if (stem.length > 2 && !STOP.has(stem)) {
      seen.add(stem);
    }
  }
  return [...seen];
}

async function fromPages(target: string): Promise<PriorDecision[]> {
  const root = join(target, "knowledge/decisions");
  const decisions: PriorDecision[] = [];
  for (const name of await markdownNames(root)) {
    if (name === "index.md") {
      continue;
    }
    const path = join(root, name);
    const { metadata, body } = await split(path);
    const title = text(metadata.title) || heading(body) || name.replace(/\.md$/, "");
    decisions.push({
      what: title,
      home: "page",
      where: `knowledge/decisions/${name}`,
      said: text(recordOf(metadata.verified)?.by),
      at: text(metadata.updated_at) || text(metadata.created_at),
      onAPage: true,
      matched: [],
    });
  }
  return decisions;
}

async function fromBundles(target: string): Promise<PriorDecision[]> {
  const decisions: PriorDecision[] = [];
  // The promotion queue is the worst place to be blind. A bundle waiting there
  // is closed, its answers are the most recently settled in the project, and its
  // pages have not landed — so the corpus does not hold them either. Missing it
  // reproduces, on the newest decisions, exactly the silence this command exists
  // to break.
  for (const state of ["active", "promotion", "archive"]) {
    const root = join(target, "changes", state);
    for (const id of await directoryNames(root)) {
      decisions.push(...await fromBundle(join(root, id), `changes/${state}/${id}`));
    }
  }
  return decisions;
}

async function fromBundle(root: string, where: string): Promise<PriorDecision[]> {
  const decisions: PriorDecision[] = [];
  const change = await split(join(root, "change.md")).catch(() => undefined);
  if (change) {
    const promotion = recordOf(change.metadata.knowledge_promotion);
    const at = text(change.metadata.updated_at);
    for (const entry of arrayOf(promotion?.decisions)) {
      const what = text(entry.what);
      if (!what) {
        continue;
      }
      decisions.push({
        what,
        home: "bundle",
        where: `${where}/change.md`,
        said: text(entry.said),
        at,
        onAPage: text(entry.disposition) === "promoted" || text(entry.disposition) === "folded",
        matched: [],
      });
    }
  }
  // A finished issue is not a decision, and it answers the same question twice
  // over: the subject was looked at, and something was done about it. The audit
  // that prompted this asked the maintainer to settle a party rest healing
  // nobody, which a completed issue had already delivered deliberately and
  // written down as his to settle — so a search that reads only decisions finds
  // the question open and the answer nowhere.
  for (const name of await markdownNames(join(root, "issues"))) {
    const { metadata } = await split(join(root, "issues", name));
    const resolution = recordOf(metadata.resolution);
    const summary = text(resolution?.summary);
    if (!summary || text(metadata.status) !== "completed") {
      continue;
    }
    decisions.push({
      what: `${text(metadata.title)} — ${summary}`.trim(),
      home: "delivered",
      where: `${where}/issues/${name}`,
      said: text(metadata.id),
      at: text(resolution?.completed_at),
      onAPage: false,
      matched: [],
    });
  }

  const map = await split(join(root, "map.md")).catch(() => undefined);
  for (const entry of arrayOf(map?.metadata.resolved)) {
    const what = text(entry.answer) || text(entry.outcome) || text(entry.decision);
    if (what) {
      decisions.push({
        what,
        home: "map",
        where: `${where}/map.md`,
        said: text(entry.issue),
        at: text(entry.resolved_at),
        onAPage: false,
        matched: [],
      });
    }
  }
  return decisions;
}

/**
 * A capture is a decision only once someone resolved it; a pending one is a
 * question still open. Both are reported, because asking a maintainer something
 * their own pending capture already describes is the same waste as asking them
 * something they answered.
 */
async function fromCaptures(target: string): Promise<PriorDecision[]> {
  const decisions: PriorDecision[] = [];
  for (const root of ["changes/inbox", "changes/archive/captures"]) {
    const directory = join(target, root);
    for (const name of await markdownNames(directory)) {
      const { metadata } = await split(join(directory, name));
      const title = text(metadata.title);
      if (!title) {
        continue;
      }
      const resolution = recordOf(metadata.resolution);
      decisions.push({
        what: resolution ? `${title} — ${text(resolution.reason)}`.trim() : title,
        home: "capture",
        where: `${root}/${name}`,
        said: text(metadata.status),
        at: text(metadata.resolved_at) || text(metadata.created_at),
        onAPage: false,
        matched: [],
      });
    }
  }
  return decisions;
}

async function split(path: string): Promise<{ metadata: Record<string, unknown>; body: string }> {
  const content = await readFile(path, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { metadata: {}, body: content };
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    return { metadata: {}, body: content };
  }
  let metadata: unknown = {};
  try {
    metadata = parse(lines.slice(1, end).join("\n"));
  } catch {
    metadata = {};
  }
  return {
    metadata: isRecord(metadata) ? metadata : {},
    body: lines.slice(end + 1).join("\n"),
  };
}

function heading(body: string): string {
  return (/^#\s+(.+)$/m.exec(body)?.[1] ?? "").trim();
}

async function markdownNames(root: string): Promise<string[]> {
  try {
    return (await readdir(root)).filter((name) => name.endsWith(".md")).sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

async function directoryNames(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== "captures")
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface RecordDecidedOptions {
  target: string;
  id: string;
  subject: string;
  /** Why nothing already recorded bears on this work, when the search found none. */
  none?: string;
  limit?: number;
}

/**
 * The search and its receipt in one act, so a recorded check is one that ran.
 *
 * Every other accounting in this workflow is written by the command that does
 * the thing — a review receipt by reading, a repository by accounting for it.
 * A hand-written "I checked" field would be the one place the record could
 * claim work nobody did.
 */
export async function recordDecided(
  options: RecordDecidedOptions,
): Promise<{ result: DecidedResult; path: string }> {
  const target = resolve(options.target);
  const result = await findDecisions(target, options.subject, options.limit ?? 10);
  if (result.decisions.length === 0 && !options.none?.trim()) {
    throw new Error(
      `Nothing recorded bears on "${options.subject}", and an empty result is only an answer `
        + "once it says so. Re-run with --none \"<why nothing already recorded bears on this "
        + "work>\", or search a wording closer to what the maintainer would have used.",
    );
  }
  const path = join(target, "changes/active", options.id, "change.md");
  const document = parseWorkSpec(await readFile(path, "utf8"));
  const alignment = isRecord(document.metadata.knowledge_alignment)
    ? document.metadata.knowledge_alignment
    : {};
  alignment.decided = {
    checked: options.subject,
    at: new Date().toISOString(),
    found: result.decisions.map((decision) => ({
      what: decision.what,
      where: decision.where,
      on_a_page: decision.onAPage,
    })),
    ...(result.decisions.length === 0 ? { none: options.none!.trim() } : {}),
  };
  document.metadata.knowledge_alignment = alignment;
  await writeFile(path, serializeWorkSpec(document), "utf8");
  return { result, path };
}

export function renderDecisions(result: DecidedResult): string {
  if (result.decisions.length === 0) {
    return [
      `Nothing recorded bears on "${result.terms.join(" ")}".`,
      "",
      `Searched every decision this project has written down: ${result.searched} of them,`,
      "across promoted pages, the bundles that asked the questions, resolved Wayfinder",
      "maps, and captures. An answer that is not here has not been recorded, which is",
      "different from one nobody gave.",
      "",
    ].join("\n");
  }
  const lines = [`Already settled, and bearing on "${result.terms.join(" ")}":`, ""];
  for (const decision of result.decisions) {
    lines.push(`- ${decision.what}`);
    const provenance = [
      decision.at ? `decided ${decision.at.slice(0, 10)}` : "",
      decision.said ? `said in ${decision.said}` : "",
      decision.home === "delivered"
        ? `already delivered, recorded in ${decision.where}`
        : decision.onAPage
        ? "carried by a curated page"
        : `recorded only in ${decision.where}`,
    ].filter(Boolean);
    lines.push(`  ${provenance.join(" · ")}`);
  }
  lines.push(
    "",
    "Cite the page where there is one and the record where there is not, and say which:",
    "a decision reachable only through an archive is one the corpus has not been taught.",
    "",
  );
  return lines.join("\n");
}
