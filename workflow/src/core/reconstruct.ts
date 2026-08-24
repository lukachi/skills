import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { filesAt, resolveRevision } from "./git.js";
import { withLock, writeAtomic } from "./lock.js";
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
  /** Set when the pass is given up rather than finished. */
  abandoned?: { at: string; reason: string };
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
  await withLock(path, () => writeAtomic(path, `${JSON.stringify(record, null, 2)}\n`));
}

/**
 * Read, change, write — with nobody else in between.
 *
 * `writeCase` was locked and its callers were not, so five parallel reads each
 * loaded the same case, each added one path, and coverage ended at one instead
 * of five. The crawl gate then refused for files that had been read.
 */
export async function mutateCase(
  root: string,
  id: string,
  change: (record: ReconstructionCase) => ReconstructionCase,
): Promise<ReconstructionCase> {
  const path = casePath(root, id);
  return withLock(path, async () => {
    const current = await readCase(root, id);
    if (!current) {
      throw new GateRefusal(`No reconstruction named ${id}.`, "wfctl reconstruct status");
    }
    const next = change(current);
    await writeAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  });
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

/**
 * Excluding everything is not reading everything.
 *
 * Five one-word exclusions over a five-file scope satisfied the coverage gate
 * with nothing read at all, which was the load-bearing step in closing a
 * "completed" pass that had read nothing.
 */
export function assertSomethingRead(record: ReconstructionCase): void {
  if (record.coverage.read.length > 0) return;
  throw new GateRefusal(
    "Nothing in scope was read; every file was excluded.",
    "wfctl reconstruct read <path>",
    "A pass that excluded its whole scope has established nothing about the " +
      "project, and closing it would record that it had.",
  );
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
  if (record.abandoned) {
    return `Abandoned: ${record.abandoned.reason}`;
  }
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
  if (record.abandoned) return;
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
  /**
   * An archive name that is already taken gets a suffix.
   *
   * Case ids were date-only and the rename was bare, so the second
   * reconstruction of any calendar day could be neither closed nor abandoned —
   * `ENOTEMPTY`, with a remedy blaming the maintainer for hand-editing. The
   * abandon path had already rewritten the stage before failing, so the wedged
   * case then advertised itself as awaiting the maintainer.
   */
  const { rename, rm, stat: statPath } = await import("node:fs/promises");
  await mkdir(resolve(root, RECONSTRUCTION_ARCHIVE), { recursive: true });

  let to = resolve(root, RECONSTRUCTION_ARCHIVE, id);
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const taken = await statPath(to).then(
      () => true,
      () => false,
    );
    if (!taken) break;
    to = resolve(root, RECONSTRUCTION_ARCHIVE, `${id}-${suffix}`);
  }
  await rename(from, to);
  await rm(resolve(root, RECONSTRUCTION_DIR, "current"), { force: true });
  return to;
}

/* ---------------------------------------------------------------- current */

const CURRENT_POINTER = "reconstruction/active/current";

export async function setCurrentCase(root: string, id: string): Promise<void> {
  const path = resolve(root, CURRENT_POINTER);
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(path, `${id}\n`);
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
  options: {
    repositories: PinnedRepository[];
    rawScope: RawScope;
    inScope: string[];
    /** Paths deliberately left out, with the reason, before the crawl starts. */
    exclude?: string[];
  },
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

  /**
   * What the repository contained at the pinned revision, not what the agent
   * typed. Measuring against a supplied list answers "did you read what you
   * chose to read", which is a question that cannot fail — a baseline could be
   * declared complete by scoping one file, and one was.
   *
   * An explicit `--in` narrows that tree; it never adds to it, so a path
   * outside the repository cannot enter scope at all.
   */
  const fromTree = options.repositories.flatMap((repository) => {
    const revision = resolveRevision(repository.path, repository.revision);
    return filesAt(repository.path, revision).map(
      (file) => `${repository.repository}:${file}`,
    );
  });

  const narrowed =
    options.inScope.length > 0
      ? fromTree.filter((entry) =>
          options.inScope.some(
            (want) => entry === want || entry.endsWith(`:${want}`) || entry.includes(`:${want}`),
          ),
        )
      : fromTree;

  if (options.inScope.length > 0 && narrowed.length === 0) {
    throw new GateRefusal(
      "Nothing in the pinned tree matches that scope.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>   (with no --in, for everything)",
      `Asked for: ${options.inScope.join(", ")}`,
    );
  }

  const inScope = [...new Set([...narrowed, ...raw])].sort();

  /**
   * A scope-time exclusion is still an exclusion, so it answers to the same two
   * rules: it must name something in scope, and it must say why. `--not`
   * bypassed both and stamped a canned reason, which inflated the excluded
   * count past the size of the scope.
   */
  const excluded = (options.exclude ?? []).map((path) => {
    if (!inScope.includes(path)) {
      throw new GateRefusal(
        `${path} is not in the pinned tree, so excluding it counts nothing.`,
        "wfctl reconstruct scope --repository <owner/name>",
      );
    }
    return { path, reason: "excluded when the scope was settled" };
  });

  const next: ReconstructionCase = {
    ...record,
    stage: "crawl",
    repositories: options.repositories,
    rawScope: options.rawScope,
    coverage: { ...record.coverage, inScope, excluded },
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
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      // A path cannot be both read and excluded; the later act wins.
      read: [...new Set([...current.coverage.read, path])].sort(),
      excluded: current.coverage.excluded.filter((entry) => entry.path !== path),
    },
  }));
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
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      read: current.coverage.read.filter((entry) => entry !== path),
      excluded: [
        ...current.coverage.excluded.filter((entry) => entry.path !== path),
        { path, reason: reason.trim() },
      ],
    },
  }));
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
  let created = "";
  return mutateCase(root, record.id, (current) => {
    const id = `C${String(current.contradictions.length + 1).padStart(3, "0")}`;
    created = id;
    return {
      ...current,
      contradictions: [
        ...current.contradictions,
        { id, subject: options.subject, sides: options.sides },
      ],
    };
  }).then((next) => {
    lastContradictionId = created;
    return next;
  });
}

