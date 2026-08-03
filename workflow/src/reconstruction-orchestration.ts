import { readFile, readdir } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { isRecord, parseWorkSpec } from "./work-spec.js";

export const RECONSTRUCTION_ORCHESTRATION_VERSION = 3;
export const LEGACY_RECONSTRUCTION_ORCHESTRATION_VERSION = 2;
export const RECONSTRUCTION_WORKSTREAM_VERSION = 3;
export const LEGACY_RECONSTRUCTION_WORKSTREAM_VERSION = 2;

export const RECONSTRUCTION_WORKLOADS = [
  "exploration",
  "analysis",
  "synthesis",
  "review",
] as const;
export const RECONSTRUCTION_PROFILES = ["fast", "balanced", "deep"] as const;
export const RECONSTRUCTION_ESCALATION_TRIGGERS = [
  "contradiction",
  "insufficient-evidence",
  "negative-claim",
  "cross-boundary-scope",
  "review-rework",
  "maintainer-authority",
] as const;
export const RECONSTRUCTION_ESCALATION_ACTIONS = [
  "stronger-profile",
  "new-workstream",
  "maintainer-review",
  "retained-uncertainty",
  "same-profile",
] as const;

export type ReconstructionWorkload = typeof RECONSTRUCTION_WORKLOADS[number];
export type ReconstructionProfile = typeof RECONSTRUCTION_PROFILES[number];
export type ReconstructionEscalationTrigger =
  typeof RECONSTRUCTION_ESCALATION_TRIGGERS[number];
export type ReconstructionEscalationAction =
  typeof RECONSTRUCTION_ESCALATION_ACTIONS[number];

const EXECUTION_MODES = new Set(["single-agent", "orchestrator-workers"]);
const WORKSTREAM_STATUSES = new Set([
  "planned",
  "active",
  "submitted",
  "accepted",
  "rework",
  "blocked",
  "cancelled",
]);
const REVIEW_ASSURANCE_LEVELS = new Set([
  "independent-agent",
  "separate-session",
  "maintainer",
]);
const WORKLOADS = new Set<string>(RECONSTRUCTION_WORKLOADS);
const PROFILES = new Set<string>(RECONSTRUCTION_PROFILES);
const ESCALATION_TRIGGERS = new Set<string>(RECONSTRUCTION_ESCALATION_TRIGGERS);
const ESCALATION_ACTIONS = new Set<string>(RECONSTRUCTION_ESCALATION_ACTIONS);
const PROFILE_RANK = new Map<string, number>(
  RECONSTRUCTION_PROFILES.map((profile, index) => [profile, index]),
);

export interface ReconstructionWorkstreamRecord {
  path: string;
  relativePath: string;
  referenced: boolean;
  content: Buffer;
  document: ReturnType<typeof parseWorkSpec>;
}

export interface ReconstructionScopeIndexEntry {
  files: Set<string>;
  communities: Set<string>;
  surfaces: Set<string>;
}

export interface ReconstructionReceiptIndexEntry {
  repository: string;
  path: string;
  actor: string;
}

export function orchestrationWorkstreamPaths(
  metadata: Record<string, unknown>,
): string[] {
  const orchestration = recordValue(metadata.orchestration);
  return stringArray(orchestration?.workstreams);
}

export async function readReconstructionWorkstreams(
  caseDirectory: string,
  metadata: Record<string, unknown>,
): Promise<ReconstructionWorkstreamRecord[]> {
  const records: ReconstructionWorkstreamRecord[] = [];
  const referenced = new Set(orchestrationWorkstreamPaths(metadata));
  const discovered = new Set<string>();
  const workstreamDirectory = resolve(caseDirectory, "workstreams");
  try {
    for (const entry of await readdir(workstreamDirectory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (!entry.isFile() || !/^[a-z0-9][a-z0-9-]{0,95}\.md$/.test(entry.name)) {
        throw new Error(
          `unexpected reconstruction workstream entry: workstreams/${entry.name}`,
        );
      }
      discovered.add(`workstreams/${entry.name}`);
    }
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error;
    }
  }
  const paths = [...new Set([...referenced, ...discovered])].sort();
  for (const input of paths) {
    const path = resolveWorkstreamPath(caseDirectory, input);
    const content = await readFile(path);
    records.push({
      path,
      relativePath: relative(caseDirectory, path).split(sep).join("/"),
      referenced: referenced.has(input),
      content,
      document: parseWorkSpec(content.toString("utf8")),
    });
  }
  return records;
}

