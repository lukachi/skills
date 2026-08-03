import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { allWorkflowSkills } from "./planner.js";
import { readPinnedGitTextRange } from "./pinned-git-read.js";

export const RECONSTRUCTION_COVERAGE_VERSION = 1;

export const FILE_CATEGORIES = [
  "unclassified",
  "source",
  "test",
  "contract",
  "configuration",
  "product-data",
  "documentation",
  "generated",
  "binary-asset",
  "vendor",
  "submodule",
  "workflow-asset",
  "other",
] as const;

export const COVERAGE_STATES = [
  "pending",
  "inspected",
  "structural-only",
  "irrelevant",
  "blocked",
] as const;

export const SURFACE_KINDS = [
  "entrypoint",
  "runtime",
  "boundary",
] as const;

export type FileCategory = typeof FILE_CATEGORIES[number];
export type CoverageState = typeof COVERAGE_STATES[number];
export type SurfaceKind = typeof SURFACE_KINDS[number];

interface GitTreeEntry {
  mode: string;
  objectType: string;
  objectId: string;
  size: number | null;
  path: string;
}

interface GraphCommunitySnapshot {
  id: string;
  name: string;
  files: string[];
}

interface GraphSnapshot {
  contentHash: string;
  nodes: number;
  indexedFiles: Map<string, string[]>;
  communities: GraphCommunitySnapshot[];
  untrackedSources: string[];
}

export interface SourceReadReceipt {
  id: string;
  objectId: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  actor: string;
  readAt: string;
}

export interface ReconstructionCoverageFile {
  path: string;
  mode: string;
  objectType: string;
  objectId: string;
  size: number | null;
  category: FileCategory;
  graph: {
    indexed: boolean;
    communities: string[];
  };
  status: CoverageState;
  reason: string;
  receipts: SourceReadReceipt[];
}

export interface ReconstructionCoverageCommunity {
  id: string;
  name: string;
  files: string[];
  status: CoverageState;
  note: string;
  queries: string[];
}

export interface ReconstructionCoverageSurface {
  id: string;
  kind: SurfaceKind;
  description: string;
  paths: string[];
  status: CoverageState;
  note: string;
  candidateIds: string[];
}

export interface ReconstructionCoverageLedger {
  coverageVersion: 1;
  repository: string;
  commit: string;
  generatedAt: string;
  manifest: {
    contentHash: string;
    files: ReconstructionCoverageFile[];
  };
  graphify: {
    contentHash: string;
    nodes: number;
    untrackedSources: string[];
    communities: ReconstructionCoverageCommunity[];
  };
  surfaceAudit: {
    status: "pending" | "reviewed" | "not-relevant" | "blocked";
    note: string;
  };
  surfaces: ReconstructionCoverageSurface[];
}

export interface CoverageSummary {
  repository: string;
  commit: string;
  files: number;
  fileStates: Record<CoverageState, number>;
  categories: Record<FileCategory, number>;
  graphIndexedFiles: number;
  graphUnindexedFiles: number;
  communities: number;
  communityStates: Record<CoverageState, number>;
  untrackedGraphSources: number;
  surfaces: number;
  surfaceStates: Record<CoverageState, number>;
  surfaceAudit: string;
  outstandingFiles: Array<{
    path: string;
    category: FileCategory;
    status: CoverageState;
    graphIndexed: boolean;
    readRanges: string[];
    totalLines: number | null;
  }>;
  outstandingCommunities: Array<{
    id: string;
    name: string;
    status: CoverageState;
  }>;
  outstandingSurfaces: Array<{
    id: string;
    kind: SurfaceKind;
    status: CoverageState;
  }>;
  untrackedGraphSourcePaths: string[];
}

export interface ReadPinnedSourceResult {
  repository: string;
  commit: string;
  path: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  complete: boolean;
  receiptId: string;
  content: string;
}

const FINAL_TEXT_CATEGORIES = new Set<FileCategory>([
  "source",
  "test",
  "contract",
  "configuration",
  "product-data",
  "documentation",
]);

export async function createReconstructionCoverage(
  root: string,
  repository: string,
  commit: string,
  graphPath: string,
  now: Date,
): Promise<ReconstructionCoverageLedger> {
  const tree = await readGitTree(root, commit);
  if (tree.length === 0) {
    throw new Error(`${repository}: pinned Git tree contains no tracked entries`);
  }
  const graph = await readGraphSnapshot(root, graphPath, tree, commit);
  const workflow = await readWorkflowOwnership(root, tree);
  const files = tree.map((entry): ReconstructionCoverageFile => {
    const communities = graph.indexedFiles.get(entry.path) ?? [];
    const owned = workflow.owned.has(entry.path);
    const shared = workflow.shared.has(entry.path);
    return {
      path: entry.path,
      mode: entry.mode,
      objectType: entry.objectType,
      objectId: entry.objectId,
      size: entry.size,
      category: owned || shared ? "workflow-asset" : classifyFile(entry),
      graph: {
        indexed: communities.length > 0,
        communities,
      },
      status: owned ? "irrelevant" : "pending",
      reason: owned ? WORKFLOW_ASSET_REASON : "",
      receipts: [],
    };
  });

  return {
    coverageVersion: RECONSTRUCTION_COVERAGE_VERSION,
    repository,
    commit,
    generatedAt: now.toISOString(),
    manifest: {
      contentHash: treeContentHash(tree),
      files,
    },
    graphify: {
      contentHash: graph.contentHash,
      nodes: graph.nodes,
      untrackedSources: graph.untrackedSources,
      communities: graph.communities.map((community) => ({
        ...community,
        status: "pending",
        note: "",
        queries: [],
      })),
    },
    surfaceAudit: {
      status: "pending",
      note: "",
    },
    surfaces: inferSurfaceCandidates(tree),
  };
}

export type CoverageRebaseKind = "unchanged" | "modified" | "added" | "removed";

export interface CoverageRebaseChange {
  path: string;
  kind: CoverageRebaseKind;
  previousStatus: CoverageState;
  droppedReceipts: string[];
}

export interface CoverageRebaseResult {
  ledger: ReconstructionCoverageLedger;
  fromCommit: string;
  toCommit: string;
  counts: Record<CoverageRebaseKind, number>;
  changes: CoverageRebaseChange[];
  invalidatedReceipts: string[];
}

/**
 * Move a coverage ledger from the commit it was frozen at to a later one
 * without discarding the reading behind it.
 *
 * The comparison is content-addressed rather than heuristic: every manifest
 * entry and every receipt already carries the Git blob `objectId`, so a path
 * whose blob is byte-identical at the new commit carries its disposition and
 * receipts across verbatim, because they were assertions about that exact
 * content. A blob that changed returns to `pending` and loses its receipts,
 * which is the conservative reading — a receipt covers line ranges of the old
 * object and says nothing about the new one. Ownership is recomputed rather
 * than carried, since which files belong to the workflow is a fact about the
 * new commit.
 */
