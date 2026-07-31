import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { errorMessage, isMissingFileError, readConfig } from "./config.js";
import { compileKnowledgeGraph } from "./knowledge-graph.js";
import { inspectProjectReconstructionReceipt } from "./reconstruction.js";
import { completionIssues, parseWorkSpec } from "./work-spec.js";
import { bundleCompletionIssues } from "./work-bundle.js";

export interface KnowledgeValidationIssue {
  path: string;
  message: string;
}

export interface KnowledgeValidationResult {
  target: string;
  files: number;
  valid: boolean;
  errors: KnowledgeValidationIssue[];
  warnings: KnowledgeValidationIssue[];
}

interface ProjectChangeIndex {
  active: Map<string, Record<string, unknown>>;
  archive: Map<string, Record<string, unknown>>;
}

export interface KnowledgeConceptHashResult {
  path: string;
  contentHash: string;
}

interface ProjectReconstructionIndex {
  active: Map<string, Record<string, unknown>>;
  archive: Map<string, Record<string, unknown>>;
}

interface DecisionNode {
  path: string;
  id: string;
  effectiveAt: string;
  status: string;
  supersedes: string[];
  supersededBy: string;
  hasSupersedes: boolean;
  hasSupersededBy: boolean;
}

const KNOWLEDGE_VIEW_PURPOSE = new Map([
  ["product", "current-behavior"],
  ["engineering", "technical-realization"],
  ["decision", "decision-history"],
  ["reference", "external-context"],
  ["uncertainty", "open-question"],
]);

const KNOWLEDGE_AUDIENCES = new Set([
  "stakeholder",
  "maintainer",
  "domain-expert",
  "engineer",
  "operator",
  "agent",
]);

const QUALITY_CHECKS = [
  "factuality",
  "audience-fit",
  "abstraction",
  "completeness",
  "delivery-state",
];

const QUALITY_AXES = [
  "authority-truth",
  "reader-communication",
];

const PRODUCT_SECTIONS = [
  "What this provides",
  "Who it serves",
  "Domain language",
  "Current behavior",
  "Rules and outcomes",
  "Boundaries and exceptions",
  "Delivery",
  "Examples",
  "Evolution",
  "Related knowledge",
  "Engineering details",
];

const ENGINEERING_SECTIONS = [
  "Responsibility",
  "Current implementation",
  "Boundaries and ownership",
  "Data and control flow",
  "Contracts and invariants",
  "Failure and operational behavior",
  "Verification",
  "Product knowledge",
  "Relationships",
];

const AREA_INDEX_SECTIONS = [
  "Purpose",
  "Who it serves",
  "Scope and boundaries",
  "Current product behavior",
  "Capabilities",
  "Use cases and flows",
  "Rules and outcomes",
  "Delivery overview",
  "Current decisions",
  "Evolution",
  "Open questions",
  "Engineering details",
];

