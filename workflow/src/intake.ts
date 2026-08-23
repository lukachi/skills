import type { TodoEdit } from "./work-spec.js";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { findDistributionRoot } from "./distribution.js";
import { errorMessage, isMissingFileError, readConfig } from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { withFileLock } from "./file-lock.js";
import { readPinnedGitTextRange } from "./pinned-git-read.js";
import { validateKnowledge } from "./knowledge.js";
import { compileClaimLedger } from "./claim-ledger.js";
import { discoveryLedgerIssues } from "./discovery-ledger.js";
import {
  inspectSessionCheckpoint,
  selectActiveCase,
  sessionBasis,
  sessionFile,
  writeSessionCheckpoint,
  type KnowledgeSessionCheckpointInput,
  type KnowledgeSessionCheckpointSummary,
  type KnowledgeSessionFile,
  type KnowledgeSessionStatus,
} from "./knowledge-session.js";
import type { WorkOutcome } from "./types.js";

const INTAKE_CASE_VERSION = 4;
const INTAKE_SESSION_VERSION = 1;
const INTAKE_CHECKPOINT_STAGES = [
  "source-review",
  "adjudication",
  "promotion",
  "omission-audit",
  "review",
] as const;
const SOURCE_STATUSES = new Set([
  "pending",
  "reviewed",
  "no-relevant-claims",
  "needs-maintainer",
  "unreadable",
]);

const CANDIDATE_STATUSES = new Set([
  "confirmed",
  "rejected",
  "deferred",
  "unresolved",
]);

const CLAIM_CLASSES = new Set([
  "product-intent",
  "product-meaning",
  "implementation",
  "architecture",
  "ownership",
  "contract",
  "operational-policy",
  "decision",
  "history",
  "external",
  "uncertainty",
]);

const SEMANTIC_ROLES = new Set([
  "idea",
  "requirement",
  "decision",
  "design",
  "plan",
  "status",
  "observation",
  "outcome",
  "unknown",
]);

const INTENT_STATES = new Set([
  "accepted",
  "proposed",
  "superseded",
  "rejected",
  "unknown",
  "not-applicable",
]);

const DELIVERY_STATES = new Set([
  "absent",
  "partial",
  "implemented",
  "verified",
  "retired",
  "unknown",
  "not-applicable",
]);

const ALIGNMENT_STATES = new Set([
  "aligned",
  "drifted",
  "unknown",
  "not-applicable",
]);

const ROUTING_LANES = new Set([
  "current-knowledge",
  "history",
  "change",
  "capture",
  "case-only",
]);

const CLAIM_RELATIONS = [
  "supersedes",
  "superseded_by",
  "contradicts",
  "refines",
  "implements",
  "derived_from",
] as const;

const PROBE_STATUSES = new Set([
  "pending",
  "passed",
  "failed",
  "waived",
]);

interface CaseDocument {
  metadata: Record<string, unknown>;
  body: string;
}

interface GitTreeEntry {
  mode: string;
  objectType: string;
  objectId: string;
  path: string;
}

export interface BeginIntakeCaseOptions {
  target: string;
  slug: string;
  title: string;
  baseline?: string;
  paths?: string[];
  reconstructionId?: string;
  distributionRoot?: string;
  now?: Date;
}

export interface BeginIntakeCaseResult {
  id: string;
  path: string;
  baseline: string;
  files: number;
}

export interface MarkIntakeSourceOptions {
  target: string;
  id: string;
  path: string;
  status: string;
  candidateIds?: string[];
  note: string;
  nonTextReason?: string;
  reviewedBy?: string;
  now?: Date;
}

export interface MarkIntakeSourceResult {
  id: string;
  path: string;
  status: string;
  candidateIds: string[];
}

export interface ReadIntakeSourceOptions {
  target: string;
  id: string;
  path: string;
  startLine?: number;
  endLine?: number;
  actor?: string;
  now?: Date;
}

export interface ReadIntakeSourceResult {
  id: string;
  path: string;
  objectId: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  complete: boolean;
  receiptId: string;
  content: string;
}

interface IntakeSourceReadReceipt {
  id: string;
  object_id: string;
  start_line: number;
  end_line: number;
  total_lines: number;
  actor: string;
  read_at: string;
}

interface PinnedIntakeSource {
  kind: "text" | "binary" | "unsupported";
  totalLines: number;
  reason: string;
}

export interface RecordIntakeProbeOptions {
  target: string;
  id: string;
  probeId: string;
  question: string;
  candidateIds: string[];
  status: string;
  answer: string;
  outputPaths: string[];
  reviewedBy?: string;
  waiverBy?: string;
  waiverNote?: string;
  now?: Date;
}

export interface RecordIntakeProbeResult {
  id: string;
  probeId: string;
  status: string;
  candidateIds: string[];
}

export interface MigrateIntakeCaseOptions {
  target: string;
  id: string;
  review?: boolean;
  reviewedBy?: string;
  note?: string;
  now?: Date;
}

export interface MigrateIntakeCaseResult {
  id: string;
  path: string;
  fromVersion: number;
  version: number;
  migrationStatus: string;
}

export interface IntakeCaseResult {
  id: string;
  path: string;
  baseline?: string;
  files: number;
  reviewed: number;
  issues: string[];
}

export interface IntakeContext {
  id: string;
  title: string;
  root: string;
  requiredFiles: KnowledgeSessionFile[];
  files: number;
  reviewed: number;
  pendingSources: string[];
  blockedSources: string[];
  checkpoint?: KnowledgeSessionCheckpointSummary;
  validationIssues: string[];
}

export interface UpdateIntakeCheckpointOptions {
  target: string;
  id: string;
  status: KnowledgeSessionStatus;
  stage: typeof INTAKE_CHECKPOINT_STAGES[number];
  actor: string;
  currentState: string;
  lastCompleted: string;
  nextAction: string;
  blockers?: string[];
  /** How the carried list of small jobs changes. Omitted, it survives untouched. */
  todo?: TodoEdit;
  now?: Date;
}

export interface CloseIntakeCaseOptions {
  target: string;
  id: string;
  outcome: WorkOutcome;
  now?: Date;
}

export interface CloseIntakeCaseResult {
  id: string;
  outcome: WorkOutcome;
  archivePath: string;
}

export type RawInventoryState =
  | "unseen"
  | "changed"
  | "active"
  | "reviewed"
  | "no-relevant-claims"
  | "blocked"
  | "unresolved";

export interface RawInventoryCaseReference {
  id: string;
  lifecycle: "active" | "archive";
  outcome: string;
  sourceStatus: string;
}

export interface RawInventoryEntry {
  path: string;
  objectId: string;
  state: RawInventoryState;
  cases: RawInventoryCaseReference[];
}

export interface RawInventoryOptions {
  target: string;
  baseline?: string;
  paths?: string[];
}

export interface RawInventoryResult {
  target: string;
  baseline: string;
  entries: RawInventoryEntry[];
  uncommitted: string[];
}

interface IntakeSourceHistory extends RawInventoryCaseReference {
  path: string;
  objectId: string;
}

export async function inventoryRaw(
  options: RawInventoryOptions,
): Promise<RawInventoryResult> {
  const target = await requireKnowledgeRepository(options.target);
  const baseline = resolveCommit(target, options.baseline ?? "HEAD");
  const pathspecs = normalizeRawPathspecs(options.paths ?? ["raw"]);
  const entries = readGitTree(target, baseline, pathspecs);
  const history = await readIntakeSourceHistory(target);
  const byIdentity = new Map<string, IntakeSourceHistory[]>();
  const byPath = new Map<string, IntakeSourceHistory[]>();

  for (const source of history) {
    const identity = `${source.path}\0${source.objectId}`;
    byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), source]);
    byPath.set(source.path, [...(byPath.get(source.path) ?? []), source]);
  }

  return {
    target,
    baseline,
    entries: entries.map((entry) => {
      const exact = byIdentity.get(`${entry.path}\0${entry.objectId}`) ?? [];
      return {
        path: entry.path,
        objectId: entry.objectId,
        state: rawInventoryState(exact, byPath.get(entry.path) ?? []),
        cases: exact.map(({ id, lifecycle, outcome, sourceStatus }) => ({
          id,
          lifecycle,
          outcome,
          sourceStatus,
        })),
      };
    }),
    uncommitted: rawWorkingTreePaths(target, pathspecs),
  };
}

