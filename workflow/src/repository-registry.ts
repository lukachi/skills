import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  errorMessage,
  isMissingFileError,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { readRepositoryMetadata } from "./git.js";
import type { RepositoryMetadata } from "./types.js";
import { isRecord } from "./work-spec.js";

const DURABLE_REGISTRY_SCHEMA_VERSION = 1;
const LOCAL_REGISTRY_SCHEMA_VERSION = 2;

interface DurableRepositoryEntry {
  repository: string;
  remote: string;
  registered_at: string;
  updated_at: string;
}

interface DurableRepositoryRegistry {
  schemaVersion: 1;
  repositories: DurableRepositoryEntry[];
}

interface LocalRepositoryBinding {
  repository: string;
  root: string;
  worktree_id: string;
  connected_at: string;
}

interface LocalRepositoryRegistry {
  schemaVersion: 2;
  checkouts: LocalRepositoryBinding[];
  selections: Record<string, string>;
}

export interface RepositoryCheckout {
  root: string;
  worktreeId: string;
  connectedAt: string;
  active: boolean;
  available: boolean;
  branch?: string;
  commit?: string;
}

export interface RepositoryConnection {
  repository: string;
  remote: string;
  registeredAt: string;
  updatedAt: string;
  connected: boolean;
  activeRoot?: string;
  checkouts: RepositoryCheckout[];
}

export interface AddLeafResult {
  knowledgeRoot: string;
  repository: string;
  root: string;
  worktreeId: string;
  branch: string;
  commit: string;
  active: boolean;
}

export interface SelectLeafResult extends AddLeafResult {
  active: true;
}

export async function ensureRepositoryRegistry(
  knowledgeInput: string,
): Promise<void> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const durablePath = durableRegistryPath(knowledgeRoot);
  try {
    await readDurableRegistry(knowledgeRoot);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
    await writeJsonAtomic(durablePath, emptyDurableRegistry());
  }
}

export async function addLeafRepository(
  knowledgeInput: string,
  leafInput: string,
  now = new Date(),
): Promise<AddLeafResult> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const { leafRoot, metadata } = await inspectLeaf(knowledgeRoot, leafInput);
  const at = now.toISOString();
  const durable = await readDurableRegistryOrEmpty(knowledgeRoot);
  const existing = durable.repositories.find((entry) =>
    entry.repository === metadata.repository
  );
  if (existing) {
    existing.remote = durableRemote(metadata);
    existing.updated_at = at;
  } else {
    durable.repositories.push({
      repository: metadata.repository,
      remote: durableRemote(metadata),
      registered_at: at,
      updated_at: at,
    });
  }
  durable.repositories.sort((left, right) =>
    left.repository.localeCompare(right.repository)
  );

  const local = await readLocalRegistryOrEmpty(knowledgeRoot);
  const previousBinding = local.checkouts.find((entry) =>
    entry.repository === metadata.repository && entry.root === leafRoot
  );
  const binding: LocalRepositoryBinding = {
    repository: metadata.repository,
    root: leafRoot,
    worktree_id: metadata.worktreeId,
    connected_at: previousBinding?.connected_at ?? at,
  };
  local.checkouts = [
    ...local.checkouts.filter((entry) =>
      entry.repository !== metadata.repository || entry.root !== leafRoot
    ),
    binding,
  ].sort(compareBindings);

  await updateRegistries(knowledgeRoot, durable, local);
  return {
    knowledgeRoot,
    repository: metadata.repository,
    root: leafRoot,
    worktreeId: metadata.worktreeId,
    branch: metadata.branch,
    commit: metadata.commit,
    active: local.selections[metadata.repository] === leafRoot,
  };
}

export async function selectLeafRepository(
  knowledgeInput: string,
  leafInput: string,
  now = new Date(),
): Promise<SelectLeafResult> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const { leafRoot, metadata } = await inspectLeaf(knowledgeRoot, leafInput);
  const durable = await readDurableRegistryOrEmpty(knowledgeRoot);
  assertRegistered([metadata.repository], durable.repositories);
  const local = await readLocalRegistryOrEmpty(knowledgeRoot);
  const bindingIndex = local.checkouts.findIndex((entry) =>
    entry.repository === metadata.repository && entry.root === leafRoot
  );
  if (bindingIndex < 0) {
    throw new Error(
      `Checkout is not registered; run wfctl knowledge sources add --leaf ${leafRoot}`,
    );
  }
  local.checkouts[bindingIndex] = {
    repository: metadata.repository,
    root: leafRoot,
    worktree_id: metadata.worktreeId,
    connected_at: local.checkouts[bindingIndex]!.connected_at
      || now.toISOString(),
  };
  local.selections[metadata.repository] = leafRoot;
  await writeJsonAtomic(localRegistryPath(knowledgeRoot), local);
  return {
    knowledgeRoot,
    repository: metadata.repository,
    root: leafRoot,
    worktreeId: metadata.worktreeId,
    branch: metadata.branch,
    commit: metadata.commit,
    active: true,
  };
}