export async function rebaseReconstructionCoverage(
  previous: ReconstructionCoverageLedger,
  root: string,
  commit: string,
  graphPath: string,
  now: Date,
): Promise<CoverageRebaseResult> {
  const fresh = await createReconstructionCoverage(
    root,
    previous.repository,
    commit,
    graphPath,
    now,
  );
  const before = new Map(previous.manifest.files.map((file) => [file.path, file]));
  const counts: Record<CoverageRebaseKind, number> = {
    unchanged: 0,
    modified: 0,
    added: 0,
    removed: 0,
  };
  const changes: CoverageRebaseChange[] = [];
  const invalidatedReceipts: string[] = [];

  for (const file of fresh.manifest.files) {
    const prior = before.get(file.path);
    before.delete(file.path);
    if (!prior) {
      counts.added += 1;
      continue;
    }
    if (prior.objectId !== file.objectId) {
      counts.modified += 1;
      const dropped = prior.receipts.map((receipt) => receipt.id);
      invalidatedReceipts.push(...dropped);
      changes.push({
        path: file.path,
        kind: "modified",
        previousStatus: prior.status,
        droppedReceipts: dropped,
      });
      continue;
    }
    counts.unchanged += 1;
    // `workflow-asset` is decided by the new commit's ownership records, so a
    // fresh verdict wins on the category. The disposition is a separate
    // assertion about this exact blob and carries regardless: dropping it for
    // ownership reasons silently returned already-read files to `pending`.
    if (file.category !== "workflow-asset") {
      file.category = prior.category;
    }
    file.status = prior.status;
    file.reason = prior.reason;
    file.receipts = prior.receipts;
  }

  for (const gone of before.values()) {
    counts.removed += 1;
    const dropped = gone.receipts.map((receipt) => receipt.id);
    invalidatedReceipts.push(...dropped);
    changes.push({
      path: gone.path,
      kind: "removed",
      previousStatus: gone.status,
      droppedReceipts: dropped,
    });
  }

  // Community and surface identities survive a graph rebuild only when the
  // structure they name survives it, so carry by id and let the rest reset.
  const priorCommunities = new Map(
    previous.graphify.communities.map((community) => [community.id, community]),
  );
  fresh.graphify.communities = fresh.graphify.communities.map((community) => {
    const prior = priorCommunities.get(community.id);
    return prior
      ? { ...community, status: prior.status, note: prior.note, queries: prior.queries }
      : community;
  });
  const priorSurfaces = new Map(
    previous.surfaces.map((surface) => [surface.id, surface]),
  );
  fresh.surfaces = fresh.surfaces.map((surface) => {
    const prior = priorSurfaces.get(surface.id);
    return prior ? { ...surface, ...prior } : surface;
  });
  for (const surface of previous.surfaces) {
    if (!fresh.surfaces.some((entry) => entry.id === surface.id)) {
      fresh.surfaces.push(surface);
    }
  }
  const moved = counts.modified + counts.added + counts.removed;
  fresh.surfaceAudit = moved === 0
    ? previous.surfaceAudit
    : {
      status: "pending",
      note: `Reset by a repin from ${previous.commit} to ${commit}; `
        + `${moved} manifest entries moved.`,
    };

  return {
    ledger: fresh,
    fromCommit: previous.commit,
    toCommit: commit,
    counts,
    changes: changes.sort((left, right) => left.path.localeCompare(right.path)),
    invalidatedReceipts: [...new Set(invalidatedReceipts)].sort(),
  };
}

export async function readReconstructionCoverage(
  path: string,
): Promise<ReconstructionCoverageLedger> {
  return parseCoverage(await readFile(path, "utf8"));
}

export async function writeReconstructionCoverage(
  path: string,
  ledger: ReconstructionCoverageLedger,
): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function validateReconstructionCoverage(
  ledger: ReconstructionCoverageLedger,
  root: string,
  repository: string,
  commit: string,
  graphPath: string,
): Promise<string[]> {
  const issues = validateReconstructionCoverageReceipt(
    ledger,
    repository,
    commit,
  );

  const expectedTree = await readGitTree(root, commit);
  const expectedGraph = await readGraphSnapshot(
    root,
    graphPath,
    expectedTree,
    commit,
  );
  if (ledger.manifest.contentHash !== treeContentHash(expectedTree)) {
    issues.push("coverage Git manifest hash does not match the pinned tree");
  }
  if (ledger.graphify.contentHash !== expectedGraph.contentHash) {
    issues.push("coverage Graphify hash does not match the bound graph");
  }
  if (ledger.graphify.nodes !== expectedGraph.nodes) {
    issues.push("coverage Graphify node count does not match the bound graph");
  }
  if (
    JSON.stringify([...ledger.graphify.untrackedSources].sort())
    !== JSON.stringify(expectedGraph.untrackedSources)
  ) {
    issues.push("coverage Graphify-only source list does not match the bound graph");
  }
  if (ledger.graphify.untrackedSources.length > 0) {
    issues.push(
      `Graphify contains ${ledger.graphify.untrackedSources.length} source path(s) outside the pinned Git tree`,
    );
  }

  issues.push(...validateFiles(ledger, expectedTree, expectedGraph));
  issues.push(...validateCommunities(ledger, expectedGraph));
  issues.push(...validateSurfaces(ledger));
  return [...new Set(issues)];
}

