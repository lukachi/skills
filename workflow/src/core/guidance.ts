import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkStep } from "./types.js";

/**
 * Guidance is content keyed by state, not by role.
 *
 * The previous corpus was cut by role: one file per job the agent might be
 * doing, each covering that job end to end. A file like that is read once, at
 * the start, for work that then runs for forty turns — so it decays out of
 * attention long before the part that mattered comes up, and measurement said
 * most of it was skimmed on the way in.
 *
 * Cutting the same content by state changes when it arrives rather than how
 * much of it there is. Nothing here is shorter than what it replaces. It is
 * delivered at the moment its state is true, and again the next time that state
 * is true, which is the property a file cannot have.
 */
/**
 * Topics the agent can ask for by name.
 *
 * The managed agent block stays thin on purpose — it is loaded every session
 * and must say only what cannot arrive any other way. Depth belongs here, where
 * it is fetched at the moment it applies rather than read once at turn one and
 * forgotten by the time it matters.
 */
export const GUIDE_TOPICS: Record<string, GuidanceKey> = {
  wfctl: "guide/wfctl",
  recall: "recall/checklist",
  structure: "recall/structure",
  interview: "decide/interview",
  "domain-language": "decide/domain-language",
  prototype: "decide/prototype",
  research: "decide/research",
  adversarial: "verify/adversarial",
  "curate-product": "curate/product",
  "curate-engineering": "curate/engineering",
  quality: "curate/quality",
  routing: "curate/routing",
  discoveries: "work/discoveries",
  wayfind: "work/wayfind",
  scope: "reconstruct/scope",
  crawl: "reconstruct/crawl",
  assemble: "reconstruct/assemble",
  adjudicate: "reconstruct/adjudicate",
  probe: "reconstruct/probe",
  sources: "reconstruct/sources",
};

export type GuidanceKey =
  | `work/${WorkStep}`
  | "work/capture"
  | "work/promotion-path"
  | "recall/checklist"
  | "recall/structure"
  | "guide/wfctl"
  | "decide/interview"
  | "decide/domain-language"
  | "decide/prototype"
  | "decide/research"
  | "curate/product"
  | "curate/engineering"
  | "curate/quality"
  | "curate/routing"
  | "work/discoveries"
  | "work/wayfind"
  | "reconstruct/scope"
  | "reconstruct/crawl"
  | "reconstruct/assemble"
  | "reconstruct/adjudicate"
  | "reconstruct/probe"
  | "reconstruct/sources"
  | "recall/structure"
  | "guide/wfctl"
  | "decide/interview"
  | "decide/domain-language"
  | "decide/prototype"
  | "decide/research"
  | "curate/product"
  | "curate/engineering"
  | "curate/quality"
  | "curate/routing"
  | "work/discoveries"
  | "work/wayfind"
  | "reconstruct/scope"
  | "reconstruct/crawl"
  | "reconstruct/assemble"
  | "reconstruct/adjudicate"
  | "reconstruct/probe"
  | "reconstruct/sources"
  | "verify/adversarial"
  | "session/start"
  /**
   * A growing set, read from the directory rather than named one by one. The
   * kit surveys these; a fixed list here would let one be shipped, surveyed and
   * adopted while the guide command denied it existed.
   */
  | `strategy/${string}`
  | `personality/${string}`;

export interface GuidanceSource {
  /**
   * The directory holding the guidance files themselves — `templates/guidance`
   * in the distribution, `.workflow/guidance` once installed. It names the leaf
   * directory rather than a root to search under, because the two layouts differ
   * and a loader that guessed between them would silently find nothing.
   */
  root: string;
}

/**
 * Missing guidance is not fatal.
 *
 * The command still has to run and still has to refuse for the right reason. A
 * tool that stops working because its prose is absent has made the prose load
 * bearing in the one way it must never be.
 */
export async function loadGuidance(
  source: GuidanceSource,
  key: GuidanceKey,
): Promise<string | undefined> {
  const path = resolve(source.root, `${key}.md`);
  try {
    const text = await readFile(path, "utf8");
    return text.trim().length > 0 ? text.trim() : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Compose what a command prints: the guidance slice for the state, then the
 * mechanical part. Guidance first, because the mechanical part is what the
 * agent will act on and the last thing printed is the thing acted on.
 */
export function compose(parts: (string | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
}
