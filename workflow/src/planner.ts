import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { stringify } from "yaml";
import {
  collectFiles,
  findDistributionRoot,
  renderAgentInstructions,
  renderMaintainerGuide,
} from "./assets.js";
import { createConfig, errorMessage, isMissingFileError, readState } from "./config.js";
import {
  GITIGNORE_MARKERS,
  type ManagedBlockMarkers,
  upsertManagedBlock,
} from "./managed-block.js";
import type {
  InstallPlan,
  PlanOperation,
  PlanOptions,
  WorkflowConfig,
  WorkflowState,
} from "./types.js";

export const RUNTIME_DIRECTORY = ".workflow/runtime";

const REQUIRED_DIRECTORIES = [
  ".claude/rules",
  ".workflow/rules",
  ".workflow/current",
  RUNTIME_DIRECTORY,
];

const KNOWLEDGE_DIRECTORIES = [
  ".qmd",
  "raw",
  "intake/cases/active",
  "intake/cases/archive",
  "reconstruction/active",
  "reconstruction/archive",
  "changes/active",
  "changes/archive",
  "changes/archive/captures",
  "changes/inbox",
];

const COMMON_SKILLS = [
  "analyze-with-graphify",
  "setup-workflow-environment",
];

const PROFILE_SKILLS: Record<PlanOptions["profile"], string[]> = {
  knowledge: [
    "align-project-knowledge",
    "curate-engineering-knowledge",
    "curate-product-knowledge",
    "curate-project-knowledge",
    "explore-project-knowledge",
    "implement-work-item",
    "manage-project-work",
    "operate-project-knowledge",
    "process-raw-intake",
    "reconstruct-project-knowledge",
    "research-project-context",
    "shape-project-direction",
    "specify-project-change",
    "split-project-change",
    "verify-knowledge-quality",
    "verify-project-work",
  ],
  leaf: [
    "align-project-knowledge",
    "curate-engineering-knowledge",
    "curate-product-knowledge",
    "curate-project-knowledge",
    "explore-project-knowledge",
    "implement-work-item",
    "manage-project-work",
    "shape-project-direction",
    "specify-project-change",
    "split-project-change",
    "verify-knowledge-quality",
    "verify-project-work",
  ],
};

