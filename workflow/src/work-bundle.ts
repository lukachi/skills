import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import type { RepositoryMetadata, WorkMode, WorkSpecDocument } from "./types.js";
import { discoveryLedgerIssues } from "./discovery-ledger.js";
import { readPark } from "./park.js";
import {
  acceptanceDrift,
  GATED_CHANGE_VERSIONS,
  includesVersion,
  isRecord,
  parseWorkSpec,
  repositoryAccountingIssues,
  resolveTodo,
  serializeWorkSpec,
  SUPPORTED_CHANGE_VERSIONS,
  SUPPORTED_ISSUE_VERSIONS,
  SUPPORTED_MAP_VERSION,
  SUPPORTED_REVIEW_VERSION,
  type TodoEdit,
} from "./work-spec.js";

export type WorkBundleStage = "shape" | "wayfind" | "implement" | "review" | "resume";
export type WorkIssuePhase = "wayfinding" | "delivery";
export type WorkIssueType =
  | "research"
  | "prototype"
  | "grilling"
  | "task"
  | "delivery";
export type WorkIssueStatus =
  | "draft"
  | "ready"
  | "claimed"
  | "completed"
  | "dropped";
export type BundleReviewStatus = "reviewed" | "irrelevant";
export type WorkCheckpointStatus = "ready" | "active" | "blocked" | "complete";
export type WorkCheckpointStage = "shape" | "wayfind" | "implement" | "review" | "complete";

export interface WorkCheckpointSummary {
  owner: "change" | "issue";
  path: string;
  issue?: string;
  status: WorkCheckpointStatus;
  stage: WorkCheckpointStage;
  actor: string;
  currentState: string;
  lastCompleted: string;
  nextAction: string;
  blockers: string[];
  /** Why this session stopped while work was available. Empty unless it said so. */
  handoff: string;
  todo: string[];
  updatedAt: string;
  valid: boolean;
  issues: string[];
}

export interface WorkIssueSummary {
  id: string;
  title: string;
  path: string;
  phase: WorkIssuePhase;
  type: WorkIssueType;
  status: WorkIssueStatus;
  blockedBy: string[];
  satisfies: string[];
  repositories: string[];
  artifacts: string[];
  claimed: boolean;
  /**
   * The actor recorded in the claim itself, not in the checkpoint beside it.
   * A checkpoint is rewritten by whoever refreshes it; the claim is written
   * once, by the actor taking the work, and is the only durable answer to who
   * holds it.
   */
  claimedBy: string;
  unblocked: boolean;
  frontier: boolean;
}

export interface BundleInventoryEntry {
  path: string;
  role: "change" | "map" | "issue" | "artifact" | "review" | "promotion" | "unknown";
  sha256: string;
  bytes: number;
  accounting: "reviewed" | "irrelevant" | "unseen" | "changed-after-review" | "invalid";
  reason: string;
}

export interface WorkBundleInspection {
  root: string;
  stage: WorkBundleStage;
  selectedIssue?: string;
  mode: string;
  mapStatus?: string;
  destination?: string;
  fog?: unknown[];
  resolved?: Record<string, unknown>[];
  inventory: BundleInventoryEntry[];
  requiredFiles: BundleInventoryEntry[];
  checkpoints: WorkCheckpointSummary[];
  issues: WorkIssueSummary[];
  frontier: string[];
  validationIssues: string[];
}

export interface UpdateWorkCheckpointOptions {
  bundleRoot: string;
  issueId?: string;
  actor: string;
  status: WorkCheckpointStatus;
  stage?: WorkCheckpointStage;
  currentState: string;
  lastCompleted?: string;
  nextAction: string;
  blockers?: string[];
  /**
   * Why this session stops while work is available and nothing is blocked.
   *
   * A blocker says the maintainer is what the work is missing, and it reaches
   * their queue. Nothing said the other thing — that the work is fine and this
   * session is the thing that has run out — so the only way to end such a turn
   * was to say nothing, and a turn that ends saying nothing is exactly what the
   * stop guard exists to catch. Recorded here it is a statement to the next
   * session, cleared by the next checkpoint, and never a question for anyone.
   */
  handoff?: string;
  /** How the carried list of small jobs changes. Omitted, it survives untouched. */
  todo?: TodoEdit;
  now?: Date;
}

export interface CreateWorkIssueOptions {
  bundleRoot: string;
  slug: string;
  title: string;
  phase: WorkIssuePhase;
  type: WorkIssueType;
  blockedBy?: string[];
  satisfies?: string[];
  repositories?: string[];
  artifacts?: string[];
  now?: Date;
  distributionRoot: string;
}

export interface ClaimWorkIssueOptions {
  bundleRoot: string;
  issueId: string;
  actor: string;
  source?: RepositoryMetadata;
  projectOnly: boolean;
  now?: Date;
}

export interface ResolveWorkIssueOptions {
  bundleRoot: string;
  issueId: string;
  summary: string;
  evidence: string[];
  now?: Date;
  claimContext: WorkIssueClaimContext;
}

export interface WorkIssueClaimContext {
  source?: RepositoryMetadata;
  allowProject: boolean;
}

interface ReviewReceipt {
  path: string;
  sha256: string;
  status: BundleReviewStatus;
  reason: string;
  reviewed_at: string;
}

interface ParsedIssue {
  path: string;
  document: WorkSpecDocument;
  summary: WorkIssueSummary;
}

