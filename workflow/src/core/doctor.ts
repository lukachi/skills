import { spawnSync } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { KNOWLEDGE_DIRECTORIES, RUNTIME_DIR, SKILL_DIRS, planInstall, readInstallState } from "./install.js";
import { guardStatus } from "./install.js";
import { inspectLeaves } from "./leaves.js";
import { readRegistry } from "./registry.js";

/**
 * What an installation can be wrong about.
 *
 * The previous doctor grew one check per thing that had actually gone wrong for
 * somebody, which is the only honest way such a list gets written. Most of them
 * survive here in a different shape: the profile split is gone, skills became
 * one skill, and the claim ledger went with the intake case — but the questions
 * they answered are the same questions.
 *
 * Three statuses, and the distinction matters. `fail` means the workflow cannot
 * do its job. `warn` means it can, with something degraded — semantic retrieval
 * absent, a queue unattended. Reporting a warning as a failure trains people to
 * ignore the output, which is worse than not checking.
 */
export type Status = "pass" | "warn" | "fail";

export interface Check {
  name: string;
  status: Status;
  message: string;
  /** The command that clears it, where one exists. */
  remedy?: string;
}

export interface Report {
  target: string;
  checks: Check[];
}

export interface ToolRunner {
  (command: string, args: string[], options?: { cwd?: string }): {
    status: number | null;
    stdout: string;
    stderr: string;
  };
}

