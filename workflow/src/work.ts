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
import { dirname, join, resolve, sep } from "node:path";
import { approvalIssues, recordApproval } from "./approval.js";
import { findDistributionRoot } from "./assets.js";
import {
  errorMessage,
  isMissingFileError,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { validateKnowledge } from "./knowledge.js";
import { resolveReconstructionLeaves } from "./repository-registry.js";
import {
  completionIssues,
  parseWorkSpec,
  serializeWorkSpec,
  type ApprovalMethod,
  type MaintainerReviewStage,
} from "./work-spec.js";
import {
  bundleCompletionIssues,
  carryForwardCloseReview,
  claimWorkIssue as claimBundleIssue,
  createWorkIssue as createBundleIssue,
  dropWorkIssue as dropBundleIssue,
  finishWayfinder as finishBundleWayfinder,
  initializeDocumentCheckpoint,
  initializeWorkBundle,
  inspectWorkBundle as inspectBundle,
  releaseWorkIssue as releaseBundleIssue,
  resolveWorkIssue as resolveBundleIssue,
  reviewBundleFile,
  setWorkIssueBlocker as setBundleIssueBlocker,
  updateBundleCheckpoint,
  type BundleReviewStatus,
  type WorkBundleInspection,
  type WorkBundleStage,
  type WorkIssuePhase,
  type WorkIssueSummary,
  type WorkIssueType,
  type WorkCheckpointStage,
  type WorkCheckpointStatus,
  type WorkCheckpointSummary,
} from "./work-bundle.js";
import type {
  RepositoryMetadata,
  WorkMode,
  WorkOutcome,
} from "./types.js";

export { createCapture as createHandoff } from "./capture.js";
export type {
  CreateCaptureOptions as CreateHandoffOptions,
  CreateCaptureResult as CreateHandoffResult,
} from "./capture.js";

type WorkScope = "project" | "leaf" | "multi-repo";

interface DurableRepository {
  repository: string;
  checkout: string;
  branch: string;
  commit_at_start: string;
  remote: string;
  worktree: boolean;
  worktree_id: string;
}

interface BoundRepository {
  root: string;
  source: RepositoryMetadata;
}

interface WorkBinding {
  schemaVersion: 4;
  id: string;
  knowledgeRoot: string;
  spec: string;
  createdAt: string;
  scope: WorkScope;
  repositories: BoundRepository[];
}

export interface BeginWorkOptions {
  target: string;
  slug: string;
  title: string;
  mode: WorkMode;
  leaves?: string[];
  knowledgeRef?: string;
  graphQuery?: string;
  distributionRoot?: string;
  now?: Date;
}

export interface BeginWorkResult {
  id: string;
  scope: WorkScope;
  codeRoots: string[];
  codeRoot?: string;
  knowledgeRoot: string;
  specPath: string;
  pointerPaths: string[];
  pointerPath: string;
  bundleRoot: string;
}

export interface VerifyWorkResult {
  id: string;
  specPath: string;
  issues: string[];
}

export interface CloseWorkOptions {
  target: string;
  id: string;
  outcome: WorkOutcome;
  now?: Date;
}

export interface CloseWorkResult {
  id: string;
  outcome: WorkOutcome;
  archivePath: string;
}

export interface WorkStatusResult {
  id: string;
  title: string;
  valid: boolean;
  scope: WorkScope;
  codeRoots: string[];
  codeRoot?: string;
  knowledgeRoot: string;
  specPath: string;
  bundleRoot: string;
  pointerPaths: string[];
  pointerPath: string;
  sources: RepositoryMetadata[];
  currentSources: RepositoryMetadata[];
  source?: RepositoryMetadata;
  currentSource?: RepositoryMetadata;
  issues: string[];
}

export interface RebindWorkResult {
  id: string;
  repository: string;
  previousRoot: string;
  currentRoot: string;
  branch: string;
  worktreeId: string;
}

export interface UpdateWorkCheckpointOptions {
  target: string;
  id: string;
  issueId?: string;
  actor: string;
  status: WorkCheckpointStatus;
  stage?: WorkCheckpointStage;
  currentState: string;
  lastCompleted?: string;
  nextAction: string;
  blockers?: string[];
  now?: Date;
}

export interface CreateWorkIssueInput {
  target: string;
  id: string;
  slug: string;
  title: string;
  phase: WorkIssuePhase;
  type: WorkIssueType;
  blockedBy?: string[];
  satisfies?: string[];
  repositories?: string[];
  artifacts?: string[];
  distributionRoot?: string;
  now?: Date;
}

export interface ClaimWorkIssueInput {
  target: string;
  id: string;
  issueId: string;
  actor: string;
  now?: Date;
}

export interface CompleteWorkIssueInput {
  target: string;
  id: string;
  issueId: string;
  summary: string;
  evidence: string[];
  now?: Date;
}

export async function beginWork(options: BeginWorkOptions): Promise<BeginWorkResult> {
  const target = await realpath(resolve(options.target));
  const config = await readConfig(target);
  let knowledgeRoot: string;
  let codeRoots: string[];

  if (config.profile === "leaf") {
    if ((options.leaves ?? []).length > 0) {
      throw new Error("--leaf may be used only when work starts from a knowledge repository");
    }
    knowledgeRoot = await realpath(resolveKnowledgeRoot(target, config));
    codeRoots = [target];
  } else {
    knowledgeRoot = target;
    codeRoots = (options.leaves ?? []).length > 0
      ? await resolveReconstructionLeaves(knowledgeRoot, options.leaves ?? [], "audit")
      : [];
  }
  await assertKnowledgeRoot(knowledgeRoot);
  if (options.knowledgeRef) {
    await assertKnowledgeReference(knowledgeRoot, options.knowledgeRef);
  }

  const repositories = codeRoots.map((root) => {
    const leafConfigPromise = readConfig(root);
    return { root, leafConfigPromise };
  });
  const boundRepositories: BoundRepository[] = [];
  const seen = new Set<string>();
  for (const input of repositories) {
    const leafConfig = await input.leafConfigPromise;
    if (leafConfig.profile !== "leaf") {
      throw new Error(`Work source is not an initialized leaf: ${input.root}`);
    }
    const configuredKnowledge = await realpath(resolveKnowledgeRoot(input.root, leafConfig));
    if (configuredKnowledge !== knowledgeRoot) {
      throw new Error(
        `Leaf points to a different knowledge repository: ${input.root} -> ${configuredKnowledge}`,
      );
    }
    const source = readRepositoryMetadata(input.root);
    if (seen.has(source.repository)) {
      throw new Error(`Work received multiple checkouts for ${source.repository}`);
    }
    seen.add(source.repository);
    boundRepositories.push({ root: input.root, source });
  }

  const scope: WorkScope = boundRepositories.length === 0
    ? "project"
    : boundRepositories.length === 1
    ? "leaf"
    : "multi-repo";
  const now = options.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const id = await uniqueWorkId(
    join(knowledgeRoot, "changes/active"),
    `${date}-${normalizeSlug(options.slug)}`,
  );
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const template = parseWorkSpec(await readFile(
    join(distributionRoot, "skills/manage-project-work/assets/work-spec.md"),
    "utf8",
  ));
  const createdAt = now.toISOString();
  const activeDirectory = join(knowledgeRoot, "changes/active", id);
  const specPath = join(activeDirectory, "change.md");
  const bindingPath = knowledgeBindingPath(knowledgeRoot, id);
  const pointerPaths = boundRepositories.map((entry) =>
    leafPointerPath(entry.root, id)
  );
  const durableRepositories = boundRepositories.map((entry) =>
    durableRepository(entry.source)
  );

  template.metadata = {
    ...template.metadata,
    workflow_version: 5,
    id,
    title: options.title,
    mode: options.mode,
    scope,
    status: "shaping",
    created_at: createdAt,
    updated_at: createdAt,
    repositories: durableRepositories,
    knowledge_alignment: {
      reviewed: options.knowledgeRef ? [options.knowledgeRef] : [],
      conflicts: [],
    },
    graph_evidence: {
      queries: options.graphQuery ? [options.graphQuery] : [],
    },
    direction: options.mode === "wayfinder"
      ? { status: "charting", map: "map.md", resolved_at: "" }
      : { status: "bounded", map: "", resolved_at: "" },
  };
  delete template.metadata.source;
  delete template.metadata.workspace;
  initializeDocumentCheckpoint(template, {
    status: "active",
    stage: options.mode === "wayfinder" ? "wayfind" : "shape",
    actor: "system:wfctl",
    currentState: options.mode === "wayfinder"
      ? "The direction map is ready for initial charting."
      : "Initial change framing is pending.",
    lastCompleted: "Central work bundle created.",
    nextAction: options.mode === "wayfinder"
      ? "Chart the destination and first bounded frontier question."
      : "Persist the first agreed framing and refresh this checkpoint.",
    blockers: [],
    now,
  });

  const binding: WorkBinding = {
    schemaVersion: 4,
    id,
    knowledgeRoot,
    spec: relativeSpec(knowledgeRoot, specPath),
    createdAt,
    scope,
    repositories: boundRepositories,
  };

  try {
    await mkdir(activeDirectory, { recursive: false });
    await writeFile(specPath, serializeWorkSpec(template), {
      encoding: "utf8",
      flag: "wx",
    });
    await initializeWorkBundle(activeDirectory, distributionRoot, options.mode, now);
    await writeBinding(bindingPath, binding);
    for (const pointerPath of pointerPaths) {
      await writeBinding(pointerPath, binding);
    }
  } catch (error) {
    await removePath(activeDirectory);
    await removePath(bindingPath);
    for (const pointerPath of pointerPaths) {
      await removePath(pointerPath);
    }
    throw error;
  }

  return {
    id,
    scope,
    codeRoots,
    ...(codeRoots[0] ? { codeRoot: codeRoots[0] } : {}),
    knowledgeRoot,
    specPath,
    pointerPaths: [bindingPath, ...pointerPaths],
    pointerPath: pointerPaths[0] ?? bindingPath,
    bundleRoot: activeDirectory,
  };
}

export async function verifyWork(
  targetInput: string,
  id: string,
): Promise<VerifyWorkResult> {
  const context = await requireWorkContext(targetInput, id);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const issues = completionIssues(document, false);
  issues.push(...await bundleCompletionIssues(dirname(context.specPath), document));
  issues.push(...repositoryVerificationIssues(document, context.currentSources));
  issues.push(...await approvalIssues(context.knowledgeRoot, context.id, document));
  return {
    id,
    specPath: context.specPath,
    issues: [...new Set(issues)],
  };
}

export interface ApproveWorkOptions {
  target: string;
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  method: ApprovalMethod;
  note?: string;
  now?: Date;
}

export interface ApproveWorkResult {
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  at: string;
  method: ApprovalMethod;
  receipt: string;
  specPath: string;
}

/**
 * Record one maintainer approval. The caller is responsible for obtaining the
 * out-of-band confirmation that selects `method`; this function only binds the
 * resulting receipt to the change record and the ignored runtime approval file.
 */
export async function approveWork(
  options: ApproveWorkOptions,
): Promise<ApproveWorkResult> {
  const context = await requireWorkContext(options.target, options.id);
  const record = await recordApproval({
    knowledgeRoot: context.knowledgeRoot,
    id: context.id,
    stage: options.stage,
    by: options.by,
    method: options.method,
    ...(options.note ? { note: options.note } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const review = record_(document.metadata.maintainer_review) ?? {};
  const previous = record_(review[options.stage]) ?? {};
  review[options.stage] = {
    ...previous,
    status: "approved",
    by: record.by,
    at: record.at,
    method: record.method,
    receipt: record.receipt,
    notes: uniqueNotes(previous.notes, record.note),
  };
  document.metadata.maintainer_review = review;
  document.metadata.updated_at = record.at;
  await writeFile(context.specPath, serializeWorkSpec(document), "utf8");
  return {
    id: context.id,
    stage: options.stage,
    by: record.by,
    at: record.at,
    method: record.method,
    receipt: record.receipt,
    specPath: context.specPath,
  };
}

function record_(value: unknown): Record<string, unknown> | undefined {
  return record(value);
}

function uniqueNotes(existing: unknown, note: string): string[] {
  const notes = stringArray(existing);
  return note && !notes.includes(note) ? [...notes, note] : notes;
}

export async function closeWork(options: CloseWorkOptions): Promise<CloseWorkResult> {
  const context = await requireWorkContext(options.target, options.id);
  const activeDirectory = dirname(context.specPath);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));

  if (options.outcome === "completed") {
    const issues = [
      ...completionIssues(document, true),
      ...await bundleCompletionIssues(activeDirectory, document),
      ...repositoryVerificationIssues(document, context.currentSources),
      ...await approvalIssues(context.knowledgeRoot, context.id, document),
    ];
    if (issues.length > 0) {
      throw new Error(`Completed close is blocked: ${[...new Set(issues)].join("; ")}`);
    }
    const promotion = record(document.metadata.knowledge_promotion);
    if (promotion?.status === "applied") {
      const validation = await validateKnowledge(
        context.knowledgeRoot,
        stringArray(promotion.concepts),
      );
      if (!validation.valid) {
        throw new Error(
          `Completed close is blocked by curated knowledge validation: ${
            validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          }`,
        );
      }
    }
  }

  const archivePath = join(context.knowledgeRoot, "changes/archive", options.id);
  await assertAbsent(archivePath, "archive");
  const now = options.now ?? new Date();
  document.metadata.status = options.outcome;
  document.metadata.outcome = options.outcome;
  document.metadata.closed_at = now.toISOString();
  document.metadata.sources_at_close = context.currentSources.map(durableRepository);
  const checkpoint = record(document.metadata.checkpoint);
  initializeDocumentCheckpoint(document, {
    status: "complete",
    stage: "complete",
    actor: typeof checkpoint?.actor === "string" ? checkpoint.actor : "system:wfctl",
    currentState: `Change bundle closed as ${options.outcome}.`,
    lastCompleted: "Completion gates passed and the bundle was archived.",
    nextAction: "None — this bundle is closed.",
    blockers: [],
    now,
  });
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(activeDirectory, archivePath);
  try {
    await writeFile(
      join(archivePath, "change.md"),
      serializeWorkSpec(document),
      "utf8",
    );
    if ([3, 4, 5].includes(Number(document.metadata.workflow_version))) {
      await carryForwardCloseReview(archivePath, now);
    }
  } catch (error) {
    await rename(archivePath, activeDirectory);
    throw error;
  }
  for (const pointerPath of context.pointerPaths) {
    await removePath(pointerPath);
  }

  return { id: options.id, outcome: options.outcome, archivePath };
}

export async function workBundleContext(
  target: string,
  id: string | undefined,
  stage: WorkBundleStage,
  issueId?: string,
): Promise<WorkBundleInspection & { id: string }> {
  const context = await requireWorkContext(target, id);
  return {
    id: context.id,
    ...await inspectBundle(dirname(context.specPath), stage, issueId),
  };
}

export async function updateWorkCheckpoint(
  options: UpdateWorkCheckpointOptions,
): Promise<WorkCheckpointSummary> {
  const context = await requireWorkContext(options.target, options.id);
  return await updateBundleCheckpoint({
    bundleRoot: dirname(context.specPath),
    ...(options.issueId ? { issueId: options.issueId } : {}),
    actor: options.actor,
    status: options.status,
    ...(options.stage ? { stage: options.stage } : {}),
    currentState: options.currentState,
    ...(options.lastCompleted ? { lastCompleted: options.lastCompleted } : {}),
    nextAction: options.nextAction,
    blockers: options.blockers ?? [],
    ...(options.now ? { now: options.now } : {}),
  });
}

export async function createWorkIssue(
  input: CreateWorkIssueInput,
): Promise<WorkIssueSummary> {
  const context = await requireWorkContext(input.target, input.id);
  const distributionRoot = input.distributionRoot ?? await findDistributionRoot();
  return await createBundleIssue({
    bundleRoot: dirname(context.specPath),
    slug: input.slug,
    title: input.title,
    phase: input.phase,
    type: input.type,
    ...(input.blockedBy ? { blockedBy: input.blockedBy } : {}),
    ...(input.satisfies ? { satisfies: input.satisfies } : {}),
    ...(input.repositories ? { repositories: input.repositories } : {}),
    ...(input.artifacts ? { artifacts: input.artifacts } : {}),
    ...(input.now ? { now: input.now } : {}),
    distributionRoot,
  });
}

export async function claimWorkIssue(
  input: ClaimWorkIssueInput,
): Promise<WorkIssueSummary> {
  const target = await realpath(resolve(input.target));
  const config = await readConfig(target);
  const context = await requireWorkContext(target, input.id);
  const source = config.profile === "leaf"
    ? context.currentSources.find((entry) => entry.root === target)
    : undefined;
  return await claimBundleIssue({
    bundleRoot: dirname(context.specPath),
    issueId: input.issueId,
    actor: input.actor,
    ...(source ? { source } : {}),
    projectOnly: context.scope === "project",
    ...(input.now ? { now: input.now } : {}),
  });
}

export async function releaseWorkIssue(
  target: string,
  id: string,
  issueId: string,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const resolvedTarget = await realpath(resolve(target));
  const context = await requireWorkContext(resolvedTarget, id);
  const claimContext = await claimContextForTarget(resolvedTarget, context);
  return await releaseBundleIssue(
    dirname(context.specPath),
    issueId,
    claimContext,
    now,
  );
}

export async function completeWorkIssue(
  input: CompleteWorkIssueInput,
): Promise<WorkIssueSummary> {
  const target = await realpath(resolve(input.target));
  const context = await requireWorkContext(target, input.id);
  const claimContext = await claimContextForTarget(target, context);
  return await resolveBundleIssue({
    bundleRoot: dirname(context.specPath),
    issueId: input.issueId,
    summary: input.summary,
    evidence: input.evidence,
    claimContext,
    ...(input.now ? { now: input.now } : {}),
  });
}

export async function dropWorkIssue(
  target: string,
  id: string,
  issueId: string,
  reason: string,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const resolvedTarget = await realpath(resolve(target));
  const context = await requireWorkContext(resolvedTarget, id);
  const claimContext = await claimContextForTarget(resolvedTarget, context);
  return await dropBundleIssue(
    dirname(context.specPath),
    issueId,
    reason,
    claimContext,
    now,
  );
}

export async function setWorkIssueBlocker(
  target: string,
  id: string,
  issueId: string,
  blockerId: string,
  blocked: boolean,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const context = await requireWorkContext(target, id);
  return await setBundleIssueBlocker(
    dirname(context.specPath),
    issueId,
    blockerId,
    blocked,
    now,
  );
}

export async function reviewWorkBundleFile(
  target: string,
  id: string,
  path: string,
  status: BundleReviewStatus,
  reason: string,
  now = new Date(),
) {
  const context = await requireWorkContext(target, id);
  return await reviewBundleFile(dirname(context.specPath), path, status, reason, now);
}

export async function finishWayfinder(
  target: string,
  id: string,
  mode: "full" | "slice",
  now = new Date(),
) {
  const context = await requireWorkContext(target, id);
  return await finishBundleWayfinder(dirname(context.specPath), mode, now);
}

export async function rebindWork(
  targetInput: string,
  id: string,
  now = new Date(),
): Promise<RebindWorkResult> {
  const target = await realpath(resolve(targetInput));
  const config = await readConfig(target);
  if (config.profile !== "leaf") {
    throw new Error("Work rebind must target the replacement leaf checkout");
  }
  const knowledgeRoot = await realpath(resolveKnowledgeRoot(target, config));
  const bindingPath = knowledgeBindingPath(knowledgeRoot, id);
  const binding = await readBinding(bindingPath);
  const current = readRepositoryMetadata(target);
  const index = binding.repositories.findIndex((entry) =>
    entry.source.repository === current.repository
  );
  if (index < 0) {
    throw new Error(
      `Work ${id} is not scoped to repository ${current.repository}`,
    );
  }
  const previous = binding.repositories[index]!;
  binding.repositories[index] = { root: target, source: current };

  const specPath = resolve(knowledgeRoot, binding.spec);
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  const repositories = recordArray(document.metadata.repositories);
  const durableIndex = repositories.findIndex((entry) =>
    entry.repository === current.repository
  );
  if (durableIndex < 0) {
    throw new Error(`Work spec has no durable repository entry for ${current.repository}`);
  }
  repositories[durableIndex] = { ...durableRepository(current) };
  document.metadata.repositories = repositories;
  document.metadata.updated_at = now.toISOString();
  document.metadata.rebindings = [
    ...recordArray(document.metadata.rebindings),
    {
      repository: current.repository,
      from_worktree_id: previous.source.worktreeId,
      from_branch: previous.source.branch,
      to_worktree_id: current.worktreeId,
      to_branch: current.branch,
      at: now.toISOString(),
    },
  ];

  const previousPointer = leafPointerPath(previous.root, id);
  const currentPointer = leafPointerPath(target, id);
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
  await writeBinding(bindingPath, binding, true);
  await writeBinding(currentPointer, binding, true);
  if (previousPointer !== currentPointer) {
    await removePath(previousPointer);
  }

  return {
    id,
    repository: current.repository,
    previousRoot: previous.root,
    currentRoot: target,
    branch: current.branch,
    worktreeId: current.worktreeId,
  };
}

export async function workStatus(
  targetInput: string,
  id?: string,
): Promise<WorkStatusResult[]> {
  const target = await realpath(resolve(targetInput));
  const config = await readConfig(target);
  const pointerRoot = config.profile === "knowledge"
    ? join(target, ".workflow/current/work")
    : join(target, ".workflow/current");
  const ids = id ? [id] : await pointerIds(pointerRoot);
  const results: WorkStatusResult[] = [];
  for (const workId of ids) {
    results.push(await inspectWorkContext(target, config.profile, workId));
  }
  return results;
}

async function requireWorkContext(
  targetInput: string,
  id?: string,
): Promise<WorkStatusResult> {
  const results = await workStatus(targetInput, id);
  if (!id && results.length === 0) {
    throw new Error("No active work records are bound to this checkout");
  }
  if (!id && results.length > 1) {
    throw new Error(
      `Multiple active work records are bound to this checkout: ${
        results.map((entry) => `${entry.id} (${entry.title})`).join(", ")
      }. Run wfctl work status, inspect the candidates, and ask the maintainer which outcome to resume; do not guess`,
    );
  }
  const context = results[0];
  if (!context) {
    throw new Error(`Active work binding not found: ${id}`);
  }
  if (!context.valid) {
    throw new Error(`Work context mismatch for ${context.id}: ${context.issues.join("; ")}`);
  }
  return context;
}

async function claimContextForTarget(
  target: string,
  context: WorkStatusResult,
) {
  const config = await readConfig(target);
  const source = config.profile === "leaf"
    ? context.currentSources.find((entry) => entry.root === target)
    : undefined;
  return {
    ...(source ? { source } : {}),
    allowProject: config.profile === "knowledge",
  };
}

async function inspectWorkContext(
  target: string,
  profile: "knowledge" | "leaf",
  id: string,
): Promise<WorkStatusResult> {
  const config = await readConfig(target);
  const knowledgeRoot = profile === "knowledge"
    ? target
    : await realpath(resolveKnowledgeRoot(target, config));
  const preferred = profile === "knowledge"
    ? knowledgeBindingPath(knowledgeRoot, id)
    : leafPointerPath(target, id);
  let binding: WorkBinding;
  let preferredExists = true;
  try {
    binding = await readBinding(preferred);
  } catch (error) {
    if (profile !== "leaf" || !isMissingFileError(error)) {
      throw error;
    }
    preferredExists = false;
    binding = await readBinding(knowledgeBindingPath(knowledgeRoot, id));
  }
  const issues: string[] = [];
  if (binding.id !== id || binding.knowledgeRoot !== knowledgeRoot) {
    issues.push("local work binding does not match this knowledge checkout");
  }
  if (profile === "leaf" && !preferredExists) {
    issues.push("this checkout is not bound to the work; use wfctl work rebind explicitly");
  }
  if (
    profile === "leaf"
    && !binding.repositories.some((entry) => entry.root === target)
  ) {
    issues.push(`current checkout ${target} is outside the bound workspaces`);
  }

  const currentSources: RepositoryMetadata[] = [];
  for (const entry of binding.repositories) {
    try {
      const current = readRepositoryMetadata(entry.root);
      currentSources.push(current);
      if (current.root !== entry.source.root) {
        issues.push(`${entry.source.repository}: checkout root changed`);
      }
      if (current.repository !== entry.source.repository) {
        issues.push(
          `${entry.source.repository}: bound path now identifies ${current.repository}`,
        );
      }
      if (current.worktreeId !== entry.source.worktreeId) {
        issues.push(
          `${entry.source.repository}: worktree changed from ${entry.source.worktreeId} to ${current.worktreeId}`,
        );
      }
      if (current.branch !== entry.source.branch) {
        issues.push(
          `${entry.source.repository}: branch changed from ${entry.source.branch} to ${current.branch}; run wfctl work rebind`,
        );
      }
    } catch (error) {
      issues.push(`${entry.source.repository}: ${errorMessage(error)}`);
    }
  }

  const specPath = resolve(knowledgeRoot, binding.spec);
  const activeRoot = join(knowledgeRoot, "changes/active");
  let title = id;
  if (!inside(activeRoot, specPath)) {
    issues.push(`spec path is outside the active work root: ${specPath}`);
  }
  try {
    const document = parseWorkSpec(await readFile(specPath, "utf8"));
    title = typeof document.metadata.title === "string"
      ? document.metadata.title.trim() || id
      : id;
    if (document.metadata.scope !== binding.scope) {
      issues.push("spec scope does not match the local binding");
    }
    const durable = recordArray(document.metadata.repositories);
    if (durable.length !== binding.repositories.length) {
      issues.push("spec repository scope does not match the local binding");
    }
    for (const entry of binding.repositories) {
      const stored = durable.find((candidate) =>
        candidate.repository === entry.source.repository
      );
      if (
        !stored
        || stored.worktree_id !== entry.source.worktreeId
        || stored.branch !== entry.source.branch
      ) {
        issues.push(`${entry.source.repository}: durable repository binding is inconsistent`);
      }
    }
    const serialized = await readFile(specPath, "utf8");
    for (const entry of binding.repositories) {
      if (serialized.includes(entry.root)) {
        issues.push("durable work record leaks a local checkout path");
        break;
      }
    }
  } catch (error) {
    issues.push(`cannot read bound spec: ${errorMessage(error)}`);
  }

  const pointerPaths = [
    knowledgeBindingPath(knowledgeRoot, id),
    ...binding.repositories.map((entry) => leafPointerPath(entry.root, id)),
  ];
  const codeRoots = binding.repositories.map((entry) => entry.root);
  const sources = binding.repositories.map((entry) => entry.source);
  return {
    id,
    title,
    valid: issues.length === 0,
    scope: binding.scope,
    codeRoots,
    ...(codeRoots[0] ? { codeRoot: codeRoots[0] } : {}),
    knowledgeRoot,
    specPath,
    bundleRoot: dirname(specPath),
    pointerPaths,
    pointerPath: profile === "leaf"
      ? preferred
      : knowledgeBindingPath(knowledgeRoot, id),
    sources,
    currentSources,
    ...(sources[0] ? { source: sources[0] } : {}),
    ...(currentSources[0] ? { currentSource: currentSources[0] } : {}),
    issues,
  };
}

function repositoryVerificationIssues(
  document: ReturnType<typeof parseWorkSpec>,
  sources: RepositoryMetadata[],
): string[] {
  const issues: string[] = [];
  if (document.metadata.scope === "project") {
    return issues;
  }
  const verification = record(document.metadata.verification);
  const receipts = recordArray(verification?.repositories);
  for (const source of sources) {
    if (source.dirty) {
      issues.push(`${source.repository}: bound source checkout must be clean for final verification`);
    }
    const receipt = receipts.find((entry) => entry.repository === source.repository)
      ?? (sources.length === 1 ? verification : undefined);
    if (!receipt) {
      issues.push(`${source.repository}: verification receipt is missing`);
      continue;
    }
    if (receipt.revision !== source.commit) {
      issues.push(
        `${source.repository}: verification revision does not match current commit`,
      );
    }
    if (receipt.worktree_id !== source.worktreeId) {
      issues.push(
        `${source.repository}: verification worktree_id does not match current worktree`,
      );
    }
    if (receipts.length > 0 && !nonEmptyArray(receipt.checks)) {
      issues.push(`${source.repository}: verification checks are missing`);
    }
  }
  for (const receipt of receipts) {
    if (!sources.some((source) => source.repository === receipt.repository)) {
      issues.push(`verification receipt is outside work scope: ${String(receipt.repository)}`);
    }
  }
  return issues;
}

function durableRepository(source: RepositoryMetadata): DurableRepository {
  return {
    repository: source.repository,
    checkout: source.checkout,
    branch: source.branch,
    commit_at_start: source.commit,
    remote: /^(?:https?:\/\/|ssh:\/\/|git@)/.test(source.remote) ? source.remote : "",
    worktree: source.worktree,
    worktree_id: source.worktreeId,
  };
}

async function assertKnowledgeRoot(root: string): Promise<void> {
  try {
    await access(join(root, "knowledge/index.md"), constants.R_OK);
  } catch {
    throw new Error(`Knowledge repository is not initialized: ${root}`);
  }
}

async function assertKnowledgeReference(root: string, reference: string): Promise<void> {
  const normalized = reference.replace(/^\/+/, "");
  const absolute = resolve(root, normalized);
  const knowledgeRoot = join(root, "knowledge");
  if (!inside(knowledgeRoot, absolute) || !absolute.toLowerCase().endsWith(".md")) {
    throw new Error("Knowledge reference must identify a Markdown file under knowledge/");
  }
  try {
    await access(absolute, constants.R_OK);
  } catch (error) {
    throw new Error(`Knowledge reference is not readable: ${reference} (${errorMessage(error)})`);
  }
}

function knowledgeBindingPath(knowledgeRoot: string, id: string): string {
  assertId(id);
  return join(knowledgeRoot, ".workflow/current/work", `${id}.json`);
}

function leafPointerPath(root: string, id: string): string {
  assertId(id);
  return join(root, ".workflow/current", `${id}.json`);
}

async function writeBinding(
  path: string,
  binding: WorkBinding,
  replace = false,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(binding, null, 2)}\n`, {
    encoding: "utf8",
    flag: replace ? "w" : "wx",
  });
}

async function readBinding(path: string): Promise<WorkBinding> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (
    !isRecord(raw)
    || raw.schemaVersion !== 4
    || typeof raw.id !== "string"
    || typeof raw.knowledgeRoot !== "string"
    || typeof raw.spec !== "string"
    || typeof raw.createdAt !== "string"
    || !["project", "leaf", "multi-repo"].includes(String(raw.scope))
    || !Array.isArray(raw.repositories)
    || !raw.repositories.every((entry: unknown) =>
      isRecord(entry)
      && typeof entry.root === "string"
      && isRepositoryMetadata(entry.source)
    )
  ) {
    throw new Error(`Unsupported or malformed active work binding: ${path}`);
  }
  return raw as unknown as WorkBinding;
}

function isRepositoryMetadata(value: unknown): value is RepositoryMetadata {
  return isRecord(value)
    && typeof value.repository === "string"
    && typeof value.root === "string"
    && typeof value.checkout === "string"
    && typeof value.branch === "string"
    && typeof value.commit === "string"
    && typeof value.remote === "string"
    && typeof value.dirty === "boolean"
    && typeof value.worktree === "boolean"
    && typeof value.worktreeId === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Which files in the pointer directory are actually work bindings.
 *
 * This used to be "every `*.json` except `repositories.json`", a denylist of
 * one name, so anything else that ever landed there became a binding wfctl
 * could not parse — and one unreadable binding fails the command rather than
 * being skipped. The stop guard's own state file proved it: `wfctl work
 * status`, `context`, and every other work command stopped working in a leaf
 * repository until the file was moved.
 *
 * Recognition is by shape now: `schemaVersion` alone is not enough, because the
 * repository registry, the knowledge graph, and the claim ledger all carry one.
 * A work binding is the only artifact that also names a `spec` and a
 * `knowledgeRoot`, so those three together identify one without a denylist that
 * has to be maintained every time something new is written nearby.
 *
 * It stays loud where it matters. A file recognized as a binding is handed to
 * `readBinding`, which reports an unsupported version or a broken `repositories`
 * list rather than skipping it. Only files that were never bindings are passed
 * over in silence.
 */
async function pointerIds(root: string): Promise<string[]> {
  try {
    const ids: string[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(join(root, entry.name), "utf8"));
      } catch {
        continue;
      }
      if (
        !isRecord(parsed)
        || parsed.schemaVersion === undefined
        || typeof parsed.spec !== "string"
        || typeof parsed.knowledgeRoot !== "string"
      ) {
        continue;
      }
      ids.push(entry.name.slice(0, -5));
    }
    return ids.sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

function relativeSpec(knowledgeRoot: string, specPath: string): string {
  const value = specPath.slice(`${knowledgeRoot}${sep}`.length);
  return value.split(sep).join("/");
}

function inside(parent: string, child: string): boolean {
  const boundary = `${resolve(parent)}${sep}`;
  return resolve(child).startsWith(boundary);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry) => Boolean(record(entry))) as Record<string, unknown>[] : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function nonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

async function uniqueWorkId(activeRoot: string, base: string): Promise<string> {
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    try {
      await access(join(activeRoot, candidate), constants.F_OK);
    } catch (error) {
      if (isMissingFileError(error)) {
        return candidate;
      }
      throw error;
    }
  }
  throw new Error(`Cannot allocate a unique work id for ${base}`);
}

async function assertAbsent(path: string, label: string): Promise<void> {
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

async function removePath(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

function normalizeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Work slug must contain ASCII letters or digits");
  }
  return slug.slice(0, 64);
}

function assertId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    throw new Error(`Invalid work id: ${id}`);
  }
}
