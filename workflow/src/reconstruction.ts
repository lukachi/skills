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
import { dirname, join, resolve, sep } from "node:path";
import { findDistributionRoot } from "./assets.js";
import {
  commandFailure,
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
import { resolveReconstructionLeaves } from "./repository-registry.js";
import type { WorkOutcome } from "./types.js";
import {
  isRecord,
  parseWorkSpec,
  serializeWorkSpec,
} from "./work-spec.js";

const RECONSTRUCTION_VERSION = 2;
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
  now?: Date;
}

export interface BeginReconstructionResult {
  id: string;
  path: string;
  mode: "baseline" | "audit";
  repositories: Array<{
    repository: string;
    commit: string;
    dossier: string;
    graphNodes: number;
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
  const durableRepositories = repositoryInputs.map((input, index) => {
    const dossier = `repositories/${uniqueDossierName(
      input.metadata.repository,
      index,
    )}.md`;
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
    };
  });
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
    }
    await mkdir(dirname(bindingPath), { recursive: true });
    await writeFile(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
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
      graphNodes: graphResults[index]!.nodes,
    })),
  };
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
  issues.push(...await supplementalInputIssues(target, document.metadata));
  const repositories = recordArray(document.metadata.repositories);
  const candidates = recordArray(document.metadata.candidate_claims);
  const binding = lifecycle === "active"
    ? await readBinding(target, id, issues)
    : undefined;
  const inspectedTexts = [await readFile(path, "utf8")];
  const linkedCandidateIds = new Set<string>();

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

  const supplemental = recordValue(document.metadata.supplemental_inputs);
  for (const input of ["raw", "documentation", "change_records"]) {
    for (const candidateId of stringArray(recordValue(supplemental?.[input])?.candidate_ids)) {
      linkedCandidateIds.add(candidateId);
    }
  }
  const candidateIds = new Set(
    candidates.map((candidate) => stringValue(candidate.id)).filter(Boolean),
  );
  for (const candidateId of candidateIds) {
    if (!linkedCandidateIds.has(candidateId)) {
      issues.push(
        `candidate ${candidateId} is not linked from a repository dossier or supplemental input`,
      );
    }
  }
  for (const candidateId of linkedCandidateIds) {
    if (!candidateIds.has(candidateId)) {
      issues.push(`source coverage references undefined candidate ${candidateId}`);
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

  if (metadata.reconstruction_version !== RECONSTRUCTION_VERSION) {
    issues.push(`reconstruction_version must be ${RECONSTRUCTION_VERSION}`);
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
      const promotedTo = stringArray(candidate.promoted_to);
      if (promotedTo.length === 0) {
        issues.push(`${prefix}.promoted_to must identify the curated concepts`);
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

function dossierIssues(
  repository: Record<string, unknown>,
  metadata: Record<string, unknown>,
  body: string,
): string[] {
  const id = stringValue(repository.repository);
  const issues: string[] = [];
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
): Promise<string[]> {
  const issues: string[] = [];
  const raw = recordValue(recordValue(metadata.supplemental_inputs)?.raw);
  if (raw?.status === "not-available" && await containsFiles(join(target, "raw"))) {
    issues.push(
      "supplemental_inputs.raw is not-available but raw/ contains files; review or mark them not-relevant",
    );
  }
  if (raw?.status === "reviewed") {
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
      } catch (error) {
        issues.push(`cannot verify completed raw-intake case ${id}: ${errorMessage(error)}`);
      }
    }
  }
  return issues;
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

function isCaseRelativeMarkdown(value: string): boolean {
  return value.endsWith(".md")
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