export async function buildInstallPlan(options: PlanOptions): Promise<InstallPlan> {
  const target = resolve(options.target);
  const distributionRoot = options.distributionRoot ?? await findDistributionRoot();
  const state = await readState(target);
  const config = createConfig(
    options.profile,
    target,
    options.knowledge,
    options.skills,
  );
  const operations: PlanOperation[] = [];

  for (const directory of REQUIRED_DIRECTORIES) {
    operations.push(await planDirectory(target, directory));
  }
  if (options.profile === "knowledge") {
    for (const directory of KNOWLEDGE_DIRECTORIES) {
      operations.push(await planDirectory(target, directory));
    }
  }
  operations.push(
    await planOwnedFile(
      target,
      ".workflow/.gitignore",
      "backups/\ncurrent/\n",
      state,
    ),
  );
  if (options.profile === "knowledge") {
    operations.push(
      await planOwnedFile(
        target,
        ".qmd/.gitignore",
        "*\n!.gitignore\n",
        state,
      ),
    );
    operations.push(
      await planOwnedFile(
        target,
        ".qmd/index.yml",
        renderQmdConfig(target),
        state,
      ),
    );
    operations.push(await planRepositoryRegistry(target));
  }

  operations.push(await planConfig(target, config));
  if (options.profile === "leaf") {
    operations.push(await planLeafGitignore(target));
    operations.push(await planManagedBlock(
      target,
      ".graphifyignore",
      graphifyIgnoreEntries(options.profile).join("\n"),
      GITIGNORE_MARKERS,
    ));
  }

  const instructions = await renderAgentInstructions(
    distributionRoot,
    options.profile,
    config.knowledge?.path,
  );
  operations.push(await planManagedBlock(target, "AGENTS.md", instructions));
  operations.push(await planClaudeInstructions(target, instructions));

  const guide = await renderMaintainerGuide(
    distributionRoot,
    options.profile,
    config.knowledge?.path,
  );
  operations.push(await planManagedBlock(target, "PROJECT_WORKFLOW.md", guide));

  const ruleRoots = [
    join(distributionRoot, "rules/common"),
    join(distributionRoot, `rules/${options.profile}`),
  ];
  for (const ruleRoot of ruleRoots) {
    await planOwnedTree({
      sourceRoot: ruleRoot,
      destinationRoot: ".workflow/rules",
      target,
      state,
      operations,
    });
    await planOwnedTree({
      sourceRoot: ruleRoot,
      destinationRoot: ".claude/rules",
      target,
      state,
      operations,
    });
  }

  await planOwnedTree({
    sourceRoot: join(distributionRoot, "templates/runtime"),
    destinationRoot: RUNTIME_DIRECTORY,
    target,
    state,
    operations,
  });

  if (options.profile === "knowledge") {
    await planOwnedTree({
      sourceRoot: join(distributionRoot, "templates/knowledge"),
      destinationRoot: ".",
      target,
      state,
      operations,
    });
  }

  const desiredOwnedPaths = new Set(
    operations
      .filter((operation) => operation.track)
      .map((operation) => operation.path),
  );
  for (const [path, installed] of Object.entries(state?.files ?? {})) {
    if (!desiredOwnedPaths.has(path)) {
      operations.push(await planObsoleteOwnedFile(target, path, installed.sha256));
    }
  }

  return {
    target,
    profile: options.profile,
    ...(config.knowledge ? { knowledgePath: config.knowledge.path } : {}),
    operations: sortOperations(operations),
  };
}

export function summarizePlan(plan: InstallPlan): Record<string, unknown> {
  const counts = Object.fromEntries(
    ["create", "update", "delete", "unchanged", "conflict"].map((status) => [
      status,
      plan.operations.filter((operation) => operation.status === status).length,
    ]),
  );
  return {
    target: plan.target,
    profile: plan.profile,
    ...(plan.knowledgePath ? { knowledgePath: plan.knowledgePath } : {}),
    counts,
    operations: plan.operations.map(({ content: _content, expectedHash: _expected, ...operation }) =>
      operation
    ),
  };
}

