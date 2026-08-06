import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readConfig } from "./config.js";
import { collectWorkflowState } from "./state.js";
import { STATE_COLLECTORS } from "./state-collectors.js";

/**
 * One question: can this session stop right now without losing anything?
 *
 * Everything needed to answer it already existed and no command asked it, so the
 * maintainer asked the agent instead — every time, in prose, and had to trust
 * the answer. That is the wrong party doing the checking: whether the state is
 * captured is a fact about the repository, not a judgement about the work.
 *
 * Three things make a stop unsafe, and they are deliberately different failures.
 *
 * A **stale** checkpoint describes a record that has since changed. The resume
 * prose is there but no longer true, which is worse than absence because it
 * reads as current.
 *
 * A **missing** checkpoint is an active record nobody ever recorded a position
 * for. A fresh session gets the record and has to infer where the work stopped.
 *
 * **Uncommitted** changes are work on disk that no checkpoint mentions and no
 * commit preserves. This is the one the checkpoint machinery cannot see by
 * itself: a basis digest compares a checkpoint to its own record, so a day spent
 * editing trajectories, resolving captures and correcting curated pages leaves
 * every checkpoint reporting itself perfectly fresh.
 */

export type StopRisk = "stale-checkpoint" | "missing-checkpoint" | "uncommitted";

export interface ResumabilityEntry {
  domain: string;
  subject: string;
  risks: StopRisk[];
  /** What the record says the next session should do, when it says anything. */
  nextAction: string;
}

export interface Resumability {
  safe: boolean;
  entries: ResumabilityEntry[];
  /** Paths changed but not committed, which no checkpoint can describe. */
  uncommitted: string[];
  /** Active records carrying a checkpoint that still matches its record. */
  current: string[];
}

export async function assessResumability(targetInput: string): Promise<Resumability> {
  const target = resolve(targetInput);
  const report = await collectWorkflowState(target, { collectors: STATE_COLLECTORS });
  const bySubject = new Map<string, ResumabilityEntry>();
  const current: string[] = [];

  const entryFor = (domain: string, subject: string): ResumabilityEntry => {
    const key = `${domain}/${subject}`;
    const existing = bySubject.get(key);
    if (existing) {
      return existing;
    }
    const created: ResumabilityEntry = { domain, subject, risks: [], nextAction: "" };
    bySubject.set(key, created);
    return created;
  };

  for (const signal of report.signals) {
    const subject = signal.subject ?? "";
    if (signal.id.endsWith(".resume")) {
      const entry = entryFor(signal.domain, subject);
      entry.nextAction = String(signal.facts?.next ?? "");
      current.push(subject || signal.domain);
      continue;
    }
    if (signal.id.endsWith(".stale-checkpoint") || signal.id.endsWith(".unverifiable-checkpoint")) {
      entryFor(signal.domain, subject).risks.push("stale-checkpoint");
    }
  }

  // An active record with no resume signal never had a checkpoint written.
  for (const signal of report.signals) {
    if (!ACTIVE_RECORD_SIGNALS.has(signal.id)) {
      continue;
    }
    const subject = signal.subject ?? "";
    const key = `${signal.domain}/${subject}`;
    if (!bySubject.has(key)) {
      entryFor(signal.domain, subject).risks.push("missing-checkpoint");
    }
  }

  const uncommitted = await uncommittedPaths(target);
  if (uncommitted.length > 0) {
    // Attributed to the repository rather than to a record: the changed files
    // may belong to several records, or to none, and guessing which would be a
    // worse answer than naming the files.
    entryFor("repository", "").risks.push("uncommitted");
  }

  const entries = [...bySubject.values()].filter((entry) => entry.risks.length > 0);
  return {
    safe: entries.length === 0,
    entries,
    uncommitted,
    current: [...new Set(current)],
  };
}

/**
 * The signals that mean "a record is open". Kept explicit rather than derived
 * from a naming convention, so a new collector cannot silently opt a whole
 * domain out of this check by choosing a different signal id.
 */
const ACTIVE_RECORD_SIGNALS = new Set([
  "reconstruction.active",
  "reconstruction.awaiting-decision",
  "intake.active",
  "intake.awaiting-decision",
  "work.active",
]);

async function uncommittedPaths(target: string): Promise<string[]> {
  const config = await readConfig(target).catch(() => undefined);
  if (!config) {
    return [];
  }
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: target,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  return result.stdout
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    // Runtime state is gitignored by design; anything reaching here is tracked
    // content, which is exactly what a stop would lose.
    .filter((path) => !path.startsWith(".workflow/current/"));
}

export async function readResumeProse(
  targetInput: string,
): Promise<Array<{ subject: string; state: string; next: string }>> {
  const target = resolve(targetInput);
  const report = await collectWorkflowState(target, { collectors: STATE_COLLECTORS });
  return report.signals
    .filter((signal) => signal.id.endsWith(".resume"))
    .map((signal) => ({
      subject: signal.subject ?? signal.domain,
      state: String(signal.facts?.state ?? ""),
      next: String(signal.facts?.next ?? ""),
    }));
}

/** Exposed for the CLI so a caller can print the record without re-deriving it. */
export async function activeCasePath(target: string, id: string): Promise<string | undefined> {
  const path = join(resolve(target), "reconstruction/active", id, "case.md");
  try {
    await readFile(path);
    return path;
  } catch {
    return undefined;
  }
}
