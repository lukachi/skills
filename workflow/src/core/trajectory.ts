import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * Trajectories.
 *
 * Raw material is chaotic on purpose: old decisions beside new ones, ideas that
 * went nowhere beside ideas that shipped, and the story of the development
 * mixed through all of it. Straightening that is the work, and a trajectory is
 * what straightening produces — one product subject as a line, from how it was
 * conceived, through what changed and why, to what the source shows now.
 *
 * It does two things nothing else does. It is the only layer the maintainer is
 * shown, because they decide about subjects rather than about findings. And
 * nothing may route into curated knowledge before one exists: a claim about
 * current truth made while reading is made before the material that contradicts
 * it has been read.
 */
export const TRAJECTORY_DIR = "trajectories";

/**
 * A statement lifted out of a source, separated from its neighbours.
 *
 * Atomising survives from the old intake model because statements cannot be
 * ordered into a line until they have been separated from each other. The
 * routing lanes do not survive: the trajectory is what decides where anything
 * goes, and deciding it twice was how a claim reached curated knowledge before
 * the line it belonged to existed.
 */
export interface Claim {
  id: string;
  /** The statement itself, as the source made it. */
  text: string;
  /** Where it came from: a path, a blob, a revision, a person. */
  source: string;
  /** When the source said it, where that is knowable. */
  at?: string;
}

export const AXES = ["intent", "delivery", "vision"] as const;
export type Axis = (typeof AXES)[number];

export interface TrajectoryEvent {
  /** What happened, in product language. */
  summary: string;
  axis: Axis;
  /** The claims that support it. */
  claims: string[];
  at?: string;
  /** A closed change writes this, so the line does not go stale when work lands. */
  change?: string;
}

export interface Trajectory {
  id: string;
  /** The product subject, named the way the project names it. */
  subject: string;
  /**
   * Events in order. `intent` is what the project stated, recovered.
   * `delivery` is what the source gives now. `vision` is what the subject
   * should become, and only the maintainer declares one.
   */
  events: TrajectoryEvent[];
  /** The revision `delivery` was observed at. */
  observedAt?: string;
  updatedAt: string;
}

export function trajectoryPath(root: string, id: string): string {
  return resolve(root, TRAJECTORY_DIR, `${id}.json`);
}

export async function readTrajectory(root: string, id: string): Promise<Trajectory | undefined> {
  try {
    return JSON.parse(await readFile(trajectoryPath(root, id), "utf8")) as Trajectory;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeTrajectory(root: string, trajectory: Trajectory): Promise<void> {
  const path = trajectoryPath(root, trajectory.id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ ...trajectory, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

export async function listTrajectories(root: string): Promise<Trajectory[]> {
  let entries: string[];
  try {
    entries = await readdir(resolve(root, TRAJECTORY_DIR));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const found: Trajectory[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const trajectory = await readTrajectory(root, entry.slice(0, -".json".length));
    if (trajectory) found.push(trajectory);
  }
  return found.sort((left, right) => left.subject.localeCompare(right.subject));
}

export function subjectId(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Append an event to a subject's line, creating the line if it is new.
 *
 * Both cases write here. Reconstruction builds lines from what it read; a
 * closed change appends what it delivered. Without the second, the line is
 * built only by reconstruction and goes stale the moment work lands — and the
 * next reconstruction rediscovers what the change already knew.
 */
export async function appendEvent(
  root: string,
  subject: string,
  event: TrajectoryEvent,
): Promise<Trajectory> {
  if (!subject.trim()) {
    throw new GateRefusal(
      "An event needs the subject whose line it belongs to.",
      'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>"',
    );
  }
  if (!event.summary.trim()) {
    throw new GateRefusal(
      "An event needs its summary, in product language.",
      'wfctl trajectory append --subject "<...>" --summary "<what happened>"',
    );
  }

  const id = subjectId(subject);
  const existing = await readTrajectory(root, id);
  const trajectory: Trajectory = existing ?? {
    id,
    subject: subject.trim(),
    events: [],
    updatedAt: new Date().toISOString(),
  };

  trajectory.events = [...trajectory.events, event];
  await writeTrajectory(root, trajectory);
  return trajectory;
}

/**
 * The gap is derived, never stored.
 *
 * A stored gap is a subtraction that was true once. Worse, a gap accepted as
 * correct is not a gap at all — it is a vision that was wrong, and storing it
 * hides which of the two happened.
 */
export interface Gap {
  subject: string;
  /** Intent recorded but not delivered. */
  delivery: string[];
  /** Declared direction the delivery does not reach. */
  direction: string[];
}

export function deriveGap(trajectory: Trajectory): Gap {
  const summaries = (axis: Axis) =>
    trajectory.events.filter((event) => event.axis === axis).map((event) => event.summary);

  const delivered = new Set(summaries("delivery"));
  return {
    subject: trajectory.subject,
    delivery: summaries("intent").filter((summary) => !delivered.has(summary)),
    direction: summaries("vision").filter((summary) => !delivered.has(summary)),
  };
}

export function renderTrajectory(trajectory: Trajectory): string {
  const lines = [`${trajectory.subject}  (${trajectory.id})`, ""];
  for (const event of trajectory.events) {
    const when = event.at ? `${event.at}  ` : "";
    const from = event.change ? `  ← ${event.change}` : "";
    lines.push(`  ${event.axis.padEnd(8)} ${when}${event.summary}${from}`);
  }
  const gap = deriveGap(trajectory);
  if (gap.delivery.length > 0) {
    lines.push("", "  not delivered:");
    for (const item of gap.delivery) lines.push(`    ${item}`);
  }
  if (gap.direction.length > 0) {
    lines.push("", "  direction not reached:");
    for (const item of gap.direction) lines.push(`    ${item}`);
  }
  return lines.join("\n");
}
