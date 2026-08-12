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
import { approvalIdentityIssue, approvalIssues, recordApproval } from "./approval.js";
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
import { areaOf, pendingPromotions, PROMOTION_DIRECTORY } from "./work-promotion.js";
import {
  completionIssues,
  decisionAccountingIssues,
  framingDigest,
  framingIssues,
  unaccountedMapAnswers,
  parseWorkSpec,
  serializeWorkSpec,
  type ApprovalMethod,
  type MaintainerReviewStage,
  type TodoEdit,
} from "./work-spec.js";
import { readLeafDeclarations, type LeafDeclaration } from "./leaf-declarations.js";
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
  reopenWorkIssue as reopenBundleIssue,
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
  WorkSpecDocument,
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
  attested?: string;
  session?: string;
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
export interface WorkRepositoryView extends LeafDeclaration {
  /** What the bundle already records about this repository, if anything. */
  accounted?: {
    status: string;
    note: string;
    reason: string;
    at: string;
    instructions_sha256: string;
    skills: string[];
  };
  /**
   * True when the repository changed its own rules after being accounted for.
   * The receipt is then a record of something that is no longer there.
   */
  stale: boolean;
}

/** What every bound repository declares about itself, read from the centre. */
export async function readWorkRepositories(
  target: string,
  id?: string,
): Promise<{ id: string; specPath: string; repositories: WorkRepositoryView[] }> {
  const context = await requireWorkContext(target, id);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const recorded = new Map<string, Record<string, unknown>>();
  for (const entry of recordArray_(document.metadata.repositories)) {
    const name = String(entry.repository ?? "");
    if (name) {
      recorded.set(name, entry);
    }
  }
  const declarations = await readLeafDeclarations(
    context.currentSources.map((source) => ({
      repository: source.repository,
      root: source.root,
    })),
  );
  return {
    id: context.id,
    specPath: context.specPath,
    repositories: declarations.map((declaration) => {
      const accounted = record_(recorded.get(declaration.repository)?.accounted);
      const view: WorkRepositoryView = {
        ...declaration,
        stale: Boolean(accounted)
          && String(accounted?.status ?? "") === "read"
          && String(accounted?.instructions_sha256 ?? "") !== declaration.instructionsSha256,
      };
      if (accounted) {
        view.accounted = {
          status: String(accounted.status ?? ""),
          note: String(accounted.note ?? ""),
          reason: String(accounted.reason ?? ""),
          at: String(accounted.at ?? ""),
          instructions_sha256: String(accounted.instructions_sha256 ?? ""),
          skills: Array.isArray(accounted.skills) ? accounted.skills.map(String) : [],
        };
      }
      return view;
    }),
  };
}

export interface RecordDecisionOptions {
  target: string;
  id?: string;
  /** Declare that this work settled nothing durable, and why. */
  none?: string;
  /** The decision itself, in the words the product uses. */
  what: string;
  /** Where the maintainer said it: a map issue, or the framing they attested. */
  said: string;
  disposition: "promoted" | "folded" | "not-durable" | "none";
  /** The concept that now carries it. Required unless it is not durable. */
  into?: string;
  /** Why it outlives nothing. Required when it is not durable. */
  reason?: string;
  now?: Date;
}

export interface WorkDecisionsView {
  id: string;
  specPath: string;
  recorded: Array<Record<string, unknown>>;
  /** Answers a resolved map holds that the accounting has not reached. */
  unaccounted: Array<{ issue: string; title: string; summary: string }>;
  issues: string[];
}

/**
 * What this bundle decided, what is already accounted for, and what a resolved
 * map recorded that the accounting has not reached yet.
 */
export async function readWorkDecisions(
  target: string,
  id?: string,
): Promise<WorkDecisionsView> {
  const context = await requireWorkContext(target, id);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const promotion = record_(document.metadata.knowledge_promotion);
  const recorded = recordArray_(promotion?.decisions);
  const resolved = await resolvedMapAnswers(context.bundleRoot);
  const missing = new Set(unaccountedMapAnswers(document, resolved));
  return {
    id: context.id,
    specPath: context.specPath,
    recorded,
    unaccounted: resolved
      .filter((entry) => missing.has(String(entry.issue ?? "")))
      .map((entry) => ({
        issue: String(entry.issue ?? ""),
        title: String(entry.title ?? ""),
        summary: String(entry.summary ?? ""),
      })),
    issues: decisionAccountingIssues(document),
  };
}

/**
 * Record one decision and where it went.
 *
 * The maintainer already answered; nothing here asks them again. What is being
 * written is where their answer now lives, so a later session finds it in
 * curated knowledge rather than by opening an archived bundle nobody named.
 */