export async function beginIntakeCase(
  options: BeginIntakeCaseOptions,
): Promise<BeginIntakeCaseResult> {
  const target = await requireKnowledgeRepository(options.target);
  const pathspecs = normalizeRawPathspecs(options.paths ?? ["raw"]);
  assertScopeMatchesWorkingTree(target, options.baseline ?? "HEAD", pathspecs);
  const baseline = resolveCommit(target, options.baseline ?? "HEAD");
  const sources = readGitTree(target, baseline, pathspecs);
  if (sources.length === 0) {
    throw new Error(`Intake scope contains no Git-tracked files: ${pathspecs.join(", ")}`);
  }

  const now = options.now ?? new Date();
  const parentReconstruction = options.reconstructionId
    ? await bindParentReconstruction(
      target,
      options.reconstructionId,
      baseline,
      sources,
      now,
    )
    : undefined;
  const base = `${now.toISOString().slice(0, 10)}-${normalizeSlug(options.slug)}`;
  const activeRoot = join(target, "intake/cases/active");
  const id = await uniqueDirectoryId(activeRoot, base);
  const directory = join(activeRoot, id);
  const path = join(directory, "case.md");
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const template = await readFile(
    join(
      distributionRoot,
      "skills/process-raw-intake/assets/intake-case.md",
    ),
    "utf8",
  );
  const document = parseCase(template);
  const createdAt = now.toISOString();
  document.metadata = {
    ...document.metadata,
    intake_case_version: INTAKE_CASE_VERSION,
    id,
    title: options.title,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    baseline: {
      repository: readRepositoryMetadata(target).repository,
      commit: baseline,
      paths: pathspecs,
    },
    parent_reconstruction: parentReconstruction ?? null,
    sources: sources.map((source) => ({
      path: source.path,
      object_id: source.objectId,
      object_type: source.objectType,
      mode: source.mode,
      status: "pending",
      candidate_ids: [],
      note: "",
      reviewed_by: "",
      reviewed_at: "",
      read_receipts: [],
      non_text_disposition: null,
    })),
  };

  try {
    await mkdir(directory, { recursive: false });
    await writeFile(path, serializeCase(document), { encoding: "utf8", flag: "wx" });
    await updateIntakeCheckpoint({
      target,
      id,
      status: "active",
      stage: "source-review",
      actor: "system:wfctl",
      currentState: "Intake case created from exact frozen Git blobs.",
      lastCompleted: "The bounded raw source ledger was frozen.",
      nextAction: "Read every frozen source completely and classify each material atomic candidate.",
      blockers: [],
      now,
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return { id, path, baseline, files: sources.length };
}

export async function intakeContext(
  targetInput: string,
  requestedId?: string,
): Promise<IntakeContext> {
  const target = await requireKnowledgeRepository(targetInput);
  const selected = await selectActiveCase(
    join(target, "intake/cases/active"),
    requestedId,
    "raw-intake",
  );
  const content = await readFile(selected.path, "utf8");
  const document = parseCase(content);
  const basis = sessionBasis(document);
  const sessionVersion = Number(document.metadata.session_record_version);
  const validationIssues: string[] = [];
  if (
    document.metadata.session_record_version !== undefined
    && sessionVersion !== INTAKE_SESSION_VERSION
  ) {
    validationIssues.push(`session_record_version must be ${INTAKE_SESSION_VERSION}`);
  }
  if (sessionVersion === INTAKE_SESSION_VERSION) {
    validationIssues.push(...discoveryLedgerIssues(document.body, "case.md", true));
  }
  const checkpoint = inspectSessionCheckpoint(
    document,
    basis,
    INTAKE_CHECKPOINT_STAGES,
    sessionVersion === INTAKE_SESSION_VERSION,
  );
  if (checkpoint) {
    validationIssues.push(...checkpoint.issues);
  }
  const sources = recordArray(document.metadata.sources);
  return {
    id: selected.id,
    title: stringValue(document.metadata.title) || selected.title,
    root: dirname(selected.path),
    requiredFiles: [
      sessionFile(
        selected.path.slice(target.length + 1),
        "case-full-read",
        content,
      ),
    ],
    files: sources.length,
    reviewed: sources.filter((source) =>
      source.status === "reviewed" || source.status === "no-relevant-claims"
    ).length,
    pendingSources: sources
      .filter((source) => source.status === "pending")
      .map((source) => stringValue(source.path)),
    blockedSources: sources
      .filter((source) => source.status === "needs-maintainer" || source.status === "unreadable")
      .map((source) => stringValue(source.path)),
    ...(checkpoint ? { checkpoint } : {}),
    validationIssues: [...new Set(validationIssues)].sort(),
  };
}

export async function updateIntakeCheckpoint(
  options: UpdateIntakeCheckpointOptions,
): Promise<KnowledgeSessionCheckpointSummary> {
  const target = await requireKnowledgeRepository(options.target);
  const path = intakeCasePath(target, "active", options.id);
  const document = parseCase(await readFile(path, "utf8"));
  if (Number(document.metadata.session_record_version) !== INTAKE_SESSION_VERSION) {
    throw new Error(
      "This legacy intake case has no resumable session contract; preserve it as-is or start a current bounded case.",
    );
  }
  const basis = sessionBasis(document);
  const checkpointInput: KnowledgeSessionCheckpointInput = {
    status: options.status,
    stage: options.stage,
    actor: options.actor,
    currentState: options.currentState,
    lastCompleted: options.lastCompleted,
    nextAction: options.nextAction,
    blockers: options.blockers ?? [],
    ...(options.todo ? { todo: options.todo } : {}),
    ...(options.now ? { now: options.now } : {}),
  };
  writeSessionCheckpoint(document, checkpointInput, basis);
  await writeFile(path, serializeCase(document), "utf8");
  const summary = inspectSessionCheckpoint(
    document,
    sessionBasis(document),
    INTAKE_CHECKPOINT_STAGES,
    true,
  );
  if (!summary) {
    throw new Error("Failed to persist intake checkpoint");
  }
  return summary;
}

export async function markIntakeSource(
  options: MarkIntakeSourceOptions,
): Promise<MarkIntakeSourceResult> {
  const target = await requireKnowledgeRepository(options.target);
  return await withFileLock(
    intakeCaseLockPath(target, options.id),
    async () => await markIntakeSourceLocked(options, target),
  );
}

async function markIntakeSourceLocked(
  options: MarkIntakeSourceOptions,
  target: string,
): Promise<MarkIntakeSourceResult> {
  if (!SOURCE_STATUSES.has(options.status) || options.status === "pending") {
    throw new Error(
      `Invalid final source status "${options.status}"; expected reviewed, no-relevant-claims, needs-maintainer, or unreadable`,
    );
  }
  const candidateIds = uniqueStrings(options.candidateIds ?? []);
  if (options.status === "reviewed" && candidateIds.length === 0) {
    throw new Error("reviewed status requires at least one --candidate <id>");
  }
  if (options.status !== "reviewed" && candidateIds.length > 0) {
    throw new Error(`${options.status} status cannot record candidate IDs`);
  }
  if (!options.note.trim()) {
    throw new Error(`${options.status} status requires --note <review result>`);
  }

  const casePath = intakeCasePath(target, "active", options.id);
  const document = parseCase(await readFile(casePath, "utf8"));
  requireCurrentIntakeVersion(document.metadata);
  const sources = recordArray(document.metadata.sources);
  const matches = sources.filter((source) => stringValue(source.path) === options.path);
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Intake source is outside the frozen case scope: ${options.path}`
        : `Intake source path is duplicated in the case: ${options.path}`,
    );
  }
  const source = matches[0]!;
  if (source.read_receipts === undefined) {
    source.read_receipts = [];
  }
  if (source.non_text_disposition === undefined) {
    source.non_text_disposition = null;
  }
  const pinned = await inspectPinnedIntakeSource(target, source);
  const receiptIssues = await intakeSourceReceiptIssues(target, source, pinned, false);
  if (receiptIssues.length > 0) {
    throw new Error(
      `${options.path}: intake read receipt gate is invalid: ${receiptIssues.join("; ")}`,
    );
  }
  if (pinned.kind === "text") {
    if (options.nonTextReason?.trim()) {
      throw new Error(`${options.path}: --non-text-reason is only valid for non-text input`);
    }
    if (
      (options.status === "reviewed" || options.status === "no-relevant-claims")
      && !receiptsCoverIntakeSource(
        intakeSourceReadReceipts(source),
        pinned.totalLines,
      )
    ) {
      throw new Error(
        `${options.path}: ${options.status} status requires gap-free full-read receipts for the pinned blob`,
      );
    }
    source.non_text_disposition = null;
  } else {
    if (options.status === "reviewed") {
      throw new Error(
        `${options.path}: non-text input cannot be reviewed as text; choose an explicit non-text disposition`,
      );
    }
    if (!options.nonTextReason?.trim()) {
      throw new Error(
        `${options.path}: ${pinned.kind} input requires --non-text-reason <disposition rationale>`,
      );
    }
  }
  const now = options.now ?? new Date();
  const reviewedBy = options.reviewedBy?.trim() || "workflow-agent/1";
  source.status = options.status;
  source.candidate_ids = candidateIds;
  source.note = options.note.trim();
  source.reviewed_by = reviewedBy;
  source.reviewed_at = now.toISOString();
  if (pinned.kind !== "text") {
    source.non_text_disposition = {
      kind: pinned.kind,
      status: options.status,
      reason: options.nonTextReason!.trim(),
      decided_by: reviewedBy,
      decided_at: now.toISOString(),
    };
  }
  document.metadata.updated_at = now.toISOString();
  await writeFile(casePath, serializeCase(document), "utf8");

  return {
    id: options.id,
    path: options.path,
    status: options.status,
    candidateIds,
  };
}

export async function readIntakeSource(
  options: ReadIntakeSourceOptions,
): Promise<ReadIntakeSourceResult> {
  const target = await requireKnowledgeRepository(options.target);
  return await withFileLock(
    intakeCaseLockPath(target, options.id),
    async () => await readIntakeSourceLocked(options, target),
  );
}

async function readIntakeSourceLocked(
  options: ReadIntakeSourceOptions,
  target: string,
): Promise<ReadIntakeSourceResult> {
  const casePath = intakeCasePath(target, "active", options.id);
  const document = parseCase(await readFile(casePath, "utf8"));
  requireCurrentIntakeVersion(document.metadata);
  const sources = recordArray(document.metadata.sources);
  const matches = sources.filter((source) => stringValue(source.path) === options.path);
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Intake source is outside the frozen case scope: ${options.path}`
        : `Intake source path is duplicated in the case: ${options.path}`,
    );
  }
  const source = matches[0]!;
  if (stringValue(source.object_type) !== "blob") {
    throw new Error(
      `${options.path}: pinned input is unsupported (Git object type is ${stringValue(source.object_type) || "unknown"}); record an explicit non-text disposition instead`,
    );
  }
  const objectId = stringValue(source.object_id);
  const read = await readPinnedGitTextRange(
    target,
    ["cat-file", "blob", objectId],
    {
      ...(options.startLine === undefined ? {} : { startLine: options.startLine }),
      ...(options.endLine === undefined ? {} : { endLine: options.endLine }),
      operationName: `${options.path}: pinned intake read`,
    },
  );
  if (read.kind !== "text") {
    throw new Error(
      `${options.path}: pinned input is ${read.kind} (${read.reason}); record an explicit non-text disposition instead`,
    );
  }
  const totalLines = read.totalLines;
  const startLine = read.startLine;
  const endLine = read.endLine;
  const now = options.now ?? new Date();
  const actor = options.actor?.trim() || "workflow-agent/1";
  const receiptId = intakeReadReceiptId({
    path: options.path,
    objectId,
    startLine,
    endLine,
    totalLines,
    actor,
  });
  const receipt: IntakeSourceReadReceipt = {
    id: receiptId,
    object_id: objectId,
    start_line: startLine,
    end_line: endLine,
    total_lines: totalLines,
    actor,
    read_at: now.toISOString(),
  };
  const receipts = mergeIntakeSourceReceipts([
    ...intakeSourceReadReceipts(source),
    receipt,
  ]);
  source.read_receipts = receipts;
  source.non_text_disposition = null;
  document.metadata.updated_at = now.toISOString();
  await writeFile(casePath, serializeCase(document), "utf8");
  return {
    id: options.id,
    path: options.path,
    objectId,
    startLine,
    endLine,
    totalLines,
    complete: receiptsCoverIntakeSource(receipts, totalLines),
    receiptId,
    content: read.content,
  };
}

export async function recordIntakeProbe(
  options: RecordIntakeProbeOptions,
): Promise<RecordIntakeProbeResult> {
  const target = await requireKnowledgeRepository(options.target);
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(options.probeId)) {
    throw new Error(`Invalid omission probe id: ${options.probeId}`);
  }
  if (!PROBE_STATUSES.has(options.status) || options.status === "pending") {
    throw new Error(
      `Invalid final probe status "${options.status}"; expected passed, failed, or waived`,
    );
  }
  const candidateIds = uniqueStrings(options.candidateIds);
  if (candidateIds.length === 0) {
    throw new Error("Omission probe requires at least one --candidate <id>");
  }
  if (!options.question.trim()) {
    throw new Error("Omission probe requires --question <diagnostic question>");
  }
  if (!options.answer.trim()) {
    throw new Error("Omission probe requires --answer <observed answer>");
  }
  const outputPaths = uniqueStrings(options.outputPaths);
  if (options.status === "passed" && outputPaths.length === 0) {
    throw new Error("Passed omission probe requires at least one --output <durable path>");
  }
  if (outputPaths.some((path) => !isDurableRoutingPath(path))) {
    throw new Error(
      "Omission probe outputs must be Markdown under knowledge/ or changes/",
    );
  }
  if (
    options.status === "waived"
    && (
      !options.waiverBy?.startsWith("human:")
      || !options.waiverNote?.trim()
    )
  ) {
    throw new Error(
      "Waived omission probe requires --waiver-by human:<id> and --waiver-note",
    );
  }

  const casePath = intakeCasePath(target, "active", options.id);
  const document = parseCase(await readFile(casePath, "utf8"));
  requireCurrentIntakeVersion(document.metadata);
  const candidateSet = new Set(
    recordArray(document.metadata.candidate_claims)
      .map((candidate) => stringValue(candidate.id))
      .filter(Boolean),
  );
  for (const candidateId of candidateIds) {
    if (!candidateSet.has(candidateId)) {
      throw new Error(`Omission probe references undefined candidate: ${candidateId}`);
    }
  }
  const omissionAudit = recordValue(document.metadata.omission_audit) ?? {};
  const probes = recordArray(omissionAudit.probes);
  const now = options.now ?? new Date();
  const probe = {
    id: options.probeId,
    question: options.question.trim(),
    expected_candidate_ids: candidateIds,
    status: options.status,
    answer: options.answer.trim(),
    output_paths: outputPaths,
    reviewed_by: options.reviewedBy?.trim() || "workflow-agent/1",
    reviewed_at: now.toISOString(),
    waiver: options.status === "waived"
      ? {
        status: "approved",
        by: options.waiverBy!.trim(),
        at: now.toISOString(),
        note: options.waiverNote!.trim(),
      }
      : {
        status: "not-needed",
        by: "",
        at: "",
        note: "",
      },
  };
  const existingIndex = probes.findIndex(
    (entry) => stringValue(entry.id) === options.probeId,
  );
  if (existingIndex >= 0) {
    probes[existingIndex] = probe;
  } else {
    probes.push(probe);
  }
  omissionAudit.probes = probes;
  omissionAudit.result = probes.some((entry) => entry.status === "failed")
    ? "failed"
    : probes.some((entry) => entry.status === "pending")
    ? "pending"
    : "passed";
  document.metadata.omission_audit = omissionAudit;
  document.metadata.updated_at = now.toISOString();
  await writeFile(casePath, serializeCase(document), "utf8");
  return {
    id: options.id,
    probeId: options.probeId,
    status: options.status,
    candidateIds,
  };
}

