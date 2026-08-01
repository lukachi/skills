import { access, readFile, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  errorMessage,
  isMissingFileError,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import {
  commandFailure,
  graphifyCliCheck,
  qmdVersionCheck,
  runTool,
  type ToolRunner,
} from "./dependencies.js";
import { isGitRepository } from "./git.js";
import { validateKnowledge } from "./knowledge.js";
import {
  compileKnowledgeGraph,
  type KnowledgeGraph,
} from "./knowledge-graph.js";
import {
  compileClaimLedger,
  type ClaimLedger,
} from "./claim-ledger.js";
import { listCaptures } from "./capture.js";
import { buildInstallPlan, graphifyIgnoreEntries, skillsForProfile } from "./planner.js";
import {
  listRepositoryConnections,
  repositoryRegistryIssues,
} from "./repository-registry.js";
import type { DoctorCheck, DoctorReport, Profile } from "./types.js";
import { listInstalledSkills } from "./skill-installer.js";

export interface DoctorOptions {
  runner?: ToolRunner;
}

export async function runDoctor(
  targetInput: string,
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const target = resolve(targetInput);
  const checks: DoctorCheck[] = [];
  const runner = options.runner ?? runTool;
  let config;

  try {
    config = await readConfig(target);
    checks.push({ name: "config", status: "pass", message: `${config.profile} profile` });
  } catch (error) {
    checks.push({ name: "config", status: "fail", message: errorMessage(error) });
    return { target, checks };
  }

  const gitRepository = isGitRepository(target);
  checks.push({
    name: "git",
    status: gitRepository ? "pass" : "fail",
    message: gitRepository ? "Git repository detected" : "Target is not a Git repository",
  });

  if (config.profile === "leaf") {
    checks.push(graphifyCliCheck({
      target,
      agents: config.skills?.agents ?? [],
      runner,
    }));
    checks.push(await graphifyGraphCheck(join(target, "graphify-out/graph.json")));
    checks.push(await graphifyScopeCheck(join(target, ".graphifyignore"), config.profile));
    const ignored = runner(
      "git",
      ["check-ignore", "-q", "graphify-out/graph.json"],
      { cwd: target },
    );
    checks.push({
      name: "graphify-ignore",
      status: ignored.status === 0 ? "pass" : "fail",
      message: ignored.status === 0
        ? "Graphify output is excluded from Git"
        : "graphify-out/ must be ignored; run wfctl upgrade",
    });
  }

  if (config.skills?.scope === "project") {
    for (const skill of skillsForProfile(config.profile)) {
      if (config.skills.agents.includes("codex")) {
        checks.push(await pathCheck(
          `codex-skill-${skill}`,
          join(target, ".agents/skills", skill, "SKILL.md"),
          "fail",
          `Codex skill ${skill} is installed`,
          `Codex skill ${skill} is missing`,
        ));
      }
      if (config.skills.agents.includes("claude")) {
        checks.push(await pathCheck(
          `claude-skill-${skill}`,
          join(target, ".claude/skills", skill, "SKILL.md"),
          "fail",
          `Claude skill ${skill} is installed`,
          `Claude skill ${skill} is missing`,
        ));
      }
    }
  } else if (config.skills?.scope === "user") {
    try {
      const installed = listInstalledSkills(target, true);
      for (const skill of skillsForProfile(config.profile)) {
        const entry = installed.find((candidate) => candidate.name === skill);
        checks.push({
          name: `user-skill-${skill}`,
          status: entry ? "pass" : "fail",
          message: entry
            ? `User-scope skill ${skill} is installed at ${entry.path}`
            : `User-scope skill ${skill} is missing`,
        });
      }
    } catch (error) {
      checks.push({
        name: "user-skills",
        status: "fail",
        message: errorMessage(error),
      });
    }
  } else if (config.skills?.scope === "none") {
    checks.push({
      name: "workflow-skills",
      status: "warn",
      message:
        "Agent skills were explicitly disabled; CLI assets are usable, but the workflow cannot enforce agent behavior",
    });
  }

  const knowledgeRoot = resolveKnowledgeRoot(target, config);
  const qmdVersion = qmdVersionCheck(runner);
  checks.push(qmdVersion);
  const qmdConfig = await pathCheck(
    "qmd-index-config",
    join(knowledgeRoot, ".qmd/index.yml"),
    "fail",
    `Project-local QMD collections found at ${knowledgeRoot}`,
    `Project-local QMD configuration is missing at ${knowledgeRoot}`,
  );
  checks.push(qmdConfig);
  if (qmdVersion.status === "pass" && qmdConfig.status === "pass") {
    checks.push(...qmdHealthChecks(knowledgeRoot, runner));
  }

  checks.push(await pathCheck(
    "knowledge",
    join(knowledgeRoot, "knowledge/index.md"),
    "fail",
    `Knowledge bundle found at ${knowledgeRoot}`,
    `Knowledge bundle is missing at ${knowledgeRoot}`,
  ));

  checks.push(await pathCheck(
    "maintainer-guide",
    join(target, "PROJECT_WORKFLOW.md"),
    "fail",
    "Maintainer guide is present",
    "PROJECT_WORKFLOW.md is missing",
  ));

  try {
    const validation = await validateKnowledge(knowledgeRoot);
    checks.push({
      name: "curated-knowledge",
      status: validation.valid ? "pass" : "fail",
      message: validation.valid
        ? `${validation.files} curated Markdown file(s) satisfy the trust profile`
        : `${validation.errors.length} validation error(s); ask the knowledge agent to repair or migrate the affected views, then run wfctl knowledge validate`,
    });
    if (validation.valid) {
      const compilation = await compileKnowledgeGraph(knowledgeRoot);
      checks.push(await knowledgeGraphCheck(
        knowledgeRoot,
        compilation.graph,
      ));
      try {
        const claims = await compileClaimLedger(knowledgeRoot);
        if (claims.errors.length > 0) {
          checks.push({
            name: "claim-ledger",
            status: "fail",
            message: `${claims.errors.length} claim-ledger error(s); run the relevant intake or reconstruction case check`,
          });
        } else {
          checks.push(await claimLedgerCheck(knowledgeRoot, claims.ledger));
        }
      } catch (error) {
        checks.push({
          name: "claim-ledger",
          status: "fail",
          message: `Cannot compile claim ledger: ${errorMessage(error)}`,
        });
      }
    }
  } catch (error) {
    checks.push({
      name: "curated-knowledge",
      status: "fail",
      message: errorMessage(error),
    });
  }

  if (config.profile === "knowledge") {
    for (
      const directory of [
        "raw",
        "intake/cases/active",
        "intake/cases/archive",
        "reconstruction/active",
        "reconstruction/archive",
        "changes/active",
        "changes/archive",
        "changes/archive/captures",
        "changes/inbox",
      ]
    ) {
      checks.push(await pathCheck(
        `knowledge-${directory}`,
        join(target, directory),
        "fail",
        `${directory} exists`,
        `${directory} is missing`,
      ));
    }
    try {
      const captures = await listCaptures(target);
      checks.push({
        name: "capture-inbox",
        status: captures.captures.length > 0 ? "warn" : "pass",
        message: captures.captures.length > 0
          ? `${captures.captures.length} pending capture(s) require knowledge triage`
          : "No pending captures",
      });
    } catch (error) {
      checks.push({
        name: "capture-inbox",
        status: "fail",
        message: `Capture inbox is invalid: ${errorMessage(error)}`,
      });
    }
    try {
      const connections = await listRepositoryConnections(target);
      const registryIssues = await repositoryRegistryIssues(target);
      const active = connections.filter((entry) => Boolean(entry.activeRoot)).length;
      const checkouts = connections.reduce(
        (total, entry) => total + entry.checkouts.length,
        0,
      );
      checks.push({
        name: "repository-registry",
        status: registryIssues.length > 0
          ? "fail"
          : connections.length === 0
          ? "warn"
          : "pass",
        message: registryIssues.length > 0
          ? registryIssues.join("; ")
          : connections.length === 0
          ? "No leaf repositories registered; baseline reconstruction cannot start yet"
          : `${connections.length} repository registration(s), ${checkouts} known worktree(s), `
            + `${active} default reconstruction checkout(s)`
            + `${
              active < connections.length
                ? "; remaining selection is deferred until reconstruction starts"
                : ""
            }`,
      });
      // Baseline reconstruction drives Graphify from this repository, so a
      // knowledge checkout that already knows leaves needs the CLI even though
      // `wfctl init knowledge` deliberately does not require it.
      if (connections.length > 0) {
        const graphify = graphifyCliCheck({
          target,
          agents: config.skills?.agents ?? [],
          runner,
        });
        checks.push(
          graphify.status === "pass"
            ? { ...graphify, name: "graphify-reconstruction" }
            : {
              ...graphify,
              name: "graphify-reconstruction",
              status: "warn",
              message:
                "Graphify is not installed; baseline reconstruction of the registered "
                + "repositories cannot start until it is",
            },
        );
      }
    } catch (error) {
      checks.push({
        name: "repository-registry",
        status: "fail",
        message: errorMessage(error),
      });
    }
  } else {
    try {
      const connections = await listRepositoryConnections(knowledgeRoot);
      const currentRoot = await realpath(target);
      const connection = connections.find((entry) =>
        entry.checkouts.some((checkout) => resolve(checkout.root) === currentRoot)
      );
      const checkout = connection?.checkouts.find((entry) =>
        resolve(entry.root) === currentRoot
      );
      checks.push({
        name: "repository-connection",
        status: connection ? "pass" : "fail",
        message: connection
          ? repositoryConnectionMessage(connection.repository, checkout?.selection)
          : "Leaf checkout is unknown to the knowledge repository; run wfctl knowledge sources add",
      });
    } catch (error) {
      checks.push({
        name: "repository-connection",
        status: "fail",
        message: errorMessage(error),
      });
    }
  }

  try {
    const plan = await buildInstallPlan({
      target,
      profile: config.profile,
      ...(config.profile === "leaf" ? { knowledge: knowledgeRoot } : {}),
      ...(config.skills ? { skills: config.skills } : {}),
    });
    const conflicts = plan.operations.filter((operation) => operation.status === "conflict");
    const pending = plan.operations.filter((operation) =>
      operation.status === "create"
      || operation.status === "update"
      || operation.status === "delete"
    );
    if (conflicts.length > 0) {
      checks.push({
        name: "installation",
        status: "fail",
        message: `${conflicts.length} workflow conflict(s)`,
      });
    } else if (pending.length > 0) {
      checks.push({
        name: "installation",
        status: "warn",
        message: `${pending.length} workflow update(s) pending`,
      });
    } else {
      checks.push({
        name: "installation",
        status: "pass",
        message: "Workflow assets are current",
      });
    }
  } catch (error) {
    checks.push({ name: "installation", status: "fail", message: errorMessage(error) });
  }

  return { target, profile: config.profile, checks };
}

function repositoryConnectionMessage(
  repository: string,
  selection: "selected" | "deferred" | "alternative" | undefined,
): string {
  if (selection === "selected") {
    return `Leaf is registered as ${repository}; selected as its default reconstruction checkout`;
  }
  if (selection === "alternative") {
    return `Leaf is registered as ${repository}; available as an alternative reconstruction checkout`;
  }
  return `Leaf is registered as ${repository}; reconstruction checkout selection is deferred until reconstruction starts`;
}

async function graphifyScopeCheck(path: string, profile: Profile): Promise<DoctorCheck> {
  try {
    const content = await readFile(path, "utf8");
    const missing = graphifyIgnoreEntries(profile)
      .filter((entry) => !content.includes(entry));
    // A leaf installed before the scope narrowed still carries the blanket
    // entries, which over-exclude project files instead of leaving workflow
    // files in the graph. Name that as the upgrade it is, not as a failure.
    const blanket = [".agents/", ".claude/"]
      .filter((entry) => new RegExp(`^${entry.replace(".", "\\.")}$`, "m").test(content));
    if (blanket.length > 0) {
      return {
        name: "graphify-scope",
        status: "warn",
        message:
          `Graphify scope excludes all of ${blanket.join(" and ")}, which hides `
          + "project-authored skills and instructions from the source graph; run wfctl upgrade",
      };
    }
    return {
      name: "graphify-scope",
      status: missing.length === 0 ? "pass" : "fail",
      message: missing.length === 0
        ? "Only wfctl-installed files are excluded from the source graph"
        : `Graphify scope includes workflow artifacts; run wfctl upgrade (missing: ${missing.join(", ")})`,
    };
  } catch (error) {
    return {
      name: "graphify-scope",
      status: "fail",
      message: `Cannot verify .graphifyignore: ${errorMessage(error)}`,
    };
  }
}

async function knowledgeGraphCheck(
  target: string,
  expectedGraph: KnowledgeGraph,
): Promise<DoctorCheck> {
  const path = join(target, ".workflow/current/knowledge-graph.json");
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isDeepStrictEqual(value, expectedGraph)) {
      return {
        name: "knowledge-graph",
        status: "fail",
        message: "Knowledge graph is stale or invalid; run wfctl knowledge build",
      };
    }
    return {
      name: "knowledge-graph",
      status: "pass",
      message: "Deterministic knowledge graph matches the Markdown corpus",
    };
  } catch (error) {
    return {
      name: "knowledge-graph",
      status: "fail",
      message: isMissingFileError(error)
        ? "Knowledge graph is missing; run wfctl knowledge build"
        : `Cannot read knowledge graph: ${errorMessage(error)}`,
    };
  }
}