export function reconstructionOrchestrationIssues(
  metadata: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  const orchestration = recordValue(metadata.orchestration);
  if (!orchestration) {
    return ["orchestration is required for reconstruction version 5"];
  }
  const orchestrationVersion = Number(orchestration.version);
  const adaptiveOrchestration = orchestrationVersion === RECONSTRUCTION_ORCHESTRATION_VERSION;
  if (
    orchestrationVersion !== LEGACY_RECONSTRUCTION_ORCHESTRATION_VERSION
    && !adaptiveOrchestration
  ) {
    issues.push(
      `orchestration.version must be ${LEGACY_RECONSTRUCTION_ORCHESTRATION_VERSION} or ${RECONSTRUCTION_ORCHESTRATION_VERSION}`,
    );
  }
  if (orchestration.strategy !== "adaptive-orchestrator-worker") {
    issues.push("orchestration.strategy must be adaptive-orchestrator-worker");
  }
  const execution = stringValue(orchestration.execution);
  if (!EXECUTION_MODES.has(execution)) {
    issues.push("orchestration.execution must be single-agent or orchestrator-workers");
  }
  if (orchestration.status !== "completed") {
    issues.push("orchestration.status must be completed");
  }
  if (!stringValue(orchestration.reason).trim()) {
    issues.push("orchestration.reason must explain the selected execution mode");
  }

  const budget = recordValue(orchestration.budget);
  const maxParallel = positiveInteger(budget?.max_parallel);
  const maxWorkstreams = nonNegativeInteger(budget?.max_workstreams);
  const maxRetries = nonNegativeInteger(budget?.max_retries_per_workstream);
  if (maxParallel === undefined) {
    issues.push("orchestration.budget.max_parallel must be a positive integer");
  }
  if (maxWorkstreams === undefined) {
    issues.push("orchestration.budget.max_workstreams must be a non-negative integer");
  }
  if (maxRetries === undefined) {
    issues.push(
      "orchestration.budget.max_retries_per_workstream must be a non-negative integer",
    );
  }

  const workstreams = stringArray(orchestration.workstreams);
  if (
    !Array.isArray(orchestration.workstreams)
    || orchestration.workstreams.some((entry) => typeof entry !== "string")
  ) {
    issues.push("orchestration.workstreams must be a list of case-relative Markdown paths");
  }
  if (new Set(workstreams).size !== workstreams.length) {
    issues.push("orchestration.workstreams contains duplicate paths");
  }
  for (const path of workstreams) {
    try {
      resolveWorkstreamPath("/case", path);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (execution === "single-agent") {
    if (maxParallel !== undefined && maxParallel !== 1) {
      issues.push("single-agent orchestration requires max_parallel: 1");
    }
  } else if (execution === "orchestrator-workers") {
    if (maxParallel !== undefined && maxParallel < 2) {
      issues.push("orchestrator-workers requires max_parallel of at least 2");
    }
    if (workstreams.length === 0) {
      issues.push("orchestrator-workers requires at least one durable workstream");
    }
  }
  if (maxWorkstreams !== undefined && workstreams.length > maxWorkstreams) {
    issues.push(
      `orchestration has ${workstreams.length} workstreams but budget allows ${maxWorkstreams}`,
    );
  }

  const synthesis = recordValue(orchestration.synthesis);
  if (
    synthesis?.status !== "passed"
    || !stringValue(synthesis.by).trim()
    || !nonEmptyStringArray(synthesis.notes)
  ) {
    issues.push("orchestration.synthesis must pass with an actor and notes");
  }
  const review = recordValue(orchestration.independent_review);
  if (
    review?.status !== "passed"
    || !stringValue(review.by).trim()
    || !isIsoDateTime(stringValue(review.at))
    || !nonEmptyStringArray(review.notes)
  ) {
    issues.push(
      "orchestration.independent_review must pass with a fresh actor, time, and notes",
    );
  }
  const assurance = stringValue(review?.assurance);
  if (!REVIEW_ASSURANCE_LEVELS.has(assurance)) {
    issues.push(
      "orchestration.independent_review.assurance must be independent-agent, separate-session, or maintainer",
    );
  } else if (
    assurance === "maintainer"
    && !stringValue(review?.by).startsWith("human:")
  ) {
    issues.push("maintainer assurance requires a human:<maintainer-id> reviewer");
  } else if (
    assurance !== "maintainer"
    && (
      adaptiveOrchestration
        ? (
          stringValue(recordValue(review?.routing)?.workload) !== "review"
          || stringValue(recordValue(review?.routing)?.requested_profile) !== "deep"
          || !stringValue(recordValue(review?.routing)?.reason).trim()
          || !stringValue(review?.host).trim()
          || !stringValue(review?.run_id).trim()
          || !stringValue(review?.model).trim()
          || !stringValue(review?.reasoning_effort).trim()
        )
        : !stringValue(review?.run_id).trim()
    )
  ) {
    issues.push(
      adaptiveOrchestration
        ? "agent or separate-session assurance requires review/deep routing with a reason and the reported host, run ID, model, and reasoning effort"
        : "legacy agent or separate-session assurance requires the reported host run_id",
    );
  }
  if (
    stringValue(synthesis?.by)
    && stringValue(synthesis?.by) === stringValue(review?.by)
  ) {
    issues.push("orchestration independent review actor must differ from synthesis actor");
  }
  return issues;
}

export function reconstructionWorkstreamIssues(
  record: ReconstructionWorkstreamRecord,
  caseId: string,
  repositoryIds: Set<string>,
  knownWorkstreamIds: Set<string>,
  maxRetries: number,
  scopeIndex: Map<string, ReconstructionScopeIndexEntry>,
  rawCaseIds: Set<string>,
  receiptIndex: Map<string, ReconstructionReceiptIndexEntry>,
  phase: "close" | "accept" | "submit" = "close",
): string[] {
  const issues: string[] = [];
  const { metadata, body } = record.document;
  const prefix = `workstream ${record.relativePath}`;
  const id = stringValue(metadata.id);
  const workstreamVersion = Number(metadata.reconstruction_workstream_version);
  const adaptiveRouting = workstreamVersion === RECONSTRUCTION_WORKSTREAM_VERSION;
  if (
    workstreamVersion !== LEGACY_RECONSTRUCTION_WORKSTREAM_VERSION
    && !adaptiveRouting
  ) {
    issues.push(
      `${prefix}: reconstruction_workstream_version must be ${LEGACY_RECONSTRUCTION_WORKSTREAM_VERSION} or ${RECONSTRUCTION_WORKSTREAM_VERSION}`,
    );
  }
  if (metadata.case_id !== caseId) {
    issues.push(`${prefix}: case_id does not match reconstruction ${caseId}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) {
    issues.push(`${prefix}: id must be a stable lowercase identifier`);
  }
  if (basename(record.relativePath) !== `${id}.md`) {
    issues.push(`${prefix}: filename must match workstream id ${id || "<missing>"}`);
  }
  if (!stringValue(metadata.title).trim()) {
    issues.push(`${prefix}: title is required`);
  }
  if (!positiveInteger(metadata.wave)) {
    issues.push(`${prefix}: wave must be a positive integer`);
  }
  if (!stringValue(metadata.role).trim()) {
    issues.push(`${prefix}: role is required`);
  }
  const routing = recordValue(metadata.routing);
  const workload = stringValue(routing?.workload);
  const initialProfile = stringValue(routing?.initial_profile);
  const requestedProfile = stringValue(routing?.requested_profile);
  const escalationHistory = adaptiveRouting
    ? recordArray(routing?.escalation_history)
    : [];
  const executionHistory = adaptiveRouting
    ? recordArray(routing?.execution_history)
    : [];
  const rawEscalationHistory = routing?.escalation_history;
  const rawExecutionHistory = routing?.execution_history;
  if (adaptiveRouting && !WORKLOADS.has(workload)) {
    issues.push(`${prefix}: routing.workload must be exploration, analysis, synthesis, or review`);
  }
  if (adaptiveRouting && !PROFILES.has(requestedProfile)) {
    issues.push(`${prefix}: routing.requested_profile must be fast, balanced, or deep`);
  }
  if (adaptiveRouting && !PROFILES.has(initialProfile)) {
    issues.push(`${prefix}: routing.initial_profile must be fast, balanced, or deep`);
  }
  if (adaptiveRouting && !stringValue(routing?.reason).trim()) {
    issues.push(`${prefix}: routing.reason must explain the requested compute profile`);
  }
  if (adaptiveRouting && workload === "analysis" && requestedProfile === "fast") {
    issues.push(`${prefix}: analysis work requires balanced or deep routing`);
  }
  if (
    adaptiveRouting
    && (workload === "synthesis" || workload === "review")
    && requestedProfile !== "deep"
  ) {
    issues.push(`${prefix}: synthesis and review work require deep routing`);
  }
  if (adaptiveRouting && !Array.isArray(rawEscalationHistory)) {
    issues.push(`${prefix}: routing.escalation_history must be a list`);
  } else if (
    adaptiveRouting
    && Array.isArray(rawEscalationHistory)
    && rawEscalationHistory.some((entry) => !isRecord(entry))
  ) {
    issues.push(`${prefix}: routing.escalation_history entries must be records`);
  }
  if (adaptiveRouting && !Array.isArray(rawExecutionHistory)) {
    issues.push(`${prefix}: routing.execution_history must be a list`);
  } else if (
    adaptiveRouting
    && Array.isArray(rawExecutionHistory)
    && rawExecutionHistory.some((entry) => !isRecord(entry))
  ) {
    issues.push(`${prefix}: routing.execution_history entries must be records`);
  }
  let expectedProfile = adaptiveRouting && PROFILES.has(initialProfile)
    ? initialProfile
    : undefined;
  for (const [index, escalation] of escalationHistory.entries()) {
    const eventPrefix = `${prefix}: routing.escalation_history[${index}]`;
    const trigger = stringValue(escalation.trigger);
    const action = stringValue(escalation.action);
    const fromProfile = stringValue(escalation.from_profile);
    const toProfile = stringValue(escalation.to_profile);
    const targetWorkstream = stringValue(escalation.target_workstream);
    if (!ESCALATION_TRIGGERS.has(trigger)) {
      issues.push(`${eventPrefix}.trigger is invalid`);
    }
    if (!ESCALATION_ACTIONS.has(action)) {
      issues.push(`${eventPrefix}.action is invalid`);
    }
    if (!PROFILES.has(fromProfile) || !PROFILES.has(toProfile)) {
      issues.push(`${eventPrefix} must record valid from_profile and to_profile`);
    } else {
      if (expectedProfile !== undefined && fromProfile !== expectedProfile) {
        issues.push(`${eventPrefix}.from_profile does not continue the routing history`);
      }
      if (
        action === "stronger-profile"
        && (PROFILE_RANK.get(toProfile) ?? -1) <= (PROFILE_RANK.get(fromProfile) ?? -1)
      ) {
        issues.push(`${eventPrefix}: stronger-profile must increase the requested profile`);
      }
      if (action !== "stronger-profile" && toProfile !== fromProfile) {
        issues.push(`${eventPrefix}: only stronger-profile may change the requested profile`);
      }
      expectedProfile = toProfile;
    }
    if (!stringValue(escalation.by).trim()) {
      issues.push(`${eventPrefix}.by is required`);
    }
    if (
      action === "maintainer-review"
      && !stringValue(escalation.by).startsWith("human:")
    ) {
      issues.push(`${eventPrefix}: maintainer-review must be recorded by human:<maintainer-id>`);
    }
    if (action === "new-workstream") {
      if (!knownWorkstreamIds.has(targetWorkstream) || targetWorkstream === id) {
        issues.push(`${eventPrefix}.target_workstream must reference another registered workstream`);
      }
    } else if (targetWorkstream) {
      issues.push(`${eventPrefix}.target_workstream is valid only for new-workstream`);
    }
    const escalationAttempt = positiveInteger(escalation.attempt);
    if (escalationAttempt === undefined) {
      issues.push(`${eventPrefix}.attempt must be a positive integer`);
    }
    if (!isIsoDateTime(stringValue(escalation.at))) {
      issues.push(`${eventPrefix}.at must be an ISO date-time`);
    }
    if (!stringValue(escalation.reason).trim()) {
      issues.push(`${eventPrefix}.reason is required`);
    }
  }
  if (adaptiveRouting && expectedProfile !== undefined && requestedProfile !== expectedProfile) {
    issues.push(`${prefix}: routing.requested_profile does not match the escalation history`);
  }
  const status = stringValue(metadata.status);
  const cancelled = status === "cancelled";
  if (!WORKSTREAM_STATUSES.has(status)) {
    issues.push(`${prefix}: status is invalid`);
  } else if (
    phase === "close"
    && status !== "accepted"
    && status !== "cancelled"
  ) {
    issues.push(
      `${prefix}: status must be accepted or review-approved cancelled before completed close`,
    );
  }
  const owner = stringValue(metadata.owner);
  if (!cancelled && !owner.trim()) {
    issues.push(`${prefix}: owner is required`);
  }
  const executionRecord = recordValue(metadata.execution);
  if (
    status !== "planned"
    && !cancelled
    && (
      !stringValue(executionRecord?.host).trim()
      || !stringValue(executionRecord?.run_id).trim()
      || (
        adaptiveRouting
        && (
          !PROFILES.has(stringValue(executionRecord?.profile))
          || !stringValue(executionRecord?.model).trim()
          || !stringValue(executionRecord?.reasoning_effort).trim()
        )
      )
      || !isIsoDateTime(stringValue(executionRecord?.claimed_at))
    )
  ) {
    issues.push(
      adaptiveRouting
        ? `${prefix}: claimed work requires execution host, run ID, requested profile, model selection, reasoning effort, and claimed time`
        : `${prefix}: legacy claimed work requires execution host, run ID, and claimed time`,
    );
  }
  const attempt = positiveInteger(metadata.attempt);
  if (attempt === undefined) {
    issues.push(`${prefix}: attempt must be a positive integer`);
  } else if (attempt > maxRetries + 1) {
    issues.push(`${prefix}: attempt ${attempt} exceeds retry budget ${maxRetries}`);
  }
  if (adaptiveRouting && attempt !== undefined) {
    const maximumEscalationAttempt = status === "rework" ? attempt + 1 : attempt;
    for (const [index, escalation] of escalationHistory.entries()) {
      const escalationAttempt = positiveInteger(escalation.attempt);
      if (
        escalationAttempt !== undefined
        && escalationAttempt > maximumEscalationAttempt
      ) {
        issues.push(
          `${prefix}: routing.escalation_history[${index}].attempt exceeds the current lifecycle attempt`,
        );
      }
    }
  }
  for (const [index, execution] of executionHistory.entries()) {
    const executionPrefix = `${prefix}: routing.execution_history[${index}]`;
    if (positiveInteger(execution.attempt) !== index + 1) {
      issues.push(`${executionPrefix}.attempt must form a contiguous sequence starting at 1`);
    }
    if (!stringValue(execution.by).trim()) {
      issues.push(`${executionPrefix}.by is required`);
    }
    if (!stringValue(execution.host).trim() || !stringValue(execution.run_id).trim()) {
      issues.push(`${executionPrefix} must record host and run_id`);
    }
    if (!PROFILES.has(stringValue(execution.profile))) {
      issues.push(`${executionPrefix}.profile must be fast, balanced, or deep`);
    }
    if (
      !stringValue(execution.model).trim()
      || !stringValue(execution.reasoning_effort).trim()
    ) {
      issues.push(`${executionPrefix} must record model and reasoning_effort`);
    }
    if (!isIsoDateTime(stringValue(execution.claimed_at))) {
      issues.push(`${executionPrefix}.claimed_at must be an ISO date-time`);
    }
  }
  if (adaptiveRouting && !cancelled && status === "planned" && executionHistory.length > 0) {
    issues.push(`${prefix}: planned workstream cannot contain execution history`);
  }
  if (
    adaptiveRouting
    && !cancelled
    && status !== "planned"
    && attempt !== undefined
    && executionHistory.length !== attempt
  ) {
    issues.push(`${prefix}: routing.execution_history must contain one claim for every attempt`);
  }
  const latestExecution = executionHistory.at(-1);
  if (adaptiveRouting && !cancelled && status !== "planned" && latestExecution) {
    for (const field of ["host", "run_id", "profile", "model", "reasoning_effort", "claimed_at"]) {
      if (stringValue(executionRecord?.[field]) !== stringValue(latestExecution[field])) {
        issues.push(`${prefix}: execution.${field} must match the latest execution history entry`);
      }
    }
    if (owner !== stringValue(latestExecution.by)) {
      issues.push(`${prefix}: owner must match the latest execution history actor`);
    }
    if (
      ["active", "submitted", "accepted"].includes(status)
      && stringValue(latestExecution.profile) !== requestedProfile
    ) {
      issues.push(`${prefix}: active execution profile must match routing.requested_profile`);
    }
  }
  if (!isIsoDateTime(stringValue(metadata.created_at))) {
    issues.push(`${prefix}: created_at must be an ISO date-time`);
  }
  if (!isIsoDateTime(stringValue(metadata.updated_at))) {
    issues.push(`${prefix}: updated_at must be an ISO date-time`);
  }

  for (const dependency of stringArray(metadata.dependencies)) {
    if (!knownWorkstreamIds.has(dependency)) {
      issues.push(`${prefix}: dependency is not a referenced workstream: ${dependency}`);
    }
    if (dependency === id) {
      issues.push(`${prefix}: workstream cannot depend on itself`);
    }
  }
  const scopedRepositories = new Set(stringArray(metadata.repositories));
  for (const repository of scopedRepositories) {
    if (!repositoryIds.has(repository)) {
      issues.push(`${prefix}: repository is outside the reconstruction: ${repository}`);
    }
  }

  const slice = recordValue(metadata.coverage_slice);
  issues.push(...coverageReferenceIssues({
    prefix,
    fieldPrefix: "coverage_slice",
    value: slice,
    scopeIndex,
    rawCaseIds,
    allowedRepositories: scopedRepositories,
  }));
  const explored = recordValue(metadata.explored_context);
  issues.push(...coverageReferenceIssues({
    prefix,
    fieldPrefix: "explored_context",
    value: explored,
    scopeIndex,
    rawCaseIds,
  }));
  const exploredCount = ["files", "communities", "surfaces", "raw_cases"]
    .reduce((total, field) => total + stringArray(explored?.[field]).length, 0);
  if (!Array.isArray(explored?.notes)) {
    issues.push(`${prefix}: explored_context.notes must be a list`);
  } else if (exploredCount > 0 && !nonEmptyStringArray(explored.notes)) {
    issues.push(
      `${prefix}: explored_context.notes must explain why analysis crossed the assigned slice`,
    );
  }
  const result = recordValue(metadata.result);
  if (!cancelled && !stringValue(result?.summary).trim()) {
    issues.push(`${prefix}: result.summary is required`);
  }
  const resultFields = [
    "candidate_ids",
    "evidence_refs",
    "uncertainties",
    "contradictions",
    "unexplained",
    "follow_up",
    ...(adaptiveRouting ? ["negative_claims", "authority_questions"] : []),
  ];
  for (const field of resultFields) {
    if (!cancelled && !Array.isArray(result?.[field])) {
      issues.push(`${prefix}: result.${field} must be a list`);
    }
  }
  if (!cancelled && stringArray(result?.evidence_refs).some((entry) => /(?:^|[/#])(?:raw|intake)(?:[/#:]|$)/i.test(entry))) {
    issues.push(`${prefix}: raw or intake material cannot be listed as independent evidence`);
  }
  const allowedEvidenceFiles = new Set([
    ...stringArray(slice?.files),
    ...stringArray(explored?.files),
  ]);
  for (const evidenceRef of cancelled ? [] : stringArray(result?.evidence_refs)) {
    const receipt = receiptIndex.get(evidenceRef);
    if (!receipt) {
      issues.push(
        `${prefix}: result.evidence_refs must reference a recorded source-read receipt: ${evidenceRef}`,
      );
      continue;
    }
    if (receipt.actor !== owner) {
      issues.push(
        `${prefix}: evidence receipt ${evidenceRef} belongs to ${receipt.actor}, not owner ${owner}`,
      );
    }
    if (!allowedEvidenceFiles.has(`${receipt.repository}#${receipt.path}`)) {
      issues.push(
        `${prefix}: evidence receipt ${evidenceRef} is outside the assigned or recorded explored files`,
      );
    }
  }

  const review = recordValue(metadata.review);
  const reviewHistory = adaptiveRouting ? recordArray(metadata.review_history) : [];
  if (adaptiveRouting && !Array.isArray(metadata.review_history)) {
    issues.push(`${prefix}: review_history must be a list`);
  } else if (
    adaptiveRouting
    && Array.isArray(metadata.review_history)
    && metadata.review_history.some((entry) => !isRecord(entry))
  ) {
    issues.push(`${prefix}: review_history entries must be records`);
  }
  for (const [index, reviewEvent] of reviewHistory.entries()) {
    const reviewPrefix = `${prefix}: review_history[${index}]`;
    if (positiveInteger(reviewEvent.attempt) === undefined) {
      issues.push(`${reviewPrefix}.attempt must be a positive integer`);
    }
    if (!["accepted", "rework", "cancelled"].includes(stringValue(reviewEvent.outcome))) {
      issues.push(`${reviewPrefix}.outcome must be accepted, rework, or cancelled`);
    }
    if (!stringValue(reviewEvent.by).trim()) {
      issues.push(`${reviewPrefix}.by is required`);
    }
    if (!isIsoDateTime(stringValue(reviewEvent.at))) {
      issues.push(`${reviewPrefix}.at must be an ISO date-time`);
    }
    if (!nonEmptyStringArray(reviewEvent.notes)) {
      issues.push(`${reviewPrefix}.notes must be a non-empty list`);
    }
  }
  if (adaptiveRouting && !cancelled && phase !== "submit") {
    const escalationTriggers = new Set(
      escalationHistory
        .filter((entry) => positiveInteger(entry.attempt) === attempt)
        .map((entry) => stringValue(entry.trigger)),
    );
    const requiredTriggers = new Set<string>();
    if (stringArray(result?.contradictions).length > 0) {
      requiredTriggers.add("contradiction");
    }
    if (stringArray(result?.unexplained).length > 0) {
      requiredTriggers.add("insufficient-evidence");
    }
    if (stringArray(result?.negative_claims).length > 0) {
      requiredTriggers.add("negative-claim");
    }
    if (exploredCount > 0) {
      requiredTriggers.add("cross-boundary-scope");
    }
    if (stringArray(result?.authority_questions).length > 0) {
      requiredTriggers.add("maintainer-authority");
    }
    if ((attempt ?? 1) > 1) {
      requiredTriggers.add("review-rework");
    }
    for (const trigger of requiredTriggers) {
      if (!escalationTriggers.has(trigger)) {
        issues.push(
          `${prefix}: ${trigger} requires a durable routing escalation before acceptance`,
        );
      }
    }
  }
  if (
    phase === "close"
    && (
      review?.status !== "accepted"
      || !stringValue(review.by).trim()
      || !isIsoDateTime(stringValue(review.at))
      || !nonEmptyStringArray(review.notes)
    )
  ) {
    issues.push(`${prefix}: review must be accepted with actor, time, and notes`);
  }
  if (phase === "close" && owner && owner === stringValue(review?.by)) {
    issues.push(`${prefix}: reviewer must differ from worker owner`);
  }
  if (adaptiveRouting && phase === "close") {
    const latestReview = reviewHistory.at(-1);
    const expectedOutcome = cancelled ? "cancelled" : "accepted";
    if (
      !latestReview
      || positiveInteger(latestReview.attempt) !== attempt
      || stringValue(latestReview.outcome) !== expectedOutcome
      || stringValue(latestReview.by) !== stringValue(review?.by)
      || stringValue(latestReview.at) !== stringValue(review?.at)
      || JSON.stringify(stringArray(latestReview.notes))
        !== JSON.stringify(stringArray(review?.notes))
    ) {
      issues.push(`${prefix}: review must match the latest durable review_history event`);
    }
  }
  if (!cancelled && /<[^>\n]+>/.test(body)) {
    issues.push(`${prefix}: template placeholders remain`);
  }
  return issues;
}

function coverageReferenceIssues(input: {
  prefix: string;
  fieldPrefix: string;
  value: Record<string, unknown> | undefined;
  scopeIndex: Map<string, ReconstructionScopeIndexEntry>;
  rawCaseIds: Set<string>;
  allowedRepositories?: Set<string>;
}): string[] {
  const issues: string[] = [];
  for (const field of ["files", "communities", "surfaces", "raw_cases"]) {
    if (!Array.isArray(input.value?.[field])) {
      issues.push(`${input.prefix}: ${input.fieldPrefix}.${field} must be a list`);
    }
  }
  for (const field of ["files", "communities", "surfaces"] as const) {
    for (const reference of stringArray(input.value?.[field])) {
      const separator = reference.indexOf("#");
      const repository = separator > 0 ? reference.slice(0, separator) : "";
      const item = separator > 0 ? reference.slice(separator + 1) : "";
      if (!repository || !item) {
        issues.push(
          `${input.prefix}: ${input.fieldPrefix}.${field} must use <repository>#<item>: ${reference}`,
        );
        continue;
      }
      if (
        input.allowedRepositories
        && !input.allowedRepositories.has(repository)
      ) {
        issues.push(
          `${input.prefix}: ${input.fieldPrefix}.${field} is outside the worker repository scope: ${reference}`,
        );
        continue;
      }
      const index = input.scopeIndex.get(repository);
      if (!index || !index[field].has(item)) {
        issues.push(
          `${input.prefix}: ${input.fieldPrefix}.${field} is outside the frozen frontier: ${reference}`,
        );
      }
    }
  }
  for (const rawCase of stringArray(input.value?.raw_cases)) {
    if (!input.rawCaseIds.has(rawCase)) {
      issues.push(
        `${input.prefix}: ${input.fieldPrefix}.raw_cases is not linked to this reconstruction: ${rawCase}`,
      );
    }
  }
  return issues;
}

export function reconstructionWorkstreamSetIssues(
  records: ReconstructionWorkstreamRecord[],
  metadata: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  for (const record of records) {
    if (!record.referenced) {
      issues.push(
        `orchestration workstream is present but not referenced: ${record.relativePath}`,
      );
    }
  }
  const byId = new Map<string, ReconstructionWorkstreamRecord>();
  for (const record of records) {
    const id = stringValue(record.document.metadata.id);
    if (!id) {
      continue;
    }
    if (byId.has(id)) {
      issues.push(`orchestration workstream id is duplicated: ${id}`);
    } else {
      byId.set(id, record);
    }
  }

  for (const [id, record] of byId) {
    const wave = positiveInteger(record.document.metadata.wave) ?? 0;
    for (const dependency of stringArray(record.document.metadata.dependencies)) {
      const dependencyRecord = byId.get(dependency);
      if (!dependencyRecord) {
        continue;
      }
      const dependencyWave = positiveInteger(dependencyRecord.document.metadata.wave) ?? 0;
      if (dependencyWave >= wave) {
        issues.push(
          `workstream ${id}: dependency ${dependency} must belong to an earlier wave`,
        );
      }
    }
    const routing = recordValue(record.document.metadata.routing);
    for (const escalation of recordArray(routing?.escalation_history)) {
      if (escalation.action !== "new-workstream") {
        continue;
      }
      const targetId = stringValue(escalation.target_workstream);
      const target = byId.get(targetId);
      if (target?.document.metadata.status === "cancelled") {
        issues.push(
          `workstream ${id}: escalation target ${targetId} cannot be cancelled`,
        );
      }
      if (
        target
        && (positiveInteger(target.document.metadata.wave) ?? 0) <= wave
      ) {
        issues.push(
          `workstream ${id}: escalation target ${targetId} must belong to a later wave`,
        );
      }
      if (
        target
        && !stringArray(target.document.metadata.dependencies).includes(id)
      ) {
        issues.push(
          `workstream ${id}: escalation target ${targetId} must depend on its originating workstream`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, chain: string[]): void => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      issues.push(`orchestration workstream dependency cycle: ${[...chain, id].join(" -> ")}`);
      return;
    }
    visiting.add(id);
    const record = byId.get(id);
    if (record) {
      for (const dependency of stringArray(record.document.metadata.dependencies)) {
        if (byId.has(dependency)) {
          visit(dependency, [...chain, id]);
        }
      }
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) {
    visit(id, []);
  }

  const orchestration = recordValue(metadata.orchestration);
  const synthesis = recordValue(orchestration?.synthesis);
  const review = recordValue(orchestration?.independent_review);
  const owners = new Set(
    records
      .map((record) => stringValue(record.document.metadata.owner))
      .filter(Boolean),
  );
  if (owners.has(stringValue(synthesis?.by))) {
    issues.push("orchestration synthesis actor must not be a worker owner");
  }
  if (owners.has(stringValue(review?.by))) {
    issues.push(
      "orchestration independent review actor must be fresh, not a workstream owner; record final assurance in the parent case",
    );
  }
  // A run id the host refused to expose is recorded as `unavailable:<why>`,
  // and every agent on that host records the same words. Comparing those
  // strings turns two unknowns into one shared known run and fails a review
  // that was genuinely independent — while an agent that invented a plausible
  // id would pass. Identity that was never issued cannot establish sameness.
  const identified = (value: string) => value !== "" && !value.startsWith("unavailable:");
  const reviewRunId = stringValue(review?.run_id);
  const reviewHostRun = `${stringValue(review?.host)}\u0000${reviewRunId}`;
  const workerHostRuns = new Set(
    records.flatMap((record) => {
      const routing = recordValue(record.document.metadata.routing);
      return recordArray(routing?.execution_history)
        .filter((execution) => identified(stringValue(execution.run_id)))
        .map((execution) =>
          `${stringValue(execution.host)}\u0000${stringValue(execution.run_id)}`
        );
    }),
  );
  if (
    stringValue(review?.assurance) !== "maintainer"
    && stringValue(review?.host)
    && identified(reviewRunId)
    && workerHostRuns.has(reviewHostRun)
  ) {
    issues.push(
      "orchestration independent review must use a host run distinct from every research workstream",
    );
  }
  return [...new Set(issues)];
}

function resolveWorkstreamPath(caseDirectory: string, input: string): string {
  if (!/^workstreams\/[a-z0-9][a-z0-9-]{0,95}\.md$/.test(input)) {
    throw new Error(
      `orchestration workstream must use workstreams/<stable-id>.md: ${input}`,
    );
  }
  const path = resolve(caseDirectory, input);
  const rel = relative(caseDirectory, path);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`orchestration workstream escapes the reconstruction case: ${input}`);
  }
  return path;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function nonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function isIsoDateTime(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Date.parse(value));
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}