export async function migrateIntakeCase(
  options: MigrateIntakeCaseOptions,
): Promise<MigrateIntakeCaseResult> {
  const target = await requireKnowledgeRepository(options.target);
  const path = intakeCasePath(target, "active", options.id);
  const document = parseCase(await readFile(path, "utf8"));
  const rawVersion = document.metadata.intake_case_version;
  const fromVersion = typeof rawVersion === "number" ? rawVersion : 0;
  const now = options.now ?? new Date();

  if (fromVersion === 3) {
    if (options.review === true) {
      throw new Error(
        "Migration review is a separate gate: migrate first, inspect and correct every generated field, then rerun with --review",
      );
    }
    document.metadata.candidate_claims = recordArray(
      document.metadata.candidate_claims,
    ).map((candidate) => migrateV3Candidate(candidate, document.metadata));
    document.metadata.intake_case_version = INTAKE_CASE_VERSION;
    document.metadata.migration = {
      from_version: 3,
      status: "needs-review",
      reviewed_by: "",
      reviewed_at: "",
      notes: [
        "Conservative defaults were generated. Review semantic role, independent state axes, temporal scope, relations, and routing for every candidate.",
      ],
    };
    const omissionAudit = recordValue(document.metadata.omission_audit) ?? {};
    omissionAudit.probes = recordArray(omissionAudit.probes);
    omissionAudit.result = "pending";
    omissionAudit.notes = uniqueStrings([
      ...stringArray(omissionAudit.notes),
      "Generate candidate-covering omission probes after migration review and routing.",
    ]);
    document.metadata.omission_audit = omissionAudit;
  } else if (fromVersion !== INTAKE_CASE_VERSION) {
    throw new Error(
      `Cannot migrate intake case version ${String(rawVersion)}; supported source version is 3`,
    );
  }

  const migration = recordValue(document.metadata.migration) ?? {};
  if (options.review === true) {
    if (
      migration.from_version !== 3
      || migration.status !== "needs-review"
    ) {
      throw new Error(
        migration.status === "reviewed"
          ? "Intake migration has already been reviewed"
          : "This intake case has no pending v3-to-v4 migration review",
      );
    }
    if (!options.note?.trim()) {
      throw new Error("Migration review requires --note <review result>");
    }
    migration.status = "reviewed";
    migration.reviewed_by = options.reviewedBy?.trim() || "workflow-agent/1";
    migration.reviewed_at = now.toISOString();
    migration.notes = uniqueStrings([
      ...stringArray(migration.notes),
      options.note,
    ]);
  } else if (fromVersion === INTAKE_CASE_VERSION) {
    throw new Error(
      migration.status === "needs-review"
        ? "Intake case already uses version 4 and awaits review; correct the generated fields, then pass --review"
        : "Intake case already uses version 4",
    );
  }
  document.metadata.migration = migration;
  document.metadata.updated_at = now.toISOString();
  await writeFile(path, serializeCase(document), "utf8");

  return {
    id: options.id,
    path,
    fromVersion,
    version: INTAKE_CASE_VERSION,
    migrationStatus: stringValue(migration.status),
  };
}