async function claimLedgerCheck(
  target: string,
  expectedLedger: ClaimLedger,
): Promise<DoctorCheck> {
  const path = join(target, ".workflow/current/claim-ledger.json");
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isDeepStrictEqual(value, expectedLedger)) {
      return {
        name: "claim-ledger",
        status: "fail",
        message: "Claim ledger is stale or invalid; run wfctl knowledge build",
      };
    }
    return {
      name: "claim-ledger",
      status: "pass",
      message: "Deterministic claim ledger matches intake and reconstruction cases",
    };
  } catch (error) {
    return {
      name: "claim-ledger",
      status: "fail",
      message: isMissingFileError(error)
        ? "Claim ledger is missing; run wfctl knowledge build"
        : `Cannot read claim ledger: ${errorMessage(error)}`,
    };
  }
}

export function doctorPassed(report: DoctorReport): boolean {
  return report.checks.every((check) => check.status !== "fail");
}

async function pathCheck(
  name: string,
  path: string,
  missingStatus: DoctorCheck["status"],
  presentMessage: string,
  missingMessage: string,
): Promise<DoctorCheck> {
  try {
    await access(path, constants.F_OK);
    return { name, status: "pass", message: presentMessage };
  } catch {
    return { name, status: missingStatus, message: missingMessage };
  }
}