export async function validateKnowledge(
  targetInput: string,
  conceptPaths?: string[],
): Promise<KnowledgeValidationResult> {
  const target = await requireKnowledgeRepository(targetInput);
  const knowledgeRoot = join(target, "knowledge");
  const inventory = await collectKnowledgeTree(knowledgeRoot);
  const selected = conceptPaths
    ? conceptPaths.map((path) => resolveConceptPath(target, knowledgeRoot, path))
    : inventory.markdown.map((path) => join(knowledgeRoot, path));
  const errors: KnowledgeValidationIssue[] = [];
  const warnings: KnowledgeValidationIssue[] = [];
  const changeIndex = await readProjectChangeIndex(target);
  const reconstructionIndex = await readProjectReconstructionIndex(target);
  for (const path of inventory.symlinks) {
    errors.push({
      path: portable(join("knowledge", path)),
      message: "curated knowledge tree must not contain symlinks",
    });
  }

  for (const absolute of selected.sort()) {
    const displayPath = portable(relative(target, absolute));
    try {
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) {
        errors.push({ path: displayPath, message: "curated knowledge concepts must not be symlinks" });
        continue;
      }
    } catch (error) {
      errors.push({ path: displayPath, message: `cannot inspect concept: ${errorMessage(error)}` });
      continue;
    }
    let content: string;
    try {
      content = decodeUtf8(await readFile(absolute));
    } catch (error) {
      errors.push({ path: displayPath, message: `cannot read UTF-8 Markdown: ${errorMessage(error)}` });
      continue;
    }

    if (containsUntrustedIntakePath(content)) {
      errors.push({
        path: displayPath,
        message: "trusted knowledge must not reference raw/ or intake/ paths",
      });
    }

    const reserved = basename(absolute) === "index.md" || basename(absolute) === "log.md";
    if (reserved) {
      if (basename(absolute) === "index.md" && dirname(absolute) === knowledgeRoot) {
        const parsed = parseFrontmatter(content, false);
        if (!parsed.metadata || parsed.metadata.okf_version !== "0.2") {
          errors.push({ path: displayPath, message: "root index.md must declare okf_version: \"0.2\"" });
        }
      }
      if (/^knowledge\/areas\/[^/]+\/index\.md$/.test(displayPath)) {
        validateAreaIndex(displayPath, content, errors, warnings);
      }
      continue;
    }

    const parsed = parseFrontmatter(content, true);
    if (!parsed.metadata) {
      errors.push({ path: displayPath, message: parsed.error ?? "concept frontmatter is missing" });
      continue;
    }
    validateConcept(
      displayPath,
      parsed.metadata,
      parsed.body,
      changeIndex,
      reconstructionIndex,
      errors,
      warnings,
    );
  }
  const decisions = await readDecisionNodes(target, knowledgeRoot, inventory.markdown);
  validateDecisionLineage(decisions, errors);
  const graph = await compileKnowledgeGraph(
    target,
    conceptPaths
      ? {
        issueSources: new Set(selected.map((path) => portable(relative(target, path)))),
        checkReachability: false,
      }
      : {},
  );
  errors.push(...graph.errors);
  warnings.push(...graph.warnings);

  return {
    target,
    files: selected.length,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateConcept(
  path: string,
  metadata: Record<string, unknown>,
  body: string,
  changeIndex: ProjectChangeIndex,
  reconstructionIndex: ProjectReconstructionIndex,
  errors: KnowledgeValidationIssue[],
  warnings: KnowledgeValidationIssue[],
): void {
  const type = stringValue(metadata.type);
  const status = stringValue(metadata.status);
  const generated = recordValue(metadata.generated);
  const generatedAt = stringValue(generated?.at);
  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];
  const authority = stringArray(metadata.authority);
  const verifications = normalizeVerifications(metadata.verified);
  const realization = recordValue(metadata.realization);
  const expectedContentHash = conceptDocumentHash(metadata, body);
  const view = stringValue(metadata.view);
  const purpose = stringValue(metadata.purpose);
  const audience = stringArray(metadata.audience);

  if (!type) {
    errors.push({ path, message: "type is required by OKF v0.2" });
  }
  if (!["draft", "stable", "deprecated"].includes(status)) {
    errors.push({ path, message: "status must be explicit: draft, stable, or deprecated" });
  }
  if (!isActor(stringValue(generated?.by))) {
    errors.push({ path, message: "generated.by must follow the OKF actor convention" });
  }
  if (!isIsoDateTime(generatedAt)) {
    errors.push({ path, message: "generated.at must be an ISO 8601 datetime" });
  }
  if (sources.length === 0) {
    errors.push({ path, message: "sources must contain claim-level authoritative provenance" });
  }
  const allowedAuthority = new Set([
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
  if (authority.length === 0) {
    errors.push({ path, message: "authority must classify the concept's material claims" });
  }
  for (const value of authority) {
    if (!allowedAuthority.has(value)) {
      errors.push({ path, message: `unknown authority class: ${value}` });
    }
  }

  validateKnowledgeView(
    path,
    view,
    purpose,
    audience,
    authority,
    metadata,
    body,
    expectedContentHash,
    status,
    errors,
    warnings,
  );

  const sourceIds = new Set<string>();
  let hasHumanAuthority = false;
  let hasPinnedCode = false;
  let hasReconstructionReview = false;
  for (const [index, value] of sources.entries()) {
    const source = recordValue(value);
    const prefix = `sources[${index}]`;
    const id = stringValue(source?.id);
    const resource = stringValue(source?.resource);
    const kind = stringValue(source?.kind);
    if (!id) {
      errors.push({ path, message: `${prefix}.id is required for claim-level attribution` });
    } else if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      errors.push({ path, message: `${prefix}.id must be a valid Markdown footnote label` });
    } else if (sourceIds.has(id)) {
      errors.push({ path, message: `${prefix}.id must be unique` });
    } else {
      sourceIds.add(id);
    }
    if (!resource) {
      errors.push({ path, message: `${prefix}.resource is required by OKF v0.2` });
    }
    if (!["maintainer-decision", "source-code", "runtime-check", "archived-change", "reconstruction-review", "version-control", "external-primary"].includes(kind)) {
      errors.push({
        path,
        message: `${prefix}.kind must identify the workflow authority class`,
      });
    }
    const referencedChange = isProjectChangeResource(resource)
      ? projectChangeRecordAny(resource, changeIndex, false)
      : undefined;
    if (referencedChange?.__untrustedIntakeReference === true) {
      errors.push({
        path,
        message: `${prefix}.resource points to a project change that cites raw or intake material`,
      });
    }
    if (kind === "maintainer-decision") {
      hasHumanAuthority = true;
      if (!stringValue(source?.author).startsWith("human:")) {
        errors.push({ path, message: `${prefix}.author must identify the approving human` });
      }
      if (isProjectChangeResource(resource)) {
        const change = projectChangeRecord(resource, changeIndex, false);
        if (!change) {
          errors.push({ path, message: `${prefix}.resource points to a missing project change` });
        } else if (
          !hasApprovedHumanReview(
            change,
            undefined,
            stringValue(source?.author),
          )
        ) {
          errors.push({ path, message: `${prefix}.resource has no recorded human approval` });
        }
      } else if (isProjectReconstructionResource(resource)) {
        const reconstruction = projectReconstructionDecision(
          resource,
          reconstructionIndex,
        );
        if (!reconstruction) {
          errors.push({
            path,
            message: `${prefix}.resource points to a missing or unconfirmed reconstruction decision`,
          });
        } else if (
          !hasApprovedReconstructionReview(
            reconstruction.record,
            reconstruction.candidate,
            stringValue(source?.author),
          )
        ) {
          errors.push({
            path,
            message: `${prefix}.resource has no matching reconstruction maintainer approval`,
          });
        }
      } else {
        errors.push({
          path,
          message: `${prefix}.resource must point to a project-change or project-reconstruction decision`,
        });
      }
    }
    if (kind === "source-code") {
      if (!isPinnedCodeResource(resource)) {
        errors.push({
          path,
          message: `${prefix}.resource must pin repository, full commit, path, and optional symbol`,
        });
      } else {
        hasPinnedCode = true;
      }
    }
    if (kind === "reconstruction-review") {
      const reconstruction = projectReconstructionDecision(
        resource,
        reconstructionIndex,
      );
      if (!reconstruction) {
        errors.push({
          path,
          message: `${prefix}.resource points to a missing or unconfirmed reconstruction claim`,
        });
      } else if (!hasApprovedReconstructionCaseReview(reconstruction.record)) {
        errors.push({
          path,
          message: `${prefix}.resource has no approved reconstruction review`,
        });
      } else {
        hasReconstructionReview = true;
      }
    }
    if (
      (kind === "runtime-check" || kind === "archived-change")
      && !isProjectChangeResource(resource)
    ) {
      errors.push({ path, message: `${prefix}.resource must point to a project-change receipt` });
    } else if (
      kind === "runtime-check"
      && !projectChangeRecord(resource, changeIndex, false)
    ) {
      errors.push({ path, message: `${prefix}.resource points to a missing project change` });
    } else if (
      kind === "runtime-check"
      && recordValue(projectChangeRecord(resource, changeIndex, false)?.verification)?.result
        !== "passed"
    ) {
      errors.push({ path, message: `${prefix}.resource has no passed verification receipt` });
    } else if (
      kind === "archived-change"
      && !projectChangeRecord(resource, changeIndex, true)
    ) {
      errors.push({ path, message: `${prefix}.resource must point to an archived project change` });
    } else if (kind === "archived-change") {
      const archived = projectChangeRecord(resource, changeIndex, true)!;
      if (archived.outcome !== "completed" || !hasApprovedHumanReview(archived, "completion")) {
        errors.push({
          path,
          message: `${prefix}.resource must point to a completed, human-reviewed archived change`,
        });
      }
    }
    if (kind === "external-primary" && !/^https?:\/\/\S+$/i.test(resource)) {
      errors.push({ path, message: `${prefix}.resource must be an absolute primary-source URL` });
    }
    if (kind === "version-control" && !isVersionControlResource(resource)) {
      errors.push({ path, message: `${prefix}.resource must pin a commit or review artifact` });
    }
  }

  const footnotes = footnoteData(body);
  for (const id of sourceIds) {
    if (!footnotes.references.has(id)) {
      errors.push({ path, message: `source "${id}" is not attributed by a [^${id}] claim footnote` });
    }
    if (!footnotes.definitions.has(id)) {
      errors.push({ path, message: `source "${id}" requires a [^${id}]: footnote definition` });
    }
  }
  for (const id of footnotes.references) {
    if (!sourceIds.has(id)) {
      errors.push({ path, message: `claim footnote [^${id}] has no matching sources[].id` });
    }
  }

  const normativeAuthority = authority.some((value) =>
    [
      "intent",
      "product-meaning",
      "architecture-rationale",
      "ownership",
      "contract",
      "operational-policy",
      "decision",
    ].includes(value)
  );
  if (normativeAuthority && !hasHumanAuthority) {
    errors.push({
      path,
      message: "normative authority requires a maintainer-decision source",
    });
  }
  if (
    authority.includes("implementation")
    && !hasPinnedCode
    && !(
      stringValue(realization?.delivery) === "absent"
      && hasReconstructionReview
    )
  ) {
    errors.push({
      path,
      message:
        "implementation authority requires pinned source code, or a reviewed reconstruction receipt for absent delivery",
    });
  }
  if (authority.includes("architecture-rationale") && !hasPinnedCode) {
    errors.push({
      path,
      message: "architecture-rationale authority requires pinned code that was checked for contradiction",
    });
  }
  if (
    authority.includes("history")
    && !sources.some((value) =>
      recordValue(value)?.kind === "archived-change"
      || recordValue(value)?.kind === "reconstruction-review"
      || (
        recordValue(value)?.kind === "maintainer-decision"
        && isProjectReconstructionResource(stringValue(recordValue(value)?.resource))
      )
    )
  ) {
    errors.push({
      path,
      message: "history authority requires an archived change or reviewed reconstruction decision",
    });
  }
  if (
    authority.includes("history")
    && !sources.some((value) => recordValue(value)?.kind === "version-control")
  ) {
    errors.push({ path, message: "history authority requires pinned version-control history" });
  }
  if (
    authority.includes("external")
    && !sources.some((value) => recordValue(value)?.kind === "external-primary")
  ) {
    errors.push({ path, message: "external authority requires an external-primary source" });
  }

  validateRealization(path, authority, realization, errors);

  if (status === "stable") {
    if (verifications.length === 0) {
      errors.push({ path, message: "stable concepts require a verification event" });
    }
    const fresh = verifications.some((verification) =>
      isIsoDateTime(stringValue(verification.at))
      && Date.parse(stringValue(verification.at)) >= Date.parse(generatedAt)
      && stringValue(verification.content_hash) === expectedContentHash
    );
    if (!fresh) {
      errors.push({
        path,
        message:
          "stable concepts require verification at or after generated.at for the current content hash",
      });
    }
    if (normativeAuthority && !verifications.some((verification) =>
      stringValue(verification.by).startsWith("human:")
    )) {
      errors.push({
        path,
        message: "maintainer-decision sources require human verification",
      });
    }
  }

  for (const [index, verification] of verifications.entries()) {
    if (!isActor(stringValue(verification.by))) {
      errors.push({ path, message: `verified[${index}].by must follow the OKF actor convention` });
    }
    if (!isIsoDateTime(stringValue(verification.at))) {
      errors.push({ path, message: `verified[${index}].at must be an ISO 8601 datetime` });
    }
    if (!/^[0-9a-f]{64}$/i.test(stringValue(verification.content_hash))) {
      errors.push({
        path,
        message: `verified[${index}].content_hash must be a SHA-256 knowledge content hash`,
      });
    }
  }

  if (status === "deprecated") {
    if (!stringValue(metadata.superseded_by) && !stringValue(metadata.deprecation_reason)) {
      errors.push({
        path,
        message: "deprecated concepts require superseded_by or deprecation_reason",
      });
    }
  }

  if (!hasPinnedCode && sources.some((value) => recordValue(value)?.kind === "runtime-check")) {
    warnings.push({
      path,
      message: "runtime evidence is present without a pinned source-code reference",
    });
  }
}

async function readDecisionNodes(
  target: string,
  knowledgeRoot: string,
  markdown: string[],
): Promise<DecisionNode[]> {
  const decisions: DecisionNode[] = [];
  for (const relativePath of markdown) {
    if (/(?:^|\/)(?:index|log)\.md$/i.test(relativePath)) {
      continue;
    }
    const absolute = join(knowledgeRoot, relativePath);
    try {
      const parsed = parseFrontmatter(decodeUtf8(await readFile(absolute)), true);
      if (!parsed.metadata || !stringArray(parsed.metadata.authority).includes("decision")) {
        continue;
      }
      decisions.push({
        path: portable(relative(target, absolute)),
        id: stringValue(parsed.metadata.decision_id),
        effectiveAt: stringValue(parsed.metadata.effective_at),
        status: stringValue(parsed.metadata.status),
        supersedes: stringArray(parsed.metadata.supersedes),
        supersededBy: stringValue(parsed.metadata.superseded_by),
        hasSupersedes: Array.isArray(parsed.metadata.supersedes),
        hasSupersededBy: Object.hasOwn(parsed.metadata, "superseded_by")
          && typeof parsed.metadata.superseded_by === "string",
      });
    } catch {
      // The normal concept pass reports unreadable or malformed selected files.
    }
  }
  return decisions;
}

function validateDecisionLineage(
  decisions: DecisionNode[],
  errors: KnowledgeValidationIssue[],
): void {
  const byPath = new Map(decisions.map((decision) => [decision.path, decision]));
  const ids = new Map<string, string>();

  for (const decision of decisions) {
    if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(decision.id)) {
      errors.push({
        path: decision.path,
        message: "decision authority requires a stable lowercase decision_id",
      });
    } else if (ids.has(decision.id)) {
      errors.push({
        path: decision.path,
        message: `decision_id is duplicated by ${ids.get(decision.id)}`,
      });
    } else {
      ids.set(decision.id, decision.path);
    }
    if (!isIsoDateTime(decision.effectiveAt)) {
      errors.push({
        path: decision.path,
        message: "decision authority requires effective_at as an ISO 8601 datetime",
      });
    }
    if (!decision.hasSupersedes) {
      errors.push({
        path: decision.path,
        message: "decision authority requires supersedes as a list",
      });
    }
    if (!decision.hasSupersededBy) {
      errors.push({
        path: decision.path,
        message: "decision authority requires superseded_by as a string",
      });
    }
    if (decision.status === "stable" && decision.supersededBy) {
      errors.push({
        path: decision.path,
        message: "a decision with superseded_by must be deprecated, not stable",
      });
    }
    if (decision.status === "deprecated" && !decision.supersededBy) {
      errors.push({
        path: decision.path,
        message: "a deprecated decision requires superseded_by",
      });
    }
    for (const reference of [...decision.supersedes, decision.supersededBy].filter(Boolean)) {
      if (!isKnowledgeConceptReference(reference)) {
        errors.push({
          path: decision.path,
          message: `decision lineage reference must be project-relative under knowledge/: ${reference}`,
        });
      } else if (!byPath.has(reference)) {
        errors.push({
          path: decision.path,
          message: `decision lineage target does not exist or is not a decision: ${reference}`,
        });
      }
    }
  }

  for (const decision of decisions) {
    for (const predecessorPath of decision.supersedes) {
      const predecessor = byPath.get(predecessorPath);
      if (predecessor && predecessor.supersededBy !== decision.path) {
        errors.push({
          path: decision.path,
          message: `${predecessorPath} must reciprocally set superseded_by: ${decision.path}`,
        });
      }
    }
    if (decision.supersededBy) {
      const successor = byPath.get(decision.supersededBy);
      if (successor && !successor.supersedes.includes(decision.path)) {
        errors.push({
          path: decision.path,
          message: `${decision.supersededBy} must reciprocally list ${decision.path} in supersedes`,
        });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (decision: DecisionNode): void => {
    if (visiting.has(decision.path)) {
      errors.push({
        path: decision.path,
        message: "decision supersession lineage contains a cycle",
      });
      return;
    }
    if (visited.has(decision.path)) {
      return;
    }
    visiting.add(decision.path);
    const successor = byPath.get(decision.supersededBy);
    if (successor) {
      visit(successor);
    }
    visiting.delete(decision.path);
    visited.add(decision.path);
  };
  for (const decision of decisions) {
    visit(decision);
  }

  const seen = new Set<string>();
  for (const decision of decisions) {
    if (seen.has(decision.path)) {
      continue;
    }
    const component: DecisionNode[] = [];
    const pending = [decision];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (seen.has(current.path)) {
        continue;
      }
      seen.add(current.path);
      component.push(current);
      const linked = [
        ...current.supersedes,
        current.supersededBy,
        ...decisions
          .filter((candidate) =>
            candidate.supersedes.includes(current.path)
            || candidate.supersededBy === current.path
          )
          .map((candidate) => candidate.path),
      ].filter(Boolean);
      for (const path of linked) {
        const related = byPath.get(path);
        if (related && !seen.has(path)) {
          pending.push(related);
        }
      }
    }
    const current = component.filter((node) => node.status === "stable");
    if (current.length > 1) {
      errors.push({
        path: current[0]!.path,
        message: `decision lineage has multiple stable current records: ${
          current.map((node) => node.path).join(", ")
        }`,
      });
    }
  }
}

function isKnowledgeConceptReference(value: string): boolean {
  return /^knowledge\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.md$/.test(value);
}

async function collectKnowledgeTree(root: string): Promise<{
  markdown: string[];
  symlinks: string[];
}> {
  const markdown: string[] = [];
  const symlinks: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isSymbolicLink()) {
        symlinks.push(portable(relative(root, absolute)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        markdown.push(portable(relative(root, absolute)));
      }
    }
  }
  await walk(root);
  return {
    markdown: markdown.sort(),
    symlinks: symlinks.sort(),
  };
}

async function readProjectChangeIndex(target: string): Promise<ProjectChangeIndex> {
  return {
    active: await projectChangeRecords(join(target, "changes/active")),
    archive: await projectChangeRecords(join(target, "changes/archive")),
  };
}

async function readProjectReconstructionIndex(
  target: string,
): Promise<ProjectReconstructionIndex> {
  return {
    active: await projectReconstructionRecords(target, "active"),
    archive: await projectReconstructionRecords(target, "archive"),
  };
}

async function projectReconstructionRecords(
  target: string,
  lifecycle: "active" | "archive",
): Promise<Map<string, Record<string, unknown>>> {
  const root = join(target, "reconstruction", lifecycle);
  try {
    const result = new Map<string, Record<string, unknown>>();
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const content = await readFile(join(root, entry.name, "case.md"), "utf8");
        const parsed = parseFrontmatter(content, true);
        if (parsed.metadata) {
          const receipt = await inspectProjectReconstructionReceipt(
            target,
            entry.name,
            lifecycle,
            true,
          );
          result.set(entry.name, {
            ...parsed.metadata,
            __receiptReady: receipt.issues.length === 0,
          });
        }
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    }
    return result;
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Map();
    }
    throw error;
  }
}

