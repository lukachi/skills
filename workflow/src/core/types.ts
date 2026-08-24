/**
 * Core types for the rewritten workflow.
 *
 * One rule governs every shape here: nothing the agent must remember is stored
 * as prose, and nothing the tool can derive is stored at all. A blocker is not
 * a field because it is a position in a step sequence; a gap is not a field
 * because it is a subtraction. Storing either lets it drift from the state it
 * claims to describe.
 */

export const FLOW_SCHEMA_VERSION = 1;

/**
 * The two cases. There is no third, and no classifier that picks between them:
 * the maintainer starts one explicitly. A router that guessed was the single
 * largest source of the agent entering the wrong machine.
 */
export const FLOW_KINDS = ["work", "reconstruction"] as const;
export type FlowKind = (typeof FLOW_KINDS)[number];

/**
 * Weight is recorded, never inferred. The old workflow asked the agent to judge
 * whether work was significant, which it did silently and usually generously.
 * The CLI now names what the distinction means and refuses until it has an
 * answer that came from the maintainer.
 */
export const WORK_WEIGHTS = ["significant", "lightweight"] as const;
export type WorkWeight = (typeof WORK_WEIGHTS)[number];

/**
 * Steps of the `work` machine, in the order they unlock. The order is a
 * precondition chain, not a schedule: `split` may be skipped for lightweight
 * work, and issues inside `implement` are worked in whatever order the agent
 * finds efficient.
 */
export const WORK_STEPS = [
  "opened",
  "aligned",
  "framed",
  "split",
  "implement",
  "verified",
  "closed",
  "promoted",
] as const;
export type WorkStep = (typeof WORK_STEPS)[number];

export interface RepositoryBinding {
  /** Portable identity, e.g. `owner/name`. */
  repository: string;
  /** The registered checkout name. */
  checkout: string;
  /**
   * Worktree identity. Deliberately no branch and no commit: every recorded
   * binding deadlock in the previous implementation came from pinning a
   * revision that then moved under the record. A claim is about which files
   * are being edited, not about which revision existed when it started.
   */
  worktreeId: string;
}

export interface IssueRecord {
  id: string;
  title: string;
  status: "open" | "claimed" | "done" | "dropped";
  /**
   * The agent's own working notes. Free text on purpose: this is the field that
   * replaces a scheduler. Blocking edges and frontier computation were removed
   * because a resolved map can be worked efficiently in an order no dependency
   * graph would predict.
   */
  notes: string[];
  acceptance: string[];
  claim?: RepositoryBinding;
}

export interface Checkpoint {
  /**
   * The index rendering. One or two sentences: what this flow is and where it
   * stopped. The brief prints this for every flow it lists.
   */
  summary: string;
  /**
   * The full body — everything a fresh session needs to carry on without the
   * conversation that produced it. The brief prints this in full for the bound
   * flow, which is why it may be long.
   */
  handoff: string;
  lastAction: string;
  nextAction: string;
  actor: string;
  updatedAt: string;
  /** Small jobs noticed in passing. Neither a blocker nor the next action. */
  todo: string[];
}

export interface FlowRecord {
  schemaVersion: number;
  id: string;
  kind: FlowKind;
  title: string;
  weight?: WorkWeight;
  step: WorkStep;
  createdAt: string;
  updatedAt: string;
  /** Bundles or cases gathered under this flow. */
  members: string[];
  repositories: RepositoryBinding[];
  issues: IssueRecord[];
  checkpoint?: Checkpoint;
  recall: RecallState;
  /** Set when the maintainer approved the framing but said not to start yet. */
  parked?: { at: string; reason: string };
  closedAt?: string;
  /**
   * How it closed. Nothing stored it, so promotion recorded abandoned work as a
   * `delivery` on the subject's line — the one layer the maintainer is shown.
   */
  outcome?: "completed" | "partial" | "abandoned";
  /** Digest of the acceptance criteria as approved, so a rewording is visible. */
  framingDigest?: string;
  /**
   * The accepted review. Its presence is what `verified` and `closed` check —
   * validating a review and discarding it left both steps with no precondition.
   */
  review?: {
    reviewer: string;
    at: string;
    attacks: unknown[];
    findings: unknown[];
    stubSurvivors: string[];
    fixedPoint: string;
    /** Where the artifact came from, so a replay across flows is visible. */
    source: string;
  };
}

/* ------------------------------------------------------------------ recall */

export const RECALL_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type RecallGroup = (typeof RECALL_GROUPS)[number];

export interface RecallItem {
  id: string;
  group: RecallGroup;
  question: string;
}

/**
 * An answered item. The answer alone is not enough — an agent will answer any
 * question. What makes the record worth having is `route` and `source`: how the
 * answer was found, and what it was found in. An answer with no route is a
 * guess with a sentence around it.
 */
export interface RecallAnswer {
  item: string;
  answer: string;
  route: RecallRoute;
  source: string;
  at: string;
}

export const RECALL_ROUTES = ["qmd", "graphify", "grep", "read", "maintainer"] as const;
export type RecallRoute = (typeof RECALL_ROUTES)[number];

export type RecallCounters = Record<RecallRoute, number>;

export interface RecallState {
  answers: RecallAnswer[];
  counters: RecallCounters;
  /** Files a traversal or query has already covered, for the write hook. */
  covered: string[];
  /**
   * Files written since the current unit was claimed.
   *
   * The write hook needs this to go quiet on known ground. It was passed as a
   * flag nothing ever supplied, so every edit looked like the first one and
   * re-emitted the whole implement page.
   */
  written: string[];
}