function qmdHealthChecks(knowledgeRoot: string, runner: ToolRunner): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const status = runner("qmd", ["status"], {
    cwd: knowledgeRoot,
    env: { NO_COLOR: "1" },
  });
  if (status.status !== 0) {
    checks.push({
      name: "qmd-status",
      status: "fail",
      message: commandFailure(status),
    });
    checks.push({
      name: "qmd-bm25-index",
      status: "fail",
      message: "Cannot verify the lexical index until qmd status succeeds",
    });
  } else {
    const output = stripAnsi(`${status.stdout}\n${status.stderr}`);
    checks.push({
      name: "qmd-status",
      status: "pass",
      message: "Project-local QMD index opened successfully",
    });
    const documents = output.match(/Total:\s+(\d+)\s+files indexed/i)?.[1];
    const count = documents ? Number(documents) : undefined;
    checks.push({
      name: "qmd-bm25-index",
      status: count && count > 0 ? "pass" : "fail",
      message: count && count > 0
        ? `${count} document(s) are available to lexical search`
        : "No indexed documents found; run qmd update from the knowledge root",
    });
  }

  const doctor = runner("qmd", ["doctor"], {
    cwd: knowledgeRoot,
    env: {
      NO_COLOR: "1",
      QMD_DOCTOR_DEVICE_PROBE: "0",
    },
  });
  if (doctor.status !== 0) {
    checks.push({
      name: "qmd-doctor",
      status: "fail",
      message: commandFailure(doctor),
    });
    return checks;
  }

  const output = stripAnsi(`${doctor.stdout}\n${doctor.stderr}`);
  checks.push({
    name: "qmd-doctor",
    status: "pass",
    message: "QMD core diagnostics completed",
  });
  checks.push(qmdModelCacheCheck(output));
  checks.push(qmdDiagnosticLine(
    output,
    "qmd-embeddings",
    "embedding freshness",
    "Semantic embeddings are current",
    "Semantic embeddings are missing or stale; BM25 remains available",
  ));
  return checks;
}

