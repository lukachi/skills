import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import type { RegisteredRepository } from "./registry.js";

/**
 * What a leaf offers the tools the agent is told to use.
 *
 * The workflow tells the agent to traverse the graph before touching code, and
 * never said where the graph comes from — or that it lives in the leaf rather
 * than in the knowledge repository. So the instruction was unfollowable in
 * exactly the case it exists for: a leaf nobody had analysed yet.
 *
 * Nothing is installed into a leaf. This only observes.
 */
export const GRAPH_PATH = "graphify-out/graph.json";

export type GraphState = "ready" | "missing" | "stale" | "unreachable";

export interface LeafState {
  repository: string;
  worktreeId: string;
  path: string;
  graph: GraphState;
  /** How old the graph is, in whole days, when there is one. */
  ageDays?: number;
}

const STALE_AFTER_DAYS = 30;

export async function inspectLeaf(
  entry: RegisteredRepository,
  now = new Date(),
): Promise<LeafState> {
  const base: LeafState = {
    repository: entry.repository,
    worktreeId: entry.worktreeId,
    path: entry.path,
    graph: "unreachable",
  };

  const reachable = await stat(entry.path).then(
    (found) => found.isDirectory(),
    () => false,
  );
  if (!reachable) return base;

  const graph = await stat(resolve(entry.path, GRAPH_PATH)).catch(() => undefined);
  if (!graph) return { ...base, graph: "missing" };

  const ageDays = Math.floor((now.getTime() - graph.mtimeMs) / 86_400_000);
  return { ...base, graph: ageDays > STALE_AFTER_DAYS ? "stale" : "ready", ageDays };
}

export async function inspectLeaves(
  entries: RegisteredRepository[],
  now = new Date(),
): Promise<LeafState[]> {
  return Promise.all(entries.map((entry) => inspectLeaf(entry, now)));
}

/**
 * How to make a leaf analysable.
 *
 * Kept in one place because it is printed from three: registering a repository,
 * listing them, and — the one that matters — the refusal an agent meets when it
 * is told to traverse a graph that does not exist.
 */
export function graphSetup(path: string): string {
  return [
    `No graph in ${path}.`,
    "",
    "Nothing is installed into a source repository, but its structure has to be",
    "readable before anything here can traverse it. In that checkout:",
    "",
    "  uv tool install graphifyy      # once per machine, if the CLI is absent",
    "  graphify build                 # in the leaf, produces graphify-out/",
    "",
    "The maintainer runs the install; the build is yours. Rebuild it when the",
    "source has moved — a stale graph answers confidently about code that is gone.",
  ].join("\n");
}

/**
 * The refusal an agent meets when a traversal is required.
 *
 * It has to distinguish two states that look identical from inside the work:
 * you have not traversed, and there is nothing to traverse. Reporting only the
 * first sends the agent to a command that cannot succeed.
 */
export function assertTraversable(leaves: LeafState[]): void {
  const blocked = leaves.filter((leaf) => leaf.graph === "missing" || leaf.graph === "unreachable");
  if (blocked.length === 0) return;

  const missing = blocked.filter((leaf) => leaf.graph === "missing");
  const gone = blocked.filter((leaf) => leaf.graph === "unreachable");

  const detail = [
    ...missing.map((leaf) => graphSetup(leaf.path)),
    ...gone.map(
      (leaf) =>
        `${leaf.repository} is registered at ${leaf.path}, which is not there. ` +
        `Re-register it, or remove it: wfctl repo remove ${leaf.repository} --worktree ${leaf.worktreeId}`,
    ),
  ].join("\n\n");

  throw new GateRefusal(
    `${blocked.length} registered repositor${blocked.length === 1 ? "y has" : "ies have"} no graph to traverse.`,
    missing[0] ? `graphify build   (in ${missing[0].path})` : "wfctl repo list",
    detail,
  );
}

export function renderLeaves(leaves: LeafState[]): string {
  if (leaves.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]",
    ].join("\n");
  }

  const rows = leaves.map((leaf) => {
    const age =
      leaf.graph === "ready" || leaf.graph === "stale" ? `${leaf.ageDays}d` : "";
    return `${leaf.graph.padEnd(11)} ${age.padEnd(5)} ${leaf.repository}  ${leaf.worktreeId.padEnd(10)}  ${leaf.path}`;
  });

  const needing = leaves.filter((leaf) => leaf.graph === "missing" || leaf.graph === "stale");
  return [
    ...rows,
    ...(needing.length > 0
      ? [
          "",
          `${needing.length} need a graph built before it can be traversed:`,
          ...needing.map((leaf) => `  graphify build   (in ${leaf.path})`),
        ]
      : []),
  ].join("\n");
}
