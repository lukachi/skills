import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import type { KitEntry, KitKind } from "./types.js";

/**
 * What this work is equipped with.
 *
 * Three kinds of thing an agent can pick up for a piece of work, and they are
 * one mechanic because they fail the same way. A leaf repository carries
 * fifty-six skills across three checkouts and the tool read none of them. The
 * strategies that made a hundred-item corpus survivable were reinvented each
 * time. The brief handed to a review subagent was composed from memory, because
 * the function that generates it had no caller.
 *
 * None of it is injected. An agent handed fifty-six skills at session start has
 * been handed nothing: the useful three are indistinguishable from the other
 * fifty-three, and the whole set is skimmed. So the agent surveys, reads what
 * looks relevant, and proposes — and the maintainer's answer is recorded.
 *
 * It is recorded on the flow rather than held in context because the context
 * that chose it is routinely cleared. The maintainer shapes the work, clears the
 * session, and starts implementing from nothing; the prerequisites have to
 * survive that or they were never prerequisites.
 */
export interface KitCandidate {
  id: string;
  kind: KitKind;
  /** Where to read it. Repository-relative, or the guide topic that prints it. */
  path: string;
  /** The one line it says about itself. */
  what: string;
  /** For a skill, the checkout it belongs to. */
  repository?: string;
}

/**
 * Read the name and description a skill states about itself.
 *
 * Both agent conventions put frontmatter at the top of `SKILL.md`. A skill with
 * no description is still listed — the agent can open it — because omitting it
 * would silently hide exactly the hand-written skills a repository cares most
 * about.
 */
function describe(body: string): string {
  const match = /^---\n([\s\S]*?)\n---/.exec(body);
  const block = match?.[1] ?? "";
  const described = /^description:\s*(?:["']?)([\s\S]*?)(?:["']?)\s*$/m.exec(block);
  const inline = described?.[1]?.split("\n")[0]?.trim();
  /**
   * Trimmed, because this is triage.
   *
   * A real skill description states every trigger it answers to and runs to
   * five lines. Sixteen of those is a wall, and a wall gets skimmed — which is
   * the failure this survey exists to avoid. Enough to judge relevance, and the
   * path to read the rest.
   */
  if (inline) return clip(inline);

  const heading = /^#\s+(.+)$/m.exec(body.replace(/^---[\s\S]*?---/, ""));
  return heading?.[1]?.trim() ?? "";
}

const LIMIT = 220;

function clip(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= LIMIT) return flat;
  const cut = flat.slice(0, LIMIT);
  const boundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  return `${cut.slice(0, boundary > LIMIT / 2 ? boundary : LIMIT).trimEnd()}…`;
}

/** The skills a checkout carries, under either agent convention. */
export async function skillsIn(path: string, repository: string): Promise<KitCandidate[]> {
  const found = new Map<string, KitCandidate>();
  for (const convention of [".claude/skills", ".agents/skills"]) {
    const base = resolve(path, convention);
    const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = resolve(base, entry.name, "SKILL.md");
      const body = await readFile(file, "utf8").catch(() => undefined);
      if (body === undefined) continue;
      /**
       * The two conventions are usually the same skills twice — one directory
       * is often a copy of the other — so the first reading of a name wins and
       * the survey does not report everything double.
       */
      if (found.has(entry.name)) continue;
      found.set(entry.name, {
        id: `${repository}:${entry.name}`,
        kind: "skill",
        path: `${convention}/${entry.name}/SKILL.md`,
        what: describe(body),
        repository,
      });
    }
  }
  return [...found.values()].sort((left, right) => left.id.localeCompare(right.id));
}

/** Strategies and personalities ship with the tool. */
export async function shipped(guidanceRoot: string, kind: KitKind): Promise<KitCandidate[]> {
  const base = resolve(guidanceRoot, kind === "strategy" ? "strategy" : "personality");
  const entries = await readdir(base).catch(() => []);
  const candidates: KitCandidate[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue;
    const name = basename(entry, ".md");
    const body = await readFile(resolve(base, entry), "utf8").catch(() => "");
    candidates.push({
      id: `${kind}:${name}`,
      kind,
      path: `wfctl guide ${kind}/${name}`,
      what: firstSentence(body),
    });
  }
  return candidates;
}

/**
 * The line a strategy leads with, which is the line that says when to use it.
 *
 * Every shipped strategy opens with a bolded "Use when…", so a survey that
 * printed the title alone would tell the agent the names of eight things and
 * nothing about which one this work needs.
 */