export function qmdModelCacheCheck(output: string): DoctorCheck {
  const line = diagnosticLine(output, "model cache");
  if (!line) {
    return {
      name: "qmd-models",
      status: "warn",
      message:
        "Semantic models are not ready; BM25 remains available; "
        + "qmd doctor did not report model cache",
    };
  }
  if (line.trimStart().startsWith("✓") || isEtagOnlyModelCacheWarning(line)) {
    return {
      name: "qmd-models",
      status: "pass",
      message: "Semantic models are ready",
    };
  }
  return {
    name: "qmd-models",
    status: "warn",
    message: `Semantic models are not ready; BM25 remains available: ${line.trim()}`,
  };
}

function qmdDiagnosticLine(
  output: string,
  name: string,
  label: string,
  passMessage: string,
  warnMessage: string,
): DoctorCheck {
  const line = diagnosticLine(output, label);
  if (!line) {
    return {
      name,
      status: "warn",
      message: `${warnMessage}; qmd doctor did not report ${label}`,
    };
  }
  const passed = line.trimStart().startsWith("✓");
  return {
    name,
    status: passed ? "pass" : "warn",
    message: passed ? passMessage : `${warnMessage}: ${line.trim()}`,
  };
}

function diagnosticLine(output: string, label: string): string | undefined {
  return output.split("\n").find((candidate) =>
    candidate.toLowerCase().includes(`${label.toLowerCase()}:`)
  );
}

