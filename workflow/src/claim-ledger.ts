import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  errorMessage,
  isMissingFileError,
  readConfig,
} from "./config.js";
import { isRecord, parseWorkSpec } from "./work-spec.js";

const CLAIM_LEDGER_SCHEMA_VERSION = 1;
const CLAIM_LEDGER_PATH = ".workflow/current/claim-ledger.json";
const RELATION_KINDS = [
  "supersedes",
  "superseded_by",
  "contradicts",
  "refines",
  "implements",
  "derived_from",
] as const;

type ClaimOrigin = "intake" | "reconstruction";
type ClaimLifecycle = "active" | "archive";
type ClaimRelationKind = (typeof RELATION_KINDS)[number];

export interface ClaimLedgerClaim {
  id: string;
  localId: string;
  origin: ClaimOrigin;
  caseId: string;
  lifecycle: ClaimLifecycle;
  casePath: string;
  caseVersion: number;
  caseState: {
    status: string;
    outcome: string;
    reviewStatus: string;
    promotionStatus: string;
  };
  claim: string;
  claimClass: string;
  semanticRole: string;
  disposition: string;
  intentState: string;
  deliveryState: string;
  alignment: string;
  adjudication: {
    maintainerDecisionStatus: string;
    evidenceKinds: string[];
  };
  temporal: {
    capturedAt: string;
    assertedAt: string;
    validFrom: string;
    validTo: string;
  };
  routing: {
    lane: string;
    destinations: string[];
  };
}

export interface ClaimLedgerEdge {
  source: string;
  target: string;
  kind: ClaimRelationKind;
}

export interface ClaimLedger {
  schemaVersion: typeof CLAIM_LEDGER_SCHEMA_VERSION;
  contentHash: string;
  claims: ClaimLedgerClaim[];
  edges: ClaimLedgerEdge[];
  stats: {
    claims: number;
    edges: number;
    intakeCases: number;
    reconstructionCases: number;
  };
}

export interface ClaimLedgerIssue {
  origin: ClaimOrigin;
  caseId: string;
  path: string;
  message: string;
  claimIds?: string[];
}

export interface ClaimLedgerCompilation {
  target: string;
  ledger: ClaimLedger;
  errors: ClaimLedgerIssue[];
}

interface CollectedClaim {
  record: ClaimLedgerClaim;
  relations: Record<ClaimRelationKind, string[]>;
}