export function validateReconstructionCoverageReceipt(
  ledger: ReconstructionCoverageLedger,
  repository: string,
  commit: string,
): string[] {
  const issues: string[] = [];
  if (ledger.coverageVersion !== RECONSTRUCTION_COVERAGE_VERSION) {
    issues.push(`coverageVersion must be ${RECONSTRUCTION_COVERAGE_VERSION}`);
  }
  if (ledger.repository !== repository || ledger.commit !== commit) {
    issues.push("coverage repository or commit does not match the reconstruction");
  }
  if (!isIsoDateTime(ledger.generatedAt)) {
    issues.push("coverage generatedAt must be an ISO date-time");
  }
  if (!/^[0-9a-f]{64}$/i.test(ledger.manifest.contentHash)) {
    issues.push("coverage Git manifest content hash is invalid");
  }
  const receiptTree = ledger.manifest.files.map((file) => ({
    mode: file.mode,
    objectType: file.objectType,
    objectId: file.objectId,
    size: file.size,
    path: file.path,
  })).sort((left, right) => left.path.localeCompare(right.path));
  if (treeContentHash(receiptTree) !== ledger.manifest.contentHash) {
    issues.push("coverage Git manifest receipt hash is invalid");
  }
  if (
    !/^[0-9a-f]{64}$/i.test(ledger.graphify.contentHash)
    || !Number.isInteger(ledger.graphify.nodes)
    || ledger.graphify.nodes < 1
  ) {
    issues.push("coverage Graphify receipt must pin a non-empty graph");
  }
  if (ledger.graphify.untrackedSources.length > 0) {
    issues.push(
      `Graphify contains ${ledger.graphify.untrackedSources.length} source path(s) outside the pinned Git tree`,
    );
  }

  const seenFiles = new Set<string>();
  for (const file of ledger.manifest.files) {
    if (!file.path || seenFiles.has(file.path)) {
      issues.push(`coverage manifest has a missing or duplicated path: ${file.path}`);
    }
    seenFiles.add(file.path);
    if (!/^[0-9a-f]{40,64}$/i.test(file.objectId)) {
      issues.push(`${file.path}: pinned Git object ID is invalid`);
    }
    if (!FILE_CATEGORIES.includes(file.category)) {
      issues.push(`${file.path}: unknown file category ${String(file.category)}`);
    } else if (file.category === "unclassified") {
      issues.push(`${file.path}: file category remains unclassified`);
    }
    if (!COVERAGE_STATES.includes(file.status)) {
      issues.push(`${file.path}: unknown coverage status ${String(file.status)}`);
      continue;
    }
    if (file.status === "pending") {
      issues.push(`${file.path}: file coverage is pending`);
    } else if (file.status === "blocked") {
      issues.push(`${file.path}: file coverage is blocked`);
    }
    if (
      ["structural-only", "irrelevant", "blocked"].includes(file.status)
      && !file.reason.trim()
    ) {
      issues.push(`${file.path}: ${file.status} status requires a reason`);
    }
    if (file.status === "structural-only" && FINAL_TEXT_CATEGORIES.has(file.category)) {
      issues.push(`${file.path}: ${file.category} cannot finish as structural-only`);
    }
    if (file.status === "inspected") {
      if (
        file.receipts.some((receipt) =>
          receipt.id !== sourceReadReceiptId({
            repository: ledger.repository,
            commit: ledger.commit,
            path: file.path,
            objectId: receipt.objectId,
            startLine: receipt.startLine,
            endLine: receipt.endLine,
            totalLines: receipt.totalLines,
            actor: receipt.actor,
          })
          || receipt.objectId !== file.objectId
          || !Number.isInteger(receipt.totalLines)
          || receipt.totalLines < 0
          || !Number.isInteger(receipt.startLine)
          || !Number.isInteger(receipt.endLine)
          || (
            receipt.totalLines === 0
              ? receipt.startLine !== 0 || receipt.endLine !== 0
              : receipt.startLine < 1
                || receipt.endLine < receipt.startLine
                || receipt.endLine > receipt.totalLines
          )
          || !isIsoDateTime(receipt.readAt)
          || !receipt.actor.trim()
        )
      ) {
        issues.push(`${file.path}: read receipt identity or metadata is invalid`);
      }
      // Zero receipts with a stated reason is the blob the reader refuses to
      // stamp — `wfctl knowledge reconstruct files` verifies that against the
      // pinned object before it will accept the status, and the reason records
      // how the file was actually read. Partial receipts stay an error: that is
      // an unfinished read rather than an unreadable object.
      if (file.receipts.length > 0 && !receiptsCoverFile(file.receipts)) {
        issues.push(`${file.path}: inspected file lacks gap-free full-read receipts`);
      } else if (file.receipts.length === 0 && !file.reason.trim()) {
        issues.push(
          `${file.path}: inspected file has no receipts and no reason naming how it `
            + "was read",
        );
      }
    }
  }

  const seenCommunities = new Set<string>();
  for (const community of ledger.graphify.communities) {
    if (!community.id || seenCommunities.has(community.id)) {
      issues.push(`Graphify community has a missing or duplicated ID: ${community.id}`);
    }
    seenCommunities.add(community.id);
    // A community is a second index over files the Git manifest already
    // accounts for, so a per-community disposition adds no completeness and
    // asks a question communities cannot answer: they are technical clusters,
    // never product concepts. Requiring one produced thousands of verdicts
    // nobody could mean, which is how a whole lane came to be closed by script.
    // Communities stay navigation; the evidence requirement lives on the claims
    // they support. Reconciliation against the manifest is kept, because that
    // is the one thing this index can prove.
    if (!COVERAGE_STATES.includes(community.status)) {
      issues.push(`Graphify community ${community.id} has an unknown status`);
    }
    if (
      community.status !== "pending"
      && community.status !== "blocked"
      && !community.note.trim()
    ) {
      issues.push(`Graphify community ${community.id} requires a review note`);
    }
    if (community.status === "inspected" && community.queries.length === 0) {
      issues.push(`Graphify community ${community.id} requires a recorded query`);
    }
    for (const path of community.files) {
      if (!seenFiles.has(path)) {
        issues.push(`Graphify community ${community.id} references unknown file: ${path}`);
      }
    }
  }
  issues.push(...validateSurfaces(ledger));
  return [...new Set(issues)];
}

export function summarizeReconstructionCoverage(
  ledger: ReconstructionCoverageLedger,
): CoverageSummary {
  const fileStates = countValues(COVERAGE_STATES, ledger.manifest.files, "status");
  const categories = countValues(FILE_CATEGORIES, ledger.manifest.files, "category");
  const communityStates = countValues(
    COVERAGE_STATES,
    ledger.graphify.communities,
    "status",
  );
  const surfaceStates = countValues(COVERAGE_STATES, ledger.surfaces, "status");
  const graphIndexedFiles = ledger.manifest.files.filter(
    (file) => file.graph.indexed,
  ).length;
  return {
    repository: ledger.repository,
    commit: ledger.commit,
    files: ledger.manifest.files.length,
    fileStates,
    categories,
    graphIndexedFiles,
    graphUnindexedFiles: ledger.manifest.files.length - graphIndexedFiles,
    communities: ledger.graphify.communities.length,
    communityStates,
    untrackedGraphSources: ledger.graphify.untrackedSources.length,
    surfaces: ledger.surfaces.length,
    surfaceStates,
    surfaceAudit: ledger.surfaceAudit.status,
    outstandingFiles: ledger.manifest.files
      .filter((file) =>
        file.category === "unclassified"
        || file.status === "pending"
        || file.status === "blocked"
      )
      .map((file) => ({
        path: file.path,
        category: file.category,
        status: file.status,
        graphIndexed: file.graph.indexed,
        readRanges: file.receipts.map(
          (receipt) => `${receipt.startLine}-${receipt.endLine}`,
        ),
        totalLines: file.receipts[0]?.totalLines ?? null,
      })),
    outstandingCommunities: ledger.graphify.communities
      .filter((community) =>
        community.status === "pending" || community.status === "blocked"
      )
      .map((community) => ({
        id: community.id,
        name: community.name,
        status: community.status,
      })),
    outstandingSurfaces: ledger.surfaces
      .filter((surface) =>
        surface.status === "pending" || surface.status === "blocked"
      )
      .map((surface) => ({
        id: surface.id,
        kind: surface.kind,
        status: surface.status,
      })),
    untrackedGraphSourcePaths: [...ledger.graphify.untrackedSources],
  };
}