export async function inspectIntakeCase(
  targetInput: string,
  id: string,
): Promise<IntakeCaseResult> {
  const target = await requireKnowledgeRepository(targetInput);
  const path = intakeCasePath(target, "active", id);
  const document = parseCase(await readFile(path, "utf8"));
  const issues = caseMetadataIssues(document.metadata, document.body);
  const baseline = recordValue(document.metadata.baseline);
  const commit = stringValue(baseline?.commit);
  const pathspecs = stringArray(baseline?.paths);
  const sources = recordArray(document.metadata.sources);

  if (commit && pathspecs.length > 0) {
    try {
      const expected = readGitTree(target, commit, normalizeRawPathspecs(pathspecs));
      issues.push(...compareTreeEntries(expected, sources));
      try {
        assertScopeMatchesWorkingTree(target, commit, pathspecs);
      } catch (error) {
        issues.push(errorMessage(error));
      }
    } catch (error) {
      issues.push(errorMessage(error));
    }
  }
  const sourceIssueGroups = await Promise.all(
    sources.map((source) => intakeSourceReceiptIssues(target, source)),
  );
  for (const sourceIssues of sourceIssueGroups) {
    issues.push(...sourceIssues);
  }

  const candidateIds = new Set(
    recordArray(document.metadata.candidate_claims)
      .map((candidate) => stringValue(candidate.id))
      .filter(Boolean),
  );
  const referenced = new Set<string>();
  for (const source of sources) {
    for (const candidateId of stringArray(source.candidate_ids)) {
      referenced.add(candidateId);
      if (!candidateIds.has(candidateId)) {
        issues.push(`${stringValue(source.path)} references undefined candidate ${candidateId}`);
      }
    }
  }
  for (const candidateId of candidateIds) {
    if (!referenced.has(candidateId)) {
      issues.push(`candidate ${candidateId} is not linked from any scoped source`);
    }
  }

  const promotion = recordValue(document.metadata.promotion);
  if (promotion?.status === "applied" && stringArray(promotion.concepts).length > 0) {
    const validation = await validateKnowledge(target, stringArray(promotion.concepts));
    issues.push(...validation.errors.map((issue) => `${issue.path}: ${issue.message}`));
  }
  const operationalDestinations = new Set<string>();
  for (const candidate of recordArray(document.metadata.candidate_claims)) {
    const routing = recordValue(candidate.routing);
    for (const destination of stringArray(routing?.destinations)) {
      if (isActiveChangePath(destination) || isCapturePath(destination)) {
        operationalDestinations.add(destination);
      }
    }
  }
  for (const destination of operationalDestinations) {
    if (!await pathExists(join(target, destination))) {
      issues.push(`routed operational destination does not exist: ${destination}`);
    }
  }
  const ledger = await compileClaimLedger(target);
  const claimPrefix = `intake:${id}#`;
  issues.push(
    ...ledger.errors
      .filter((issue) =>
        (issue.caseId === id && issue.origin === "intake")
        || issue.claimIds?.some((claimId) => claimId.startsWith(claimPrefix))
      )
      .map((issue) => issue.message),
  );

  return {
    id,
    path,
    ...(commit ? { baseline: commit } : {}),
    files: sources.length,
    reviewed: sources.filter((source) =>
      source.status === "reviewed" || source.status === "no-relevant-claims"
    ).length,
    issues: [...new Set(issues)],
  };
}

export async function closeIntakeCase(
  options: CloseIntakeCaseOptions,
): Promise<CloseIntakeCaseResult> {
  const target = await requireKnowledgeRepository(options.target);
  const path = intakeCasePath(target, "active", options.id);
  const directory = dirname(path);
  const document = parseCase(await readFile(path, "utf8"));

  if (options.outcome === "completed") {
    const inspected = await inspectIntakeCase(target, options.id);
    if (inspected.issues.length > 0) {
      throw new Error(`Completed intake case is blocked: ${inspected.issues.join("; ")}`);
    }
  }

  const now = options.now ?? new Date();
  const archivePath = join(target, "intake/cases/archive", options.id);
  await assertPathAbsent(archivePath, "intake case archive");
  document.metadata.status = options.outcome;
  document.metadata.outcome = options.outcome;
  document.metadata.closed_at = now.toISOString();
  document.metadata.updated_at = now.toISOString();
  if (document.metadata.session_record_version === INTAKE_SESSION_VERSION) {
    writeSessionCheckpoint(document, {
      status: "complete",
      stage: "review",
      actor: "system:wfctl",
      currentState: `Raw-intake case archived with outcome ${options.outcome}.`,
      lastCompleted: "The intake close gate recorded its honest outcome.",
      nextAction: "No active case continuation remains; use the archive as an audit trail.",
      blockers: [],
      now,
    }, sessionBasis(document));
  }
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(directory, archivePath);
  try {
    await writeFile(join(archivePath, "case.md"), serializeCase(document), "utf8");
  } catch (error) {
    await rename(archivePath, directory);
    throw error;
  }
  return { id: options.id, outcome: options.outcome, archivePath };
}

