import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isMissingFileError } from "./config.js";
import {
  APPROVAL_METHODS,
  type ApprovalMethod,
  ATTESTED_APPROVAL_METHODS,
  type MaintainerReviewStage,
  maintainerReviewEntry,
  requiresApprovalReceipt,
} from "./work-spec.js";
import type { WorkSpecDocument } from "./types.js";

/**
 * Maintainer approval receipts.
 *
 * `maintainer_review.framing` and `maintainer_review.completion` used to be
 * ordinary YAML the agent wrote by itself, so an approval gate could be
 * satisfied by the same edit that produced the work it approves. A receipt binds
 * the approval to an ignored runtime file that ordinary record editing does not
 * touch, so forging one requires deliberately writing a second file rather than
 * a one-line YAML edit.
 *
 * Three methods, deliberately unequal, and the record says which one it was.
 *
 * `interactive` and `token` prove a command ran outside the agent's own writing.
 * They prove nothing else — not who typed it, not that they read the framing.
 *
 * `attested` is the ordinary path, because the ordinary case is a maintainer who
 * already answered in conversation. Demanding they open a second terminal and
 * retype a generated bundle id, a stage name and their own identity moves no
 * decision and adds no evidence: it relocates the same answer to a less
 * convenient channel and calls the relocation rigour. What the other two buy is
 * a receipt the agent cannot mint, which is why they stay — but as the stronger
 * record a maintainer asks for, not the default imposed on them.
 *
 * An agent can fabricate an attestation. What the field buys is that fabricating
 * becomes a lie in a named place rather than an absence, and a lie in a field
 * that reads "here is what you said" is found by the person who said it.
 */

export interface ApprovalRecord {
  schemaVersion: 1;
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  at: string;
  method: ApprovalMethod;
  note: string;
  /** The maintainer's own words, for an attested approval. */
  attested?: string;
  /** Where those words were said, so they can be read back. */
  session?: string;
  receipt: string;
}

export interface RecordApprovalOptions {
  knowledgeRoot: string;
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  method: ApprovalMethod;
  note?: string;
  attested?: string;
  session?: string;
  now?: Date;
}

/**
 * The separator is an escaped NUL rather than a literal one. It was written as a
 * raw 0x00 byte, which JavaScript accepts inside a string and every text tool
 * treats as the mark of a binary file: grep skipped this file, and a reader saw
 * a space where the separator is.
 *
 * The attestation joins the digest only when there is one, so every receipt
 * written before attested approvals existed still verifies byte for byte.
 */
export function approvalReceiptDigest(input: {
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  at: string;
  method: ApprovalMethod;
  attested?: string;
}): string {
  const parts = [input.id, input.stage, input.by, input.at, input.method];
  if (input.attested) {
    parts.push(input.attested);
  }
  return createHash("sha256").update(parts.join("\0"), "utf8").digest("hex");
}

export function approvalRecordPath(
  knowledgeRoot: string,
  id: string,
  stage: MaintainerReviewStage,
): string {
  return join(knowledgeRoot, ".workflow/current/approvals", id, `${stage}.json`);
}

/**
 * Who is approving, and by what means — checked before anything about what is
 * being approved. An agent recording itself as the maintainer is a different
 * kind of wrong from a framing that is not ready, and being told to go read
 * repositories would bury it.
 */
export function approvalIdentityIssue(
  by: string,
  method: ApprovalMethod,
  attested: string,
): string {
  if (!by.startsWith("human:") || by.trim().length <= "human:".length) {
    return "Maintainer approval requires --by human:<maintainer-id>";
  }
  if (!APPROVAL_METHODS.includes(method)) {
    return `Unsupported approval method: ${method}`;
  }
  if (ATTESTED_APPROVAL_METHODS.has(method) && !attested.trim()) {
    return "An attested approval requires the maintainer's own answer; without it there is "
      + "nothing distinguishing a recorded decision from an invented one";
  }
  if (!ATTESTED_APPROVAL_METHODS.has(method) && attested.trim()) {
    return `A ${method} approval carries its own proof; do not also record an attestation`;
  }
  return "";
}