export async function listRepositoryConnections(
  knowledgeInput: string,
): Promise<RepositoryConnection[]> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const durable = await readDurableRegistryOrEmpty(knowledgeRoot);
  const local = await readLocalRegistryOrEmpty(knowledgeRoot);
  return durable.repositories.map((entry) => {
    const bindings = local.checkouts.filter((binding) =>
      binding.repository === entry.repository
    );
    const activeRoot = local.selections[entry.repository];
    const checkouts = bindings.map((binding) =>
      inspectKnownCheckout(binding, activeRoot === binding.root)
    );
    return {
      repository: entry.repository,
      remote: entry.remote,
      registeredAt: entry.registered_at,
      updatedAt: entry.updated_at,
      connected: checkouts.length > 0,
      ...(activeRoot ? { activeRoot } : {}),
      checkouts,
    };
  });
}

export async function resolveReconstructionLeaves(
  knowledgeInput: string,
  explicitLeaves: string[],
  mode: "baseline" | "audit",
): Promise<string[]> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const durable = await readDurableRegistryOrEmpty(knowledgeRoot);
  if (durable.repositories.length === 0) {
    throw new Error(
      "No leaf repositories are registered; initialize leaves or run wfctl knowledge sources add",
    );
  }
  const local = await readLocalRegistryOrEmpty(knowledgeRoot);

  if (explicitLeaves.length > 0) {
    const roots = await normalizeRoots(explicitLeaves);
    const identities = roots.map((root) => readRepositoryMetadata(root).repository);
    assertUnique(identities, "explicit reconstruction checkout");
    assertRegistered(identities, durable.repositories);
    assertKnownCheckouts(roots, identities, local.checkouts);
    if (mode === "baseline") {
      const missing = durable.repositories
        .map((entry) => entry.repository)
        .filter((repository) => !identities.includes(repository));
      if (missing.length > 0) {
        throw new Error(
          `Baseline reconstruction must include every registered repository; missing: ${missing.join(", ")}`,
        );
      }
    }
    return roots;
  }

  const selected = durable.repositories.map((entry) => ({
    repository: entry.repository,
    root: local.selections[entry.repository],
  }));
  const missing = selected
    .filter((entry) => !entry.root)
    .map((entry) => entry.repository);
  if (missing.length > 0) {
    throw new Error(
      `Registered repositories have no active reconstruction checkout: ${missing.join(", ")}. `
        + "Select one worktree per repository with wfctl knowledge sources select.",
    );
  }
  const roots = selected.map((entry) => entry.root!);
  assertKnownCheckouts(
    roots,
    selected.map((entry) => entry.repository),
    local.checkouts,
  );
  return roots;
}

export async function repositoryRegistryIssues(
  knowledgeInput: string,
): Promise<string[]> {
  const knowledgeRoot = await requireKnowledgeRepository(knowledgeInput);
  const issues: string[] = [];
  let durable: DurableRepositoryRegistry;
  let local: LocalRepositoryRegistry;
  try {
    durable = await readDurableRegistry(knowledgeRoot);
  } catch (error) {
    return [`cannot read durable repository registry: ${errorMessage(error)}`];
  }
  try {
    local = await readLocalRegistryOrEmpty(knowledgeRoot);
  } catch (error) {
    return [`cannot read local repository bindings: ${errorMessage(error)}`];
  }
  const registered = new Set(durable.repositories.map((entry) => entry.repository));
  const identities = new Set<string>();
  for (const binding of local.checkouts) {
    const identity = `${binding.repository}\0${binding.root}`;
    if (identities.has(identity)) {
      issues.push(`${binding.repository}: checkout is registered more than once: ${binding.root}`);
    }
    identities.add(identity);
    if (!registered.has(binding.repository)) {
      issues.push(`${binding.repository}: local checkout is not durably registered`);
    }
  }
  for (const [repository, root] of Object.entries(local.selections)) {
    if (!registered.has(repository)) {
      issues.push(`${repository}: active checkout belongs to an unknown repository`);
      continue;
    }
    const binding = local.checkouts.find((entry) =>
      entry.repository === repository && entry.root === root
    );
    if (!binding) {
      issues.push(`${repository}: active checkout is not in the known checkout registry`);
      continue;
    }
    try {
      const current = readRepositoryMetadata(binding.root);
      if (
        current.repository !== repository
        || current.worktreeId !== binding.worktree_id
      ) {
        issues.push(`${repository}: active checkout no longer identifies the selected worktree`);
      }
    } catch (error) {
      issues.push(`${repository}: active checkout is unavailable: ${errorMessage(error)}`);
    }
  }
  return issues;
}