function caseMetadataIssues(metadata: Record<string, unknown>, body = ""): string[] {
  const issues: string[] = [];
  const baseline = recordValue(metadata.baseline);
  const sources = recordArray(metadata.sources);
  const candidates = recordArray(metadata.candidate_claims);
  const promotion = recordValue(metadata.promotion);
  const omissionAudit = recordValue(metadata.omission_audit);
  const migration = recordValue(metadata.migration);
  const parentReconstruction = recordValue(metadata.parent_reconstruction);

  if (metadata.intake_case_version !== INTAKE_CASE_VERSION) {
    issues.push(
      `intake_case_version must be ${INTAKE_CASE_VERSION}; run wfctl knowledge case migrate <case-id>`,
    );
  }
  if (
    metadata.session_record_version !== undefined
    && metadata.session_record_version !== INTAKE_SESSION_VERSION
  ) {
    issues.push(`session_record_version must be ${INTAKE_SESSION_VERSION}`);
  }
  if (metadata.session_record_version === INTAKE_SESSION_VERSION) {
    issues.push(...discoveryLedgerIssues(body, "case.md", true));
  }
  if (metadata.status !== "active") {
    issues.push("status must remain active until wfctl archives the case");
  }
  if (!stringValue(baseline?.repository)) {
    issues.push("baseline.repository is required");
  }
  if (!/^[0-9a-f]{40,64}$/i.test(stringValue(baseline?.commit))) {
    issues.push("baseline.commit must be a full Git object ID");
  }
  if (stringArray(baseline?.paths).length === 0) {
    issues.push("baseline.paths must contain the bounded raw pathspecs");
  }
  if (
    metadata.parent_reconstruction !== undefined
    && metadata.parent_reconstruction !== null
    && !parentReconstruction
  ) {
    issues.push("parent_reconstruction must be null or a mapping");
  }
  if (parentReconstruction) {
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(stringValue(parentReconstruction.id))) {
      issues.push("parent_reconstruction.id must identify one reconstruction case");
    }
    if (!["all", "selected"].includes(stringValue(parentReconstruction.scope_mode))) {
      issues.push("parent_reconstruction.scope_mode must be all or selected");
    }
    if (!isIsoDateTime(stringValue(parentReconstruction.scope_decided_at))) {
      issues.push("parent_reconstruction.scope_decided_at must pin the approved scope revision");
    }
  }
  if (sources.length === 0) {
    issues.push("sources must contain every file from the frozen Git scope");
  }
  if (
    migration?.status !== "not-needed"
    && migration?.status !== "reviewed"
  ) {
    issues.push("migration.status must be not-needed or reviewed");
  }
  if (
    migration?.status === "reviewed"
    && (
      !stringValue(migration.reviewed_by)
      || !isIsoDateTime(stringValue(migration.reviewed_at))
      || !nonEmptyStringArray(migration.notes)
    )
  ) {
    issues.push("reviewed migration requires reviewer, ISO review time, and notes");
  }

  const seenPaths = new Set<string>();
  for (const [index, source] of sources.entries()) {
    const prefix = `sources[${index}]`;
    const path = stringValue(source.path);
    const status = stringValue(source.status);
    const candidatesForSource = stringArray(source.candidate_ids);
    if (!path.startsWith("raw/")) {
      issues.push(`${prefix}.path must be under raw/`);
    } else if (seenPaths.has(path)) {
      issues.push(`${prefix}.path is duplicated: ${path}`);
    } else {
      seenPaths.add(path);
    }
    if (!/^[0-9a-f]{40,64}$/i.test(stringValue(source.object_id))) {
      issues.push(`${prefix}.object_id must be a full Git object ID`);
    }
    if (!SOURCE_STATUSES.has(status)) {
      issues.push(`${prefix}.status is unknown: ${status}`);
    } else if (status === "pending") {
      issues.push(`${path}: source review is pending`);
    } else if (status === "needs-maintainer" || status === "unreadable") {
      issues.push(`${path}: source review is blocked as ${status}`);
    }
    if (status === "reviewed" && candidatesForSource.length === 0) {
      issues.push(`${path}: reviewed source requires candidate_ids`);
    }
    if (status !== "reviewed" && candidatesForSource.length > 0) {
      issues.push(`${path}: only reviewed sources may reference candidate_ids`);
    }
    if (status !== "pending" && !stringValue(source.note).trim()) {
      issues.push(`${path}: final source status requires a review note`);
    }
    if (
      status !== "pending"
      && (!stringValue(source.reviewed_by) || !isIsoDateTime(stringValue(source.reviewed_at)))
    ) {
      issues.push(`${path}: final source status requires reviewer and ISO review time`);
    }
  }

  const seenCandidates = new Set<string>();
  const confirmedPromotions = new Set<string>();
  const routedDestinations = new Set<string>();
  const probeRequiredCandidates = new Set<string>();
  const candidateDestinations = new Map<string, Set<string>>();
  for (const [index, candidate] of candidates.entries()) {
    const prefix = `candidate_claims[${index}]`;
    const id = stringValue(candidate.id);
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
      issues.push(`${prefix}.id must be a stable lowercase identifier`);
    } else if (seenCandidates.has(id)) {
      issues.push(`${prefix}.id is duplicated: ${id}`);
    } else {
      seenCandidates.add(id);
    }
    if (!stringValue(candidate.claim).trim()) {
      issues.push(`${prefix}.claim is required`);
    }
    const claimClass = stringValue(candidate.claim_class);
    if (!CLAIM_CLASSES.has(claimClass)) {
      issues.push(`${prefix}.claim_class is unknown: ${claimClass}`);
    }
    const semanticRole = stringValue(candidate.semantic_role);
    if (!SEMANTIC_ROLES.has(semanticRole)) {
      issues.push(`${prefix}.semantic_role is unknown: ${semanticRole}`);
    } else if (semanticRole === "unknown") {
      issues.push(`${prefix}.semantic_role must be classified before completion`);
    }
    const intentState = stringValue(candidate.intent_state);
    const deliveryState = stringValue(candidate.delivery_state);
    const alignment = stringValue(candidate.alignment);
    if (!INTENT_STATES.has(intentState)) {
      issues.push(`${prefix}.intent_state is invalid`);
    }
    if (!DELIVERY_STATES.has(deliveryState)) {
      issues.push(`${prefix}.delivery_state is invalid`);
    }
    if (!ALIGNMENT_STATES.has(alignment)) {
      issues.push(`${prefix}.alignment is invalid`);
    }
    const temporal = recordValue(candidate.temporal);
    if (!isIsoDateTimeOrDate(stringValue(temporal?.captured_at))) {
      issues.push(`${prefix}.temporal.captured_at is required and must be ISO-8601`);
    }
    for (const field of ["asserted_at", "valid_from", "valid_to"]) {
      const value = stringValue(temporal?.[field]);
      if (value && !isIsoDateTimeOrDate(value)) {
        issues.push(`${prefix}.temporal.${field} must be empty or ISO-8601`);
      }
    }
    const validFrom = stringValue(temporal?.valid_from);
    const validTo = stringValue(temporal?.valid_to);
    if (
      validFrom
      && validTo
      && Date.parse(validTo) < Date.parse(validFrom)
    ) {
      issues.push(`${prefix}.temporal.valid_to cannot precede valid_from`);
    }

    const relations = recordValue(candidate.relations);
    if (!relations) {
      issues.push(`${prefix}.relations must be a mapping`);
    } else {
      for (const relation of CLAIM_RELATIONS) {
        if (!Array.isArray(relations[relation])) {
          issues.push(`${prefix}.relations.${relation} must be a list`);
          continue;
        }
        const targets = stringArray(relations[relation]);
        if (targets.length !== (relations[relation] as unknown[]).length) {
          issues.push(`${prefix}.relations.${relation} must contain only claim references`);
        }
        if (targets.some((target) => !isClaimReference(target))) {
          issues.push(`${prefix}.relations.${relation} contains an invalid claim reference`);
        }
        if (id && targets.includes(id)) {
          issues.push(`${prefix}.relations.${relation} cannot reference itself`);
        }
        if (new Set(targets).size !== targets.length) {
          issues.push(`${prefix}.relations.${relation} contains duplicates`);
        }
      }
    }

    const disposition = stringValue(candidate.disposition);
    if (!CANDIDATE_STATUSES.has(disposition)) {
      issues.push(
        `${prefix}.disposition must be confirmed, rejected, deferred, or unresolved`,
      );
    } else if (disposition === "unresolved") {
      issues.push(`${prefix}.disposition remains unresolved`);
    }
    if (
      (disposition === "rejected"
        || disposition === "deferred"
        || disposition === "unresolved")
      && !stringValue(candidate.reason).trim()
    ) {
      issues.push(`${prefix}.reason must explain ${disposition || "the final disposition"}`);
    }

    const evidence = recordArray(candidate.evidence);
    const evidenceKinds = new Set<string>();
    for (const [evidenceIndex, item] of evidence.entries()) {
      const itemPrefix = `${prefix}.evidence[${evidenceIndex}]`;
      const kind = stringValue(item.kind);
      const resource = stringValue(item.resource);
      evidenceKinds.add(kind);
      if (!["source-code", "runtime-check", "version-control", "external-primary"].includes(kind)) {
        issues.push(`${itemPrefix}.kind is not an independent authority class`);
      }
      if (kind === "source-code" && !isPinnedCodeResource(resource)) {
        issues.push(`${itemPrefix}.resource must pin repository, commit, and path`);
      }
      if (kind === "version-control" && !isVersionControlResource(resource)) {
        issues.push(`${itemPrefix}.resource must pin Git history`);
      }
      if (kind === "external-primary" && !/^https?:\/\/\S+$/i.test(resource)) {
        issues.push(`${itemPrefix}.resource must be an absolute primary-source URL`);
      }
      if (containsUntrustedResource(resource)) {
        issues.push(`${itemPrefix}.resource must not cite raw or intake material`);
      }
    }
    const normative = [
      "product-intent",
      "product-meaning",
      "architecture",
      "ownership",
      "contract",
      "operational-policy",
      "decision",
    ].includes(claimClass);
    const routing = recordValue(candidate.routing);
    const lane = stringValue(routing?.lane);
    const destinations = stringArray(routing?.destinations);
    if (!ROUTING_LANES.has(lane)) {
      issues.push(`${prefix}.routing.lane is invalid`);
    }
    if (!Array.isArray(routing?.destinations)) {
      issues.push(`${prefix}.routing.destinations must be a list`);
    }
    if (new Set(destinations).size !== destinations.length) {
      issues.push(`${prefix}.routing.destinations contains duplicates`);
    }
    for (const destination of destinations) {
      routedDestinations.add(destination);
      if (lane === "current-knowledge" || lane === "history") {
        if (!isConceptPath(destination)) {
          issues.push(`${prefix}.routing contains an invalid knowledge concept: ${destination}`);
        }
      } else if (lane === "change") {
        if (!isActiveChangePath(destination)) {
          issues.push(`${prefix}.routing contains an invalid change path: ${destination}`);
        }
      } else if (lane === "capture") {
        if (!isCapturePath(destination)) {
          issues.push(`${prefix}.routing contains an invalid capture path: ${destination}`);
        }
      }
    }
    if (id) {
      candidateDestinations.set(id, new Set(destinations));
    }
    if (lane === "case-only" && destinations.length > 0) {
      issues.push(`${prefix}.routing.case-only cannot have destinations`);
    }
    if (lane !== "case-only" && destinations.length === 0) {
      issues.push(`${prefix}.routing.${lane || "unknown"} requires destinations`);
    }
    if (
      (disposition === "rejected" || disposition === "unresolved")
      && lane !== "case-only"
    ) {
      issues.push(`${prefix}: ${disposition} candidates must remain case-only`);
    }
    if (disposition === "deferred" && !["change", "capture"].includes(lane)) {
      issues.push(`${prefix}: deferred candidates must route to change or capture`);
    }
    if (
      disposition === "confirmed"
      && lane === "current-knowledge"
      && !["accepted", "not-applicable"].includes(intentState)
    ) {
      issues.push(
        `${prefix}: current knowledge requires accepted or not-applicable intent`,
      );
    }
    if (
      lane === "current-knowledge"
      && ["idea", "plan"].includes(semanticRole)
    ) {
      issues.push(`${prefix}: ideas and plans must not route to current knowledge`);
    }
    if (
      lane === "current-knowledge"
      && ["superseded", "rejected", "proposed"].includes(intentState)
    ) {
      issues.push(`${prefix}: non-current intent must not route to current knowledge`);
    }
    if (
      lane === "change"
      && !["proposed", "unknown"].includes(intentState)
    ) {
      issues.push(`${prefix}: change routing requires proposed or unknown intent`);
    }
    if (
      lane === "capture"
      && !["proposed", "unknown", "not-applicable"].includes(intentState)
    ) {
      issues.push(`${prefix}: capture routing requires proposed, unknown, or not-applicable intent`);
    }
    if (
      lane === "history"
      && !(
        claimClass === "history"
        || ["superseded", "rejected"].includes(intentState)
        || deliveryState === "retired"
        || ["status", "outcome"].includes(semanticRole)
      )
    ) {
      issues.push(`${prefix}: history routing requires an explicitly historical state`);
    }
    if (disposition === "confirmed" && lane === "case-only") {
      issues.push(`${prefix}: confirmed candidates require a durable routing lane`);
    }
    if (disposition !== "rejected" && id) {
      probeRequiredCandidates.add(id);
    }

    if (
      disposition === "confirmed"
      && normative
      && (lane === "current-knowledge" || lane === "history")
    ) {
      const decision = recordValue(candidate.maintainer_decision);
      if (
        decision?.status !== "approved"
        || !stringValue(decision.by).startsWith("human:")
        || !isIsoDateTime(stringValue(decision.at))
      ) {
        issues.push(`${prefix}.maintainer_decision must record explicit human approval`);
      }
    }
    if (
      disposition === "confirmed"
      && claimClass === "implementation"
      && !evidenceKinds.has("source-code")
    ) {
      issues.push(`${prefix}: confirmed implementation requires pinned source-code evidence`);
    }
    if (
      disposition === "confirmed"
      && claimClass === "history"
      && !evidenceKinds.has("version-control")
    ) {
      issues.push(`${prefix}: confirmed history requires pinned version-control evidence`);
    }
    if (
      disposition === "confirmed"
      && claimClass === "external"
      && !evidenceKinds.has("external-primary")
    ) {
      issues.push(`${prefix}: confirmed external claims require a primary source`);
    }
    if (
      disposition === "confirmed"
      && claimClass === "uncertainty"
      && (lane === "current-knowledge" || lane === "history")
      && evidence.length === 0
    ) {
      issues.push(
        `${prefix}: a durable uncertainty requires trusted evidence for the open question`,
      );
    }
    if (
      disposition === "confirmed"
      && !normative
      && claimClass !== "uncertainty"
      && evidence.length === 0
    ) {
      issues.push(`${prefix}.evidence is required for a confirmed factual claim`);
    }
    if (
      disposition === "confirmed"
      && (lane === "current-knowledge" || lane === "history")
    ) {
      for (const concept of destinations) {
        confirmedPromotions.add(concept);
      }
    }
  }

  const promotedConcepts = new Set(stringArray(promotion?.concepts));
  if (promotion?.status !== "applied" && promotion?.status !== "not-needed") {
    issues.push("promotion.status must be applied or not-needed");
  } else if (
    promotion.status === "applied"
    && stringArray(promotion.concepts).length === 0
  ) {
    issues.push("promotion.concepts must list promoted concept files");
  } else if (
    promotion.status === "applied"
    && stringArray(promotion.concepts).some((path) => /(?:^|\/)(?:index|log)\.md$/i.test(path))
  ) {
    issues.push("promotion.concepts must list concept files, not index.md or log.md");
  } else if (
    promotion.status === "not-needed"
    && !stringValue(promotion.reason).trim()
  ) {
    issues.push("promotion.reason must explain why no concept was promoted");
  }
  if (promotion?.status === "applied" && promotion.validation !== "passed") {
    issues.push("promotion.validation must be passed for applied promotion");
  }
  if (promotion?.status === "not-needed" && promotion.validation !== "not-needed") {
    issues.push("promotion.validation must be not-needed when no concept was promoted");
  }
  if (
    promotion?.status === "not-needed"
    && confirmedPromotions.size > 0
  ) {
    issues.push("promotion cannot be not-needed while knowledge-routed candidates exist");
  }
  if (promotion?.status === "applied") {
    for (const concept of confirmedPromotions) {
      if (!promotedConcepts.has(concept)) {
        issues.push(`confirmed candidate destination is missing from promotion.concepts: ${concept}`);
      }
    }
    for (const concept of promotedConcepts) {
      if (!confirmedPromotions.has(concept)) {
        issues.push(`promotion concept is not linked from a confirmed candidate: ${concept}`);
      }
    }
  }
  if (omissionAudit?.result !== "passed") {
    issues.push("omission_audit.result must be passed");
  }
  if (!nonEmptyStringArray(omissionAudit?.notes)) {
    issues.push("omission_audit.notes must record the explicit no-omission review");
  }
  const probes = recordArray(omissionAudit?.probes);
  if (!Array.isArray(omissionAudit?.probes)) {
    issues.push("omission_audit.probes must be a list");
  }
  const seenProbes = new Set<string>();
  const coveredCandidates = new Set<string>();
  for (const [index, probe] of probes.entries()) {
    const prefix = `omission_audit.probes[${index}]`;
    const id = stringValue(probe.id);
    const status = stringValue(probe.status);
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
      issues.push(`${prefix}.id must be a stable lowercase identifier`);
    } else if (seenProbes.has(id)) {
      issues.push(`${prefix}.id is duplicated: ${id}`);
    } else {
      seenProbes.add(id);
    }
    if (!stringValue(probe.question).trim()) {
      issues.push(`${prefix}.question is required`);
    }
    if (!PROBE_STATUSES.has(status)) {
      issues.push(`${prefix}.status must be pending, passed, failed, or waived`);
    } else if (status === "pending" || status === "failed") {
      issues.push(`${prefix}.status remains ${status}`);
    }
    if (!stringValue(probe.answer).trim()) {
      issues.push(`${prefix}.answer is required`);
    }
    const expected = stringArray(probe.expected_candidate_ids);
    if (expected.length === 0) {
      issues.push(`${prefix}.expected_candidate_ids must not be empty`);
    }
    for (const candidateId of expected) {
      if (!seenCandidates.has(candidateId)) {
        issues.push(`${prefix} references undefined candidate ${candidateId}`);
      } else {
        coveredCandidates.add(candidateId);
      }
    }
    const outputPaths = stringArray(probe.output_paths);
    if (status === "passed" && outputPaths.length === 0) {
      issues.push(`${prefix}.output_paths are required for a passed probe`);
    }
    for (const outputPath of outputPaths) {
      if (!isDurableRoutingPath(outputPath)) {
        issues.push(`${prefix}.output_paths must stay under knowledge/ or changes/`);
      }
      const expectedDestinations = new Set(
        expected.flatMap((candidateId) => [
          ...(candidateDestinations.get(candidateId) ?? []),
        ]),
      );
      if (expectedDestinations.size > 0 && !expectedDestinations.has(outputPath)) {
        issues.push(
          `${prefix}.output_paths contains a path outside expected candidate routing: ${outputPath}`,
        );
      }
    }
    if (status === "passed") {
      for (const candidateId of expected) {
        const destinations = candidateDestinations.get(candidateId) ?? new Set<string>();
        if (
          destinations.size > 0
          && !outputPaths.some((outputPath) => destinations.has(outputPath))
        ) {
          issues.push(
            `${prefix} does not inspect a routed output for candidate ${candidateId}`,
          );
        }
      }
    }
    if (
      !stringValue(probe.reviewed_by)
      || !isIsoDateTime(stringValue(probe.reviewed_at))
    ) {
      issues.push(`${prefix} requires reviewer and ISO review time`);
    }
    if (status === "waived") {
      const waiver = recordValue(probe.waiver);
      if (
        waiver?.status !== "approved"
        || !stringValue(waiver.by).startsWith("human:")
        || !isIsoDateTime(stringValue(waiver.at))
        || !stringValue(waiver.note).trim()
      ) {
        issues.push(`${prefix}.waiver requires explicit human approval and rationale`);
      }
    }
  }
  for (const candidateId of probeRequiredCandidates) {
    if (!coveredCandidates.has(candidateId)) {
      issues.push(`omission audit does not probe candidate: ${candidateId}`);
    }
  }
  for (const destination of routedDestinations) {
    if (
      !stringArray(promotion?.concepts).includes(destination)
      && destination.startsWith("knowledge/")
    ) {
      issues.push(`knowledge-routed destination is missing from promotion.concepts: ${destination}`);
    }
  }
  return issues;
}