export async function recordApproval(
  options: RecordApprovalOptions,
): Promise<ApprovalRecord> {
  if (!options.by.startsWith("human:") || options.by.trim().length <= "human:".length) {
    throw new Error("Maintainer approval requires --by human:<maintainer-id>");
  }
  if (!APPROVAL_METHODS.includes(options.method)) {
    throw new Error(`Unsupported approval method: ${options.method}`);
  }
  const attested = (options.attested ?? "").trim();
  if (ATTESTED_APPROVAL_METHODS.has(options.method) && !attested) {
    throw new Error(
      "An attested approval requires the maintainer's own answer; without it there is "
        + "nothing distinguishing a recorded decision from an invented one",
    );
  }
  if (!ATTESTED_APPROVAL_METHODS.has(options.method) && attested) {
    throw new Error(
      `A ${options.method} approval carries its own proof; do not also record an attestation`,
    );
  }
  const at = (options.now ?? new Date()).toISOString();
  const record: ApprovalRecord = {
    schemaVersion: 1,
    id: options.id,
    stage: options.stage,
    by: options.by.trim(),
    at,
    method: options.method,
    note: (options.note ?? "").trim(),
    ...(attested ? { attested, session: (options.session ?? "").trim() } : {}),
    receipt: approvalReceiptDigest({
      id: options.id,
      stage: options.stage,
      by: options.by.trim(),
      at,
      method: options.method,
      ...(attested ? { attested } : {}),
    }),
  };
  const path = approvalRecordPath(options.knowledgeRoot, options.id, options.stage);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export async function readApproval(
  knowledgeRoot: string,
  id: string,
  stage: MaintainerReviewStage,
): Promise<ApprovalRecord | undefined> {
  try {
    const raw = JSON.parse(
      await readFile(approvalRecordPath(knowledgeRoot, id, stage), "utf8"),
    ) as unknown;
    return isApprovalRecord(raw) ? raw : undefined;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Reconcile the recorded approvals with the receipts written into `change.md`.
 * Bundles created before approval receipts existed are exempt so an upgrade
 * cannot invalidate work already approved under the previous contract.
 */
export async function approvalIssues(
  knowledgeRoot: string,
  id: string,
  document: WorkSpecDocument,
): Promise<string[]> {
  if (!requiresApprovalReceipt(document)) {
    return [];
  }
  const issues: string[] = [];
  for (const stage of ["framing", "completion", "promotion"] as const) {
    const entry = maintainerReviewEntry(document, stage);
    const prefix = `maintainer_review.${stage}`;
    const receipt = typeof entry?.receipt === "string" ? entry.receipt : "";
    if (!receipt) {
      // A stage nobody has answered is not a broken receipt. Whether its absence
      // blocks anything is decided by the gate that needs it — the framing gate,
      // the promotion gate, or a drift check — and reported in those terms.
      continue;
    }
    const record = await readApproval(knowledgeRoot, id, stage);
    if (!record) {
      issues.push(
        `${prefix}.receipt has no recorded approval; re-run wfctl work approve --stage ${stage}`,
      );
      continue;
    }
    if (record.receipt !== receipt) {
      issues.push(`${prefix}.receipt does not match the recorded approval`);
    }
    if (record.by !== (typeof entry?.by === "string" ? entry.by : "")) {
      issues.push(`${prefix}.by does not match the recorded approval actor`);
    }
    if (record.at !== (typeof entry?.at === "string" ? entry.at : "")) {
      issues.push(`${prefix}.at does not match the recorded approval time`);
    }
    if (record.method !== (typeof entry?.method === "string" ? entry.method : "")) {
      issues.push(`${prefix}.method does not match the recorded approval method`);
    }
    if (
      record.receipt !== approvalReceiptDigest({
        id,
        stage,
        by: record.by,
        at: record.at,
        method: record.method,
        ...(record.attested ? { attested: record.attested } : {}),
      })
    ) {
      issues.push(`${prefix}: the recorded approval digest is inconsistent`);
    }
    // An attested approval rests entirely on the maintainer's own words being
    // there to read. Losing them leaves a receipt that proves only that the
    // agent wrote a file.
    if (ATTESTED_APPROVAL_METHODS.has(record.method) && !record.attested?.trim()) {
      issues.push(`${prefix}: an attested approval carries no record of what was said`);
    }
  }
  return issues;
}

function isApprovalRecord(value: unknown): value is ApprovalRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.id === "string"
    && (record.stage === "framing" || record.stage === "completion"
      || record.stage === "promotion")
    && typeof record.by === "string"
    && typeof record.at === "string"
    && APPROVAL_METHODS.includes(record.method as ApprovalMethod)
    && typeof record.note === "string"
    // Absent on every receipt written before attested approvals existed.
    && (record.attested === undefined || typeof record.attested === "string")
    && (record.session === undefined || typeof record.session === "string")
    && typeof record.receipt === "string";
}
