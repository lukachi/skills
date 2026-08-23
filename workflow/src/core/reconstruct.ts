import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import type { RegisteredRepository } from "./registry.js";
import type { Claim } from "./trajectory.js";

/**
 * The reconstruction case.
 *
 * It is not "tell me what this project is" — that is read-only and answered
 * from curated knowledge. This is the expensive write that builds that
 * knowledge when none exists, or repairs it when it has drifted.
 *
 * There is no mode to choose. Whether this is a first baseline or a re-check of
 * an existing one follows from whether curated knowledge exists, which the tool
 * can see for itself. A ten-year-old codebase with an empty corpus is a first
 * baseline.
 */
export const RECONSTRUCTION_DIR = "reconstruction/active";
export const RECONSTRUCTION_ARCHIVE = "reconstruction/archive";
export const RAW_DIR = "reconstruction/raw";

/**
 * Stages, in order. The maintainer appears at three of them and never during
 * the long part: interrupting a crawl with adjudication questions is what made
 * the previous flow unusable at length, so contradictions found while reading
 * are recorded and batched to `adjudicate`.
 */
export const STAGES = [
  "scope",
  "crawl",
  "assemble",
  "adjudicate",
  "write",
  "probe",
  "promote",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_PRESENCE: Record<Stage, "maintainer" | "nobody"> = {
  scope: "maintainer",
  crawl: "nobody",
  assemble: "nobody",
  adjudicate: "maintainer",
  write: "nobody",
  probe: "nobody",
  promote: "maintainer",
};

export interface PinnedRepository extends RegisteredRepository {
  /** The revision this was read at. Recorded so a later re-read can compare. */
  revision: string;
  /**
   * Whether the tree had uncommitted changes.
   *
   * Recorded rather than refused. A claim read against uncommitted work is not
   * wrong, only less reproducible, and that belongs on the page rather than in
   * a refusal that stops the work.
   */
  dirty: boolean;
}

export type RawScope = "all" | "selected" | "none";

export interface Coverage {
  /** Everything in scope, by path. */
  inScope: string[];
  /** What has been read. */
  read: string[];
  /** What was deliberately excluded, and why. */
  excluded: { path: string; reason: string }[];
}

export interface Contradiction {
  id: string;
  subject: string;
  /** The disagreeing statements, as their sources made them. */
  sides: string[];
  /** Set at `adjudicate`, never during the crawl. */
  resolution?: string;
}

/**
 * A question answerable only from what was written.
 *
 * This is the check that survives. The line-range reading receipts were the
 * agent grading itself — it asserted that a file was inspected and nothing
 * observed it — so every figure derived from them inherited the overstatement.
 * A probe tests the output instead, which is the only thing that catches
 * skimming, and it is asked by a different agent for the same reason a review
 * is.
 */
export interface Probe {
  question: string;
  /** The pages that must be able to answer it. */
  pages: string[];
  asker: string;
  answer?: string;
  passed?: boolean;
}

export interface ReconstructionCase {
  id: string;
  stage: Stage;
  createdAt: string;
  repositories: PinnedRepository[];
  rawScope?: RawScope;
  rawPaths: string[];
  coverage: Coverage;
  claims: Claim[];
  contradictions: Contradiction[];
  trajectories: string[];
  probes: Probe[];
  /** True when the corpus already held pages when this started. */
  hadBaseline: boolean;
}

export function casePath(root: string, id: string): string {
  return resolve(root, RECONSTRUCTION_DIR, id, "case.json");
}

export async function readCase(root: string, id: string): Promise<ReconstructionCase | undefined> {
  try {
    return JSON.parse(await readFile(casePath(root, id), "utf8")) as ReconstructionCase;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeCase(root: string, record: ReconstructionCase): Promise<void> {
  const path = casePath(root, record.id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

/**
 * Whether curated knowledge already holds pages, which is what decides the
 * shape of this pass.
 *
 * The root index is excluded because installation writes one; an Area index is
 * not, because writing one is the project saying something about itself. An
 * earlier version excluded every file named `index.md` and reported a populated
 * corpus as empty — Area pages are called `index.md` too.
 */
export async function hasBaseline(root: string): Promise<boolean> {
  const knowledge = resolve(root, "knowledge");
  try {
    const entries = await readdir(knowledge, { recursive: true, withFileTypes: true });
    return entries.some((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) return false;
      const parent = entry.parentPath ?? knowledge;
      return !(parent === knowledge && entry.name === "index.md");
    });
  } catch {
    return false;
  }
}

export async function rawInventory(root: string): Promise<string[]> {
  const raw = resolve(root, RAW_DIR);
  try {
    const entries = await readdir(raw, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath ?? raw, entry.name).slice(raw.length + 1))
      .sort();
  } catch {
    return [];
  }
}

export function nextStage(stage: Stage): Stage | undefined {
  const index = STAGES.indexOf(stage);
  return index >= 0 ? STAGES[index + 1] : undefined;
}

/**
 * Coverage is plain accounting: what was in scope, what is left. Unread should
 * be a number rather than a judgement, which is the one thing the old ledgers
 * genuinely bought.
 */
export function remaining(coverage: Coverage): string[] {
  const done = new Set([...coverage.read, ...coverage.excluded.map((entry) => entry.path)]);
  return coverage.inScope.filter((path) => !done.has(path));
}

export function assertCrawlComplete(record: ReconstructionCase): void {
  const left = remaining(record.coverage);
  if (left.length === 0) return;
  throw new GateRefusal(
    `${left.length} file(s) in scope are neither read nor excluded.`,
    "wfctl reconstruct read <path>   (or: wfctl reconstruct exclude <path> --reason \"<why>\")",
    left.slice(0, 10).join("\n  "),
  );
}

/**
 * Nothing routes into curated knowledge before a trajectory exists.
 *
 * A claim about current truth made while reading is made before the material
 * that contradicts it has been read. The trajectory is what straightening the
 * material produces, so it is also the earliest point at which anything can
 * honestly be said about the present.
 */
export function assertTrajectoriesExist(record: ReconstructionCase): void {
  if (record.trajectories.length > 0) return;
  throw new GateRefusal(
    "No trajectory has been assembled, so nothing can be written yet.",
    "wfctl reconstruct subject <trajectory-id>   (append the events first with wfctl trajectory append)",
    "A claim about current truth made while reading is made before the material " +
      "that contradicts it has been read.",
  );
}

export function assertAdjudicated(record: ReconstructionCase): void {
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  if (open.length === 0) return;
  throw new GateRefusal(
    `${open.length} contradiction(s) are unresolved.`,
    'wfctl reconstruct resolve <id> --resolution "<what they decided>"',
    open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n"),
  );
}

/**
 * The probe gate.
 *
 * A probe asked by the agent that wrote the pages is the same failure as a
 * review run by the agent that wrote the code, so the asker is checked the same
 * way — weakly, and honestly: it proves the questions did not come from the
 * actor running the command, and nothing more.
 */
export function assertProbed(record: ReconstructionCase, actor: string): void {
  if (record.probes.length === 0) {
    throw new GateRefusal(
      "No omission probe has been run.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --page <path>',
      "A probe asks whether the written pages can answer without reopening the " +
        "source. It is what catches material that was fetched and never read.",
    );
  }
  const mine = record.probes.filter((probe) => probe.asker === actor);
  if (mine.length > 0) {
    throw new GateRefusal(
      "The probes were asked by the agent that wrote the pages.",
      "wfctl reconstruct probe --question \"<...>\" --page <path> --asker <a different agent>",
      "Asking yourself what you might have missed returns what you already know.",
    );
  }
  const failed = record.probes.filter((probe) => probe.passed !== true);
  if (failed.length > 0) {
    throw new GateRefusal(
      `${failed.length} probe(s) did not pass.`,
      "wfctl reconstruct probe --question \"<...>\" --page <path> --asker <agent> --passed   (after repairing the page)",
      failed.map((probe) => `  ${probe.question}`).join("\n"),
    );
  }
}

/**
 * A pass that changed nothing still writes.
 *
 * "Checked at this revision, nothing moved" is what stops the next pass redoing
 * the work; closing empty throws away the only thing the pass produced.
 */
export function renderOutcome(record: ReconstructionCase): string {
  if (record.trajectories.length > 0) {
    return `${record.trajectories.length} subject(s) recorded.`;
  }
  const revisions = record.repositories
    .map((entry) => `${entry.repository}@${entry.revision}${entry.dirty ? " (dirty)" : ""}`)
    .join(", ");
  return `Nothing moved. Checked at ${revisions}.`;
}

/**
 * Closing runs the same gates staging runs.
 *
 * It checked only that the directory existed, so a pass that read nothing, held
 * an open contradiction and produced no trajectory archived as a completed
 * provenance receipt. Skipping `stage` skipped everything it protects.
 */
export function assertClosable(record: ReconstructionCase, actor: string): void {
  if (record.stage !== "promote") {
    throw new GateRefusal(
      `This case is at ${record.stage}; closing needs it at promote.`,
      "wfctl reconstruct stage",
      "Each stage's gate runs on the way past it. Closing early runs none of them.",
    );
  }
  assertCrawlComplete(record);
  assertTrajectoriesExist(record);
  assertAdjudicated(record);
  assertProbed(record, actor);
}

export async function closeCase(root: string, id: string): Promise<string> {
  const from = resolve(root, RECONSTRUCTION_DIR, id);
  const present = await stat(from).then(
    (entry) => entry.isDirectory(),
    () => false,
  );
  if (!present) {
    throw new GateRefusal(`No active reconstruction named ${id}.`, "wfctl reconstruct status");
  }
  const to = resolve(root, RECONSTRUCTION_ARCHIVE, id);
  await mkdir(resolve(root, RECONSTRUCTION_ARCHIVE), { recursive: true });
  const { rename, rm } = await import("node:fs/promises");
  await rename(from, to);
  await rm(resolve(root, RECONSTRUCTION_DIR, "current"), { force: true });
  return to;
}

/* ---------------------------------------------------------------- current */

const CURRENT_POINTER = "reconstruction/active/current";

export async function setCurrentCase(root: string, id: string): Promise<void> {
  const path = resolve(root, CURRENT_POINTER);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${id}\n`, "utf8");
}

export async function currentCase(root: string): Promise<ReconstructionCase | undefined> {
  try {
    const id = (await readFile(resolve(root, CURRENT_POINTER), "utf8")).trim();
    return id ? readCase(root, id) : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * The scope decision, as one act.
 *
 * The agent inventories the registry, the raw material and any existing
 * knowledge first, and puts a single question. Four separate asks — which
 * repositories, then which checkout, then how much raw, then what is out — is
 * the shape that made the maintainer answer procedure instead of scope.
 */
export async function recordScope(
  root: string,
  record: ReconstructionCase,
  options: { repositories: PinnedRepository[]; rawScope: RawScope; inScope: string[] },
): Promise<ReconstructionCase> {
  /**
   * Scope is settled once.
   *
   * Re-scoping was silently allowed and replaced the in-scope list, so
   * shrinking it was a way to satisfy the crawl gate without reading anything —
   * and the coverage counters then referred to files no longer in scope.
   */
  if (record.stage !== "scope") {
    throw new GateRefusal(
      `The scope was settled when this case entered ${record.stage}.`,
      "wfctl reconstruct status",
      "Widening it now would move the boundary the coverage gate measures against.",
    );
  }
  if (options.repositories.length === 0) {
    throw new GateRefusal(
      "A scope with no repositories reads nothing.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>",
    );
  }
  /**
   * `--raw all` puts the raw material in scope, which it did not.
   *
   * It recorded the choice and nothing else, so the coverage counter read zero
   * with three notes sitting unread on disk, and every path had to be listed by
   * hand as though the inventory had never run.
   */
  const raw =
    options.rawScope === "all" ? record.rawPaths.map((path) => `${RAW_DIR}/${path}`) : [];
  const inScope = [...new Set([...options.inScope, ...raw])].sort();

  const next: ReconstructionCase = {
    ...record,
    stage: "crawl",
    repositories: options.repositories,
    rawScope: options.rawScope,
    coverage: { ...record.coverage, inScope },
  };
  await writeCase(root, next);
  return next;
}

export async function markRead(
  root: string,
  record: ReconstructionCase,
  path: string,
): Promise<ReconstructionCase> {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope.`,
      "wfctl reconstruct scope --repository <owner/name> --revision <sha> --in <every path, including the ones already listed>",
      "Reading outside the agreed scope is how a bounded pass becomes an unbounded one.",
    );
  }
  const next: ReconstructionCase = {
    ...record,
    coverage: {
      ...record.coverage,
      read: [...new Set([...record.coverage.read, path])].sort(),
    },
  };
  await writeCase(root, next);
  return next;
}

export async function markExcluded(
  root: string,
  record: ReconstructionCase,
  path: string,
  reason: string,
): Promise<ReconstructionCase> {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope, so excluding it counts nothing.`,
      "wfctl reconstruct status",
      "Coverage counted exclusions of paths that were never in scope, which made " +
        "the remaining figure smaller than the work left.",
    );
  }
  if (!reason.trim()) {
    throw new GateRefusal(
      "An exclusion needs its reason.",
      'wfctl reconstruct exclude <path> --reason "<why this cannot inform the baseline>"',
      "An unexplained exclusion is indistinguishable from a file nobody got to.",
    );
  }
  const next: ReconstructionCase = {
    ...record,
    coverage: {
      ...record.coverage,
      excluded: [
        ...record.coverage.excluded.filter((entry) => entry.path !== path),
        { path, reason: reason.trim() },
      ],
    },
  };
  await writeCase(root, next);
  return next;
}

/**
 * A contradiction met while reading.
 *
 * It is recorded and the crawl continues. Asking now would interrupt an
 * unattended pass with a question the maintainer cannot answer well anyway —
 * they would be adjudicating before the rest of the material has been read.
 */
export async function recordContradiction(
  root: string,
  record: ReconstructionCase,
  options: { subject: string; sides: string[] },
): Promise<ReconstructionCase> {
  if (options.sides.length < 2) {
    throw new GateRefusal(
      "A contradiction needs at least two sides.",
      'wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"',
    );
  }
  const id = `C${String(record.contradictions.length + 1).padStart(3, "0")}`;
  const next: ReconstructionCase = {
    ...record,
    contradictions: [...record.contradictions, { id, subject: options.subject, sides: options.sides }],
  };
  await writeCase(root, next);
  return next;
}

export async function resolveContradiction(
  root: string,
  record: ReconstructionCase,
  id: string,
  resolution: string,
): Promise<ReconstructionCase> {
  const found = record.contradictions.find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    throw new GateRefusal(`No contradiction named ${id}.`, "wfctl reconstruct status");
  }
  if (!resolution.trim()) {
    throw new GateRefusal(
      "A resolution records what they decided.",
      `wfctl reconstruct resolve ${id} --resolution "<what they decided>"`,
    );
  }
  const next: ReconstructionCase = {
    ...record,
    contradictions: record.contradictions.map((entry) =>
      entry === found ? { ...entry, resolution: resolution.trim() } : entry,
    ),
  };
  await writeCase(root, next);
  return next;
}

export async function recordProbe(
  root: string,
  record: ReconstructionCase,
  probe: Probe,
  actor: string,
): Promise<ReconstructionCase> {
  if (!probe.question.trim()) {
    throw new GateRefusal(
      "A probe needs its question.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --asker <agent id>',
    );
  }
  /**
   * Refuse the self-asked probe here rather than at the gate.
   *
   * Accepting it and refusing two commands later left the case wedged: the bad
   * probe was on the record and nothing could remove it, so the gate refused
   * forever however many good probes were added.
   */
  if (!probe.asker.trim() || probe.asker === actor) {
    throw new GateRefusal(
      "A probe needs an asker who did not write the pages.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent>',
      "Asking yourself what you might have missed returns what you already know.",
    );
  }
  if (probe.pages.length === 0) {
    throw new GateRefusal(
      "A probe names the pages that must answer it.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <agent>',
    );
  }
  const next: ReconstructionCase = { ...record, probes: [...record.probes, probe] };
  await writeCase(root, next);
  return next;
}

export async function advanceStage(
  root: string,
  record: ReconstructionCase,
  actor: string,
): Promise<{ record: ReconstructionCase; stage: Stage }> {
  switch (record.stage) {
    case "crawl":
      assertCrawlComplete(record);
      break;
    case "assemble":
      assertTrajectoriesExist(record);
      break;
    case "adjudicate":
      assertAdjudicated(record);
      break;
    case "probe":
      assertProbed(record, actor);
      break;
    default:
      break;
  }

  const following = nextStage(record.stage);
  if (!following) {
    throw new GateRefusal("This case is at its last stage.", `wfctl reconstruct close ${record.id}`);
  }
  const next: ReconstructionCase = { ...record, stage: following };
  await writeCase(root, next);
  return { record: next, stage: following };
}

export function renderStatus(record: ReconstructionCase): string {
  const left = remaining(record.coverage);
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  return [
    `${record.id}  ·  stage ${record.stage}  ·  ${STAGE_PRESENCE[record.stage]} present`,
    record.hadBaseline
      ? "re-checking an existing baseline"
      : "first baseline; curated knowledge was empty",
    "",
    `coverage: ${record.coverage.read.length} read, ${record.coverage.excluded.length} excluded, ${left.length} left`,
    `subjects:  ${record.trajectories.length}`,
    `open contradictions: ${open.length}`,
    `probes: ${record.probes.filter((probe) => probe.passed === true).length}/${record.probes.length} passed`,
  ].join("\n");
}