async function projectChangeRecords(
  root: string,
): Promise<Map<string, Record<string, unknown>>> {
  try {
    const result = new Map<string, Record<string, unknown>>();
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const content = await readFile(join(root, entry.name, "change.md"), "utf8");
        const document = parseWorkSpec(content);
        if (document.metadata) {
          const bundleIssues = await bundleCompletionIssues(
            join(root, entry.name),
            document,
          );
          result.set(entry.name, {
            ...document.metadata,
            __untrustedIntakeReference: containsUntrustedIntakePath(content),
            __receiptReady: completionIssues(document, true).length === 0
              && bundleIssues.length === 0
              && document.metadata.status === "completed"
              && (
                !root.endsWith(`${sep}archive`)
                || document.metadata.outcome === "completed"
              ),
          });
        }
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    }
    return result;
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Map();
    }
    throw error;
  }
}

function resolveConceptPath(target: string, knowledgeRoot: string, input: string): string {
  const normalized = input.replace(/^\/+/, "");
  const absolute = resolve(target, normalized.startsWith("knowledge/")
    ? normalized
    : join("knowledge", normalized));
  const boundary = `${resolve(knowledgeRoot)}${sep}`;
  if (!absolute.startsWith(boundary) || !absolute.toLowerCase().endsWith(".md")) {
    throw new Error(`Knowledge concept path escapes knowledge/: ${input}`);
  }
  return absolute;
}

