export const WORKFLOW_VERSION = "0.3.0";
export const CONFIG_SCHEMA_VERSION = 1;
export const STATE_SCHEMA_VERSION = 1;

export type Profile = "knowledge" | "leaf";
export type WorkMode = "full" | "slice";
export type WorkOutcome = "completed" | "partial" | "abandoned";
export type SkillScope = "project" | "user" | "none";
export type AgentTarget = "codex" | "claude";

export interface WorkflowConfig {
  schemaVersion: 1;
  profile: Profile;
  installedVersion: string;
  skills?: {
    scope: SkillScope;
    agents: AgentTarget[];
  };
  knowledge?: {
    path: string;
  };
}

export interface WorkflowState {
  schemaVersion: 1;
  installedVersion: string;
  profile: Profile;
  files: Record<string, { sha256: string }>;
}

export type OperationKind = "directory" | "file" | "managed-block" | "symlink" | "delete";
export type OperationStatus = "create" | "update" | "delete" | "unchanged" | "conflict";

export interface PlanOperation {
  kind: OperationKind;
  path: string;
  status: OperationStatus;
  reason: string;
  content?: string;
  linkTarget?: string;
  expectedHash?: string;
  track?: boolean;
  replaceable?: boolean;
  backup?: boolean;
}

export interface InstallPlan {
  target: string;
  profile: Profile;
  knowledgePath?: string;
  operations: PlanOperation[];
}

export interface PlanOptions {
  target: string;
  profile: Profile;
  knowledge?: string;
  distributionRoot?: string;
  skills?: {
    scope: SkillScope;
    agents: AgentTarget[];
  };
}

export interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface DoctorReport {
  target: string;
  profile?: Profile;
  checks: DoctorCheck[];
}

export interface RepositoryMetadata {
  repository: string;
  root: string;
  checkout: string;
  branch: string;
  commit: string;
  remote: string;
  dirty: boolean;
  worktree: boolean;
  worktreeId: string;
}

export interface WorkSpecDocument {
  metadata: Record<string, unknown>;
  body: string;
}