function isEtagOnlyModelCacheWarning(line: string): boolean {
  if (/\bmissing\s+\d+\//i.test(line)) {
    return false;
  }
  // QMD 2.5.3 writes GGUF ETag sidecars, then its doctor scans those metadata
  // files as if they were models. With no missing model, the real GGUF was found.
  const invalidPaths = [...line.matchAll(
    /\(([^()]+\.gguf(?:\.etag)?):\s+not valid GGUF/gi,
  )].map((match) => match[1]);
  return invalidPaths.length > 0
    && invalidPaths.every((path) => path?.toLowerCase().endsWith(".gguf.etag"));
}

async function graphifyGraphCheck(path: string): Promise<DoctorCheck> {
  try {
    const graph = JSON.parse(await readFile(path, "utf8")) as {
      nodes?: unknown[];
      links?: unknown[];
    };
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      return {
        name: "graphify-graph",
        status: "fail",
        message: "Graphify graph exists but contains no nodes",
      };
    }
    return {
      name: "graphify-graph",
      status: "pass",
      message: `Graphify graph is valid (${graph.nodes.length} nodes)`,
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        name: "graphify-graph",
        status: "fail",
        message:
          "Graphify graph has not been built for this checkout; run graphify update .",
      };
    }
    return {
      name: "graphify-graph",
      status: "fail",
      message: `Graphify graph is invalid: ${errorMessage(error)}`,
    };
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}
