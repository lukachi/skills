import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { WorkSpecDocument } from "./types.js";
import { isRecord, parseWorkSpec } from "./work-spec.js";

export type KnowledgeSessionStatus = "active" | "blocked" | "complete";

export interface KnowledgeSessionCheckpointInput {
  status: KnowledgeSessionStatus;
  stage: string;
  actor: string;
  currentState: string;
  lastCompleted: string;
  nextAction: string;
  blockers?: string[];
  now?: Date;
}

export interface KnowledgeSessionCheckpointSummary {
  status: KnowledgeSessionStatus;
  stage: string;
  actor: string;
  currentState: string;
  lastCompleted: string;
  nextAction: string;
  blockers: string[];
  updatedAt: string;
  basisSha256: string;
  currentBasisSha256: string;
  valid: boolean;
  issues: string[];
}

export interface KnowledgeSessionFile {
  path: string;
  role: string;
  sha256: string;
  bytes: number;
}

export interface RelatedSessionContent {
  path: string;
  content: string | Buffer;
}

export async function selectActiveCase(
  activeRoot: string,
  requestedId: string | undefined,
  label: string,
): Promise<{ id: string; path: string; title: string }> {
  if (requestedId) {
    assertCaseId(requestedId, label);
    const path = join(activeRoot, requestedId, "case.md");
    const document = parseWorkSpec(await readFile(path, "utf8"));
    return { id: requestedId, path, title: stringValue(document.metadata.title) || requestedId };
  }

  const entries = await readdir(activeRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingDirectory(error)) {
      return [];
    }
    throw error;
  });
  const cases: Array<{ id: string; path: string; title: string }> = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(entry.name)) {
      continue;
    }
    const path = join(activeRoot, entry.name, "case.md");
    try {
      const document = parseWorkSpec(await readFile(path, "utf8"));
      cases.push({
        id: entry.name,
        path,
        title: stringValue(document.metadata.title) || entry.name,
      });
    } catch {
      cases.push({ id: entry.name, path, title: "invalid or unreadable case" });
    }
  }
  cases.sort((left, right) => left.id.localeCompare(right.id));
  if (cases.length === 0) {
    throw new Error(`No active ${label} cases. Start one before attempting to resume.`);
  }
  if (cases.length > 1) {
    throw new Error(
      `Multiple active ${label} cases; do not guess which one owns this session:\n`
        + cases.map((entry) => `- ${entry.id} — ${entry.title}`).join("\n")
        + `\nInspect the titles and ask the maintainer when ownership is still ambiguous.`,
    );
  }
  return cases[0]!;
}

/**
 * Both serializers write a blank line after the closing `---`, and the parsers
 * disagree about whether that line belongs to the body: `parseWorkSpec` strips
 * it, the intake-local `parseCase` keeps it. Two callers reading the same bytes
 * through different parsers therefore produced different digests for identical
 * content, forever.
 *
 * A basis has to identify the record, not the route taken to read it, so the
 * body is normalized here. The leading blank line is never content: writing
 * always applies `trimStart()`, so nothing can put one there deliberately.
 */
function basisBody(body: string): string {
  return body.replace(/^\n+/, "");
}

export function sessionBasis(
  document: WorkSpecDocument,
  related: RelatedSessionContent[] = [],
): string {
  const metadata = { ...document.metadata };
  delete metadata.checkpoint;
  delete metadata.updated_at;
  const hash = createHash("sha256");
  hash.update(JSON.stringify(stableValue({ metadata, body: basisBody(document.body) })));
  for (const entry of [...related].sort((left, right) => left.path.localeCompare(right.path))) {
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");
    hash.update("\0");
    hash.update(entry.path);
    hash.update("\0");
    hash.update(content);
  }
  return hash.digest("hex");
}