function firstSentence(body: string): string {
  const withoutHeading = body.replace(/^#[^\n]*\n+/, "");
  /** A strategy opens on when to use it; a personality opens on its stance. */
  const when = /\*\*(Use when[\s\S]*?)\*\*([^\n]*)/.exec(withoutHeading);
  if (when) return clip(`${when[1] ?? ""}${when[2] ?? ""}`);
  const stance = /\*\*Stance\.\*\*\s*([\s\S]*?)(?:\n\s*\n)/.exec(withoutHeading);
  if (stance?.[1]) return clip(stance[1]);
  return clip(withoutHeading.split(/\n\s*\n/)[0] ?? "");
}

const PLURAL: Record<KitKind, string> = {
  skill: "skills",
  strategy: "strategies",
  personality: "personalities",
};

function plural(kind: KitKind): string {
  return PLURAL[kind];
}

export function renderSurvey(candidates: KitCandidate[], equipped: KitEntry[]): string {
  if (candidates.length === 0) {
    return [
      "Nothing to survey.",
      "",
      "Strategies and personalities ship with wfctl; skills come from the",
      "checkouts this repository has registered. If you expected a checkout's",
      "skills here, it may not be registered yet:",
      "  wfctl repo list",
    ].join("\n");
  }

  const held = new Set(equipped.map((entry) => entry.id));
  const lines: string[] = [];
  for (const kind of ["skill", "strategy", "personality"] as const) {
    const group = candidates.filter((candidate) => candidate.kind === kind);
    if (group.length === 0) continue;
    lines.push(`${plural(kind)} (${group.length})`);
    for (const candidate of group) {
      lines.push(`  ${held.has(candidate.id) ? "✓" : " "} ${candidate.id}`);
      if (candidate.what) lines.push(`      ${candidate.what}`);
      lines.push(`      read: ${candidate.repository ? `${candidate.repository} · ` : ""}${candidate.path}`);
    }
    lines.push("");
  }

  lines.push(
    "This is a list, not a briefing. Nothing here has been read for you and",
    "nothing has been added to this work.",
    "",
    "Read the ones that look relevant — the descriptions are what they claim,",
    "not what they contain — then put a short list to the maintainer with your",
    "recommendations marked and why each one earns its place. Their answer is",
    "what this work carries:",
    "",
    '  wfctl kit adopt <id>... --attested "<what they said>"',
    "",
    "It is recorded on the flow, so it survives a cleared session: the brief",
    "prints it at the start of the next one.",
  );
  return lines.join("\n");
}

export function renderKit(equipped: KitEntry[]): string {
  if (equipped.length === 0) {
    return [
      "This work is equipped with nothing yet.",
      "",
      "  wfctl kit survey        what this repository and this tool can offer it",
      "",
      "Equipping is not required and it is not a gate. It is worth a survey when",
      "the work is about to touch a checkout you have not worked in, when it is",
      "large enough that its shape matters, or when something else will review it.",
    ].join("\n");
  }

  const lines: string[] = [];
  for (const kind of ["skill", "strategy", "personality"] as const) {
    const group = equipped.filter((entry) => entry.kind === kind);
    if (group.length === 0) continue;
    lines.push(plural(kind));
    for (const entry of group) {
      lines.push(`  ${entry.id}`);
      if (entry.what) lines.push(`      ${entry.what}`);
      lines.push(`      read: ${entry.repository ? `${entry.repository} · ` : ""}${entry.path}`);
    }
    lines.push("");
  }
  lines.push(`Adopted on the maintainer's word: "${equipped[0]?.attested ?? ""}"`);
  return lines.join("\n");
}

/** One line for the brief, which has to stay an index. */
export function summariseKit(equipped: KitEntry[]): string | undefined {
  if (equipped.length === 0) return undefined;
  const counts = (["skill", "strategy", "personality"] as const)
    .map((kind) => [kind, equipped.filter((entry) => entry.kind === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${count === 1 ? kind : plural(kind)}`);
  return `equipped: ${counts.join(", ")}   ·   wfctl kit`;
}

export function assertAdoptable(ids: string[], candidates: KitCandidate[]): KitCandidate[] {
  const known = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new GateRefusal(
      `Nothing here is called ${missing.join(", ")}.`,
      "wfctl kit survey",
      "Ids are exactly as the survey prints them — a skill's is its checkout " +
        "and its name, a strategy's and a personality's is its kind and its name.",
    );
  }
  return ids.map((id) => known.get(id) as KitCandidate);
}
