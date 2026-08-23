import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { withLock, writeAtomic } from "./lock.js";

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
  /** Stable within its line, so a later event can name this one. */
  id: string;
  /** What happened, in product language. */
  summary: string;
  axis: Axis;
  /** The claims that support it. */
  claims: string[];
  at?: string;
  /** A closed change writes this, so the line does not go stale when work lands. */
  change?: string;
  /**
   * The earlier event this one settles.
   *
   * A delivery names the intent it delivers. Nothing infers the link: matching
   * summaries meant echoing the intent sentence closed the gap while a genuine
   * delivery worded differently never did, and matching by order meant any
   * delivery closed every intent before it, including unrelated ones.
   */
  settles?: string;
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
  await withLock(path, () => writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: new Date().toISOString() }, null, 2)}\n`));
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

/**
 * A stable id for a subject.
 *
 * Stripping everything outside `[a-z0-9]` mapped every subject with no ASCII
 * letters to the empty string, so they all merged into one hidden file and one
 * shared history; truncating at 60 characters collided too, attributing one
 * subject's delivery to another. A short digest of the original text keeps the
 * slug readable and the identity distinct.
 */
export function subjectId(subject: string): string {
  const normalized = subject.trim().toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 8);
  return slug ? `${slug}-${digest}` : digest;
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
  event: Omit<TrajectoryEvent, "id"> & { id?: string },
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
  return withLock(trajectoryPath(root, id), async () => appendLocked(root, id, subject, event));
}

async function appendLocked(
  root: string,
  id: string,
  subject: string,
  event: Omit<TrajectoryEvent, "id"> & { id?: string },
): Promise<Trajectory> {
  const existing = await readTrajectory(root, id);
  const trajectory: Trajectory = existing ?? {
    id,
    subject: subject.trim(),
    events: [],
    updatedAt: new Date().toISOString(),
  };

  if (event.settles && !trajectory.events.some((entry) => entry.id === event.settles)) {
    throw new GateRefusal(
      `${trajectory.subject} has no event ${event.settles}.`,
      `wfctl trajectory show "${trajectory.subject}"`,
      "A delivery settles an intent that was recorded; naming one that was not " +
        "closes nothing and hides that it closed nothing.",
    );
  }

  trajectory.events = [
    ...trajectory.events,
    {
      ...event,
      id: event.id || `E${String(trajectory.events.length + 1).padStart(3, "0")}`,
      at: event.at ?? new Date().toISOString(),
    },
  ];
  const path = trajectoryPath(root, trajectory.id);
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: new Date().toISOString() }, null, 2)}\n`);
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

/**
 * What is recorded and not delivered — by chronology, not by wording.
 *
 * Subtracting matching summaries was wrong in both directions: echoing the
 * intent sentence verbatim cleared the debt, while a genuine delivery worded
 * any other way never did. The comment above says a debt is not closed by
 * anybody saying so, and saying so was exactly what closed it.
 *
 * What actually settles it is order. An intent is outstanding until a delivery
 * event is recorded after it — because a delivery is an observation of the
 * source at a revision, not a claim about the intent.
 */
/**
 * What is recorded and not yet settled.
 *
 * Still derived and still never stored — but from an explicit link rather than
 * from wording or order. An intent or a vision is outstanding until a delivery
 * event names it, and only the agent reading the source can say that a
 * particular observation settles a particular intention.
 */
export function deriveGap(trajectory: Trajectory): Gap {
  const settled = new Set(
    trajectory.events
      .filter((event) => event.axis === "delivery" && event.settles)
      .map((event) => event.settles as string),
  );

  const outstanding = (axis: Axis): string[] =>
    trajectory.events
      .filter((event) => event.axis === axis && !settled.has(event.id))
      .map((event) => event.summary);

  return {
    subject: trajectory.subject,
    delivery: outstanding("intent"),
    direction: outstanding("vision"),
  };
}

export function renderTrajectory(trajectory: Trajectory): string {
  const lines = [`${trajectory.subject}  (${trajectory.id})`, ""];
  const settled = new Set(
    trajectory.events.filter((event) => event.settles).map((event) => event.settles as string),
  );
  for (const event of trajectory.events) {
    const when = event.at ? `${event.at.slice(0, 10)}  ` : "";
    const from = event.change ? `  ← ${event.change}` : "";
    const mark = settled.has(event.id) ? " ✓" : "";
    const closes = event.settles ? `  settles ${event.settles}` : "";
    lines.push(`  ${event.id}  ${event.axis.padEnd(8)} ${when}${event.summary}${from}${closes}${mark}`);
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
