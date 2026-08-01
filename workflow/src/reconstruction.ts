import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { findDistributionRoot } from "./assets.js";
import {
  commandFailure,
  graphifyCliCheck,
  runTool,
  type ToolRunner,
  updateGraphifyGraph,
} from "./dependencies.js";
import {
  errorMessage,
  isMissingFileError,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { withFileLock } from "./file-lock.js";
import { inventoryRaw, normalizeRawPathspecs } from "./intake.js";
import {
  COVERAGE_STATES,
  FILE_CATEGORIES,
  SURFACE_KINDS,
  createReconstructionCoverage,
  evidencePathFromResource,
  markCoverageCommunity,
  markCoverageFiles,
  markSurfaceAudit,
  readPinnedSource,
  readReconstructionCoverage,
  recordCoverageSurface,
  summarizeReconstructionCoverage,
  validateReconstructionCoverage,
  validateReconstructionCoverageReceipt,
  writeReconstructionCoverage,
  type CoverageState,
  type CoverageSummary,
  type FileCategory,
  type ReadPinnedSourceResult,
  type ReconstructionCoverageLedger,
  type SurfaceKind,
} from "./reconstruction-coverage.js";
import { resolveReconstructionLeaves } from "./repository-registry.js";
import { compileClaimLedger } from "./claim-ledger.js";
import { discoveryLedgerIssues } from "./discovery-ledger.js";
import {
  RECONSTRUCTION_ESCALATION_ACTIONS,
  RECONSTRUCTION_ESCALATION_TRIGGERS,
  LEGACY_RECONSTRUCTION_WORKSTREAM_VERSION,
  RECONSTRUCTION_PROFILES,
  RECONSTRUCTION_WORKLOADS,
  RECONSTRUCTION_WORKSTREAM_VERSION,
  orchestrationWorkstreamPaths,
  readReconstructionWorkstreams,
  reconstructionOrchestrationIssues,
  reconstructionWorkstreamSetIssues,
  reconstructionWorkstreamIssues,
  type ReconstructionReceiptIndexEntry,
  type ReconstructionEscalationAction,
  type ReconstructionEscalationTrigger,
  type ReconstructionProfile,
  type ReconstructionScopeIndexEntry,
  type ReconstructionWorkload,
  type ReconstructionWorkstreamRecord,
} from "./reconstruction-orchestration.js";
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
  type RelatedSessionContent,
} from "./knowledge-session.js";
import type { AgentTarget, DoctorCheck, WorkOutcome } from "./types.js";
import {
  isRecord,
  parseWorkSpec,
  serializeWorkSpec,
} from "./work-spec.js";

