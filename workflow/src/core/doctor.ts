import { spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { KNOWLEDGE_DIRECTORIES, SKILL_DIRS, planInstall, readInstallState } from "./install.js";
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

  /**
   * A corrupt state file is the most likely thing wrong with an installation,
   * and it made this command abort with a bare parse error and no report at
   * all. Diagnosing a broken install is the entire job; dying on the first
   * broken thing is the one behaviour it cannot have.
   */
  let state: Awaited<ReturnType<typeof readInstallState>>;
  try {
    state = await readInstallState(target);
  } catch (error) {
    checks.push({
      name: "installation",
      status: "fail",
      message: `.workflow/state.json cannot be read: ${(error as Error).message}`,
      remedy: "wfctl init knowledge   (after moving the unreadable file aside)",
    });
    return { target, checks };
  }
  if (!state) {
    checks.push({
      name: "installation",
      status: "fail",
      message: "This is not an initialized knowledge repository",
      remedy: "wfctl init knowledge",
    });
    return { target, checks };
  }
  if (typeof state.files !== "object" || state.files === null) {
    checks.push({
      name: "installation",
      status: "fail",
      message: ".workflow/state.json has no file record, so nothing owned can be checked",
      remedy: "wfctl init knowledge",
    });
    return { target, checks };
  }
  checks.push({
    name: "installation",
    status: "pass",
    message: `wfctl ${state.installedVersion}, ${Object.keys(state.files).length} owned file(s)`,
  });

  /** Report files that an explicit init would replace or remove. */
  const plan = options.distribution
    ? await planInstall({
      target,
      distribution: options.distribution,
      version: state.installedVersion,
    })
    : undefined;
  if (plan) {
    const pending = plan.operations.filter((operation) => operation.kind === "write");
    if (pending.length > 0) {
      checks.push({
        name: "installation-pending",
        status: "warn",
        message: `${pending.length} file(s) would be written by a reinstall`,
        remedy: "wfctl init knowledge",
      });
    }
    if (plan.obsolete.length > 0) {
      checks.push({
        name: "installation-obsolete",
        status: "warn",
        message: `${plan.obsolete.length} retired wfctl file(s) will be removed by init`,
      });
    }
  }

  const obsolete = new Set(plan?.obsolete ?? []);
  const missing: string[] = [];
  for (const path of Object.keys(state.files)) {
    if (obsolete.has(path)) continue;
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

  /* ------------------------------------------------------------- leaves */

  const registry = await readRegistry(target);
  if (registry.length === 0) {
    checks.push({
      name: "repositories",
      status: "warn",
      message: "None registered for optional cross-repository lookup",
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

  /* ----------------------------------------------------- curated pages */

  const { collectPages, validateCurated } = await import("./curated.js");
  const pages = await collectPages(target);
  if (pages.length === 0) {
    checks.push({
      name: "curated-knowledge",
      status: "warn",
      message: "No curated pages yet",
    });
  } else {
    const issues = await validateCurated(target);
    checks.push({
      name: "curated-knowledge",
      status: issues.length > 0 ? "fail" : "pass",
      message:
        issues.length > 0
          ? `${pages.length} page(s), ${issues.length} structural problem(s)`
          : `${pages.length} page(s), all structurally valid`,
      ...(issues.length > 0 ? { remedy: "wfctl knowledge validate" } : {}),
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