/** The id just recorded, so the command can print it rather than hiding it. */
export let lastContradictionId = "";

export async function resolveContradiction(
  root: string,
  record: ReconstructionCase,
  id: string,
  resolution: string,
): Promise<ReconstructionCase> {
  const found = record.contradictions.find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    throw new GateRefusal(
      `No contradiction named ${id}.`,
      "wfctl reconstruct status",
      record.contradictions.length > 0
        ? `Recorded:\n${record.contradictions.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}`
        : "None recorded.",
    );
  }
  if (!resolution.trim()) {
    throw new GateRefusal(
      "A resolution records what they decided.",
      `wfctl reconstruct resolve ${id} --resolution "<what they decided>"`,
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    contradictions: current.contradictions.map((entry) =>
      entry.id.toUpperCase() === id.toUpperCase()
        ? { ...entry, resolution: resolution.trim() }
        : entry,
    ),
  }));
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

  /**
   * The pages have to exist. A probe passed against `knowledge/nonexistent.md`
   * with an empty corpus, which is the whole round satisfied having written
   * nothing.
   */
  /**
   * The page has to be a curated page.
   *
   * Checking only that *some file* existed let a probe pass against
   * `/etc/passwd`, an installed asset, or the case's own JSON — the round is
   * meant to ask whether the corpus can answer, and any of those satisfied it.
   */
  const { collectPages } = await import("./curated.js");
  const curated = new Set(await collectPages(root));
  for (const page of probe.pages) {
    const named = page.replace(/^knowledge\//, "");
    if (curated.has(named)) continue;
    throw new GateRefusal(
      `${page} is not a curated page.`,
      "wfctl knowledge validate",
      curated.size > 0
        ? `Pages in the corpus:\n${[...curated].map((entry) => `  ${entry}`).join("\n")}`
        : "The corpus is empty; the write stage has not produced anything yet.",
    );
  }
  /**
   * A second answer to the same question supersedes the first.
   *
   * Appending meant a failed probe could never be cleared: re-running it with
   * `--passed` added a passing one beside the failure, the gate still refused,
   * and with no way to abandon a case that deadlocked reconstruction for the
   * repository permanently.
   */
  return mutateCase(root, record.id, (current) => ({
    ...current,
    probes: [...current.probes.filter((entry) => entry.question !== probe.question), probe],
  }));
}

/**
 * Pages have to exist before a probe can ask anything of them.
 *
 * `advanceStage` had no `write` case at all, so the stage that produces the
 * corpus advanced with `knowledge/` empty — and the probe round then passed
 * against files that were not pages. Together they closed a "completed"
 * baseline that had written nothing.
 */
export async function assertPagesWritten(
  root: string,
  record: ReconstructionCase,
): Promise<void> {
  const { collectPages } = await import("./curated.js");
  const pages = await collectPages(root);
  if (pages.length > 0) return;
  throw new GateRefusal(
    "No page has been written, so there is nothing to probe.",
    "Write the pages this pass established into knowledge/, then: wfctl reconstruct stage",
    `${record.trajectories.length} subject(s) were assembled. A pass that ` +
      "assembled lines and wrote nothing has established nothing anyone can read.",
  );
}

export async function advanceStage(
  root: string,
  record: ReconstructionCase,
  actor: string,
): Promise<{ record: ReconstructionCase; stage: Stage }> {
  switch (record.stage) {
    case "scope":
      /**
       * The crawl gate was defeated by never giving it anything to measure:
       * with an empty scope, "everything in scope is read" is vacuously true.
       */
      if (record.repositories.length === 0 || record.coverage.inScope.length === 0) {
        throw new GateRefusal(
          "The scope has not been settled, so there is nothing to read.",
          "wfctl reconstruct scope --repository <owner/name>",
          "A crawl over an empty scope satisfies its own gate without reading anything.",
        );
      }
      break;
    case "crawl":
      assertCrawlComplete(record);
      assertSomethingRead(record);
      break;
    case "assemble":
      assertTrajectoriesExist(record);
      break;
    case "adjudicate":
      assertAdjudicated(record);
      break;
    case "write":
      await assertPagesWritten(root, record);
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
  const pinned = record.repositories
    .map((entry) => `${entry.repository}@${entry.revision.slice(0, 12)}${entry.dirty ? " (dirty)" : ""}`)
    .join(", ");
  return [
    record.abandoned
      ? `${record.id}  ·  ABANDONED: ${record.abandoned.reason}`
      : `${record.id}  ·  stage ${record.stage}  ·  ${STAGE_PRESENCE[record.stage]} present`,
    // Provenance was recorded and never shown, so every pass closed without
    // naming the revision or the dirtiness it read at.
    ...(pinned ? [`read at: ${pinned}`, `raw scope: ${record.rawScope ?? "none"}`] : []),
    record.hadBaseline
      ? "re-checking an existing baseline"
      : "first baseline; curated knowledge was empty",
    "",
    `coverage: ${record.coverage.read.length} read, ${record.coverage.excluded.length} excluded, ${left.length} left`,
    `subjects:  ${record.trajectories.length}`,
    open.length > 0
      ? `open contradictions:\n${open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}`
      : "open contradictions: none",
    `probes: ${record.probes.filter((probe) => probe.passed === true).length}/${record.probes.length} passed`,
  ].join("\n");
}
