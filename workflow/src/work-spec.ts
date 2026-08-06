import { parse, stringify } from "yaml";
import type { WorkSpecDocument } from "./types.js";
import { containsUntrustedIntakeReference } from "./untrusted-paths.js";

/**
 * Every change-bundle schema this build can read. A new schema version must be
 * added here, to `GATED_CHANGE_VERSIONS`, and to the bundle template, or the
 * completion gate silently stops running for every newly created bundle.
 */
export const SUPPORTED_CHANGE_VERSIONS = [2, 3, 4, 5] as const;

/**
 * Change-bundle schemas whose bundle-level completion gate is enforced by
 * `bundleCompletionIssues`. Version 2 predates the bundle layout and is exempt;
 * every later schema must be listed here.
 */
export const GATED_CHANGE_VERSIONS = [3, 4, 5] as const;

/** Change schemas that must carry an interactive maintainer-approval receipt. */
export const APPROVAL_RECEIPT_CHANGE_VERSIONS = [5] as const;

export const SUPPORTED_ISSUE_VERSIONS = [1, 2, 3] as const;
export const SUPPORTED_MAP_VERSION = 1;
export const SUPPORTED_REVIEW_VERSION = 1;
export const CURRENT_CHANGE_VERSION = 5;

export const APPROVAL_METHODS = ["attested", "interactive", "token"] as const;
export type ApprovalMethod = (typeof APPROVAL_METHODS)[number];

/** Methods whose authority rests on a recorded answer rather than a channel. */
export const ATTESTED_APPROVAL_METHODS = new Set<ApprovalMethod>(["attested"]);
export type MaintainerReviewStage = "framing" | "completion";

export function includesVersion(allowed: readonly number[], value: unknown): boolean {
  return allowed.includes(Number(value));
}

/**
 * What must be true about the source repositories before a framing is settled.
 *
 * Work that spans more than one repository can only be shaped from the centre,
 * and the centre cannot see what each repository declares about itself unless it
 * goes and reads it. Nothing used to require that, and nothing reported its
 * absence: the only check that mentioned source evidence at all was one flat
 * "at least one graph query" at the closing gate, which a three-repository
 * bundle satisfied by looking at one repository.
 *
 * So the accounting is per repository and it runs before approval, because
 * afterwards it is paperwork — the direction is chosen, the acceptance criteria
 * are written, and filling the field changes nothing except whether the gate
 * opens. Every bound repository is either read on its own terms or declared
 * untouched with a reason. Saying nothing is not one of the options.
 */
export function repositoryAccountingIssues(document: WorkSpecDocument): string[] {
  const issues: string[] = [];
  const repositories = Array.isArray(document.metadata.repositories)
    ? document.metadata.repositories.filter(isRecord)
    : [];
  for (const entry of repositories) {
    const name = stringValue(entry.repository) || "(unnamed repository)";
    const accounted = isRecord(entry.accounted) ? entry.accounted : undefined;
    const status = stringValue(accounted?.status);
    if (status !== "read" && status !== "untouched") {
      issues.push(
        `${name} has not been accounted for: read what it declares about itself, or record why this work does not touch it`,
      );
      continue;
    }
    if (status === "untouched" && !stringValue(accounted?.reason).trim()) {
      issues.push(`${name} is declared untouched without a reason`);
    }
    if (status === "read" && !stringValue(accounted?.note).trim()) {
      issues.push(
        `${name} was accounted for without saying what its own rules require of this work`,
      );
    }
  }
  return issues;
}

/**
 * The alignment gate, in a shape an honest answer can pass.
 *
 * A project installed into this workflow starts with an empty knowledge base,
 * and most first tasks run before anyone pays for a reconstruction. Demanding a
 * non-empty list of reviewed concepts there leaves one way through: invent a
 * path. That is worse than no gate, because a fabricated concept path reads
 * exactly like a real one. So absence is a legal answer — stated, with what the
 * contract rested on instead — and only silence is refused.
 */
