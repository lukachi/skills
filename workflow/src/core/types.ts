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

/**
 * One arbitrary thing the agent wrote down.
 *
 * The checkpoint's four named fields are the index a next session reads. This
 * is everything else — the detail too small to be the summary and too costly to
 * lose. It exists because the checkpoint replaced itself: the only durable
 * surface in the tool held one paragraph, and the second write of a session
 * erased the first.
 *
 * Nothing validates what goes in beyond it not being empty. A tool the agent
 * has to compose for is a tool it uses less, and the whole point is that
 * writing costs almost nothing.
 */
export interface Note {
  at: string;
  actor: string;
  text: string;
  /** The unit or artifact it is about, when it is about one. */
  about?: string;
}

/**
 * Something noticed during the work, that belongs to the work.
 *
 * A finding had exactly one destination — `capture`, which by design leaves the
 * fence and waits for the maintainer. So a thing the agent noticed and could
 * simply fix had to become somebody else's decision, and came back, if ever, as
 * a separate bundle nobody asked for.
 *
 * Two properties were collapsed into one: whether it is inside this bundle's
 * scope, and who decides. A capture answers "outside, theirs". This answers
 * "inside, mine" — and it stays with the work that found it.
 */
export interface Finding {
  id: string;
  at: string;
  actor: string;
  /** What was found. */
  what: string;
  status: "open" | "resolved" | "released";
  /** What was done about it. Required to resolve. */
  resolution?: string;
  resolvedAt?: string;
  /** The unit it came out of, when it came out of one. */
  about?: string;
  /** Files that carry its evidence. */
  artifacts?: string[];
}

/**
 * A file this work produced that the record can name.
 *
 * Bundles have always had an `artifacts/` directory and the tool has never
 * known what was in it. Reviews, harvests, measurements and briefings were
 * written there and then found again by remembering, so a fresh session met a
 * directory of files with no statement of which mattered or which had been
 * replaced.
 *
 * Superseding is recorded rather than implied. The alternative — a reader
 * deciding from a sentence somebody remembered to update — is what makes a
 * directory of documents unreadable.
 */
export interface Artifact {
  /** Repository-relative, as the tool prints it. */
  path: string;
  /** What it is, in the agent's own words. */
  what: string;
  at: string;
  actor: string;
  /** The artifact that replaced this one. */
  supersededBy?: string;
}

/**
 * One place work was gathered from.
 *
 * Adoption is not a migration for older records. It is bundle creation with the
 * details taken from wherever the work actually lives — a stranded bundle, two
 * records that are the same work said differently, an issue, a branch, a
 * conversation with nothing written down. The demands and the gates are the
 * flow's own; only the sourcing differs.
 */
export interface AdoptedSource {
  /** Where it was found: a bundle id, a path, a URL. */
  from: string;
  /** Set when the source was a bundle absorbed into this flow. */
  bundle?: string;
  /** Their words agreeing to this absorption, per source and never in batch. */
  attested: string;
  at: string;
}

export interface FlowRecord {
  schemaVersion: number;
  id: string;
  kind: FlowKind;
  title: string;
  weight?: WorkWeight;
  step: WorkStep;
  /** When the flow last changed step, so a stale checkpoint is detectable. */
  steppedAt?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Bundles gathered under this flow, canonical first.
   *
   * The fence was always documented as spanning several bundles and nothing
   * could ever put a second one in it — so `members` was `[flow.id]` forever,
   * and a bundle without a flow record was unreachable by every command. The
   * first entry carries the work; anything after it was absorbed into that one
   * and is marked superseded where it sits.
   */
  members: string[];
  /**
   * The maintainer's own words agreeing this work exists.
   *
   * `work start` was the only decision of theirs that was asked for in prose
   * and recorded nowhere, so nothing could tell a bundle they agreed to from
   * one an agent opened because it noticed something — which is how a
   * repository collects records nobody asked for. It also gives the
   * capture-or-bundle question an answer that is not a judgment call: if you
   * cannot quote them, it is a capture.
   */
  attested: { words: string; at: string };
  /** Where each member came from, when the work was assembled rather than begun. */
  sources?: AdoptedSource[];
  repositories: RepositoryBinding[];
  issues: IssueRecord[];
  checkpoint?: Checkpoint;
  /**
   * Everything written down that is not one of the checkpoint's four fields.
   *
   * Append-only. The checkpoint is the index; this is the record behind it, and
   * it is the difference between a session that recalls and one that is told a
   * paragraph.
   */
  notes?: Note[];
  /** Things noticed that belong to this work rather than to the inbox. */
  findings?: Finding[];
  /** Files this work produced, and which of them the record still stands on. */
  artifacts?: Artifact[];
  recall: RecallState;
  /**
   * Set when the maintainer approved the framing but said not to start yet.
   * `attested` holds their words: a park silences the turn guard, so an agent
   * may not place one on its own judgment.
   */
  parked?: { at: string; reason: string; attested?: string };
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
    /** Survivors as accepted, so the reason a weak test was allowed stays on the record. */
    stubSurvivors: unknown[];
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
