export const WORKFLOW_VERSION = "0.1.0";
export const CONFIG_SCHEMA_VERSION = 1;
export const STATE_SCHEMA_VERSION = 1;

export type Profile = "knowledge" | "leaf";
export type WorkMode = "full" | "slice" | "handoff";
export type WorkOutcome = "completed" | "partial" | "abandoned";

export interface WorkflowConfig {
  schemaVersion: 1;
  profile: Profile;
  installedVersion: string;
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

export type OperationKind = "directory" | "file" | "managed-block" | "symlink";
export type OperationStatus = "create" | "update" | "unchanged" | "conflict";

export interface PlanOperation {
  kind: OperationKind;
  path: string;
  status: OperationStatus;
  reason: string;
  content?: string;
  linkTarget?: string;
  expectedHash?: string;
  track?: boolean;
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
  checkout: string;
  branch: string;
  commit: string;
  remote: string;
  worktree: boolean;
}

export interface WorkSpecDocument {
  metadata: Record<string, unknown>;
  body: string;
}