export async function recordWorkDecision(
  options: RecordDecisionOptions,
): Promise<{ id: string; what: string; disposition: string; specPath: string }> {
  const context = await requireWorkContext(options.target, options.id);
  const none = (options.none ?? "").trim();
  if (none) {
    const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
    const promotion = record_(document.metadata.knowledge_promotion) ?? {};
    if (recordArray_(promotion.decisions).length > 0) {
      throw new Error(
        "This work already accounts for decisions; it cannot also declare it settled none",
      );
    }
    promotion.decisions = [];
    promotion.decisions_none = none;
    document.metadata.knowledge_promotion = promotion;
    document.metadata.updated_at = (options.now ?? new Date()).toISOString();
    await writeFile(context.specPath, serializeWorkSpec(document), "utf8");
    return {
      id: context.id,
      what: "",
      disposition: "none",
      specPath: context.specPath,
    };
  }
  const what = options.what.trim();
  const said = options.said.trim();
  if (!what) {
    throw new Error("Say what was decided, in the words the product uses");
  }
  if (!said) {
    throw new Error(
      "Say where the maintainer said it; a decision with no origin cannot be weighed later",
    );
  }
  if (options.disposition === "not-durable" && !(options.reason ?? "").trim()) {
    throw new Error("A decision called not durable needs the reason it outlives nothing");
  }
  if (options.disposition !== "not-durable" && !(options.into ?? "").trim()) {
    throw new Error("Name the concept that now carries this decision");
  }

  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const promotion = record_(document.metadata.knowledge_promotion) ?? {};
  const decisions = recordArray_(promotion.decisions);
  const entry: Record<string, unknown> = {
    what,
    said,
    disposition: options.disposition,
    ...(options.into?.trim() ? { into: options.into.trim() } : {}),
    ...(options.reason?.trim() ? { reason: options.reason.trim() } : {}),
  };
  const existing = decisions.findIndex((item) => stringValue_(item.what) === what);
  if (existing >= 0) {
    decisions[existing] = entry;
  } else {
    decisions.push(entry);
  }
  promotion.decisions = decisions;
  document.metadata.knowledge_promotion = promotion;
  document.metadata.updated_at = (options.now ?? new Date()).toISOString();
  await writeFile(context.specPath, serializeWorkSpec(document), "utf8");
  return {
    id: context.id,
    what,
    disposition: options.disposition,
    specPath: context.specPath,
  };
}

async function resolvedMapAnswers(
  bundleRoot: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const map = parseWorkSpec(await readFile(join(bundleRoot, "map.md"), "utf8"));
    return recordArray_(map.metadata.resolved);
  } catch (error) {
    if (isMissingFileError(error)) {
      // A bounded change has no map, and therefore no list of answers to hold
      // the accounting against. The accounting is still required of it.
      return [];
    }
    throw error;
  }
}