function compareTreeEntries(
  expected: GitTreeEntry[],
  declared: Record<string, unknown>[],
): string[] {
  const issues: string[] = [];
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
  const declaredByPath = new Map(
    declared.map((entry) => [stringValue(entry.path), entry]),
  );
  for (const entry of expected) {
    const source = declaredByPath.get(entry.path);
    if (!source) {
      issues.push(`frozen Git scope is missing source entry: ${entry.path}`);
      continue;
    }
    if (
      source.object_id !== entry.objectId
      || source.object_type !== entry.objectType
      || source.mode !== entry.mode
    ) {
      issues.push(`frozen Git identity does not match baseline: ${entry.path}`);
    }
  }
  for (const source of declared) {
    const path = stringValue(source.path);
    if (!expectedByPath.has(path)) {
      issues.push(`source is outside the frozen Git scope: ${path}`);
    }
  }
  return issues;
}

async function intakeSourceReceiptIssues(
  target: string,
  source: Record<string, unknown>,
  pinnedInput?: PinnedIntakeSource,
  validateFinalState = true,
): Promise<string[]> {
  const issues: string[] = [];
  const path = stringValue(source.path);
  const status = stringValue(source.status);
  const rawReceipts = source.read_receipts;
  const receipts = intakeSourceReadReceipts(source);
  if (!Array.isArray(rawReceipts)) {
    issues.push(`${path}: read_receipts must be a list`);
  } else if (rawReceipts.length !== receipts.length) {
    issues.push(`${path}: read_receipts must contain only receipt mappings`);
  }

  let pinned: PinnedIntakeSource;
  try {
    pinned = pinnedInput ?? await inspectPinnedIntakeSource(target, source);
  } catch (error) {
    issues.push(`${path}: cannot inspect pinned intake input: ${errorMessage(error)}`);
    return issues;
  }

  if (pinned.kind === "text") {
    const totalLines = pinned.totalLines;
    if (
      validateFinalState
      && source.non_text_disposition !== null
      && source.non_text_disposition !== undefined
    ) {
      issues.push(`${path}: text input must not carry a non-text disposition`);
    }
    if (receipts.some((receipt) =>
      receipt.id !== intakeReadReceiptId({
        path,
        objectId: receipt.object_id,
        startLine: receipt.start_line,
        endLine: receipt.end_line,
        totalLines: receipt.total_lines,
        actor: receipt.actor,
      })
      || receipt.object_id !== stringValue(source.object_id)
      || receipt.total_lines !== totalLines
      || !Number.isInteger(receipt.start_line)
      || !Number.isInteger(receipt.end_line)
      || (
        totalLines === 0
          ? receipt.start_line !== 0 || receipt.end_line !== 0
          : receipt.start_line < 1
            || receipt.end_line < receipt.start_line
            || receipt.end_line > totalLines
      )
      || !receipt.actor.trim()
      || !isIsoDateTime(receipt.read_at)
    )) {
      issues.push(`${path}: read receipt identity or metadata is invalid`);
    }
    if (
      validateFinalState
      && (status === "reviewed" || status === "no-relevant-claims")
      && !receiptsCoverIntakeSource(receipts, totalLines)
    ) {
      issues.push(`${path}: final text review lacks gap-free full-read receipts`);
    }
    return issues;
  }

  if (receipts.length > 0) {
    issues.push(`${path}: non-text input must not carry text read receipts`);
  }
  if (validateFinalState && status === "reviewed") {
    issues.push(`${path}: non-text input cannot finish with reviewed status`);
  }
  if (validateFinalState && status !== "pending") {
    const disposition = recordValue(source.non_text_disposition);
    if (
      disposition?.kind !== pinned.kind
      || disposition?.status !== status
      || !stringValue(disposition?.reason).trim()
      || !stringValue(disposition?.decided_by).trim()
      || !isIsoDateTime(stringValue(disposition?.decided_at))
    ) {
      issues.push(
        `${path}: ${pinned.kind} input requires a matching explicit non-text disposition, reason, actor, and time`,
      );
    }
  }
  return issues;
}