export function markCoverageFiles(
  ledger: ReconstructionCoverageLedger,
  patterns: string[],
  mutation: {
    category?: FileCategory;
    status?: CoverageState;
    reason?: string;
    /**
     * Paths the read command cannot receipt for a mechanical reason — a NUL
     * byte inside otherwise ordinary UTF-8 source is the observed case. The
     * file was read, and the tool refusing to stamp it is a fact about the
     * tool. Without this the entry has no honest terminal state at all:
     * receipts are impossible, `structural-only` cannot close product-bearing
     * text, `irrelevant` would be a lie, and `blocked` fails the gate forever.
     */
    unreceiptable?: ReadonlySet<string>;
  },
): number {
  if (patterns.length === 0) {
    throw new Error("At least one file pattern is required");
  }
  if (mutation.category === undefined && mutation.status === undefined) {
    throw new Error("File marking requires a category or status");
  }
  const matchers = patterns.map(filePatternMatcher);
  const matches = ledger.manifest.files.filter((file) =>
    matchers.some((matcher) => matcher(file.path))
  );
  if (matches.length === 0) {
    throw new Error(`No manifest files match: ${patterns.join(", ")}`);
  }
  const reason = mutation.reason?.trim() ?? "";
  if (
    mutation.status !== undefined
    && ["structural-only", "irrelevant", "blocked"].includes(mutation.status)
    && !reason
  ) {
    throw new Error(`${mutation.status} file status requires --reason`);
  }
  for (const file of matches) {
    if (mutation.category !== undefined) {
      file.category = mutation.category;
    }
    if (mutation.status !== undefined) {
      const unreceiptable = mutation.unreceiptable?.has(file.path) === true;
      if (
        mutation.status === "inspected"
        && !receiptsCoverFile(file.receipts)
        && !unreceiptable
      ) {
        throw new Error(
          `${file.path}: inspected status requires complete wfctl read receipts`,
        );
      }
      if (mutation.status === "inspected" && unreceiptable && !reason) {
        throw new Error(
          `${file.path}: cannot be receipted, so inspected status requires `
            + "--reason naming how it was read",
        );
      }
      file.status = mutation.status;
      file.reason = mutation.status === "pending"
        ? ""
        : mutation.status === "inspected" && !unreceiptable
        ? ""
        : reason;
    }
  }
  return matches.length;
}

export function markCoverageCommunity(
  ledger: ReconstructionCoverageLedger,
  communityId: string,
  status: CoverageState,
  note: string,
  queries: string[],
): void {
  const community = ledger.graphify.communities.find(
    (entry) => entry.id === communityId,
  );
  if (!community) {
    throw new Error(`Unknown Graphify community: ${communityId}`);
  }
  if (status === "pending") {
    throw new Error("Community status must be final or blocked");
  }
  if (!note.trim()) {
    throw new Error(`${status} community status requires --note`);
  }
  const normalizedQueries = uniqueStrings(queries.map((query) => query.trim()));
  if (status === "inspected" && normalizedQueries.length === 0) {
    throw new Error("Inspected community requires at least one --query");
  }
  community.status = status;
  community.note = note.trim();
  community.queries = normalizedQueries;
}

export function recordCoverageSurface(
  ledger: ReconstructionCoverageLedger,
  input: {
    id: string;
    kind: SurfaceKind;
    description: string;
    paths: string[];
    status: CoverageState;
    note: string;
    candidateIds: string[];
  },
): void {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(input.id)) {
    throw new Error("Surface ID must be a stable lowercase identifier");
  }
  if (input.status === "pending") {
    throw new Error("Surface status must be final or blocked");
  }
  if (!input.description.trim() || !input.note.trim()) {
    throw new Error("Surface description and note are required");
  }
  const paths = uniqueStrings(input.paths);
  if (paths.length === 0) {
    throw new Error("Surface must identify at least one manifest path");
  }
  const manifestPaths = new Set(ledger.manifest.files.map((file) => file.path));
  for (const path of paths) {
    if (!manifestPaths.has(path)) {
      throw new Error(`Surface path is outside the pinned manifest: ${path}`);
    }
  }
  const surface: ReconstructionCoverageSurface = {
    id: input.id,
    kind: input.kind,
    description: input.description.trim(),
    paths,
    status: input.status,
    note: input.note.trim(),
    candidateIds: uniqueStrings(input.candidateIds),
  };
  let index = ledger.surfaces.findIndex((entry) => entry.id === input.id);
  if (index === -1) {
    index = ledger.surfaces.findIndex(
      (entry) =>
        entry.status === "pending"
        && entry.id.startsWith("auto-")
        && entry.kind === input.kind
        && sameStrings(entry.paths, paths),
    );
  }
  if (index === -1) {
    ledger.surfaces.push(surface);
  } else {
    ledger.surfaces[index] = surface;
  }
  ledger.surfaces.sort((left, right) => left.id.localeCompare(right.id));
}

export function markSurfaceAudit(
  ledger: ReconstructionCoverageLedger,
  status: "reviewed" | "not-relevant" | "blocked",
  note: string,
): void {
  if (!note.trim()) {
    throw new Error(`${status} surface audit requires --note`);
  }
  ledger.surfaceAudit = { status, note: note.trim() };
}

export async function readPinnedSource(
  ledger: ReconstructionCoverageLedger,
  root: string,
  path: string,
  input: {
    startLine?: number;
    endLine?: number;
    actor?: string;
    now?: Date;
  } = {},
): Promise<ReadPinnedSourceResult> {
  const file = ledger.manifest.files.find((entry) => entry.path === path);
  if (!file) {
    throw new Error(`Source path is outside the pinned manifest: ${path}`);
  }
  if (file.objectType !== "blob") {
    throw new Error(`Pinned entry is not a readable blob: ${path}`);
  }
  const read = await readPinnedGitTextRange(
    root,
    ["show", `${ledger.commit}:${path}`],
    {
      ...(input.startLine === undefined ? {} : { startLine: input.startLine }),
      ...(input.endLine === undefined ? {} : { endLine: input.endLine }),
      operationName: `${path}: pinned source read`,
    },
  );
  if (read.kind === "binary") {
    throw new Error(
      `${path} appears binary; classify it explicitly instead of recording a text receipt`,
    );
  }
  if (read.kind !== "text") {
    throw new Error(`${path}: ${read.reason}`);
  }
  const totalLines = read.totalLines;
  const startLine = read.startLine;
  const endLine = read.endLine;
  const actor = input.actor?.trim() || "workflow-agent/1";
  const receiptId = sourceReadReceiptId({
    repository: ledger.repository,
    commit: ledger.commit,
    path,
    objectId: file.objectId,
    startLine,
    endLine,
    totalLines,
    actor,
  });
  const receipt: SourceReadReceipt = {
    id: receiptId,
    objectId: file.objectId,
    startLine,
    endLine,
    totalLines,
    actor,
    readAt: (input.now ?? new Date()).toISOString(),
  };
  // Retrieval never promotes the disposition. Streaming every byte of a blob
  // through this command proves the bytes were fetched and nothing about
  // whether anyone read them, and a status produced as a side effect of
  // fetching turns the coverage ledger into a download counter that reads like
  // a comprehension measure. Complete receipts stay the precondition for
  // `inspected`; asserting it remains a separate, attributable act.
  file.receipts = mergeReceipts([...file.receipts, receipt]);
  return {
    repository: ledger.repository,
    commit: ledger.commit,
    path,
    startLine,
    endLine,
    totalLines,
    complete: receiptsCoverFile(file.receipts),
    receiptId,
    content: read.content,
  };
}

