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
  /** A proposed order, never a truth. See `weigh`. */
  weight: number;
  /** Subjects that declare they do not work without this one. */
  dependents: number;
  /** Why it weighs that, in words, for a packet that must not print numbers. */
  weightBecause: string[];
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
  // Closed counts as closed wherever the bundle sits. A bundle waiting to be
  // promoted has shipped and archived its issues; reading only the archive
  // reported every debt it settled as naming a bundle that exists nowhere.
  const archived = new Set([
    ...await bundleIds(join(target, "changes/archive")),
    ...await bundleIds(join(target, "changes/promotion")),
  ]);

  const debts: Debt[] = [];
  for (const record of compilation.graph.trajectories) {
    const root = rootOf(record, compilation.graph);
    const dependents = compilation.graph.edges.filter((edge) =>
      edge.kind === "depends-on" && edge.target === record.id
    ).length;
    const rootWeight = compilation.graph.trajectories
      .find((entry) => entry.id === root)?.gapWeight ?? record.gapWeight;
    record.gaps.forEach((gap, index) => {
      const weighed = weigh(gap.kind, dependents, rootWeight);
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
        weight: weighed.weight,
        weightBecause: weighed.because,
        dependents,
      });
    });
  }

  // Heaviest first inside each status, because the previous order — status,
  // then root name, then filename — was alphabetical, and an alphabetical debt
  // ledger asks the maintainer to rank forty-eight things with no signal at all.
  const rank: Record<GapStatus, number> = { open: 0, "to-close": 1, deferred: 2 };
  debts.sort((left, right) =>
    rank[left.status] - rank[right.status]
    || right.weight - left.weight
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

/**
 * What the project owes, composed for the person who decides the order.
 *
 * The signal says forty-eight. A number is not a decision, and forty-eight
 * questions is the overload this whole pipeline exists to remove — so the packet
 * groups by the subject the maintainer already set a direction for, puts the
 * heaviest first, and says why each group weighs what it does in words.
 *
 * Rendered from the record, so it carries no trajectory id, no gap position and
 * no schema token. Those are the agent's bookkeeping, and the last time they
 * reached a maintainer the review turned into paperwork.
 */
export function renderDebtPacket(ledger: DebtLedger): string {
  const open = ledger.debts.filter((debt) => debt.status === "open");
  if (open.length === 0) {
    return "Nothing is owed that nobody has taken.\n";
  }
  const groups = new Map<string, Debt[]>();
  for (const debt of open) {
    const key = debt.subject;
    groups.set(key, [...(groups.get(key) ?? []), debt]);
  }
  const ordered = [...groups.entries()].sort((left, right) =>
    Math.max(...right[1].map((debt) => debt.weight))
      - Math.max(...left[1].map((debt) => debt.weight))
    || left[0].localeCompare(right[0])
  );

  const lines: string[] = [];
  lines.push("# What the project owes", "");
  lines.push(
    `${open.length} thing(s) the reconstruction found undone, across ${ordered.length} subject(s).`,
    "Ordered by how much else stops working without each subject and how much its own",
    "line owes. That is a proposal from what the graph knows, not a judgement about the",
    "product. Yours replaces it.",
    "",
  );
  for (const [subject, debts] of ordered) {
    lines.push(`## ${subject}`, "");
    // Only what distinguishes this group. The reasons behind the weight are the
    // same three phrases for most subjects, so printing them per group read as
    // four identical paragraphs and taught the reader to skip them.
    const dependents = Math.max(...debts.map((debt) => debt.dependents));
    const notes: string[] = [];
    if (dependents > 0) {
      notes.push(
        dependents === 1
          ? "One other subject does not work without this one."
          : `${dependents} other subjects do not work without this one.`,
      );
    }
    if (!debts[0]!.vision) {
      notes.push("No direction is declared here, so what these are owed against is unstated.");
    }
    if (debts.every((debt) => debt.kind === "hole")) {
      notes.push("Nothing was established here; these are questions rather than jobs.");
    }
    if (notes.length > 0) {
      lines.push(notes.join(" "), "");
    }
    for (const debt of debts) {
      lines.push(`- ${debt.statement}`);
    }
    lines.push("");
  }
  const deferred = ledger.debts.filter((debt) => debt.status === "deferred");
  const scheduled = ledger.debts.filter((debt) => debt.status === "to-close");
  if (scheduled.length > 0 || deferred.length > 0) {
    lines.push("## Already settled", "");
    if (scheduled.length > 0) {
      lines.push(`${scheduled.length} being closed by work already open.`);
    }
    if (deferred.length > 0) {
      lines.push(`${deferred.length} deliberately not now.`);
    }
    lines.push("");
  }
  lines.push(
    "For each group: is it next, is it deliberately not now, or is it something else",
    "you would rather see first. Nothing here is scheduled without your answer.",
    "",
  );
  return lines.join("\n");
}

export interface DeferDebtOptions {
  target: string;
  trajectory: string;
  gap: string;
  by: string;
  reason: string;
  attested?: string;
}

/**
 * A debt the maintainer looked at and decided against, for now.
 *
 * `deferred` existed in the schema and nothing could write it, so a debt they
 * had considered and set aside was indistinguishable from one nobody had opened.
 * The reason is required for the same purpose the park's is: a debt held for no
 * stated reason reads as neglect, and the next session reopens the decision.
 */
export async function deferDebt(options: DeferDebtOptions): Promise<ScheduleDebtResult> {
  const target = resolve(options.target);
  const by = options.by.trim();
  if (!by.startsWith("human:") || by.length <= "human:".length) {
    throw new Error("Deferring a debt is the maintainer's decision; pass --by human:<id>");
  }
  const reason = options.reason.trim();
  if (!reason) {
    throw new Error(
      "Deferring requires a reason. A debt set aside without one cannot be told from a "
        + "debt nobody read, and the next session reopens the question.",
    );
  }
  const compilation = await compileTrajectories(target);
  const record = compilation.graph.trajectories.find((entry) =>
    entry.id === options.trajectory
  );
  if (!record) {
    throw new Error(`No trajectory named ${options.trajectory}`);
  }
  const index = resolveGapIndex(record, options.gap);
  const gap = record.gaps[index]!;
  if (gap.status === "to-close") {
    throw new Error(
      `That debt is already being closed by ${gap.work}; retire the work before deferring it`,
    );
  }
  const absolute = join(target, record.path);
  const document = parseWorkSpec(await readFile(absolute, "utf8"));
  const gaps = document.metadata.gaps;
  if (!Array.isArray(gaps) || !isRecord(gaps[index])) {
    throw new Error(`${record.path}: gaps no longer match the compiled record; re-run check`);
  }
  // `work` stays empty: the schema pairs it with to-close alone, and a deferred
  // debt is owned by nobody by definition.
  gaps[index] = { ...gaps[index], status: "deferred", work: "", deferred: { by, reason, attested: (options.attested ?? "").trim() } };
  await writeFile(absolute, serializeWorkSpec(document), "utf8");
  return {
    trajectory: record.id,
    path: record.path,
    statement: gap.statement,
    work: "",
    previousStatus: gap.status,
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
    const archived = new Set([
      ...await bundleIds(join(target, "changes/archive")),
      ...await bundleIds(join(target, "changes/promotion")),
    ]);
    throw new Error(
      archived.has(work)
        ? `${work} is already closed; a debt cannot be scheduled against finished work`
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

/**
 * A proposed order for debts, and nothing stronger than that.
 *
 * Three things are known about a debt without inventing anything, and each is a
 * fact already in the graph rather than a judgement about the product:
 *
 * How many subjects declare they do not work without this one. A debt on a
 * subject others depend on holds up more than its own line.
 *
 * How much the whole line it belongs to owes. A subject inside a root that owes
 * a great deal is where the reconstruction found the most missing.
 *
 * What kind of debt it is. A hole is not work — it is something nobody
 * established — so it cannot be scheduled and sorts below anything that can. A
 * delivery debt is intent already accepted and not delivered, which is the
 * cheapest kind to justify starting.
 *
 * The maintainer's order overrides this completely and is never derived from it.
 * The point is only that they should not be handed an alphabetical list.
 */
function weigh(
  kind: GapKind,
  dependents: number,
  rootWeight: number,
): { weight: number; because: string[] } {
  const because: string[] = [];
  let weight = 0;
  if (kind === "hole") {
    // Deliberately below everything schedulable, including its own root's pull.
    return {
      weight: -1,
      because: ["nothing was established here, so this is a question rather than a job"],
    };
  }
  if (dependents > 0) {
    weight += dependents * 10;
    because.push(
      dependents === 1
        ? "another subject does not work without this one"
        : `${dependents} subjects do not work without this one`,
    );
  }
  if (kind === "delivery-debt") {
    weight += 3;
    because.push("this was accepted and never delivered, so nothing needs deciding to start it");
  }
  weight += Math.min(rootWeight, 20);
  if (rootWeight >= 5) {
    because.push("it sits in the line that owes the most");
  }
  return { weight, because };
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
