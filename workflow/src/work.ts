import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { stringify } from "yaml";
import { findDistributionRoot } from "./assets.js";
import {
  errorMessage,
  isMissingFileError,
  portableRelative,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { completionIssues, parseWorkSpec, serializeWorkSpec } from "./work-spec.js";
import type { WorkMode, WorkOutcome, WorkSpecDocument } from "./types.js";
import { WORKFLOW_VERSION } from "./types.js";

export interface BeginWorkOptions {
  target: string;
  slug: string;
  title: string;
  mode: WorkMode;
  knowledgeRef?: string;
  graphQuery?: string;
  distributionRoot?: string;
  now?: Date;
}

export interface BeginWorkResult {
  id: string;
  specPath: string;
  pointerPath: string;
}

export interface VerifyWorkResult {
  id: string;
  specPath: string;
  issues: string[];
}

export interface FlushWorkOptions {
  target: string;
  id: string;
  outcome: WorkOutcome;
  now?: Date;
}

export interface FlushWorkResult {
  id: string;
  outcome: WorkOutcome;
  rawPath: string;
  archivePath: string;
}

export async function beginWork(options: BeginWorkOptions): Promise<BeginWorkResult> {
  const target = resolve(options.target);
  const config = await readConfig(target);
  if (config.profile !== "leaf") {
    throw new Error("Work records must be started from a leaf repository");
  }
  if (options.mode !== "handoff") {
    if (!options.knowledgeRef?.trim()) {
      throw new Error("Full and slice work require --knowledge-ref <path>");
    }
    if (!options.graphQuery?.trim()) {
      throw new Error("Full and slice work require --graph-query <query>");
    }
    await assertGraphReady(target);
  }

  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  await assertKnowledgeRoot(knowledgeRoot);
  if (options.knowledgeRef) {
    await assertKnowledgeReference(knowledgeRoot, options.knowledgeRef);
  }

  const metadata = readRepositoryMetadata(target);
  const now = options.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const slug = normalizeSlug(options.slug);
  const id = await uniqueWorkId(join(knowledgeRoot, "changes/active"), `${date}-${slug}`);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const templatePath = join(
    distributionRoot,
    "skills/manage-project-work/assets/work-spec.md",
  );
  const template = parseWorkSpec(await readFile(templatePath, "utf8"));
  const createdAt = now.toISOString();

  template.metadata = {
    ...template.metadata,
    id,
    title: options.title,
    mode: options.mode,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    source: metadata,
    knowledge_alignment: {
      reviewed: options.knowledgeRef ? [options.knowledgeRef] : [],
      conflicts: [],
    },
    graph_evidence: {
      queries: options.graphQuery ? [options.graphQuery] : [],
    },
  };

  const activeDirectory = join(knowledgeRoot, "changes/active", id);
  const specPath = join(activeDirectory, "SPEC.md");
  const pointerPath = join(target, ".workflow/current", `${id}.json`);
  await mkdir(activeDirectory, { recursive: false });
  await writeFile(specPath, serializeWorkSpec(template), { encoding: "utf8", flag: "wx" });
  await mkdir(dirname(pointerPath), { recursive: true });
  await writeFile(
    pointerPath,
    `${JSON.stringify({
      schemaVersion: 1,
      id,
      spec: portableRelative(target, specPath),
      createdAt,
    }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );

  return { id, specPath, pointerPath };
}

export async function verifyWork(targetInput: string, id: string): Promise<VerifyWorkResult> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const specPath = join(knowledgeRoot, "changes/active", id, "SPEC.md");
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  return {
    id,
    specPath,
    issues: completionIssues(document, false),
  };
}

export async function flushWork(options: FlushWorkOptions): Promise<FlushWorkResult> {
  const target = resolve(options.target);
  const config = await readConfig(target);
  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const activeDirectory = join(knowledgeRoot, "changes/active", options.id);
  const specPath = join(activeDirectory, "SPEC.md");
  const document = parseWorkSpec(await readFile(specPath, "utf8"));

  if (options.outcome === "completed") {
    const issues = completionIssues(document, true);
    if (issues.length > 0) {
      throw new Error(`Completed flush is blocked: ${issues.join("; ")}`);
    }
  }

  const archivePath = join(knowledgeRoot, "changes/archive", options.id);
  await assertAbsent(archivePath, "archive");
  const now = options.now ?? new Date();
  const metadata = readRepositoryMetadata(target);
  const rawDirectory = join(
    knowledgeRoot,
    "raw",
    now.toISOString().slice(0, 4),
    now.toISOString().slice(5, 7),
  );
  const rawName = `${compactTimestamp(now)}--${safeName(metadata.repository)}--${safeName(options.id)}.md`;
  const rawPath = join(rawDirectory, rawName);
  await assertAbsent(rawPath, "raw record");

  const raw = buildRawRecord(document, metadata, options.outcome, options.id, now);
  await mkdir(rawDirectory, { recursive: true });
  await writeFile(rawPath, raw, { encoding: "utf8", flag: "wx" });
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(activeDirectory, archivePath);
  await removePointer(join(target, ".workflow/current", `${options.id}.json`));

  return { id: options.id, outcome: options.outcome, rawPath, archivePath };
}

function buildRawRecord(
  document: WorkSpecDocument,
  repository: ReturnType<typeof readRepositoryMetadata>,
  outcome: WorkOutcome,
  id: string,
  now: Date,
): string {
  const title = typeof document.metadata.title === "string"
    ? document.metadata.title
    : id;
  const frontmatter = {
    type: "Work Record",
    title,
    description: `${outcome} project work from ${repository.repository}`,
    status: outcome === "completed" ? "stable" : outcome === "partial" ? "draft" : "deprecated",
    tags: ["workflow", "raw", outcome],
    generated: {
      by: `wfctl/${WORKFLOW_VERSION}`,
      at: now.toISOString(),
    },
    sources: [
      {
        id: "source-repository",
        resource: repository.remote
          ? `${repository.remote}#${repository.commit}`
          : `repository:${repository.repository}@${repository.commit}`,
        title: repository.repository,
      },
    ],
    workflow: {
      id,
      outcome,
      flushed_at: now.toISOString(),
      source: repository,
      spec: document.metadata,
    },
  };

  return `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${document.body.trimStart()}`;
}

async function assertGraphReady(target: string): Promise<void> {
  try {
    await access(join(target, "graphify-out/graph.json"), constants.R_OK);
  } catch {
    throw new Error("Graphify graph is missing; build graphify-out/graph.json before starting work");
  }
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
  const boundary = `${resolve(root)}${sep}`;
  if (absolute !== resolve(root) && !absolute.startsWith(boundary)) {
    throw new Error("Knowledge reference escapes the knowledge repository");
  }
  try {
    await access(absolute, constants.R_OK);
  } catch (error) {
    throw new Error(`Knowledge reference is not readable: ${reference} (${errorMessage(error)})`);
  }
}

async function uniqueWorkId(activeRoot: string, base: string): Promise<string> {
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    try {
      await access(join(activeRoot, candidate), constants.F_OK);
    } catch {
      return candidate;
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

async function removePointer(path: string): Promise<void> {
  try {
    await unlink(path);
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

function compactTimestamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