export function writeSessionCheckpoint(
  document: WorkSpecDocument,
  input: KnowledgeSessionCheckpointInput,
  basis: string,
): void {
  const now = input.now ?? new Date();
  document.metadata.checkpoint = {
    status: input.status,
    stage: requireText(input.stage, "stage"),
    actor: requireText(input.actor, "actor"),
    current_state: requireText(input.currentState, "current state"),
    last_completed: requireText(input.lastCompleted, "last completed action"),
    next_action: requireText(input.nextAction, "next action"),
    blockers: uniqueStrings(input.blockers ?? []),
    updated_at: now.toISOString(),
    basis_sha256: basis,
  };
  document.metadata.updated_at = now.toISOString();
}

export function inspectSessionCheckpoint(
  document: WorkSpecDocument,
  currentBasis: string,
  allowedStages: readonly string[],
  required: boolean,
): KnowledgeSessionCheckpointSummary | undefined {
  const checkpoint = isRecord(document.metadata.checkpoint)
    ? document.metadata.checkpoint
    : undefined;
  if (!checkpoint) {
    return required
      ? invalidCheckpoint(currentBasis, ["checkpoint is required for this session record"])
      : undefined;
  }
  const issues: string[] = [];
  const status = stringValue(checkpoint.status);
  const stage = stringValue(checkpoint.stage);
  const actor = stringValue(checkpoint.actor);
  const currentState = stringValue(checkpoint.current_state);
  const lastCompleted = stringValue(checkpoint.last_completed);
  const nextAction = stringValue(checkpoint.next_action);
  const blockers = stringArray(checkpoint.blockers);
  const updatedAt = stringValue(checkpoint.updated_at);
  const basisSha256 = stringValue(checkpoint.basis_sha256);
  if (!(["active", "blocked", "complete"] as string[]).includes(status)) {
    issues.push("checkpoint.status must be active, blocked, or complete");
  }
  if (!allowedStages.includes(stage)) {
    issues.push(`checkpoint.stage must be one of: ${allowedStages.join(", ")}`);
  }
  for (const [label, value] of [
    ["actor", actor],
    ["current_state", currentState],
    ["last_completed", lastCompleted],
    ["next_action", nextAction],
  ] as Array<[string, string]>) {
    if (!value.trim()) {
      issues.push(`checkpoint.${label} must not be empty`);
    }
  }
  if (!Array.isArray(checkpoint.blockers) || blockers.length !== checkpoint.blockers.length) {
    issues.push("checkpoint.blockers must contain strings only");
  }
  if (!isIsoDateTime(updatedAt)) {
    issues.push("checkpoint.updated_at must be an ISO 8601 datetime");
  }
  if (!/^[0-9a-f]{64}$/.test(basisSha256)) {
    issues.push("checkpoint.basis_sha256 must be a SHA-256 digest");
  } else if (basisSha256 !== currentBasis) {
    issues.push("checkpoint is stale because the owned case, dossier, or coverage state changed");
  }
  return {
    status: (["active", "blocked", "complete"] as string[]).includes(status)
      ? status as KnowledgeSessionStatus
      : "blocked",
    stage,
    actor,
    currentState,
    lastCompleted,
    nextAction,
    blockers,
    updatedAt,
    basisSha256,
    currentBasisSha256: currentBasis,
    valid: issues.length === 0,
    issues,
  };
}

export function sessionFile(path: string, role: string, content: string | Buffer): KnowledgeSessionFile {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  return {
    path,
    role,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength,
  };
}

function invalidCheckpoint(
  currentBasisSha256: string,
  issues: string[],
): KnowledgeSessionCheckpointSummary {
  return {
    status: "blocked",
    stage: "",
    actor: "",
    currentState: "",
    lastCompleted: "",
    nextAction: "",
    blockers: [],
    updatedAt: "",
    basisSha256: "",
    currentBasisSha256,
    valid: false,
    issues,
  };
}

function assertCaseId(id: string, label: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid ${label} case id: ${id}`);
  }
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Checkpoint ${label} must not be empty`);
  }
  return normalized;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isMissingDirectory(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}
