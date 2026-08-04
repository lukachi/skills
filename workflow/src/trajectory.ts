import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { errorMessage, isMissingFileError, readConfig } from "./config.js";
import { readVisionRecord, visionReceiptDigest, type VisionMethod } from "./vision.js";
import { isRecord, parseWorkSpec } from "./work-spec.js";

/**
 * Trajectories.
 *
 * A trajectory is one product subject as a single line: how it was conceived,
 * what changed and why, and what the source shows now. It is the unit the
 * maintainer decides about, and the only layer they see.
 *
 * Two rules here are load-bearing and were established by prototype rather than
 * argument. A cause carries evidence separate from the claim's, because the
 * pointers that establish what the source does are not the pointers that
 * establish why — without them a deliberately deferred item classifies as
 * `drift` and the maintainer is told nobody decided it. And a subject is named
 * in product language, because a hierarchy built from paths is correct about
 * the repository and useless for deciding anything.
 */

const TRAJECTORY_GRAPH_SCHEMA_VERSION = 1;
const TRAJECTORY_GRAPH_PATH = ".workflow/current/trajectory-graph.json";
const TRAJECTORY_ROOT = "trajectories";

export const CAUSE_KINDS = [
  "decision",
  "compromise",
  "drift",
  "defect",
  "external",
  "not-found",
  "unknown",
] as const;

/** The two kinds that claim nothing, and so may carry no cause evidence. */
const CAUSES_WITHOUT_EVIDENCE = new Set(["not-found", "unknown"]);

export const EDGE_KINDS = ["part-of", "depends-on", "succeeds", "conflicts"] as const;
export const GAP_KINDS = ["delivery-debt", "direction-debt", "hole"] as const;
export const GAP_STATUSES = ["open", "to-close", "deferred"] as const;
export const OBSERVATION_SOURCE_KINDS = [
  "raw",
  "source-code",
  "version-control",
  "external",
  "maintainer",
] as const;

export type CauseKind = (typeof CAUSE_KINDS)[number];
export type EdgeKind = (typeof EDGE_KINDS)[number];
export type GapKind = (typeof GAP_KINDS)[number];
export type GapStatus = (typeof GAP_STATUSES)[number];
export type ObservationSourceKind = (typeof OBSERVATION_SOURCE_KINDS)[number];

export interface TrajectoryObservation {
  id: string;
  at: string;
  readAt: string;
  source: {
    kind: ObservationSourceKind;
    resource: string;
  };
  says: string;
}

export interface TrajectoryFinding {
  id: string;
  situation: string;
  period: {
    from: string;
    to: string | null;
  };
  observations: string[];
  cause: {
    kind: CauseKind;
    evidence: string[];
    note: string;
  };
  scopeLimits: string[];
}

export interface TrajectoryGap {
  kind: GapKind;
  statement: string;
  status: GapStatus;
  work: string | null;
}

export interface TrajectoryEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  primary: boolean;
}

export interface TrajectoryVision {
  id: string;
  path: string;
  trajectory: string;
  declaredBy: string;
  at: string;
  supersedes: string;
  supersededBy: string | null;
  statement: string;
}

export interface TrajectoryRecord {
  id: string;
  path: string;
  area: string;
  subject: string;
  conceived: {
    at: string;
    from: string[];
    statement: string;
  };
  now: {
    pinned: string;
    readAt: string;
    state: string;
  };
  observations: TrajectoryObservation[];
  findings: TrajectoryFinding[];
  gaps: TrajectoryGap[];
  /**
   * The current declared vision, derived. A trajectory never names its vision;
   * a vision names its trajectory, so the two cannot drift apart.
   */
  vision: string | null;
  /** Gaps owned by this trajectory plus every `part-of` descendant. */
  gapWeight: number;
}

export interface TrajectoryIssue {
  id: string;
  path: string;
  message: string;
}

export interface TrajectoryPending {
  id: string;
  path: string;
  subject: string;
  gapWeight: number;
  reason: string;
}

export interface TrajectoryGraph {
  schemaVersion: typeof TRAJECTORY_GRAPH_SCHEMA_VERSION;
  contentHash: string;
  trajectories: TrajectoryRecord[];
  edges: TrajectoryEdge[];
  visions: TrajectoryVision[];
  stats: {
    trajectories: number;
    edges: number;
    roots: number;
    findings: number;
    observations: number;
    gaps: number;
    visions: number;
  };
}