function durableRegistryPath(knowledgeRoot: string): string {
  return join(knowledgeRoot, ".workflow/repositories.json");
}

function localRegistryPath(knowledgeRoot: string): string {
  return join(knowledgeRoot, ".workflow/current/repositories.json");
}

async function requireKnowledgeRepository(input: string): Promise<string> {
  const root = await realpath(resolve(input));
  const config = await readConfig(root);
  if (config.profile !== "knowledge") {
    throw new Error(`Repository registry requires a knowledge repository: ${root}`);
  }
  return root;
}

async function inspectLeaf(
  knowledgeRoot: string,
  leafInput: string,
): Promise<{ leafRoot: string; metadata: RepositoryMetadata }> {
  const leafRoot = await realpath(resolve(leafInput));
  const config = await readConfig(leafRoot);
  if (config.profile !== "leaf") {
    throw new Error(`Repository connection requires an initialized leaf: ${leafRoot}`);
  }
  const configuredKnowledge = await realpath(resolveKnowledgeRoot(leafRoot, config));
  if (configuredKnowledge !== knowledgeRoot) {
    throw new Error(
      `Leaf points to a different knowledge repository: ${leafRoot} -> ${configuredKnowledge}`,
    );
  }
  return { leafRoot, metadata: readRepositoryMetadata(leafRoot) };
}

async function readDurableRegistry(
  knowledgeRoot: string,
): Promise<DurableRepositoryRegistry> {
  const value = JSON.parse(
    await readFile(durableRegistryPath(knowledgeRoot), "utf8"),
  ) as unknown;
  if (
    !isRecord(value)
    || value.schemaVersion !== DURABLE_REGISTRY_SCHEMA_VERSION
    || !Array.isArray(value.repositories)
    || !value.repositories.every(isDurableEntry)
  ) {
    throw new Error("invalid .workflow/repositories.json");
  }
  return value as unknown as DurableRepositoryRegistry;
}

async function readDurableRegistryOrEmpty(
  knowledgeRoot: string,
): Promise<DurableRepositoryRegistry> {
  try {
    return await readDurableRegistry(knowledgeRoot);
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyDurableRegistry();
    }
    throw error;
  }
}

async function readLocalRegistryOrEmpty(
  knowledgeRoot: string,
): Promise<LocalRepositoryRegistry> {
  try {
    const value = JSON.parse(
      await readFile(localRegistryPath(knowledgeRoot), "utf8"),
    ) as unknown;
    if (isLocalRegistryV2(value)) {
      return value;
    }
    if (isLocalRegistryV1(value)) {
      const checkouts = value.bindings.map((entry) => ({
        repository: entry.repository,
        root: entry.root,
        worktree_id: entry.worktree_id,
        connected_at: entry.connected_at,
      }));
      return {
        schemaVersion: LOCAL_REGISTRY_SCHEMA_VERSION,
        checkouts,
        selections: Object.fromEntries(
          checkouts.map((entry) => [entry.repository, entry.root]),
        ),
      };
    }
    throw new Error("invalid local repository registry");
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        schemaVersion: LOCAL_REGISTRY_SCHEMA_VERSION,
        checkouts: [],
        selections: {},
      };
    }
    throw error;
  }
}

function emptyDurableRegistry(): DurableRepositoryRegistry {
  return {
    schemaVersion: DURABLE_REGISTRY_SCHEMA_VERSION,
    repositories: [],
  };
}

function isDurableEntry(value: unknown): boolean {
  return isRecord(value)
    && typeof value.repository === "string"
    && typeof value.remote === "string"
    && typeof value.registered_at === "string"
    && typeof value.updated_at === "string";
}