export function sourceReadReceiptId(input: {
  repository: string;
  commit: string;
  path: string;
  objectId: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  actor: string;
}): string {
  const digest = createHash("sha256").update([
    input.repository,
    input.commit,
    input.path,
    input.objectId,
    String(input.startLine),
    String(input.endLine),
    String(input.totalLines),
    input.actor,
  ].join("\0")).digest("hex");
  return `source-read:${digest.slice(0, 32)}`;
}

export function evidencePathFromResource(
  resource: string,
  repository: string,
  commit: string,
  manifestPaths: string[],
): string | undefined {
  const prefix = `git:${repository}@${commit}#`;
  if (!resource.startsWith(prefix)) {
    return undefined;
  }
  const fragment = resource.slice(prefix.length);
  return [...manifestPaths]
    .sort((left, right) => right.length - left.length)
    .find((path) => fragment === path || fragment.startsWith(`${path}:`));
}

function validateFiles(
  ledger: ReconstructionCoverageLedger,
  expectedTree: GitTreeEntry[],
  expectedGraph: GraphSnapshot,
): string[] {
  const issues: string[] = [];
  const expectedByPath = new Map(expectedTree.map((entry) => [entry.path, entry]));
  const declaredByPath = new Map<string, ReconstructionCoverageFile>();
  for (const file of ledger.manifest.files) {
    if (declaredByPath.has(file.path)) {
      issues.push(`coverage manifest duplicates file: ${file.path}`);
    }
    declaredByPath.set(file.path, file);
  }
  for (const entry of expectedTree) {
    const file = declaredByPath.get(entry.path);
    if (!file) {
      issues.push(`coverage manifest is missing tracked file: ${entry.path}`);
      continue;
    }
    const expectedCommunities = expectedGraph.indexedFiles.get(entry.path) ?? [];
    if (
      file.mode !== entry.mode
      || file.objectType !== entry.objectType
      || file.objectId !== entry.objectId
      || file.size !== entry.size
    ) {
      issues.push(`${entry.path}: coverage Git identity does not match the pinned tree`);
    }
    if (
      file.graph.indexed !== (expectedCommunities.length > 0)
      || JSON.stringify(file.graph.communities) !== JSON.stringify(expectedCommunities)
    ) {
      issues.push(`${entry.path}: Graphify coverage does not match the bound graph`);
    }
    if (!FILE_CATEGORIES.includes(file.category)) {
      issues.push(`${entry.path}: unknown file category ${String(file.category)}`);
    } else if (file.category === "unclassified") {
      issues.push(`${entry.path}: file category remains unclassified`);
    }
    if (!COVERAGE_STATES.includes(file.status)) {
      issues.push(`${entry.path}: unknown coverage status ${String(file.status)}`);
      continue;
    }
    if (file.status === "pending") {
      issues.push(`${entry.path}: file coverage is pending`);
    }
    if (file.status === "blocked") {
      issues.push(`${entry.path}: file coverage is blocked`);
    }
    if (
      ["structural-only", "irrelevant", "blocked"].includes(file.status)
      && !file.reason.trim()
    ) {
      issues.push(`${entry.path}: ${file.status} status requires a reason`);
    }
    if (file.status === "structural-only" && FINAL_TEXT_CATEGORIES.has(file.category)) {
      issues.push(
        `${entry.path}: ${file.category} cannot finish as structural-only`,
      );
    }
    if (file.status === "inspected") {
      if (entry.objectType !== "blob") {
        issues.push(`${entry.path}: non-blob entry cannot be text-inspected`);
      }
    }
  }
  for (const file of ledger.manifest.files) {
    if (!expectedByPath.has(file.path)) {
      issues.push(`coverage manifest contains a file outside the pinned tree: ${file.path}`);
    }
  }
  return issues;
}

function validateCommunities(
  ledger: ReconstructionCoverageLedger,
  expectedGraph: GraphSnapshot,
): string[] {
  const issues: string[] = [];
  const expectedById = new Map(
    expectedGraph.communities.map((community) => [community.id, community]),
  );
  const declaredById = new Map<string, ReconstructionCoverageCommunity>();
  for (const community of ledger.graphify.communities) {
    if (declaredById.has(community.id)) {
      issues.push(`Graphify community is duplicated: ${community.id}`);
    }
    declaredById.set(community.id, community);
  }
  for (const expected of expectedGraph.communities) {
    const community = declaredById.get(expected.id);
    if (!community) {
      issues.push(`Graphify community is missing from coverage: ${expected.id}`);
      continue;
    }
    if (
      community.name !== expected.name
      || JSON.stringify(community.files) !== JSON.stringify(expected.files)
    ) {
      issues.push(`Graphify community ${expected.id} does not match the bound graph`);
    }
    if (!COVERAGE_STATES.includes(community.status)) {
      issues.push(`Graphify community ${expected.id} has an unknown status`);
    }
    if (
      community.status !== "pending"
      && community.status !== "blocked"
      && !community.note.trim()
    ) {
      issues.push(`Graphify community ${expected.id} requires a review note`);
    }
    if (community.status === "inspected" && community.queries.length === 0) {
      issues.push(`Graphify community ${expected.id} requires a recorded query`);
    }
  }
  for (const community of ledger.graphify.communities) {
    if (!expectedById.has(community.id)) {
      issues.push(`coverage contains an unknown Graphify community: ${community.id}`);
    }
  }
  return issues;
}