export function alignmentIssues(document: WorkSpecDocument): string[] {
  const issues: string[] = [];
  const alignment = isRecord(document.metadata.knowledge_alignment)
    ? document.metadata.knowledge_alignment
    : undefined;
  const reviewed = Array.isArray(alignment?.reviewed) ? alignment.reviewed : [];
  const covered = alignment?.covered;
  if (reviewed.length === 0) {
    if (covered !== false) {
      issues.push(
        "knowledge_alignment must name the concepts reviewed, or record covered: false with the basis the contract rests on instead",
      );
    } else if (!stringValue(alignment?.basis).trim()) {
      issues.push(
        "knowledge_alignment.basis must say what the contract rests on when no curated concept covers this work",
      );
    }
  }
  if (!Array.isArray(alignment?.conflicts) || alignment.conflicts.length > 0) {
    issues.push("knowledge_alignment.conflicts must be resolved");
  }
  return issues;
}

/** Everything that must hold before a maintainer is asked to approve a framing. */
export function framingIssues(document: WorkSpecDocument): string[] {
  return [...alignmentIssues(document), ...repositoryAccountingIssues(document)];
}

export function parseWorkSpec(content: string): WorkSpecDocument {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error("Work spec must start with YAML frontmatter");
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    throw new Error("Work spec frontmatter is not closed");
  }
  const metadata = parse(lines.slice(1, end).join("\n")) as unknown;
  if (!isRecord(metadata)) {
    throw new Error("Work spec frontmatter must be a mapping");
  }
  return {
    metadata,
    body: lines.slice(end + 1).join("\n").replace(/^\n/, ""),
  };
}

export function serializeWorkSpec(document: WorkSpecDocument): string {
  return `---\n${stringify(document.metadata, { lineWidth: 0 }).trimEnd()}\n---\n\n${document.body.trimStart()}`;
}

export function completionIssues(document: WorkSpecDocument, requireCompleted: boolean): string[] {
  const issues: string[] = [];
  const metadata = document.metadata;
  const verification = recordValue(metadata.verification);
  const alignment = recordValue(metadata.knowledge_alignment);
  const graph = recordValue(metadata.graph_evidence);
  const maintainerReview = recordValue(metadata.maintainer_review);
  const promotion = recordValue(metadata.knowledge_promotion);
  const scope = stringValue(metadata.scope) || "leaf";
  const projectOnly = scope === "project";

  if (!includesVersion(SUPPORTED_CHANGE_VERSIONS, metadata.workflow_version)) {
    issues.push(
      `workflow_version must be one of ${SUPPORTED_CHANGE_VERSIONS.join(", ")}`,
    );
  }
  if (
    Number(metadata.workflow_version) >= 5
    && !/^# Discovery ledger\s*$/m.test(document.body)
  ) {
    issues.push("Discovery ledger section is required");
  }
  if (requireCompleted && metadata.status !== "completed") {
    issues.push("status must be completed");
  }
  if (/^\s*-\s+\[ \]/m.test(document.body)) {
    issues.push("unchecked plan or acceptance items remain");
  }
  if (!verification || verification.result !== "passed") {
    issues.push("verification.result must be passed");
  }
  if (verification?.acceptance_reviewed !== true) {
    issues.push("verification.acceptance_reviewed must be true");
  }
  if (!projectOnly && verification?.implementation_reviewed !== true) {
    issues.push("verification.implementation_reviewed must be true");
  }
  if (projectOnly && verification?.knowledge_reviewed !== true) {
    issues.push("verification.knowledge_reviewed must be true for project-only work");
  }
  if (!nonEmptyArray(verification?.checks)) {
    issues.push("verification.checks must contain fresh evidence");
  }
  if (!Array.isArray(verification?.unresolved) || verification.unresolved.length > 0) {
    issues.push("verification.unresolved must be an empty list");
  }

  // The same two gates the framing had to pass, re-checked here because a
  // bundle can be edited after approval and because bundles created before
  // these gates existed reach completion without ever having met them.
  issues.push(...alignmentIssues(document));
  issues.push(...repositoryAccountingIssues(document));
  if (!projectOnly && !nonEmptyArray(graph?.queries)) {
    issues.push("graph_evidence.queries must contain at least one query");
  }
  if (
    scope === "leaf"
    && !/^[0-9a-f]{40}$/i.test(stringValue(verification?.revision))
  ) {
    issues.push("verification.revision must pin the verified Git commit");
  }
  if (scope === "leaf" && !stringValue(verification?.worktree_id).trim()) {
    issues.push("verification.worktree_id must identify the verified checkout");
  }
  const requiresApprovalReceipt = includesVersion(
    APPROVAL_RECEIPT_CHANGE_VERSIONS,
    metadata.workflow_version,
  );
  reviewIssues("framing", maintainerReview, requiresApprovalReceipt, issues);
  reviewIssues("completion", maintainerReview, requiresApprovalReceipt, issues);
  if (promotion?.status !== "applied" && promotion?.status !== "not-needed") {
    issues.push("knowledge_promotion.status must be applied or not-needed");
  } else if (
    promotion.status === "applied"
    && !nonEmptyStringArray(promotion.concepts)
  ) {
    issues.push("knowledge_promotion.concepts must list every updated concept");
  } else if (
    promotion.status === "applied"
    && (promotion.concepts as string[]).some((path) => /(?:^|\/)(?:index|log)\.md$/i.test(path))
  ) {
    issues.push("knowledge_promotion.concepts must list concept files, not index.md or log.md");
  } else if (
    promotion.status === "not-needed"
    && !stringValue(promotion.reason).trim()
  ) {
    issues.push("knowledge_promotion.reason must explain why no current knowledge changed");
  }
  if (
    containsUntrustedIntakeReference(document.body)
    || containsUntrustedIntakeReference(JSON.stringify(document.metadata))
  ) {
    issues.push("project change records must not cite raw/ or intake/ paths");
  }

  return issues;
}

