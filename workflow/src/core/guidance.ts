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
export const GUIDANCE_ROOT = "guidance";

export type GuidanceKey =
  | `work/${WorkStep}`
  | "work/capture"
  | "work/promotion-path"
  | "recall/checklist"
  | "verify/adversarial"
  | "session/start";

export interface GuidanceSource {
  /** Directory holding the installed guidance bundle. */
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
  const path = resolve(source.root, GUIDANCE_ROOT, `${key}.md`);
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