export interface TrajectoryCompilation {
  target: string;
  graph: TrajectoryGraph;
  errors: TrajectoryIssue[];
  /**
   * Roots awaiting a vision, worst gap first. This is the phase-five queue: the
   * only list the maintainer is meant to work through.
   */
  pending: TrajectoryPending[];
}

interface CollectedTrajectory {
  record: TrajectoryRecord;
  edges: Array<{ kind: EdgeKind; target: string; primary: boolean }>;
}

export async function compileTrajectories(
  targetInput: string,
): Promise<TrajectoryCompilation> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Trajectories require a knowledge repository: ${target}`);
  }

  const errors: TrajectoryIssue[] = [];
  const collected: CollectedTrajectory[] = [];
  const known = new Map<string, CollectedTrajectory>();

  const files = await collectTrajectoryFiles(target);
  for (const item of files.filter((entry) => entry.kind === "trajectory")) {
    if (!isValidId(item.id)) {
      errors.push({
        id: item.id,
        path: item.relativePath,
        message: `invalid trajectory id: ${item.id || "<empty>"}`,
      });
      continue;
    }
    if (known.has(item.id)) {
      errors.push({
        id: item.id,
        path: item.relativePath,
        message: `trajectory is duplicated: ${item.id}`,
      });
      continue;
    }
    const entry = normalizeTrajectory(item, errors);
    known.set(item.id, entry);
    collected.push(entry);
  }

  const edges: TrajectoryEdge[] = [];
  for (const entry of collected) {
    const partOf = entry.edges.filter((edge) => edge.kind === "part-of");
    if (partOf.length > 0 && partOf.filter((edge) => edge.primary).length !== 1) {
      errors.push({
        id: entry.record.id,
        path: entry.record.path,
        message:
          "exactly one part-of edge must be primary; vision inherits from the primary parent only",
      });
    }
    for (const edge of entry.edges) {
      if (edge.target === entry.record.id) {
        errors.push({
          id: entry.record.id,
          path: entry.record.path,
          message: `edges.${edge.kind} cannot reference itself`,
        });
        continue;
      }
      if (!known.has(edge.target)) {
        errors.push({
          id: entry.record.id,
          path: entry.record.path,
          message: `edges.${edge.kind} references an unknown trajectory: ${edge.target}`,
        });
        continue;
      }
      edges.push({
        source: entry.record.id,
        target: edge.target,
        kind: edge.kind,
        primary: edge.primary,
      });
    }
  }

  const deduplicated = deduplicateEdges(edges);
  validateCompositionCycles(known, deduplicated, errors);
  applyGapWeights(known, deduplicated);

  const visions = await collectVisions(
    target,
    files.filter((entry) => entry.kind === "vision"),
    known,
    errors,
  );
  for (const vision of visions) {
    if (vision.supersededBy) {
      continue;
    }
    const entry = known.get(vision.trajectory);
    if (!entry) {
      continue;
    }
    if (entry.record.vision) {
      errors.push({
        id: vision.id,
        path: vision.path,
        message:
          `${vision.trajectory} has more than one current vision (${entry.record.vision}, ${vision.id}); supersede rather than add`,
      });
      continue;
    }
    entry.record.vision = vision.id;
  }

  const trajectories = collected.map((entry) => entry.record).sort(compareTrajectories);
  const sortedEdges = deduplicated.sort(compareEdges);
  const sortedVisions = visions.sort((left, right) => left.id.localeCompare(right.id));
  const roots = trajectories.filter((record) => !hasPrimaryParent(record.id, sortedEdges));
  const stablePayload = JSON.stringify({
    trajectories,
    edges: sortedEdges,
    visions: sortedVisions,
  });
  const graph: TrajectoryGraph = {
    schemaVersion: TRAJECTORY_GRAPH_SCHEMA_VERSION,
    contentHash: createHash("sha256").update(stablePayload).digest("hex"),
    trajectories,
    edges: sortedEdges,
    visions: sortedVisions,
    stats: {
      trajectories: trajectories.length,
      edges: sortedEdges.length,
      roots: roots.length,
      findings: trajectories.reduce((total, record) => total + record.findings.length, 0),
      observations: trajectories.reduce((total, record) => total + record.observations.length, 0),
      gaps: trajectories.reduce((total, record) => total + record.gaps.length, 0),
      visions: sortedVisions.length,
    },
  };

  const pending = roots
    .filter((record) => !record.vision)
    .map((record) => ({
      id: record.id,
      path: record.path,
      subject: record.subject,
      gapWeight: record.gapWeight,
      reason: "root trajectory has no declared vision",
    }))
    .sort((left, right) =>
      right.gapWeight - left.gapWeight || left.id.localeCompare(right.id)
    );

  return { target, graph, errors, pending };
}

export async function writeTrajectoryGraph(
  targetInput: string,
): Promise<TrajectoryCompilation & { path: string }> {
  const result = await compileTrajectories(targetInput);
  if (result.errors.length > 0) {
    throw new Error(
      `Cannot build trajectory graph: ${result.errors.length} error(s) remain: ${
        result.errors
          .slice(0, 8)
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")
      }`,
    );
  }
  const path = join(result.target, TRAJECTORY_GRAPH_PATH);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(result.graph, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  return { ...result, path };
}

/**
 * A vision names its trajectory; a trajectory never names its vision. One
 * direction means the two cannot drift apart, which is the same reason a gap is
 * derived rather than stored.
 *
 * Each vision is reconciled against the durable record `wfctl knowledge
 * trajectory declare` wrote. A hand-written vision document fails here, which is
 * the point: direction is the one thing the agent may not author.
 */
async function collectVisions(
  target: string,
  files: Array<{
    id: string;
    relativePath: string;
    metadata: Record<string, unknown>;
    body: string;
  }>,
  known: Map<string, CollectedTrajectory>,
  errors: TrajectoryIssue[],
): Promise<TrajectoryVision[]> {
  const visions: TrajectoryVision[] = [];
  const seen = new Set<string>();
  for (const item of files) {
    const push = (message: string) =>
      errors.push({ id: item.id, path: item.relativePath, message });
    if (!isValidId(item.id)) {
      push(`invalid vision id: ${item.id || "<empty>"}`);
      continue;
    }
    if (seen.has(item.id)) {
      push(`vision is duplicated: ${item.id}`);
      continue;
    }
    seen.add(item.id);

    const trajectory = stringValue(item.metadata.trajectory);
    if (!known.has(trajectory)) {
      push(`vision names an unknown trajectory: ${trajectory || "<empty>"}`);
    }
    const declaredBy = stringValue(item.metadata.declared_by).trim();
    if (!declaredBy.startsWith("human:") || declaredBy.length <= "human:".length) {
      push(
        `declared_by must be human:<maintainer-id>, not ${declaredBy || "<empty>"}; only the maintainer declares direction`,
      );
    }
    const statement = visionStatement(item.body);
    if (!statement) {
      push("a vision must state what the subject should become");
    }

    const record = await readVisionRecord(target, item.id);
    const receipt = stringValue(item.metadata.receipt);
    if (!record) {
      push(
        "has no durable record; re-run wfctl knowledge trajectory declare rather than writing the document by hand",
      );
    } else if (record.receipt !== receipt) {
      push("receipt does not match the recorded declaration");
    } else if (
      record.receipt !== visionReceiptDigest({
        id: record.id,
        trajectory: record.trajectory,
        declaredBy: record.declaredBy,
        at: record.at,
        method: record.method as VisionMethod,
      })
    ) {
      push("the recorded declaration digest is inconsistent");
    } else if (record.trajectory !== trajectory || record.declaredBy !== declaredBy) {
      push("does not match the recorded declaration's trajectory or actor");
    }

    visions.push({
      id: item.id,
      path: item.relativePath,
      trajectory,
      declaredBy,
      at: stringValue(item.metadata.at),
      supersedes: stringValue(item.metadata.supersedes).trim(),
      supersededBy: null,
      statement,
    });
  }

  const byId = new Map(visions.map((vision) => [vision.id, vision]));
  for (const vision of visions) {
    if (!vision.supersedes) {
      continue;
    }
    const previous = byId.get(vision.supersedes);
    if (!previous) {
      errors.push({
        id: vision.id,
        path: vision.path,
        message: `supersedes an unknown vision: ${vision.supersedes}`,
      });
      continue;
    }
    if (previous.trajectory !== vision.trajectory) {
      errors.push({
        id: vision.id,
        path: vision.path,
        message:
          `supersedes ${previous.id}, which belongs to ${previous.trajectory}; a lineage stays on one subject`,
      });
      continue;
    }
    if (previous.supersededBy && previous.supersededBy !== vision.id) {
      errors.push({
        id: vision.id,
        path: vision.path,
        message:
          `${previous.id} is already superseded by ${previous.supersededBy}; a lineage forks nowhere`,
      });
      continue;
    }
    previous.supersededBy = vision.id;
  }
  validateVisionCycles(visions, byId, errors);
  return visions;
}

function validateVisionCycles(
  visions: TrajectoryVision[],
  byId: Map<string, TrajectoryVision>,
  errors: TrajectoryIssue[],
): void {
  const state = new Map<string, "active" | "complete">();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === "complete") {
      return;
    }
    if (current === "active") {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start === -1 ? 0 : start);
      const signature = canonicalCycle(cycle);
      if (!reported.has(signature)) {
        reported.add(signature);
        errors.push({
          id,
          path: byId.get(id)?.path ?? id,
          message: `supersession forms a cycle: ${[...cycle, id].join(" -> ")}`,
        });
      }
      return;
    }
    state.set(id, "active");
    stack.push(id);
    const next = byId.get(id)?.supersedes;
    if (next && byId.has(next)) {
      visit(next);
    }
    stack.pop();
    state.set(id, "complete");
  };
  for (const vision of visions) {
    visit(vision.id);
  }
}

/**
 * The statement lives in the body rather than the frontmatter because it is
 * prose a person wrote, and prose belongs where a person can read it.
 */
function visionStatement(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim();
}

async function collectTrajectoryFiles(
  target: string,
): Promise<Array<{
  kind: "trajectory" | "vision";
  id: string;
  path: string;
  relativePath: string;
  metadata: Record<string, unknown>;
  body: string;
}>> {
  const root = join(target, TRAJECTORY_ROOT);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const path = join(root, entry.name);
    try {
      const document = parseWorkSpec(await readFile(path, "utf8"));
      files.push({
        kind: stringValue(document.metadata.kind) === "vision"
          ? "vision" as const
          : "trajectory" as const,
        id: stringValue(document.metadata.id) || entry.name.replace(/\.md$/, ""),
        path,
        relativePath: `${TRAJECTORY_ROOT}/${entry.name}`,
        metadata: document.metadata,
        body: document.body,
      });
    } catch (error) {
      throw new Error(`Cannot parse trajectory ${path}: ${errorMessage(error)}`);
    }
  }
  return files;
}

function normalizeTrajectory(
  item: { id: string; path: string; relativePath: string; metadata: Record<string, unknown> },
  errors: TrajectoryIssue[],
): CollectedTrajectory {
  const push = (message: string) =>
    errors.push({ id: item.id, path: item.relativePath, message });
  const metadata = item.metadata;

  const subject = stringValue(metadata.subject).trim();
  if (!subject) {
    push("subject is required");
  } else if (looksLikeIdentifier(subject)) {
    push(
      `subject "${subject}" is an implementation identifier, not product language; a graph built from paths cannot be decided about`,
    );
  }

  const observations = normalizeObservations(metadata.observations, push);
  const observationIds = new Set(observations.map((observation) => observation.id));
  const findings = normalizeFindings(metadata.findings, observationIds, push);
  const gaps = normalizeGaps(metadata.gaps, push);

  const conceived = recordValue(metadata.conceived);
  const now = recordValue(metadata.now);
  if (!stringValue(now?.pinned)) {
    push("now.pinned is required; \"what the source shows now\" is a statement about a named revision or it is not a statement");
  }
  if (!stringValue(now?.state)) {
    push("now.state is required");
  }
  for (const reference of stringArray(conceived?.from)) {
    if (!observationIds.has(reference)) {
      push(`conceived.from references an unknown observation: ${reference}`);
    }
  }

  const edges = normalizeEdges(metadata.edges, push);
  if (stringValue(metadata.vision).trim()) {
    push(
      "a trajectory does not name its vision; a vision names its trajectory, so the two cannot drift apart",
    );
  }

  return {
    record: {
      id: item.id,
      path: item.relativePath,
      area: stringValue(metadata.area),
      subject,
      conceived: {
        at: stringValue(conceived?.at),
        from: stringArray(conceived?.from),
        statement: stringValue(conceived?.statement),
      },
      now: {
        pinned: stringValue(now?.pinned),
        readAt: stringValue(now?.read_at),
        state: stringValue(now?.state),
      },
      observations,
      findings,
      gaps,
      vision: null,
      gapWeight: 0,
    },
    edges,
  };
}

function normalizeObservations(
  value: unknown,
  push: (message: string) => void,
): TrajectoryObservation[] {
  const observations: TrajectoryObservation[] = [];
  const seen = new Set<string>();
  for (const entry of recordArray(value)) {
    const id = stringValue(entry.id);
    if (!isValidId(id)) {
      push(`observation has invalid id: ${id || "<empty>"}`);
      continue;
    }
    if (seen.has(id)) {
      push(`observation is duplicated: ${id}`);
      continue;
    }
    seen.add(id);
    const source = recordValue(entry.source);
    const kind = stringValue(source?.kind);
    if (!OBSERVATION_SOURCE_KINDS.includes(kind as ObservationSourceKind)) {
      push(`${id}.source.kind is not a source kind: ${kind || "<empty>"}`);
    }
    if (!stringValue(source?.resource)) {
      push(`${id}.source.resource is required`);
    }
    if (!stringValue(entry.says).trim()) {
      push(`${id}.says is required`);
    }
    if (!stringValue(entry.at)) {
      push(`${id}.at is required; an observation without its own date reads as old as the reading`);
    }
    observations.push({
      id,
      at: stringValue(entry.at),
      readAt: stringValue(entry.read_at),
      source: {
        kind: kind as ObservationSourceKind,
        resource: stringValue(source?.resource),
      },
      says: stringValue(entry.says),
    });
  }
  return observations;
}

function normalizeFindings(
  value: unknown,
  observationIds: Set<string>,
  push: (message: string) => void,
): TrajectoryFinding[] {
  const findings: TrajectoryFinding[] = [];
  const seen = new Set<string>();
  for (const entry of recordArray(value)) {
    const id = stringValue(entry.id);
    if (!isValidId(id)) {
      push(`finding has invalid id: ${id || "<empty>"}`);
      continue;
    }
    if (seen.has(id)) {
      push(`finding is duplicated: ${id}`);
      continue;
    }
    seen.add(id);
    if (!stringValue(entry.situation).trim()) {
      push(`${id}.situation is required`);
    }
    const observations = stringArray(entry.observations);
    if (observations.length === 0) {
      push(`${id}.observations is required; a finding is a reduction of observations, not a new assertion`);
    }
    for (const reference of observations) {
      if (!observationIds.has(reference)) {
        push(`${id}.observations references an unknown observation: ${reference}`);
      }
    }
    const period = recordValue(entry.period);
    if (!stringValue(period?.from)) {
      push(`${id}.period.from is required`);
    }
    const cause = recordValue(entry.cause);
    const causeKind = stringValue(cause?.kind);
    const causeEvidence = stringArray(cause?.evidence);
    if (!CAUSE_KINDS.includes(causeKind as CauseKind)) {
      push(`${id}.cause.kind is not a cause: ${causeKind || "<empty>"}`);
    } else if (!CAUSES_WITHOUT_EVIDENCE.has(causeKind) && causeEvidence.length === 0) {
      push(
        `${id}.cause.kind is ${causeKind} and carries no evidence; use not-found when no decision record was located, which is not the same as drift`,
      );
    }
    findings.push({
      id,
      situation: stringValue(entry.situation),
      period: {
        from: stringValue(period?.from),
        to: stringValue(period?.to) || null,
      },
      observations,
      cause: {
        kind: causeKind as CauseKind,
        evidence: causeEvidence,
        note: stringValue(cause?.note),
      },
      scopeLimits: stringArray(entry.scope_limits),
    });
  }
  return findings;
}

function normalizeGaps(value: unknown, push: (message: string) => void): TrajectoryGap[] {
  const gaps: TrajectoryGap[] = [];
  for (const entry of recordArray(value)) {
    const kind = stringValue(entry.kind);
    const status = stringValue(entry.status);
    const statement = stringValue(entry.statement).trim();
    const work = stringValue(entry.work).trim();
    if (!GAP_KINDS.includes(kind as GapKind)) {
      push(`gap kind is not a gap: ${kind || "<empty>"}`);
    }
    if (!statement) {
      push("gap statement is required");
    }
    if (status === "accept" || status === "accepted") {
      push(
        "gap status accept does not exist: a gap that is right as it stands is a vision that was wrong, so edit the vision and the gap disappears",
      );
    } else if (!GAP_STATUSES.includes(status as GapStatus)) {
      push(`gap status is not a status: ${status || "<empty>"}`);
    }
    if (status === "to-close" && !work) {
      push(`gap "${statement}" is to-close and names no work; a debt nobody owns is an observation`);
    }
    if (status !== "to-close" && work) {
      push(`gap "${statement}" names work but is not to-close`);
    }
    gaps.push({
      kind: kind as GapKind,
      statement,
      status: status as GapStatus,
      work: work || null,
    });
  }
  return gaps;
}

function normalizeEdges(
  value: unknown,
  push: (message: string) => void,
): Array<{ kind: EdgeKind; target: string; primary: boolean }> {
  const edges = [];
  for (const entry of recordArray(value)) {
    const kind = stringValue(entry.kind);
    const target = stringValue(entry.target);
    if (!EDGE_KINDS.includes(kind as EdgeKind)) {
      push(`edge kind is not an edge: ${kind || "<empty>"}`);
      continue;
    }
    if (!isValidId(target)) {
      push(`edge target is not a trajectory id: ${target || "<empty>"}`);
      continue;
    }
    const primary = entry.primary === true;
    if (primary && kind !== "part-of") {
      push(`edge ${kind} to ${target} is marked primary; only part-of inherits vision`);
      continue;
    }
    edges.push({ kind: kind as EdgeKind, target, primary });
  }
  return edges;
}

/**
 * `part-of` must be acyclic because vision inherits along it; a cycle makes
 * inheritance undefined. `depends-on` may cycle and is not checked.
 */
function validateCompositionCycles(
  known: Map<string, CollectedTrajectory>,
  edges: TrajectoryEdge[],
  errors: TrajectoryIssue[],
): void {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "part-of") {
      continue;
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const state = new Map<string, "active" | "complete">();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === "complete") {
      return;
    }
    if (current === "active") {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start === -1 ? 0 : start);
      const signature = canonicalCycle(cycle);
      if (!reported.has(signature)) {
        reported.add(signature);
        const entry = known.get(id);
        errors.push({
          id,
          path: entry?.record.path ?? id,
          message: `part-of forms a cycle: ${[...cycle, id].join(" -> ")}`,
        });
      }
      return;
    }
    state.set(id, "active");
    stack.push(id);
    for (const target of outgoing.get(id) ?? []) {
      visit(target);
    }
    stack.pop();
    state.set(id, "complete");
  };
  for (const id of known.keys()) {
    visit(id);
  }
}

/**
 * Child gaps sum upward along `part-of`, so the root with the largest total is
 * asked about first. Question order comes from the product, not from coverage.
 */
function applyGapWeights(
  known: Map<string, CollectedTrajectory>,
  edges: TrajectoryEdge[],
): void {
  const parents = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "part-of") {
      continue;
    }
    parents.set(edge.source, [...(parents.get(edge.source) ?? []), edge.target]);
  }
  for (const entry of known.values()) {
    entry.record.gapWeight = entry.record.gaps.length;
  }
  for (const entry of known.values()) {
    const own = entry.record.gaps.length;
    if (own === 0) {
      continue;
    }
    const seen = new Set<string>([entry.record.id]);
    let frontier = parents.get(entry.record.id) ?? [];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const parent of frontier) {
        if (seen.has(parent)) {
          continue;
        }
        seen.add(parent);
        const target = known.get(parent);
        if (target) {
          target.record.gapWeight += own;
        }
        next.push(...(parents.get(parent) ?? []));
      }
      frontier = next;
    }
  }
}

function hasPrimaryParent(id: string, edges: TrajectoryEdge[]): boolean {
  return edges.some((edge) => edge.source === id && edge.kind === "part-of" && edge.primary);
}

/**
 * A subject named for a file, a symbol, or a module is the failure this guard
 * exists for: the hierarchy it produces is correct about the repository and
 * carries nothing anyone can set a direction against.
 */
function looksLikeIdentifier(subject: string): boolean {
  return /[/\\]/.test(subject)
    || /::/.test(subject)
    || /\.(ts|js|rs|py|go|tsx|jsx|java|rb|md|json|toml|sql)\b/i.test(subject)
    || /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(subject)
    || /^[a-z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)+$/.test(subject);
}

function isValidId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,95}$/.test(value);
}

function canonicalCycle(cycle: string[]): string {
  if (cycle.length === 0) {
    return "";
  }
  return cycle
    .map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)].join("\0"))
    .sort()[0]!;
}

function deduplicateEdges(edges: TrajectoryEdge[]): TrajectoryEdge[] {
  return [...new Map(
    edges.map((edge) => [`${edge.source}\0${edge.target}\0${edge.kind}`, edge]),
  ).values()];
}

function compareTrajectories(left: TrajectoryRecord, right: TrajectoryRecord): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: TrajectoryEdge, right: TrajectoryEdge): number {
  return `${left.source}\0${left.kind}\0${left.target}`.localeCompare(
    `${right.source}\0${right.kind}\0${right.target}`,
  );
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