async function inspectPinnedIntakeSource(
  target: string,
  source: Record<string, unknown>,
): Promise<PinnedIntakeSource> {
  if (stringValue(source.object_type) !== "blob") {
    return {
      kind: "unsupported",
      totalLines: 0,
      reason: `Git object type is ${stringValue(source.object_type) || "unknown"}`,
    };
  }
  const objectId = stringValue(source.object_id);
  if (!/^[0-9a-f]{40,64}$/i.test(objectId)) {
    throw new Error("pinned Git object ID is invalid");
  }
  const read = await readPinnedGitTextRange(
    target,
    ["cat-file", "blob", objectId],
    { operationName: `${stringValue(source.path)}: pinned intake inspection` },
  );
  return {
    kind: read.kind,
    totalLines: read.totalLines,
    reason: read.reason,
  };
}

function intakeSourceReadReceipts(
  source: Record<string, unknown>,
): IntakeSourceReadReceipt[] {
  return recordArray(source.read_receipts).map((receipt) => ({
    id: stringValue(receipt.id) || intakeReadReceiptId({
      path: stringValue(source.path),
      objectId: stringValue(receipt.object_id),
      startLine: Number(receipt.start_line),
      endLine: Number(receipt.end_line),
      totalLines: Number(receipt.total_lines),
      actor: stringValue(receipt.actor),
    }),
    object_id: stringValue(receipt.object_id),
    start_line: Number(receipt.start_line),
    end_line: Number(receipt.end_line),
    total_lines: Number(receipt.total_lines),
    actor: stringValue(receipt.actor),
    read_at: stringValue(receipt.read_at),
  }));
}

function mergeIntakeSourceReceipts(
  receipts: IntakeSourceReadReceipt[],
): IntakeSourceReadReceipt[] {
  const unique = new Map<string, IntakeSourceReadReceipt>();
  for (const receipt of receipts) {
    unique.set(receipt.id, receipt);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.start_line - right.start_line || left.end_line - right.end_line,
  );
}

function intakeReadReceiptId(input: {
  path: string;
  objectId: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  actor: string;
}): string {
  const digest = createHash("sha256").update([
    input.path,
    input.objectId,
    String(input.startLine),
    String(input.endLine),
    String(input.totalLines),
    input.actor,
  ].join("\0")).digest("hex");
  return `raw-read:${digest.slice(0, 32)}`;
}

function receiptsCoverIntakeSource(
  receipts: IntakeSourceReadReceipt[],
  totalLines: number,
): boolean {
  if (receipts.length === 0) {
    return false;
  }
  if (totalLines === 0) {
    return receipts.some((receipt) =>
      receipt.start_line === 0
      && receipt.end_line === 0
      && receipt.total_lines === 0
    );
  }
  const ranges = receipts
    .filter((receipt) => receipt.total_lines === totalLines)
    .map((receipt) => [receipt.start_line, receipt.end_line] as const)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  let coveredThrough = 0;
  for (const [start, end] of ranges) {
    if (start > coveredThrough + 1) {
      return false;
    }
    coveredThrough = Math.max(coveredThrough, end);
  }
  return coveredThrough >= totalLines;
}

async function readIntakeSourceHistory(target: string): Promise<IntakeSourceHistory[]> {
  const history: IntakeSourceHistory[] = [];
  for (const lifecycle of ["active", "archive"] as const) {
    const root = join(target, "intake/cases", lifecycle);
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (isMissingFileError(error)) {
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const document = parseCase(
        await readFile(join(root, entry.name, "case.md"), "utf8"),
      );
      const outcome = stringValue(document.metadata.outcome)
        || stringValue(document.metadata.status);
      for (const source of recordArray(document.metadata.sources)) {
        const path = stringValue(source.path);
        const objectId = stringValue(source.object_id);
        if (!path || !objectId) {
          continue;
        }
        history.push({
          id: entry.name,
          lifecycle,
          outcome,
          sourceStatus: stringValue(source.status),
          path,
          objectId,
        });
      }
    }
  }
  return history;
}

function rawInventoryState(
  exact: IntakeSourceHistory[],
  samePath: IntakeSourceHistory[],
): RawInventoryState {
  const completed = exact.filter((source) =>
    source.lifecycle === "archive" && source.outcome === "completed"
  );
  if (completed.some((source) => source.sourceStatus === "reviewed")) {
    return "reviewed";
  }
  if (completed.some((source) => source.sourceStatus === "no-relevant-claims")) {
    return "no-relevant-claims";
  }
  if (exact.some((source) => source.lifecycle === "active")) {
    return "active";
  }
  if (exact.some((source) =>
    source.sourceStatus === "needs-maintainer" || source.sourceStatus === "unreadable"
  )) {
    return "blocked";
  }
  if (exact.length > 0) {
    return "unresolved";
  }
  if (samePath.length > 0) {
    return "changed";
  }
  return "unseen";
}

function rawWorkingTreePaths(target: string, pathspecs: string[]): string[] {
  const output = git(target, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--",
    ...pathspecs,
  ]);
  const records = output.split("\0");
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const status = record.slice(0, 2);
    const path = record.slice(3);
    if (path) {
      paths.push(path);
    }
    if (status[0] === "R" || status[0] === "C") {
      index += 1;
    }
  }
  return uniqueStrings(paths).sort();
}

function readGitTree(
  target: string,
  commit: string,
  pathspecs: string[],
): GitTreeEntry[] {
  const output = git(target, [
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    commit,
    "--",
    ...pathspecs,
  ]);
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("\t");
      if (separator < 0) {
        throw new Error(`Cannot parse Git tree entry for intake scope: ${entry}`);
      }
      const [mode, objectType, objectId] = entry.slice(0, separator).split(" ");
      const path = entry.slice(separator + 1);
      if (!mode || !objectType || !objectId || !path) {
        throw new Error(`Cannot parse Git tree entry for intake scope: ${entry}`);
      }
      return { mode, objectType, objectId, path };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function assertScopeMatchesWorkingTree(
  target: string,
  baseline: string,
  pathspecs: string[],
): void {
  const commit = resolveCommit(target, baseline);
  const status = git(target, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...pathspecs,
  ]);
  if (status) {
    throw new Error(
      "Selected raw scope has uncommitted changes; commit it before freezing an intake case",
    );
  }
  const diff = spawnSync(
    "git",
    ["-C", target, "diff", "--quiet", commit, "--", ...pathspecs],
    { stdio: "ignore" },
  );
  if (diff.status === 1) {
    throw new Error(
      `Selected raw scope no longer matches baseline ${commit}; start from a matching revision`,
    );
  }
  if (diff.status !== 0) {
    throw new Error("Git could not compare the selected raw scope with its baseline");
  }
}

