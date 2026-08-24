import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listFlows } from "./flow.js";
import { writeAtomic } from "./lock.js";
import type { FlowRecord } from "./types.js";

/**
 * What is in `changes/active/`, and whether anything can still reach it.
 *
 * A bundle whose flow record is gone was unreachable by every command: not
 * resumable, not closable, not promotable — and `brief` never mentioned it, so
 * the tool could not even report that work had been stranded. Four of them sat
 * in one repository for a week. This is the read that makes them visible.
 */
export const ACTIVE_DIR = "changes/active";
const SUPERSEDED = "superseded.json";

export interface Supersession {
  /** The bundle that now carries this work. */
  by: string;
  at: string;
  /** Their words agreeing to the absorption. */
  attested: string;
}

export type BundleState =
  /** A flow holds it, so the chain can reach it. */
  | { state: "held"; bundle: string; flow: string }
  /** Absorbed into another bundle, and kept where it is as the trail. */
  | { state: "superseded"; bundle: string; into: Supersession }
  /** Nothing can reach it. This is the one that needs a decision. */
  | { state: "stranded"; bundle: string };

export async function readSupersession(
  root: string,
  bundle: string,
): Promise<Supersession | undefined> {
  try {
    return JSON.parse(
      await readFile(resolve(root, ACTIVE_DIR, bundle, SUPERSEDED), "utf8"),
    ) as Supersession;
  } catch {
    return undefined;
  }
}

/**
 * Mark a bundle absorbed, in the bundle itself.
 *
 * The record stays where it is. Duplicates are the evidence of whatever
 * confusion produced them, and an agent that can make its own mess disappear
 * has a way to be wrong that nobody can audit.
 */
export async function markSuperseded(
  root: string,
  bundle: string,
  into: Supersession,
): Promise<void> {
  await writeAtomic(
    resolve(root, ACTIVE_DIR, bundle, SUPERSEDED),
    `${JSON.stringify(into, null, 2)}\n`,
  );
}

export async function listBundles(root: string): Promise<BundleState[]> {
  let names: string[];
  try {
    names = (await readdir(resolve(root, ACTIVE_DIR), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }

  const flows = (await listFlows(root)).filter((flow) => !flow.closedAt);
  const held = new Map<string, FlowRecord>();
  for (const flow of flows) {
    for (const member of flow.members) held.set(member, flow);
  }

  const states: BundleState[] = [];
  for (const bundle of names) {
    /**
     * Supersession is read first, because an absorbed bundle is also a member
     * of the flow that absorbed it. Both are true and only one is useful: the
     * canonical record reads as held, and every record folded into it says so
     * and names the survivor.
     */
    const into = await readSupersession(root, bundle);
    if (into) {
      states.push({ state: "superseded", bundle, into });
      continue;
    }
    const holder = held.get(bundle);
    states.push(
      holder ? { state: "held", bundle, flow: holder.id } : { state: "stranded", bundle },
    );
  }
  return states;
}

export function renderStranded(states: BundleState[]): string | undefined {
  const stranded = states.filter((entry) => entry.state === "stranded");
  if (stranded.length === 0) return undefined;

  return [
    `${stranded.length} bundle(s) in ${ACTIVE_DIR} have no flow, so nothing can reach them:`,
    ...stranded.map((entry) => `  ${entry.bundle}`),
    "",
    "Resuming one is the maintainer's decision, not a tidy-up. Put it to them in",
    "your own words — what the work was, where it stopped — and record their",
    "answer:",
    "",
    '  wfctl work adopt <bundle> --weight <significant|lightweight> \\',
    '    --attested "<what they said>"',
  ].join("\n");
}

export function renderBundles(states: BundleState[]): string {
  if (states.length === 0) return `No bundles in ${ACTIVE_DIR}.`;

  const lines = states.map((entry) => {
    if (entry.state === "held") return `  held        ${entry.bundle}  (flow ${entry.flow})`;
    if (entry.state === "superseded") return `  superseded  ${entry.bundle}  -> ${entry.into.by}`;
    return `  stranded    ${entry.bundle}`;
  });
  const stranded = renderStranded(states);
  return [`${states.length} bundle(s):`, ...lines, ...(stranded ? ["", stranded] : [])].join("\n");
}

export async function bundleExists(root: string, bundle: string): Promise<boolean> {
  try {
    await readdir(resolve(root, ACTIVE_DIR, bundle));
    return true;
  } catch {
    return false;
  }
}

/** Every name under `changes/active`, for a refusal that can suggest one. */
export async function bundleNames(root: string): Promise<string[]> {
  return (await listBundles(root)).map((entry) => entry.bundle);
}

export { join as joinBundlePath };
export async function writeBundleFile(
  root: string,
  bundle: string,
  name: string,
  body: string,
): Promise<void> {
  await writeFile(resolve(root, ACTIVE_DIR, bundle, name), body, "utf8");
}