const run: ToolRunner = (command, args, options) => {
  const result = spawnSync(command, args, {
    cwd: options?.cwd,
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function runDoctor(
  targetInput: string,
  options: { runner?: ToolRunner; distribution?: string } = {},
): Promise<Report> {
  const target = resolve(targetInput);
  const runner = options.runner ?? run;
  const checks: Check[] = [];

  /* ---------------------------------------------------------- installation */

  const state = await readInstallState(target);
  if (!state) {
    checks.push({
      name: "installation",
      status: "fail",
      message: "This is not an initialized knowledge repository",
      remedy: "wfctl init knowledge",
    });
    return { target, checks };
  }
  checks.push({
    name: "installation",
    status: "pass",
    message: `wfctl ${state.installedVersion}, ${Object.keys(state.files).length} owned file(s)`,
  });

  /**
   * Drift, in both directions: a file wfctl owns that is gone, and one the
   * maintainer edited. The second is not a failure — it is theirs to edit —
   * but an upgrade will leave it behind, and knowing that before the upgrade is
   * the whole point.
   */
  if (options.distribution) {
    const plan = await planInstall({
      target,
      distribution: options.distribution,
      version: state.installedVersion,
    });
    const pending = plan.operations.filter((operation) => operation.kind === "write");
    if (plan.edited.length > 0) {
      checks.push({
        name: "installation-edited",
        status: "warn",
        message: `${plan.edited.length} owned file(s) edited since install: ${plan.edited.join(", ")}`,
        remedy: "Keep them, or delete them and run: wfctl init knowledge",
      });
    }
    if (pending.length > 0) {
      checks.push({
        name: "installation-pending",
        status: "warn",
        message: `${pending.length} file(s) would be written by a reinstall`,
        remedy: "wfctl init knowledge",
      });
    }
  }

  const missing: string[] = [];
  for (const path of Object.keys(state.files)) {
    if (!(await exists(resolve(target, path)))) missing.push(path);
  }
  checks.push({
    name: "installed-files",
    status: missing.length > 0 ? "fail" : "pass",
    message: missing.length > 0 ? `${missing.length} missing: ${missing.join(", ")}` : "All present",
    ...(missing.length > 0 ? { remedy: "wfctl init knowledge" } : {}),
  });

  /* ------------------------------------------------------------ git, dirs */

  const git = runner("git", ["rev-parse", "--is-inside-work-tree"], { cwd: target });
  checks.push({
    name: "git",
    status: git.status === 0 ? "pass" : "warn",
    message:
      git.status === 0
        ? "Git repository"
        : "Not a Git repository; knowledge has no history and cannot be shared",
    ...(git.status === 0 ? {} : { remedy: "git init" }),
  });

  const absentDirs: string[] = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const found = await stat(resolve(target, directory)).then(
      (entry) => entry.isDirectory(),
      () => false,
    );
    if (!found) absentDirs.push(directory);
  }
  checks.push({
    name: "knowledge-layout",
    status: absentDirs.length > 0 ? "fail" : "pass",
    message: absentDirs.length > 0 ? `Missing: ${absentDirs.join(", ")}` : "Complete",
    ...(absentDirs.length > 0 ? { remedy: "wfctl init knowledge" } : {}),
  });

  /* ----------------------------------------------------------- the skill */

  for (const directory of SKILL_DIRS) {
    const skill = resolve(target, directory, "SKILL.md");
    const present = await exists(skill);
    const frontmatter = present ? (await readFile(skill, "utf8")).startsWith("---\nname: wfctl") : false;
    checks.push({
      name: `skill:${directory.split("/")[0]}`,
      status: present && frontmatter ? "pass" : "fail",
      message: present
        ? frontmatter
          ? "Installed"
          : "Present but its frontmatter is not wfctl's"
        : "Missing — the agent has no entry point",
      ...(present && frontmatter ? {} : { remedy: "wfctl init knowledge" }),
    });
  }

  const block = await readFile(resolve(target, "AGENTS.md"), "utf8").catch(() => "");
  checks.push({
    name: "managed-block",
    status: block.includes("wfctl:begin") ? "pass" : "fail",
    message: block.includes("wfctl:begin")
      ? "Present in AGENTS.md"
      : "Absent — nothing points the agent at the skill",
    ...(block.includes("wfctl:begin") ? {} : { remedy: "wfctl init knowledge" }),
  });

  /* ------------------------------------------------------------- guards */

  for (const guard of await guardStatus(target)) {
    const script = await exists(
      resolve(target, RUNTIME_DIR, guard.guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard.guard}.mjs`),
    );
    checks.push({
      name: `guard:${guard.guard}`,
      status: guard.installed && script ? "pass" : guard.installed ? "fail" : "warn",
      message: !script
        ? "Armed in settings, but its script is missing"
        : guard.installed
          ? guard.describes
          : `Off — ${guard.describes}`,
      ...(guard.installed && script ? {} : { remedy: `wfctl guards on ${guard.guard}` }),
    });
  }

  /**
   * The guards shell out to `wfctl` by name. When it is not on PATH they fail
   * open and report nothing, which looks exactly like a healthy session — the
   * failure that made the whole hook layer inert without anyone noticing.
   */
  const onPath = runner("wfctl", ["--help"], { cwd: target });
  checks.push({
    name: "wfctl-on-path",
    status: onPath.status === 0 && onPath.stdout.includes("project workflow") ? "pass" : "fail",
    message:
      onPath.status === 0 && onPath.stdout.includes("project workflow")
        ? "The guards can reach it"
        : "Not on PATH — every guard will fail open and report nothing",
    remedy: "Put wfctl on PATH (bun link, or npm i -g wfctl)",
  });

  /* ------------------------------------------------------------- leaves */

  const registry = await readRegistry(target);
  if (registry.length === 0) {
    checks.push({
      name: "repositories",
      status: "warn",
      message: "None registered; no source code can be read or written",
      remedy: "wfctl repo add <owner/name> --path <dir>",
    });
  } else {
    for (const leaf of await inspectLeaves(registry)) {
      const status: Status =
        leaf.graph === "ready" ? "pass" : leaf.graph === "unreachable" ? "fail" : "warn";
      checks.push({
        name: `leaf:${leaf.repository}/${leaf.worktreeId}`,
        status,
        message:
          leaf.graph === "ready"
            ? `Graph ${leaf.ageDays}d old`
            : leaf.graph === "stale"
              ? `Graph ${leaf.ageDays}d old; it answers confidently about code that may be gone`
              : leaf.graph === "missing"
                ? "No graph; nothing here can traverse it"
                : `${leaf.path} is not there`,
        ...(leaf.graph === "unreachable"
          ? { remedy: `wfctl repo remove ${leaf.repository} --worktree ${leaf.worktreeId}` }
          : leaf.graph === "ready"
            ? {}
            : { remedy: `graphify build   (in ${leaf.path})` }),
      });
    }

    const graphify = runner("graphify", ["--version"]);
    checks.push({
      name: "graphify",
      status: graphify.status === 0 ? "pass" : "warn",
      message: graphify.status === 0 ? graphify.stdout.trim() || "Available" : "Not installed",
      ...(graphify.status === 0 ? {} : { remedy: "uv tool install graphifyy" }),
    });
  }

  /* ---------------------------------------------------------- retrieval */

  const qmd = runner("qmd", ["status"], { cwd: target });
  if (qmd.status !== 0) {
    checks.push({
      name: "qmd",
      status: "warn",
      message: "Not available; curated knowledge can only be searched by reading it",
      remedy: "Install QMD, then: qmd index",
    });
  } else {
    checks.push({ name: "qmd", status: "pass", message: "Index opens" });
    /**
     * Indexing and embedding are separate. Searching without embeddings
     * silently degrades to lexical matching over exactly the material most
     * recently written, which is the material least likely to be the answer.
     */
    const pending = /pending|not embedded|needs embedding/i.test(qmd.stdout);
    checks.push({
      name: "qmd-embeddings",
      status: pending ? "warn" : "pass",
      message: pending
        ? "Documents await embedding; semantic retrieval will silently fall back to lexical"
        : "Ready",
      ...(pending ? { remedy: "qmd embed" } : {}),
    });
  }

  /* ------------------------------------------------------------- queues */

  const inbox = await readdir(resolve(target, "changes/inbox")).catch(() => []);
  const captures = inbox.filter((entry) => entry.endsWith(".md"));
  checks.push({
    name: "capture-inbox",
    status: captures.length > 0 ? "warn" : "pass",
    message:
      captures.length > 0
        ? `${captures.length} unresolved capture(s); a queue nobody opens is the same as no queue`
        : "Empty",
    ...(captures.length > 0 ? { remedy: "Route or discard each one" } : {}),
  });

  const queued = await readdir(resolve(target, "changes/promotion")).catch(() => []);
  if (queued.length > 0) {
    checks.push({
      name: "promotion-queue",
      status: "warn",
      message: `${queued.length} record(s) waiting on the maintainer`,
      remedy: "wfctl work promotion list",
    });
  }

  return { target, checks };
}

export function renderReport(report: Report): string {
  const symbol: Record<Status, string> = { pass: "ok  ", warn: "warn", fail: "FAIL" };
  const lines = report.checks.map((check) => {
    const head = `${symbol[check.status]}  ${check.name.padEnd(28)} ${check.message}`;
    return check.status === "pass" || !check.remedy
      ? head
      : `${head}\n      → ${check.remedy}`;
  });

  const failed = report.checks.filter((check) => check.status === "fail").length;
  const warned = report.checks.filter((check) => check.status === "warn").length;

  return [
    ...lines,
    "",
    failed > 0
      ? `${failed} failing, ${warned} degraded.`
      : warned > 0
        ? `Healthy, ${warned} degraded.`
        : "Healthy.",
  ].join("\n");
}

export function exitCodeFor(report: Report): number {
  return report.checks.some((check) => check.status === "fail") ? 1 : 0;
}