async function requireKnowledgeRepository(targetInput: string): Promise<string> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Knowledge command requires a knowledge repository: ${target}`);
  }
  return target;
}

function parseFrontmatter(
  content: string,
  required: boolean,
): { metadata?: Record<string, unknown>; body: string; error?: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return {
      body: content,
      ...(required ? { error: "concept must start with YAML frontmatter" } : {}),
    };
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    return { body: content, error: "frontmatter is not closed" };
  }
  try {
    const metadata = parse(lines.slice(1, end).join("\n")) as unknown;
    if (!isRecord(metadata)) {
      return { body: lines.slice(end + 1).join("\n"), error: "frontmatter must be a mapping" };
    }
    return { metadata, body: lines.slice(end + 1).join("\n") };
  } catch (error) {
    return { body: lines.slice(end + 1).join("\n"), error: `invalid YAML: ${errorMessage(error)}` };
  }
}

function normalizeVerifications(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return isRecord(value) ? [value] : [];
}

function footnoteData(body: string): {
  references: Set<string>;
  definitions: Set<string>;
} {
  const definitions = new Set(
    [...body.matchAll(/^\[\^([A-Za-z0-9_-]+)\]:/gm)].map((match) => match[1]!),
  );
  const counts = new Map<string, number>();
  for (const match of body.matchAll(/\[\^([A-Za-z0-9_-]+)\]/g)) {
    const id = match[1]!;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const references = new Set(
    [...counts]
      .filter(([id, count]) => count > (definitions.has(id) ? 1 : 0))
      .map(([id]) => id),
  );
  return { references, definitions };
}

function containsUntrustedIntakePath(content: string): boolean {
  return /(?:^|[\s("'`:=])(?:(?:\.\.\/|\.\/|\/)*(?:raw|intake)\/|(?:raw|intake):)[^\s)"'`]*/im.test(content);
}

