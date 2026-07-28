import {
  lstat,
  readFile,
  readdir,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";
import { errorMessage, isMissingFileError, readConfig } from "./config.js";

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
      errors,
      warnings,
    );
  }
  const decisions = await readDecisionNodes(target, knowledgeRoot, inventory.markdown);
  validateDecisionLineage(decisions, errors);

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

  const sourceIds = new Set<string>();
  let hasHumanAuthority = false;
  let hasPinnedCode = false;
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
    if (!["maintainer-decision", "source-code", "runtime-check", "archived-change", "version-control", "external-primary"].includes(kind)) {
      errors.push({
        path,
        message: `${prefix}.kind must identify the workflow authority class`,
      });
    }
    const referencedChange = isProjectChangeResource(resource)
      ? projectChangeRecord(resource, changeIndex, false)
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
      if (!isProjectChangeResource(resource)) {
        errors.push({ path, message: `${prefix}.resource must point to a project-change decision` });
      } else if (!projectChangeRecord(resource, changeIndex, false)) {
        errors.push({ path, message: `${prefix}.resource points to a missing project change` });
      } else if (
        !hasApprovedHumanReview(
          projectChangeRecord(resource, changeIndex, false)!,
          undefined,
          stringValue(source?.author),
        )
      ) {
        errors.push({ path, message: `${prefix}.resource has no recorded human approval` });
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
  if (authority.includes("implementation") && !hasPinnedCode) {
    errors.push({
      path,
      message: "implementation authority requires a pinned source-code source",
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
    && !sources.some((value) => recordValue(value)?.kind === "archived-change")
  ) {
    errors.push({ path, message: "history authority requires an archived-change source" });
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

  if (status === "stable") {
    if (verifications.length === 0) {
      errors.push({ path, message: "stable concepts require a verification event" });
    }
    const fresh = verifications.some((verification) =>
      isIsoDateTime(stringValue(verification.at))
      && Date.parse(stringValue(verification.at)) >= Date.parse(generatedAt)
    );
    if (!fresh) {
      errors.push({
        path,
        message: "stable concepts require verification at or after generated.at",
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
        const parsed = parseFrontmatter(content, true);
        if (parsed.metadata) {
          result.set(entry.name, {
            ...parsed.metadata,
            __untrustedIntakeReference: containsUntrustedIntakePath(content),
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

function projectChangeRecord(
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

function isActor(value: string): boolean {
  return /^(?:human:[^\s:]+|process:[^\s:]+|[^/\s]+\/[^/\s]+)$/.test(value);
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