function validateSurfaces(ledger: ReconstructionCoverageLedger): string[] {
  const issues: string[] = [];
  if (
    !["reviewed", "not-relevant", "blocked"].includes(ledger.surfaceAudit.status)
  ) {
    issues.push("entrypoint/runtime surface audit is pending");
  } else if (ledger.surfaceAudit.status === "blocked") {
    issues.push("entrypoint/runtime surface audit is blocked");
  }
  if (
    ledger.surfaceAudit.status !== "pending"
    && !ledger.surfaceAudit.note.trim()
  ) {
    issues.push("entrypoint/runtime surface audit requires a note");
  }
  const manifestPaths = new Set(ledger.manifest.files.map((file) => file.path));
  const seen = new Set<string>();
  for (const surface of ledger.surfaces) {
    if (seen.has(surface.id)) {
      issues.push(`entrypoint/runtime surface is duplicated: ${surface.id}`);
    }
    seen.add(surface.id);
    if (!SURFACE_KINDS.includes(surface.kind)) {
      issues.push(`${surface.id}: unknown surface kind`);
    }
    if (!surface.description.trim() || !surface.note.trim()) {
      issues.push(`${surface.id}: surface description and note are required`);
    }
    if (surface.paths.length === 0) {
      issues.push(`${surface.id}: surface must identify manifest paths`);
    }
    for (const path of surface.paths) {
      if (!manifestPaths.has(path)) {
        issues.push(`${surface.id}: surface path is outside the manifest: ${path}`);
      }
    }
    if (surface.status === "pending") {
      issues.push(`${surface.id}: surface coverage is pending`);
    } else if (surface.status === "blocked") {
      issues.push(`${surface.id}: surface coverage is blocked`);
    }
  }
  if (ledger.surfaceAudit.status === "not-relevant" && ledger.surfaces.length > 0) {
    issues.push("surface audit cannot be not-relevant while surfaces are recorded");
  }
  return issues;
}

function parseCoverage(content: string): ReconstructionCoverageLedger {
  const value = JSON.parse(content) as Partial<ReconstructionCoverageLedger>;
  if (
    value === null
    || typeof value !== "object"
    || value.coverageVersion !== RECONSTRUCTION_COVERAGE_VERSION
    || typeof value.repository !== "string"
    || typeof value.commit !== "string"
    || value.manifest === undefined
    || !Array.isArray(value.manifest.files)
    || value.graphify === undefined
    || !Array.isArray(value.graphify.communities)
    || value.surfaceAudit === undefined
    || !Array.isArray(value.surfaces)
  ) {
    throw new Error("Invalid reconstruction coverage ledger");
  }
  const ledger = value as ReconstructionCoverageLedger;
  for (const file of ledger.manifest.files) {
    file.receipts = (file.receipts ?? []).map((receipt) => ({
      ...receipt,
      id: typeof receipt.id === "string" && receipt.id
        ? receipt.id
        : sourceReadReceiptId({
          repository: ledger.repository,
          commit: ledger.commit,
          path: file.path,
          objectId: receipt.objectId,
          startLine: receipt.startLine,
          endLine: receipt.endLine,
          totalLines: receipt.totalLines,
          actor: receipt.actor,
        }),
    }));
  }
  return ledger;
}

async function readGitTree(root: string, commit: string): Promise<GitTreeEntry[]> {
  const args = ["ls-tree", "-r", "-z", "--full-tree", "-l", commit];
  const child = spawn("git", ["-C", root, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < 64 * 1024) {
      stderr += chunk.slice(0, 64 * 1024 - stderr.length);
    }
  });
  const completion = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  const entries: GitTreeEntry[] = [];
  let pending = Buffer.alloc(0);
  try {
    for await (const value of child.stdout) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk]);
      let terminator = pending.indexOf(0);
      while (terminator >= 0) {
        if (terminator > 0) {
          entries.push(parseGitTreeRecord(pending.subarray(0, terminator)));
        }
        pending = pending.subarray(terminator + 1);
        terminator = pending.indexOf(0);
      }
    }
  } catch (error) {
    child.kill();
    throw error;
  }
  const status = await completion;
  if (status !== 0) {
    throw new Error(
      `Git coverage data unavailable: ${stderr.trim() || args.join(" ")}`,
    );
  }
  if (pending.length > 0) {
    throw new Error("Git coverage data ended with an incomplete tree record");
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function parseGitTreeRecord(input: Buffer): GitTreeEntry {
  const separator = input.indexOf(9);
  const record = input.toString("utf8");
  if (separator < 0) {
    throw new Error(`Cannot parse Git tree entry: ${record}`);
  }
  const header = input.subarray(0, separator).toString("utf8").trim().split(/\s+/);
  const mode = header[0];
  const objectType = header[1];
  const objectId = header[2];
  const sizeText = header[3];
  if (!mode || !objectType || !objectId || !sizeText) {
    throw new Error(`Cannot parse Git tree entry: ${record}`);
  }
  return {
    mode,
    objectType,
    objectId,
    size: sizeText === "-" ? null : Number(sizeText),
    path: input.subarray(separator + 1).toString("utf8"),
  };
}

async function readGraphSnapshot(
  root: string,
  graphPath: string,
  tree: GitTreeEntry[],
  commit: string,
): Promise<GraphSnapshot> {
  const content = await readFile(graphPath);
  const value = JSON.parse(content.toString("utf8")) as {
    nodes?: unknown[];
    built_at_commit?: unknown;
  };
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    throw new Error("Graphify graph contains no nodes");
  }
  if (
    typeof value.built_at_commit === "string"
    && value.built_at_commit
    && value.built_at_commit !== commit
  ) {
    // Graphify skips the write when code topology is unchanged, so a commit
    // touching only excluded or non-code files leaves the pin behind. Verified
    // against graphify 0.9.26: the short circuit happens before export.to_json,
    // which is the only place built_at_commit is stamped. `--force` overrides
    // the shrink guard, not this. Repairing it silently is not this tool's
    // call, so say exactly what happened and what fixes it.
    throw new Error(
      `Graphify graph pins ${value.built_at_commit} but the checkout is at ${commit}. `
        + "This is Graphify leaving graph.json untouched when code topology did not "
        + "change; the source is not corrupt and --force does not refresh the pin. "
        + `Rebuild from a clean file, which preserves the AST cache: rm ${graphPath} `
        + "&& graphify update .",
    );
  }
  const treePaths = new Set(tree.map((entry) => entry.path));
  const indexedFiles = new Map<string, Set<string>>();
  const communityFiles = new Map<string, Set<string>>();
  const communityNames = new Map<string, string>();
  const untracked = new Set<string>();
  for (const valueNode of value.nodes) {
    if (!isRecord(valueNode)) {
      continue;
    }
    const communityId = valueNode.community === undefined
      ? "unassigned"
      : String(valueNode.community);
    const communityName = typeof valueNode.community_name === "string"
      && valueNode.community_name.trim()
      ? valueNode.community_name.trim()
      : communityId === "unassigned"
      ? "Unassigned"
      : `Community ${communityId}`;
    if (!communityFiles.has(communityId)) {
      communityFiles.set(communityId, new Set());
    }
    if (!communityNames.has(communityId)) {
      communityNames.set(communityId, communityName);
    }
    if (typeof valueNode.source_file !== "string") {
      continue;
    }
    if (valueNode.source_file.trim() === "") {
      // Graphify emits synthetic nodes for primitive and library types —
      // `result`, `uuid`, `vec`, `option` — with no source file at all. They
      // are not paths, so hashing the empty string collapsed thousands of them
      // into one bucket that the gate then reported as a source path outside
      // the pinned tree. Nothing is untracked here; there is nothing to track.
      continue;
    }
    const path = normalizeGraphPath(root, valueNode.source_file);
    if (!path) {
      untracked.add(`external:${shortHash(valueNode.source_file)}`);
      continue;
    }
    if (!treePaths.has(path)) {
      untracked.add(path);
      continue;
    }
    const fileCommunities = indexedFiles.get(path) ?? new Set<string>();
    fileCommunities.add(communityId);
    indexedFiles.set(path, fileCommunities);
    const files = communityFiles.get(communityId)!;
    files.add(path);
  }
  const normalizedIndexedFiles = new Map<string, string[]>();
  for (const [path, communities] of indexedFiles) {
    normalizedIndexedFiles.set(path, [...communities].sort(naturalCompare));
  }
  const communities = [...communityFiles].map(([id, files]) => ({
    id,
    name: communityNames.get(id) ?? `Community ${id}`,
    files: [...files].sort(),
  })).sort((left, right) => naturalCompare(left.id, right.id));
  return {
    contentHash: createHash("sha256").update(content).digest("hex"),
    nodes: value.nodes.length,
    indexedFiles: normalizedIndexedFiles,
    communities,
    untrackedSources: [...untracked].sort(),
  };
}