function isPinnedCodeResource(value: string): boolean {
  return /^git:.+@[0-9a-f]{40}#[^#\s]+$/i.test(value);
}

function isVersionControlResource(value: string): boolean {
  return /^git:.+@[0-9a-f]{40}(?:#[^#\s]+)?$/i.test(value)
    || /^https?:\/\/\S+\/(?:pull|merge_requests|commit|commits)\/\S+$/i.test(value);
}

function isProjectChangeResource(value: string): boolean {
  return /^project-change:[a-z0-9][a-z0-9-]{0,95}#[A-Za-z0-9_./-]+$/.test(value);
}

function isProjectReconstructionResource(value: string): boolean {
  return /^project-reconstruction:[a-z0-9][a-z0-9-]{0,95}#[a-z0-9][a-z0-9-]{0,95}$/.test(value);
}

function projectChangeRecord(
  resource: string,
  index: ProjectChangeIndex,
  archiveOnly: boolean,
): Record<string, unknown> | undefined {
  const record = projectChangeRecordAny(resource, index, archiveOnly);
  return record?.__receiptReady === true ? record : undefined;
}

function projectChangeRecordAny(
  resource: string,
  index: ProjectChangeIndex,
  archiveOnly: boolean,
): Record<string, unknown> | undefined {
  const match = /^project-change:([^#]+)#/.exec(resource);
  if (!match) {
    return undefined;
  }
  const id = match[1]!;
  return index.archive.get(id) ?? (!archiveOnly ? index.active.get(id) : undefined);
}

function projectReconstructionDecision(
  resource: string,
  index: ProjectReconstructionIndex,
): {
  record: Record<string, unknown>;
  candidate: Record<string, unknown>;
} | undefined {
  const match = /^project-reconstruction:([^#]+)#(.+)$/.exec(resource);
  if (!match) {
    return undefined;
  }
  const id = match[1]!;
  const candidateId = match[2]!;
  const archived = index.archive.get(id);
  const active = index.active.get(id);
  const record = archived?.outcome === "completed" ? archived : active;
  if (
    !record
    || record.__receiptReady !== true
    || !["active", "completed"].includes(stringValue(record.status))
  ) {
    return undefined;
  }
  const candidate = (Array.isArray(record.candidate_claims)
    ? record.candidate_claims.filter(isRecord)
    : []
  ).find((entry) =>
    entry.id === candidateId && entry.disposition === "confirmed"
  );
  return candidate ? { record, candidate } : undefined;
}

function hasApprovedHumanReview(
  metadata: Record<string, unknown>,
  requiredStage?: "framing" | "completion",
  actor?: string,
): boolean {
  const review = recordValue(metadata.maintainer_review);
  const stages = requiredStage ? [requiredStage] : ["framing", "completion"];
  return stages.some((stage) => {
    const entry = recordValue(review?.[stage]);
    return entry?.status === "approved"
      && stringValue(entry.by).startsWith("human:")
      && (!actor || entry.by === actor)
      && isIsoDateTime(stringValue(entry.at));
  });
}

function hasApprovedReconstructionReview(
  record: Record<string, unknown>,
  candidate: Record<string, unknown>,
  actor: string,
): boolean {
  const review = recordValue(record.maintainer_review);
  const decision = recordValue(candidate.maintainer_decision);
  return review?.status === "approved"
    && review.by === actor
    && isIsoDateTime(stringValue(review.at))
    && decision?.status === "approved"
    && decision.by === actor
    && isIsoDateTime(stringValue(decision.at));
}

function hasApprovedReconstructionCaseReview(
  record: Record<string, unknown>,
): boolean {
  const review = recordValue(record.maintainer_review);
  return review?.status === "approved"
    && stringValue(review.by).startsWith("human:")
    && isIsoDateTime(stringValue(review.at));
}

function validateRealization(
  path: string,
  authority: string[],
  realization: Record<string, unknown> | undefined,
  errors: KnowledgeValidationIssue[],
): void {
  const productBearing = authority.includes("intent")
    || authority.includes("product-meaning");
  if (productBearing && !realization) {
    errors.push({
      path,
      message: "product intent or meaning requires explicit realization state",
    });
    return;
  }
  if (!realization) {
    return;
  }

  const intent = stringValue(realization.intent);
  const delivery = stringValue(realization.delivery);
  const alignment = stringValue(realization.alignment);
  if (!["accepted", "superseded", "not-applicable"].includes(intent)) {
    errors.push({
      path,
      message: "realization.intent must be accepted, superseded, or not-applicable in curated knowledge",
    });
  }
  if (
    ![
      "absent",
      "partial",
      "implemented",
      "verified",
      "retired",
      "unknown",
      "not-applicable",
    ].includes(delivery)
  ) {
    errors.push({ path, message: "realization.delivery is invalid" });
  }
  if (!["aligned", "drifted", "unknown", "not-applicable"].includes(alignment)) {
    errors.push({ path, message: "realization.alignment is invalid" });
  }
  if (!isIsoDateTime(stringValue(realization.assessed_at))) {
    errors.push({ path, message: "realization.assessed_at must be an ISO 8601 datetime" });
  }
  if (productBearing && intent === "not-applicable") {
    errors.push({
      path,
      message: "product intent or meaning cannot use realization.intent: not-applicable",
    });
  }
  if (
    !["unknown", "not-applicable"].includes(delivery)
    && !authority.includes("implementation")
  ) {
    errors.push({
      path,
      message: "a concrete realization.delivery requires implementation authority",
    });
  }
  if (
    ["aligned", "drifted"].includes(alignment)
    && (!productBearing || !authority.includes("implementation"))
  ) {
    errors.push({
      path,
      message: "a concrete realization.alignment requires both product and implementation authority",
    });
  }
  if (delivery === "verified" && alignment === "unknown") {
    errors.push({
      path,
      message: "verified delivery must state whether it aligns with accepted intent",
    });
  }
}

function validateKnowledgeView(
  path: string,
  view: string,
  purpose: string,
  audience: string[],
  authority: string[],
  metadata: Record<string, unknown>,
  body: string,
  expectedContentHash: string,
  status: string,
  errors: KnowledgeValidationIssue[],
  warnings: KnowledgeValidationIssue[],
): void {
  const requiredPurpose = KNOWLEDGE_VIEW_PURPOSE.get(view);
  if (!requiredPurpose) {
    errors.push({
      path,
      message: "view must be product, engineering, decision, reference, or uncertainty",
    });
  } else if (purpose !== requiredPurpose) {
    errors.push({
      path,
      message: `purpose must be "${requiredPurpose}" for view "${view}"`,
    });
  }

  if (audience.length === 0) {
    errors.push({ path, message: "audience must contain at least one reader role" });
  }
  for (const role of audience) {
    if (!KNOWLEDGE_AUDIENCES.has(role)) {
      errors.push({ path, message: `unknown audience role: ${role}` });
    }
  }
  if (view === "product" && !audience.includes("stakeholder")) {
    errors.push({ path, message: "product view must include the stakeholder audience" });
  }
  if (
    view === "engineering"
    && !audience.some((role) => role === "engineer" || role === "operator")
  ) {
    errors.push({
      path,
      message: "engineering view must include the engineer or operator audience",
    });
  }
  if (
    (view === "decision" || view === "uncertainty")
    && !audience.includes("maintainer")
  ) {
    errors.push({
      path,
      message: `${view} view must include the maintainer audience`,
    });
  }

  const expectedView = expectedViewForPath(path);
  if (expectedView && view !== expectedView) {
    errors.push({
      path,
      message: `view must match its knowledge lane: expected "${expectedView}", found "${view || "(missing)"}"`,
    });
  }
  if (view === "decision" && !authority.includes("decision")) {
    errors.push({ path, message: "decision view requires decision authority" });
  }
  if (view === "reference" && !authority.includes("external")) {
    errors.push({ path, message: "reference view requires external authority" });
  }
  if (
    view === "engineering"
    && (authority.includes("intent") || authority.includes("product-meaning"))
  ) {
    errors.push({
      path,
      message: "engineering view must link product meaning instead of claiming product authority",
    });
  }

  if (view === "product") {
    validateRequiredSections(path, body, PRODUCT_SECTIONS, errors);
    validateLinkOnlySection(path, body, "Engineering details", errors);
    if (/```|~~~/m.test(body)) {
      errors.push({ path, message: "product view must not contain fenced code" });
    }
    if (/`/.test(body)) {
      errors.push({
        path,
        message: "product view must not contain inline code or technical identifiers",
      });
    }
    const technicalHeading = markdownHeadings(body).find((heading) =>
      /(?:technical|implementation|architecture|api|schema|source code)/i.test(heading)
      && heading.toLowerCase() !== "engineering details"
    );
    if (technicalHeading) {
      errors.push({
        path,
        message: `product view contains a technical section: ${technicalHeading}`,
      });
    }
    if (containsTechnicalIdentifiers(stakeholderText(body))) {
      warnings.push({
        path,
        message: "product view contains technical-looking identifiers; verify the stakeholder abstraction",
      });
    }
  }
  if (view === "engineering") {
    validateRequiredSections(path, body, ENGINEERING_SECTIONS, errors);
  }

  validateQualityReceipt(
    path,
    recordValue(recordValue(metadata["x-wf"])?.quality),
    expectedContentHash,
    status,
    stringValue(recordValue(metadata.generated)?.at),
    errors,
  );
}

function expectedViewForPath(path: string): string | undefined {
  if (
    /^knowledge\/(?:vision|product)\//.test(path)
    || /^knowledge\/areas\/[^/]+\/(?:capabilities|use-cases|concepts|rules)\//.test(path)
  ) {
    return "product";
  }
  if (
    /^knowledge\/(?:architecture|repositories)\//.test(path)
    || /^knowledge\/areas\/[^/]+\/implementation\//.test(path)
  ) {
    return "engineering";
  }
  if (
    /^knowledge\/decisions\//.test(path)
    || /^knowledge\/areas\/[^/]+\/decisions\//.test(path)
  ) {
    return "decision";
  }
  if (/^knowledge\/references\//.test(path)) {
    return "reference";
  }
  if (/^knowledge\/uncertainties\//.test(path)) {
    return "uncertainty";
  }
  return undefined;
}

function validateQualityReceipt(
  path: string,
  quality: Record<string, unknown> | undefined,
  expectedContentHash: string,
  lifecycle: string,
  generatedAt: string,
  errors: KnowledgeValidationIssue[],
): void {
  if (!quality) {
    if (lifecycle === "stable") {
      errors.push({ path, message: "stable concepts require x-wf.quality review" });
    }
    return;
  }
  const status = stringValue(quality.status);
  if (!["pending", "passed"].includes(status)) {
    errors.push({ path, message: "x-wf.quality.status must be pending or passed" });
    return;
  }
  if (status === "pending") {
    if (lifecycle === "stable") {
      errors.push({ path, message: "stable concepts require a passed x-wf.quality review" });
    }
    return;
  }
  if (!isActor(stringValue(quality.by))) {
    errors.push({ path, message: "x-wf.quality.by must follow the OKF actor convention" });
  }
  if (!isIsoDateTime(stringValue(quality.at))) {
    errors.push({ path, message: "x-wf.quality.at must be an ISO 8601 datetime" });
  } else if (Date.parse(stringValue(quality.at)) < Date.parse(generatedAt)) {
    errors.push({
      path,
      message: "x-wf.quality.at must be at or after generated.at",
    });
  }
  if (stringValue(quality.content_hash) !== expectedContentHash) {
    errors.push({
      path,
      message: "x-wf.quality.content_hash must match the current knowledge content hash",
    });
  }
  const checks = stringArray(quality.checks);
  for (const check of QUALITY_CHECKS) {
    if (!checks.includes(check)) {
      errors.push({ path, message: `x-wf.quality.checks must include ${check}` });
    }
  }
  for (const check of checks) {
    if (!QUALITY_CHECKS.includes(check)) {
      errors.push({ path, message: `unknown x-wf.quality check: ${check}` });
    }
  }
  const axes = recordValue(quality.axes);
  for (const axis of QUALITY_AXES) {
    const review = recordValue(axes?.[axis]);
    if (review?.status !== "passed") {
      errors.push({
        path,
        message: `x-wf.quality.axes.${axis}.status must be passed`,
      });
    }
    if (!isActor(stringValue(review?.by))) {
      errors.push({
        path,
        message: `x-wf.quality.axes.${axis}.by must follow the OKF actor convention`,
      });
    }
    if (!isIsoDateTime(stringValue(review?.at))) {
      errors.push({
        path,
        message: `x-wf.quality.axes.${axis}.at must be an ISO 8601 datetime`,
      });
    } else if (Date.parse(stringValue(review?.at)) < Date.parse(generatedAt)) {
      errors.push({
        path,
        message: `x-wf.quality.axes.${axis}.at must be at or after generated.at`,
      });
    }
    if (stringValue(review?.content_hash) !== expectedContentHash) {
      errors.push({
        path,
        message: `x-wf.quality.axes.${axis}.content_hash must match the current knowledge content hash`,
      });
    }
  }
}

function validateAreaIndex(
  path: string,
  body: string,
  errors: KnowledgeValidationIssue[],
  warnings: KnowledgeValidationIssue[],
): void {
  validateRequiredSections(path, body, AREA_INDEX_SECTIONS, errors);
  validateLinkOnlySection(path, body, "Engineering details", errors);
  if (/```|~~~|`/.test(body)) {
    errors.push({
      path,
      message: "Area index is stakeholder-facing and must not contain code or technical identifiers",
    });
  }
  if (containsTechnicalIdentifiers(stakeholderText(body))) {
    warnings.push({
      path,
      message: "Area index contains technical-looking identifiers; move details to engineering knowledge",
    });
  }
}

function validateRequiredSections(
  path: string,
  body: string,
  required: string[],
  errors: KnowledgeValidationIssue[],
): void {
  const headings = new Set(markdownHeadings(body).map((heading) => heading.toLowerCase()));
  for (const section of required) {
    if (!headings.has(section.toLowerCase())) {
      errors.push({ path, message: `required section is missing: ${section}` });
    }
  }
}

function markdownHeadings(body: string): string[] {
  return [...body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)]
    .map((match) => match[1]!.trim());
}

function stakeholderText(body: string): string {
  return body
    .replace(/\]\([^)]+\)/g, "]")
    .replace(/^\[\^[A-Za-z0-9_-]+\]:.*$/gm, "");
}

function containsTechnicalIdentifiers(body: string): boolean {
  return /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/\S+|\b[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|py|rs|go|java|kt|swift|sql|proto|json|ya?ml)\b|\b[a-z]+_[a-z0-9_]+\b/.test(body);
}

function validateLinkOnlySection(
  path: string,
  body: string,
  heading: string,
  errors: KnowledgeValidationIssue[],
): void {
  const section = markdownSection(body, heading);
  if (section === undefined) {
    return;
  }
  const invalid = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) =>
      !/^(?:[-*]\s+)?\[[^\]]+\]\([^)]+\)$/.test(line)
      && !/^(?:none|not applicable)\.?$/i.test(line)
    );
  if (invalid) {
    errors.push({
      path,
      message: `${heading} must contain links only, or an explicit not-applicable statement`,
    });
  }
}

