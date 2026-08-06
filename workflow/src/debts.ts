import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isMissingFileError } from "./config.js";
import {
  compileTrajectories,
  type GapKind,
  type GapStatus,
  type TrajectoryGraph,
  type TrajectoryRecord,
} from "./trajectory.js";
import { parseWorkSpec, serializeWorkSpec } from "./work-spec.js";

/**
 * The debt ledger, and the one road from a debt to work.
 *
 * A trajectory records what a subject still owes against its declared vision.
 * The schema had a place for the work that closes a debt from the beginning —
 * `status: to-close` paired with a `work` string — and nothing ever wrote to it,
 * because no command existed that could. So a reconstruction ended with every
 * debt correctly recorded and no way to ask what the project owed in total, and
 * the maintainer had to be handed a list of trajectory filenames and told to
 * read the `gaps` block of each.
 *
 * Two things fix that, and neither invents a new record.
 *
 * `collectDebts` reads the debts that already exist and says which are owned,
 * which are scheduled, and whether the work naming them is still open. It is a
 * view, never a store: nothing here decides what is owed.
 *
 * `scheduleDebt` writes the link the schema always had room for, and refuses to
 * write it against a change bundle that does not exist — a debt pointing at
 * nothing is worse than an unowned debt, because it reads as handled.
 *
 * There is deliberately no `closeDebt`. A gap is derived from what the subject
 * intends against what the source shows; it stops existing when the source
 * changes, not when someone marks it done. Landing work therefore ends with the
 * subject re-read at a new pin, and the debt disappears because it is no longer
 * true. A command that struck debts off a list would let a subject claim
 * delivery no one read.
 */

export type WorkState = "unscheduled" | "active" | "archived" | "missing";

export interface Debt {
  trajectory: string;
  subject: string;
  area: string;
  /** 1-based position in the subject's own gap list, for addressing. */
  position: number;
  kind: GapKind;
  statement: string;
  status: GapStatus;
  /** The change bundle that closes it, once scheduled. */
  work: string | null;
  workState: WorkState;
  /** Whether the subject has a direction to owe anything against. */
  vision: string | null;
  /** The root subject this rolls up to, which is where direction is set. */
  root: string;
}

export interface DebtLedger {
  debts: Debt[];
  /** Debts whose work has landed: the subject needs re-reading at a new pin. */
  settled: Debt[];
  /** Debts on subjects with no declared vision — owed against nothing. */
  directionless: Debt[];
  /** Scheduled debts naming a bundle that exists nowhere. */
  dangling: Debt[];
}

export async function collectDebts(targetInput: string): Promise<DebtLedger> {
  const target = resolve(targetInput);
  const compilation = await compileTrajectories(target);
  const active = await bundleIds(join(target, "changes/active"));
  const archived = await bundleIds(join(target, "changes/archive"));

  const debts: Debt[] = [];
  for (const record of compilation.graph.trajectories) {
    const root = rootOf(record, compilation.graph);
    record.gaps.forEach((gap, index) => {
      debts.push({
        trajectory: record.id,
        subject: record.subject,
        area: record.area,
        position: index + 1,
        kind: gap.kind,
        statement: gap.statement,
        status: gap.status,
        work: gap.work,
        workState: workState(gap.work, active, archived),
        vision: record.vision,
        root,
      });
    });
  }

  // Worst first, and "worst" is the product's order rather than the corpus's:
  // an open debt on a subject with a direction is work someone can start today.
  const rank: Record<GapStatus, number> = { open: 0, "to-close": 1, deferred: 2 };
  debts.sort((left, right) =>
    rank[left.status] - rank[right.status]
    || left.root.localeCompare(right.root)
    || left.trajectory.localeCompare(right.trajectory)
    || left.position - right.position
  );

  return {
    debts,
    settled: debts.filter((debt) => debt.workState === "archived"),
    directionless: debts.filter((debt) => !debt.vision),
    dangling: debts.filter((debt) => debt.workState === "missing"),
  };
}

export interface ScheduleDebtOptions {
  target: string;
  trajectory: string;
  /** A 1-based position, or a substring that matches exactly one statement. */
  gap: string;
  work: string;
}

export interface ScheduleDebtResult {
  trajectory: string;
  path: string;
  statement: string;
  work: string;
  previousStatus: GapStatus;
}