function resolveCommit(target: string, revision: string): string {
  const commit = git(target, ["rev-parse", "--verify", `${revision}^{commit}`]);
  if (!/^[0-9a-f]{40,64}$/i.test(commit)) {
    throw new Error(`Git did not return a full commit ID for ${revision}`);
  }
  return commit;
}

function git(target: string, args: string[]): string {
  const result = spawnSync("git", ["-C", target, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Git intake operation failed: ${result.stderr.trim() || args.join(" ")}`,
    );
  }
  return result.stdout.replace(/\n$/, "");
}

export function normalizeRawPathspecs(values: string[]): string[] {
  const normalized = uniqueStrings(values.map((value) =>
    value.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "")
  ));
  if (normalized.length === 0) {
    throw new Error("At least one raw path is required");
  }
  for (const value of normalized) {
    if (
      value !== "raw"
      && !value.startsWith("raw/")
      || value.startsWith("/")
      || value.split("/").includes("..")
    ) {
      throw new Error(`Intake paths must remain under raw/: ${value}`);
    }
  }
  return normalized.sort();
}

async function bindParentReconstruction(
  target: string,
  id: string,
  baseline: string,
  sources: GitTreeEntry[],
  now: Date,
): Promise<Record<string, unknown>> {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid parent reconstruction id: ${id}`);
  }
  let parent: CaseDocument;
  try {
    parent = parseCase(
      await readFile(join(target, "reconstruction/active", id, "case.md"), "utf8"),
    );
  } catch (error) {
    throw new Error(`Cannot bind raw intake to active reconstruction ${id}: ${errorMessage(error)}`);
  }
  if (![4, 5].includes(Number(parent.metadata.reconstruction_version))) {
    throw new Error(`Reconstruction ${id} must record its current raw scope before intake starts`);
  }
  const raw = recordValue(recordValue(parent.metadata.supplemental_inputs)?.raw);
  const scope = recordValue(raw?.scope);
  const mode = stringValue(scope?.mode);
  const decidedBy = stringValue(scope?.decided_by);
  const decidedAt = stringValue(scope?.decided_at);
  if (mode !== "all" && mode !== "selected") {
    throw new Error(`Reconstruction ${id} raw scope does not authorize intake: ${mode || "undecided"}`);
  }
  if (!decidedBy.startsWith("human:") || !isIsoDateTime(decidedAt)) {
    throw new Error(`Reconstruction ${id} raw scope lacks explicit human approval`);
  }
  const parentBaseline = stringValue(raw?.baseline);
  if (parentBaseline !== baseline) {
    throw new Error(`Raw intake baseline does not match reconstruction ${id}`);
  }
  if (now.getTime() < Date.parse(decidedAt)) {
    throw new Error(`Raw intake cannot predate reconstruction ${id} scope approval`);
  }
  const approvedPaths = mode === "all"
    ? ["raw"]
    : normalizeRawPathspecs(stringArray(scope?.paths));
  const allowed = new Set(
    readGitTree(target, baseline, approvedPaths).map(
      (source) => `${source.path}\0${source.objectId}`,
    ),
  );
  for (const source of sources) {
    if (!allowed.has(`${source.path}\0${source.objectId}`)) {
      throw new Error(
        `Raw intake source is outside reconstruction ${id} approved scope: ${source.path}`,
      );
    }
  }
  return {
    id,
    scope_mode: mode,
    scope_decided_at: decidedAt,
  };
}

async function requireKnowledgeRepository(targetInput: string): Promise<string> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Knowledge command requires a knowledge repository: ${target}`);
  }
  return target;
}

function parseCase(content: string): CaseDocument {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error("Intake case must start with YAML frontmatter");
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    throw new Error("Intake case frontmatter is not closed");
  }
  try {
    const metadata = parse(lines.slice(1, end).join("\n")) as unknown;
    if (!isRecord(metadata)) {
      throw new Error("Intake case frontmatter must be a mapping");
    }
    // Byte-for-byte the same body `parseWorkSpec` yields. These two parsers read
    // the same files, and a body that depends on which one ran makes every
    // cross-parser comparison — content digests above all — silently wrong.
    return { metadata, body: lines.slice(end + 1).join("\n").replace(/^\n/, "") };
  } catch (error) {
    throw new Error(`Invalid intake case frontmatter: ${errorMessage(error)}`);
  }
}

function serializeCase(document: CaseDocument): string {
  return `---\n${stringify(document.metadata, { lineWidth: 0 }).trimEnd()}\n---\n\n${document.body.trimStart()}`;
}

function intakeCasePath(
  target: string,
  state: "active" | "archive",
  id: string,
): string {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid intake case id: ${id}`);
  }
  return join(target, "intake/cases", state, id, "case.md");
}

function intakeCaseLockPath(target: string, id: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid intake case id: ${id}`);
  }
  return join(
    target,
    ".workflow/current/locks",
    `intake-case-${id}.lock`,
  );
}

async function uniqueDirectoryId(root: string, base: string): Promise<string> {
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    try {
      await access(join(root, candidate), constants.F_OK);
    } catch (error) {
      if (isMissingFileError(error)) {
        return candidate;
      }
      throw error;
    }
  }
  throw new Error(`Cannot allocate a unique intake case id for ${base}`);
}

async function assertPathAbsent(path: string, label: string): Promise<void> {
  try {
    await access(path, constants.F_OK);
    throw new Error(`${label} already exists: ${path}`);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

function normalizeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Intake case slug must contain ASCII letters or digits");
  }
  return slug.slice(0, 64);
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function migrateV3Candidate(
  candidate: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const authority = stringValue(candidate.authority);
  const disposition = stringValue(candidate.disposition);
  const promotedTo = stringArray(candidate.promoted_to);
  const capturedAt = stringValue(metadata.updated_at)
    || stringValue(metadata.created_at);
  const claimClass = new Map([
    ["intent", "product-intent"],
    ["product-meaning", "product-meaning"],
    ["implementation", "implementation"],
    ["architecture-rationale", "architecture"],
    ["ownership", "ownership"],
    ["contract", "contract"],
    ["operational-policy", "operational-policy"],
    ["decision", "decision"],
    ["history", "history"],
    ["external", "external"],
  ]).get(authority) ?? "uncertainty";
  const {
    authority: _legacyAuthority,
    promoted_to: _legacyPromotion,
    ...rest
  } = candidate;
  return {
    ...rest,
    claim_class: claimClass,
    semantic_role: "unknown",
    intent_state: "unknown",
    delivery_state: "unknown",
    alignment: "unknown",
    temporal: {
      captured_at: capturedAt,
      asserted_at: "",
      valid_from: "",
      valid_to: "",
    },
    relations: emptyClaimRelations(),
    migration_source: {
      authority,
      promoted_to: promotedTo,
    },
    routing: {
      lane: "case-only",
      destinations: [],
    },
  };
}

function emptyClaimRelations(): Record<(typeof CLAIM_RELATIONS)[number], string[]> {
  return CLAIM_RELATIONS.reduce(
    (relations, relation) => {
      relations[relation] = [];
      return relations;
    },
    {} as Record<(typeof CLAIM_RELATIONS)[number], string[]>,
  );
}

function requireCurrentIntakeVersion(metadata: Record<string, unknown>): void {
  if (metadata.intake_case_version !== INTAKE_CASE_VERSION) {
    throw new Error(
      `Intake case must be migrated to version ${INTAKE_CASE_VERSION} first`,
    );
  }
}

function isConceptPath(value: string): boolean {
  return /^knowledge\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/i.test(value)
    && !/(?:^|\/)(?:index|log)\.md$/i.test(value);
}

function isActiveChangePath(value: string): boolean {
  return /^changes\/active\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/i.test(
    value,
  );
}

function isCapturePath(value: string): boolean {
  return /^changes\/inbox\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/i.test(
    value,
  );
}

function isDurableRoutingPath(value: string): boolean {
  return isConceptPath(value) || isActiveChangePath(value) || isCapturePath(value);
}

function isClaimReference(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,95}$/.test(value)
    || /^(?:intake|reconstruction):[a-z0-9][a-z0-9-]{0,95}#[a-z0-9][a-z0-9-]{0,95}$/.test(
      value,
    );
}

function containsUntrustedResource(value: string): boolean {
  return /(?:^|[/:])(?:raw|intake)(?:[/:]|$)/i.test(value);
}

function isPinnedCodeResource(value: string): boolean {
  return /^git:.+@[0-9a-f]{40}#[^#\s]+$/i.test(value);
}

function isVersionControlResource(value: string): boolean {
  return /^git:.+@[0-9a-f]{40}(?:#[^#\s]+)?$/i.test(value)
    || /^https?:\/\/\S+\/(?:pull|merge_requests|commit|commits)\/\S+$/i.test(value);
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isIsoDateTimeOrDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
    || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) && !Number.isNaN(Date.parse(value));
}