function markdownSection(body: string, heading: string): string | undefined {
  const lines = body.split(/\r?\n/);
  const wanted = heading.toLowerCase();
  let start = -1;
  let level = 0;
  for (const [index, line] of lines.entries()) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match && match[2]!.trim().toLowerCase() === wanted) {
      start = index + 1;
      level = match[1]!.length;
      break;
    }
  }
  if (start < 0) {
    return undefined;
  }
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index]!);
    if (match && match[1]!.length <= level) {
      end = index;
      break;
    }
    if (/^\[\^[A-Za-z0-9_-]+\]:/.test(lines[index]!)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function isActor(value: string): boolean {
  return /^(?:human:[^\s:]+|process:[^\s:]+|[^/\s]+\/[^/\s]+)$/.test(value);
}

export async function hashKnowledgeConcept(
  targetInput: string,
  conceptPath: string,
): Promise<KnowledgeConceptHashResult> {
  const target = await requireKnowledgeRepository(targetInput);
  const knowledgeRoot = join(target, "knowledge");
  const absolute = resolveConceptPath(target, knowledgeRoot, conceptPath);
  const content = decodeUtf8(await readFile(absolute));
  const parsed = parseFrontmatter(content, true);
  if (!parsed.metadata) {
    throw new Error(parsed.error ?? "concept frontmatter is missing");
  }
  return {
    path: portable(relative(target, absolute)),
    contentHash: conceptDocumentHash(parsed.metadata, parsed.body),
  };
}

function conceptDocumentHash(
  metadata: Record<string, unknown>,
  body: string,
): string {
  const material = { ...metadata };
  delete material.verified;
  const workflow = recordValue(material["x-wf"]);
  if (workflow) {
    const workflowMaterial = { ...workflow };
    delete workflowMaterial.quality;
    material["x-wf"] = workflowMaterial;
  }
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(material)))
    .update("\n")
    .update(body.replace(/\r\n/g, "\n").trimEnd())
    .digest("hex");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function decodeUtf8(content: Buffer): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  return text;
}

function portable(path: string): string {
  return path.split(sep).join("/");
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

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
