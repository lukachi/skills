import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Profile, WorkflowConfig, WorkflowState } from "./types.js";
import { CONFIG_SCHEMA_VERSION, STATE_SCHEMA_VERSION, WORKFLOW_VERSION } from "./types.js";

export function createConfig(profile: Profile, target: string, knowledge?: string): WorkflowConfig {
  const config: WorkflowConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    profile,
    installedVersion: WORKFLOW_VERSION,
  };

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
  const raw = JSON.parse(await readFile(path, "utf8")) as Partial<WorkflowConfig>;
  if (raw.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new Error(`Unsupported workflow config schema in ${path}`);
  }
  if (raw.profile !== "knowledge" && raw.profile !== "leaf") {
    throw new Error(`Invalid workflow profile in ${path}`);
  }
  if (raw.profile === "leaf" && !raw.knowledge?.path) {
    throw new Error(`Leaf workflow config has no knowledge path in ${path}`);
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
