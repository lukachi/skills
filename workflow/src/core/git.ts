import { spawnSync } from "node:child_process";
import { GateRefusal } from "./gates.js";

/**
 * Reading a repository at an exact revision.
 *
 * The revision was recorded and never used for anything but printing, which
 * left two holes. Coverage measured against paths the agent had typed, so a
 * baseline could be declared complete by scoping one file. And a claim could
 * name a revision nobody had read at, because there was no way to read at one.
 *
 * This is the plumbing for both: what the repository contained, and what one of
 * its files said, at a revision that cannot move underneath the answer.
 */
export interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type GitRunner = (args: string[], cwd: string) => GitResult;

const runGit: GitRunner = (args, cwd) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

export function isRepository(path: string, run: GitRunner = runGit): boolean {
  return run(["rev-parse", "--is-inside-work-tree"], path).status === 0;
}

/**
 * The revision a checkout is on, and whether anything is uncommitted.
 *
 * Dirtiness is recorded rather than refused: a claim read against uncommitted
 * work is not wrong, only less reproducible, and that belongs on the page.
 */
export function head(path: string, run: GitRunner = runGit): { revision: string; dirty: boolean } {
  const revision = run(["rev-parse", "HEAD"], path);
  if (revision.status !== 0) {
    throw new GateRefusal(
      `${path} is not a Git repository, or has no commits.`,
      `git -C ${path} init && git -C ${path} commit --allow-empty -m "initial"`,
      revision.stderr.trim(),
    );
  }
  const status = run(["status", "--porcelain"], path);
  return { revision: revision.stdout.trim(), dirty: status.stdout.trim().length > 0 };
}

export function resolveRevision(path: string, revision: string, run: GitRunner = runGit): string {
  const result = run(["rev-parse", "--verify", `${revision}^{commit}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${revision} is not a commit in ${path}.`,
      `git -C ${path} log --oneline -5`,
      "A revision nobody can resolve cannot be read at, so nothing recorded " +
        "against it can be checked later.",
    );
  }
  return result.stdout.trim();
}

/**
 * Everything the repository contained at that revision.
 *
 * This is what makes coverage mean something. Measuring against a list the
 * agent supplied answers "did you read what you chose to read", which is a
 * question that cannot fail. Measuring against the tree answers "what is left",
 * which can.
 */
export function filesAt(path: string, revision: string, run: GitRunner = runGit): string[] {
  const result = run(["ls-tree", "-r", "--name-only", revision], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `Cannot list ${path} at ${revision}.`,
      `git -C ${path} log --oneline -5`,
      result.stderr.trim(),
    );
  }
  return result.stdout.split("\n").filter((line) => line.trim().length > 0).sort();
}

/**
 * One file's contents, at a revision, without a checkout.
 *
 * A claim that names `repository@revision:path` can be checked by whoever reads
 * it next, on a machine that never had that branch — which is the difference
 * between a citation and an assertion.
 */
export function readAt(
  path: string,
  revision: string,
  file: string,
  run: GitRunner = runGit,
): string {
  const result = run(["show", `${revision}:${file}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${file} is not in ${path} at ${revision}.`,
      `wfctl reconstruct status`,
      "It may have been added later, or removed before this revision.",
    );
  }
  return result.stdout;
}

/** A citation another reader can resolve without this checkout. */
export function citation(repository: string, revision: string, file: string): string {
  return `${repository}@${revision.slice(0, 12)}:${file}`;
}

/**
 * The branch a checkout is on, or "" when it is detached or not a repository.
 *
 * Used for the label a registered checkout is referred to by. That label used
 * to default to the worktree id, which defaults to `main`, so a checkout on
 * `brand/icons` was registered and listed as `main` — and the label is how the
 * agent names the checkout it is about to write in.
 */
export function currentBranch(path: string, run: GitRunner = runGit): string {
  const result = run(["rev-parse", "--abbrev-ref", "HEAD"], path);
  if (result.status !== 0) return "";
  const name = result.stdout.trim();
  return name === "HEAD" ? "" : name;
}