function isLocalBinding(value: unknown): value is LocalRepositoryBinding {
  return isRecord(value)
    && typeof value.repository === "string"
    && typeof value.root === "string"
    && typeof value.worktree_id === "string"
    && typeof value.connected_at === "string";
}

function isLocalRegistryV2(value: unknown): value is LocalRepositoryRegistry {
  return isRecord(value)
    && value.schemaVersion === LOCAL_REGISTRY_SCHEMA_VERSION
    && Array.isArray(value.checkouts)
    && value.checkouts.every(isLocalBinding)
    && isStringRecord(value.selections);
}

function isLocalRegistryV1(
  value: unknown,
): value is {
  schemaVersion: 1;
  bindings: Array<LocalRepositoryBinding & {
    branch?: string;
    commit?: string;
  }>;
} {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.bindings)
    && value.bindings.every(isLocalBinding);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && Object.values(value).every((entry) => typeof entry === "string");
}

function inspectKnownCheckout(
  binding: LocalRepositoryBinding,
  active: boolean,
): RepositoryCheckout {
  try {
    const current = readRepositoryMetadata(binding.root);
    if (
      current.repository !== binding.repository
      || current.worktreeId !== binding.worktree_id
    ) {
      return {
        root: binding.root,
        worktreeId: binding.worktree_id,
        connectedAt: binding.connected_at,
        active,
        available: false,
      };
    }
    return {
      root: binding.root,
      worktreeId: current.worktreeId,
      connectedAt: binding.connected_at,
      active,
      available: true,
      branch: current.branch,
      commit: current.commit,
    };
  } catch {
    return {
      root: binding.root,
      worktreeId: binding.worktree_id,
      connectedAt: binding.connected_at,
      active,
      available: false,
    };
  }
}

function durableRemote(metadata: RepositoryMetadata): string {
  return /^(?:https?:\/\/|ssh:\/\/|git@)/.test(metadata.remote)
    ? metadata.remote
    : "";
}

async function normalizeRoots(values: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const value of values) {
    const root = await realpath(resolve(value));
    if (!result.includes(root)) {
      result.push(root);
    }
  }
  return result;
}

function assertUnique(values: string[], label: string): void {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) {
    throw new Error(`${label} is duplicated for repository ${duplicate}`);
  }
}

function assertRegistered(
  repositories: string[],
  entries: DurableRepositoryEntry[],
): void {
  const registered = new Set(entries.map((entry) => entry.repository));
  const unknown = repositories.filter((repository) => !registered.has(repository));
  if (unknown.length > 0) {
    throw new Error(
      `Reconstruction source is not registered with this knowledge repository: ${unknown.join(", ")}`,
    );
  }
}

function assertKnownCheckouts(
  roots: string[],
  repositories: string[],
  checkouts: LocalRepositoryBinding[],
): void {
  const unknown = roots.filter((root, index) =>
    !checkouts.some((entry) =>
      entry.root === root && entry.repository === repositories[index]
    )
  );
  if (unknown.length > 0) {
    throw new Error(
      `Reconstruction checkout is not registered locally: ${unknown.join(", ")}. `
        + "Run wfctl knowledge sources add first.",
    );
  }
}

function compareBindings(
  left: LocalRepositoryBinding,
  right: LocalRepositoryBinding,
): number {
  return left.repository.localeCompare(right.repository)
    || left.root.localeCompare(right.root);
}

async function updateRegistries(
  knowledgeRoot: string,
  durable: DurableRepositoryRegistry,
  local: LocalRepositoryRegistry,
): Promise<void> {
  const durablePath = durableRegistryPath(knowledgeRoot);
  const localPath = localRegistryPath(knowledgeRoot);
  const previousDurable = await optionalText(durablePath);
  const previousLocal = await optionalText(localPath);
  try {
    await writeJsonAtomic(durablePath, durable);
    await writeJsonAtomic(localPath, local);
  } catch (error) {
    await restoreText(durablePath, previousDurable);
    await restoreText(localPath, previousLocal);
    throw new Error(`Cannot register leaf repository: ${errorMessage(error)}`);
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.wfctl-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function optionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

async function restoreText(
  path: string,
  previous: string | undefined,
): Promise<void> {
  if (previous === undefined) {
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(path);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
    return;
  }
  await writeJsonAtomic(path, JSON.parse(previous));
}