export function maintainerReviewEntry(
  document: WorkSpecDocument,
  stage: MaintainerReviewStage,
): Record<string, unknown> | undefined {
  return recordValue(recordValue(document.metadata.maintainer_review)?.[stage]);
}

export function requiresApprovalReceipt(document: WorkSpecDocument): boolean {
  return includesVersion(
    APPROVAL_RECEIPT_CHANGE_VERSIONS,
    document.metadata.workflow_version,
  );
}

/**
 * How a checkpoint's list of small jobs changes.
 *
 * Three intents rather than one replacement, because the common edit is not
 * "here is the whole list again" — it is "one more thing" or "that one is done".
 * Resolving them where the carried list lives keeps a caller that mentions
 * nothing from silently emptying it.
 */
export interface TodoEdit {
  /** Replace the list outright. */
  set?: string[];
  /** Append, keeping what is carried. */
  add?: string[];
  /** Drop every carried entry containing any of these phrases, case-insensitively. */
  drop?: string[];
}

export function resolveTodo(carried: readonly string[], edit: TodoEdit | undefined): string[] {
  const base = edit?.set ?? [...carried];
  const dropped = (edit?.drop ?? []).map((phrase) => phrase.trim().toLowerCase()).filter(Boolean);
  const kept = dropped.length === 0
    ? base
    : base.filter((entry) => !dropped.some((phrase) => entry.toLowerCase().includes(phrase)));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of [...kept, ...(edit?.add ?? [])]) {
    const trimmed = entry.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function nonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function reviewIssues(
  stage: MaintainerReviewStage,
  review: Record<string, unknown> | undefined,
  requireReceipt: boolean,
  issues: string[],
): void {
  const entry = recordValue(review?.[stage]);
  const prefix = `maintainer_review.${stage}`;
  if (entry?.status !== "approved") {
    issues.push(`${prefix}.status must be approved`);
  }
  if (!stringValue(entry?.by).startsWith("human:")) {
    issues.push(`${prefix}.by must identify a human actor`);
  }
  if (!isIsoDateTime(stringValue(entry?.at))) {
    issues.push(`${prefix}.at must be an ISO 8601 datetime`);
  }
  if (!requireReceipt) {
    return;
  }
  const method = stringValue(entry?.method);
  if (!APPROVAL_METHODS.includes(method as ApprovalMethod)) {
    issues.push(
      `${prefix}.method must be recorded by wfctl work approve (${
        APPROVAL_METHODS.join(" or ")
      })`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(stringValue(entry?.receipt))) {
    issues.push(`${prefix}.receipt must be the wfctl work approve receipt digest`);
  }
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