export async function compileClaimLedger(
  targetInput: string,
): Promise<ClaimLedgerCompilation> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Claim ledger requires a knowledge repository: ${target}`);
  }

  const cases = [
    ...await collectCases(target, "intake"),
    ...await collectCases(target, "reconstruction"),
  ];
  const errors: ClaimLedgerIssue[] = [];
  const collected: CollectedClaim[] = [];
  const known = new Map<string, CollectedClaim>();

  for (const item of cases) {
    const candidates = recordArray(item.metadata.candidate_claims);
    const caseVersion = caseVersionOf(item.origin, item.metadata);
    for (const candidate of candidates) {
      const localId = stringValue(candidate.id);
      const id = claimId(item.origin, item.caseId, localId);
      if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(localId)) {
        errors.push(issue(item, `candidate claim has invalid id: ${localId || "<empty>"}`));
        continue;
      }
      if (known.has(id)) {
        errors.push(issue(item, `candidate claim is duplicated: ${id}`));
        continue;
      }
      const normalized = normalizeClaim(item, candidate, caseVersion);
      const relations = normalizeRelations(candidate);
      const entry = { record: normalized, relations };
      known.set(id, entry);
      collected.push(entry);
    }
  }

  const edges: ClaimLedgerEdge[] = [];
  for (const entry of collected) {
    for (const kind of RELATION_KINDS) {
      for (const reference of entry.relations[kind]) {
        const targetId = normalizeClaimReference(entry.record, reference);
        if (!targetId || !known.has(targetId)) {
          errors.push({
            origin: entry.record.origin,
            caseId: entry.record.caseId,
            path: entry.record.casePath,
            message:
              `${entry.record.id}.relations.${kind} references an unknown claim: ${reference}`,
            claimIds: [entry.record.id],
          });
          continue;
        }
        if (targetId === entry.record.id) {
          errors.push({
            origin: entry.record.origin,
            caseId: entry.record.caseId,
            path: entry.record.casePath,
            message: `${entry.record.id}.relations.${kind} cannot reference itself`,
            claimIds: [entry.record.id],
          });
          continue;
        }
        edges.push({ source: entry.record.id, target: targetId, kind });
      }
    }
  }

  const deduplicatedEdges = deduplicateEdges(edges);
  validateReciprocalRelations(known, deduplicatedEdges, errors);
  validateSupersessionCycles(known, deduplicatedEdges, errors);

  const claims = collected.map((entry) => entry.record).sort(compareClaims);
  const sortedEdges = deduplicatedEdges.sort(compareEdges);
  const stablePayload = JSON.stringify({ claims, edges: sortedEdges });
  const ledger: ClaimLedger = {
    schemaVersion: CLAIM_LEDGER_SCHEMA_VERSION,
    contentHash: createHash("sha256").update(stablePayload).digest("hex"),
    claims,
    edges: sortedEdges,
    stats: {
      claims: claims.length,
      edges: sortedEdges.length,
      intakeCases: new Set(
        claims.filter((claim) => claim.origin === "intake").map((claim) => claim.caseId),
      ).size,
      reconstructionCases: new Set(
        claims
          .filter((claim) => claim.origin === "reconstruction")
          .map((claim) => claim.caseId),
      ).size,
    },
  };
  return { target, ledger, errors };
}

export async function writeClaimLedger(
  targetInput: string,
): Promise<ClaimLedgerCompilation & { path: string }> {
  const result = await compileClaimLedger(targetInput);
  if (result.errors.length > 0) {
    throw new Error(
      `Cannot build claim ledger: ${result.errors.length} claim-ledger error(s) remain: ${
        result.errors
          .slice(0, 8)
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")
      }`,
    );
  }
  const path = join(result.target, CLAIM_LEDGER_PATH);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(result.ledger, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  return { ...result, path };
}

async function collectCases(
  target: string,
  origin: ClaimOrigin,
): Promise<Array<{
  origin: ClaimOrigin;
  lifecycle: ClaimLifecycle;
  caseId: string;
  path: string;
  metadata: Record<string, unknown>;
}>> {
  const cases = [];
  for (const lifecycle of ["active", "archive"] as const) {
    const root = origin === "intake"
      ? join(target, "intake/cases", lifecycle)
      : join(target, "reconstruction", lifecycle);
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
      const path = join(root, entry.name, "case.md");
      try {
        const document = parseWorkSpec(await readFile(path, "utf8"));
        cases.push({
          origin,
          lifecycle,
          caseId: entry.name,
          path,
          metadata: document.metadata,
        });
      } catch (error) {
        throw new Error(`Cannot parse claim case ${path}: ${errorMessage(error)}`);
      }
    }
  }
  return cases;
}

function normalizeClaim(
  item: {
    origin: ClaimOrigin;
    lifecycle: ClaimLifecycle;
    caseId: string;
    path: string;
    metadata: Record<string, unknown>;
  },
  candidate: Record<string, unknown>,
  caseVersion: number,
): ClaimLedgerClaim {
  const localId = stringValue(candidate.id);
  const temporal = recordValue(candidate.temporal);
  const routing = recordValue(candidate.routing);
  const promotedTo = stringArray(candidate.promoted_to);
  const disposition = stringValue(candidate.disposition);
  const promotion = recordValue(item.metadata.promotion);
  const migration = recordValue(item.metadata.migration);
  const maintainerReview = recordValue(item.metadata.maintainer_review);
  const maintainerDecision = recordValue(candidate.maintainer_decision);
  return {
    id: claimId(item.origin, item.caseId, localId),
    localId,
    origin: item.origin,
    caseId: item.caseId,
    lifecycle: item.lifecycle,
    casePath: relativeCasePath(item.origin, item.lifecycle, item.caseId),
    caseVersion,
    caseState: {
      status: stringValue(item.metadata.status),
      outcome: stringValue(item.metadata.outcome),
      reviewStatus: item.origin === "intake"
        ? stringValue(migration?.status)
        : stringValue(maintainerReview?.status),
      promotionStatus: stringValue(promotion?.status),
    },
    claim: stringValue(candidate.claim),
    claimClass: stringValue(candidate.claim_class)
      || legacyClaimClass(stringValue(candidate.authority)),
    semanticRole: stringValue(candidate.semantic_role)
      || defaultSemanticRole(candidate),
    disposition,
    intentState: stringValue(candidate.intent_state) || "unknown",
    deliveryState: stringValue(candidate.delivery_state) || "unknown",
    alignment: stringValue(candidate.alignment) || "unknown",
    adjudication: {
      maintainerDecisionStatus: stringValue(maintainerDecision?.status),
      evidenceKinds: uniqueStrings(
        recordArray(candidate.evidence).map((entry) => stringValue(entry.kind)),
      ),
    },
    temporal: {
      capturedAt: stringValue(temporal?.captured_at)
        || stringValue(item.metadata.updated_at)
        || stringValue(item.metadata.created_at),
      assertedAt: stringValue(temporal?.asserted_at),
      validFrom: stringValue(temporal?.valid_from),
      validTo: stringValue(temporal?.valid_to),
    },
    routing: {
      lane: stringValue(routing?.lane)
        || (disposition === "confirmed" && promotedTo.length > 0
          ? "current-knowledge"
          : "case-only"),
      destinations: stringArray(routing?.destinations).length > 0
        ? stringArray(routing?.destinations)
        : promotedTo,
    },
  };
}

function normalizeRelations(
  candidate: Record<string, unknown>,
): Record<ClaimRelationKind, string[]> {
  const relations = recordValue(candidate.relations);
  return Object.fromEntries(
    RELATION_KINDS.map((kind) => [kind, uniqueStrings(stringArray(relations?.[kind]))]),
  ) as Record<ClaimRelationKind, string[]>;
}

function normalizeClaimReference(
  source: ClaimLedgerClaim,
  reference: string,
): string | undefined {
  if (/^[a-z0-9][a-z0-9-]{0,95}$/.test(reference)) {
    return claimId(source.origin, source.caseId, reference);
  }
  return /^(?:intake|reconstruction):[a-z0-9][a-z0-9-]{0,95}#[a-z0-9][a-z0-9-]{0,95}$/.test(
      reference,
    )
    ? reference
    : undefined;
}

function validateReciprocalRelations(
  known: Map<string, CollectedClaim>,
  edges: ClaimLedgerEdge[],
  errors: ClaimLedgerIssue[],
): void {
  const edgeKeys = new Set(
    edges.map((edge) => `${edge.source}\0${edge.target}\0${edge.kind}`),
  );
  for (const edge of edges) {
    const reciprocal = edge.kind === "supersedes"
      ? "superseded_by"
      : edge.kind === "superseded_by"
      ? "supersedes"
      : edge.kind === "contradicts"
      ? "contradicts"
      : undefined;
    if (
      reciprocal
      && !edgeKeys.has(`${edge.target}\0${edge.source}\0${reciprocal}`)
    ) {
      const source = known.get(edge.source)!.record;
      errors.push({
        origin: source.origin,
        caseId: source.caseId,
        path: source.casePath,
        message:
          `${edge.source}.relations.${edge.kind} requires reciprocal ${reciprocal} from ${edge.target}`,
        claimIds: [edge.source, edge.target],
      });
    }
  }
}

function validateSupersessionCycles(
  known: Map<string, CollectedClaim>,
  edges: ClaimLedgerEdge[],
  errors: ClaimLedgerIssue[],
): void {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges.filter((candidate) => candidate.kind === "supersedes")) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const state = new Map<string, "active" | "complete">();
  const stack: string[] = [];
  const seenCycles = new Set<string>();
  const visit = (id: string): void => {
    if (state.get(id) === "complete") {
      return;
    }
    if (state.get(id) === "active") {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start);
      const canonical = canonicalCycle(cycle);
      if (!seenCycles.has(canonical)) {
        seenCycles.add(canonical);
        const source = known.get(cycle[0]!)!.record;
        errors.push({
          origin: source.origin,
          caseId: source.caseId,
          path: source.casePath,
          message: `supersession cycle: ${[...cycle, cycle[0]!].join(" -> ")}`,
          claimIds: cycle,
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

function canonicalCycle(cycle: string[]): string {
  if (cycle.length === 0) {
    return "";
  }
  return cycle
    .map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)].join("\0"))
    .sort()[0]!;
}

function caseVersionOf(
  origin: ClaimOrigin,
  metadata: Record<string, unknown>,
): number {
  const value = origin === "intake"
    ? metadata.intake_case_version
    : metadata.reconstruction_version;
  return typeof value === "number" ? value : 0;
}

function relativeCasePath(
  origin: ClaimOrigin,
  lifecycle: ClaimLifecycle,
  caseId: string,
): string {
  return origin === "intake"
    ? `intake/cases/${lifecycle}/${caseId}/case.md`
    : `reconstruction/${lifecycle}/${caseId}/case.md`;
}

function claimId(origin: ClaimOrigin, caseId: string, localId: string): string {
  return `${origin}:${caseId}#${localId}`;
}

function legacyClaimClass(authority: string): string {
  return new Map([
    ["intent", "product-intent"],
    ["architecture-rationale", "architecture"],
  ]).get(authority) ?? authority;
}

function defaultSemanticRole(candidate: Record<string, unknown>): string {
  const claimClass = stringValue(candidate.claim_class)
    || legacyClaimClass(stringValue(candidate.authority));
  if (claimClass === "product-intent") {
    return "decision";
  }
  if (claimClass === "history") {
    return "status";
  }
  return "observation";
}

function issue(
  item: {
    origin: ClaimOrigin;
    caseId: string;
    path: string;
  },
  message: string,
): ClaimLedgerIssue {
  return {
    origin: item.origin,
    caseId: item.caseId,
    path: item.path,
    message,
  };
}

function deduplicateEdges(edges: ClaimLedgerEdge[]): ClaimLedgerEdge[] {
  return [...new Map(
    edges.map((edge) => [
      `${edge.source}\0${edge.target}\0${edge.kind}`,
      edge,
    ]),
  ).values()];
}

function compareClaims(left: ClaimLedgerClaim, right: ClaimLedgerClaim): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: ClaimLedgerEdge, right: ClaimLedgerEdge): number {
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