const RECONSTRUCTION_VERSION = 5;
const RAW_SCOPE_RECONSTRUCTION_VERSION = 4;
const LEGACY_RECONSTRUCTION_VERSION = 3;
const RECONSTRUCTION_SESSION_VERSION = 1;
const RAW_SCOPE_MODES = ["all", "selected", "excluded", "unavailable"] as const;
const RECONSTRUCTION_CHECKPOINT_STAGES = [
  "setup",
  "repository-analysis",
  "reconciliation",
  "promotion",
  "review",
] as const;
const FINAL_REVIEW_STATES = new Set(["reviewed", "not-available", "not-relevant"]);
const CANDIDATE_DISPOSITIONS = new Set([
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
  "history",
  "uncertainty",
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

interface LocalBinding {
  schemaVersion: 1;
  caseId: string;
  knowledgeRoot: string;
  repositories: Array<{
    repository: string;
    root: string;
    commit: string;
    worktreeId: string;
  }>;
}

export interface BeginReconstructionOptions {
  target: string;
  slug: string;
  title: string;
  leaves: string[];
  mode?: "baseline" | "audit";
  distributionRoot?: string;
  runner?: ToolRunner;
  /** Agent platforms used to render Graphify native-skill remediation steps. */
  agents?: AgentTarget[];
  now?: Date;
}

/**
 * Raised when reconstruction cannot start because an external tool is missing.
 * It carries the same structured remediation as installation preflight so the
 * CLI can print actionable steps instead of a bare subprocess failure.
 */
export class ReconstructionDependencyError extends Error {
  readonly check: DoctorCheck;

  constructor(check: DoctorCheck) {
    super(check.message);
    this.name = "ReconstructionDependencyError";
    this.check = check;
  }
}

export interface BeginReconstructionResult {
  id: string;
  path: string;
  mode: "baseline" | "audit";
  repositories: Array<{
    repository: string;
    commit: string;
    dossier: string;
    coverage: string;
    graphNodes: number;
    trackedFiles: number;
  }>;
}

export interface ReconstructionInspection {
  id: string;
  path: string;
  repositories: number;
  reviewed: number;
  candidates: number;
  issues: string[];
}

export interface CloseReconstructionOptions {
  target: string;
  id: string;
  outcome: WorkOutcome;
  now?: Date;
}

export interface CloseReconstructionResult {
  id: string;
  outcome: WorkOutcome;
  archivePath: string;
}

export interface ReconstructionCoverageInspection {
  id: string;
  repositories: CoverageSummary[];
}

export interface ReconstructionContext {
  id: string;
  title: string;
  mode: string;
  root: string;
  requiredFiles: KnowledgeSessionFile[];
  orchestration: {
    execution: string;
    status: string;
    reason: string;
    maxParallel: number;
    maxWorkstreams: number;
    maxRetriesPerWorkstream: number;
    synthesisStatus: string;
    independentReviewStatus: string;
    independentReviewAssurance: string;
    independentReviewRunId: string;
    independentReviewProfile: string;
    independentReviewModel: string;
    independentReviewReasoningEffort: string;
  };
  workstreams: Array<{
    id: string;
    title: string;
    wave: number;
    role: string;
    workload: string;
    requestedProfile: string;
    executionProfile: string;
    executionModel: string;
    executionReasoningEffort: string;
    escalationCount: number;
    status: string;
    owner: string;
    path: string;
    reviewStatus: string;
  }>;
  coverage: CoverageSummary[];
  rawScope: {
    status: string;
    mode: string;
    paths: string[];
    decidedBy: string;
    decidedAt: string;
    note: string;
  };
  checkpoint?: KnowledgeSessionCheckpointSummary;
  validationIssues: string[];
}

export interface CreateReconstructionWorkstreamOptions {
  target: string;
  id: string;
  workstream: string;
  title: string;
  objective: string;
  role: string;
  workload: ReconstructionWorkload;
  profile: ReconstructionProfile;
  routingReason: string;
  wave: number;
  repositories?: string[];
  files?: string[];
  communities?: string[];
  surfaces?: string[];
  rawCases?: string[];
  dependencies?: string[];
  distributionRoot?: string;
  now?: Date;
}

export interface ClaimReconstructionWorkstreamOptions {
  target: string;
  id: string;
  workstream: string;
  actor: string;
  host: string;
  runId: string;
  model?: string;
  reasoningEffort?: string;
  now?: Date;
}

export interface EscalateReconstructionWorkstreamOptions {
  target: string;
  id: string;
  workstream: string;
  actor: string;
  trigger: ReconstructionEscalationTrigger;
  action: ReconstructionEscalationAction;
  targetProfile?: ReconstructionProfile;
  targetWorkstream?: string;
  reason: string;
  now?: Date;
}

export interface SubmitReconstructionWorkstreamOptions {
  target: string;
  id: string;
  workstream: string;
  actor: string;
  now?: Date;
}

export interface ReviewReconstructionWorkstreamOptions {
  target: string;
  id: string;
  workstream: string;
  reviewer: string;
  status: "accepted" | "rework" | "cancelled";
  notes: string[];
  now?: Date;
}

export interface ReconstructionWorkstreamMutationResult {
  id: string;
  workstream: string;
  status: string;
  path: string;
}

export interface UpdateReconstructionCheckpointOptions {
  target: string;
  id: string;
  status: KnowledgeSessionStatus;
  stage: typeof RECONSTRUCTION_CHECKPOINT_STAGES[number];
  actor: string;
  currentState: string;
  lastCompleted: string;
  nextAction: string;
  blockers?: string[];
  now?: Date;
}

export type ReconstructionRawScopeMode = typeof RAW_SCOPE_MODES[number];

export interface ApproveReconstructionRawScopeOptions {
  target: string;
  id: string;
  mode: ReconstructionRawScopeMode;
  paths?: string[];
  approvedBy?: string;
  note: string;
  now?: Date;
}

export interface ReconstructionRawScopeResult {
  id: string;
  mode: ReconstructionRawScopeMode;
  paths: string[];
  approvedBy: string;
  approvedAt: string;
  rawFiles: number;
  status: string;
}

export interface MarkReconstructionFilesOptions {
  target: string;
  id: string;
  repository?: string;
  paths: string[];
  category?: FileCategory;
  status?: CoverageState;
  reason?: string;
}

export interface MarkReconstructionCommunityOptions {
  target: string;
  id: string;
  repository?: string;
  community: string;
  status: CoverageState;
  note: string;
  queries?: string[];
}

export interface RecordReconstructionSurfaceOptions {
  target: string;
  id: string;
  repository?: string;
  surface: string;
  kind: SurfaceKind;
  description: string;
  paths: string[];
  status: CoverageState;
  note: string;
  candidateIds?: string[];
}

export interface ReviewReconstructionSurfacesOptions {
  target: string;
  id: string;
  repository?: string;
  status: "reviewed" | "not-relevant" | "blocked";
  note: string;
}

export interface ReadReconstructionSourceOptions {
  target: string;
  id: string;
  repository?: string;
  path: string;
  startLine?: number;
  endLine?: number;
  actor?: string;
  now?: Date;
}

export async function beginProjectReconstruction(
  options: BeginReconstructionOptions,
): Promise<BeginReconstructionResult> {
  const target = await requireKnowledgeRepository(options.target);
  const mode = options.mode ?? "baseline";
  if (mode !== "baseline" && mode !== "audit") {
    throw new Error(`Invalid reconstruction mode: ${mode}`);
  }
  const title = options.title.trim();
  if (!title) {
    throw new Error("Reconstruction title must not be empty");
  }
  const knowledgeMetadata = readRepositoryMetadata(target);
  if (!/^[0-9a-f]{40}$/i.test(knowledgeMetadata.commit)) {
    throw new Error(
      "Reconstruction requires an initial knowledge-repository commit so optional inputs can be frozen",
    );
  }
  const leafRoots = await normalizeLeafRoots(
    await resolveReconstructionLeaves(target, options.leaves, mode),
  );

  const repositoryInputs = [];
  const repositoryIds = new Set<string>();
  for (const root of leafRoots) {
    const config = await readConfig(root);
    if (config.profile !== "leaf") {
      throw new Error(`Reconstruction source is not an initialized leaf: ${root}`);
    }
    const configuredKnowledge = await realpath(resolveKnowledgeRoot(root, config));
    if (configuredKnowledge !== target) {
      throw new Error(
        `Leaf points to a different knowledge repository: ${root} -> ${configuredKnowledge}`,
      );
    }
    const metadata = readRepositoryMetadata(root);
    if (metadata.dirty) {
      throw new Error(
        `Reconstruction requires a clean leaf checkout so its evidence matches HEAD: ${root}`,
      );
    }
    if (!/^[0-9a-f]{40}$/i.test(metadata.commit)) {
      throw new Error(`Leaf HEAD is not a full Git commit: ${root}`);
    }
    if (repositoryIds.has(metadata.repository)) {
      throw new Error(
        `Reconstruction received more than one checkout for repository ${metadata.repository}`,
      );
    }
    repositoryIds.add(metadata.repository);
    repositoryInputs.push({ root, metadata });
  }

  const runner = options.runner ?? runTool;
  // Reconstruction is the one knowledge-repository operation that drives
  // Graphify itself, and `wfctl init knowledge` never preflights it. Fail with
  // the same structured remediation as leaf initialization instead of leaking a
  // bare spawn error, and fail before the case directory exists.
  const firstRepository = repositoryInputs[0];
  if (firstRepository) {
    const graphifyAvailable = graphifyCliCheck({
      target: firstRepository.root,
      agents: options.agents ?? [],
      runner,
      blocks: "reconstruction",
    });
    if (graphifyAvailable.status !== "pass") {
      throw new ReconstructionDependencyError(graphifyAvailable);
    }
  }
  const graphResults: Array<{ nodes: number; contentHash: string }> = [];
  for (const input of repositoryInputs) {
    const updated = updateGraphifyGraph(input.root, runner);
    if (updated.status !== 0) {
      throw new Error(
        `Graphify update failed for ${input.metadata.repository}: ${commandFailure(updated)}`,
      );
    }
    graphResults.push(await graphSummary(input.root));
  }

  const now = options.now ?? new Date();
  const base = `${now.toISOString().slice(0, 10)}-${normalizeSlug(options.slug)}`;
  const activeRoot = join(target, "reconstruction/active");
  const id = await uniqueDirectoryId(activeRoot, base);
  const directory = join(activeRoot, id);
  const casePath = join(directory, "case.md");
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const caseTemplate = await readFile(
    join(
      distributionRoot,
      "skills/reconstruct-project-knowledge/assets/reconstruction-case.md",
    ),
    "utf8",
  );
  const dossierTemplate = await readFile(
    join(
      distributionRoot,
      "skills/reconstruct-project-knowledge/assets/repository-dossier.md",
    ),
    "utf8",
  );
  const document = parseWorkSpec(caseTemplate);
  const createdAt = now.toISOString();
  const supplementalInputs = recordValue(document.metadata.supplemental_inputs) ?? {};
  const rawInput = recordValue(supplementalInputs.raw) ?? {};
  const initialRawInventory = await inventoryRaw({
    target,
    baseline: knowledgeMetadata.commit,
  });
  const rawUnavailable = initialRawInventory.entries.length === 0
    && initialRawInventory.uncommitted.length === 0
    && !await containsFiles(join(target, "raw"));
  supplementalInputs.raw = rawUnavailable
    ? {
      ...rawInput,
      status: "not-available",
      baseline: knowledgeMetadata.commit,
      scope: {
        mode: "unavailable",
        paths: [],
        decided_by: "system:wfctl",
        decided_at: createdAt,
        note: "No committed or uncommitted raw input existed when reconstruction started.",
      },
      notes: ["The reconstruction-start raw snapshot contains no files."],
    }
    : {
      ...rawInput,
      baseline: knowledgeMetadata.commit,
    };
  const durableRepositories = repositoryInputs.map((input, index) => {
    const repositorySlug = uniqueDossierName(
      input.metadata.repository,
      index,
    );
    const dossier = `repositories/${repositorySlug}.md`;
    const coverage = `repositories/${repositorySlug}.coverage.json`;
    return {
      repository: input.metadata.repository,
      branch: input.metadata.branch,
      commit: input.metadata.commit,
      checkout: input.metadata.checkout,
      worktree: input.metadata.worktree,
      worktree_id: input.metadata.worktreeId,
      graphify: {
        status: "ready",
        nodes: graphResults[index]!.nodes,
        content_hash: graphResults[index]!.contentHash,
      },
      dossier,
      coverage,
    };
  });
  const coverageLedgers = await Promise.all(
    repositoryInputs.map((input, index) =>
      createReconstructionCoverage(
        input.root,
        input.metadata.repository,
        input.metadata.commit,
        join(input.root, "graphify-out/graph.json"),
        now,
      ).then((ledger) => {
        if (ledger.graphify.contentHash !== graphResults[index]!.contentHash) {
          throw new Error(
            `${input.metadata.repository}: Graphify changed while reconstruction coverage was frozen`,
          );
        }
        return ledger;
      })
    ),
  );
  document.metadata = {
    ...document.metadata,
    reconstruction_version: RECONSTRUCTION_VERSION,
    id,
    title,
    mode,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    repositories: durableRepositories,
    supplemental_inputs: supplementalInputs,
  };

  const binding: LocalBinding = {
    schemaVersion: 1,
    caseId: id,
    knowledgeRoot: target,
    repositories: repositoryInputs.map(({ root, metadata }) => ({
      repository: metadata.repository,
      root,
      commit: metadata.commit,
      worktreeId: metadata.worktreeId,
    })),
  };
  const bindingPath = reconstructionBindingPath(target, id);
  try {
    await mkdir(join(directory, "repositories"), { recursive: true });
    await mkdir(join(directory, "workstreams"), { recursive: true });
    await writeFile(casePath, serializeWorkSpec(document), {
      encoding: "utf8",
      flag: "wx",
    });
    for (const [index, repository] of durableRepositories.entries()) {
      const dossier = parseWorkSpec(dossierTemplate);
      dossier.metadata = {
        ...dossier.metadata,
        case_id: id,
        repository: repository.repository,
        commit: repository.commit,
        status: "pending",
      };
      await writeFile(
        join(directory, repository.dossier),
        serializeWorkSpec(dossier),
        { encoding: "utf8", flag: "wx" },
      );
      await writeFile(
        join(directory, repository.coverage),
        `${JSON.stringify(coverageLedgers[index], null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
    }
    await mkdir(dirname(bindingPath), { recursive: true });
    await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await updateReconstructionCheckpoint({
      target,
      id,
      status: "active",
      stage: "setup",
      actor: "system:wfctl",
      currentState: "Reconstruction case created from exact clean repository revisions.",
      lastCompleted: "Repository dossiers, coverage ledgers, and local checkout bindings were frozen.",
      nextAction: "Read the complete case and every dossier, choose the orchestration mode and budget, then inspect the full coverage frontier.",
      blockers: [],
      now,
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    try {
      await unlink(bindingPath);
    } catch (cleanupError) {
      if (!isMissingFileError(cleanupError)) {
        throw new AggregateError([error, cleanupError], "Reconstruction rollback failed");
      }
    }
    throw error;
  }

  return {
    id,
    path: casePath,
    mode,
    repositories: durableRepositories.map((repository, index) => ({
      repository: repository.repository,
      commit: repository.commit,
      dossier: join(directory, repository.dossier),
      coverage: join(directory, repository.coverage),
      graphNodes: graphResults[index]!.nodes,
      trackedFiles: coverageLedgers[index]!.manifest.files.length,
    })),
  };
}

export async function createReconstructionWorkstream(
  options: CreateReconstructionWorkstreamOptions,
): Promise<ReconstructionWorkstreamMutationResult> {
  assertWorkstreamId(options.workstream);
  if (
    !options.title.trim()
    || !options.objective.trim()
    || !options.role.trim()
    || !options.routingReason.trim()
  ) {
    throw new Error("Workstream title, objective, role, and routing reason are required");
  }
  if (!RECONSTRUCTION_WORKLOADS.includes(options.workload)) {
    throw new Error(`Unknown reconstruction workload: ${options.workload}`);
  }
  if (!RECONSTRUCTION_PROFILES.includes(options.profile)) {
    throw new Error(`Unknown reconstruction profile: ${options.profile}`);
  }
  if (options.workload === "analysis" && options.profile === "fast") {
    throw new Error("Analysis work requires a balanced or deep profile");
  }
  if (
    (options.workload === "synthesis" || options.workload === "review")
    && options.profile !== "deep"
  ) {
    throw new Error("Synthesis and review work require a deep profile");
  }
  if (!Number.isInteger(options.wave) || options.wave < 1) {
    throw new Error("Workstream wave must be a positive integer");
  }
  return await withLockedReconstructionCase(
    options.target,
    options.id,
    async ({ target, casePath, caseDirectory, document }) => {
      const orchestration = recordValue(document.metadata.orchestration);
      if (!orchestration) {
        throw new Error("Reconstruction orchestration must be planned before creating workstreams");
      }
      const execution = stringValue(orchestration.execution);
      if (execution !== "orchestrator-workers") {
        throw new Error(
          "Workstreams require orchestration.execution: orchestrator-workers",
        );
      }
      const relativePath = `workstreams/${options.workstream}.md`;
      const registered = stringArray(orchestration.workstreams);
      if (registered.includes(relativePath)) {
        throw new Error(`Reconstruction workstream already exists: ${options.workstream}`);
      }
      const budget = recordValue(orchestration.budget);
      const maxWorkstreams = Number(budget?.max_workstreams);
      if (!Number.isInteger(maxWorkstreams) || maxWorkstreams < 1) {
        throw new Error(
          "Plan orchestration.budget.max_workstreams before creating worker packets",
        );
      }
      if (registered.length >= maxWorkstreams) {
        throw new Error(
          `Workstream budget exhausted: ${registered.length}/${maxWorkstreams}`,
        );
      }

      const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
      const template = parseWorkSpec(await readFile(
        join(
          distributionRoot,
          "skills/reconstruct-project-knowledge/assets/reconstruction-workstream.md",
        ),
        "utf8",
      ));
      const now = options.now ?? new Date();
      const timestamp = now.toISOString();
      const files = uniqueSorted(options.files ?? []);
      const communities = uniqueSorted(options.communities ?? []);
      const surfaces = uniqueSorted(options.surfaces ?? []);
      const inferredRepositories = [...files, ...communities, ...surfaces]
        .map((reference) => {
          const separator = reference.indexOf("#");
          return separator > 0 ? reference.slice(0, separator) : "";
        })
        .filter(Boolean);
      template.metadata = {
        ...template.metadata,
        reconstruction_workstream_version: RECONSTRUCTION_WORKSTREAM_VERSION,
        case_id: options.id,
        id: options.workstream,
        title: options.title.trim(),
        wave: options.wave,
        role: options.role.trim(),
        routing: {
          workload: options.workload,
          initial_profile: options.profile,
          requested_profile: options.profile,
          reason: options.routingReason.trim(),
          escalation_history: [],
          execution_history: [],
        },
        status: "planned",
        owner: "",
        attempt: 1,
        created_at: timestamp,
        updated_at: timestamp,
        execution: {
          host: "",
          run_id: "",
          profile: "",
          model: "",
          reasoning_effort: "",
          claimed_at: "",
        },
        dependencies: uniqueSorted(options.dependencies ?? []),
        repositories: uniqueSorted([
          ...(options.repositories ?? []),
          ...inferredRepositories,
        ]),
        coverage_slice: {
          files,
          communities,
          surfaces,
          raw_cases: uniqueSorted(options.rawCases ?? []),
        },
        explored_context: {
          files: [],
          communities: [],
          surfaces: [],
          raw_cases: [],
          notes: [],
        },
        result: {
          summary: "",
          candidate_ids: [],
          evidence_refs: [],
          uncertainties: [],
          contradictions: [],
          negative_claims: [],
          authority_questions: [],
          unexplained: [],
          follow_up: [],
        },
        review: {
          status: "pending",
          by: "",
          at: "",
          notes: [],
        },
        review_history: [],
      };
      template.body = renderWorkstreamBody(options.objective.trim());
      const workstreamPath = join(caseDirectory, relativePath);
      await writeFile(workstreamPath, serializeWorkSpec(template), {
        encoding: "utf8",
        flag: "wx",
      });
      orchestration.workstreams = [...registered, relativePath];
      orchestration.status = "running";
      document.metadata.updated_at = timestamp;
      try {
        await writeFile(casePath, serializeWorkSpec(document), "utf8");
      } catch (error) {
        await unlink(workstreamPath);
        throw error;
      }
      return {
        id: options.id,
        workstream: options.workstream,
        status: "planned",
        path: relative(target, workstreamPath),
      };
    },
  );
}

export async function claimReconstructionWorkstream(
  options: ClaimReconstructionWorkstreamOptions,
): Promise<ReconstructionWorkstreamMutationResult> {
  return await mutateReconstructionWorkstream(
    options.target,
    options.id,
    options.workstream,
    options.now,
    async ({ document, timestamp }) => {
      const actor = options.actor.trim();
      const host = options.host.trim();
      const runId = options.runId.trim();
      if (!actor || !host || !runId) {
        throw new Error("Workstream claim requires actor, host, and run ID");
      }
      const status = stringValue(document.metadata.status);
      if (status !== "planned" && status !== "rework") {
        throw new Error(`Cannot claim workstream in ${status || "unknown"} state`);
      }
      if (status === "rework") {
        document.metadata.attempt = Number(document.metadata.attempt) + 1;
      }
      const workstreamVersion = Number(document.metadata.reconstruction_workstream_version);
      if (workstreamVersion === LEGACY_RECONSTRUCTION_WORKSTREAM_VERSION) {
        document.metadata.status = "active";
        document.metadata.owner = actor;
        document.metadata.execution = {
          host,
          run_id: runId,
          claimed_at: timestamp,
        };
        document.metadata.updated_at = timestamp;
        return;
      }
      if (workstreamVersion !== RECONSTRUCTION_WORKSTREAM_VERSION) {
        throw new Error(`Unsupported reconstruction workstream version: ${workstreamVersion}`);
      }
      const routing = recordValue(document.metadata.routing);
      if (!routing) {
        throw new Error("Workstream routing metadata is missing");
      }
      const profile = stringValue(routing.requested_profile);
      if (!RECONSTRUCTION_PROFILES.includes(profile as ReconstructionProfile)) {
        throw new Error(`Unknown requested reconstruction profile: ${profile || "missing"}`);
      }
      const attempt = Number(document.metadata.attempt);
      const model = options.model?.trim() || "host-auto";
      const reasoningEffort = options.reasoningEffort?.trim() || "profile-default";
      const execution = {
        attempt,
        by: actor,
        host,
        run_id: runId,
        profile,
        model,
        reasoning_effort: reasoningEffort,
        claimed_at: timestamp,
      };
      routing.execution_history = [
        ...recordArray(routing.execution_history),
        execution,
      ];
      document.metadata.routing = routing;
      document.metadata.status = "active";
      document.metadata.owner = actor;
      document.metadata.execution = {
        host,
        run_id: runId,
        profile,
        model,
        reasoning_effort: reasoningEffort,
        claimed_at: timestamp,
      };
      document.metadata.updated_at = timestamp;
    },
  );
}

export async function escalateReconstructionWorkstream(
  options: EscalateReconstructionWorkstreamOptions,
): Promise<ReconstructionWorkstreamMutationResult> {
  return await mutateReconstructionWorkstream(
    options.target,
    options.id,
    options.workstream,
    options.now,
    async ({ caseDirectory, caseDocument, document, timestamp }) => {
      const actor = options.actor.trim();
      const reason = options.reason.trim();
      if (!actor || !reason) {
        throw new Error("Workstream escalation requires an actor and reason");
      }
      if (!RECONSTRUCTION_ESCALATION_TRIGGERS.includes(options.trigger)) {
        throw new Error(`Unknown reconstruction escalation trigger: ${options.trigger}`);
      }
      if (!RECONSTRUCTION_ESCALATION_ACTIONS.includes(options.action)) {
        throw new Error(`Unknown reconstruction escalation action: ${options.action}`);
      }
      if (
        Number(document.metadata.reconstruction_workstream_version)
        !== RECONSTRUCTION_WORKSTREAM_VERSION
      ) {
        throw new Error(
          "Adaptive routing escalation is available only for version 3 workstreams; legacy version 2 packets continue under their original lifecycle",
        );
      }
      const status = stringValue(document.metadata.status);
      if (!["submitted", "rework"].includes(status)) {
        throw new Error(
          `Cannot record routing escalation while workstream is ${status || "unknown"}`,
        );
      }
      if (options.trigger === "review-rework" && status !== "rework") {
        throw new Error("review-rework escalation requires a recorded rework review");
      }
      const routing = recordValue(document.metadata.routing);
      if (!routing) {
        throw new Error("Workstream routing metadata is missing");
      }
      const fromProfile = stringValue(routing.requested_profile) as ReconstructionProfile;
      if (!RECONSTRUCTION_PROFILES.includes(fromProfile)) {
        throw new Error(`Unknown current reconstruction profile: ${fromProfile || "missing"}`);
      }
      let toProfile = fromProfile;
      if (options.action === "stronger-profile") {
        if (status !== "planned" && status !== "rework") {
          throw new Error(
            "Return submitted work for rework before assigning a stronger profile",
          );
        }
        if (!options.targetProfile || !RECONSTRUCTION_PROFILES.includes(options.targetProfile)) {
          throw new Error("stronger-profile escalation requires --to-profile");
        }
        if (
          RECONSTRUCTION_PROFILES.indexOf(options.targetProfile)
          <= RECONSTRUCTION_PROFILES.indexOf(fromProfile)
        ) {
          throw new Error("stronger-profile escalation must increase the requested profile");
        }
        toProfile = options.targetProfile;
        routing.requested_profile = toProfile;
      } else if (options.targetProfile !== undefined) {
        throw new Error("--to-profile is valid only with stronger-profile escalation");
      }
      let targetWorkstream = "";
      if (options.action === "new-workstream") {
        if (!options.targetWorkstream) {
          throw new Error("new-workstream escalation requires --target-workstream");
        }
        assertWorkstreamId(options.targetWorkstream);
        if (options.targetWorkstream === options.workstream) {
          throw new Error("new-workstream escalation must reference another packet");
        }
        if (
          !orchestrationWorkstreamPaths(caseDocument.metadata)
            .includes(`workstreams/${options.targetWorkstream}.md`)
        ) {
          throw new Error(
            `Escalation target workstream is not registered: ${options.targetWorkstream}`,
          );
        }
        const targetDocument = parseWorkSpec(
          await readFile(
            join(caseDirectory, "workstreams", `${options.targetWorkstream}.md`),
            "utf8",
          ),
        );
        if (targetDocument.metadata.status !== "planned") {
          throw new Error("new-workstream escalation target must still be planned");
        }
        if (Number(targetDocument.metadata.wave) <= Number(document.metadata.wave)) {
          throw new Error("new-workstream escalation target must belong to a later wave");
        }
        if (!stringArray(targetDocument.metadata.dependencies).includes(options.workstream)) {
          throw new Error(
            "new-workstream escalation target must depend on the originating workstream",
          );
        }
        targetWorkstream = options.targetWorkstream;
      } else if (options.targetWorkstream !== undefined) {
        throw new Error("--target-workstream is valid only with new-workstream escalation");
      }
      if (options.action === "maintainer-review" && !actor.startsWith("human:")) {
        throw new Error("maintainer-review escalation must be recorded by human:<maintainer-id>");
      }
      const history = recordArray(routing.escalation_history);
      const currentAttempt = Number(document.metadata.attempt);
      const escalationAttempt = status === "rework"
        ? currentAttempt + 1
        : currentAttempt;
      routing.escalation_history = [
        ...history,
        {
          attempt: escalationAttempt,
          trigger: options.trigger,
          action: options.action,
          from_profile: fromProfile,
          to_profile: toProfile,
          target_workstream: targetWorkstream,
          by: actor,
          at: timestamp,
          reason,
        },
      ];
      document.metadata.routing = routing;
      document.metadata.updated_at = timestamp;
    },
  );
}

export async function submitReconstructionWorkstream(
  options: SubmitReconstructionWorkstreamOptions,
): Promise<ReconstructionWorkstreamMutationResult> {
  return await mutateReconstructionWorkstream(
    options.target,
    options.id,
    options.workstream,
    options.now,
    async ({ target, caseDirectory, caseDocument, record, document, timestamp }) => {
      const actor = options.actor.trim();
      if (!actor || actor !== stringValue(document.metadata.owner)) {
        throw new Error("Only the recorded workstream owner may submit it");
      }
      if (document.metadata.status !== "active") {
        throw new Error("Only an active workstream may be submitted");
      }
      document.metadata.status = "submitted";
      document.metadata.updated_at = timestamp;
      record.document = document;
      record.content = Buffer.from(serializeWorkSpec(document));
      const context = await workstreamValidationContext(
        target,
        options.id,
        caseDirectory,
        caseDocument,
      );
      const issues = reconstructionWorkstreamIssues(
        record,
        options.id,
        context.repositoryIds,
        context.workstreamIds,
        context.maxRetries,
        context.scopeIndex,
        context.rawCaseIds,
        context.receiptIndex,
        "submit",
      );
      if (issues.length > 0) {
        throw new Error(`Workstream submission is incomplete: ${issues.join("; ")}`);
      }
    },
  );
}

export async function reviewReconstructionWorkstream(
  options: ReviewReconstructionWorkstreamOptions,
): Promise<ReconstructionWorkstreamMutationResult> {
  return await mutateReconstructionWorkstream(
    options.target,
    options.id,
    options.workstream,
    options.now,
    async ({ target, caseDirectory, caseDocument, record, document, timestamp }) => {
      const reviewer = options.reviewer.trim();
      const notes = options.notes.map((note) => note.trim()).filter(Boolean);
      if (!reviewer || notes.length === 0) {
        throw new Error("Workstream review requires a reviewer and at least one note");
      }
      if (reviewer === stringValue(document.metadata.owner)) {
        throw new Error("Workstream reviewer must differ from its owner");
      }
      if (
        options.status !== "cancelled"
        && document.metadata.status !== "submitted"
      ) {
        throw new Error("Only a submitted workstream may be accepted or returned");
      }
      if (
        options.status === "cancelled"
        && ["accepted", "cancelled"].includes(stringValue(document.metadata.status))
      ) {
        throw new Error("Completed workstream cannot be cancelled");
      }
      if (options.status === "accepted") {
        const context = await workstreamValidationContext(
          target,
          options.id,
          caseDirectory,
          caseDocument,
        );
        const submitIssues = reconstructionWorkstreamIssues(
          record,
          options.id,
          context.repositoryIds,
          context.workstreamIds,
          context.maxRetries,
          context.scopeIndex,
          context.rawCaseIds,
          context.receiptIndex,
          "accept",
        );
        if (submitIssues.length > 0) {
          throw new Error(`Workstream cannot be accepted: ${submitIssues.join("; ")}`);
        }
      }
      document.metadata.status = options.status;
      document.metadata.review = {
        status: options.status === "rework" ? "rework" : "accepted",
        by: reviewer,
        at: timestamp,
        notes,
      };
      if (
        Number(document.metadata.reconstruction_workstream_version)
        === RECONSTRUCTION_WORKSTREAM_VERSION
      ) {
        document.metadata.review_history = [
          ...recordArray(document.metadata.review_history),
          {
            attempt: Number(document.metadata.attempt),
            outcome: options.status,
            by: reviewer,
            at: timestamp,
            notes,
          },
        ];
      }
      document.metadata.updated_at = timestamp;
    },
  );
}

export async function reconstructionContext(
  targetInput: string,
  requestedId?: string,
): Promise<ReconstructionContext> {
  const target = await requireKnowledgeRepository(targetInput);
  const selected = await selectActiveCase(
    join(target, "reconstruction/active"),
    requestedId,
    "reconstruction",
  );
  const document = parseWorkSpec(await readFile(selected.path, "utf8"));
  const session = await reconstructionSessionState(target, selected.id, document);
  const issues: string[] = [];
  const sessionVersion = Number(document.metadata.session_record_version);
  if (sessionVersion === RECONSTRUCTION_SESSION_VERSION) {
    issues.push(...discoveryLedgerIssues(document.body, "case.md", true));
  }
  for (const dossier of session.dossiers) {
    const parsed = parseWorkSpec(dossier.content.toString("utf8"));
    if (Number(parsed.metadata.session_record_version) === RECONSTRUCTION_SESSION_VERSION) {
      issues.push(...discoveryLedgerIssues(parsed.body, dossier.path, true));
    }
  }
  const checkpoint = inspectSessionCheckpoint(
    document,
    session.basis,
    RECONSTRUCTION_CHECKPOINT_STAGES,
    sessionVersion === RECONSTRUCTION_SESSION_VERSION,
  );
  if (checkpoint) {
    issues.push(...checkpoint.issues);
  }
  const bindingIssues: string[] = [];
  const binding = await readBinding(target, selected.id, bindingIssues);
  if (binding) {
    if (binding.caseId !== selected.id || binding.knowledgeRoot !== target) {
      bindingIssues.push("local reconstruction binding does not match this knowledge checkout");
    }
    const durableRepositories = recordArray(document.metadata.repositories);
    for (const repository of durableRepositories) {
      const repositoryId = stringValue(repository.repository);
      const local = binding.repositories.find((entry) => entry.repository === repositoryId);
      if (
        !local
        || local.commit !== stringValue(repository.commit)
        || local.worktreeId !== stringValue(repository.worktree_id)
      ) {
        bindingIssues.push(`${repositoryId}: local checkout binding does not match the durable case`);
      }
    }
    for (const local of binding.repositories) {
      if (!durableRepositories.some((entry) => entry.repository === local.repository)) {
        bindingIssues.push(`${local.repository}: local binding is outside the durable case scope`);
      }
    }
  }
  issues.push(...bindingIssues);
  const raw = recordValue(recordValue(document.metadata.supplemental_inputs)?.raw);
  const rawScope = recordValue(raw?.scope);
  const orchestration = recordValue(document.metadata.orchestration);
  const orchestrationBudget = recordValue(orchestration?.budget);
  const reconstructionVersion = Number(document.metadata.reconstruction_version);
  if (reconstructionVersion === LEGACY_RECONSTRUCTION_VERSION) {
    issues.push(
      `reconstruction_version ${LEGACY_RECONSTRUCTION_VERSION} has no maintainer-approved raw scope; record it with wfctl knowledge reconstruct raw-scope`,
    );
  } else if (
    reconstructionVersion === RAW_SCOPE_RECONSTRUCTION_VERSION
    || reconstructionVersion === RECONSTRUCTION_VERSION
  ) {
    issues.push(...reconstructionRawScopeIssues(raw));
  }
  return {
    id: selected.id,
    title: stringValue(document.metadata.title) || selected.title,
    mode: stringValue(document.metadata.mode),
    root: dirname(selected.path),
    requiredFiles: session.files,
    orchestration: {
      execution: stringValue(orchestration?.execution),
      status: stringValue(orchestration?.status),
      reason: stringValue(orchestration?.reason),
      maxParallel: Number(orchestrationBudget?.max_parallel) || 0,
      maxWorkstreams: Number(orchestrationBudget?.max_workstreams) || 0,
      maxRetriesPerWorkstream: Number(orchestrationBudget?.max_retries_per_workstream) || 0,
      synthesisStatus: stringValue(recordValue(orchestration?.synthesis)?.status),
      independentReviewStatus: stringValue(
        recordValue(orchestration?.independent_review)?.status,
      ),
      independentReviewAssurance: stringValue(
        recordValue(orchestration?.independent_review)?.assurance,
      ),
      independentReviewRunId: stringValue(
        recordValue(orchestration?.independent_review)?.run_id,
      ),
      independentReviewProfile: stringValue(
        recordValue(
          recordValue(orchestration?.independent_review)?.routing,
        )?.requested_profile,
      ),
      independentReviewModel: stringValue(
        recordValue(orchestration?.independent_review)?.model,
      ),
      independentReviewReasoningEffort: stringValue(
        recordValue(orchestration?.independent_review)?.reasoning_effort,
      ),
    },
    workstreams: session.workstreams.map(({ path, document }) => ({
      id: stringValue(document.metadata.id),
      title: stringValue(document.metadata.title),
      wave: Number(document.metadata.wave),
      role: stringValue(document.metadata.role),
      workload: stringValue(recordValue(document.metadata.routing)?.workload),
      requestedProfile: stringValue(
        recordValue(document.metadata.routing)?.requested_profile,
      ),
      executionProfile: stringValue(recordValue(document.metadata.execution)?.profile),
      executionModel: stringValue(recordValue(document.metadata.execution)?.model),
      executionReasoningEffort: stringValue(
        recordValue(document.metadata.execution)?.reasoning_effort,
      ),
      escalationCount: recordArray(
        recordValue(document.metadata.routing)?.escalation_history,
      ).length,
      status: stringValue(document.metadata.status),
      owner: stringValue(document.metadata.owner),
      path,
      reviewStatus: stringValue(recordValue(document.metadata.review)?.status),
    })),
    coverage: session.coverage,
    rawScope: {
      status: stringValue(raw?.status),
      mode: stringValue(rawScope?.mode),
      paths: stringArray(rawScope?.paths),
      decidedBy: stringValue(rawScope?.decided_by),
      decidedAt: stringValue(rawScope?.decided_at),
      note: stringValue(rawScope?.note),
    },
    ...(checkpoint ? { checkpoint } : {}),
    validationIssues: [...new Set(issues)].sort(),
  };
}

export async function approveReconstructionRawScope(
  options: ApproveReconstructionRawScopeOptions,
): Promise<ReconstructionRawScopeResult> {
  const target = await requireKnowledgeRepository(options.target);
  if (!RAW_SCOPE_MODES.includes(options.mode)) {
    throw new Error(`Invalid reconstruction raw scope mode: ${options.mode}`);
  }
  const note = options.note.trim();
  if (!note) {
    throw new Error("Reconstruction raw scope requires a decision note");
  }
  const path = reconstructionCasePath(target, "active", options.id);
  const document = parseWorkSpec(await readFile(path, "utf8"));
  const version = Number(document.metadata.reconstruction_version);
  if (
    ![
      LEGACY_RECONSTRUCTION_VERSION,
      RAW_SCOPE_RECONSTRUCTION_VERSION,
      RECONSTRUCTION_VERSION,
    ].includes(version)
  ) {
    throw new Error(
      `Raw scope decisions require reconstruction version ${LEGACY_RECONSTRUCTION_VERSION}, ${RAW_SCOPE_RECONSTRUCTION_VERSION}, or ${RECONSTRUCTION_VERSION}`,
    );
  }
  const supplemental = recordValue(document.metadata.supplemental_inputs) ?? {};
  const raw = recordValue(supplemental.raw) ?? {};
  const baseline = stringValue(raw.baseline);
  if (!/^[0-9a-f]{40,64}$/i.test(baseline)) {
    throw new Error("Reconstruction raw scope requires a pinned raw baseline");
  }
  if (
    stringArray(raw.case_ids).length > 0
    || stringArray(raw.candidate_ids).length > 0
    || raw.status === "reviewed"
  ) {
    throw new Error(
      "Raw scope cannot change after reconstruction-linked intake has started; start a new reconstruction with the revised scope",
    );
  }
  const childCases = await reconstructionIntakeChildren(target, options.id);
  if (childCases.length > 0) {
    throw new Error(
      `Raw scope cannot change after reconstruction-linked intake has started: ${childCases.join(", ")}`,
    );
  }

  const entireSnapshot = await inventoryRaw({ target, baseline });
  let paths: string[];
  let scopedInventory = entireSnapshot;
  if (options.mode === "all") {
    if (entireSnapshot.entries.length === 0) {
      throw new Error("The frozen raw snapshot is empty; use unavailable instead of all");
    }
    paths = ["raw"];
  } else if (options.mode === "selected") {
    paths = normalizeRawPathspecs(options.paths ?? []);
    if (paths.includes("raw")) {
      throw new Error("Selected raw scope cannot contain raw/ itself; use all instead");
    }
    scopedInventory = await inventoryRaw({ target, baseline, paths });
    if (scopedInventory.entries.length === 0) {
      throw new Error("Selected raw scope contains no files at the frozen baseline");
    }
  } else {
    if ((options.paths ?? []).length > 0) {
      throw new Error(`${options.mode} raw scope does not accept --path`);
    }
    paths = [];
    if (
      options.mode === "unavailable"
      && (
        entireSnapshot.entries.length > 0
        || entireSnapshot.uncommitted.length > 0
        || await containsFiles(join(target, "raw"))
      )
    ) {
      throw new Error("Raw input exists and cannot be marked unavailable");
    }
  }

  const decidedBy = options.mode === "unavailable"
    ? options.approvedBy?.trim() || "system:wfctl"
    : options.approvedBy?.trim() || "";
  if (
    options.mode !== "unavailable"
    && !decidedBy.startsWith("human:")
  ) {
    throw new Error(
      `${options.mode} raw scope requires --by human:<maintainer-id>`,
    );
  }
  if (
    options.mode === "unavailable"
    && decidedBy !== "system:wfctl"
    && !decidedBy.startsWith("human:")
  ) {
    throw new Error("Unavailable raw scope must be recorded by system:wfctl or a human actor");
  }

  const now = options.now ?? new Date();
  const approvedAt = now.toISOString();
  supplemental.raw = {
    ...raw,
    status: options.mode === "excluded"
      ? "not-relevant"
      : options.mode === "unavailable"
      ? "not-available"
      : "pending",
    baseline,
    scope: {
      mode: options.mode,
      paths,
      decided_by: decidedBy,
      decided_at: approvedAt,
      note,
    },
    case_ids: [],
    candidate_ids: [],
    notes: [note],
  };
  if (version === LEGACY_RECONSTRUCTION_VERSION) {
    document.metadata.reconstruction_version = RAW_SCOPE_RECONSTRUCTION_VERSION;
  }
  document.metadata.supplemental_inputs = supplemental;
  document.metadata.updated_at = approvedAt;
  await writeFile(path, serializeWorkSpec(document), "utf8");

  return {
    id: options.id,
    mode: options.mode,
    paths,
    approvedBy: decidedBy,
    approvedAt,
    rawFiles: scopedInventory.entries.length,
    status: stringValue(recordValue(supplemental.raw)?.status),
  };
}

export async function updateReconstructionCheckpoint(
  options: UpdateReconstructionCheckpointOptions,
): Promise<KnowledgeSessionCheckpointSummary> {
  const target = await requireKnowledgeRepository(options.target);
  const casePath = reconstructionCasePath(target, "active", options.id);
  const document = parseWorkSpec(await readFile(casePath, "utf8"));
  if (Number(document.metadata.session_record_version) !== RECONSTRUCTION_SESSION_VERSION) {
    throw new Error(
      "This legacy reconstruction has no resumable session contract; preserve it as-is or restart it with the current workflow.",
    );
  }
  const session = await reconstructionSessionState(target, options.id, document);
  const checkpointInput: KnowledgeSessionCheckpointInput = {
    status: options.status,
    stage: options.stage,
    actor: options.actor,
    currentState: options.currentState,
    lastCompleted: options.lastCompleted,
    nextAction: options.nextAction,
    blockers: options.blockers ?? [],
    ...(options.now ? { now: options.now } : {}),
  };
  writeSessionCheckpoint(document, checkpointInput, session.basis);
  await writeFile(casePath, serializeWorkSpec(document), "utf8");
  const summary = inspectSessionCheckpoint(
    document,
    sessionBasis(document, session.related),
    RECONSTRUCTION_CHECKPOINT_STAGES,
    true,
  );
  if (!summary) {
    throw new Error("Failed to persist reconstruction checkpoint");
  }
  return summary;
}

export async function inspectReconstructionCoverage(
  targetInput: string,
  id: string,
  repository?: string,
): Promise<ReconstructionCoverageInspection> {
  const contexts = await coverageContexts(targetInput, id, repository);
  return {
    id,
    repositories: contexts.map(({ ledger }) =>
      summarizeReconstructionCoverage(ledger)
    ),
  };
}

export async function markReconstructionFiles(
  options: MarkReconstructionFilesOptions,
): Promise<{ repository: string; matched: number; summary: CoverageSummary }> {
  if (
    options.category !== undefined
    && !FILE_CATEGORIES.includes(options.category)
  ) {
    throw new Error(`Unknown file category: ${options.category}`);
  }
  if (
    options.status !== undefined
    && !COVERAGE_STATES.includes(options.status)
  ) {
    throw new Error(`Unknown file coverage status: ${options.status}`);
  }
  return await withLockedCoverageContext(
    options.target,
    options.id,
    options.repository,
    async (context) => {
      const matched = markCoverageFiles(context.ledger, options.paths, {
        ...(options.category === undefined ? {} : { category: options.category }),
        ...(options.status === undefined ? {} : { status: options.status }),
        ...(options.reason === undefined ? {} : { reason: options.reason }),
      });
      await writeReconstructionCoverage(context.coveragePath, context.ledger);
      return {
        repository: context.repositoryId,
        matched,
        summary: summarizeReconstructionCoverage(context.ledger),
      };
    },
  );
}

export async function readReconstructionSource(
  options: ReadReconstructionSourceOptions,
): Promise<ReadPinnedSourceResult> {
  return await withLockedCoverageContext(
    options.target,
    options.id,
    options.repository,
    async (context) => {
      const result = await readPinnedSource(context.ledger, context.root, options.path, {
        ...(options.startLine === undefined ? {} : { startLine: options.startLine }),
        ...(options.endLine === undefined ? {} : { endLine: options.endLine }),
        ...(options.actor === undefined ? {} : { actor: options.actor }),
        ...(options.now === undefined ? {} : { now: options.now }),
      });
      await writeReconstructionCoverage(context.coveragePath, context.ledger);
      return result;
    },
  );
}

export async function markReconstructionCommunity(
  options: MarkReconstructionCommunityOptions,
): Promise<{ repository: string; summary: CoverageSummary }> {
  if (!COVERAGE_STATES.includes(options.status)) {
    throw new Error(`Unknown community coverage status: ${options.status}`);
  }
  return await withLockedCoverageContext(
    options.target,
    options.id,
    options.repository,
    async (context) => {
      markCoverageCommunity(
        context.ledger,
        options.community,
        options.status,
        options.note,
        options.queries ?? [],
      );
      await writeReconstructionCoverage(context.coveragePath, context.ledger);
      return {
        repository: context.repositoryId,
        summary: summarizeReconstructionCoverage(context.ledger),
      };
    },
  );
}

export async function recordReconstructionSurface(
  options: RecordReconstructionSurfaceOptions,
): Promise<{ repository: string; summary: CoverageSummary }> {
  if (!SURFACE_KINDS.includes(options.kind)) {
    throw new Error(`Unknown reconstruction surface kind: ${options.kind}`);
  }
  if (!COVERAGE_STATES.includes(options.status)) {
    throw new Error(`Unknown surface coverage status: ${options.status}`);
  }
  return await withLockedCoverageContext(
    options.target,
    options.id,
    options.repository,
    async (context) => {
      recordCoverageSurface(context.ledger, {
        id: options.surface,
        kind: options.kind,
        description: options.description,
        paths: options.paths,
        status: options.status,
        note: options.note,
        candidateIds: options.candidateIds ?? [],
      });
      await writeReconstructionCoverage(context.coveragePath, context.ledger);
      return {
        repository: context.repositoryId,
        summary: summarizeReconstructionCoverage(context.ledger),
      };
    },
  );
}

export async function reviewReconstructionSurfaces(
  options: ReviewReconstructionSurfacesOptions,
): Promise<{ repository: string; summary: CoverageSummary }> {
  return await withLockedCoverageContext(
    options.target,
    options.id,
    options.repository,
    async (context) => {
      markSurfaceAudit(context.ledger, options.status, options.note);
      await writeReconstructionCoverage(context.coveragePath, context.ledger);
      return {
        repository: context.repositoryId,
        summary: summarizeReconstructionCoverage(context.ledger),
      };
    },
  );
}

export async function inspectProjectReconstruction(
  targetInput: string,
  id: string,
): Promise<ReconstructionInspection> {
  const receipt = await inspectProjectReconstructionReceipt(
    targetInput,
    id,
    "active",
  );
  const target = await requireKnowledgeRepository(targetInput);
  const document = parseWorkSpec(await readFile(receipt.path, "utf8"));
  const issues = [...receipt.issues];
  const promotion = recordValue(document.metadata.promotion);
  if (promotion?.status === "applied" && stringArray(promotion.concepts).length > 0) {
    const { validateKnowledge } = await import("./knowledge.js");
    const validation = await validateKnowledge(target, stringArray(promotion.concepts));
    issues.push(...validation.errors.map((issue) => `${issue.path}: ${issue.message}`));
  }
  try {
    const claims = await compileClaimLedger(target);
    const claimPrefix = `reconstruction:${id}#`;
    issues.push(
      ...claims.errors
        .filter((issue) =>
          issue.origin === "reconstruction" && issue.caseId === id
          || issue.claimIds?.some((claimId) => claimId.startsWith(claimPrefix))
        )
        .map((issue) => issue.message),
    );
  } catch (error) {
    issues.push(`claim ledger: ${errorMessage(error)}`);
  }

  return {
    ...receipt,
    issues: [...new Set(issues)],
  };
}

export async function inspectProjectReconstructionReceipt(
  targetInput: string,
  id: string,
  lifecycle: "active" | "archive" = "active",
  allowPendingPromotionValidation = false,
): Promise<ReconstructionInspection> {
  const target = await requireKnowledgeRepository(targetInput);
  const path = reconstructionCasePath(target, lifecycle, id);
  const document = parseWorkSpec(await readFile(path, "utf8"));
  const issues = reconstructionMetadataIssues(
    document.metadata,
    lifecycle,
    allowPendingPromotionValidation,
  );
  if (
    document.metadata.session_record_version !== undefined
    && document.metadata.session_record_version !== RECONSTRUCTION_SESSION_VERSION
  ) {
    issues.push(`session_record_version must be ${RECONSTRUCTION_SESSION_VERSION}`);
  }
  if (document.metadata.session_record_version === RECONSTRUCTION_SESSION_VERSION) {
    issues.push(...discoveryLedgerIssues(document.body, "case.md", true));
  }
  issues.push(
    ...await supplementalInputIssues(target, document.metadata, lifecycle),
  );
  const repositories = recordArray(document.metadata.repositories);
  const candidates = recordArray(document.metadata.candidate_claims);
  const binding = lifecycle === "active"
    ? await readBinding(target, id, issues)
    : undefined;
  const inspectedTexts = [await readFile(path, "utf8")];
  const linkedCandidateIds = new Set<string>();
  const coverageByRepository = new Map<string, ReconstructionCoverageLedger>();

  if (binding) {
    if (binding.caseId !== id || binding.knowledgeRoot !== target) {
      issues.push("local reconstruction binding does not match this knowledge checkout");
    }
    const byRepository = new Map(
      binding.repositories.map((entry) => [entry.repository, entry]),
    );
    for (const repository of repositories) {
      const repositoryId = stringValue(repository.repository);
      const local = byRepository.get(repositoryId);
      if (!local) {
        issues.push(`${repositoryId}: local checkout binding is missing`);
        continue;
      }
      try {
        const current = readRepositoryMetadata(local.root);
        if (
          current.repository !== repositoryId
          || current.commit !== stringValue(repository.commit)
          || current.commit !== local.commit
          || current.worktreeId !== stringValue(repository.worktree_id)
          || current.worktreeId !== local.worktreeId
        ) {
          issues.push(`${repositoryId}: checkout, worktree, or revision binding drifted`);
        }
        if (current.dirty) {
          issues.push(`${repositoryId}: bound checkout has uncommitted changes`);
        }
        const graph = await graphSummary(local.root);
        if (graph.nodes === 0) {
          issues.push(`${repositoryId}: Graphify graph contains no nodes`);
        }
        if (
          graph.contentHash
          !== stringValue(recordValue(repository.graphify)?.content_hash)
        ) {
          issues.push(`${repositoryId}: Graphify graph changed after the case was bound`);
        }
        const coveragePath = resolveCaseJson(
          dirname(path),
          stringValue(repository.coverage),
        );
        const coverage = await readReconstructionCoverage(coveragePath);
        coverageByRepository.set(repositoryId, coverage);
        inspectedTexts.push(JSON.stringify(coverage));
        issues.push(
          ...(await validateReconstructionCoverage(
            coverage,
            local.root,
            repositoryId,
            stringValue(repository.commit),
            join(local.root, "graphify-out/graph.json"),
          )).map((issue) => `${repositoryId}: ${issue}`),
        );
      } catch (error) {
        issues.push(`${repositoryId}: ${errorMessage(error)}`);
      }
    }
    for (const local of binding.repositories) {
      if (!repositories.some((entry) => entry.repository === local.repository)) {
        issues.push(`${local.repository}: local binding is outside the durable case scope`);
      }
    }
  }

  if (!binding) {
    for (const repository of repositories) {
      const repositoryId = stringValue(repository.repository);
      try {
        const coverage = await readReconstructionCoverage(
          resolveCaseJson(dirname(path), stringValue(repository.coverage)),
        );
        coverageByRepository.set(repositoryId, coverage);
        inspectedTexts.push(JSON.stringify(coverage));
        issues.push(
          ...validateReconstructionCoverageReceipt(
            coverage,
            repositoryId,
            stringValue(repository.commit),
          ).map((issue) => `${repositoryId}: ${issue}`),
        );
      } catch (error) {
        issues.push(
          `${repositoryId}: cannot inspect coverage receipt: ${errorMessage(error)}`,
        );
      }
    }
  }

  for (const repository of repositories) {
    const dossierRelative = stringValue(repository.dossier);
    try {
      const dossierPath = resolveCaseFile(dirname(path), dossierRelative);
      const dossierText = await readFile(dossierPath, "utf8");
      inspectedTexts.push(dossierText);
      const dossier = parseWorkSpec(dossierText);
      issues.push(...dossierIssues(repository, dossier.metadata, dossier.body));
      for (const candidateId of stringArray(dossier.metadata.candidate_ids)) {
        linkedCandidateIds.add(candidateId);
      }
    } catch (error) {
      issues.push(
        `${stringValue(repository.repository)}: cannot inspect dossier: ${errorMessage(error)}`,
      );
    }
  }

  if (Number(document.metadata.reconstruction_version) === RECONSTRUCTION_VERSION) {
    try {
      const workstreams = await readReconstructionWorkstreams(
        dirname(path),
        document.metadata,
      );
      const workstreamIds = new Set(
        workstreams
          .map((entry) => stringValue(entry.document.metadata.id))
          .filter(Boolean),
      );
      const repositoryIds = new Set(
        repositories.map((entry) => stringValue(entry.repository)).filter(Boolean),
      );
      const scopeIndex = new Map(
        [...coverageByRepository.entries()].map(([repositoryId, coverage]) => [
          repositoryId,
          {
            files: new Set(coverage.manifest.files.map((file) => file.path)),
            communities: new Set(coverage.graphify.communities.map((community) => community.id)),
            surfaces: new Set(coverage.surfaces.map((surface) => surface.id)),
          },
        ]),
      );
      const rawCaseIds = new Set(
        stringArray(
          recordValue(recordValue(document.metadata.supplemental_inputs)?.raw)?.case_ids,
        ),
      );
      const orchestration = recordValue(document.metadata.orchestration);
      const budget = recordValue(orchestration?.budget);
      const maxRetries = Number.isInteger(budget?.max_retries_per_workstream)
        ? Number(budget?.max_retries_per_workstream)
        : 0;
      const receiptIndex = new Map<string, ReconstructionReceiptIndexEntry>();
      for (const [repositoryId, coverage] of coverageByRepository) {
        for (const file of coverage.manifest.files) {
          for (const receipt of file.receipts) {
            if (receiptIndex.has(receipt.id)) {
              issues.push(`source read receipt ID is duplicated: ${receipt.id}`);
            } else {
              receiptIndex.set(receipt.id, {
                repository: repositoryId,
                path: file.path,
                actor: receipt.actor,
              });
            }
          }
        }
      }
      for (const workstream of workstreams) {
        inspectedTexts.push(workstream.content.toString("utf8"));
        issues.push(
          ...reconstructionWorkstreamIssues(
            workstream,
            id,
            repositoryIds,
            workstreamIds,
            maxRetries,
            scopeIndex,
            rawCaseIds,
            receiptIndex,
          ),
        );
      }
      issues.push(
        ...reconstructionWorkstreamSetIssues(workstreams, document.metadata),
      );
    } catch (error) {
      issues.push(`cannot inspect reconstruction workstreams: ${errorMessage(error)}`);
    }
  }

  const supplemental = recordValue(document.metadata.supplemental_inputs);
  for (const input of ["raw", "documentation", "change_records"]) {
    for (const candidateId of stringArray(recordValue(supplemental?.[input])?.candidate_ids)) {
      linkedCandidateIds.add(candidateId);
    }
  }
  for (const coverage of coverageByRepository.values()) {
    for (const surface of coverage.surfaces) {
      for (const candidateId of surface.candidateIds) {
        linkedCandidateIds.add(candidateId);
      }
    }
  }
  const candidateIds = new Set(
    candidates.map((candidate) => stringValue(candidate.id)).filter(Boolean),
  );
  for (const candidateId of candidateIds) {
    if (!linkedCandidateIds.has(candidateId)) {
      issues.push(
        `candidate ${candidateId} is not linked from a dossier, surface, or supplemental input`,
      );
    }
  }
  for (const candidateId of linkedCandidateIds) {
    if (!candidateIds.has(candidateId)) {
      issues.push(`source coverage references undefined candidate ${candidateId}`);
    }
  }

  for (const candidate of candidates) {
    for (const evidence of recordArray(candidate.evidence)) {
      if (evidence.kind !== "source-code") {
        continue;
      }
      const resource = stringValue(evidence.resource);
      const matching = [...coverageByRepository.entries()].filter(
        ([repositoryId, coverage]) =>
          evidencePathFromResource(
            resource,
            repositoryId,
            coverage.commit,
            coverage.manifest.files.map((file) => file.path),
          ) !== undefined,
      );
      if (matching.length !== 1) {
        issues.push(
          `candidate ${stringValue(candidate.id)} source evidence is outside the inspected reconstruction manifests: ${resource}`,
        );
        continue;
      }
      const [repositoryId, coverage] = matching[0]!;
      const evidencePath = evidencePathFromResource(
        resource,
        repositoryId,
        coverage.commit,
        coverage.manifest.files.map((file) => file.path),
      )!;
      const file = coverage.manifest.files.find(
        (entry) => entry.path === evidencePath,
      );
      if (file?.status !== "inspected") {
        issues.push(
          `candidate ${stringValue(candidate.id)} source evidence lacks a complete read receipt: ${repositoryId}#${evidencePath}`,
        );
      }
    }
  }

  for (const text of inspectedTexts) {
    if (containsLocalAbsolutePath(text)) {
      issues.push("durable reconstruction records must not contain local absolute paths");
      break;
    }
    if (binding?.repositories.some((entry) => text.includes(entry.root))) {
      issues.push("durable reconstruction records leak a bound checkout path");
      break;
    }
  }

  return {
    id,
    path,
    repositories: repositories.length,
    reviewed: repositories.filter((repository) => {
      const dossier = stringValue(repository.dossier);
      return dossier && !issues.some((issue) =>
        issue.startsWith(`${stringValue(repository.repository)}:`)
      );
    }).length,
    candidates: candidates.length,
    issues: [...new Set(issues)],
  };
}

export async function closeProjectReconstruction(
  options: CloseReconstructionOptions,
): Promise<CloseReconstructionResult> {
  const target = await requireKnowledgeRepository(options.target);
  const path = reconstructionCasePath(target, "active", options.id);
  const directory = dirname(path);
  const document = parseWorkSpec(await readFile(path, "utf8"));

  if (options.outcome === "completed") {
    const inspected = await inspectProjectReconstruction(target, options.id);
    if (inspected.issues.length > 0) {
      throw new Error(
        `Completed reconstruction is blocked: ${inspected.issues.join("; ")}`,
      );
    }
  }

  const now = options.now ?? new Date();
  const archivePath = join(target, "reconstruction/archive", options.id);
  await assertPathAbsent(archivePath, "reconstruction archive");
  document.metadata.status = options.outcome;
  document.metadata.outcome = options.outcome;
  document.metadata.closed_at = now.toISOString();
  document.metadata.updated_at = now.toISOString();
  if (document.metadata.session_record_version === RECONSTRUCTION_SESSION_VERSION) {
    const session = await reconstructionSessionState(target, options.id, document);
    writeSessionCheckpoint(document, {
      status: "complete",
      stage: "review",
      actor: "system:wfctl",
      currentState: `Reconstruction archived with outcome ${options.outcome}.`,
      lastCompleted: "The reconstruction close gate recorded its honest outcome.",
      nextAction: "No active reconstruction continuation remains; use the archive as an audit trail.",
      blockers: [],
      now,
    }, session.basis);
  }
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(directory, archivePath);
  try {
    await writeFile(
      join(archivePath, "case.md"),
      serializeWorkSpec(document),
      "utf8",
    );
  } catch (error) {
    await rename(archivePath, directory);
    throw error;
  }
  try {
    await unlink(reconstructionBindingPath(target, options.id));
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
  return { id: options.id, outcome: options.outcome, archivePath };
}

function reconstructionMetadataIssues(
  metadata: Record<string, unknown>,
  lifecycle: "active" | "archive",
  allowPendingPromotionValidation: boolean,
): string[] {
  const issues: string[] = [];
  const mode = stringValue(metadata.mode);
  const repositories = recordArray(metadata.repositories);
  const candidates = recordArray(metadata.candidate_claims);
  const promotion = recordValue(metadata.promotion);
  const coverage = recordValue(metadata.coverage_audit);
  const reconciliation = recordValue(metadata.reconciliation_audit);
  const crossRepository = recordValue(metadata.cross_repository_analysis);
  const maintainerReview = recordValue(metadata.maintainer_review);

  const reconstructionVersion = Number(metadata.reconstruction_version);
  if (reconstructionVersion === LEGACY_RECONSTRUCTION_VERSION) {
    issues.push(
      `reconstruction_version ${LEGACY_RECONSTRUCTION_VERSION} has no maintainer-approved raw scope; record it with wfctl knowledge reconstruct raw-scope`,
    );
  } else if (
    reconstructionVersion !== RAW_SCOPE_RECONSTRUCTION_VERSION
    && reconstructionVersion !== RECONSTRUCTION_VERSION
  ) {
    issues.push(
      `reconstruction_version must be ${RAW_SCOPE_RECONSTRUCTION_VERSION} or ${RECONSTRUCTION_VERSION}`,
    );
  }
  if (!stringValue(metadata.title).trim()) {
    issues.push("title is required");
  }
  if (lifecycle === "active" && metadata.status !== "active") {
    issues.push("status must remain active until wfctl archives the reconstruction");
  }
  if (
    lifecycle === "archive"
    && (
      metadata.status !== "completed"
      || metadata.outcome !== "completed"
      || !isIsoDateTime(stringValue(metadata.closed_at))
    )
  ) {
    issues.push("archived reconstruction receipt must be completed with a close time");
  }
  if (mode !== "baseline" && mode !== "audit") {
    issues.push("mode must be baseline or audit");
  }
  if (repositories.length === 0) {
    issues.push("repositories must contain at least one leaf baseline");
  }
  const seenRepositories = new Set<string>();
  for (const [index, repository] of repositories.entries()) {
    const prefix = `repositories[${index}]`;
    const id = stringValue(repository.repository);
    if (!id) {
      issues.push(`${prefix}.repository is required`);
    } else if (seenRepositories.has(id)) {
      issues.push(`${prefix}.repository is duplicated: ${id}`);
    } else {
      seenRepositories.add(id);
    }
    if (!/^[0-9a-f]{40}$/i.test(stringValue(repository.commit))) {
      issues.push(`${prefix}.commit must pin a full Git commit`);
    }
    if (!stringValue(repository.worktree_id)) {
      issues.push(`${prefix}.worktree_id is required`);
    }
    if (!isCaseRelativeMarkdown(stringValue(repository.dossier))) {
      issues.push(`${prefix}.dossier must be a case-relative Markdown path`);
    }
    if (!isCaseRelativeJson(stringValue(repository.coverage))) {
      issues.push(`${prefix}.coverage must be a case-relative JSON path`);
    }
    const graphify = recordValue(repository.graphify);
    if (
      graphify?.status !== "ready"
      || typeof graphify.nodes !== "number"
      || graphify.nodes < 1
      || !/^[0-9a-f]{64}$/i.test(stringValue(graphify.content_hash))
    ) {
      issues.push(`${prefix}.graphify must record a non-empty ready graph and content hash`);
    }
  }

  const supplemental = recordValue(metadata.supplemental_inputs);
  for (const input of ["raw", "documentation", "change_records"]) {
    const entry = recordValue(supplemental?.[input]);
    const status = stringValue(entry?.status);
    if (!FINAL_REVIEW_STATES.has(status)) {
      issues.push(`supplemental_inputs.${input}.status must be reviewed, not-available, or not-relevant`);
    }
    if (status !== "reviewed" && !nonEmptyStringArray(entry?.notes)) {
      issues.push(`supplemental_inputs.${input}.notes must explain ${status || "its final state"}`);
    }
  }
  const rawInput = recordValue(supplemental?.raw);
  if (!/^[0-9a-f]{40,64}$/i.test(stringValue(rawInput?.baseline))) {
    issues.push("supplemental_inputs.raw.baseline must pin the reconstruction-start Git snapshot");
  }
  if (
    reconstructionVersion === RAW_SCOPE_RECONSTRUCTION_VERSION
    || reconstructionVersion === RECONSTRUCTION_VERSION
  ) {
    issues.push(...reconstructionRawScopeIssues(rawInput));
  }
  if (reconstructionVersion === RECONSTRUCTION_VERSION) {
    issues.push(...reconstructionOrchestrationIssues(metadata));
  }
  if (
    rawInput?.status === "reviewed"
    && !nonEmptyStringArray(rawInput.case_ids)
  ) {
    issues.push("supplemental_inputs.raw.case_ids must list completed raw-intake cases");
  }

  if (
    repositories.length > 1
    && crossRepository?.status !== "reviewed"
  ) {
    issues.push("cross_repository_analysis.status must be reviewed for multiple leaves");
  }
  if (
    repositories.length === 1
    && !["reviewed", "not-relevant"].includes(stringValue(crossRepository?.status))
  ) {
    issues.push("cross_repository_analysis.status must be reviewed or not-relevant");
  }
  if (!nonEmptyStringArray(crossRepository?.notes)) {
    issues.push("cross_repository_analysis.notes must record boundary findings");
  }

  if (candidates.length === 0) {
    issues.push("candidate_claims must contain the reconstructed project claims");
  }
  const seenCandidates = new Set<string>();
  const confirmedPromotions = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    const prefix = `candidate_claims[${index}]`;
    const id = stringValue(candidate.id);
    const claimClass = stringValue(candidate.claim_class);
    const disposition = stringValue(candidate.disposition);
    const evidence = recordArray(candidate.evidence);
    const normativeClaim = [
      "product-intent",
      "product-meaning",
      "architecture",
      "ownership",
      "contract",
    ].includes(claimClass);
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
    if (!CLAIM_CLASSES.has(claimClass)) {
      issues.push(`${prefix}.claim_class is unknown: ${claimClass}`);
    }
    if (!INTENT_STATES.has(stringValue(candidate.intent_state))) {
      issues.push(`${prefix}.intent_state is invalid`);
    }
    if (!DELIVERY_STATES.has(stringValue(candidate.delivery_state))) {
      issues.push(`${prefix}.delivery_state is invalid`);
    }
    if (!ALIGNMENT_STATES.has(stringValue(candidate.alignment))) {
      issues.push(`${prefix}.alignment is invalid`);
    }
    if (!CANDIDATE_DISPOSITIONS.has(disposition)) {
      issues.push(`${prefix}.disposition is invalid`);
    } else if (disposition === "unresolved") {
      issues.push(`${prefix}.disposition remains unresolved`);
    }
    if (
      ["rejected", "deferred", "unresolved"].includes(disposition)
      && !stringValue(candidate.reason).trim()
    ) {
      issues.push(`${prefix}.reason must explain ${disposition || "the disposition"}`);
    }
    if (stringValue(candidate.intent_state) === "proposed" && disposition === "confirmed") {
      issues.push(`${prefix}: proposed intent cannot be confirmed as current knowledge`);
    }
    if (disposition === "confirmed" && evidence.length === 0 && !normativeClaim) {
      issues.push(`${prefix}.evidence is required for a confirmed claim`);
    }
    const evidenceKinds = new Set<string>();
    for (const [evidenceIndex, item] of evidence.entries()) {
      const itemPrefix = `${prefix}.evidence[${evidenceIndex}]`;
      const kind = stringValue(item.kind);
      const resource = stringValue(item.resource);
      evidenceKinds.add(kind);
      if (!["source-code", "runtime-check", "version-control", "external-primary"].includes(kind)) {
        issues.push(`${itemPrefix}.kind is not an independent evidence class`);
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
      if (
        kind === "runtime-check"
        && !/^project-change:[a-z0-9][a-z0-9-]{0,95}#[A-Za-z0-9_./-]+$/.test(resource)
      ) {
        issues.push(`${itemPrefix}.resource must identify a project-change receipt`);
      }
      if (containsUntrustedResource(resource)) {
        issues.push(`${itemPrefix}.resource must not cite raw or intake material`);
      }
    }
    if (disposition === "confirmed" && claimClass === "implementation" && !evidenceKinds.has("source-code")) {
      issues.push(`${prefix}: confirmed implementation requires pinned source-code evidence`);
    }
    if (disposition === "confirmed" && claimClass === "history" && !evidenceKinds.has("version-control")) {
      issues.push(`${prefix}: confirmed history requires pinned version-control evidence`);
    }
    if (
      disposition === "confirmed"
      && normativeClaim
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
    if (disposition === "confirmed") {
      const routing = recordValue(candidate.routing);
      const promotedTo = stringArray(routing?.destinations).length > 0
        ? stringArray(routing?.destinations)
        : stringArray(candidate.promoted_to);
      if (promotedTo.length === 0) {
        issues.push(`${prefix}.routing.destinations must identify the curated concepts`);
      }
      if (
        routing
        && !["current-knowledge", "history"].includes(stringValue(routing.lane))
      ) {
        issues.push(`${prefix}.routing.lane must be current-knowledge or history when confirmed`);
      }
      for (const concept of promotedTo) {
        if (!isKnowledgeConceptPath(concept)) {
          issues.push(`${prefix}.promoted_to contains an invalid concept path: ${concept}`);
        } else {
          confirmedPromotions.add(concept);
        }
      }
    }
  }

  const promotedConcepts = new Set(stringArray(promotion?.concepts));
  if (mode === "baseline" && promotion?.status !== "applied") {
    issues.push("baseline reconstruction requires an applied knowledge promotion");
  } else if (promotion?.status !== "applied" && promotion?.status !== "not-needed") {
    issues.push("promotion.status must be applied or not-needed");
  }
  if (promotion?.status === "applied" && !nonEmptyStringArray(promotion.concepts)) {
    issues.push("promotion.concepts must list promoted concept files");
  }
  if (
    promotion?.status === "applied"
    && stringArray(promotion.concepts).some((path) => /(?:^|\/)(?:index|log)\.md$/i.test(path))
  ) {
    issues.push("promotion.concepts must list concept files, not index.md or log.md");
  }
  if (
    promotion?.status === "applied"
    && promotion.validation !== "passed"
    && !allowPendingPromotionValidation
  ) {
    issues.push("promotion.validation must be passed");
  }
  if (
    promotion?.status === "not-needed"
    && (!stringValue(promotion.reason).trim() || promotion.validation !== "not-needed")
  ) {
    issues.push("not-needed promotion requires a reason and validation: not-needed");
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
  if (coverage?.result !== "passed" || !nonEmptyStringArray(coverage.notes)) {
    issues.push("coverage_audit must pass with notes");
  }
  if (reconciliation?.result !== "passed" || !nonEmptyStringArray(reconciliation.notes)) {
    issues.push("reconciliation_audit must pass with notes");
  }
  if (
    maintainerReview?.status !== "approved"
    || !stringValue(maintainerReview.by).startsWith("human:")
    || !isIsoDateTime(stringValue(maintainerReview.at))
  ) {
    issues.push("maintainer_review must record explicit human approval");
  }

  return issues;
}

function reconstructionRawScopeIssues(
  raw: Record<string, unknown> | undefined,
): string[] {
  const issues: string[] = [];
  const scope = recordValue(raw?.scope);
  const mode = stringValue(scope?.mode);
  const paths = stringArray(scope?.paths);
  const decidedBy = stringValue(scope?.decided_by);
  const decidedAt = stringValue(scope?.decided_at);
  const note = stringValue(scope?.note);

  if (!RAW_SCOPE_MODES.includes(mode as ReconstructionRawScopeMode)) {
    issues.push(
      "supplemental_inputs.raw.scope.mode requires a maintainer decision: all, selected, or excluded",
    );
    return issues;
  }
  if (!Array.isArray(scope?.paths)) {
    issues.push("supplemental_inputs.raw.scope.paths must be a list");
  } else {
    try {
      const normalized = paths.length > 0 ? normalizeRawPathspecs(paths) : [];
      if (JSON.stringify(normalized) !== JSON.stringify(paths)) {
        issues.push("supplemental_inputs.raw.scope.paths must be normalized and sorted");
      }
    } catch (error) {
      issues.push(`supplemental_inputs.raw.scope.paths: ${errorMessage(error)}`);
    }
  }
  if (mode === "all" && JSON.stringify(paths) !== JSON.stringify(["raw"])) {
    issues.push("supplemental_inputs.raw.scope.paths must be [raw] for all mode");
  }
  if (mode === "selected" && (paths.length === 0 || paths.includes("raw"))) {
    issues.push("supplemental_inputs.raw.scope.paths must select narrower raw paths");
  }
  if ((mode === "excluded" || mode === "unavailable") && paths.length > 0) {
    issues.push(`supplemental_inputs.raw.scope.paths must be empty for ${mode} mode`);
  }
  if (
    mode !== "unavailable"
    && !decidedBy.startsWith("human:")
  ) {
    issues.push("supplemental_inputs.raw.scope.decided_by must identify the approving human");
  }
  if (
    mode === "unavailable"
    && decidedBy !== "system:wfctl"
    && !decidedBy.startsWith("human:")
  ) {
    issues.push("unavailable raw scope must be recorded by system:wfctl or a human actor");
  }
  if (!isIsoDateTime(decidedAt)) {
    issues.push("supplemental_inputs.raw.scope.decided_at must be an ISO 8601 datetime");
  }
  if (!note.trim()) {
    issues.push("supplemental_inputs.raw.scope.note must explain the decision");
  }

  const status = stringValue(raw?.status);
  if (status === "reviewed" && mode !== "all" && mode !== "selected") {
    issues.push("reviewed raw input requires all or selected scope");
  }
  if (status === "not-relevant" && mode !== "excluded") {
    issues.push("not-relevant raw input requires excluded scope");
  }
  if (status === "not-available" && mode !== "unavailable") {
    issues.push("not-available raw input requires unavailable scope");
  }
  if (
    (mode === "excluded" || mode === "unavailable")
    && (
      stringArray(raw?.case_ids).length > 0
      || stringArray(raw?.candidate_ids).length > 0
    )
  ) {
    issues.push(`${mode} raw scope cannot link intake cases or candidates`);
  }
  return issues;
}

function dossierIssues(
  repository: Record<string, unknown>,
  metadata: Record<string, unknown>,
  body: string,
): string[] {
  const id = stringValue(repository.repository);
  const issues: string[] = [];
  if (metadata.reconstruction_repository_version !== 2) {
    issues.push(`${id}: reconstruction_repository_version must be 2`);
  }
  if (
    metadata.session_record_version !== undefined
    && metadata.session_record_version !== RECONSTRUCTION_SESSION_VERSION
  ) {
    issues.push(`${id}: session_record_version must be ${RECONSTRUCTION_SESSION_VERSION}`);
  }
  if (metadata.session_record_version === RECONSTRUCTION_SESSION_VERSION) {
    issues.push(...discoveryLedgerIssues(body, `${id}: dossier`, true));
  }
  if (metadata.status !== "reviewed") {
    issues.push(`${id}: dossier status must be reviewed`);
  }
  if (
    metadata.repository !== repository.repository
    || metadata.commit !== repository.commit
  ) {
    issues.push(`${id}: dossier repository or commit does not match the case`);
  }
  if (!nonEmptyStringArray(metadata.graphify_queries)) {
    issues.push(`${id}: dossier must record Graphify queries`);
  }
  if (!Array.isArray(metadata.candidate_ids)) {
    issues.push(`${id}: dossier candidate_ids must be a list`);
  }
  const coverage = recordValue(metadata.coverage);
  for (
    const dimension of [
      "purpose",
      "areas_capabilities",
      "entrypoints",
      "boundaries_contracts",
      "data_state_control_flow",
      "invariants_failure_modes",
      "tests_runtime",
      "unknowns",
    ]
  ) {
    if (!["reviewed", "not-relevant"].includes(stringValue(coverage?.[dimension]))) {
      issues.push(`${id}: dossier coverage.${dimension} must be reviewed or not-relevant`);
    }
  }
  const history = recordValue(metadata.history);
  if (!FINAL_REVIEW_STATES.has(stringValue(history?.status))) {
    issues.push(`${id}: dossier history.status must be reviewed, not-available, or not-relevant`);
  }
  if (
    history?.status !== "reviewed"
    && !nonEmptyStringArray(history?.notes)
  ) {
    issues.push(`${id}: dossier history.notes must explain its final state`);
  }
  if (/<[^>\n]+>/.test(body)) {
    issues.push(`${id}: dossier still contains template placeholders`);
  }
  return issues;
}

async function supplementalInputIssues(
  target: string,
  metadata: Record<string, unknown>,
  lifecycle: "active" | "archive",
): Promise<string[]> {
  const issues: string[] = [];
  const raw = recordValue(recordValue(metadata.supplemental_inputs)?.raw);
  const scope = recordValue(raw?.scope);
  const scopeMode = stringValue(scope?.mode);
  const baseline = stringValue(raw?.baseline);
  const inventoryPaths = scopeMode === "selected"
    ? stringArray(scope?.paths)
    : ["raw"];
  if (raw?.status === "not-available") {
    try {
      const inventory = await inventoryRaw({ target, baseline, paths: ["raw"] });
      if (inventory.entries.length > 0) {
        issues.push(
          "supplemental_inputs.raw is not-available but the frozen raw snapshot contains files",
        );
      }
    } catch (error) {
      issues.push(`cannot verify unavailable raw snapshot: ${errorMessage(error)}`);
    }
  }
  if (raw?.status === "reviewed") {
    const caseIds = new Set(stringArray(raw.case_ids));
    let allowedIdentities = new Set<string>();
    let inventory: Awaited<ReturnType<typeof inventoryRaw>> | undefined;
    try {
      inventory = await inventoryRaw({
        target,
        baseline,
        paths: inventoryPaths,
      });
      allowedIdentities = new Set(
        inventory.entries.map((entry) => `${entry.path}\0${entry.objectId}`),
      );
    } catch (error) {
      issues.push(`cannot verify frozen raw inventory: ${errorMessage(error)}`);
    }
    for (const id of stringArray(raw.case_ids)) {
      if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
        issues.push(`supplemental_inputs.raw.case_ids contains an invalid id: ${id}`);
        continue;
      }
      try {
        const intake = parseWorkSpec(
          await readFile(
            join(target, "intake/cases/archive", id, "case.md"),
            "utf8",
          ),
        );
        if (
          intake.metadata.status !== "completed"
          || intake.metadata.outcome !== "completed"
        ) {
          issues.push(`raw-intake case is not completed: ${id}`);
        }
        const intakeBaseline = recordValue(intake.metadata.baseline);
        if (stringValue(intakeBaseline?.commit) !== baseline) {
          issues.push(`raw-intake case uses a different baseline: ${id}`);
        }
        const intakeParent = recordValue(intake.metadata.parent_reconstruction);
        if (stringValue(intakeParent?.id) !== stringValue(metadata.id)) {
          issues.push(`raw-intake case is not bound to this reconstruction: ${id}`);
        }
        if (stringValue(intakeParent?.scope_mode) !== scopeMode) {
          issues.push(`raw-intake case uses a different approved scope mode: ${id}`);
        }
        const decidedAt = stringValue(scope?.decided_at);
        if (stringValue(intakeParent?.scope_decided_at) !== decidedAt) {
          issues.push(`raw-intake case is not bound to the current approved scope: ${id}`);
        }
        const createdAt = stringValue(intake.metadata.created_at);
        if (
          isIsoDateTime(decidedAt)
          && (
            !isIsoDateTime(createdAt)
            || Date.parse(createdAt) < Date.parse(decidedAt)
          )
        ) {
          issues.push(`raw-intake case predates the approved reconstruction scope: ${id}`);
        }
        for (const source of recordArray(intake.metadata.sources)) {
          const identity = `${stringValue(source.path)}\0${stringValue(source.object_id)}`;
          if (!allowedIdentities.has(identity)) {
            issues.push(`raw-intake case contains a source outside the approved scope: ${id}#${stringValue(source.path)}`);
          }
        }
      } catch (error) {
        issues.push(`cannot verify completed raw-intake case ${id}: ${errorMessage(error)}`);
      }
    }
    if (inventory) {
      const baselinePaths = new Set(inventory.entries.map((entry) => entry.path));
      const changedFrozenPaths = lifecycle === "active"
        ? inventory.uncommitted.filter((path) => baselinePaths.has(path))
        : [];
      if (changedFrozenPaths.length > 0) {
        issues.push(
          `frozen raw snapshot has uncommitted path changes: ${changedFrozenPaths.join(", ")}`,
        );
      }
      for (const entry of inventory.entries) {
        if (!["reviewed", "no-relevant-claims"].includes(entry.state)) {
          issues.push(
            `${entry.path}: frozen raw input remains ${entry.state}`,
          );
          continue;
        }
        if (
          !entry.cases.some((reference) =>
            caseIds.has(reference.id)
            && reference.lifecycle === "archive"
            && reference.outcome === "completed"
          )
        ) {
          issues.push(
            `${entry.path}: final raw review is not linked through supplemental_inputs.raw.case_ids`,
          );
        }
      }
    }
  }
  return issues;
}

async function reconstructionIntakeChildren(
  target: string,
  reconstructionId: string,
): Promise<string[]> {
  const children: string[] = [];
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
      const intake = parseWorkSpec(
        await readFile(join(root, entry.name, "case.md"), "utf8"),
      );
      if (
        stringValue(recordValue(intake.metadata.parent_reconstruction)?.id)
        === reconstructionId
      ) {
        children.push(entry.name);
      }
    }
  }
  return children.sort();
}

async function containsFiles(root: string): Promise<boolean> {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isFile() || entry.isSymbolicLink()) {
        return true;
      }
      if (entry.isDirectory() && await containsFiles(join(root, entry.name))) {
        return true;
      }
    }
    return false;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function normalizeLeafRoots(values: string[]): Promise<string[]> {
  const roots = [];
  const seen = new Set<string>();
  for (const value of values) {
    const root = await realpath(resolve(value));
    if (!seen.has(root)) {
      seen.add(root);
      roots.push(root);
    }
  }
  return roots;
}

async function graphSummary(
  root: string,
): Promise<{ nodes: number; contentHash: string }> {
  const path = join(root, "graphify-out/graph.json");
  try {
    const content = await readFile(path);
    const graph = JSON.parse(content.toString("utf8")) as { nodes?: unknown[] };
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      throw new Error("Graphify graph exists but contains no nodes");
    }
    return {
      nodes: graph.nodes.length,
      contentHash: createHash("sha256").update(content).digest("hex"),
    };
  } catch (error) {
    throw new Error(`Invalid Graphify graph in ${root}: ${errorMessage(error)}`);
  }
}

async function readBinding(
  target: string,
  id: string,
  issues: string[],
): Promise<LocalBinding | undefined> {
  try {
    const value = JSON.parse(
      await readFile(reconstructionBindingPath(target, id), "utf8"),
    ) as unknown;
    if (!isLocalBinding(value)) {
      issues.push("local reconstruction binding is invalid");
      return undefined;
    }
    return value;
  } catch (error) {
    issues.push(
      isMissingFileError(error)
        ? "local reconstruction binding is missing; reconnect the registered leaves and restart the case"
        : `cannot read local reconstruction binding: ${errorMessage(error)}`,
    );
    return undefined;
  }
}

async function reconstructionSessionState(
  target: string,
  id: string,
  document: ReturnType<typeof parseWorkSpec>,
): Promise<{
  basis: string;
  related: RelatedSessionContent[];
  dossiers: RelatedSessionContent[];
  workstreams: Array<{
    path: string;
    document: ReturnType<typeof parseWorkSpec>;
  }>;
  files: KnowledgeSessionFile[];
  coverage: CoverageSummary[];
}> {
  const caseDirectory = dirname(reconstructionCasePath(target, "active", id));
  const caseContent = serializeWorkSpec(document);
  const related: RelatedSessionContent[] = [];
  const dossiers: RelatedSessionContent[] = [];
  const workstreams: Array<{
    path: string;
    document: ReturnType<typeof parseWorkSpec>;
  }> = [];
  const files: KnowledgeSessionFile[] = [
    sessionFile(relative(target, join(caseDirectory, "case.md")), "case-full-read", caseContent),
  ];
  const coverage: CoverageSummary[] = [];
  for (const repository of recordArray(document.metadata.repositories)) {
    const dossierPath = resolveCaseFile(caseDirectory, stringValue(repository.dossier));
    const dossierContent = await readFile(dossierPath);
    const dossierRelative = relative(target, dossierPath);
    const dossier = { path: dossierRelative, content: dossierContent };
    dossiers.push(dossier);
    related.push(dossier);
    files.push(sessionFile(dossierRelative, "repository-dossier-full-read", dossierContent));

    const coveragePath = resolveCaseJson(caseDirectory, stringValue(repository.coverage));
    const coverageContent = await readFile(coveragePath);
    const coverageRelative = relative(target, coveragePath);
    related.push({ path: coverageRelative, content: coverageContent });
    files.push(sessionFile(
      coverageRelative,
      "machine-coverage-read-via-context-json",
      coverageContent,
    ));
    coverage.push(
      summarizeReconstructionCoverage(
        JSON.parse(coverageContent.toString("utf8")) as ReconstructionCoverageLedger,
      ),
    );
  }
  for (
    const workstream of await readReconstructionWorkstreams(
      caseDirectory,
      document.metadata,
    )
  ) {
    const workstreamRelative = relative(target, workstream.path);
    related.push({ path: workstreamRelative, content: workstream.content });
    files.push(sessionFile(
      workstreamRelative,
      "reconstruction-workstream-full-read",
      workstream.content,
    ));
    workstreams.push({
      path: workstreamRelative,
      document: workstream.document,
    });
  }
  const bindingPath = reconstructionBindingPath(target, id);
  try {
    const bindingContent = await readFile(bindingPath);
    files.push(sessionFile(
      relative(target, bindingPath),
      "local-checkout-binding-full-read",
      bindingContent,
    ));
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
  return {
    basis: sessionBasis(document, related),
    related,
    dossiers,
    workstreams,
    files,
    coverage,
  };
}

interface ReconstructionCoverageContext {
  repositoryId: string;
  root: string;
  commit: string;
  worktreeId: string;
  graphHash: string;
  coveragePath: string;
  ledger: ReconstructionCoverageLedger;
}

async function coverageContexts(
  targetInput: string,
  id: string,
  repository?: string,
): Promise<ReconstructionCoverageContext[]> {
  const target = await requireKnowledgeRepository(targetInput);
  const casePath = reconstructionCasePath(target, "active", id);
  const document = parseWorkSpec(await readFile(casePath, "utf8"));
  const bindingIssues: string[] = [];
  const binding = await readBinding(target, id, bindingIssues);
  if (!binding || bindingIssues.length > 0) {
    throw new Error(
      bindingIssues.join("; ") || "local reconstruction binding is missing",
    );
  }
  const durable = recordArray(document.metadata.repositories);
  const selected = repository
    ? durable.filter((entry) => entry.repository === repository)
    : durable;
  if (selected.length === 0) {
    throw new Error(
      `Reconstruction repository is not in case ${id}: ${repository ?? ""}`,
    );
  }
  const contexts: ReconstructionCoverageContext[] = [];
  for (const entry of selected) {
    const repositoryId = stringValue(entry.repository);
    const local = binding.repositories.find(
      (candidate) => candidate.repository === repositoryId,
    );
    if (!local) {
      throw new Error(`${repositoryId}: local checkout binding is missing`);
    }
    const coveragePath = resolveCaseJson(
      dirname(casePath),
      stringValue(entry.coverage),
    );
    contexts.push({
      repositoryId,
      root: local.root,
      commit: stringValue(entry.commit),
      worktreeId: local.worktreeId,
      graphHash: stringValue(recordValue(entry.graphify)?.content_hash),
      coveragePath,
      ledger: await readReconstructionCoverage(coveragePath),
    });
  }
  return contexts;
}

async function oneCoverageContext(
  target: string,
  id: string,
  repository?: string,
): Promise<ReconstructionCoverageContext> {
  const contexts = await coverageContexts(target, id, repository);
  if (contexts.length !== 1) {
    throw new Error(
      `Reconstruction ${id} contains ${contexts.length} repositories; specify --repository`,
    );
  }
  const context = contexts[0]!;
  await assertCoverageBindingCurrent(context);
  return context;
}

async function withLockedCoverageContext<T>(
  targetInput: string,
  id: string,
  repository: string | undefined,
  operation: (context: ReconstructionCoverageContext) => Promise<T>,
): Promise<T> {
  const target = await requireKnowledgeRepository(targetInput);
  const initial = await oneCoverageContext(target, id, repository);
  const lockId = createHash("sha256")
    .update(initial.coveragePath)
    .digest("hex")
    .slice(0, 20);
  const lockPath = join(
    target,
    ".workflow/current/locks",
    `reconstruction-coverage-${lockId}.lock`,
  );
  return await withFileLock(lockPath, async () => {
    const current = await oneCoverageContext(target, id, initial.repositoryId);
    return await operation(current);
  });
}

interface LockedReconstructionCase {
  target: string;
  casePath: string;
  caseDirectory: string;
  document: ReturnType<typeof parseWorkSpec>;
}

async function withLockedReconstructionCase<T>(
  targetInput: string,
  id: string,
  operation: (context: LockedReconstructionCase) => Promise<T>,
): Promise<T> {
  const target = await requireKnowledgeRepository(targetInput);
  const casePath = reconstructionCasePath(target, "active", id);
  const lockId = createHash("sha256").update(casePath).digest("hex").slice(0, 20);
  const lockPath = join(
    target,
    ".workflow/current/locks",
    `reconstruction-case-${lockId}.lock`,
  );
  return await withFileLock(lockPath, async () => {
    const document = parseWorkSpec(await readFile(casePath, "utf8"));
    return await operation({
      target,
      casePath,
      caseDirectory: dirname(casePath),
      document,
    });
  });
}

async function mutateReconstructionWorkstream(
  targetInput: string,
  id: string,
  workstream: string,
  now: Date | undefined,
  operation: (context: LockedReconstructionCase & {
    caseDocument: ReturnType<typeof parseWorkSpec>;
    record: ReconstructionWorkstreamRecord;
    document: ReturnType<typeof parseWorkSpec>;
    timestamp: string;
  }) => Promise<void>,
): Promise<ReconstructionWorkstreamMutationResult> {
  assertWorkstreamId(workstream);
  return await withLockedReconstructionCase(
    targetInput,
    id,
    async (context) => {
      const records = await readReconstructionWorkstreams(
        context.caseDirectory,
        context.document.metadata,
      );
      const record = records.find(
        (entry) => stringValue(entry.document.metadata.id) === workstream,
      );
      if (!record || !record.referenced) {
        throw new Error(`Referenced reconstruction workstream not found: ${workstream}`);
      }
      const timestamp = (now ?? new Date()).toISOString();
      await operation({
        ...context,
        caseDocument: context.document,
        record,
        document: record.document,
        timestamp,
      });
      await writeFile(record.path, serializeWorkSpec(record.document), "utf8");
      return {
        id,
        workstream,
        status: stringValue(record.document.metadata.status),
        path: relative(context.target, record.path),
      };
    },
  );
}

async function workstreamValidationContext(
  target: string,
  id: string,
  caseDirectory: string,
  document: ReturnType<typeof parseWorkSpec>,
): Promise<{
  repositoryIds: Set<string>;
  workstreamIds: Set<string>;
  maxRetries: number;
  scopeIndex: Map<string, ReconstructionScopeIndexEntry>;
  rawCaseIds: Set<string>;
  receiptIndex: Map<string, ReconstructionReceiptIndexEntry>;
}> {
  const repositories = recordArray(document.metadata.repositories);
  const repositoryIds = new Set(
    repositories.map((entry) => stringValue(entry.repository)).filter(Boolean),
  );
  const scopeIndex = new Map<string, ReconstructionScopeIndexEntry>();
  const receiptIndex = new Map<string, ReconstructionReceiptIndexEntry>();
  for (const repository of repositories) {
    const repositoryId = stringValue(repository.repository);
    const coverage = await readReconstructionCoverage(
      resolveCaseJson(caseDirectory, stringValue(repository.coverage)),
    );
    scopeIndex.set(repositoryId, {
      files: new Set(coverage.manifest.files.map((file) => file.path)),
      communities: new Set(coverage.graphify.communities.map((community) => community.id)),
      surfaces: new Set(coverage.surfaces.map((surface) => surface.id)),
    });
    for (const file of coverage.manifest.files) {
      for (const receipt of file.receipts) {
        if (receiptIndex.has(receipt.id)) {
          throw new Error(`Source read receipt ID is duplicated: ${receipt.id}`);
        }
        receiptIndex.set(receipt.id, {
          repository: repositoryId,
          path: file.path,
          actor: receipt.actor,
        });
      }
    }
  }
  const workstreams = await readReconstructionWorkstreams(
    caseDirectory,
    document.metadata,
  );
  const orchestration = recordValue(document.metadata.orchestration);
  const budget = recordValue(orchestration?.budget);
  return {
    repositoryIds,
    workstreamIds: new Set(
      workstreams
        .map((entry) => stringValue(entry.document.metadata.id))
        .filter(Boolean),
    ),
    maxRetries: Number.isInteger(budget?.max_retries_per_workstream)
      ? Number(budget?.max_retries_per_workstream)
      : 0,
    scopeIndex,
    rawCaseIds: new Set(
      stringArray(
        recordValue(recordValue(document.metadata.supplemental_inputs)?.raw)?.case_ids,
      ),
    ),
    receiptIndex,
  };
}

function renderWorkstreamBody(objective: string): string {
  return `# Objective\n\n${objective}\n\n`
    + "# Required context\n\n"
    + "Read the parent case, the relevant repository dossiers and coverage items, and only explicit dependency packets before analysis. Follow adjacent read-only evidence when the question requires it.\n\n"
    + "# Boundaries\n\n"
    + "The coverage slice defines responsibility, not a visibility wall. Source leaves are read-only. Record material exploration outside the slice under explored_context. This packet is the worker's only durable write target.\n\n"
    + "# Required method\n\n"
    + "Use Graphify for structural navigation. Read source, tests, contracts, configuration, product data, and documentation with any safe read-only tools. Before relying on source in a final claim, record the exact pinned range with wfctl knowledge reconstruct read and cite its receipt ID.\n\n"
    + "# Worker findings\n\nPending worker analysis.\n\n"
    + "# Evidence and coverage\n\nPending receipt-backed evidence.\n\n"
    + "# Uncertainties, contradictions, and omissions\n\nPending analysis.\n";
}

function assertWorkstreamId(value: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(value)) {
    throw new Error("Workstream ID must be a stable lowercase identifier");
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

async function assertCoverageBindingCurrent(
  context: ReconstructionCoverageContext,
): Promise<void> {
  const current = readRepositoryMetadata(context.root);
  if (
    current.repository !== context.repositoryId
    || current.commit !== context.commit
    || current.worktreeId !== context.worktreeId
  ) {
    throw new Error(
      `${context.repositoryId}: checkout, worktree, or revision binding drifted`,
    );
  }
  if (current.dirty) {
    throw new Error(
      `${context.repositoryId}: bound checkout has uncommitted changes`,
    );
  }
  const graph = await graphSummary(context.root);
  if (graph.contentHash !== context.graphHash) {
    throw new Error(
      `${context.repositoryId}: Graphify graph changed after the case was bound`,
    );
  }
}

function isLocalBinding(value: unknown): value is LocalBinding {
  return isRecord(value)
    && value.schemaVersion === 1
    && typeof value.caseId === "string"
    && typeof value.knowledgeRoot === "string"
    && Array.isArray(value.repositories)
    && value.repositories.every((entry) =>
      isRecord(entry)
      && typeof entry.repository === "string"
      && typeof entry.root === "string"
      && typeof entry.commit === "string"
      && typeof entry.worktreeId === "string"
    );
}

function reconstructionCasePath(
  target: string,
  state: "active" | "archive",
  id: string,
): string {
  assertCaseId(id);
  return join(target, "reconstruction", state, id, "case.md");
}

function reconstructionBindingPath(target: string, id: string): string {
  assertCaseId(id);
  return join(target, ".workflow/current/reconstruction", `${id}.json`);
}

function resolveCaseFile(caseDirectory: string, input: string): string {
  const absolute = resolve(caseDirectory, input);
  const boundary = `${resolve(caseDirectory)}${sep}`;
  if (!absolute.startsWith(boundary) || !absolute.endsWith(".md")) {
    throw new Error(`case-relative Markdown path escapes reconstruction: ${input}`);
  }
  return absolute;
}

function resolveCaseJson(caseDirectory: string, input: string): string {
  const absolute = resolve(caseDirectory, input);
  const boundary = `${resolve(caseDirectory)}${sep}`;
  if (!absolute.startsWith(boundary) || !absolute.endsWith(".json")) {
    throw new Error(`case-relative JSON path escapes reconstruction: ${input}`);
  }
  return absolute;
}

function isCaseRelativeMarkdown(value: string): boolean {
  return value.endsWith(".md")
    && !value.startsWith("/")
    && !value.split("/").includes("..");
}

function isCaseRelativeJson(value: string): boolean {
  return value.endsWith(".json")
    && !value.startsWith("/")
    && !value.split("/").includes("..");
}

function isKnowledgeConceptPath(value: string): boolean {
  return /^knowledge\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/i.test(value)
    && !/(?:^|\/)(?:index|log)\.md$/i.test(value);
}

async function requireKnowledgeRepository(targetInput: string): Promise<string> {
  const target = await realpath(resolve(targetInput));
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Reconstruction requires a knowledge repository: ${target}`);
  }
  return target;
}

async function uniqueDirectoryId(root: string, base: string): Promise<string> {
  await mkdir(root, { recursive: true });
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
  throw new Error(`Cannot allocate a unique reconstruction id for ${base}`);
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
    throw new Error("Reconstruction slug must contain ASCII letters or digits");
  }
  return slug.slice(0, 64);
}

function uniqueDossierName(repository: string, index: number): string {
  const slug = repository
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `repository-${index + 1}`;
}

function assertCaseId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid reconstruction id: ${id}`);
  }
}

function containsLocalAbsolutePath(value: string): boolean {
  return /(?:^|[\s("'`:=])(?:\/(?:Users|home|private|Volumes|var\/folders)\/|[A-Za-z]:\\)/m.test(value);
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

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
