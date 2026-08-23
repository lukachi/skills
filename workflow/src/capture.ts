import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { findDistributionRoot } from "./distribution.js";
import {
  isMissingFileError,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import { isRecord, parseWorkSpec, serializeWorkSpec } from "./work-spec.js";

export type CaptureOutcome = "routed" | "discarded";

export interface CreateCaptureOptions {
  target: string;
  slug: string;
  title: string;
  /** Defaults to `agent`; `maintainer` marks a capture only they can answer. */
  awaits?: CaptureAudience;
  distributionRoot?: string;
  now?: Date;
}

export interface CreateCaptureResult {
  id: string;
  codeRoot?: string;
  knowledgeRoot: string;
  path: string;
}

export type CaptureAudience = "maintainer" | "agent";

export interface CaptureSummary {
  id: string;
  title: string;
  status: "pending";
  path: string;
  createdAt: string;
  legacy: boolean;
  /**
   * Who the capture is for. A capture holding candidates nobody but the
   * maintainer can adjudicate is a question addressed to them, not a triage
   * item, and defaulting everything to `agent` hides those questions in a
   * queue that reads like housekeeping.
   */
  awaits: CaptureAudience;
}

export interface ListCapturesResult {
  knowledgeRoot: string;
  captures: CaptureSummary[];
}

export interface ResolveCaptureOptions {
  target: string;
  id: string;
  outcome: CaptureOutcome;
  reason: string;
  destinations?: string[];
  now?: Date;
}

export interface ResolveCaptureResult {
  id: string;
  outcome: CaptureOutcome;
  destinations: string[];
  archivePath: string;
}

export async function createCapture(
  options: CreateCaptureOptions,
): Promise<CreateCaptureResult> {
  const context = await resolveCaptureContext(options.target);
  const now = options.now ?? new Date();
  const base = `${now.toISOString().slice(0, 10)}-${normalizeSlug(options.slug)}`;
  const inboxRoot = join(context.knowledgeRoot, "changes/inbox");
  const id = await uniqueFileId(
    [inboxRoot, join(context.knowledgeRoot, "changes/archive/captures")],
    base,
  );
  const path = join(inboxRoot, `${id}.md`);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const template = parseWorkSpec(await readFile(
    join(distributionRoot, "skills/manage-project-work/assets/capture.md"),
    "utf8",
  ));
  template.metadata = {
    ...template.metadata,
    id,
    title: requireText(options.title, "Capture title"),
    status: "pending",
    created_at: now.toISOString(),
    awaits: options.awaits ?? "agent",
    source: durableSource(context.source),
  };
  await writeFile(path, serializeWorkSpec(template), {
    encoding: "utf8",
    flag: "wx",
  });
  return {
    id,
    ...(context.codeRoot ? { codeRoot: context.codeRoot } : {}),
    knowledgeRoot: context.knowledgeRoot,
    path,
  };
}

export async function listCaptures(target: string): Promise<ListCapturesResult> {
  const context = await resolveCaptureContext(target);
  const inboxRoot = join(context.knowledgeRoot, "changes/inbox");
  const entries = await readdir(inboxRoot, { withFileTypes: true });
  const captures: CaptureSummary[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const path = join(inboxRoot, entry.name);
    const parsed = parsePendingCapture(await readFile(path, "utf8"), path);
    captures.push({
      id: parsed.id,
      title: parsed.title,
      status: "pending",
      path,
      createdAt: parsed.createdAt,
      awaits: parsed.awaits,
      legacy: parsed.legacy,
    });
  }
  return { knowledgeRoot: context.knowledgeRoot, captures };
}

export async function resolveCapture(
  options: ResolveCaptureOptions,
): Promise<ResolveCaptureResult> {
  const context = await resolveCaptureContext(options.target);
  const id = normalizeCaptureId(options.id);
  const inboxPath = join(context.knowledgeRoot, "changes/inbox", `${id}.md`);
  const document = parseWorkSpec(await readFile(inboxPath, "utf8"));
  parsePendingCapture(serializeWorkSpec(document), inboxPath);
  const reason = requireText(options.reason, "Capture resolution reason");
  const destinations = await normalizeDestinations(
    context.knowledgeRoot,
    options.destinations ?? [],
  );
  if (options.outcome === "routed" && destinations.length === 0) {
    throw new Error("A routed capture requires at least one existing destination");
  }
  if (options.outcome === "discarded" && destinations.length > 0) {
    throw new Error("A discarded capture cannot declare destinations");
  }

  const now = options.now ?? new Date();
  delete document.metadata.handoff_version;
  document.metadata.capture_version = 1;
  document.metadata.kind = "capture";
  document.metadata.status = options.outcome;
  document.metadata.resolved_at = now.toISOString();
  document.metadata.resolution = {
    reason,
    destinations,
  };
  const archiveRoot = join(context.knowledgeRoot, "changes/archive/captures");
  const archivePath = join(archiveRoot, `${id}.md`);
  await assertAbsent(archivePath);
  await mkdir(archiveRoot, { recursive: true });
  await rename(inboxPath, archivePath);
  try {
    await writeFile(archivePath, serializeWorkSpec(document), "utf8");
  } catch (error) {
    await rename(archivePath, inboxPath);
    throw error;
  }
  return { id, outcome: options.outcome, destinations, archivePath };
}

async function resolveCaptureContext(targetInput: string): Promise<{
  knowledgeRoot: string;
  codeRoot?: string;
  source: ReturnType<typeof readRepositoryMetadata>;
}> {
  const source = readRepositoryMetadata(resolve(targetInput));
  const target = source.root;
  const config = await readConfig(target);
  const knowledgeRoot = config.profile === "knowledge"
    ? await realpath(target)
    : await realpath(resolveKnowledgeRoot(target, config));
  const knowledgeConfig = await readConfig(knowledgeRoot);
  if (knowledgeConfig.profile !== "knowledge") {
    throw new Error(`Configured knowledge path is not a knowledge repository: ${knowledgeRoot}`);
  }
  return {
    knowledgeRoot,
    ...(config.profile === "leaf" ? { codeRoot: target } : {}),
    source,
  };
}

function parsePendingCapture(content: string, path: string): {
  id: string;
  title: string;
  createdAt: string;
  legacy: boolean;
  awaits: CaptureAudience;
} {
  const document = parseWorkSpec(content);
  const legacy = document.metadata.handoff_version === 1
    && document.metadata.status === "inbox";
  const current = document.metadata.capture_version === 1
    && document.metadata.kind === "capture"
    && document.metadata.status === "pending";
  if (!legacy && !current) {
    throw new Error(`${path}: inbox file is not a pending capture`);
  }
  const id = requireText(document.metadata.id, `${path}: id`);
  if (`${id}.md` !== path.slice(path.lastIndexOf(sep) + 1)) {
    throw new Error(`${path}: capture id does not match its filename`);
  }
  return {
    id,
    title: requireText(document.metadata.title, `${path}: title`),
    createdAt: requireText(document.metadata.created_at, `${path}: created_at`),
    legacy,
    awaits: document.metadata.awaits === "maintainer" ? "maintainer" : "agent",
  };
}

async function normalizeDestinations(
  knowledgeRoot: string,
  inputs: string[],
): Promise<string[]> {
  const destinations = [...new Set(inputs.map((input) => normalizeDestination(input)))];
  for (const destination of destinations) {
    // A trajectory is an owner. Curated pages are written at the end of a
    // reconstruction, but the captures a reconstruction produces exist from its
    // first day — so requiring a curated destination deadlocked the queue
    // against itself: seventeen captures sat unresolvable, waiting for pages
    // that could not be written until the queue was resolved. A subject that
    // holds the capture's debt is a real owner whether or not its page exists.
    if (
      !destination.startsWith("knowledge/")
      && !destination.startsWith("changes/active/")
      && !destination.startsWith("trajectories/")
    ) {
      throw new Error(
        "Capture destination must be under knowledge/, trajectories/ or changes/active/: "
          + destination,
      );
    }
    if (!destination.endsWith(".md")) {
      throw new Error(`Capture destination must identify a Markdown owner: ${destination}`);
    }
    if (
      destination.startsWith("knowledge/")
      && /(?:^|\/)(?:index|log)\.md$/i.test(destination)
    ) {
      throw new Error(
        `Capture destination must be a concrete knowledge concept, not an index or log: ${destination}`,
      );
    }
    const absolute = resolve(knowledgeRoot, destination);
    const scoped = relative(knowledgeRoot, absolute);
    if (!scoped || scoped.startsWith(`..${sep}`) || scoped === ".." || isAbsolute(scoped)) {
      throw new Error(`Capture destination escapes the knowledge repository: ${destination}`);
    }
    await access(absolute, constants.R_OK);
    if (!(await stat(absolute)).isFile()) {
      throw new Error(`Capture destination must be a file: ${destination}`);
    }
  }
  return destinations.sort();
}

function normalizeDestination(input: string): string {
  if (isAbsolute(input)) {
    throw new Error(`Capture destinations must be repository-relative: ${input}`);
  }
  const normalized = posix.normalize(input.replaceAll("\\", "/").replace(/^\.\//, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Invalid capture destination: ${input}`);
  }
  return normalized;
}

function durableSource(source: ReturnType<typeof readRepositoryMetadata>) {
  return {
    repository: source.repository,
    checkout: source.checkout,
    branch: source.branch,
    commit_at_capture: source.commit,
    remote: source.remote,
    dirty: source.dirty,
    worktree: source.worktree,
    worktree_id: source.worktreeId,
  };
}

function normalizeCaptureId(value: string): string {
  const normalized = value.trim().replace(/\.md$/i, "");
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`Invalid capture id: ${value}`);
  }
  return normalized;
}

function normalizeSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("Slug must contain letters or digits");
  }
  return normalized;
}

async function uniqueFileId(roots: string[], base: string): Promise<string> {
  for (let index = 1; index <= 999; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    const states = await Promise.all(roots.map(async (root) => {
      try {
        await access(join(root, `${candidate}.md`), constants.F_OK);
        return true;
      } catch (error) {
        if (isMissingFileError(error)) {
          return false;
        }
        throw error;
      }
    }));
    if (states.every((exists) => !exists)) {
      return candidate;
    }
  }
  throw new Error(`Cannot allocate a unique capture id for ${base}`);
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await access(path, constants.F_OK);
    throw new Error(`Capture archive already exists: ${path}`);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must not be empty`);
  }
  return value.trim();
}