export function hashContent(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function planConfig(target: string, desired: WorkflowConfig): Promise<PlanOperation> {
  const relativePath = ".workflow/config.json";
  const absolute = join(target, relativePath);
  const content = `${JSON.stringify(desired, null, 2)}\n`;
  try {
    const existing = await readFile(absolute, "utf8");
    const parsed = JSON.parse(existing) as Partial<WorkflowConfig>;
    const sameKnowledge = desired.profile !== "leaf"
      || parsed.knowledge?.path === desired.knowledge?.path;
    const sameIdentity = parsed.schemaVersion === desired.schemaVersion
      && parsed.profile === desired.profile
      && sameKnowledge;
    const sameSkills = parsed.skills?.scope === desired.skills?.scope
      && JSON.stringify(parsed.skills?.agents) === JSON.stringify(desired.skills?.agents);
    const sameVersion = parsed.installedVersion === desired.installedVersion;
    if (sameIdentity && sameSkills && sameVersion) {
      return {
        kind: "file",
        path: relativePath,
        status: "unchanged",
        reason: "existing workflow configuration is compatible",
        content: existing,
      };
    }
    if (sameIdentity && !parsed.skills) {
      return {
        kind: "file",
        path: relativePath,
        status: "update",
        reason: "record skill installation settings",
        content,
        expectedHash: hashContent(existing),
      };
    }
    if (sameIdentity && sameSkills && !sameVersion) {
      return {
        kind: "file",
        path: relativePath,
        status: "update",
        reason: `record workflow version ${desired.installedVersion}`,
        content,
        expectedHash: hashContent(existing),
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: "existing workflow configuration differs; update it explicitly",
      content,
      expectedHash: hashContent(existing),
      replaceable: true,
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      return {
        kind: "file",
        path: relativePath,
        status: "conflict",
        reason: `cannot inspect configuration: ${errorMessage(error)}`,
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "create",
      reason: "workflow configuration is absent",
      content,
    };
  }
}

async function planRepositoryRegistry(target: string): Promise<PlanOperation> {
  const relativePath = ".workflow/repositories.json";
  const absolute = join(target, relativePath);
  const empty = `${JSON.stringify({ schemaVersion: 1, repositories: [] }, null, 2)}\n`;
  try {
    const existing = await readFile(absolute, "utf8");
    const value = JSON.parse(existing) as {
      schemaVersion?: unknown;
      repositories?: unknown;
    };
    if (value.schemaVersion !== 1 || !Array.isArray(value.repositories)) {
      return {
        kind: "file",
        path: relativePath,
        status: "conflict",
        reason: "repository registry has an unsupported shape",
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "unchanged",
      reason: "dynamic repository registry is valid",
      content: existing,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "file",
        path: relativePath,
        status: "create",
        reason: "repository registry is absent",
        content: empty,
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect repository registry: ${errorMessage(error)}`,
    };
  }
}

async function planDirectory(target: string, relativePath: string): Promise<PlanOperation> {
  try {
    const stat = await lstat(join(target, relativePath));
    if (stat.isDirectory()) {
      return {
        kind: "directory",
        path: relativePath,
        status: "unchanged",
        reason: "directory exists",
      };
    }
    return {
      kind: "directory",
      path: relativePath,
      status: "conflict",
      reason: "path exists and is not a directory",
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "directory",
        path: relativePath,
        status: "create",
        reason: "directory is absent",
      };
    }
    return {
      kind: "directory",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect directory: ${errorMessage(error)}`,
    };
  }
}

async function planManagedBlock(
  target: string,
  relativePath: string,
  body: string,
  markers?: ManagedBlockMarkers,
): Promise<PlanOperation> {
  const absolute = join(target, relativePath);
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: "instruction file is a symlink not owned by this operation",
      };
    }
    if (!stat.isFile()) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: "instruction path exists and is not a regular file",
      };
    }
    const existing = await readFile(absolute, "utf8");
    const merged = upsertManagedBlock(existing, body, markers);
    if (!merged.content) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: merged.error ?? "cannot update managed block",
      };
    }
    const status = merged.content === existing ? "unchanged" : "update";
    return {
      kind: "managed-block",
      path: relativePath,
      status,
      reason: status === "unchanged" ? "managed block is current" : "managed block will be updated",
      content: merged.content,
      expectedHash: hashContent(existing),
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: `cannot inspect instruction file: ${errorMessage(error)}`,
      };
    }
    const merged = upsertManagedBlock("", body, markers);
    return {
      kind: "managed-block",
      path: relativePath,
      status: "create",
      reason: "instruction file is absent",
      content: merged.content ?? "",
    };
  }
}

async function planLeafGitignore(target: string): Promise<PlanOperation> {
  const relativePath = ".gitignore";
  const absolute = join(target, relativePath);
  try {
    const stat = await lstat(absolute);
    if (stat.isFile() && !stat.isSymbolicLink()) {
      const existing = await readFile(absolute, "utf8");
      if (
        !existing.includes(GITIGNORE_MARKERS.start)
        && ignoresGraphifyOutput(existing)
      ) {
        return {
          kind: "managed-block",
          path: relativePath,
          status: "unchanged",
          reason: "Graphify output is already ignored",
          content: existing,
          expectedHash: hashContent(existing),
        };
      }
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      return {
        kind: "managed-block",
        path: relativePath,
        status: "conflict",
        reason: `cannot inspect .gitignore: ${errorMessage(error)}`,
      };
    }
  }
  return planManagedBlock(
    target,
    relativePath,
    "graphify-out/",
    GITIGNORE_MARKERS,
  );
}

