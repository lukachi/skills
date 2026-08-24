import { realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { assertInsideClaim, assertTraversable, type LeafState } from "./leaves.js";
import { assertWriteAllowed } from "./paths.js";
import { renderCounterLine } from "./recall.js";
import type { FlowRecord } from "./types.js";
import { GateRefusal } from "./gates.js";
import { canonical, contains } from "./paths-resolve.js";

/**
 * The write hook.
 *
 * This is the only mechanism that reaches an agent which never runs a command.
 * A CLI can only instruct at its own call sites, so an agent that skips
 * straight to editing is untouched by everything else here — the edit itself
 * has to be the call site.
 *
 * It does not fire on every edit. Firing per edit would slow the work to
 * nothing and would be ignored within the hour. It fires when the ground
 * changes: the first write of a unit, and afterwards only when a file is
 * touched that no traversal or query has covered. Editing inside known ground
 * is silent.
 */
export interface WriteHookDecision {
  /** Text injected before the write proceeds. Empty when silent. */
  message?: string;
  /** Set when the write must not happen at all. */
  refusal?: GateRefusal;
}

export interface WriteHookInput {
  flow: FlowRecord | undefined;
  knowledgeRoot: string;
  target: string;
  /** Files already written during this unit, so the first write is detectable. */
  writtenThisUnit: string[];
  guidance?: string;
  /**
   * What the registered leaves currently offer.
   *
   * Without it the refusal can only say "you have not traversed", which sends
   * the agent to a command that cannot succeed when the leaf has no graph at
   * all. The two states look identical from inside the work.
   */
  leaves?: LeafState[];
}

export function decideWrite(input: WriteHookInput): WriteHookDecision {
  const { flow, knowledgeRoot, target } = input;

  try {
    assertWriteAllowed({
      knowledgeRoot,
      target,
      ...(flow ? { bundleId: flow.members[0] ?? flow.id } : {}),
    });
  } catch (error) {
    if (error instanceof GateRefusal) return { refusal: error };
    throw error;
  }

  if (!flow) return {};

  /**
   * Before anything else about this write: is it even in the right place?
   *
   * Traversal counts and guidance are pointless if the file is in a checkout
   * this work does not own.
   */
  /**
   * A write inside the knowledge repository is recordkeeping, not source work.
   *
   * Neither the claim rule nor the traversal floor governs it: they exist to
   * stop code landing in the wrong checkout and to stop code being written
   * against structure nobody read. Applying them here refused the promotion
   * draft the tool had created one command earlier.
   */
  if (contains(knowledgeRoot, target)) return {};

  const claimed = flow.issues.find((issue) => issue.status === "claimed")?.claim;
  try {
    assertInsideClaim({
      target,
      knowledgeRoot,
      leaves: input.leaves ?? [],
      ...(claimed
        ? { claim: { repository: claimed.repository, worktreeId: claimed.worktreeId } }
        : {}),
    });
  } catch (error) {
    if (error instanceof GateRefusal) return { refusal: error };
    throw error;
  }

  const normalized = normalize(knowledgeRoot, target);
  const first = input.writtenThisUnit.length === 0;
  const covered = flow.recall.covered.some(
    (entry) => normalize(knowledgeRoot, entry) === normalized,
  );

  if (!first && covered) return {};

  /**
   * Refuse the first write of a unit while the graph has not been opened at
   * all. Not because one traversal proves understanding — it does not — but
   * because zero traversals proves the structure was never consulted, and that
   * is the state in which work gets duplicated or written against an
   * architecture nobody read.
   */
  if (first && (flow.recall.counters.graphify ?? 0) === 0) {
    /**
     * Say which of the two is true. An agent told to traverse a graph that does
     * not exist follows the remedy, fails, and has nowhere to go.
     */
    try {
      assertTraversable(input.leaves ?? [], target);
    } catch (error) {
      if (error instanceof GateRefusal) return { refusal: error };
      throw error;
    }

    return {
      refusal: new GateRefusal(
        "No structural traversal has been made for this unit.",
        "wfctl recall route graphify --covered <files>",
        `${renderCounterLine(flow.step, flow.recall)}\n\nwfctl guide structure — searching by graph before by string`,
      ),
    };
  }

  const reason = first
    ? "first write of this unit"
    : "this file is outside what any traversal or query has covered";

  return {
    message: [`[wfctl] ${reason}`, input.guidance, renderCounterLine(flow.step, flow.recall)]
      .filter((part): part is string => Boolean(part))
      .join("\n\n"),
  };
}

function normalize(root: string, path: string): string {
  const absolute = resolve(root, path);
  return relative(root, absolute) || absolute;
}


