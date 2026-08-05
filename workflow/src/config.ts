import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type {
  AgentTarget,
  Profile,
  SkillScope,
  WorkflowConfig,
  WorkflowState,
} from "./types.js";
import { CONFIG_SCHEMA_VERSION, STATE_SCHEMA_VERSION, WORKFLOW_VERSION } from "./types.js";

export interface SkillInstallConfig {
  scope: SkillScope;
  agents: AgentTarget[];
}

export function createConfig(
  profile: Profile,
  target: string,
  knowledge?: string,
  skills: SkillInstallConfig = { scope: "project", agents: ["codex", "claude"] },
  maintainer?: string,
): WorkflowConfig {
  const config: WorkflowConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    profile,
    installedVersion: WORKFLOW_VERSION,
    skills,
  };

  if (maintainer) {
    const identity = maintainer.trim();
    if (!identity.startsWith("human:") || identity.length <= "human:".length) {
      throw new Error("Maintainer identity must be human:<id>");
    }
    config.maintainer = identity;
  }

  if (profile === "leaf") {
    if (!knowledge) {
      throw new Error("Leaf profile requires --knowledge <path>");
    }
    config.knowledge = { path: portableRelative(target, knowledge) };
  }

  return config;
}

export async function readConfig(target: string): Promise<WorkflowConfig> {
  const path = resolve(target, ".workflow/config.json");
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      // Reached by running a command from a case, packet, or knowledge
      // subdirectory, which reads as a broken installation unless the message
      // says which directory was searched and what to do instead.
      throw new Error(
        `No workflow installation in ${resolve(target)}: ${path} does not exist. `
          + "Run from the repository root, or pass --target with it.",
      );
    }
    throw error;
  }
  const raw = JSON.parse(content) as Partial<WorkflowConfig>;
  if (raw.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new Error(`Unsupported workflow config schema in ${path}`);
  }
  if (raw.profile !== "knowledge" && raw.profile !== "leaf") {
    throw new Error(`Invalid workflow profile in ${path}`);
  }
  if (raw.profile === "leaf" && !raw.knowledge?.path) {
    throw new Error(`Leaf workflow config has no knowledge path in ${path}`);
  }
  if (raw.skills) {
    if (
      !["project", "user", "none"].includes(raw.skills.scope)
      || !Array.isArray(raw.skills.agents)
      || raw.skills.agents.some((agent) => agent !== "codex" && agent !== "claude")
    ) {
      throw new Error(`Invalid skill installation settings in ${path}`);
    }
  } else {
    raw.skills = { scope: "project", agents: ["codex", "claude"] };
  }
  if (raw.maintainer !== undefined) {
    if (
      typeof raw.maintainer !== "string"
      || !raw.maintainer.startsWith("human:")
      || raw.maintainer.trim().length <= "human:".length
    ) {
      throw new Error(`Invalid maintainer identity in ${path}: expected human:<id>`);
    }
  }
  return raw as WorkflowConfig;
}

export async function readState(target: string): Promise<WorkflowState | undefined> {
  try {
    const raw = JSON.parse(
      await readFile(resolve(target, ".workflow/state.json"), "utf8"),
    ) as Partial<WorkflowState>;
    if (raw.schemaVersion !== STATE_SCHEMA_VERSION || !raw.files || !raw.profile) {
      throw new Error("invalid state shape");
    }
    return raw as WorkflowState;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new Error(`Cannot read .workflow/state.json: ${errorMessage(error)}`);
  }
}

export function resolveKnowledgeRoot(target: string, config: WorkflowConfig): string {
  if (config.profile === "knowledge") {
    return resolve(target);
  }
  const configured = config.knowledge?.path;
  if (!configured) {
    throw new Error("Leaf workflow config has no knowledge path");
  }
  return isAbsolute(configured) ? configured : resolve(target, configured);
}

export function portableRelative(from: string, to: string): string {
  const value = relative(resolve(from), resolve(to)).split(sep).join("/");
  if (value === "") {
    return ".";
  }
  return value.startsWith(".") ? value : `./${value}`;
}

export function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
