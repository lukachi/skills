import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isRecord, parseWorkSpec, serializeWorkSpec } from "./work-spec.js";

/**
 * A bundle deliberately not to be started, held as state rather than as prose.
 *
 * It was prose, and prose is not a gate. A bundle's checkpoint said "PARKED ON
 * PURPOSE ... do not start", the delivery gate read only whether the framing was
 * approved, and the work ran: six commits across three source repositories the
 * knowledge base still cites as what the source shows now.
 *
 * The deeper fault was that one approval carried two meanings. The maintainer
 * approved a framing in his own words to get it out of his queue — "чтобы оно не
 * мешалось" — and said in the same breath that starting was premature. The tool
 * had no way to hold both, so the approval became the key that started the work.
 * `park` separates them: approving a framing settles what the work *is*, and
 * releasing settles when it *begins*, and neither implies the other.
 *
 * Releasing takes the maintainer's own words for the same reason declaring a
 * vision does. Answering an unrelated factual question is not a release, and
 * that is exactly how this one was read: the agent asked whether anything was in
 * production, got a truthful "no", and treated it as permission.
 */

export interface ParkRecord {
  at: string;
  by: string;
  reason: string;
  /** The maintainer's own words, so a release cannot be inferred from a mood. */
  attested: string;
}

export interface ParkOptions {
  target: string;
  id: string;
  by: string;
  reason: string;
  attested?: string;
  now?: Date;
}

export interface ParkResult {
  id: string;
  path: string;
  parked: boolean;
  reason: string;
}

export async function parkWork(options: ParkOptions): Promise<ParkResult> {
  const { path, document } = await readBundle(options.target, options.id);
  const by = requireMaintainer(options.by);
  const reason = options.reason.trim();
  if (!reason) {
    throw new Error(
      "Parking requires a reason. A bundle held for no stated reason is "
        + "indistinguishable from one nobody got to, and the next session starts it.",
    );
  }
  document.metadata.parked = {
    at: (options.now ?? new Date()).toISOString(),
    by,
    reason,
    attested: (options.attested ?? "").trim(),
  } satisfies ParkRecord;
  await writeFile(path, serializeWorkSpec(document), "utf8");
  return { id: options.id, path, parked: true, reason };
}

export interface ReleaseOptions {
  target: string;
  id: string;
  by: string;
  attested: string;
  now?: Date;
}

export async function releaseWork(options: ReleaseOptions): Promise<ParkResult> {
  const { path, document } = await readBundle(options.target, options.id);
  const by = requireMaintainer(options.by);
  const park = readPark(document.metadata);
  if (!park) {
    throw new Error(`${options.id} is not parked; there is nothing to release`);
  }
  const attested = options.attested.trim();
  if (!attested) {
    throw new Error(
      "Releasing a parked bundle requires the maintainer's own words saying to start it. "
        + "An answer to some other question is not a release: the last time one was inferred, "
        + "a truthful 'nothing is in production' was read as permission and six commits followed.",
    );
  }
  // The park stays readable in the record it governed rather than being deleted,
  // so a reader can see that starting was once deliberately withheld and by whom.
  document.metadata.released = {
    at: (options.now ?? new Date()).toISOString(),
    by,
    attested,
    was_parked_at: park.at,
    was_parked_because: park.reason,
  };
  delete document.metadata.parked;
  await writeFile(path, serializeWorkSpec(document), "utf8");
  return { id: options.id, path, parked: false, reason: park.reason };
}

export function readPark(metadata: Record<string, unknown>): ParkRecord | undefined {
  const value = metadata.parked;
  if (!isRecord(value)) {
    return undefined;
  }
  const at = text(value.at);
  const by = text(value.by);
  const reason = text(value.reason);
  return at && by && reason ? { at, by, reason, attested: text(value.attested) } : undefined;
}

async function readBundle(target: string, id: string) {
  const path = join(resolve(target), "changes/active", id, "change.md");
  return { path, document: parseWorkSpec(await readFile(path, "utf8")) };
}

function requireMaintainer(by: string): string {
  const trimmed = by.trim();
  if (!trimmed.startsWith("human:") || trimmed.length <= "human:".length) {
    throw new Error("Parking and releasing are the maintainer's; pass --by human:<id>");
  }
  return trimmed;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