function ignoresGraphifyOutput(content: string): boolean {
  return content.split(/\r?\n/).some((line) =>
    /^(?:\/)?graphify-out\/?$/.test(line.trim())
  );
}

async function planClaudeInstructions(
  target: string,
  body: string,
): Promise<PlanOperation> {
  const path = "CLAUDE.md";
  const absolute = join(target, path);
  try {
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) {
      const current = await readlink(absolute);
      return current === "AGENTS.md"
        ? {
          kind: "symlink",
          path,
          status: "unchanged",
          reason: "CLAUDE.md already links to AGENTS.md",
          linkTarget: current,
        }
        : {
          kind: "symlink",
          path,
          status: "conflict",
          reason: `CLAUDE.md links to ${current}, not AGENTS.md`,
        };
    }
    return await planManagedBlock(target, path, body);
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "symlink",
        path,
        status: "create",
        reason: "CLAUDE.md is absent",
        linkTarget: "AGENTS.md",
      };
    }
    return {
      kind: "symlink",
      path,
      status: "conflict",
      reason: `cannot inspect CLAUDE.md: ${errorMessage(error)}`,
    };
  }
}

async function planOwnedTree(input: {
  sourceRoot: string;
  destinationRoot: string;
  target: string;
  state: WorkflowState | undefined;
  operations: PlanOperation[];
}): Promise<void> {
  for (const sourceRelative of await collectFiles(input.sourceRoot)) {
    const destination = normalizeRelative(join(input.destinationRoot, sourceRelative));
    const content = await readFile(join(input.sourceRoot, sourceRelative), "utf8");
    input.operations.push(
      await planOwnedFile(input.target, destination, content, input.state),
    );
  }
}