export async function scheduleDebt(
  options: ScheduleDebtOptions,
): Promise<ScheduleDebtResult> {
  const target = resolve(options.target);
  const compilation = await compileTrajectories(target);
  if (compilation.errors.length > 0) {
    throw new Error(
      `Cannot schedule while ${compilation.errors.length} trajectory error(s) remain; `
        + "run wfctl knowledge trajectory check",
    );
  }
  const record = compilation.graph.trajectories.find((entry) =>
    entry.id === options.trajectory
  );
  if (!record) {
    throw new Error(`No trajectory named ${options.trajectory}`);
  }
  const work = options.work.trim().replace(/^changes\/active\//, "").replace(/\/$/, "");
  const active = await bundleIds(join(target, "changes/active"));
  if (!active.has(work)) {
    const archived = await bundleIds(join(target, "changes/archive"));
    throw new Error(
      archived.has(work)
        ? `${work} is already archived; a debt cannot be scheduled against finished work`
        : `No open change bundle named ${work}. Open one with wfctl work start, then `
          + "schedule the debt against it.",
    );
  }
  const index = resolveGapIndex(record, options.gap);
  const gap = record.gaps[index]!;
  if (gap.status === "to-close" && gap.work && gap.work !== work) {
    throw new Error(
      `That debt is already being closed by ${gap.work}. Two bundles closing one debt `
        + "means neither owns it; retire one before scheduling the other.",
    );
  }

  // `record.path` is repo-relative, because that is what a reader of an error
  // message needs; a writer needs the absolute one.
  const absolute = join(target, record.path);
  const document = parseWorkSpec(await readFile(absolute, "utf8"));
  const gaps = document.metadata.gaps;
  if (!Array.isArray(gaps) || !isRecord(gaps[index])) {
    throw new Error(`${record.path}: gaps no longer match the compiled record; re-run check`);
  }
  const previousStatus = gap.status;
  gaps[index] = { ...gaps[index], status: "to-close", work };
  await writeFile(absolute, serializeWorkSpec(document), "utf8");

  return {
    trajectory: record.id,
    path: record.path,
    statement: gap.statement,
    work,
    previousStatus,
  };
}

/**
 * A position is unambiguous and unreadable; a phrase is readable and can match
 * twice. Both are accepted, and an ambiguous phrase is an error rather than a
 * guess — scheduling the wrong debt puts a subject's name on work that does not
 * close it, and nothing downstream would catch that.
 */
function resolveGapIndex(record: TrajectoryRecord, selector: string): number {
  const trimmed = selector.trim();
  if (/^\d+$/.test(trimmed)) {
    const position = Number(trimmed);
    if (position < 1 || position > record.gaps.length) {
      throw new Error(
        `${record.subject} has ${record.gaps.length} debt(s); there is no debt ${position}`,
      );
    }
    return position - 1;
  }
  const needle = trimmed.toLowerCase();
  const matches = record.gaps
    .map((gap, index) => ({ gap, index }))
    .filter((entry) => entry.gap.statement.toLowerCase().includes(needle));
  if (matches.length === 0) {
    throw new Error(`No debt of ${record.subject} says anything matching "${trimmed}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `"${trimmed}" matches ${matches.length} debts of ${record.subject}; `
        + "name it by position instead",
    );
  }
  return matches[0]!.index;
}

function workState(
  work: string | null,
  active: Set<string>,
  archived: Set<string>,
): WorkState {
  if (!work) {
    return "unscheduled";
  }
  const id = work.replace(/^changes\/active\//, "").replace(/\/$/, "");
  if (active.has(id)) {
    return "active";
  }
  return archived.has(id) ? "archived" : "missing";
}

function rootOf(record: TrajectoryRecord, graph: TrajectoryGraph): string {
  const seen = new Set<string>();
  let current = record.id;
  while (!seen.has(current)) {
    seen.add(current);
    const parent = graph.edges.find((edge) =>
      edge.kind === "part-of" && edge.primary && edge.source === current
    );
    if (!parent) {
      return current;
    }
    current = parent.target;
  }
  return current;
}

async function bundleIds(root: string): Promise<Set<string>> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return new Set(
      entries.filter((entry) => entry.isDirectory() && entry.name !== "captures")
        .map((entry) => entry.name),
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Set();
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
