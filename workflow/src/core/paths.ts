import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { GateRefusal } from "./gates.js";
import { canonical, contains } from "./paths-resolve.js";

/**
 * The agent never types a path.
 *
 * Promotion drafts belong inside their bundle, at the path each page will
 * occupy in curated knowledge. They have repeatedly been written somewhere
 * else — not out of disagreement, but because a path assembled from memory is
 * assembled wrong, and nothing refused it.
 *
 * So the tool creates the file and prints where it is. Anywhere a path is
 * predictable from state, the same rule holds: the tool produces it, the agent
 * fills it.
 */
export function promotionDirectory(knowledgeRoot: string, bundleId: string): string {
  return resolve(knowledgeRoot, "changes", "active", bundleId, "promotion");
}

export async function createPromotionDraft(
  knowledgeRoot: string,
  bundleId: string,
  page: string,
): Promise<string> {
  const normalized = page.replace(/^\/+/, "");
  if (!normalized.trim() || normalized === "." || normalized === "..") {
    throw new GateRefusal(
      "A promotion draft needs the page it will become.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "An empty name resolved to the promotion directory itself and replaced it " +
        "with a file, after which no draft could be created in that record at all.",
    );
  }
  if (!normalized.endsWith(".md")) {
    throw new GateRefusal(
      "A curated page is Markdown.",
      `wfctl work promotion draft "${normalized}.md"`,
    );
  }
  if (normalized.split(/[\\/]/).includes("..")) {
    throw new GateRefusal(
      "A promotion page path may not climb out of the bundle.",
      'wfctl work promotion draft "<area>/<page>.md"',
    );
  }

  const path = resolve(promotionDirectory(knowledgeRoot, bundleId), normalized);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "", { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  return path;
}

/**
 * The write hook's check.
 *
 * A curated page may only be created inside its bundle's promotion directory,
 * and a bundle directory may only be created by the command that opens a flow.
 * Both refusals exist because both were done by hand, repeatedly, and the
 * result was pages that could not be promoted and bundles nobody agreed to.
 */

export function assertWriteAllowed(options: {
  knowledgeRoot: string;
  target: string;
  bundleId?: string;
}): void {
  const target = canonical(options.target);
  const knowledge = canonical(options.knowledgeRoot);
  const rel = relative(knowledge, target);
  if (rel.startsWith("..") || rel === "") return;

  const segments = rel.split(sep);

  if (segments[0] === "knowledge") {
    throw new GateRefusal(
      "A curated page cannot be written directly into knowledge/.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "Pages enter curated knowledge through promotion, which is the " +
        "maintainer's decision. Drafts live in the bundle until then.",
    );
  }

  /**
   * The promotion queue and the archive are guarded too.
   *
   * Only `changes/active` was checked, so a record fabricated straight into
   * `changes/promotion/` appeared in the queue and was promotable having never
   * passed a flow, a recall gate or a review.
   */
  if (segments[0] === "changes" && (segments[1] === "promotion" || segments[1] === "archive")) {
    /**
     * A queued record's drafts stay correctable.
     *
     * `promotion-queue.ts` says so — it is the one lifecycle state where
     * further edits are expected, and refusing them is what made three receipts
     * get hand-written. This module refused every write to the queue, so the
     * two directly contradicted, and a queued record whose page failed
     * validation could not be repaired by any command.
     */
    const correctable =
      segments[1] === "promotion" && segments[3] === "promotion" && segments.length > 4;
    if (!correctable) {
      throw new GateRefusal(
        `${segments[1]} is written by the tool, not by hand.`,
        segments[1] === "promotion"
          ? 'Edit the drafted page under <record>/promotion/, or: wfctl work promotion draft "<area>/<page>.md"'
          : "wfctl work close --outcome <completed|partial|abandoned>",
        "A record that appears here without passing the flow is promotable " +
          "without ever having been reviewed.",
      );
    }
  }

  /** The flow pointer and the trajectory store are the tool's own bookkeeping. */
  if (segments[0] === ".workflow" || segments[0] === "trajectories") {
    throw new GateRefusal(
      `${segments[0]} is the tool's own state.`,
      "wfctl brief",
      "Editing it by hand is how a fence stops holding.",
    );
  }

  if (segments[0] === "changes" && segments[1] === "active") {
    const bundle = segments[2];
    if (!bundle) return;
    if (options.bundleId && bundle !== options.bundleId) {
      throw new GateRefusal(
        `This flow does not own bundle ${bundle}.`,
        "wfctl capture \"<what you found>\"",
        "A finding met during work belongs in the capture inbox, not in a new bundle.",
      );
    }
    if (!options.bundleId) {
      throw new GateRefusal(
        "No flow is open, so no bundle may be created.",
        'wfctl work start --title "<what this is>"',
        "Bundles are opened at flow start, with the maintainer — never by hand " +
          "in the middle of other work.",
      );
    }
  }
}