async function planOwnedFile(
  target: string,
  relativePath: string,
  content: string,
  state: WorkflowState | undefined,
): Promise<PlanOperation> {
  const absolute = join(target, relativePath);
  const desiredHash = hashContent(content);
  try {
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        kind: "file",
        path: relativePath,
        status: "conflict",
        reason: "owned destination exists and is not a regular file",
      };
    }
    const existing = await readFile(absolute);
    const currentHash = hashContent(existing);
    if (currentHash === desiredHash) {
      return {
        kind: "file",
        path: relativePath,
        status: "unchanged",
        reason: "owned file is current",
        content,
        expectedHash: currentHash,
        track: true,
      };
    }
    const installedHash = state?.files[relativePath]?.sha256;
    if (installedHash && installedHash === currentHash) {
      return {
        kind: "file",
        path: relativePath,
        status: "update",
        reason: "owned file matches the previous installed version",
        content,
        expectedHash: currentHash,
        track: true,
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: installedHash
        ? "owned file was locally modified"
        : "destination exists without wfctl ownership",
      content,
      expectedHash: currentHash,
      track: true,
      replaceable: true,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "file",
        path: relativePath,
        status: "create",
        reason: "owned file is absent",
        content,
        track: true,
      };
    }
    return {
      kind: "file",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect owned file: ${errorMessage(error)}`,
    };
  }
}

async function planObsoleteOwnedFile(
  target: string,
  relativePath: string,
  installedHash: string,
): Promise<PlanOperation> {
  const absolute = join(target, relativePath);
  try {
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return {
        kind: "delete",
        path: relativePath,
        status: "conflict",
        reason: "obsolete owned path is no longer a regular file",
      };
    }
    const currentHash = hashContent(await readFile(absolute));
    if (currentHash !== installedHash) {
      return {
        kind: "delete",
        path: relativePath,
        status: "conflict",
        reason: "obsolete owned file was locally modified",
        expectedHash: currentHash,
        replaceable: true,
        backup: true,
      };
    }
    return {
      kind: "delete",
      path: relativePath,
      status: "delete",
      reason: "file was owned by the previous workflow version and is no longer distributed",
      expectedHash: currentHash,
      backup: true,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        kind: "delete",
        path: relativePath,
        status: "unchanged",
        reason: "obsolete owned file is already absent",
      };
    }
    return {
      kind: "delete",
      path: relativePath,
      status: "conflict",
      reason: `cannot inspect obsolete owned file: ${errorMessage(error)}`,
    };
  }
}

/**
 * Directories wfctl created, plus the exact skills wfctl installed.
 *
 * Blanket-ignoring `.agents/` and `.claude/` also hid project-authored skills
 * and agent instructions from the source graph — in one real project, 180
 * engineering documents describing service layout and contracts, written long
 * before the workflow was installed. wfctl excludes what wfctl owns and nothing
 * else; the Git manifest still accounts for every file either way.
 */
export function graphifyIgnoreEntries(profile: PlanOptions["profile"]): string[] {
  return [
    ".workflow/",
    ".claude/rules/",
    "graphify-out/",
    "AGENTS.md",
    "CLAUDE.md",
    "PROJECT_WORKFLOW.md",
    "skills-lock.json",
    ...skillsForProfile(profile).flatMap((skill) => [
      `.agents/skills/${skill}/`,
      `.claude/skills/${skill}/`,
    ]),
  ];
}

export function skillsForProfile(profile: PlanOptions["profile"]): string[] {
  return [...workflowSkillsForProfile(profile), "qmd"].sort();
}

export function workflowSkillsForProfile(profile: PlanOptions["profile"]): string[] {
  return [...COMMON_SKILLS, ...PROFILE_SKILLS[profile]].sort();
}

export function allWorkflowSkills(): string[] {
  return [...new Set([
    ...COMMON_SKILLS,
    ...Object.values(PROFILE_SKILLS).flat(),
  ])].sort();
}

function renderQmdConfig(target: string): string {
  const collection = (
    path: string,
    pattern: string,
    includeByDefault: boolean,
    context: string,
  ) => ({
    path: join(target, path),
    pattern,
    includeByDefault,
    context: { "/": context },
  });

  return stringify({
    global_context:
      "Project knowledge retrieval. Curated knowledge is the only default truth surface. "
      + "Changes and reconstruction are qualified opt-in records. "
      + "Intake and raw are untrusted investigation inputs.",
    collections: {
      knowledge: collection(
        "knowledge",
        "**/*.md",
        true,
        "Curated OKF current project knowledge. Use this collection by default.",
      ),
      changes: collection(
        "changes",
        "**/*.md",
        false,
        "Active and archived project change records. Outcomes and reviews qualify every claim.",
      ),
      intake: collection(
        "intake",
        "**/*.md",
        false,
        "Operational raw-intake cases. Never treat these records as evidence.",
      ),
      reconstruction: collection(
        "reconstruction",
        "**/*.md",
        false,
        "Reviewed source-first project baselines and audits. Use only when tracing reconstruction evidence and adjudication.",
      ),
      raw: collection(
        "raw",
        "**/*.{md,markdown,mdown,txt,json,jsonl,yaml,yml,toml,js,mjs,cjs,ts,tsx,jsx}",
        false,
        "Continuous untrusted input used only to discover candidate claims and contradictions.",
      ),
    },
    models: {
      embed: "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",
      generate: "hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf",
      rerank: "hf:ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF/qwen3-reranker-0.6b-q8_0.gguf",
    },
  }, { lineWidth: 0 });
}

function normalizeRelative(path: string): string {
  const normalized = path.split(sep).join("/");
  return normalized === "." ? normalized : normalized.replace(/^\.\//, "");
}

function sortOperations(operations: PlanOperation[]): PlanOperation[] {
  const kindOrder: Record<PlanOperation["kind"], number> = {
    directory: 0,
    file: 1,
    "managed-block": 2,
    symlink: 3,
    delete: 4,
  };
  return operations.sort((left, right) =>
    kindOrder[left.kind] - kindOrder[right.kind] || left.path.localeCompare(right.path)
  );
}