function treeContentHash(entries: GitTreeEntry[]): string {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(
      `${entry.mode}\0${entry.objectType}\0${entry.objectId}\0${entry.size ?? "-"}\0${entry.path}\0`,
    );
  }
  return hash.digest("hex");
}

const WORKFLOW_ASSET_REASON =
  "Installed by wfctl and recorded in its own manifest; it describes agent "
  + "behavior, not this project. Accounted here so the frontier stays complete.";

/**
 * Files wfctl writes into without owning outright: a maintainer's own text may
 * live outside the managed markers. They are named as workflow assets so a
 * reviewer never reads agent instructions as product intent, but they keep a
 * pending disposition because only a reader can tell what else is in them.
 */
const WORKFLOW_SHARED_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  "PROJECT_WORKFLOW.md",
  ".graphifyignore",
  "skills-lock.json",
];

const WORKFLOW_STATE_PATH = ".workflow/state.json";
const SKILLS_LOCK_PATH = "skills-lock.json";
const SKILL_ROOTS = [".claude/skills/", ".agents/skills/"];
// A skill this wfctl does not install is the project's own and stays in scope.
// QMD's native skill is version-matched and installed by wfctl; Graphify's is
// installed by Graphify itself, so it is not claimed here.
const WORKFLOW_SKILL_NAMES = new Set([...allWorkflowSkills(), "qmd"]);

interface WorkflowOwnership {
  owned: Set<string>;
  shared: Set<string>;
}

/**
 * Ownership is an identity fact wfctl already records, never a path pattern.
 * A project may legitimately keep its own skills, rules, and agent files in the
 * same directories; those stay in scope and must still be reviewed.
 */
async function readWorkflowOwnership(
  root: string,
  tree: readonly GitTreeEntry[],
): Promise<WorkflowOwnership> {
  const byPath = new Map(tree.map((entry) => [entry.path, entry]));
  const owned = new Set<string>();
  const shared = new Set<string>();

  const state = await readPinnedJson(root, byPath.get(WORKFLOW_STATE_PATH));
  if (!state) {
    return { owned, shared };
  }
  for (const path of Object.keys(recordValue(state.files) ?? {})) {
    if (byPath.has(path)) {
      owned.add(path);
    }
  }
  owned.add(WORKFLOW_STATE_PATH);
  for (const path of [".workflow/config.json", ".workflow/state.json"]) {
    if (byPath.has(path)) {
      owned.add(path);
    }
  }

  const lock = await readPinnedJson(root, byPath.get(SKILLS_LOCK_PATH));
  const installed = new Set(
    Object.keys(recordValue(lock?.skills) ?? {})
      .filter((skill) => WORKFLOW_SKILL_NAMES.has(skill)),
  );
  if (installed.size > 0) {
    for (const entry of tree) {
      const skill = workflowSkillOf(entry.path);
      if (skill && installed.has(skill)) {
        owned.add(entry.path);
      }
    }
  }

  for (const path of WORKFLOW_SHARED_PATHS) {
    if (byPath.has(path) && !owned.has(path)) {
      shared.add(path);
    }
  }
  return { owned, shared };
}

function workflowSkillOf(path: string): string | undefined {
  for (const skillRoot of SKILL_ROOTS) {
    if (path.startsWith(skillRoot)) {
      return path.slice(skillRoot.length).split("/")[0];
    }
  }
  return undefined;
}

async function readPinnedJson(
  root: string,
  entry: GitTreeEntry | undefined,
): Promise<Record<string, unknown> | undefined> {
  if (!entry || entry.objectType !== "blob") {
    return undefined;
  }
  try {
    const content = await readPinnedBlob(root, entry.objectId);
    return recordValue(JSON.parse(content));
  } catch {
    return undefined;
  }
}

