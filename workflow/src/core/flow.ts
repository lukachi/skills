import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { withLock } from "./lock.js";
import { emptyRecall } from "./recall.js";
import type { FlowKind, FlowRecord, WorkWeight } from "./types.js";
import { FLOW_SCHEMA_VERSION } from "./types.js";

const FLOW_DIR = ".workflow/flows";
const CURRENT_POINTER = ".workflow/flows/current";

/**
 * A flow is a fence, not an identity.
 *
 * It does not name a bundle, a case, or a task. It names the workload the
 * maintainer and the agent settled on, whatever that turned out to contain —
 * several change bundles, one bundle, or one reconstruction. Its only power is
 * exclusion: while it is open, work outside it is out of scope, which is what
 * stops an agent opening its fourth bundle of the afternoon because it noticed
 * something.
 *
 * It clears on completion. Nothing carries over except what was written down.
 */
export function flowDirectory(root: string): string {
  return resolve(root, FLOW_DIR);
}

export function flowPath(root: string, id: string): string {
  return join(flowDirectory(root), `${id}.json`);
}

export function createFlowId(kind: FlowKind, title: string, now: Date): string {
  const date = now.toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${date}-${kind}-${slug || "untitled"}`;
}

export async function readFlow(root: string, id: string): Promise<FlowRecord | undefined> {
  try {
    const raw = await readFile(flowPath(root, id), "utf8");
    return JSON.parse(raw) as FlowRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeFlow(root: string, flow: FlowRecord): Promise<void> {
  await mkdir(flowDirectory(root), { recursive: true });
  const path = flowPath(root, flow.id);
  await withLock(path, async () => {
    const next = { ...flow, updatedAt: new Date().toISOString() };
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  });
}

/**
 * Read, change, write — with nobody else in between.
 *
 * The plain read-then-write pair is what lost units: two sessions each read the
 * same record, each added one, and the second overwrote the first. Anything
 * that derives its new value from the old one must go through this.
 */
export async function mutateFlow(
  root: string,
  id: string,
  change: (flow: FlowRecord) => FlowRecord,
): Promise<FlowRecord> {
  const path = flowPath(root, id);
  return withLock(path, async () => {
    const current = await readFlow(root, id);
    if (!current) {
      throw new GateRefusal(`No flow named ${id}.`, "wfctl brief");
    }
    const next = { ...change(current), updatedAt: new Date().toISOString() };
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  });
}

export async function currentFlowId(root: string): Promise<string | undefined> {
  try {
    const raw = await readFile(resolve(root, CURRENT_POINTER), "utf8");
    const id = raw.trim();
    return id.length > 0 ? id : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function currentFlow(root: string): Promise<FlowRecord | undefined> {
  const id = await currentFlowId(root);
  return id ? readFlow(root, id) : undefined;
}

async function setCurrent(root: string, id: string | undefined): Promise<void> {
  await mkdir(flowDirectory(root), { recursive: true });
  const path = resolve(root, CURRENT_POINTER);
  if (id === undefined) {
    await rm(path, { force: true });
    return;
  }
  await writeFile(path, `${id}\n`, "utf8");
}

export interface OpenFlowOptions {
  kind: FlowKind;
  title: string;
  weight?: WorkWeight;
  now?: Date;
}

export class FlowOpenError extends Error {
  constructor(
    message: string,
    /** The command that clears this refusal. Never omitted — a refusal that does
     * not name its own remedy costs a turn and teaches nothing. */
    readonly remedy: string,
  ) {
    super(message);
    this.name = "FlowOpenError";
  }
}

/**
 * Opening a flow refuses while another is open.
 *
 * This is the mechanism behind "findings do not become bundles". An agent that
 * notices a bug mid-implementation has exactly one place to put it, because the
 * command that would open a second workload will not run.
 */
export async function openFlow(root: string, options: OpenFlowOptions): Promise<FlowRecord> {
  /**
   * The fence reads the records, not the pointer.
   *
   * Consulting only `.workflow/flows/current` meant deleting that one file
   * opened a second flow while the first was still open — and the brief then
   * listed both, so the tool could see the state it had just refused to act on.
   */
  const open = (await listFlows(root)).find((flow) => !flow.closedAt);
  if (open) {
    throw new FlowOpenError(
      `Flow ${open.id} is open; work outside it is out of scope. ` +
        `A finding found while working belongs in the capture inbox.`,
      `wfctl capture "<what you found>"   (or: wfctl flow close ${open.id})`,
    );
  }

  const now = options.now ?? new Date();
  let id = createFlowId(options.kind, options.title, now);

  /**
   * An id that already exists gets a suffix rather than overwriting.
   *
   * Two same-day titles that slug identically — including any two titles with
   * no ASCII letters at all — used to collide, and the second flow silently
   * adopted the first's units, checkpoint and bundle.
   */
  for (let suffix = 2; await readFlow(root, id); suffix += 1) {
    id = `${createFlowId(options.kind, options.title, now)}-${suffix}`;
  }
  const flow: FlowRecord = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id,
    kind: options.kind,
    title: options.title,
    step: "opened",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    members: [],
    repositories: [],
    issues: [],
    recall: emptyRecall(),
    ...(options.weight ? { weight: options.weight } : {}),
  };

  await writeFlow(root, flow);
  await setCurrent(root, id);
  return flow;
}

/**
 * Closing flushes the checkpoint and clears the pointer.
 *
 * The checkpoint is deliberately not preserved into the next flow. Its whole
 * content is "where this workload stopped", and carrying that into unrelated
 * work is how a stale next-action outlives the thing it described.
 */
export async function closeFlow(root: string, id: string): Promise<FlowRecord> {
  const flow = await readFlow(root, id);
  if (!flow) {
    throw new FlowOpenError(`No flow named ${id}.`, "wfctl brief");
  }
  const closed: FlowRecord = { ...flow, closedAt: new Date().toISOString() };
  delete closed.checkpoint;
  await writeFlow(root, closed);

  const current = await currentFlowId(root);
  if (current === id) await setCurrent(root, undefined);
  return closed;
}

/** Drop the pointer without touching the record. */
export async function clearCurrent(root: string): Promise<void> {
  await setCurrent(root, undefined);
}

export async function listFlows(root: string): Promise<FlowRecord[]> {
  let entries: string[];
  try {
    entries = await readdir(flowDirectory(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const flows: FlowRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const flow = await readFlow(root, entry.slice(0, -".json".length));
    if (flow) flows.push(flow);
  }
  return flows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
