import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * The promotion queue.
 *
 * A record that closes holding drafted pages waits here rather than archiving,
 * **whatever its outcome**. The previous implementation routed only a
 * `completed` outcome to the queue and archived everything else, which silently
 * lost the pages of every honestly-partial delivery — and a partial delivery is
 * exactly when there is most to say about what the project now knows.
 */
export const ACTIVE = "changes/active";
export const QUEUE = "changes/promotion";
export const ARCHIVE = "changes/archive";

export type Outcome = "completed" | "partial" | "abandoned";

export function destinationFor(outcome: Outcome, hasDrafts: boolean): typeof QUEUE | typeof ARCHIVE {
  return hasDrafts ? QUEUE : ARCHIVE;
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then(
    (entry) => entry.isDirectory(),
    () => false,
  );
}

export async function hasDraftedPages(knowledgeRoot: string, bundleId: string): Promise<boolean> {
  const promotion = resolve(knowledgeRoot, ACTIVE, bundleId, "promotion");
  if (!(await isDirectory(promotion))) return false;
  const entries = await readdir(promotion, { recursive: true, withFileTypes: true });
  return entries.some((entry) => entry.isFile() && entry.name.endsWith(".md"));
}

export interface CloseResult {
  from: string;
  to: string;
  outcome: Outcome;
  waitingOnPromotion: boolean;
}

export async function closeBundle(options: {
  knowledgeRoot: string;
  bundleId: string;
  outcome: Outcome;
}): Promise<CloseResult> {
  const from = resolve(options.knowledgeRoot, ACTIVE, options.bundleId);
  if (!(await isDirectory(from))) {
    throw new GateRefusal(
      `No active record named ${options.bundleId}.`,
      "wfctl work promotion list",
    );
  }

  const drafts = await hasDraftedPages(options.knowledgeRoot, options.bundleId);
  const destination = destinationFor(options.outcome, drafts);
  const to = resolve(options.knowledgeRoot, destination, options.bundleId);

  await mkdir(resolve(options.knowledgeRoot, destination), { recursive: true });
  await rename(from, to);

  return { from, to, outcome: options.outcome, waitingOnPromotion: destination === QUEUE };
}

/**
 * Correcting a page that is already in the queue.
 *
 * The rules said to rewrite the draft, reseal it and refresh its receipt, and
 * the tool refused every route to a receipt on a closed record — so three
 * receipts were written by hand to get pages promoted, which is exactly what
 * this workflow tells everyone not to trust.
 *
 * A record in the queue is deliberately still correctable. It is the one
 * lifecycle state where further edits are expected: the pages are what the queue
 * exists to hold, and the maintainer has not answered for them yet.
 */
export async function assertCorrectable(knowledgeRoot: string, bundleId: string): Promise<string> {
  const queued = resolve(knowledgeRoot, QUEUE, bundleId);
  if (await isDirectory(queued)) return queued;

  const active = resolve(knowledgeRoot, ACTIVE, bundleId);
  if (await isDirectory(active)) return active;

  const archived = resolve(knowledgeRoot, ARCHIVE, bundleId);
  if (await isDirectory(archived)) {
    throw new GateRefusal(
      `${bundleId} is archived; its pages are already in curated knowledge.`,
      "Correct the curated page through a new flow.",
      "An archived record is history. Editing it would change what the project " +
        "says it decided, without anything recording that it changed.",
    );
  }

  throw new GateRefusal(`No record named ${bundleId}.`, "wfctl work promotion list");
}

export async function listQueue(knowledgeRoot: string): Promise<string[]> {
  const path = resolve(knowledgeRoot, QUEUE);
  if (!(await isDirectory(path))) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function promote(options: {
  knowledgeRoot: string;
  bundleId: string;
}): Promise<{ archived: string }> {
  const queued = resolve(options.knowledgeRoot, QUEUE, options.bundleId);
  if (!(await isDirectory(queued))) {
    throw new GateRefusal(
      `${options.bundleId} is not waiting in the promotion queue.`,
      "wfctl work promotion list",
    );
  }
  const archived = resolve(options.knowledgeRoot, ARCHIVE, options.bundleId);
  await mkdir(resolve(options.knowledgeRoot, ARCHIVE), { recursive: true });
  await rename(queued, archived);
  return { archived };
}

export function queuePath(knowledgeRoot: string, bundleId: string): string {
  return join(resolve(knowledgeRoot, QUEUE), bundleId);
}