async function readPinnedBlob(root: string, objectId: string): Promise<string> {
  const child = spawn("git", ["-C", root, "cat-file", "blob", objectId], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const completion = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  let content = "";
  child.stdout.setEncoding("utf8");
  child.stderr.resume();
  for await (const chunk of child.stdout) {
    content += chunk as string;
    if (content.length > 4 * 1024 * 1024) {
      child.kill();
      throw new Error(`Pinned blob ${objectId} is too large to parse`);
    }
  }
  if (await completion !== 0) {
    throw new Error(`Cannot read pinned blob ${objectId}`);
  }
  return content;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function classifyFile(entry: GitTreeEntry): FileCategory {
  const path = entry.path.toLowerCase();
  const name = path.split("/").at(-1) ?? path;
  if (entry.objectType === "commit" || entry.mode === "160000") {
    return "submodule";
  }
  if (/(^|\/)(?:node_modules|vendor|third[-_]party|external)\//.test(path)) {
    return "vendor";
  }
  if (
    /(^|\/)(?:dist|build|coverage|target|generated|gen)(?:\/|$)/.test(path)
    || /(?:^|\/)(?:bun\.lockb?|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.ya?ml|yarn\.lock|cargo\.lock|composer\.lock|gemfile\.lock|poetry\.lock|uv\.lock|go\.sum)$/.test(path)
  ) {
    return "generated";
  }
  if (
    /(^|\/)(?:test|tests|spec|specs|__tests__|fixtures)(?:\/|$)/.test(path)
    || /\.(?:test|spec)\.[^.]+$/.test(path)
  ) {
    return "test";
  }
  if (
    /\.(?:proto|graphql|gql|avsc|wsdl|xsd|thrift)$/i.test(path)
    || /(?:^|\/)(?:openapi|asyncapi)(?:\.|\/)/.test(path)
  ) {
    return "contract";
  }
  if (
    /(^|\/)(?:data|content|catalogs?|registries|rules|assets\/data)(?:\/|$)/.test(path)
    && /\.(?:json|jsonc|ya?ml|toml|csv|tsv|xml)$/i.test(path)
  ) {
    return "product-data";
  }
  if (/\.(?:md|mdx|rst|adoc|txt)$/i.test(path)) {
    return "documentation";
  }
  if (
    /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|bz2|xz|7z|woff2?|ttf|otf|mp3|wav|ogg|mp4|mov|webm|wasm|bin)$/i.test(path)
  ) {
    return "binary-asset";
  }
  if (
    /\.(?:c|cc|cpp|cxx|h|hh|hpp|m|mm|swift|rs|go|java|kt|kts|scala|cs|fs|fsx|py|rb|php|lua|pl|pm|sh|bash|zsh|fish|ps1|js|jsx|mjs|cjs|ts|tsx|mts|cts|vue|svelte|astro|css|scss|sass|less|styl|html|htm|sql|r|dart|ex|exs|erl|hrl|clj|cljs|cljc|groovy|sol|zig)$/i.test(path)
  ) {
    return "source";
  }
  if (
    /\.(?:json|jsonc|ya?ml|toml|ini|cfg|conf|properties|env|xml)$/i.test(path)
    || /^\.(?:gitignore|gitattributes|gitmodules|dockerignore|graphifyignore|npmrc|editorconfig)$/.test(name)
    || /^(?:dockerfile|makefile|justfile|procfile|gemfile|rakefile)$/.test(name)
    || /(?:^|\/)(?:tsconfig|jsconfig|eslint|prettier|vite|webpack|rollup|babel|deno|biome|cargo|package)\.[^/]+$/.test(path)
  ) {
    return "configuration";
  }
  return "unclassified";
}

function filePatternMatcher(patternInput: string): (path: string) => boolean {
  const pattern = patternInput.replace(/^\.\//, "");
  if (!pattern.trim()) {
    throw new Error("File pattern must not be empty");
  }
  if (!/[*?]/.test(pattern)) {
    const prefix = pattern.endsWith("/") ? pattern : `${pattern}/`;
    return (path) => path === pattern || path.startsWith(prefix);
  }
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          expression += "(?:.*/)?";
          index += 2;
        } else {
          expression += ".*";
          index += 1;
        }
      } else {
        expression += "[^/]*";
      }
    } else if (char === "?") {
      expression += "[^/]";
    } else {
      expression += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  expression += "$";
  const regexp = new RegExp(expression);
  return (path) => regexp.test(path);
}

function splitLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function mergeReceipts(receipts: SourceReadReceipt[]): SourceReadReceipt[] {
  const unique = new Map<string, SourceReadReceipt>();
  for (const receipt of receipts) {
    unique.set(receipt.id, receipt);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.startLine - right.startLine || left.endLine - right.endLine,
  );
}

function receiptsCoverFile(
  receipts: SourceReadReceipt[],
  expectedTotal?: number,
): boolean {
  if (receipts.length === 0) {
    return expectedTotal === 0;
  }
  const totalLines = expectedTotal ?? receipts[0]!.totalLines;
  if (totalLines === 0) {
    return receipts.some((receipt) =>
      receipt.startLine === 0
      && receipt.endLine === 0
      && receipt.totalLines === 0
    );
  }
  const ranges = receipts
    .filter((receipt) => receipt.totalLines === totalLines)
    .map((receipt) => [receipt.startLine, receipt.endLine] as const)
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

function countValues<
  K extends readonly string[],
  T extends Record<P, K[number]>,
  P extends keyof T,
>(
  values: K,
  entries: T[],
  property: P,
): Record<K[number], number> {
  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Record<
    K[number],
    number
  >;
  for (const entry of entries) {
    counts[entry[property]] += 1;
  }
  return counts;
}

function normalizeGraphPath(root: string, value: string): string | undefined {
  const normalized = value.replaceAll("\\", "/");
  if (!isAbsolute(value)) {
    return normalized.replace(/^\.\//, "");
  }
  const rootPath = resolve(root);
  const relativePath = relative(rootPath, resolve(value)).replaceAll("\\", "/");
  return relativePath === ".." || relativePath.startsWith("../")
    ? undefined
    : relativePath;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function inferSurfaceCandidates(
  tree: GitTreeEntry[],
): ReconstructionCoverageSurface[] {
  const candidates: ReconstructionCoverageSurface[] = [];
  for (const entry of tree) {
    if (entry.objectType !== "blob") {
      continue;
    }
    const path = entry.path.replaceAll("\\", "/");
    const kinds = inferredSurfaceKinds(path);
    for (const kind of kinds) {
      const label = path
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(-54) || "surface";
      candidates.push({
        id: `auto-${kind}-${label}-${shortHash(`${kind}:${path}`).slice(0, 8)}`,
        kind,
        description: `Probable ${kind} discovered from the pinned Git path ${path}.`,
        paths: [path],
        status: "pending",
        note: "Automatically discovered candidate; inspect it or explicitly mark it irrelevant.",
        candidateIds: [],
      });
    }
  }
  return candidates.sort((left, right) => left.id.localeCompare(right.id));
}

function inferredSurfaceKinds(path: string): SurfaceKind[] {
  const normalized = path.toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const kinds = new Set<SurfaceKind>();
  if (
    /^(?:main|app|server|cli|worker)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|swift|rb|php)$/.test(basename)
    || /(?:^|\/)bin\//.test(normalized)
    || /(?:^|\/)cmd\/[^/]+\/main\.go$/.test(normalized)
    || /^(?:dockerfile|procfile)$/.test(basename)
  ) {
    kinds.add("entrypoint");
  }
  if (
    /(?:^|\/)(?:routes?|routers?|controllers?|handlers?|rpc|graphql)(?:\/|\.)/.test(normalized)
    || /^(?:routes?|routers?|controllers?|handlers?|rpc|graphql|schema)\.[^.]+$/.test(basename)
  ) {
    kinds.add("boundary");
  }
  if (
    /(?:^|\/)(?:migrations?|jobs?|workers?|cron|schedulers?)(?:\/|\.)/.test(normalized)
    || /^(?:dockerfile|procfile|compose(?:\.[^.]+)?\.ya?ml)$/.test(basename)
  ) {
    kinds.add("runtime");
  }
  return [...kinds];
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: string): boolean {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}
