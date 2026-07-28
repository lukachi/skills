import {
  access,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { findDistributionRoot } from "./assets.js";
import {
  errorMessage,
  isMissingFileError,
  portableRelative,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { validateKnowledge } from "./knowledge.js";
import { completionIssues, parseWorkSpec, serializeWorkSpec } from "./work-spec.js";
import type {
  RepositoryMetadata,
  WorkMode,
  WorkOutcome,
} from "./types.js";

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
  codeRoot: string;
  knowledgeRoot: string;
  specPath: string;
  pointerPath: string;
}

export interface CreateHandoffOptions {
  target: string;
  slug: string;
  title: string;
  distributionRoot?: string;
  now?: Date;
}

export interface CreateHandoffResult {
  id: string;
  codeRoot: string;
  knowledgeRoot: string;
  path: string;
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

interface WorkPointer {
  schemaVersion: 3;
  id: string;
  codeRoot: string;
  knowledgeRoot: string;
  spec: string;
  createdAt: string;
  source: RepositoryMetadata;
}

export interface WorkStatusResult {
  id: string;
  valid: boolean;
  codeRoot: string;
  knowledgeRoot: string;
  specPath: string;
  pointerPath: string;
  source: RepositoryMetadata;
  currentSource: RepositoryMetadata;
  issues: string[];
}

export async function beginWork(options: BeginWorkOptions): Promise<BeginWorkResult> {
  const metadata = readRepositoryMetadata(resolve(options.target));
  const target = metadata.root;
  const config = await readConfig(target);
  if (config.profile !== "leaf") {
    throw new Error("Work records must be started from a leaf repository");
  }

  const configuredKnowledgeRoot = resolveKnowledgeRoot(target, config);
  await assertKnowledgeRoot(configuredKnowledgeRoot);
  const knowledgeRoot = await realpath(configuredKnowledgeRoot);
  if (options.knowledgeRef) {
    await assertKnowledgeReference(knowledgeRoot, options.knowledgeRef);
  }

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
  const activeDirectory = join(knowledgeRoot, "changes/active", id);
  const specPath = join(activeDirectory, "change.md");
  const pointerPath = join(target, ".workflow/current", `${id}.json`);

  template.metadata = {
    ...template.metadata,
    id,
    title: options.title,
    mode: options.mode,
    status: "shaping",
    created_at: createdAt,
    updated_at: createdAt,
    source: metadata,
    workspace: {
      code_root: target,
      knowledge_root: knowledgeRoot,
      spec_path: specPath,
      pointer_path: pointerPath,
      worktree_id: metadata.worktreeId,
    },
    knowledge_alignment: {
      reviewed: options.knowledgeRef ? [options.knowledgeRef] : [],
      conflicts: [],
    },
    graph_evidence: {
      queries: options.graphQuery ? [options.graphQuery] : [],
    },
  };

  await mkdir(activeDirectory, { recursive: false });
  await writeFile(specPath, serializeWorkSpec(template), { encoding: "utf8", flag: "wx" });
  await mkdir(dirname(pointerPath), { recursive: true });
  await writeFile(
    pointerPath,
    `${JSON.stringify({
      schemaVersion: 3,
      id,
      codeRoot: target,
      knowledgeRoot,
      spec: portableRelative(target, specPath),
      createdAt,
      source: metadata,
    }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );

  return { id, codeRoot: target, knowledgeRoot, specPath, pointerPath };
}

export async function createHandoff(
  options: CreateHandoffOptions,
): Promise<CreateHandoffResult> {
  const metadata = readRepositoryMetadata(resolve(options.target));
  const target = metadata.root;
  const config = await readConfig(target);
  if (config.profile !== "leaf") {
    throw new Error("Handoffs must be created from a leaf repository");
  }
  const configuredKnowledgeRoot = resolveKnowledgeRoot(target, config);
  await assertKnowledgeRoot(configuredKnowledgeRoot);
  const knowledgeRoot = await realpath(configuredKnowledgeRoot);
  const now = options.now ?? new Date();
  const base = `${now.toISOString().slice(0, 10)}-${normalizeSlug(options.slug)}`;
  const inboxRoot = join(knowledgeRoot, "changes/inbox");
  const id = await uniqueFileId(inboxRoot, base);
  const path = join(inboxRoot, `${id}.md`);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const template = parseWorkSpec(await readFile(
    join(distributionRoot, "skills/manage-project-work/assets/handoff.md"),
    "utf8",
  ));
  template.metadata = {
    ...template.metadata,
    id,
    title: options.title,
    status: "inbox",
    created_at: now.toISOString(),
    source: metadata,
  };
  await writeFile(path, serializeWorkSpec(template), {
    encoding: "utf8",
    flag: "wx",
  });
  return { id, codeRoot: target, knowledgeRoot, path };
}

export async function verifyWork(targetInput: string, id: string): Promise<VerifyWorkResult> {
  const context = await requireWorkContext(targetInput, id);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const issues = completionIssues(document, false);
  if (context.currentSource.dirty) {
    issues.push("bound source checkout must be clean for final verification");
  }
  const verification = record(document.metadata.verification);
  if (verification?.revision !== context.currentSource.commit) {
    issues.push("verification.revision does not match the current bound commit");
  }
  if (verification?.worktree_id !== context.currentSource.worktreeId) {
    issues.push("verification.worktree_id does not match the current bound worktree");
  }
  return {
    id,
    specPath: context.specPath,
    issues,
  };
}

export async function closeWork(options: CloseWorkOptions): Promise<CloseWorkResult> {
  const context = await requireWorkContext(options.target, options.id);
  const target = context.codeRoot;
  const knowledgeRoot = context.knowledgeRoot;
  const activeDirectory = dirname(context.specPath);
  const document = parseWorkSpec(await readFile(context.specPath, "utf8"));
  const metadata = readRepositoryMetadata(target);

  if (options.outcome === "completed") {
    const issues = completionIssues(document, true);
    if (issues.length > 0) {
      throw new Error(`Completed close is blocked: ${issues.join("; ")}`);
    }
    const promotion = record(document.metadata.knowledge_promotion);
    if (promotion?.status === "applied") {
      const concepts = stringArray(promotion.concepts);
      const validation = await validateKnowledge(knowledgeRoot, concepts);
      if (!validation.valid) {
        throw new Error(
          `Completed close is blocked by curated knowledge validation: ${
            validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          }`,
        );
      }
    }
    if (metadata.dirty) {
      throw new Error(
        "Completed close is blocked: the bound source checkout is dirty; commit or otherwise preserve the verified implementation, then verify again",
      );
    }
    const verification = record(document.metadata.verification);
    if (verification?.revision !== metadata.commit) {
      throw new Error(
        `Completed close is blocked: verification.revision ${String(verification?.revision ?? "")} does not match current commit ${metadata.commit}`,
      );
    }
    if (verification?.worktree_id !== metadata.worktreeId) {
      throw new Error(
        `Completed close is blocked: verification.worktree_id ${String(verification?.worktree_id ?? "")} does not match current worktree ${metadata.worktreeId}`,
      );
    }
  }

  const archivePath = join(knowledgeRoot, "changes/archive", options.id);
  await assertAbsent(archivePath, "archive");
  const now = options.now ?? new Date();
  document.metadata.status = options.outcome;
  document.metadata.outcome = options.outcome;
  document.metadata.closed_at = now.toISOString();
  document.metadata.updated_at = now.toISOString();
  document.metadata.source_at_close = metadata;
  await writeFile(context.specPath, serializeWorkSpec(document), "utf8");
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(activeDirectory, archivePath);
  await removePointer(join(target, ".workflow/current", `${options.id}.json`));

  return { id: options.id, outcome: options.outcome, archivePath };
}

export async function workStatus(
  targetInput: string,
  id?: string,
): Promise<WorkStatusResult[]> {
  const source = readRepositoryMetadata(resolve(targetInput));
  const target = source.root;
  const pointerRoot = join(target, ".workflow/current");
  const ids = id
    ? [id]
    : (await readdir(pointerRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -5))
      .sort();
  const results: WorkStatusResult[] = [];
  for (const workId of ids) {
    results.push(await inspectWorkContext(target, source, workId));
  }
  return results;
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

async function requireWorkContext(
  targetInput: string,
  id: string,
): Promise<WorkStatusResult> {
  const results = await workStatus(targetInput, id);
  const context = results[0];
  if (!context) {
    throw new Error(`Active work pointer not found: ${id}`);
  }
  if (!context.valid) {
    throw new Error(
      `Work context mismatch for ${id}: ${context.issues.join("; ")}`,
    );
  }
  return context;
}

async function inspectWorkContext(
  target: string,
  currentSource: RepositoryMetadata,
  id: string,
): Promise<WorkStatusResult> {
  const pointerPath = join(target, ".workflow/current", `${id}.json`);
  const raw = JSON.parse(await readFile(pointerPath, "utf8")) as Partial<WorkPointer>;
  if (
    raw.schemaVersion !== 3
    || raw.id !== id
    || !raw.codeRoot
    || !raw.knowledgeRoot
    || !raw.spec
    || !raw.source
  ) {
    throw new Error(`Unsupported or malformed active work pointer: ${pointerPath}`);
  }
  const pointer = raw as WorkPointer;
  const specPath = resolve(target, pointer.spec);
  const issues: string[] = [];

  if (pointer.codeRoot !== currentSource.root) {
    issues.push(
      `current checkout is ${currentSource.root}, but work is bound to ${pointer.codeRoot}`,
    );
  }
  if (pointer.source.repository !== currentSource.repository) {
    issues.push(
      `current repository is ${currentSource.repository}, but work is bound to ${pointer.source.repository}`,
    );
  }
  if (pointer.source.worktreeId !== currentSource.worktreeId) {
    issues.push(
      `current worktree is ${currentSource.worktreeId}, but work is bound to ${pointer.source.worktreeId}`,
    );
  }

  const config = await readConfig(target);
  const configuredKnowledgeRoot = await realpath(resolveKnowledgeRoot(target, config));
  if (pointer.knowledgeRoot !== configuredKnowledgeRoot) {
    issues.push(
      `configured knowledge root is ${configuredKnowledgeRoot}, but work is bound to ${pointer.knowledgeRoot}`,
    );
  }
  const activeRoot = join(pointer.knowledgeRoot, "changes/active");
  if (!inside(activeRoot, specPath)) {
    issues.push(`spec path is outside the active work root: ${specPath}`);
  }

  try {
    const document = parseWorkSpec(await readFile(specPath, "utf8"));
    const workspace = record(document.metadata.workspace);
    if (workspace?.code_root !== pointer.codeRoot) {
      issues.push("spec workspace.code_root does not match the leaf pointer");
    }
    if (workspace?.knowledge_root !== pointer.knowledgeRoot) {
      issues.push("spec workspace.knowledge_root does not match the leaf pointer");
    }
    if (workspace?.spec_path !== specPath) {
      issues.push("spec workspace.spec_path does not match its actual path");
    }
    if (workspace?.worktree_id !== pointer.source.worktreeId) {
      issues.push("spec workspace.worktree_id does not match the leaf pointer");
    }
  } catch (error) {
    issues.push(`cannot read bound spec: ${errorMessage(error)}`);
  }

  return {
    id,
    valid: issues.length === 0,
    codeRoot: pointer.codeRoot,
    knowledgeRoot: pointer.knowledgeRoot,
    specPath,
    pointerPath,
    source: pointer.source,
    currentSource,
    issues,
  };
}

function inside(parent: string, child: string): boolean {
  const boundary = `${resolve(parent)}${sep}`;
  return resolve(child).startsWith(boundary);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
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

async function uniqueFileId(root: string, base: string): Promise<string> {
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    try {
      await access(join(root, `${candidate}.md`), constants.F_OK);
    } catch {
      return candidate;
    }
  }
  throw new Error(`Cannot allocate a unique handoff id for ${base}`);
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
