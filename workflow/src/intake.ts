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
import { findDistributionRoot } from "./assets.js";
import { errorMessage, isMissingFileError, readConfig } from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { validateKnowledge } from "./knowledge.js";
import type { WorkOutcome } from "./types.js";

const INTAKE_CASE_VERSION = 3;
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
  "unresolved",
]);

const CANDIDATE_AUTHORITIES = new Set([
  "intent",
  "product-meaning",
  "implementation",
  "architecture-rationale",
  "ownership",
  "contract",
  "operational-policy",
  "decision",
  "history",
  "external",
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
  reviewedBy?: string;
  now?: Date;
}

export interface MarkIntakeSourceResult {
  id: string;
  path: string;
  status: string;
  candidateIds: string[];
}

export interface IntakeCaseResult {
  id: string;
  path: string;
  baseline?: string;
  files: number;
  reviewed: number;
  issues: string[];
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
  const entries = readGitTree(target, baseline, ["raw"]);
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
    uncommitted: rawWorkingTreePaths(target),
  };
}

export async function beginIntakeCase(
  options: BeginIntakeCaseOptions,
): Promise<BeginIntakeCaseResult> {
  const target = await requireKnowledgeRepository(options.target);
  const pathspecs = normalizePathspecs(options.paths ?? ["raw"]);
  assertScopeMatchesWorkingTree(target, options.baseline ?? "HEAD", pathspecs);
  const baseline = resolveCommit(target, options.baseline ?? "HEAD");
  const sources = readGitTree(target, baseline, pathspecs);
  if (sources.length === 0) {
    throw new Error(`Intake scope contains no Git-tracked files: ${pathspecs.join(", ")}`);
  }

  const now = options.now ?? new Date();
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
    })),
  };

  try {
    await mkdir(directory, { recursive: false });
    await writeFile(path, serializeCase(document), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return { id, path, baseline, files: sources.length };
}

export async function markIntakeSource(
  options: MarkIntakeSourceOptions,
): Promise<MarkIntakeSourceResult> {
  const target = await requireKnowledgeRepository(options.target);
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
  source.status = options.status;
  source.candidate_ids = candidateIds;
  source.note = options.note.trim();
  source.reviewed_by = options.reviewedBy?.trim() || "workflow-agent/1";
  source.reviewed_at = (options.now ?? new Date()).toISOString();
  document.metadata.updated_at = (options.now ?? new Date()).toISOString();
  await writeFile(casePath, serializeCase(document), "utf8");

  return {
    id: options.id,
    path: options.path,
    status: options.status,
    candidateIds,
  };
}

export async function inspectIntakeCase(
  targetInput: string,
  id: string,
): Promise<IntakeCaseResult> {
  const target = await requireKnowledgeRepository(targetInput);
  const path = intakeCasePath(target, "active", id);
  const document = parseCase(await readFile(path, "utf8"));
  const issues = caseMetadataIssues(document.metadata);
  const baseline = recordValue(document.metadata.baseline);
  const commit = stringValue(baseline?.commit);
  const pathspecs = stringArray(baseline?.paths);
  const sources = recordArray(document.metadata.sources);

  if (commit && pathspecs.length > 0) {
    try {
      const expected = readGitTree(target, commit, normalizePathspecs(pathspecs));
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

function caseMetadataIssues(metadata: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const baseline = recordValue(metadata.baseline);
  const sources = recordArray(metadata.sources);
  const candidates = recordArray(metadata.candidate_claims);
  const promotion = recordValue(metadata.promotion);
  const omissionAudit = recordValue(metadata.omission_audit);

  if (metadata.intake_case_version !== INTAKE_CASE_VERSION) {
    issues.push(`intake_case_version must be ${INTAKE_CASE_VERSION}`);
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
  if (sources.length === 0) {
    issues.push("sources must contain every file from the frozen Git scope");
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
    const authority = stringValue(candidate.authority);
    if (!CANDIDATE_AUTHORITIES.has(authority)) {
      issues.push(`${prefix}.authority is unknown: ${authority}`);
    }
    const disposition = stringValue(candidate.disposition);
    if (!CANDIDATE_STATUSES.has(disposition)) {
      issues.push(`${prefix}.disposition must be confirmed, rejected, or unresolved`);
    } else if (disposition === "unresolved") {
      issues.push(`${prefix}.disposition remains unresolved`);
    }
    if (
      (disposition === "rejected" || disposition === "unresolved")
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
      "intent",
      "product-meaning",
      "architecture-rationale",
      "ownership",
      "contract",
      "operational-policy",
      "decision",
    ].includes(authority);
    if (disposition === "confirmed" && normative) {
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
      && authority === "implementation"
      && !evidenceKinds.has("source-code")
    ) {
      issues.push(`${prefix}: confirmed implementation requires pinned source-code evidence`);
    }
    if (
      disposition === "confirmed"
      && authority === "history"
      && !evidenceKinds.has("version-control")
    ) {
      issues.push(`${prefix}: confirmed history requires pinned version-control evidence`);
    }
    if (
      disposition === "confirmed"
      && authority === "external"
      && !evidenceKinds.has("external-primary")
    ) {
      issues.push(`${prefix}: confirmed external claims require a primary source`);
    }
    if (disposition === "confirmed" && !normative && evidence.length === 0) {
      issues.push(`${prefix}.evidence is required for a confirmed factual claim`);
    }
    if (disposition === "confirmed") {
      const promotedTo = stringArray(candidate.promoted_to);
      if (promotedTo.length === 0) {
        issues.push(`${prefix}.promoted_to must identify every curated destination`);
      }
      for (const concept of promotedTo) {
        if (!isConceptPath(concept)) {
          issues.push(`${prefix}.promoted_to contains an invalid concept path: ${concept}`);
        } else {
          confirmedPromotions.add(concept);
        }
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
    && candidates.some((candidate) => candidate.disposition === "confirmed")
  ) {
    issues.push("promotion cannot be not-needed while confirmed candidates exist");
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

function rawWorkingTreePaths(target: string): string[] {
  const output = git(target, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--",
    "raw",
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

function normalizePathspecs(values: string[]): string[] {
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
    return { metadata, body: lines.slice(end + 1).join("\n") };
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

function isConceptPath(value: string): boolean {
  return /^knowledge\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/i.test(value)
    && !/(?:^|\/)(?:index|log)\.md$/i.test(value);
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
