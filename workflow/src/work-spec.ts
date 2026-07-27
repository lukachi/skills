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
  const mode = stringValue(metadata.mode);
  const verification = recordValue(metadata.verification);
  const alignment = recordValue(metadata.knowledge_alignment);
  const graph = recordValue(metadata.graph_evidence);

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
  if (verification?.implementation_reviewed !== true) {
    issues.push("verification.implementation_reviewed must be true");
  }
  if (!nonEmptyArray(verification?.checks)) {
    issues.push("verification.checks must contain fresh evidence");
  }
  if (!Array.isArray(verification?.unresolved) || verification.unresolved.length > 0) {
    issues.push("verification.unresolved must be an empty list");
  }

  if (mode !== "handoff") {
    if (!nonEmptyArray(alignment?.reviewed)) {
      issues.push("knowledge_alignment.reviewed must contain at least one concept");
    }
    if (!nonEmptyArray(graph?.queries)) {
      issues.push("graph_evidence.queries must contain at least one query");
    }
    if (!Array.isArray(alignment?.conflicts) || alignment.conflicts.length > 0) {
      issues.push("knowledge_alignment.conflicts must be resolved");
    }
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
