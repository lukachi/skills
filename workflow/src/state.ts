import { resolve } from "node:path";
import { errorMessage, readConfig, resolveKnowledgeRoot } from "./config.js";
import { STATE_COLLECTORS } from "./state-collectors.js";
import type { Profile, WorkflowConfig } from "./types.js";
import { WORKFLOW_VERSION } from "./types.js";

export const STATE_REPORT_VERSION = 1;

export const STATE_LEVELS = ["ok", "info", "attention", "blocked"] as const;
export type StateLevel = (typeof STATE_LEVELS)[number];

export const STATE_DOMAINS = [
  "install",
  "sources",
  "corpus",
  "reconstruction",
  "intake",
  "raw",
  "work",
  "inbox",
] as const;
export type StateDomain = (typeof STATE_DOMAINS)[number];

export type StateAudience = "agent" | "maintainer";

/**
 * One observed fact about the repository. A signal never advises, ranks itself
 * against other signals, or describes a scenario; it reports what is true and
 * which capabilities that truth prevents.
 */
export interface StateSignal {
  id: string;
  domain: StateDomain;
  level: StateLevel;
  summary: string;
  subject?: string;
  facts?: Record<string, string | number | boolean>;
  since?: string;
  /**
   * Who owes an action, when someone does. It is not "who this concerns": a
   * signal that describes a finished state names nobody, because everything
   * downstream — the maintainer's queue, the stop guard — reads this as work
   * outstanding and acts on it.
   *
   * `agent` additionally asserts that the action exists and would clear the
   * signal. The stop guard re-enters a turn while any of these are present and
   * the repository keeps moving, so one that cannot be satisfied pushes every
   * session to keep acting in a repository that is actually waiting on the
   * maintainer — the runaway this guard was built to avoid, reached from the
   * other side. Before emitting one, name the command that clears it.
   */
  awaits?: StateAudience;
  blocks?: string[];
}

export interface StateContext {
  root: string;
  profile: Profile;
  config: WorkflowConfig;
  knowledgeRoot: string;
  now: Date;
}

export interface StateCollector {
  id: string;
  profiles: readonly Profile[];
  collect(context: StateContext): Promise<StateSignal[]>;
}

export interface CapabilityDefinition {
  id: string;
  label: string;
  profiles: readonly Profile[];
  /** Signal ids that must be present for the operation to have a subject. */
  requires?: readonly string[];
}

export interface CapabilityState {
  id: string;
  label: string;
  available: boolean;
  blockedBy: string[];
  missing: string[];
}

export interface DegradedCollector {
  collector: string;
  reason: string;
}

export interface StateReport {
  reportVersion: number;
  root: string;
  profile?: Profile;
  workflowVersion: string;
  generatedAt: string;
  signals: StateSignal[];
  capabilities: CapabilityState[];
  degraded: DegradedCollector[];
}

/**
 * Deliberate operations whose preconditions are mechanical. Availability is
 * derived from the signals that declare `blocks` and from the signals a
 * capability declares it `requires`, never from a scenario branch written here.
 */
export const CAPABILITIES: readonly CapabilityDefinition[] = [
  {
    id: "reconstruct-baseline",
    label: "Build a knowledge baseline from source repositories",
    profiles: ["knowledge"],
  },
  {
    id: "reconstruct-audit",
    label: "Audit the existing baseline against current source",
    profiles: ["knowledge"],
    requires: ["corpus.populated"],
  },
  {
    id: "process-raw-intake",
    label: "Process untrusted raw material into candidates",
    profiles: ["knowledge"],
  },
  {
    id: "start-change",
    label: "Start a central change bundle",
    profiles: ["knowledge", "leaf"],
  },
  {
    id: "implement-work",
    label: "Implement an issue from an open bundle in this checkout",
    profiles: ["leaf"],
    requires: ["work.active"],
  },
  {
    id: "close-work",
    label: "Close an open change bundle",
    profiles: ["knowledge", "leaf"],
    requires: ["work.active"],
  },
];

export interface CollectStateOptions {
  collectors?: readonly StateCollector[];
  capabilities?: readonly CapabilityDefinition[];
  now?: Date;
}

/**
 * Run every collector that applies to the installed profile and return their
 * combined output. A failing collector degrades its own domain and never fails
 * the report: this runs at session start, where a thrown error costs the
 * maintainer their first turn.
 */
export async function collectWorkflowState(
  targetInput: string,
  options: CollectStateOptions = {},
): Promise<StateReport> {
  const root = resolve(targetInput);
  const now = options.now ?? new Date();
  const capabilities = options.capabilities ?? CAPABILITIES;
  const base = {
    reportVersion: STATE_REPORT_VERSION,
    root,
    workflowVersion: WORKFLOW_VERSION,
    generatedAt: now.toISOString(),
  };

  let config: WorkflowConfig;
  try {
    config = await readConfig(root);
  } catch (error) {
    return {
      ...base,
      signals: [{
        id: "install.absent",
        domain: "install",
        level: "blocked",
        summary: "No workflow installation was found in this directory",
        facts: { reason: errorMessage(error) },
        awaits: "maintainer",
        blocks: capabilities.map((capability) => capability.id),
      }],
      capabilities: [],
      degraded: [],
    };
  }

  const context: StateContext = {
    root,
    profile: config.profile,
    config,
    knowledgeRoot: resolveKnowledgeRoot(root, config),
    now,
  };

  const collectors = (options.collectors ?? STATE_COLLECTORS)
    .filter((collector) => collector.profiles.includes(config.profile));
  const signals: StateSignal[] = [];
  const degraded: DegradedCollector[] = [];
  const results = await Promise.all(collectors.map(async (collector) => {
    try {
      return { collector, signals: await collector.collect(context) };
    } catch (error) {
      return { collector, reason: errorMessage(error) };
    }
  }));
  for (const result of results) {
    if ("signals" in result) {
      signals.push(...result.signals);
    } else {
      degraded.push({ collector: result.collector.id, reason: result.reason });
    }
  }

  return {
    ...base,
    profile: config.profile,
    signals: sortSignals(signals),
    capabilities: resolveCapabilities(capabilities, signals, config.profile),
    degraded: degraded.sort((left, right) => left.collector.localeCompare(right.collector)),
  };
}

export function resolveCapabilities(
  definitions: readonly CapabilityDefinition[],
  signals: readonly StateSignal[],
  profile: Profile,
): CapabilityState[] {
  const present = new Set(signals.map((signal) => signal.id));
  return definitions
    .filter((definition) => definition.profiles.includes(profile))
    .map((definition) => {
      const blockedBy = [
        ...new Set(
          signals
            .filter((signal) => signal.blocks?.includes(definition.id))
            .map((signal) => signal.id),
        ),
      ].sort();
      const missing = (definition.requires ?? [])
        .filter((required) => !present.has(required))
        .sort();
      return {
        id: definition.id,
        label: definition.label,
        available: blockedBy.length === 0 && missing.length === 0,
        blockedBy,
        missing,
      };
    });
}

export function sortSignals(signals: readonly StateSignal[]): StateSignal[] {
  return [...signals].sort((left, right) =>
    STATE_LEVELS.indexOf(right.level) - STATE_LEVELS.indexOf(left.level)
    || STATE_DOMAINS.indexOf(left.domain) - STATE_DOMAINS.indexOf(right.domain)
    || left.id.localeCompare(right.id)
    || (left.subject ?? "").localeCompare(right.subject ?? "")
  );
}

