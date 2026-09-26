import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Named, on-demand guidance for decisions and reconstruction. */
export const GUIDE_TOPICS: Record<string, GuidanceKey> = {
  interview: "decide/interview",
  "domain-language": "decide/domain-language",
  prototype: "decide/prototype",
  research: "decide/research",
  scope: "reconstruct/scope",
  crawl: "reconstruct/crawl",
  assemble: "reconstruct/assemble",
  adjudicate: "reconstruct/adjudicate",
  probe: "reconstruct/probe",
  sources: "reconstruct/sources",
};

export type GuidanceKey =
  | "decide/interview"
  | "decide/domain-language"
  | "decide/prototype"
  | "decide/research"
  | "reconstruct/scope"
  | "reconstruct/crawl"
  | "reconstruct/assemble"
  | "reconstruct/adjudicate"
  | "reconstruct/probe"
  | "reconstruct/sources"
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