function stringValue_(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface AccountRepositoryOptions {
  target: string;
  id?: string;
  repository: string;
  /** What its own rules require of this work. Required when it was read. */
  note?: string;
  /** Why this work does not touch it. Required when it is untouched. */
  untouched?: string;
  now?: Date;
}

/**
 * Record that one bound repository was read on its own terms, or that it is not
 * touched by this work.
 *
 * The hash and the skill list are taken from the checkout rather than passed in,
 * so the receipt binds to what was actually there. What the agent supplies is
 * the only part no tool can derive: what those rules require of this particular
 * work. An empty note is refused, because "read it" and "read it and it matters
 * here" are different claims and only the second is worth recording.
 */
export async function accountWorkRepository(
  options: AccountRepositoryOptions,
): Promise<{ id: string; repository: string; status: "read" | "untouched"; specPath: string }> {
  const context = await requireWorkContext(options.target, options.id);
  const source = context.currentSources.find(
    (entry) => entry.repository === options.repository,
  );
  if (!source) {
    throw new Error(
      `${options.repository} is not bound to ${context.id}; bound repositories are ${
        context.currentSources.map((entry) => entry.repository).join(", ") || "none"
      }`,
    );
  }
  const untouched = (options.untouched ?? "").trim();
  const note = (options.note ?? "").trim();
  if (untouched && note) {
    throw new Error("A repository is either read or untouched by this work, not both");
  }
  if (!untouched && !note) {
    throw new Error(
      "Say what this repository's own rules require of this work, or why the work does not touch it",
    );
  }

  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const repositories = recordArray_(document.metadata.repositories);
  const entry = repositories.find((item) => String(item.repository ?? "") === options.repository);
  if (!entry) {
    throw new Error(`${options.repository} is not recorded in the bundle`);
  }
  const at = (options.now ?? new Date()).toISOString();
  if (untouched) {
    entry.accounted = { status: "untouched", reason: untouched, at };
  } else {
    const [declaration] = await readLeafDeclarations([{
      repository: source.repository,
      root: source.root,
    }]);
    entry.accounted = {
      status: "read",
      note,
      at,
      instructions_sha256: declaration?.instructionsSha256 ?? "",
      skills: (declaration?.skills ?? []).map((skill) => skill.name),
    };
  }
  document.metadata.repositories = repositories;
  document.metadata.updated_at = at;
  await writeFile(context.specPath, serializeWorkSpec(document), "utf8");
  return {
    id: context.id,
    repository: options.repository,
    status: untouched ? "untouched" : "read",
    specPath: context.specPath,
  };
}

export async function approveWork(
  options: ApproveWorkOptions,
): Promise<ApproveWorkResult> {
  const context = await requireWorkContext(options.target, options.id);
  if (options.stage === "completion") {
    // The map is the only place a maintainer's answers are already enumerated.
    // Where one exists, closure is held against it so an answer cannot archive
    // unaccounted for while the accounting looks complete.
    const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
    const missing = unaccountedMapAnswers(
      document,
      await resolvedMapAnswers(context.bundleRoot),
    );
    if (missing.length > 0) {
      throw new Error(
        `Completion is blocked until every answer the map recorded is accounted for: ${
          missing.join(", ")
        }`,
      );
    }
  }
  const identity = approvalIdentityIssue(
    options.by,
    options.method,
    options.attested ?? "",
  );
  if (options.stage === "framing" && !identity) {
    // Approval settles what the work is, so everything the framing rests on has
    // to be true before it is asked for. Checking afterwards only ever produced
    // a field filled to open a gate.
    const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
    const pending = framingIssues(document);
    if (pending.length > 0) {
      throw new Error(
        `Framing approval is blocked until the framing rests on something: ${pending.join("; ")}`,
      );
    }
    const stale = await unpromotedAreas(context.knowledgeRoot, document);
    if (stale.length > 0) {
      throw new Error(
        `Framing approval is blocked because curated knowledge is knowingly behind in the same `
          + `part of the project this work rests on: ${stale.join("; ")}. The pages are written `
          + "and waiting on you; put each to the maintainer with wfctl work ask <id> --stage "
          + "promotion and record their answer with wfctl work promote <id>.",
      );
    }
  }
  const record = await recordApproval({
    knowledgeRoot: context.knowledgeRoot,
    id: context.id,
    stage: options.stage,
    by: options.by,
    method: options.method,
    ...(options.note ? { note: options.note } : {}),
    ...(options.attested ? { attested: options.attested } : {}),
    ...(options.session ? { session: options.session } : {}),
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
    // The maintainer's own words live in the record they approved, not only in
    // an ignored runtime file, so a reader months later can weigh the answer
    // against the framing without reconstructing the session.
    ...(record.attested ? { attested: record.attested } : {}),
    ...(record.session ? { session: record.session } : {}),
    notes: uniqueNotes(previous.notes, record.note),
  };
  if (options.stage === "framing") {
    // What they were looking at, so that a later rewrite of the criteria is
    // visible rather than silent. Closure is arithmetic now; this is what makes
    // the arithmetic run against the framing they actually agreed to.
    review[options.stage] = {
      ...(record_(review[options.stage]) ?? {}),
      framing_digest: framingDigest(document),
    };
  }
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

/**
 * A delivery whose pages nobody has approved, in a part of the project this
 * framing rests on.
 *
 * Making closure mechanical moved the maintainer's reading to promotion, and a
 * queue that blocks nothing is a queue nobody opens: nineteen captures sat
 * unread for a week in the repository this was built against. So the promotion
 * queue blocks the one thing that is actually wrong while it is unread. Aligning
 * a new framing means reading the curated pages for its Area and settling the
 * work against them. If the last delivery in that Area has not been folded in,
 * those pages are knowingly behind, and the alignment that rests on them is
 * telling the maintainer something the project has already stopped believing.
 *
 * The cost lands where it is owed. Nothing is nagged, nothing is chased, and the
 * reading is asked for at the moment it changes an answer — which is also the
 * moment the maintainer is already looking at this Area.
 */
async function unpromotedAreas(
  knowledgeRoot: string,
  document: WorkSpecDocument,
): Promise<string[]> {
  const alignment = record(document.metadata.knowledge_alignment);
  const areas = new Set(
    stringArray(alignment?.reviewed).map(areaOf).filter(Boolean),
  );
  if (areas.size === 0) {
    return [];
  }
  const blocking: string[] = [];
  for (const entry of await pendingPromotions(knowledgeRoot)) {
    // Both what it would write and what it read. A decision page carries no Area
    // in its path, so matching on the drafts alone missed exactly the case this
    // exists for: work that settled a question about an Area and recorded the
    // answer as a decision. What the delivered work aligned itself to is the
    // part of the project it touched, whatever kind of page carries the answer.
    const touched = [
      ...entry.drafts,
      ...stringArray(record(entry.document.metadata.knowledge_alignment)?.reviewed),
    ];
    const shared = [...new Set(touched.map(areaOf).filter((area) => areas.has(area)))];
    if (shared.length === 0) {
      continue;
    }
    blocking.push(
      `${stringValue_(entry.document.metadata.title) || entry.id} has not been folded into ${
        shared.join(" and ")
      } (${entry.id})`,
    );
  }
  return blocking;
}

function record_(value: unknown): Record<string, unknown> | undefined {
  return record(value);
}

function recordArray_(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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

  // Where a closed bundle goes says what is left to do with it. Pages written
  // and unapproved keep it in the promotion queue, which is the queue the
  // maintainer reads; everything else is history the moment it closes. The
  // directory is the state, so nothing has to be scanned to find the queue and
  // nothing has to be kept in step with it.
  const promotionPending = record(document.metadata.knowledge_promotion)?.status === "pending"
    && options.outcome === "completed";
  const archivePath = join(
    context.knowledgeRoot,
    promotionPending ? PROMOTION_DIRECTORY : "changes/archive",
    options.id,
  );
  await assertAbsent(archivePath, promotionPending ? "promotion queue" : "archive");
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
    lastCompleted: promotionPending
      ? "Completion gates passed and the bundle closed; its pages wait to be promoted."
      : "Completion gates passed and the bundle was archived.",
    nextAction: promotionPending
      ? "Put the pages to the maintainer: wfctl work ask <id> --stage promotion."
      : "None — this bundle is closed.",
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
    ...(options.handoff ? { handoff: options.handoff } : {}),
    currentState: options.currentState,
    ...(options.lastCompleted ? { lastCompleted: options.lastCompleted } : {}),
    nextAction: options.nextAction,
    blockers: options.blockers ?? [],
    ...(options.todo ? { todo: options.todo } : {}),
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

export async function reopenWorkIssue(
  target: string,
  id: string,
  issueId: string,
  reason: string,
  now = new Date(),
): Promise<WorkIssueSummary> {
  const context = await requireWorkContext(await realpath(resolve(target)), id);
  // No claim context: reopening is a correction to the record, made from the
  // knowledge repository, and demanding a bound source checkout for it would
  // require standing in the tree whose contents were just withdrawn.
  return await reopenBundleIssue(dirname(context.specPath), issueId, reason, now);
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
    throw new Error(await ambiguousResumeMessage(results));
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

/**
 * Refuse to choose, and hand over what decides it.
 *
 * A refusal that lists six titles and says "ask the maintainer" sends them a
 * question the records have already answered. The agent then either obeys and
 * wastes their turn, or overrides the tool and is right by luck — and nothing
 * separates the session where overriding was right from the one where it was
 * not. Making obedience the wrong move is worse than a wrong answer, because it
 * teaches that the tool's instructions are advisory.
 *
 * There is no invariant that picks a record here, which is why this still does
 * not pick one. What there is, per candidate, is a fact recorded by an explicit
 * act: an issue claimed by an actor at a time, against a commit. One record
 * holding a claim and the rest waiting on the maintainer is not ambiguous, and
 * saying so costs nothing. Two claims, or none, and the choice is genuinely
 * theirs — which is what the last line says, rather than assuming it.
 */
async function ambiguousResumeMessage(results: WorkStatusResult[]): Promise<string> {
  const lines: string[] = [];
  const inFlight: string[] = [];
  for (const entry of results) {
    let claim = "";
    try {
      const inspection = await inspectBundle(entry.bundleRoot, "resume");
      const claimed = inspection.issues.find((issue) => issue.claimed);
      if (claimed) {
        claim = `${claimed.id} claimed by ${claimed.claimedBy || "an unnamed actor"}`;
        inFlight.push(entry.id);
      }
    } catch {
      claim = "cannot be inspected right now";
    }
    lines.push(
      `- ${entry.id} — ${entry.title}\n  ${claim || "nothing claimed; waiting on the maintainer"}`,
    );
  }
  const verdict = inFlight.length === 1
    ? `\nOne record has work in flight: ${inFlight[0]}. Resume that one rather than asking.`
    : inFlight.length === 0
    ? "\nNo record has work in flight, so which outcome to resume is the maintainer's to say."
    : `\n${inFlight.length} records have work in flight, so which one to resume is the maintainer's to say.`;
  return `Multiple active work records are bound to this checkout; do not guess which one owns `
    + `this session:\n${lines.join("\n")}\n${verdict}`;
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
