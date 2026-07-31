import { parse, stringify } from "yaml";
import type { WorkSpecDocument } from "./types.js";

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

  if (metadata.workflow_version !== 2 && metadata.workflow_version !== 3) {
    issues.push("workflow_version must be 2 or 3");
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

  if (!nonEmptyArray(alignment?.reviewed)) {
    issues.push("knowledge_alignment.reviewed must contain at least one concept");
  }
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
  if (!Array.isArray(alignment?.conflicts) || alignment.conflicts.length > 0) {
    issues.push("knowledge_alignment.conflicts must be resolved");
  }
  reviewIssues("framing", maintainerReview, issues);
  reviewIssues("completion", maintainerReview, issues);
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
    containsUntrustedIntakePath(document.body)
    || containsUntrustedIntakePath(JSON.stringify(document.metadata))
  ) {
    issues.push("project change records must not cite raw/ or intake/ paths");
  }

  return issues;
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

function containsUntrustedIntakePath(content: string): boolean {
  return /(?:^|[\s("'`:=])(?:(?:\.\.\/|\.\/|\/)*(?:raw|intake)\/|(?:raw|intake):)[^\s)"'`]*/im.test(content);
}

function reviewIssues(
  stage: "framing" | "completion",
  review: Record<string, unknown> | undefined,
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
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