const ISSUE_PATH = /^issues\/(ISSUE-\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const ACCEPTANCE_ID = /^AC-\d{2,}$/;

export async function initializeWorkBundle(
  bundleRoot: string,
  distributionRoot: string,
  mode: WorkMode,
  now = new Date(),
): Promise<void> {
  await mkdir(join(bundleRoot, "issues"), { recursive: false });
  await mkdir(join(bundleRoot, "artifacts"), { recursive: false });
  await writeTemplate(
    join(distributionRoot, "skills/manage-project-work/assets/bundle-review.md"),
    join(bundleRoot, "review.md"),
    (document) => {
      document.metadata.updated_at = now.toISOString();
    },
  );
  if (mode === "wayfinder") {
    await writeTemplate(
      join(distributionRoot, "skills/manage-project-work/assets/wayfinder-map.md"),
      join(bundleRoot, "map.md"),
      (document) => {
        document.metadata.created_at = now.toISOString();
        document.metadata.updated_at = now.toISOString();
      },
    );
  }
}

export function initializeDocumentCheckpoint(
  document: WorkSpecDocument,
  input: {
    status: WorkCheckpointStatus;
    stage: WorkCheckpointStage;
    actor: string;
    currentState: string;
    lastCompleted: string;
    nextAction: string;
    blockers?: string[];
    now: Date;
  },
): void {
  writeCheckpoint(document, input);
}

export async function updateBundleCheckpoint(
  options: UpdateWorkCheckpointOptions,
): Promise<WorkCheckpointSummary> {
  const now = options.now ?? new Date();
  let path: string;
  let document: WorkSpecDocument;
  let owner: WorkCheckpointSummary["owner"];
  let issue: string | undefined;
  let stage = options.stage;
  let status: WorkCheckpointStatus = options.status;

  if (options.issueId) {
    const parsed = await readIssueById(options.bundleRoot, options.issueId);
    path = parsed.path;
    document = parsed.document;
    owner = "issue";
    issue = parsed.summary.id;
    const expectedStage: WorkCheckpointStage = parsed.summary.phase === "wayfinding"
      ? "wayfind"
      : "implement";
    if (stage && stage !== expectedStage && stage !== "review") {
      throw new Error(
        `${parsed.summary.id} checkpoint stage must be ${expectedStage} or review`,
      );
    }
    stage = stage ?? expectedStage;
    if (["completed", "dropped"].includes(parsed.summary.status)) {
      status = "complete";
      stage = "complete";
    } else if (parsed.summary.status !== "claimed") {
      throw new Error(
        `${parsed.summary.id} must be claimed before recording an active checkpoint`,
      );
    } else {
      const claim = recordValue(parsed.document.metadata.claim);
      const claimedBy = stringValue(claim?.actor);
      if (claimedBy && normalizeActor(options.actor) !== claimedBy) {
        throw new Error(
          `${parsed.summary.id} is claimed by ${claimedBy}, not ${normalizeActor(options.actor)}`,
        );
      }
    }
  } else {
    path = join(options.bundleRoot, "change.md");
    document = parseWorkSpec(await readFile(path, "utf8"));
    owner = "change";
    if (status === "complete") {
      throw new Error("The change checkpoint becomes complete only when wfctl closes the bundle");
    }
    stage = stage ?? (document.metadata.mode === "wayfinder" ? "wayfind" : "shape");
  }

  const previous = checkpointRecord(document);
  writeCheckpoint(document, {
    status,
    stage: stage!,
    actor: normalizeActor(options.actor),
    currentState: requireCheckpointText(options.currentState, "current state"),
    lastCompleted: options.lastCompleted
      ? requireCheckpointText(options.lastCompleted, "last completed action")
      : requireCheckpointText(previous?.last_completed, "last completed action"),
    nextAction: requireCheckpointText(options.nextAction, "next action"),
    blockers: uniqueStrings(options.blockers ?? []),
    ...(options.handoff ? { handoff: options.handoff } : {}),
    // Carried forward unless edited. A checkpoint written without mentioning the
    // list must not silently empty it: every later checkpoint would then erase
    // the small jobs an earlier one recorded, which is the exact loss the list
    // exists to prevent.
    todo: resolveTodo(stringArray(previous?.todo), options.todo),
    now,
  });
  await writeFile(path, serializeWorkSpec(document), "utf8");
  return checkpointSummary(
    document,
    relativePath(options.bundleRoot, path),
    owner,
    issue,
    true,
  )!;
}

export async function inspectWorkBundle(
  bundleRoot: string,
  stage: WorkBundleStage,
  selectedIssue?: string,
): Promise<WorkBundleInspection> {
  const change = parseWorkSpec(await readFile(join(bundleRoot, "change.md"), "utf8"));
  const issueRead = await readIssuesForInspection(bundleRoot);
  const parsedIssues = issueRead.parsed;
  const validationIssues = [
    ...issueRead.errors,
    ...await validateBundle(bundleRoot, change, parsedIssues),
  ];
  const inventory = await bundleInventory(bundleRoot, validationIssues);
  const summaries = withGraphState(parsedIssues.map((entry) => entry.summary));
  const normalizedSelected = selectedIssue ? normalizeIssueId(selectedIssue) : undefined;
  if (normalizedSelected && !summaries.some((entry) => entry.id === normalizedSelected)) {
    validationIssues.push(`selected issue does not exist: ${normalizedSelected}`);
  }
  const requiredPaths = requiredPathsForStage(
    stage,
    normalizedSelected,
    parsedIssues,
    inventory,
  );
  const map = await optionalDocument(join(bundleRoot, "map.md"));
  const checkpoints = [
    checkpointSummary(
      change,
      "change.md",
      "change",
      undefined,
      Number(change.metadata.workflow_version) >= 4,
    ),
    ...parsedIssues
      .filter((entry) =>
        stage === "review" || requiredPaths.includes(relativeIssuePath(entry.path))
      )
      .map((entry) =>
        checkpointSummary(
          entry.document,
          relativeIssuePath(entry.path),
          "issue",
          entry.summary.id,
          Number(entry.document.metadata.workflow_version) >= 2,
        )
      ),
  ].filter((entry): entry is WorkCheckpointSummary => entry !== undefined);
  for (const checkpoint of checkpoints) {
    validationIssues.push(...checkpoint.issues);
  }
  return {
    root: bundleRoot,
    stage,
    ...(normalizedSelected ? { selectedIssue: normalizedSelected } : {}),
    mode: stringValue(change.metadata.mode),
    ...(map ? { mapStatus: stringValue(map.metadata.status) } : {}),
    ...(map ? { destination: stringValue(map.metadata.destination) } : {}),
    ...(map ? { fog: Array.isArray(map.metadata.fog) ? map.metadata.fog : [] } : {}),
    ...(map ? { resolved: recordArray(map.metadata.resolved) } : {}),
    inventory,
    requiredFiles: requiredPaths
      .map((path) => inventory.find((entry) => entry.path === path))
      .filter((entry): entry is BundleInventoryEntry => entry !== undefined),
    checkpoints,
    issues: summaries,
    frontier: summaries.filter((entry) => entry.frontier).map((entry) => entry.id),
    validationIssues: [...new Set(validationIssues)].sort(),
  };
}

export async function createWorkIssue(
  options: CreateWorkIssueOptions,
): Promise<WorkIssueSummary> {
  const change = parseWorkSpec(await readFile(join(options.bundleRoot, "change.md"), "utf8"));
  const existing = await readIssues(options.bundleRoot);
  const id = nextIssueId(existing.map((entry) => entry.summary.id));
  const slug = normalizeSlug(options.slug);
  const path = join(options.bundleRoot, "issues", `${id}-${slug}.md`);
  const blockedBy = uniqueStrings(options.blockedBy ?? []).map(normalizeIssueId);
  const satisfies = uniqueStrings(options.satisfies ?? []).map(normalizeAcceptanceId);
  const repositories = uniqueStrings(options.repositories ?? []);
  const artifacts = uniqueStrings(options.artifacts ?? []).map(normalizeArtifactPath);
  if (!options.title.trim()) {
    throw new Error("Issue title must not be empty");
  }
  if (options.phase === "wayfinding" && change.metadata.mode !== "wayfinder") {
    throw new Error("Wayfinding issues require an active Wayfinder map");
  }
  if (options.phase === "delivery" && change.metadata.mode === "wayfinder") {
    throw new Error("Delivery issues cannot be created before Wayfinder is finished");
  }
  if (options.phase === "wayfinding" && satisfies.length > 0) {
    throw new Error("Wayfinding issues resolve questions; they do not satisfy delivery acceptance IDs");
  }
  const knownAcceptance = new Set(acceptanceCriteria(change).map((entry) => entry.id));
  for (const acceptance of satisfies) {
    if (!knownAcceptance.has(acceptance)) {
      throw new Error(`Unknown acceptance criterion: ${acceptance}`);
    }
  }
  const knownRepositories = new Set(
    recordArray(change.metadata.repositories).map((entry) => stringValue(entry.repository)),
  );
  for (const repository of repositories) {
    if (!knownRepositories.has(repository)) {
      throw new Error(`Repository is outside the change scope: ${repository}`);
    }
  }
  if (options.phase === "delivery" && knownRepositories.size > 0 && repositories.length === 0) {
    throw new Error("A source-scoped delivery issue must declare at least one repository");
  }
  for (const artifact of artifacts) {
    await access(resolveBundleFile(options.bundleRoot, artifact), constants.R_OK);
  }
  const knownIssueIds = new Set(existing.map((entry) => entry.summary.id));
  for (const blocker of blockedBy) {
    if (!knownIssueIds.has(blocker)) {
      throw new Error(`Unknown blocking issue: ${blocker}`);
    }
    if (existing.find((entry) => entry.summary.id === blocker)?.summary.phase !== options.phase) {
      throw new Error(`Blocking issue must be in the same phase: ${blocker}`);
    }
  }
  if (options.phase === "wayfinding" && options.type === "delivery") {
    throw new Error("Wayfinding issues cannot use the delivery type");
  }
  if (options.phase === "delivery" && options.type !== "delivery" && options.type !== "task") {
    throw new Error("Delivery-phase issues must use delivery or task type");
  }
  const now = options.now ?? new Date();
  await writeTemplate(
    join(options.distributionRoot, "skills/manage-project-work/assets/work-issue.md"),
    path,
    (document) => {
      document.metadata.id = id;
      document.metadata.title = options.title;
      document.metadata.phase = options.phase;
      document.metadata.type = options.type;
      document.metadata.status = "ready";
      document.metadata.blocked_by = blockedBy;
      document.metadata.satisfies = satisfies;
      document.metadata.repositories = repositories;
      document.metadata.artifacts = artifacts;
      document.metadata.created_at = now.toISOString();
      document.metadata.updated_at = now.toISOString();
      initializeDocumentCheckpoint(document, {
        status: "ready",
        stage: options.phase === "wayfinding" ? "wayfind" : "implement",
        actor: "system:wfctl",
        currentState: blockedBy.length > 0
          ? `Issue is unclaimed and depends on ${blockedBy.join(", ")}.`
          : "Issue is ready but unclaimed.",
        lastCompleted: "Issue record created.",
        nextAction: blockedBy.length > 0
          ? "Complete the declared dependencies, then review and claim this issue."
          : "Read the required context and claim the issue.",
        blockers: [],
        now,
      });
    },
  );
  const parsed = await parseIssueFile(options.bundleRoot, relativePath(options.bundleRoot, path));
  return withGraphState([...existing.map((entry) => entry.summary), parsed.summary])
    .find((entry) => entry.id === id)!;
}

export async function claimWorkIssue(
  options: ClaimWorkIssueOptions,
): Promise<WorkIssueSummary> {
  const id = normalizeIssueId(options.issueId);
  const issues = await readIssues(options.bundleRoot);
  const graph = withGraphState(issues.map((entry) => entry.summary));
  const current = graph.find((entry) => entry.id === id);
  const parsed = issues.find((entry) => entry.summary.id === id);
  if (!current || !parsed) {
    throw new Error(`Work issue not found: ${id}`);
  }
  // First of every gate, deliberately. A parked bundle is not startable however
  // well approved, how ready the issue, or how completely the context was read,
  // so checking it after that work makes the agent do the reading before being
  // told it may not proceed — and reads as an obstacle rather than a decision.
  //
  // Approval settles what the work is; the park settles that it does not begin.
  // They were one signal until a bundle approved to clear the maintainer's queue
  // read as a bundle cleared to run, and six commits landed in three source
  // repositories the knowledge base still cites as current.
  await requireNotParked(options.bundleRoot);
  if (current.status !== "ready") {
    throw new Error(`Work issue ${id} is ${current.status}, not ready`);
  }
  if (!current.unblocked) {
    throw new Error(`Work issue ${id} is blocked by unresolved dependencies`);
  }
  if (current.phase === "delivery" && !options.projectOnly && !options.source) {
    throw new Error("A source-scoped delivery issue must be claimed from a bound leaf checkout");
  }
  if (current.phase === "delivery" && options.source && current.repositories.length > 0
    && !current.repositories.includes(options.source.repository)) {
    throw new Error(
      `Work issue ${id} is not scoped to repository ${options.source.repository}`,
    );
  }
  const context = await inspectWorkBundle(
    options.bundleRoot,
    current.phase === "wayfinding" ? "wayfind" : "implement",
    id,
  );
  if (context.validationIssues.length > 0) {
    throw new Error(`Claim is blocked by invalid bundle state: ${context.validationIssues.join("; ")}`);
  }
  const unread = context.requiredFiles.filter((entry) => entry.accounting !== "reviewed");
  if (unread.length > 0) {
    throw new Error(
      `Claim is blocked until required context is reviewed at its current hash: ${
        unread.map((entry) => `${entry.path} (${entry.accounting})`).join(", ")
      }`,
    );
  }
  // Last, deliberately: the agent must have read the bundle before it can put
  // the framing decision to the maintainer, and asking earlier would send them
  // a question nobody has done the reading for.
  if (current.phase === "delivery") {
    await requireApprovedFraming(options.bundleRoot, id);
  }
  const lockPath = claimLockPath(options.bundleRoot, id);
  await mkdir(join(options.bundleRoot, "..", "..", "..", ".workflow", "current", "work-claims", basename(options.bundleRoot)), {
    recursive: true,
  });
  const now = options.now ?? new Date();
  const claim = options.source
    ? {
      actor: normalizeActor(options.actor),
      repository: options.source.repository,
      checkout: options.source.checkout,
      branch: options.source.branch,
      commit: options.source.commit,
      worktree_id: options.source.worktreeId,
      claimed_at: now.toISOString(),
    }
    : {
      actor: normalizeActor(options.actor),
      repository: "project",
      checkout: "knowledge",
      branch: "",
      commit: "",
      worktree_id: "knowledge",
      claimed_at: now.toISOString(),
    };
  await writeFile(lockPath, `${JSON.stringify(claim, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    parsed.document.metadata.status = "claimed";
    parsed.document.metadata.claim = claim;
    writeCheckpoint(parsed.document, {
      status: "active",
      stage: current.phase === "wayfinding" ? "wayfind" : "implement",
      actor: stringValue(claim.actor),
      currentState: "Issue is claimed and ready for execution.",
      lastCompleted: stringValue(checkpointRecord(parsed.document)?.last_completed)
        || "Required context reviewed and issue claimed.",
      nextAction: current.phase === "wayfinding"
        ? "Resolve this one bounded Wayfinder question and persist the answer."
        : "Implement the next behavior-first step within this issue scope.",
      blockers: [],
      now,
    });
    await writeFile(parsed.path, serializeWorkSpec(parsed.document), "utf8");
  } catch (error) {
    await removeFile(lockPath);
    throw error;
  }
  return (await readIssueById(options.bundleRoot, id)).summary;
}

export async function releaseWorkIssue(
  bundleRoot: string,
  issueId: string,
  claimContext: WorkIssueClaimContext,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const parsed = await readIssueById(bundleRoot, issueId);
  if (parsed.summary.status !== "claimed") {
    throw new Error(`Work issue ${parsed.summary.id} is not claimed`);
  }
  assertClaimContext(parsed, claimContext);
  parsed.document.metadata.status = "ready";
  parsed.document.metadata.claim = null;
  writeCheckpoint(parsed.document, {
    status: "ready",
    stage: parsed.summary.phase === "wayfinding" ? "wayfind" : "implement",
    actor: "system:wfctl",
    currentState: "Issue claim was released; the issue is ready for another session.",
    lastCompleted: "Previous claim released without completing the issue.",
    nextAction: "Read the current context and claim the issue before continuing.",
    blockers: [],
    now,
  });
  await writeFile(parsed.path, serializeWorkSpec(parsed.document), "utf8");
  await removeFile(claimLockPath(bundleRoot, parsed.summary.id));
  return (await readIssueById(bundleRoot, parsed.summary.id)).summary;
}

export async function resolveWorkIssue(
  options: ResolveWorkIssueOptions,
): Promise<WorkIssueSummary> {
  const parsed = await readIssueById(options.bundleRoot, options.issueId);
  if (parsed.summary.status !== "claimed") {
    throw new Error(`Work issue ${parsed.summary.id} must be claimed before completion`);
  }
  assertClaimContext(parsed, options.claimContext);
  if (!options.summary.trim()) {
    throw new Error("Issue resolution summary must not be empty");
  }
  const evidence = uniqueStrings(options.evidence);
  if (evidence.length === 0) {
    throw new Error("Issue completion requires at least one evidence entry");
  }
  const now = options.now ?? new Date();
  const completedClaim = recordValue(parsed.document.metadata.claim);
  parsed.document.metadata.status = "completed";
  parsed.document.metadata.claim = null;
  parsed.document.metadata.resolution = {
    summary: options.summary.trim(),
    evidence,
    completed_at: now.toISOString(),
    ...(completedClaim ? { claim: completedClaim } : {}),
  };
  writeCheckpoint(parsed.document, {
    status: "complete",
    stage: "complete",
    actor: stringValue(completedClaim?.actor) || "system:wfctl",
    currentState: `Issue completed: ${options.summary.trim()}`,
    lastCompleted: options.summary.trim(),
    nextAction: "Return to the parent bundle and select or create the next frontier item.",
    blockers: [],
    now,
  });
  await writeFile(parsed.path, serializeWorkSpec(parsed.document), "utf8");
  await removeFile(claimLockPath(options.bundleRoot, parsed.summary.id));
  if (parsed.summary.phase === "wayfinding") {
    await appendMapResolution(
      options.bundleRoot,
      parsed.summary.id,
      parsed.summary.title,
      options.summary.trim(),
      now,
    );
  }
  return (await readIssueById(options.bundleRoot, parsed.summary.id)).summary;
}

/**
 * A completed issue whose result no longer exists.
 *
 * Completion was terminal with no way back, and that is right while the work
 * stands. It stops being right the moment the work is undone: five issues in one
 * bundle read `completed` after every commit they produced was reverted out of
 * every source tree, and nothing in the record said so. A bundle that carries
 * five finished issues and no finished work is the exact silence this workflow
 * exists to remove — the next session reads the route as five-sixths done.
 *
 * Reopening keeps the completion rather than erasing it. What was claimed, when
 * it was resolved and on what evidence stays readable under `reopened`, because
 * the fact that this was once believed finished is part of the record: someone
 * has to be able to see that the evidence was accepted and then withdrawn.
 *
 * A dropped issue is not reopenable. Dropping is a deliberate removal from the
 * route, and putting one back is creating an issue, not undoing an outcome.
 */
export async function reopenWorkIssue(
  bundleRoot: string,
  issueId: string,
  reason: string,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const parsed = await readIssueById(bundleRoot, issueId);
  if (parsed.summary.status === "dropped") {
    throw new Error(
      `Work issue ${parsed.summary.id} was dropped from the route; create a new issue rather `
        + "than undoing a removal",
    );
  }
  if (parsed.summary.status !== "completed") {
    throw new Error(
      `Work issue ${parsed.summary.id} is ${parsed.summary.status}, not completed; `
        + "release it if it is claimed",
    );
  }
  if (!reason.trim()) {
    throw new Error(
      "Reopening requires a reason. An issue that returned to the route for no stated "
        + "reason cannot be told from one that was never finished.",
    );
  }
  const withdrawn = recordValue(parsed.document.metadata.resolution);
  parsed.document.metadata.status = "ready";
  parsed.document.metadata.resolution = null;
  parsed.document.metadata.reopened = {
    at: now.toISOString(),
    reason: reason.trim(),
    ...(withdrawn ? { withdrawn_resolution: withdrawn } : {}),
  };
  writeCheckpoint(parsed.document, {
    status: "ready",
    stage: parsed.summary.phase === "wayfinding" ? "wayfind" : "implement",
    actor: "system:wfctl",
    currentState: `Reopened: ${reason.trim()}`,
    lastCompleted: "The completion this issue carried was withdrawn.",
    nextAction: "Claim it again from the bound checkout when the bundle is released.",
    blockers: [],
    now,
  });
  await writeFile(parsed.path, serializeWorkSpec(parsed.document), "utf8");
  return (await readIssueById(bundleRoot, parsed.summary.id)).summary;
}

export async function dropWorkIssue(
  bundleRoot: string,
  issueId: string,
  reason: string,
  claimContext: WorkIssueClaimContext,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const parsed = await readIssueById(bundleRoot, issueId);
  if (parsed.summary.status === "completed" || parsed.summary.status === "dropped") {
    throw new Error(`Work issue ${parsed.summary.id} is already terminal`);
  }
  if (!reason.trim()) {
    throw new Error("Dropping an issue requires a reason");
  }
  if (parsed.summary.status === "claimed") {
    assertClaimContext(parsed, claimContext);
  }
  const droppedClaim = recordValue(parsed.document.metadata.claim);
  parsed.document.metadata.status = "dropped";
  parsed.document.metadata.claim = null;
  parsed.document.metadata.resolution = {
    summary: reason.trim(),
    evidence: [],
    completed_at: now.toISOString(),
    ...(droppedClaim ? { claim: droppedClaim } : {}),
  };
  writeCheckpoint(parsed.document, {
    status: "complete",
    stage: "complete",
    actor: stringValue(droppedClaim?.actor) || "system:wfctl",
    currentState: `Issue dropped: ${reason.trim()}`,
    lastCompleted: "Issue explicitly removed from the active frontier.",
    nextAction: "Return to the parent bundle and reassess the remaining frontier.",
    blockers: [],
    now,
  });
  await writeFile(parsed.path, serializeWorkSpec(parsed.document), "utf8");
  await removeFile(claimLockPath(bundleRoot, parsed.summary.id));
  return (await readIssueById(bundleRoot, parsed.summary.id)).summary;
}

export async function setWorkIssueBlocker(
  bundleRoot: string,
  issueId: string,
  blockerId: string,
  blocked: boolean,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const issue = await readIssueById(bundleRoot, issueId);
  const blocker = await readIssueById(bundleRoot, blockerId);
  if (["completed", "dropped"].includes(issue.summary.status)) {
    throw new Error(`Cannot change dependencies of terminal issue ${issue.summary.id}`);
  }
  if (issue.summary.id === blocker.summary.id) {
    throw new Error("An issue cannot block itself");
  }
  if (issue.summary.phase !== blocker.summary.phase) {
    throw new Error("Blocking issues must be in the same phase");
  }
  const next = blocked
    ? uniqueStrings([...issue.summary.blockedBy, blocker.summary.id])
    : issue.summary.blockedBy.filter((id) => id !== blocker.summary.id);
  const all = (await readIssues(bundleRoot)).map((entry) =>
    entry.summary.id === issue.summary.id
      ? { ...entry.summary, blockedBy: next }
      : entry.summary
  );
  const cycles = dependencyCycles(all);
  if (cycles.length > 0) {
    throw new Error(`Dependency update would create a cycle: ${cycles[0]!.join(" -> ")}`);
  }
  issue.document.metadata.blocked_by = next;
  const claimed = issue.summary.status === "claimed";
  writeCheckpoint(issue.document, {
    status: claimed && next.length > 0 ? "blocked" : claimed ? "active" : "ready",
    stage: issue.summary.phase === "wayfinding" ? "wayfind" : "implement",
    actor: stringValue(recordValue(issue.document.metadata.claim)?.actor) || "system:wfctl",
    currentState: next.length > 0
      ? `Issue depends on ${next.join(", ")}.`
      : claimed
      ? "Issue is claimed with no unresolved dependency blocker."
      : "Issue is ready but unclaimed.",
    lastCompleted: blocked
      ? `Added dependency ${blocker.summary.id}.`
      : `Removed dependency ${blocker.summary.id}.`,
    nextAction: next.length > 0
      ? "Resolve the declared dependencies before continuing this issue."
      : claimed
      ? "Continue the claimed issue and refresh the checkpoint after material work."
      : "Review the required context and claim the issue.",
    blockers: claimed ? next : [],
    now,
  });
  await writeFile(issue.path, serializeWorkSpec(issue.document), "utf8");
  return (await readIssueById(bundleRoot, issue.summary.id)).summary;
}

export async function reviewBundleFile(
  bundleRoot: string,
  inputPath: string,
  status: BundleReviewStatus,
  reason: string,
  now = new Date(),
): Promise<BundleInventoryEntry> {
  const normalized = normalizeBundlePath(inputPath);
  if (normalized === "review.md") {
    throw new Error("review.md cannot review itself");
  }
  const role = roleForPath(normalized);
  if (role === "unknown" || role === "review") {
    throw new Error(`Unsupported bundle file: ${normalized}`);
  }
  if (status === "irrelevant" && role !== "artifact") {
    throw new Error("Only supporting artifacts may be marked irrelevant");
  }
  if (status === "irrelevant" && !reason.trim()) {
    throw new Error("An irrelevant artifact requires a reason");
  }
  const absolute = resolveBundleFile(bundleRoot, normalized);
  const content = await readFile(absolute);
  const reviewPath = join(bundleRoot, "review.md");
  const review = parseWorkSpec(await readFile(reviewPath, "utf8"));
  const receipts = reviewReceipts(review);
  const receipt: ReviewReceipt = {
    path: normalized,
    sha256: sha256(content),
    status,
    reason: reason.trim(),
    reviewed_at: now.toISOString(),
  };
  review.metadata.files = [
    ...receipts.filter((entry) => entry.path !== normalized),
    receipt,
  ].sort((left, right) => left.path.localeCompare(right.path));
  review.metadata.updated_at = now.toISOString();
  await writeFile(reviewPath, serializeWorkSpec(review), "utf8");
  const inspection = await inspectWorkBundle(bundleRoot, "review");
  return inspection.inventory.find((entry) => entry.path === normalized)!;
}

export async function carryForwardCloseReview(
  bundleRoot: string,
  now = new Date(),
): Promise<BundleInventoryEntry> {
  return await reviewBundleFile(
    bundleRoot,
    "change.md",
    "reviewed",
    "Workflow-owned close metadata applied after the completed bundle gate passed.",
    now,
  );
}

export async function finishWayfinder(
  bundleRoot: string,
  deliveryMode: Exclude<WorkMode, "wayfinder">,
  now = new Date(),
): Promise<{ mapPath: string; changePath: string; mode: string }> {
  const mapPath = join(bundleRoot, "map.md");
  const map = parseWorkSpec(await readFile(mapPath, "utf8"));
  const changePath = join(bundleRoot, "change.md");
  const change = parseWorkSpec(await readFile(changePath, "utf8"));
  if (change.metadata.mode !== "wayfinder") {
    throw new Error("The active change is not in Wayfinder mode");
  }
  if (!stringValue(map.metadata.destination).trim()) {
    throw new Error("Wayfinder destination is empty");
  }
  if (!Array.isArray(map.metadata.fog)) {
    throw new Error("Wayfinder fog must be an array");
  }
  if (map.metadata.fog.length > 0) {
    throw new Error("Wayfinder still contains not-yet-specified fog");
  }
  const issues = await readIssues(bundleRoot);
  const unfinished = issues
    .filter((entry) => entry.summary.phase === "wayfinding")
    .filter((entry) => !["completed", "dropped"].includes(entry.summary.status));
  if (unfinished.length > 0) {
    throw new Error(
      `Wayfinder has unfinished issues: ${unfinished.map((entry) => entry.summary.id).join(", ")}`,
    );
  }
  if (issues.some((entry) => entry.summary.phase === "delivery")) {
    throw new Error("Delivery issues must be created after Wayfinder is synthesized into the spec");
  }
  const wayfindingIssues = issues.filter((entry) => entry.summary.phase === "wayfinding");
  if (wayfindingIssues.length === 0) {
    throw new Error("Wayfinder has no resolved route issues; use ordinary shaping instead");
  }
  const acceptance = acceptanceCriteria(change);
  if (acceptance.length === 0) {
    throw new Error("Synthesize the map into stable acceptance criteria before finishing Wayfinder");
  }
  // The map becomes the delivery contract here, so this is the last moment the
  // repositories it will be built in can still change what it says.
  const unaccounted = repositoryAccountingIssues(change);
  if (unaccounted.length > 0) {
    throw new Error(
      `Wayfinder finish is blocked until every bound repository is accounted for: ${
        unaccounted.join("; ")
      }`,
    );
  }
  const inspection = await inspectWorkBundle(bundleRoot, "review");
  if (inspection.validationIssues.length > 0) {
    throw new Error(
      `Wayfinder finish is blocked by invalid bundle state: ${inspection.validationIssues.join("; ")}`,
    );
  }
  const unread = inspection.requiredFiles.filter((entry) =>
    entry.accounting !== "reviewed" && entry.accounting !== "irrelevant"
  );
  if (unread.length > 0) {
    throw new Error(
      `Wayfinder finish is blocked until every bundle file is reviewed at its current hash: ${
        unread.map((entry) => `${entry.path} (${entry.accounting})`).join(", ")
      }`,
    );
  }
  const nowIso = now.toISOString();
  map.metadata.status = "resolved";
  map.metadata.resolved_at = nowIso;
  map.metadata.updated_at = nowIso;
  change.metadata.mode = deliveryMode;
  change.metadata.status = "shaping";
  change.metadata.direction = {
    status: "resolved",
    map: "map.md",
    resolved_at: nowIso,
  };
  writeCheckpoint(change, {
    status: "active",
    stage: "shape",
    actor: "system:wfctl",
    currentState: "Wayfinder is resolved and the bounded delivery specification is active.",
    lastCompleted: "Direction map synthesized into stable acceptance criteria.",
    nextAction: "Review the bounded specification and prepare the delivery frontier.",
    blockers: [],
    now,
  });
  await writeFile(mapPath, serializeWorkSpec(map), "utf8");
  await writeFile(changePath, serializeWorkSpec(change), "utf8");
  return { mapPath, changePath, mode: deliveryMode };
}

export async function bundleCompletionIssues(
  bundleRoot: string,
  change: WorkSpecDocument,
): Promise<string[]> {
  if (!includesVersion(GATED_CHANGE_VERSIONS, change.metadata.workflow_version)) {
    return [];
  }
  const issues: string[] = [];
  const issueRead = await readIssuesForInspection(bundleRoot);
  const parsedIssues = issueRead.parsed;
  issues.push(...issueRead.errors);
  issues.push(...await validateBundle(bundleRoot, change, parsedIssues));
  if (change.metadata.mode === "wayfinder") {
    issues.push("Wayfinder must be synthesized into full or slice delivery mode");
  }
  const map = await optionalDocument(join(bundleRoot, "map.md"));
  if (map && map.metadata.status !== "resolved") {
    issues.push("map.md status must be resolved before completed closure");
  }
  const criteria = acceptanceCriteria(change);
  if (criteria.length === 0) {
    issues.push("acceptance must contain at least one stable criterion");
  }
  for (const criterion of criteria) {
    if (criterion.status !== "verified") {
      issues.push(`acceptance ${criterion.id} must be verified`);
    }
  }
  const verification = recordValue(change.metadata.verification);
  const receipts = recordArray(verification?.acceptance);
  const receiptIds = receipts.map((entry) => stringValue(entry.id));
  if (new Set(receiptIds).size !== receiptIds.length) {
    issues.push("verification.acceptance IDs must be unique");
  }
  for (const receiptId of receiptIds) {
    if (!criteria.some((criterion) => criterion.id === receiptId)) {
      issues.push(`verification.acceptance is outside current scope: ${receiptId}`);
    }
  }
  for (const criterion of criteria) {
    const receipt = receipts.find((entry) => entry.id === criterion.id);
    if (!receipt || receipt.result !== "passed" || !nonEmptyStringArray(receipt.evidence)) {
      issues.push(`verification.acceptance must contain passed evidence for ${criterion.id}`);
    }
  }
  const deliveryIssues = parsedIssues.filter((entry) => entry.summary.phase === "delivery");
  for (const entry of parsedIssues) {
    if (!["completed", "dropped"].includes(entry.summary.status)) {
      issues.push(`${entry.summary.id} is not completed or dropped`);
    }
    if (entry.summary.claimed) {
      issues.push(`${entry.summary.id} still has an active claim`);
    }
  }
  if (deliveryIssues.length > 0) {
    const covered = new Set(
      deliveryIssues
        .filter((entry) => entry.summary.status !== "dropped")
        .flatMap((entry) => entry.summary.satisfies),
    );
    for (const criterion of criteria) {
      if (!covered.has(criterion.id)) {
        issues.push(`acceptance ${criterion.id} is not covered by a delivery issue`);
      }
    }
  }
  issues.push(...driftIssues(change, parsedIssues));
  const inspection = await inspectWorkBundle(bundleRoot, "review");
  for (const checkpoint of inspection.checkpoints) {
    issues.push(...checkpoint.issues);
  }
  for (const entry of inspection.inventory) {
    if (entry.role === "review") {
      continue;
    }
    if (entry.accounting !== "reviewed" && entry.accounting !== "irrelevant") {
      issues.push(`${entry.path} is ${entry.accounting} in bundle review`);
    }
  }
  return [...new Set(issues)];
}

/**
 * Delivery that no longer matches the framing, and the one thing at closure that
 * is still the maintainer's to decide.
 *
 * Closing is otherwise arithmetic: the criteria are verified, the receipts carry
 * evidence, the revisions are pinned, every issue is terminal. None of that needs
 * a person, and putting one in front of it cost an unattended night half its
 * work. What does need a person is the case where the arithmetic passes against
 * criteria that are not the ones they agreed to — reworded since, or delivered
 * with a piece of the route dropped. Then the gate reopens, and the same
 * completion approval that used to be routine becomes the exception it should
 * always have been.
 *
 * A dropped issue counts whatever the criteria say, because dropping is scope
 * leaving the route by the agent's own hand. The last bundle to do it dropped the
 * issue that proved the refusal and reported the bundle as delivered.
 */
export function driftIssues(
  change: WorkSpecDocument,
  parsedIssues: readonly ParsedIssue[],
): string[] {
  const dropped = parsedIssues
    .filter((entry) => entry.summary.status === "dropped")
    .map((entry) => entry.summary.title || entry.summary.id);
  const reasons = [
    ...acceptanceDrift(change),
    ...(dropped.length > 0
      ? [`work was dropped from the route rather than delivered: ${dropped.join("; ")}`]
      : []),
  ];
  if (reasons.length === 0) {
    return [];
  }
  const review = recordValue(change.metadata.maintainer_review);
  if (stringValue(recordValue(review?.completion)?.status) === "approved") {
    return [];
  }
  return [
    `delivery no longer matches the approved framing (${
      reasons.join("; ")
    }), so closing it is the maintainer's decision again: render it with wfctl work ask `
    + "<id> --stage completion, put it to them, and record their answer with wfctl work "
    + "approve <id> --stage completion",
  ];
}

async function validateBundle(
  bundleRoot: string,
  change: WorkSpecDocument,
  parsedIssues: ParsedIssue[],
): Promise<string[]> {
  const issues: string[] = [];
  const files = await walkFiles(bundleRoot);
  for (const file of files) {
    if (file.symlink) {
      issues.push(`${file.path}: symlinks are not allowed in a work bundle`);
    }
    if (roleForPath(file.path) === "unknown") {
      issues.push(`${file.path}: unknown bundle file location`);
    }
  }
  for (const required of ["change.md", "review.md"]) {
    if (!files.some((entry) => entry.path === required)) {
      issues.push(`${required}: required bundle file is missing`);
    }
  }
  if (!includesVersion(SUPPORTED_CHANGE_VERSIONS, change.metadata.workflow_version)) {
    issues.push("change.md: unsupported workflow_version");
  }
  issues.push(...discoveryLedgerIssues(
    change.body,
    "change.md",
    Number(change.metadata.workflow_version) >= 5,
  ));
  const repositoryIds = new Set(
    recordArray(change.metadata.repositories).map((entry) => stringValue(entry.repository)),
  );
  const criteria = acceptanceCriteria(change);
  const criterionIds = new Set(criteria.map((entry) => entry.id));
  if (criterionIds.size !== criteria.length) {
    issues.push("change.md: acceptance IDs must be unique");
  }
  for (const criterion of criteria) {
    if (!['pending', 'verified'].includes(criterion.status)) {
      issues.push(`${criterion.id}: acceptance status must be pending or verified`);
    }
  }
  const ids = new Set(parsedIssues.map((entry) => entry.summary.id));
  if (ids.size !== parsedIssues.length) {
    issues.push("issues/: issue IDs must be unique");
  }
  for (const entry of parsedIssues) {
    const summary = entry.summary;
    for (const blocker of summary.blockedBy) {
      if (!ids.has(blocker)) {
        issues.push(`${summary.id}: unknown blocker ${blocker}`);
      }
      if (blocker === summary.id) {
        issues.push(`${summary.id}: an issue cannot block itself`);
      }
    }
    for (const acceptance of summary.satisfies) {
      if (!criterionIds.has(acceptance)) {
        issues.push(`${summary.id}: unknown acceptance criterion ${acceptance}`);
      }
    }
    for (const repository of summary.repositories) {
      if (!repositoryIds.has(repository)) {
        issues.push(`${summary.id}: repository is outside work scope: ${repository}`);
      }
    }
    for (const artifact of summary.artifacts) {
      if (!files.some((file) => file.path === artifact)) {
        issues.push(`${summary.id}: referenced artifact does not exist: ${artifact}`);
      }
    }
    if (summary.status === "claimed" && !recordValue(entry.document.metadata.claim)) {
      issues.push(`${summary.id}: claimed status requires claim metadata`);
    }
    if (summary.status !== "claimed" && recordValue(entry.document.metadata.claim)) {
      issues.push(`${summary.id}: only a claimed issue may retain claim metadata`);
    }
    if (summary.status === "completed") {
      const resolution = recordValue(entry.document.metadata.resolution);
      if (!stringValue(resolution?.summary).trim()) {
        issues.push(`${summary.id}: completed issue requires a resolution summary`);
      }
      if (!nonEmptyStringArray(resolution?.evidence)) {
        issues.push(`${summary.id}: completed issue requires evidence`);
      }
      for (const blocker of summary.blockedBy) {
        if (parsedIssues.find((candidate) => candidate.summary.id === blocker)?.summary.status !== "completed") {
          issues.push(`${summary.id}: completed issue has unresolved blocker ${blocker}`);
        }
      }
    }
    if (!includesVersion(SUPPORTED_ISSUE_VERSIONS, entry.document.metadata.workflow_version)) {
      issues.push(
        `${summary.id}: workflow_version must be ${SUPPORTED_ISSUE_VERSIONS.join(", ")}`,
      );
    }
    issues.push(...discoveryLedgerIssues(
      entry.document.body,
      summary.id,
      Number(entry.document.metadata.workflow_version) >= 3,
    ));
    if (entry.document.metadata.kind !== "work-issue") {
      issues.push(`${summary.id}: kind must be work-issue`);
    }
    if (summary.phase === "wayfinding" && summary.type === "delivery") {
      issues.push(`${summary.id}: Wayfinding issues cannot use delivery type`);
    }
    if (
      summary.phase === "delivery"
      && summary.type !== "delivery"
      && summary.type !== "task"
    ) {
      issues.push(`${summary.id}: delivery issues must use delivery or task type`);
    }
  }
  for (const cycle of dependencyCycles(parsedIssues.map((entry) => entry.summary))) {
    issues.push(`issue dependency cycle: ${cycle.join(" -> ")}`);
  }
  const map = await optionalDocument(join(bundleRoot, "map.md"));
  if (change.metadata.mode === "wayfinder" && !map) {
    issues.push("map.md is required in Wayfinder mode");
  }
  if (map && map.metadata.kind !== "wayfinder-map") {
    issues.push("map.md: kind must be wayfinder-map");
  }
  if (map && map.metadata.workflow_version !== SUPPORTED_MAP_VERSION) {
    issues.push(`map.md: workflow_version must be ${SUPPORTED_MAP_VERSION}`);
  }
  if (map && !["charting", "resolved"].includes(stringValue(map.metadata.status))) {
    issues.push("map.md: status must be charting or resolved");
  }
  if (map && !Array.isArray(map.metadata.fog)) {
    issues.push("map.md: fog must be an array");
  }
  if (map && !Array.isArray(map.metadata.out_of_scope)) {
    issues.push("map.md: out_of_scope must be an array");
  }
  if (map) {
    const resolved = recordArray(map.metadata.resolved);
    const resolvedIds = resolved.map((entry) => stringValue(entry.issue));
    if (new Set(resolvedIds).size !== resolvedIds.length) {
      issues.push("map.md: resolved issue pointers must be unique");
    }
    for (const entry of parsedIssues.filter((candidate) =>
      candidate.summary.phase === "wayfinding" && candidate.summary.status === "completed"
    )) {
      if (!resolvedIds.includes(entry.summary.id)) {
        issues.push(`map.md: completed Wayfinder issue is not indexed: ${entry.summary.id}`);
      }
    }
    for (const resolvedId of resolvedIds) {
      const entry = parsedIssues.find((candidate) => candidate.summary.id === resolvedId);
      if (!entry || entry.summary.phase !== "wayfinding" || entry.summary.status !== "completed") {
        issues.push(`map.md: resolved pointer is not a completed Wayfinder issue: ${resolvedId}`);
      }
    }
  }
  const review = await optionalDocument(join(bundleRoot, "review.md"));
  if (review) {
    if (review.metadata.workflow_version !== SUPPORTED_REVIEW_VERSION) {
      issues.push(`review.md: workflow_version must be ${SUPPORTED_REVIEW_VERSION}`);
    }
    if (review.metadata.kind !== "bundle-review") {
      issues.push("review.md: kind must be bundle-review");
    }
    const receipts = reviewReceipts(review);
    if (new Set(receipts.map((entry) => entry.path)).size !== receipts.length) {
      issues.push("review.md: receipt paths must be unique");
    }
    for (const receipt of receipts) {
      if (!files.some((entry) => entry.path === receipt.path)) {
        issues.push(`review.md: receipt points to a missing file: ${receipt.path}`);
      }
      if (receipt.status === "irrelevant" && roleForPath(receipt.path) !== "artifact") {
        issues.push(`review.md: only artifacts may be irrelevant: ${receipt.path}`);
      }
      if (!/^[0-9a-f]{64}$/.test(receipt.sha256)) {
        issues.push(`review.md: invalid SHA-256 receipt for ${receipt.path}`);
      }
      if (receipt.status === "irrelevant" && !receipt.reason.trim()) {
        issues.push(`review.md: irrelevant receipt requires a reason for ${receipt.path}`);
      }
    }
  }
  return issues;
}

async function bundleInventory(
  bundleRoot: string,
  validationIssues: string[],
): Promise<BundleInventoryEntry[]> {
  const review = await optionalDocument(join(bundleRoot, "review.md"));
  const receipts = review ? reviewReceipts(review) : [];
  const invalidPaths = new Set(
    validationIssues
      .map((issue) => issue.split(":", 1)[0]!)
      .filter((path) => path.includes(".") || path.includes("/")),
  );
  const inventory: BundleInventoryEntry[] = [];
  for (const file of await walkFiles(bundleRoot)) {
    const content = await readFile(file.absolute);
    const digest = sha256(content);
    const role = roleForPath(file.path);
    const receipt = receipts.find((entry) => entry.path === file.path);
    let accounting: BundleInventoryEntry["accounting"];
    let reason = "";
    if (file.symlink || role === "unknown" || invalidPaths.has(file.path)) {
      accounting = "invalid";
    } else if (file.path === "review.md") {
      accounting = "reviewed";
      reason = "accounting ledger";
    } else if (!receipt) {
      accounting = "unseen";
    } else if (receipt.sha256 !== digest) {
      accounting = "changed-after-review";
    } else {
      accounting = receipt.status;
      reason = receipt.reason;
    }
    inventory.push({
      path: file.path,
      role,
      sha256: digest,
      bytes: content.byteLength,
      accounting,
      reason,
    });
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}

function requiredPathsForStage(
  stage: WorkBundleStage,
  selectedIssue: string | undefined,
  parsedIssues: ParsedIssue[],
  inventory: BundleInventoryEntry[],
): string[] {
  if (stage === "review") {
    return inventory.filter((entry) => entry.role !== "review").map((entry) => entry.path);
  }
  const required = new Set<string>(["change.md"]);
  const hasMap = inventory.some((entry) => entry.path === "map.md");
  if (hasMap && ["shape", "wayfind", "resume"].includes(stage)) {
    required.add("map.md");
  }
  const selected = selectedIssue
    ? parsedIssues.find((entry) => entry.summary.id === selectedIssue)
    : undefined;
  if (selected) {
    required.add(relativeIssuePath(selected.path));
    for (const blocker of transitiveBlockers(selected.summary, parsedIssues.map((entry) => entry.summary))) {
      const parsed = parsedIssues.find((entry) => entry.summary.id === blocker);
      if (parsed) {
        required.add(relativeIssuePath(parsed.path));
      }
    }
    for (const artifact of selected.summary.artifacts) {
      required.add(artifact);
    }
  } else if (stage === "resume") {
    for (const entry of parsedIssues.filter((entry) => entry.summary.status === "claimed")) {
      required.add(relativeIssuePath(entry.path));
    }
  }
  return [...required].sort();
}

async function appendMapResolution(
  bundleRoot: string,
  id: string,
  title: string,
  summary: string,
  now: Date,
): Promise<void> {
  const path = join(bundleRoot, "map.md");
  const map = parseWorkSpec(await readFile(path, "utf8"));
  const resolved = recordArray(map.metadata.resolved).filter((entry) => entry.issue !== id);
  map.metadata.resolved = [
    ...resolved,
    { issue: id, title, summary },
  ];
  map.metadata.updated_at = now.toISOString();
  await writeFile(path, serializeWorkSpec(map), "utf8");
}

async function readIssues(bundleRoot: string): Promise<ParsedIssue[]> {
  const files = (await walkFiles(join(bundleRoot, "issues")))
    .filter((entry) => entry.path.endsWith(".md"));
  const parsed: ParsedIssue[] = [];
  for (const file of files) {
    parsed.push(await parseIssueFile(bundleRoot, `issues/${file.path}`));
  }
  return parsed.sort((left, right) => left.summary.id.localeCompare(right.summary.id));
}

async function readIssuesForInspection(bundleRoot: string): Promise<{
  parsed: ParsedIssue[];
  errors: string[];
}> {
  const files = (await walkFiles(join(bundleRoot, "issues")))
    .filter((entry) => entry.path.endsWith(".md"));
  const parsed: ParsedIssue[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const path = `issues/${file.path}`;
    try {
      parsed.push(await parseIssueFile(bundleRoot, path));
    } catch (error) {
      errors.push(`${path}: ${errorText(error)}`);
    }
  }
  parsed.sort((left, right) => left.summary.id.localeCompare(right.summary.id));
  return { parsed, errors };
}

async function readIssueById(bundleRoot: string, input: string): Promise<ParsedIssue> {
  const id = normalizeIssueId(input);
  const issue = (await readIssues(bundleRoot)).find((entry) => entry.summary.id === id);
  if (!issue) {
    throw new Error(`Work issue not found: ${id}`);
  }
  return issue;
}

async function parseIssueFile(bundleRoot: string, relativeFile: string): Promise<ParsedIssue> {
  const path = resolveBundleFile(bundleRoot, relativeFile);
  const relativeName = relativePath(bundleRoot, path);
  const match = ISSUE_PATH.exec(relativeName);
  if (!match) {
    throw new Error(`Invalid issue path: ${relativeName}`);
  }
  const document = parseWorkSpec(await readFile(path, "utf8"));
  const id = stringValue(document.metadata.id);
  if (id !== match[1]) {
    throw new Error(`${relativeName}: metadata id must match ${match[1]}`);
  }
  const phase = enumValue(document.metadata.phase, ["wayfinding", "delivery"] as const, `${id}.phase`);
  const type = enumValue(
    document.metadata.type,
    ["research", "prototype", "grilling", "task", "delivery"] as const,
    `${id}.type`,
  );
  const status = enumValue(
    document.metadata.status,
    ["draft", "ready", "claimed", "completed", "dropped"] as const,
    `${id}.status`,
  );
  return {
    path,
    document,
    summary: {
      id,
      title: requiredString(document.metadata.title, `${id}.title`),
      path: relativeName,
      phase,
      type,
      status,
      blockedBy: uniqueStrings(stringArray(document.metadata.blocked_by)).map(normalizeIssueId),
      satisfies: uniqueStrings(stringArray(document.metadata.satisfies)).map(normalizeAcceptanceId),
      repositories: uniqueStrings(stringArray(document.metadata.repositories)),
      artifacts: uniqueStrings(stringArray(document.metadata.artifacts)).map(normalizeArtifactPath),
      claimed: status === "claimed",
      claimedBy: stringValue(recordValue(document.metadata.claim)?.actor),
      unblocked: false,
      frontier: false,
    },
  };
}

function withGraphState(input: WorkIssueSummary[]): WorkIssueSummary[] {
  const byId = new Map(input.map((entry) => [entry.id, entry]));
  return input.map((entry) => {
    const unblocked = entry.blockedBy.every((id) => byId.get(id)?.status === "completed");
    return {
      ...entry,
      unblocked,
      frontier: entry.status === "ready" && unblocked && !entry.claimed,
    };
  });
}

function assertClaimContext(
  issue: ParsedIssue,
  context: WorkIssueClaimContext,
): void {
  const claim = recordValue(issue.document.metadata.claim);
  if (!claim) {
    throw new Error(`${issue.summary.id}: claim metadata is missing`);
  }
  if (claim.repository === "project") {
    if (!context.allowProject) {
      throw new Error(`${issue.summary.id}: project claim must be operated from knowledge`);
    }
    return;
  }
  if (!context.source) {
    throw new Error(`${issue.summary.id}: source claim must be operated from its bound leaf`);
  }
  if (claim.repository !== context.source.repository) {
    throw new Error(`${issue.summary.id}: claim repository does not match the current leaf`);
  }
  if (claim.worktree_id !== context.source.worktreeId) {
    throw new Error(`${issue.summary.id}: claim worktree does not match the current leaf`);
  }
  if (claim.branch !== context.source.branch) {
    throw new Error(`${issue.summary.id}: claim branch does not match the current leaf`);
  }
}

function dependencyCycles(input: WorkIssueSummary[]): string[][] {
  const byId = new Map(input.map((entry) => [entry.id, entry]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const stack: string[] = [];
  function visit(id: string): void {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push([...stack.slice(start), id]);
      return;
    }
    if (visited.has(id)) {
      return;
    }
    visiting.add(id);
    stack.push(id);
    for (const blocker of byId.get(id)?.blockedBy ?? []) {
      if (byId.has(blocker)) {
        visit(blocker);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) {
    visit(id);
  }
  return cycles;
}

function transitiveBlockers(issue: WorkIssueSummary, all: WorkIssueSummary[]): string[] {
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  const found = new Set<string>();
  function visit(id: string): void {
    if (found.has(id)) {
      return;
    }
    found.add(id);
    for (const blocker of byId.get(id)?.blockedBy ?? []) {
      visit(blocker);
    }
  }
  for (const blocker of issue.blockedBy) {
    visit(blocker);
  }
  return [...found].sort();
}

function acceptanceCriteria(document: WorkSpecDocument): Array<{
  id: string;
  criterion: string;
  status: string;
}> {
  return recordArray(document.metadata.acceptance).map((entry) => {
    const id = normalizeAcceptanceId(stringValue(entry.id));
    return {
      id,
      criterion: requiredString(entry.criterion, `${id}.criterion`),
      status: stringValue(entry.status),
    };
  });
}

function reviewReceipts(document: WorkSpecDocument): ReviewReceipt[] {
  return recordArray(document.metadata.files).map((entry) => ({
    path: normalizeBundlePath(requiredString(entry.path, "review.files.path")),
    sha256: requiredString(entry.sha256, "review.files.sha256"),
    status: enumValue(
      entry.status,
      ["reviewed", "irrelevant"] as const,
      "review.files.status",
    ),
    reason: stringValue(entry.reason),
    reviewed_at: requiredString(entry.reviewed_at, "review.files.reviewed_at"),
  }));
}

async function writeTemplate(
  source: string,
  destination: string,
  mutate: (document: WorkSpecDocument) => void,
): Promise<void> {
  const document = parseWorkSpec(await readFile(source, "utf8"));
  mutate(document);
  await writeFile(destination, serializeWorkSpec(document), {
    encoding: "utf8",
    flag: "wx",
  });
}

async function optionalDocument(path: string): Promise<WorkSpecDocument | undefined> {
  try {
    return parseWorkSpec(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissing(error)) {
      return undefined;
    }
    throw error;
  }
}

async function walkFiles(root: string): Promise<Array<{
  path: string;
  absolute: string;
  symlink: boolean;
}>> {
  const output: Array<{ path: string; absolute: string; symlink: boolean }> = [];
  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      const path = relativePath(root, absolute);
      if (entry.isSymbolicLink()) {
        output.push({ path, absolute, symlink: true });
      } else if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        output.push({ path, absolute, symlink: false });
      }
    }
  }
  await walk(root);
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

function roleForPath(path: string): BundleInventoryEntry["role"] {
  if (path === "change.md") return "change";
  if (path === "map.md") return "map";
  if (path === "review.md") return "review";
  if (ISSUE_PATH.test(path)) return "issue";
  if (/^artifacts\/.+/.test(path)) return "artifact";
  // A curated page written but not yet promoted. It lives in the bundle so that
  // drafting can finish without a person, and so that the corpus never holds a
  // page whose authority is a change nobody has accepted.
  if (/^promotion\/.+\.md$/.test(path)) return "promotion";
  return "unknown";
}

function nextIssueId(ids: string[]): string {
  const highest = ids.reduce((max, id) => {
    const value = Number(id.slice("ISSUE-".length));
    return Number.isInteger(value) ? Math.max(max, value) : max;
  }, 0);
  if (highest >= 999) {
    throw new Error("Work bundle cannot allocate more than 999 issue IDs");
  }
  return `ISSUE-${String(highest + 1).padStart(3, "0")}`;
}

function normalizeIssueId(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^ISSUE-\d{3}$/.test(normalized)) {
    throw new Error(`Invalid issue ID: ${value}`);
  }
  return normalized;
}

function normalizeAcceptanceId(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!ACCEPTANCE_ID.test(normalized)) {
    throw new Error(`Invalid acceptance ID: ${value}`);
  }
  return normalized;
}

function normalizeArtifactPath(value: string): string {
  const normalized = normalizeBundlePath(value);
  if (!normalized.startsWith("artifacts/") || normalized === "artifacts/") {
    throw new Error(`Artifact reference must be under artifacts/: ${value}`);
  }
  return normalized;
}

function normalizeBundlePath(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Invalid bundle-relative path: ${value}`);
  }
  return normalized;
}

function resolveBundleFile(bundleRoot: string, path: string): string {
  const normalized = normalizeBundlePath(path);
  const absolute = resolve(bundleRoot, normalized);
  const boundary = `${resolve(bundleRoot)}${sep}`;
  if (!absolute.startsWith(boundary)) {
    throw new Error(`Path escapes the work bundle: ${path}`);
  }
  return absolute;
}

function normalizeSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("Issue slug must contain ASCII letters or digits");
  }
  return normalized;
}

function normalizeActor(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new Error("Claim actor must be a non-empty identity of at most 160 characters");
  }
  return normalized;
}

function writeCheckpoint(
  document: WorkSpecDocument,
  input: {
    status: WorkCheckpointStatus;
    stage: WorkCheckpointStage;
    actor: string;
    currentState: string;
    lastCompleted: string;
    nextAction: string;
    blockers?: string[];
    handoff?: string;
    todo?: string[];
    now: Date;
  },
): void {
  const blockers = uniqueStrings(input.blockers ?? []);
  const todo = uniqueStrings(input.todo ?? []);
  const handoff = (input.handoff ?? "").trim();
  if (input.status === "blocked" && blockers.length === 0) {
    throw new Error("A blocked checkpoint requires at least one blocker");
  }
  if (input.status !== "blocked" && blockers.length > 0) {
    throw new Error("Checkpoint blockers require blocked status");
  }
  if (handoff && blockers.length > 0) {
    throw new Error(
      "A checkpoint records a blocker or a handoff, never both: a blocker says the "
        + "maintainer is what the work is missing, and a handoff says nothing is missing "
        + "except this session",
    );
  }
  if ((input.status === "complete") !== (input.stage === "complete")) {
    throw new Error("Complete checkpoint status and stage must be used together");
  }
  const updatedAt = input.now.toISOString();
  document.metadata.checkpoint_version = 1;
  document.metadata.updated_at = updatedAt;
  document.metadata.checkpoint = {
    status: input.status,
    stage: input.stage,
    actor: normalizeActor(input.actor),
    current_state: requireCheckpointText(input.currentState, "current state"),
    last_completed: requireCheckpointText(input.lastCompleted, "last completed action"),
    next_action: requireCheckpointText(input.nextAction, "next action"),
    blockers,
    // Why this session stops while work remains, addressed to the next session
    // rather than to the maintainer. Deliberately not carried forward: any later
    // checkpoint clears it, so a handoff is a statement about the moment it was
    // written and never a standing licence to stop.
    ...(handoff ? { handoff } : {}),
    // Small jobs that are neither the next action nor a blocker. They are the
    // first thing a compaction loses and the last thing anyone writes down.
    todo,
    updated_at: updatedAt,
    basis_sha256: "",
  };
  checkpointRecord(document)!.basis_sha256 = checkpointBasis(document);
}

function checkpointSummary(
  document: WorkSpecDocument,
  path: string,
  owner: WorkCheckpointSummary["owner"],
  issue: string | undefined,
  required: boolean,
): WorkCheckpointSummary | undefined {
  const version = document.metadata.checkpoint_version;
  const checkpoint = checkpointRecord(document);
  if (version === undefined && !checkpoint && !required) {
    return undefined;
  }
  const issues: string[] = [];
  if (version !== 1) {
    issues.push(`${path}: checkpoint_version must be 1`);
  }
  if (!checkpoint) {
    issues.push(`${path}: checkpoint metadata is required`);
  }
  const statusValue = stringValue(checkpoint?.status);
  const stageValue = stringValue(checkpoint?.stage);
  const allowedStatuses: WorkCheckpointStatus[] = ["ready", "active", "blocked", "complete"];
  const allowedStages: WorkCheckpointStage[] = ["shape", "wayfind", "implement", "review", "complete"];
  if (!allowedStatuses.includes(statusValue as WorkCheckpointStatus)) {
    issues.push(`${path}: checkpoint.status is invalid`);
  }
  if (!allowedStages.includes(stageValue as WorkCheckpointStage)) {
    issues.push(`${path}: checkpoint.stage is invalid`);
  }
  const actor = stringValue(checkpoint?.actor).trim();
  const currentState = stringValue(checkpoint?.current_state).trim();
  const lastCompleted = stringValue(checkpoint?.last_completed).trim();
  const nextAction = stringValue(checkpoint?.next_action).trim();
  const updatedAt = stringValue(checkpoint?.updated_at).trim();
  const blockersValue = checkpoint?.blockers;
  const blockers = stringArray(blockersValue).map((entry) => entry.trim()).filter(Boolean);
  const todoValue = checkpoint?.todo;
  const todo = stringArray(todoValue).map((entry) => entry.trim()).filter(Boolean);
  const handoff = stringValue(checkpoint?.handoff).trim();
  if (!actor) issues.push(`${path}: checkpoint.actor is required`);
  if (!currentState) issues.push(`${path}: checkpoint.current_state is required`);
  if (!lastCompleted) issues.push(`${path}: checkpoint.last_completed is required`);
  if (!nextAction) issues.push(`${path}: checkpoint.next_action is required`);
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) {
    issues.push(`${path}: checkpoint.updated_at must be an ISO timestamp`);
  }
  if (!Array.isArray(blockersValue) || blockers.length !== blockersValue.length) {
    issues.push(`${path}: checkpoint.blockers must contain only non-empty strings`);
  }
  // Absent on every checkpoint written before the list existed, which is not an
  // error: a resume record is complete under the contract it was written to.
  if (todoValue !== undefined && (!Array.isArray(todoValue) || todo.length !== todoValue.length)) {
    issues.push(`${path}: checkpoint.todo must contain only non-empty strings`);
  }
  if (statusValue === "blocked" && blockers.length === 0) {
    issues.push(`${path}: blocked checkpoint requires a blocker`);
  }
  if (statusValue !== "blocked" && blockers.length > 0) {
    issues.push(`${path}: only a blocked checkpoint may retain blockers`);
  }
  if ((statusValue === "complete") !== (stageValue === "complete")) {
    issues.push(`${path}: complete checkpoint status and stage must be used together`);
  }
  const basis = stringValue(checkpoint?.basis_sha256);
  if (!/^[0-9a-f]{64}$/.test(basis)) {
    issues.push(`${path}: checkpoint.basis_sha256 is invalid`);
  } else if (basis !== checkpointBasis(document)) {
    issues.push(`${path}: checkpoint is stale; refresh it after the latest record changes`);
  }
  if (owner === "issue") {
    const recordStatus = stringValue(document.metadata.status);
    if (recordStatus === "claimed" && !["active", "blocked"].includes(statusValue)) {
      issues.push(`${path}: claimed issue checkpoint must be active or blocked`);
    }
    if (["completed", "dropped"].includes(recordStatus) && statusValue !== "complete") {
      issues.push(`${path}: terminal issue checkpoint must be complete`);
    }
    if (["draft", "ready"].includes(recordStatus) && statusValue !== "ready") {
      issues.push(`${path}: unclaimed issue checkpoint must be ready`);
    }
  } else {
    const terminal = Boolean(stringValue(document.metadata.closed_at).trim());
    if (terminal && statusValue !== "complete") {
      issues.push(`${path}: closed change checkpoint must be complete`);
    }
    if (!terminal && statusValue === "complete") {
      issues.push(`${path}: active change checkpoint cannot be complete`);
    }
  }
  return {
    owner,
    path,
    ...(issue ? { issue } : {}),
    status: allowedStatuses.includes(statusValue as WorkCheckpointStatus)
      ? statusValue as WorkCheckpointStatus
      : "ready",
    stage: allowedStages.includes(stageValue as WorkCheckpointStage)
      ? stageValue as WorkCheckpointStage
      : "shape",
    actor,
    currentState,
    lastCompleted,
    nextAction,
    blockers,
    handoff,
    todo,
    updatedAt,
    valid: issues.length === 0,
    issues,
  };
}

function checkpointRecord(document: WorkSpecDocument): Record<string, unknown> | undefined {
  return recordValue(document.metadata.checkpoint);
}

/**
 * Framing approval gates implementation, and the corpus has always said so:
 * "require an explicit maintainer decision before implementing a significant
 * spec whose outcome, scope, exclusions, acceptance criteria, or material
 * decisions have not already been explicitly accepted."
 *
 * Nothing enforced it until closure, so it was discovered after the work rather
 * than before it, and then read as a hard stop mid-flight. One bundle ran
 * fifteen hours and three slices on a pending framing, then parked waiting for
 * the approval it could have had on day one. Asking at the first delivery claim
 * costs the maintainer the same decision at a moment when nothing is blocked by
 * their absence.
 *
 * Wayfinding claims are exempt by phase: shaping is where the framing gets
 * decided, so requiring its approval to start would be its own deadlock.
 */
async function requireNotParked(bundleRoot: string): Promise<void> {
  const change = parseWorkSpec(await readFile(join(bundleRoot, "change.md"), "utf8"));
  const park = readPark(change.metadata);
  if (!park) {
    return;
  }
  throw new Error(
    `${stringValue(change.metadata.id) || basename(bundleRoot)} is parked and cannot be `
      + `worked: ${park.reason}\n`
      + "Releasing it is the maintainer's, in their own words: "
      + "wfctl work release <id> --by human:<id> --attested \"<what they said>\"",
  );
}

async function requireApprovedFraming(bundleRoot: string, issueId: string): Promise<void> {
  const change = parseWorkSpec(await readFile(join(bundleRoot, "change.md"), "utf8"));
  const framing = recordValue(recordValue(change.metadata.maintainer_review)?.framing);
  if (
    framing?.status === "approved"
    && stringValue(framing.by).startsWith("human:")
    && stringValue(framing.at).trim() !== ""
  ) {
    return;
  }
  const id = stringValue(change.metadata.id) || basename(bundleRoot);
  // Never "have them record it in their own terminal", which this said for as
  // long as the gate existed while the rule it enforces said the opposite:
  // retyping a generated id, a stage name and their own identity relocates an
  // answer they already gave, and records nothing the attestation does not.
  throw new Error(
    `Work issue ${issueId} implements this change, and its framing is not approved. `
      + `Render it with wfctl work ask ${id}, put it to the maintainer, and record what `
      + `they answered: wfctl work approve ${id} --stage framing --by human:<maintainer-id> `
      + `--attested "<their answer, word for word>" --session "<where they said it>"`,
  );
}

/**
 * The basis a change or issue checkpoint must still match. Exported for the
 * same reason as the reconstruction one: the session brief has to answer "can
 * this be resumed" from the record, not from how recently someone wrote it.
 */
export function workCheckpointBasis(document: WorkSpecDocument): string {
  return checkpointBasis(document);
}

function checkpointBasis(document: WorkSpecDocument): string {
  const metadata = { ...document.metadata };
  delete metadata.checkpoint;
  delete metadata.updated_at;
  return sha256(Buffer.from(JSON.stringify(stableValue({ metadata, body: document.body }))));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function requireCheckpointText(value: unknown, label: string): string {
  const normalized = stringValue(value).trim();
  if (!normalized) {
    throw new Error(`Checkpoint ${label} must not be empty`);
  }
  return normalized;
}

function claimLockPath(bundleRoot: string, issueId: string): string {
  const knowledgeRoot = resolve(bundleRoot, "../../..");
  return join(
    knowledgeRoot,
    ".workflow/current/work-claims",
    basename(bundleRoot),
    `${normalizeIssueId(issueId)}.json`,
  );
}

function relativeIssuePath(path: string): string {
  const marker = `${sep}issues${sep}`;
  const index = path.lastIndexOf(marker);
  return index >= 0 ? `issues/${path.slice(index + marker.length).split(sep).join("/")}` : path;
}

function relativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requiredString(value: unknown, field: string): string {
  const result = stringValue(value).trim();
  if (!result) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return result;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function removeFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }
}

export async function assertBundleFileExists(bundleRoot: string, path: string): Promise<void> {
  await access(resolveBundleFile(bundleRoot, path), constants.R_OK);
}
