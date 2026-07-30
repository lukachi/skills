import { Command } from "@cliffy/command";
import ora from "ora";
import {
  bold,
  cyan,
  dim,
  green,
  red,
  setColorEnabled,
  yellow,
} from "@jsr/std__fmt/colors";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { applyInstallPlan } from "./applier.js";
import {
  createConfig,
  errorMessage,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import {
  commandFailure,
  runInstallPreflight,
  updateGraphifyGraphAsync,
  updateQmdIndex,
} from "./dependencies.js";
import { doctorPassed, runDoctor } from "./doctor.js";
import { buildInstallPlan, summarizePlan } from "./planner.js";
import { installSkillsTransactional } from "./skill-installer.js";
import {
  beginIntakeCase,
  closeIntakeCase,
  inspectIntakeCase,
  inventoryRaw,
  markIntakeSource,
  migrateIntakeCase,
  recordIntakeProbe,
} from "./intake.js";
import { writeClaimLedger } from "./claim-ledger.js";
import { hashKnowledgeConcept, validateKnowledge } from "./knowledge.js";
import { writeKnowledgeGraph } from "./knowledge-graph.js";
import {
  addLeafRepository,
  ensureRepositoryRegistry,
  listRepositoryConnections,
  type ReconstructionSelection,
  selectLeafRepository,
} from "./repository-registry.js";
import { initializeGitRepository, isGitRepository } from "./git.js";
import {
  beginProjectReconstruction,
  closeProjectReconstruction,
  inspectProjectReconstruction,
  inspectReconstructionCoverage,
  markReconstructionCommunity,
  markReconstructionFiles,
  readReconstructionSource,
  recordReconstructionSurface,
  reviewReconstructionSurfaces,
} from "./reconstruction.js";
import type {
  CoverageState,
  CoverageSummary,
  FileCategory,
  SurfaceKind,
} from "./reconstruction-coverage.js";
import type {
  AgentTarget,
  DoctorCheck,
  DoctorReport,
  InstallPlan,
  OperationStatus,
  Profile,
  SkillScope,
  WorkMode,
  WorkOutcome,
} from "./types.js";
import { WORKFLOW_VERSION } from "./types.js";
import {
  beginWork,
  closeWork,
  createHandoff,
  rebindWork,
  verifyWork,
  workStatus,
} from "./work.js";
import {
  findDistributionRoot,
  renderAgentInstructions,
  renderMaintainerGuide,
} from "./assets.js";

setColorEnabled(process.stdout.isTTY === true && !("NO_COLOR" in process.env));

const main = new Command()
  .name("wfctl")
  .version(WORKFLOW_VERSION)
  .description(
    "Install and operate a shared project workflow.\n"
      + "Maintainers normally use init; installed agents own the remaining commands.\n\n"
      + "Setup:\n"
      + "  init       Install or repair a knowledge or leaf repository\n"
      + "  check      Validate the current workflow installation\n\n"
      + "Maintenance:\n"
      + "  upgrade    Upgrade installed rules, skills, templates, and guides\n\n"
      + "Knowledge operations:\n"
      + "  knowledge  Process raw input, validate knowledge, and build its graph\n\n"
      + "Project work:\n"
      + "  work       Create handoffs or start, verify, and close change records",
  )
  .throwErrors()
  .command("init", initCommand())
  .command("check", checkCommand())
  .command("upgrade", upgradeCommand())
  .command("knowledge", knowledgeCommand())
  .command("work", workCommand());

try {
  await main.parse(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`wfctl: ${errorMessage(error)}\n`);
  process.exitCode = 1;
}

function initCommand() {
  return new Command()
    .description(
      "Install or repair a workflow environment.\n"
        + "Repository kind: knowledge (central knowledge base) or leaf (source checkout).\n"
        + "Previews files and dependencies; failed preflight writes nothing.",
    )
    .arguments("[knowledge|leaf:string]")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("-k, --knowledge <path:string>", "Knowledge repository for a leaf.")
    .option("-s, --skills <scope:string>", "Skill scope: project, user, or none.")
    .option("-a, --agents <agents:string>", "Skill targets: codex, claude, or both.")
    .option(
      "--print-instructions <artifact:string>",
      "Print agents or guide content for manual integration, then exit.",
    )
    .option("--dry-run", "Preview files and dependency checks without applying them.")
    .option(
      "--init-git",
      "Initialize Git when creating a knowledge repository.",
    )
    .option("-y, --yes", "Accept defaults and safe changes without prompting.")
    .option("--json", "Print machine-readable output; use with --dry-run or --yes.")
    .action(async (options, profileValue) => {
      const target = resolve(options.target);
      const promptOptions = {
        yes: options.yes === true,
        json: options.json === true,
      };
      const profile = await resolveProfile(profileValue, target, promptOptions);
      let knowledge = options.knowledge
        ? resolve(options.knowledge)
        : await installedKnowledgePath(target, profile);
      if (
        profile === "leaf"
        && !knowledge
        && !promptOptions.yes
        && !promptOptions.json
        && interactive()
      ) {
        const answer = await ask("Knowledge repository path: ");
        if (answer) {
          knowledge = resolve(answer);
        }
      }
      if (options.printInstructions) {
        await printInstructions(
          options.printInstructions,
          target,
          profile,
          knowledge,
        );
        return;
      }
      const initializeGit = await resolveGitInitialization({
        target,
        profile,
        requested: options.initGit === true,
        dryRun: options.dryRun === true,
        ...promptOptions,
      });
      const preferences = await resolveInstallPreferences({
        ...(options.skills ? { skills: options.skills } : {}),
        ...(options.agents ? { agents: options.agents } : {}),
        ...promptOptions,
      });
      await installWorkflow({
        target,
        profile,
        ...(knowledge ? { knowledge } : {}),
        ...preferences,
        initializeGit,
        dryRun: options.dryRun === true,
        yes: options.yes === true,
        json: options.json === true,
      });
    });
}

function upgradeCommand() {
  return new Command()
    .description("Preview dependencies and upgrade an existing workflow installation.")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("-s, --skills <scope:string>", "Change skill scope: project, user, or none.")
    .option("-a, --agents <agents:string>", "Change skill targets: codex, claude, or both.")
    .option("--dry-run", "Preview files and dependency checks without applying them.")
    .option("-y, --yes", "Accept safe changes without prompting.")
    .option("--json", "Print machine-readable output; use with --dry-run or --yes.")
    .action(async (options) => {
      const target = resolve(options.target);
      const config = await readConfig(target);
      const scope = options.skills
        ? parseSkillScope(options.skills)
        : config.skills?.scope ?? "project";
      const agents = options.agents
        ? parseAgentTargets(options.agents)
        : config.skills?.agents ?? ["codex", "claude"];
      const knowledge = config.profile === "leaf"
        ? resolveKnowledgeRoot(target, config)
        : undefined;
      await installWorkflow({
        target,
        profile: config.profile,
        ...(knowledge ? { knowledge } : {}),
        scope,
        agents,
        dryRun: options.dryRun === true,
        yes: options.yes === true,
        json: options.json === true,
      });
    });
}

async function installWorkflow(input: {
  target: string;
  profile: Profile;
  knowledge?: string;
  scope: SkillScope;
  agents: AgentTarget[];
  initializeGit?: boolean;
  dryRun: boolean;
  yes: boolean;
  json: boolean;
}): Promise<void> {
  if (input.json && !input.dryRun && !input.yes) {
    throw new Error("--json requires --dry-run or --yes");
  }
  const distributionRoot = await findDistributionRoot();
  const plan = await buildInstallPlan({
    target: input.target,
    profile: input.profile,
    ...(input.knowledge ? { knowledge: input.knowledge } : {}),
    distributionRoot,
    skills: { scope: input.scope, agents: input.agents },
  });
  const preflight = runInstallPreflight({
    target: input.target,
    profile: input.profile,
    ...(input.knowledge ? { knowledge: input.knowledge } : {}),
    initializeGit: input.initializeGit === true,
    requireQmdSkill: input.scope !== "none",
  });
  const preflightPassed = preflight.every((check) => check.status !== "fail");

  if (input.dryRun) {
    if (input.json) {
      printJson({
        ...summarizePlan(plan),
        skills: skillSummary(input),
        preflight,
        applied: false,
      });
    } else {
      printPlan(plan);
      printSkillSummary(input);
      printDependencyChecks(preflight);
    }
    if (
      !preflightPassed
      || plan.operations.some((operation) => operation.status === "conflict")
    ) {
      process.exitCode = 2;
    }
    return;
  }

  if (!input.json) {
    printPlan(plan);
    printSkillSummary(input);
    printDependencyChecks(preflight);
  }
  if (!preflightPassed) {
    if (input.json) {
      printJson({
        ...summarizePlan(plan),
        skills: skillSummary(input),
        preflight,
        applied: false,
      });
    }
    process.exitCode = 2;
    return;
  }
  const resolved = await resolveConflicts(plan, input.yes || input.json);
  if (!input.yes && !input.json && !await confirm("Continue with installation?")) {
    throw new Error("Installation stopped by user");
  }
  if (input.initializeGit && !isGitRepository(input.target)) {
    initializeGitRepository(input.target);
  }

  const skillTransaction = installSkillsTransactional({
    target: input.target,
    distributionRoot,
    profile: input.profile,
    scope: input.scope,
    agents: input.agents,
    yes: input.yes || input.json,
  });
  let applied: Awaited<ReturnType<typeof applyInstallPlan>>;
  try {
    applied = await applyInstallPlan(resolved);
    skillTransaction.commit();
  } catch (error) {
    skillTransaction.rollback();
    throw error;
  }
  const repositoryCheckout = input.profile === "knowledge"
    ? (await ensureRepositoryRegistry(input.target), undefined)
    : await addLeafRepository(input.knowledge!, input.target);
  const graphifyUpdate = input.profile === "leaf"
    ? await refreshGraphifyGraph(input.target, input.json)
    : undefined;
  if (input.profile === "knowledge") {
    const validation = await validateKnowledge(input.target);
    if (validation.valid) {
      await writeClaimLedger(input.target);
      await writeKnowledgeGraph(input.target);
    }
  }
  const qmdUpdate = input.profile === "knowledge"
    ? updateQmdIndex(input.target)
    : undefined;
  const report = await runDoctor(input.target);
  if (graphifyUpdate) {
    report.checks.push({
      name: "graphify-update",
      status: graphifyUpdate.status === 0 ? "pass" : "fail",
      message: graphifyUpdate.status === 0
        ? "Checkout-local Graphify graph refreshed"
        : `Graphify graph refresh failed: ${commandFailure(graphifyUpdate)}`,
    });
  }
  if (qmdUpdate) {
    report.checks.push({
      name: "qmd-update",
      status: qmdUpdate.status === 0 ? "pass" : "fail",
      message: qmdUpdate.status === 0
        ? "Project-local QMD lexical index refreshed"
        : `QMD index refresh failed: ${commandFailure(qmdUpdate)}`,
    });
  }

  if (input.json) {
    printJson({
      ...summarizePlan(resolved),
      skills: skillSummary(input),
      preflight,
      applied,
      check: report,
      ...(repositoryCheckout ? { repositoryCheckout } : {}),
    });
  } else {
    process.stdout.write(
      `\n${green("✓")} ${bold("Workflow installed")}\n`
        + `  ${dim("Target")}  ${resolved.target}\n`
        + `  ${dim("Changes")} ${applied.changed}\n`
        + `  ${dim("Guide")}   ${resolve(resolved.target, "PROJECT_WORKFLOW.md")}\n`,
    );
    if (repositoryCheckout) {
      process.stdout.write(
        `\n${bold("Repository connection")}\n`
          + `  ${repositoryCheckout.repository} (${repositoryCheckout.worktreeId})\n`
          + `  ${dim("Knowledge")} ${repositoryCheckout.knowledgeRoot}\n`
          + `\n${bold("Reconstruction source")}\n`
          + reconstructionSourceMessage(
            repositoryCheckout.repository,
            repositoryCheckout.selection,
          ),
      );
    }
    for (const backup of applied.backups) {
      process.stdout.write(`  ${yellow("!")} Backup created: ${backup}\n`);
    }
    printCheck(report);
  }
  if (!doctorPassed(report)) {
    process.exitCode = 2;
  }
}

async function refreshGraphifyGraph(
  target: string,
  quiet: boolean,
) {
  if (quiet) {
    return await updateGraphifyGraphAsync(target);
  }

  const pending = "Building source graph with Graphify — this may take a minute";
  if (!process.stdout.isTTY) {
    process.stdout.write(`\n${cyan("…")} ${pending}\n`);
    const result = await updateGraphifyGraphAsync(target);
    process.stdout.write(
      result.status === 0
        ? `${green("✓")} Source graph ready\n`
        : `${red("✗")} Source graph build failed\n`,
    );
    return result;
  }

  const spinner = ora({ text: pending, stream: process.stdout }).start();
  const result = await updateGraphifyGraphAsync(target);
  if (result.status === 0) {
    spinner.succeed("Source graph ready");
  } else {
    spinner.fail("Source graph build failed");
  }
  return result;
}

async function resolveConflicts(
  plan: InstallPlan,
  nonInteractive: boolean,
): Promise<InstallPlan> {
  const conflicts = plan.operations.filter((operation) =>
    operation.status === "conflict"
  );
  if (conflicts.length === 0) {
    return plan;
  }
  const hard = conflicts.filter((operation) => !operation.replaceable);
  if (hard.length > 0) {
    throw new Error(
      `Resolve structural conflict(s) before installation: ${
        hard.map((operation) => operation.path).join(", ")
      }`,
    );
  }
  if (nonInteractive) {
    throw new Error(
      `Refusing non-interactive replacement of conflict(s): ${
        conflicts.map((operation) => operation.path).join(", ")
      }`,
    );
  }

  for (const operation of conflicts) {
    const replace = await confirm(
      `Replace ${operation.path} with the canonical version after creating a backup?`,
    );
    if (!replace) {
      throw new Error(`Installation stopped at conflict: ${operation.path}`);
    }
    operation.status = operation.kind === "delete" ? "delete" : "update";
    operation.reason = "explicit replacement with backup";
    operation.backup = true;
  }
  return plan;
}

function checkCommand() {
  return new Command()
    .description("Validate a workflow installation and its required dependencies.")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const report = await runDoctor(options.target);
      if (options.json) {
        printJson(report);
      } else {
        printCheck(report);
      }
      if (!doctorPassed(report)) {
        process.exitCode = 2;
      }
    });
}

function workCommand() {
  return new Command()
    .description("Manage central change records bound to exact leaf checkouts.")
    .command(
      "handoff",
      new Command()
        .description(
          "Create a lightweight, non-authoritative inbox handoff from a leaf or knowledge repository.",
        )
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Workflow repository.", { default: "." })
        .option("--title <title:string>", "Human-readable handoff title.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const result = await createHandoff({
            target: options.target,
            slug,
            title: options.title,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Created ${result.id}\n`
                + (result.codeRoot ? `Code root: ${result.codeRoot}\n` : "")
                + `Knowledge root: ${result.knowledgeRoot}\n`
                + `Handoff: ${result.path}\n`,
            );
          }
        }),
    )
    .command(
      "start",
      new Command()
        .description("Start a shaping record before significant-task discussion continues.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Leaf checkout.", { default: "." })
        .option("--title <title:string>", "Human-readable work title.", { required: true })
        .option("--mode <mode:string>", "full or slice.", { default: "full" })
        .option(
          "--leaf <path:string>",
          "Leaf checkout for project-wide or multi-repository work started from knowledge; repeat as needed.",
          { collect: true },
        )
        .option("--knowledge-ref <path:string>", "Already-reviewed curated concept, if known.")
        .option("--graph-query <query:string>", "Already-run Graphify query, if available.")
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const result = await beginWork({
            target: options.target,
            slug,
            title: options.title,
            mode: parseWorkMode(options.mode),
            leaves: Array.isArray(options.leaf)
              ? options.leaf
              : options.leaf
              ? [options.leaf]
              : [],
            ...(options.knowledgeRef ? { knowledgeRef: options.knowledgeRef } : {}),
            ...(options.graphQuery ? { graphQuery: options.graphQuery } : {}),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Created ${result.id}\n`
                + `Scope: ${result.scope}\n`
                + `Code roots: ${
                  result.codeRoots.length > 0 ? result.codeRoots.join(", ") : "none"
                }\n`
                + `Knowledge root: ${result.knowledgeRoot}\n`
                + `Spec: ${result.specPath}\n`
                + `Bindings: ${result.pointerPaths.join(", ")}\n`,
            );
          }
        }),
    )
    .command(
      "status",
      new Command()
        .description("Show and validate the code-root/spec binding.")
        .arguments("[id:string]")
        .option("-t, --target <path:string>", "Leaf checkout.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const results = await workStatus(options.target, id);
          if (options.json) {
            printJson(results);
          } else if (results.length === 0) {
            process.stdout.write("No active work records for this checkout.\n");
          } else {
            for (const result of results) {
              process.stdout.write(
                `${result.valid ? "VALID" : "INVALID"} ${result.id}\n`
                  + `Scope: ${result.scope}\n`
                  + `Code roots: ${
                    result.codeRoots.length > 0 ? result.codeRoots.join(", ") : "none"
                  }\n`
                  + `Knowledge root: ${result.knowledgeRoot}\n`
                  + `Spec: ${result.specPath}\n`,
              );
              for (const source of result.currentSources) {
                process.stdout.write(
                  `- ${source.repository}: ${source.worktreeId} (${source.branch}) `
                    + `${source.commit} (${source.dirty ? "dirty" : "clean"})\n`,
                );
              }
              for (const issue of result.issues) {
                process.stdout.write(`- ${issue}\n`);
              }
            }
          }
          if (results.some((result) => !result.valid)) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "rebind",
      new Command()
        .description(
          "Explicitly move one repository binding to the current worktree or branch.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Replacement leaf checkout.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await rebindWork(options.target, id);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Rebound ${result.repository} for ${result.id}\n`
                + `From: ${result.previousRoot}\n`
                + `To: ${result.currentRoot} (${result.worktreeId}, ${result.branch})\n`,
            );
          }
        }),
    )
    .command(
      "verify",
      new Command()
        .description("Check the structural completion gate for a bound change record.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Bound leaf checkout.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await verifyWork(options.target, id);
          if (options.json) {
            printJson(result);
          } else if (result.issues.length === 0) {
            process.stdout.write(`Structural gate passed: ${result.specPath}\n`);
          } else {
            process.stdout.write(`Structural gate failed: ${result.specPath}\n`);
            for (const issue of result.issues) {
              process.stdout.write(`- ${issue}\n`);
            }
          }
          if (result.issues.length > 0) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "close",
      new Command()
        .description("Archive a bound change record after its required gates pass.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Bound leaf checkout.", { default: "." })
        .option("--outcome <outcome:string>", "completed, partial, or abandoned.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await closeWork({
            target: options.target,
            id,
            outcome: parseOutcome(options.outcome),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Closed ${result.id} as ${result.outcome}\n`
                + `Archive: ${result.archivePath}\n`,
            );
          }
        }),
    );
}

function knowledgeCommand() {
  return new Command()
    .description(
      "Operate the knowledge trust boundary.\n"
        + "raw/ is untrusted intake; reconstruction maps pinned leaves; knowledge/ is curated truth.\n"
        + "wfctl validates and compiles explicit knowledge and claim relations; QMD provides semantic retrieval.",
    )
    .command("raw", knowledgeRawCommand())
    .command("case", knowledgeCaseCommand())
    .command("sources", knowledgeSourcesCommand())
    .command("reconstruct", knowledgeReconstructCommand())
    .command(
      "hash",
      new Command()
        .description(
          "Compute the content hash used to bind a verification event to one concept revision.",
        )
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--concept <path:string>", "Curated concept path.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await hashKnowledgeConcept(options.target, options.concept);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(`${result.contentHash}  ${result.path}\n`);
          }
        }),
    )
    .command(
      "validate",
      new Command()
        .description("Validate curated knowledge against the strict workflow trust profile.")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--concept <path:string>", "Validate one concept path.", { collect: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const concepts = Array.isArray(options.concept)
            ? options.concept
            : options.concept
            ? [options.concept]
            : undefined;
          const result = await validateKnowledge(options.target, concepts);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Curated knowledge: ${result.valid ? "valid" : "invalid"} (${result.files} file(s))\n`,
            );
            for (const issue of result.errors) {
              process.stdout.write(`ERROR ${issue.path}: ${issue.message}\n`);
            }
            for (const issue of result.warnings) {
              process.stdout.write(`WARN  ${issue.path}: ${issue.message}\n`);
            }
          }
          if (!result.valid) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "build",
      new Command()
        .description(
          "Validate curated knowledge and compile deterministic knowledge plus claim graphs.",
        )
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const validation = await validateKnowledge(options.target);
          if (!validation.valid) {
            if (options.json) {
              printJson({ built: false, validation });
            } else {
              process.stdout.write(
                `Knowledge graph not built: ${validation.errors.length} validation error(s)\n`,
              );
              for (const issue of validation.errors) {
                process.stdout.write(`ERROR ${issue.path}: ${issue.message}\n`);
              }
              for (const issue of validation.warnings) {
                process.stdout.write(`WARN  ${issue.path}: ${issue.message}\n`);
              }
            }
            process.exitCode = 2;
            return;
          }
          const claims = await writeClaimLedger(options.target);
          const result = await writeKnowledgeGraph(options.target);
          if (options.json) {
            printJson({
              built: true,
              path: result.path,
              contentHash: result.graph.contentHash,
              stats: result.graph.stats,
              claimLedger: {
                path: claims.path,
                contentHash: claims.ledger.contentHash,
                stats: claims.ledger.stats,
              },
              warnings: result.warnings,
            });
          } else {
            process.stdout.write(
              `Knowledge graph built: ${result.path}\n`
                + `Nodes: ${result.graph.stats.nodes}; edges: ${result.graph.stats.edges}; `
                + `concepts: ${result.graph.stats.concepts}\n`
                + `Claim ledger built: ${claims.path}\n`
                + `Claims: ${claims.ledger.stats.claims}; `
                + `relations: ${claims.ledger.stats.edges}\n`,
            );
            for (const issue of result.warnings) {
              process.stdout.write(`WARN  ${issue.path}: ${issue.message}\n`);
            }
          }
        }),
    );
}

function knowledgeReconstructCommand() {
  return new Command()
    .description(
      "Build or audit project knowledge from exact clean leaf revisions.\n"
        + "Local worktree paths stay in ignored runtime bindings; durable records pin repository identity and commit.",
    )
    .command(
      "start",
      new Command()
        .description(
          "Bind clean leaves, refresh Graphify, and freeze dossiers plus complete coverage ledgers.",
        )
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--title <title:string>", "Human-readable reconstruction question.", {
          required: true,
        })
        .option("--mode <mode:string>", "baseline or audit.", { default: "baseline" })
        .option(
          "--leaf <path:string>",
          "Override registered checkout selection; repeat per source repository. Baselines still require all registered repositories.",
          { collect: true },
        )
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const leaves = Array.isArray(options.leaf)
            ? options.leaf
            : options.leaf
            ? [options.leaf]
            : [];
          if (options.mode !== "baseline" && options.mode !== "audit") {
            throw new Error(
              `Invalid reconstruction mode "${options.mode}"; expected baseline or audit`,
            );
          }
          const result = await beginProjectReconstruction({
            target: options.target,
            slug,
            title: options.title,
            mode: options.mode,
            leaves,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Created ${result.mode} reconstruction ${result.id}\n`
                + `Case: ${result.path}\n`
                + `Repositories: ${result.repositories.length}\n`,
            );
            for (const repository of result.repositories) {
              process.stdout.write(
                `- ${repository.repository}@${repository.commit} `
                  + `(${repository.trackedFiles} tracked files; `
                  + `${repository.graphNodes} graph nodes)\n`
                  + `  Dossier: ${repository.dossier}\n`
                  + `  Coverage: ${repository.coverage}\n`,
              );
            }
          }
        }),
    )
    .command(
      "coverage",
      new Command()
        .description(
          "Show complete Git-file, Graphify-community, and runtime-surface coverage.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity; omit to show all.")
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await inspectReconstructionCoverage(
            options.target,
            id,
            options.repository,
          );
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(`Reconstruction coverage ${result.id}\n`);
            for (const repository of result.repositories) {
              printCoverageSummary(repository, true);
            }
          }
        }),
    )
    .command(
      "read",
      new Command()
        .description(
          "Read a bounded range from an exact pinned Git blob and record the receipt.",
        )
        .arguments("<id:string> <path:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity.")
        .option("--start <line:string>", "First one-based line.")
        .option("--end <line:string>", "Last one-based line; at most 400 lines per read.")
        .option("--by <actor:string>", "Reading agent actor.", {
          default: "workflow-agent/1",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, path) => {
          const result = await readReconstructionSource({
            target: options.target,
            id,
            path,
            ...(options.repository === undefined
              ? {}
              : { repository: options.repository }),
            ...(options.start === undefined
              ? {}
              : { startLine: parseLineNumber(options.start, "--start") }),
            ...(options.end === undefined
              ? {}
              : { endLine: parseLineNumber(options.end, "--end") }),
            actor: options.by,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `${result.repository}@${result.commit} ${result.path} `
                + `lines ${result.startLine}-${result.endLine}/${result.totalLines} `
                + `[${result.complete ? "complete" : "more remains"}]\n`,
            );
            if (result.content) {
              const width = String(result.endLine).length;
              for (
                const [offset, line] of result.content.split("\n").entries()
              ) {
                process.stdout.write(
                  `${String(result.startLine + offset).padStart(width)} | ${line}\n`,
                );
              }
            }
          }
        }),
    )
    .command(
      "files",
      new Command()
        .description(
          "Classify or disposition manifest files by exact path, directory, or wildcard glob.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity.")
        .option("--path <pattern:string>", "Manifest path pattern; repeat as needed.", {
          collect: true,
          required: true,
        })
        .option(
          "--category <category:string>",
          "source, test, contract, configuration, product-data, documentation, generated, binary-asset, vendor, submodule, other.",
        )
        .option(
          "--status <status:string>",
          "pending, inspected, structural-only, irrelevant, or blocked.",
        )
        .option("--reason <text:string>", "Required for non-inspected final states.")
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const paths = collectedStrings(options.path);
          const result = await markReconstructionFiles({
            target: options.target,
            id,
            paths,
            ...(options.repository === undefined
              ? {}
              : { repository: options.repository }),
            ...(options.category === undefined
              ? {}
              : { category: options.category as FileCategory }),
            ...(options.status === undefined
              ? {}
              : { status: options.status as CoverageState }),
            ...(options.reason === undefined ? {} : { reason: options.reason }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Updated ${result.matched} manifest file(s) in ${result.repository}\n`,
            );
            printCoverageSummary(result.summary);
          }
        }),
    )
    .command(
      "community",
      new Command()
        .description("Record the disposition of one Graphify community.")
        .arguments("<id:string> <community:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity.")
        .option("--status <status:string>", "inspected, structural-only, irrelevant, or blocked.", {
          required: true,
        })
        .option("--note <text:string>", "Finding or explicit no-product-mapping reason.", {
          required: true,
        })
        .option("--query <text:string>", "Material Graphify query; repeat.", {
          collect: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, community) => {
          const result = await markReconstructionCommunity({
            target: options.target,
            id,
            community,
            status: options.status as CoverageState,
            note: options.note,
            queries: collectedStrings(options.query),
            ...(options.repository === undefined
              ? {}
              : { repository: options.repository }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Updated Graphify community ${community} in ${result.repository}\n`,
            );
            printCoverageSummary(result.summary);
          }
        }),
    )
    .command(
      "surface",
      new Command()
        .description(
          "Record one discovered entrypoint, runtime surface, or boundary.",
        )
        .arguments("<id:string> <surface:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity.")
        .option("--kind <kind:string>", "entrypoint, runtime, or boundary.", {
          required: true,
        })
        .option("--description <text:string>", "What the surface exposes.", {
          required: true,
        })
        .option("--path <path:string>", "Exact manifest path; repeat.", {
          collect: true,
          required: true,
        })
        .option("--status <status:string>", "inspected, structural-only, irrelevant, or blocked.", {
          required: true,
        })
        .option("--note <text:string>", "Inspection result.", { required: true })
        .option("--candidate <id:string>", "Linked candidate claim ID; repeat.", {
          collect: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, surface) => {
          const result = await recordReconstructionSurface({
            target: options.target,
            id,
            surface,
            kind: options.kind as SurfaceKind,
            description: options.description,
            paths: collectedStrings(options.path),
            status: options.status as CoverageState,
            note: options.note,
            candidateIds: collectedStrings(options.candidate),
            ...(options.repository === undefined
              ? {}
              : { repository: options.repository }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Recorded ${options.kind} ${surface} in ${result.repository}\n`,
            );
            printCoverageSummary(result.summary);
          }
        }),
    )
    .command(
      "surfaces",
      new Command()
        .description(
          "Finalize the repository-wide entrypoint and runtime-surface audit.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <id:string>", "Repository identity.")
        .option("--status <status:string>", "reviewed, not-relevant, or blocked.", {
          required: true,
        })
        .option("--note <text:string>", "Whole-repository surface audit result.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          if (!["reviewed", "not-relevant", "blocked"].includes(options.status)) {
            throw new Error(
              `Invalid surface audit status "${options.status}"`,
            );
          }
          const result = await reviewReconstructionSurfaces({
            target: options.target,
            id,
            status: options.status as "reviewed" | "not-relevant" | "blocked",
            note: options.note,
            ...(options.repository === undefined
              ? {}
              : { repository: options.repository }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Finalized surface audit as ${options.status} in ${result.repository}\n`,
            );
            printCoverageSummary(result.summary);
          }
        }),
    )
    .command(
      "check",
      new Command()
        .description(
          "Verify bindings, complete coverage, claims, raw convergence, promotion, and review.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await inspectProjectReconstruction(options.target, id);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Reconstruction gate ${result.issues.length === 0 ? "passed" : "failed"}: `
                + `${result.path}\n`
                + `Repositories reviewed: ${result.reviewed}/${result.repositories}; `
                + `candidates: ${result.candidates}\n`,
            );
            for (const issue of result.issues) {
              process.stdout.write(`- ${issue}\n`);
            }
          }
          if (result.issues.length > 0) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "close",
      new Command()
        .description("Archive a reconstruction with its honest outcome.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--outcome <outcome:string>", "completed, partial, or abandoned.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await closeProjectReconstruction({
            target: options.target,
            id,
            outcome: parseOutcome(options.outcome),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Closed ${result.id} as ${result.outcome}\n`
                + `Archive: ${result.archivePath}\n`,
            );
          }
        }),
    );
}

function knowledgeSourcesCommand() {
  return new Command()
    .description(
      "Register leaf worktrees and select one default reconstruction checkout per repository.",
    )
    .command(
      "add",
      new Command()
        .description(
          "Add or refresh one known leaf checkout without changing the selected default.",
        )
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--leaf <path:string>", "Initialized leaf checkout.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await addLeafRepository(options.target, options.leaf);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Registered checkout for ${result.repository}\n`
                + `Checkout: ${result.root}\n`
                + `Worktree: ${result.worktreeId} (${result.branch})\n`
                + `Revision: ${result.commit}\n`
                + `\n${bold("Reconstruction source")}\n`
                + reconstructionSourceMessage(result.repository, result.selection),
            );
          }
        }),
    )
    .command(
      "select",
      new Command()
        .description(
          "Select one previously added worktree as the default reconstruction checkout.",
        )
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--leaf <path:string>", "Previously added leaf checkout.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await selectLeafRepository(options.target, options.leaf);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Selected default checkout for ${result.repository}\n`
                + `Checkout: ${result.root}\n`
                + `Worktree: ${result.worktreeId} (${result.branch})\n`
                + `Revision at selection: ${result.commit}\n`
                + `\n${bold("Reconstruction source")}\n`
                + reconstructionSourceMessage(result.repository, result.selection),
            );
          }
        }),
    )
    .command(
      "list",
      new Command()
        .description("List every known worktree and show the default reconstruction checkout.")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await listRepositoryConnections(options.target);
          if (options.json) {
            printJson(result);
          } else if (result.length === 0) {
            process.stdout.write(
              "No leaf repositories registered. Initialize leaves with --knowledge or use sources add.\n",
            );
          } else {
            for (const entry of result) {
              process.stdout.write(
                `${entry.connected ? "REGISTERED" : "NO CHECKOUTS"} ${entry.repository}\n`,
              );
              for (const checkout of entry.checkouts) {
                const selection = checkout.selection === "selected"
                  ? "SELECTED    "
                  : checkout.selection === "alternative"
                  ? "ALTERNATIVE "
                  : "AVAILABLE   ";
                process.stdout.write(
                  `  ${selection}${checkout.available ? "READY   " : "MISSING "} `
                    + `${checkout.root} (${checkout.worktreeId})`
                    + `${
                      checkout.branch
                        ? ` ${checkout.branch}@${checkout.commit}`
                        : ""
                    }\n`,
                );
              }
              if (entry.checkouts.length > 0 && !entry.activeRoot) {
                process.stdout.write(
                  "  Selection is not required yet; the agent will choose when reconstruction starts.\n",
                );
              }
            }
          }
        }),
    );
}

function reconstructionSourceMessage(
  repository: string,
  selection: ReconstructionSelection,
): string {
  if (selection === "selected") {
    return `  ${green("✓")} Selected as the default checkout for ${repository}.\n`;
  }
  if (selection === "alternative") {
    return `  ${cyan("○")} Registered as an alternative checkout.\n`
      + `    ${dim("Another worktree is currently selected.")}\n`;
  }
  return `  ${cyan("○")} Registered; selection is not required yet.\n`
    + `    ${dim("The agent will select a checkout when reconstruction starts.")}\n`;
}

function knowledgeRawCommand() {
  return new Command()
    .description("Inventory committed raw blobs without interpreting their meaning.")
    .command(
      "inventory",
      new Command()
        .description("Classify each raw path and Git blob against intake case coverage.")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--baseline <commitish:string>", "Git baseline.", { default: "HEAD" })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await inventoryRaw({
            target: options.target,
            baseline: options.baseline,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Raw inventory at ${result.baseline}\n`
                + `Committed files: ${result.entries.length}\n`,
            );
            for (const entry of result.entries) {
              process.stdout.write(
                `${entry.state.padEnd(18)} ${entry.path} ${entry.objectId}\n`,
              );
            }
            if (result.uncommitted.length > 0) {
              process.stdout.write("Uncommitted raw paths (commit before intake):\n");
              for (const path of result.uncommitted) {
                process.stdout.write(`- ${path}\n`);
              }
            }
          }
        }),
    );
}

function knowledgeCaseCommand() {
  return new Command()
    .description("Manage bounded raw-intake cases frozen to exact Git blobs.")
    .command(
      "start",
      new Command()
        .description("Freeze a Git-tracked raw scope and create its review ledger.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--title <title:string>", "Human-readable bounded topic.", { required: true })
        .option("--baseline <commitish:string>", "Git baseline.", { default: "HEAD" })
        .option(
          "--path <path:string>",
          "Tracked path under raw/; repeat to define the scope. Defaults to raw/.",
          { collect: true },
        )
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const paths = Array.isArray(options.path)
            ? options.path
            : options.path
            ? [options.path]
            : undefined;
          const result = await beginIntakeCase({
            target: options.target,
            slug,
            title: options.title,
            baseline: options.baseline,
            ...(paths ? { paths } : {}),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Created ${result.id}\n`
                + `Case: ${result.path}\n`
                + `Baseline: ${result.baseline}\n`
                + `Files: ${result.files}\n`,
            );
          }
        }),
    )
    .command(
      "mark",
      new Command()
        .description("Record the complete review result for one frozen source file.")
        .arguments("<id:string> <path:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option(
          "--status <status:string>",
          "reviewed, no-relevant-claims, needs-maintainer, or unreadable.",
          { required: true },
        )
        .option("--candidate <id:string>", "Candidate claim ID; repeat as needed.", {
          collect: true,
        })
        .option("--note <text:string>", "Full-file review result.", { required: true })
        .option("--by <actor:string>", "Reviewing agent actor.", {
          default: "workflow-agent/1",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, path) => {
          const candidateIds = Array.isArray(options.candidate)
            ? options.candidate
            : options.candidate
            ? [options.candidate]
            : [];
          const result = await markIntakeSource({
            target: options.target,
            id,
            path,
            status: options.status,
            candidateIds,
            note: options.note,
            reviewedBy: options.by,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Marked ${result.path} as ${result.status} in ${result.id}\n`,
            );
          }
        }),
    )
    .command(
      "migrate",
      new Command()
        .description(
          "Upgrade an active v3 intake case to v4, or sign its semantic migration review.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--review", "Confirm that all generated v4 classifications were reviewed.")
        .option("--note <text:string>", "Migration review result.")
        .option("--by <actor:string>", "Reviewing agent actor.", {
          default: "workflow-agent/1",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await migrateIntakeCase({
            target: options.target,
            id,
            review: options.review === true,
            reviewedBy: options.by,
            ...(options.note === undefined ? {} : { note: options.note }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Intake case ${result.id}: v${result.fromVersion} -> v${result.version}\n`
                + `Migration: ${result.migrationStatus}\n`
                + `Case: ${result.path}\n`,
            );
          }
        }),
    )
    .command(
      "probe",
      new Command()
        .description(
          "Upsert one omission probe after testing routed durable outputs without raw input.",
        )
        .arguments("<id:string> <probe-id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--question <text:string>", "Diagnostic question.", { required: true })
        .option("--candidate <id:string>", "Expected candidate ID; repeat.", {
          collect: true,
          required: true,
        })
        .option("--status <status:string>", "passed, failed, or waived.", {
          required: true,
        })
        .option("--answer <text:string>", "Observed answer from routed outputs.", {
          required: true,
        })
        .option("--output <path:string>", "Inspected knowledge/change path; repeat.", {
          collect: true,
        })
        .option("--by <actor:string>", "Reviewing agent actor.", {
          default: "workflow-agent/1",
        })
        .option("--waiver-by <actor:string>", "Human actor approving a waiver.")
        .option("--waiver-note <text:string>", "Human waiver rationale.")
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, probeId) => {
          const result = await recordIntakeProbe({
            target: options.target,
            id,
            probeId,
            question: options.question,
            candidateIds: collectedStrings(options.candidate),
            status: options.status,
            answer: options.answer,
            outputPaths: collectedStrings(options.output),
            reviewedBy: options.by,
            ...(options.waiverBy === undefined
              ? {}
              : { waiverBy: options.waiverBy }),
            ...(options.waiverNote === undefined
              ? {}
              : { waiverNote: options.waiverNote }),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Recorded omission probe ${result.probeId} as ${result.status} in ${result.id}\n`,
            );
          }
        }),
    )
    .command(
      "check",
      new Command()
        .description(
          "Check frozen Git coverage, classified claims, routing, relations, probes, and promotion.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await inspectIntakeCase(options.target, id);
          if (options.json) {
            printJson(result);
          } else if (result.issues.length === 0) {
            process.stdout.write(
              `Intake case gate passed: ${result.path}\n`
                + `Files reviewed: ${result.reviewed}/${result.files}\n`,
            );
          } else {
            process.stdout.write(`Intake case gate failed: ${result.path}\n`);
            process.stdout.write(`Files reviewed: ${result.reviewed}/${result.files}\n`);
            for (const issue of result.issues) {
              process.stdout.write(`- ${issue}\n`);
            }
          }
          if (result.issues.length > 0) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "close",
      new Command()
        .description("Archive a bounded intake case with its honest outcome.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--outcome <outcome:string>", "completed, partial, or abandoned.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await closeIntakeCase({
            target: options.target,
            id,
            outcome: parseOutcome(options.outcome),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Closed ${result.id} as ${result.outcome}\n`
                + `Archive: ${result.archivePath}\n`,
            );
          }
        }),
    );
}

async function resolveProfile(
  value: string | undefined,
  target: string,
  options: { yes?: boolean; json?: boolean },
): Promise<Profile> {
  if (value) {
    return parseProfile(value);
  }
  try {
    return (await readConfig(target)).profile;
  } catch {
    if (options.yes || options.json || !interactive()) {
      throw new Error(
        "Repository kind is required: wfctl init knowledge or wfctl init leaf",
      );
    }
    return parseProfile(
      await ask("Repository kind [knowledge/leaf]: "),
    );
  }
}

async function installedKnowledgePath(
  target: string,
  profile: Profile,
): Promise<string | undefined> {
  if (profile === "knowledge") {
    return undefined;
  }
  try {
    const config = await readConfig(target);
    return resolveKnowledgeRoot(target, config);
  } catch {
    return undefined;
  }
}

async function resolveGitInitialization(input: {
  target: string;
  profile: Profile;
  requested: boolean;
  dryRun: boolean;
  yes: boolean;
  json: boolean;
}): Promise<boolean> {
  if (input.requested && input.profile !== "knowledge") {
    throw new Error("--init-git is only available for knowledge repositories");
  }
  if (isGitRepository(input.target)) {
    return false;
  }
  if (
    input.profile !== "knowledge"
    || input.dryRun
    || input.yes
    || input.json
    || !interactive()
  ) {
    return input.requested;
  }
  return await confirmDefaultYes("Git repository not found. Initialize it here?");
}

async function printInstructions(
  artifact: string,
  target: string,
  profile: Profile,
  knowledge: string | undefined,
): Promise<void> {
  if (artifact !== "agents" && artifact !== "guide") {
    throw new Error(
      `Invalid instruction artifact "${artifact}"; expected agents or guide`,
    );
  }
  const config = createConfig(profile, target, knowledge);
  const distributionRoot = await findDistributionRoot();
  const body = artifact === "agents"
    ? await renderAgentInstructions(
      distributionRoot,
      profile,
      config.knowledge?.path,
    )
    : await renderMaintainerGuide(
      distributionRoot,
      profile,
      config.knowledge?.path,
    );
  process.stdout.write(`<!-- wfctl:begin -->\n${body}\n<!-- wfctl:end -->\n`);
}

async function resolveInstallPreferences(options: {
  skills?: string;
  agents?: string;
  yes?: boolean;
  json?: boolean;
}): Promise<{ scope: SkillScope; agents: AgentTarget[] }> {
  let scope = options.skills ? parseSkillScope(options.skills) : undefined;
  if (!scope && !options.yes && !options.json && interactive()) {
    const answer = await ask("Skill scope [project/user/none] (project): ");
    scope = answer ? parseSkillScope(answer) : "project";
  }
  scope ??= "project";

  if (scope === "none") {
    return { scope, agents: [] };
  }
  let agents = options.agents ? parseAgentTargets(options.agents) : undefined;
  if (!agents && !options.yes && !options.json && interactive()) {
    const answer = await ask("Install for [both/codex/claude] (both): ");
    agents = answer ? parseAgentTargets(answer) : ["codex", "claude"];
  }
  return { scope, agents: agents ?? ["codex", "claude"] };
}

function parseProfile(value: string): Profile {
  if (value !== "knowledge" && value !== "leaf") {
    throw new Error(`Invalid repository kind "${value}"; expected knowledge or leaf`);
  }
  return value;
}

function parseSkillScope(value: string): SkillScope {
  if (value !== "project" && value !== "user" && value !== "none") {
    throw new Error(`Invalid skill scope "${value}"; expected project, user, or none`);
  }
  return value;
}

function parseAgentTargets(value: string): AgentTarget[] {
  if (value === "both") {
    return ["codex", "claude"];
  }
  if (value === "codex" || value === "claude") {
    return [value];
  }
  throw new Error(`Invalid agent target "${value}"; expected codex, claude, or both`);
}

function parseWorkMode(value: string): WorkMode {
  if (value !== "full" && value !== "slice") {
    throw new Error(`Invalid mode "${value}"; expected full or slice`);
  }
  return value;
}

function parseOutcome(value: string): WorkOutcome {
  if (value !== "completed" && value !== "partial" && value !== "abandoned") {
    throw new Error(`Invalid outcome "${value}"; expected completed, partial, or abandoned`);
  }
  return value;
}

function parseLineNumber(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

function collectedStrings(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

function printCoverageSummary(
  summary: CoverageSummary,
  includeOutstanding = false,
): void {
  process.stdout.write(
    `  ${summary.repository}@${summary.commit}\n`
      + `    Files: ${summary.files}; inspected ${summary.fileStates.inspected}; `
      + `pending ${summary.fileStates.pending}; blocked ${summary.fileStates.blocked}; `
      + `structural-only ${summary.fileStates["structural-only"]}; `
      + `irrelevant ${summary.fileStates.irrelevant}\n`
      + `    Graphify: ${summary.graphIndexedFiles} indexed files; `
      + `${summary.graphUnindexedFiles} unindexed; `
      + `${summary.communities} communities `
      + `(${summary.communityStates.pending} pending, `
      + `${summary.communityStates.blocked} blocked)\n`
      + `    Surfaces: ${summary.surfaces}; audit ${summary.surfaceAudit}; `
      + `${summary.surfaceStates.pending} pending, `
      + `${summary.surfaceStates.blocked} blocked\n`,
  );
  if (!includeOutstanding) {
    return;
  }
  printCoverageItems(
    "Outstanding files",
    summary.outstandingFiles.map((file) =>
      `${file.status.padEnd(14)} ${file.category.padEnd(14)} `
        + `${file.graphIndexed ? "graph" : "no-graph"} ${file.path}`
        + (file.readRanges.length > 0
          ? ` [read ${file.readRanges.join(",")}/${file.totalLines}]`
          : "")
    ),
  );
  printCoverageItems(
    "Outstanding communities",
    summary.outstandingCommunities.map((community) =>
      `${community.status.padEnd(14)} ${community.id} ${community.name}`
    ),
  );
  printCoverageItems(
    "Outstanding surfaces",
    summary.outstandingSurfaces.map((surface) =>
      `${surface.status.padEnd(14)} ${surface.kind} ${surface.id}`
    ),
  );
  printCoverageItems(
    "Graphify-only sources",
    summary.untrackedGraphSourcePaths,
  );
}

function printCoverageItems(title: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }
  const limit = 20;
  process.stdout.write(`    ${title} (${items.length}):\n`);
  for (const item of items.slice(0, limit)) {
    process.stdout.write(`      - ${item}\n`);
  }
  if (items.length > limit) {
    process.stdout.write(
      `      ... ${items.length - limit} more; use --json for the complete list\n`,
    );
  }
}

function printPlan(plan: InstallPlan): void {
  const summary = summarizePlan(plan) as {
    counts: Record<string, number>;
  };
  process.stdout.write(
    `\n${bold("Workflow preview")}\n`
      + `  ${dim("Profile")} ${plan.profile}\n`
      + `  ${dim("Target")}  ${plan.target}\n`
      + `  ${operationCount("create", summary.counts.create ?? 0)}  `
      + `${operationCount("update", summary.counts.update ?? 0)}  `
      + `${operationCount("delete", summary.counts.delete ?? 0)}  `
      + `${operationCount("conflict", summary.counts.conflict ?? 0)}  `
      + `${dim(`${summary.counts.unchanged ?? 0} unchanged`)}\n`,
  );

  for (
    const status of ["conflict", "delete", "update", "create"] satisfies OperationStatus[]
  ) {
    const operations = plan.operations.filter((operation) => operation.status === status);
    if (operations.length === 0) {
      continue;
    }
    process.stdout.write(`\n${operationHeading(status, operations.length)}\n`);
    for (const operation of operations) {
      process.stdout.write(
        `  ${operationSymbol(status)} ${operation.path} ${dim(`— ${operation.reason}`)}\n`,
      );
    }
  }
}

function skillSummary(input: {
  scope: SkillScope;
  agents: AgentTarget[];
}): Record<string, unknown> {
  return {
    scope: input.scope,
    agents: input.agents,
    installer: input.scope === "none" ? "disabled" : "skills@1.5.20",
  };
}

function printSkillSummary(input: {
  scope: SkillScope;
  agents: AgentTarget[];
}): void {
  process.stdout.write(`\n${bold("Agent skills")}\n`);
  if (input.scope === "none") {
    process.stdout.write(`  ${yellow("!")} Installation disabled\n`);
    return;
  }
  process.stdout.write(
    `  ${green("✓")} ${input.scope} scope for ${input.agents.join(", ")} via skills CLI\n`,
  );
}

function printDependencyChecks(checks: DoctorCheck[]): void {
  process.stdout.write(`\n${bold("Dependency preflight")}\n`);
  for (const check of checks) {
    printCheckLine(check);
  }
}

function printCheck(report: DoctorReport): void {
  process.stdout.write(
    `\n${bold("Workflow health")}\n`
      + `  ${dim("Target")} ${report.target}\n`,
  );
  for (const section of checkSections(compactChecks(report.checks))) {
    process.stdout.write(`\n${cyan(bold(section.title))}\n`);
    for (const check of section.checks) {
      printCheckLine(check);
    }
  }
  printQmdSetup(report.checks);
  printCheckSummary(report.checks);
}

function compactChecks(checks: DoctorCheck[]): DoctorCheck[] {
  const skillChecks = checks.filter((check) => isSkillCheck(check));
  const directoryChecks = checks.filter((check) => isKnowledgeDirectoryCheck(check));
  const firstSkill = skillChecks[0];
  const firstDirectory = directoryChecks[0];
  const compact: DoctorCheck[] = [];

  for (const check of checks) {
    if (isSkillCheck(check)) {
      if (check === firstSkill) {
        compact.push(...compactGroup(skillChecks, "agent-skills", skillSummaryMessage));
      }
      continue;
    }
    if (isKnowledgeDirectoryCheck(check)) {
      if (check === firstDirectory) {
        compact.push(...compactGroup(
          directoryChecks,
          "knowledge-directories",
          (passed) => `${passed} required workflow directories are present`,
        ));
      }
      continue;
    }
    compact.push(check);
  }
  return compact;
}

function compactGroup(
  checks: DoctorCheck[],
  name: string,
  passMessage: (passed: number) => string,
): DoctorCheck[] {
  const passed = checks.filter((check) => check.status === "pass");
  const issues = checks.filter((check) => check.status !== "pass");
  return [
    ...(passed.length > 0
      ? [{ name, status: "pass" as const, message: passMessage(passed.length) }]
      : []),
    ...issues,
  ];
}

function skillSummaryMessage(passed: number): string {
  return `${passed} agent skill ${passed === 1 ? "installation" : "installations"} verified`;
}

function isSkillCheck(check: DoctorCheck): boolean {
  return /^(codex|claude|user)-skill-/.test(check.name);
}

function isKnowledgeDirectoryCheck(check: DoctorCheck): boolean {
  return check.name.startsWith("knowledge-") && check.message.endsWith(" exists");
}

function checkSections(checks: DoctorCheck[]): Array<{
  title: string;
  checks: DoctorCheck[];
}> {
  const order = [
    "Environment",
    "Agent skills",
    "Knowledge retrieval",
    "Source analysis",
    "Knowledge base",
    "Repositories",
    "Installation",
    "Other",
  ];
  const sections = new Map<string, DoctorCheck[]>();
  for (const check of checks) {
    const title = checkSection(check.name);
    const current = sections.get(title) ?? [];
    current.push(check);
    sections.set(title, current);
  }
  return order.flatMap((title) => {
    const sectionChecks = sections.get(title);
    return sectionChecks ? [{ title, checks: sectionChecks }] : [];
  });
}

function checkSection(name: string): string {
  if (name === "config" || name === "git") {
    return "Environment";
  }
  if (name === "agent-skills" || name === "workflow-skills" || isSkillName(name)) {
    return "Agent skills";
  }
  if (name.startsWith("qmd-")) {
    return "Knowledge retrieval";
  }
  if (name.startsWith("graphify-")) {
    return "Source analysis";
  }
  if (
    name === "knowledge"
    || name === "maintainer-guide"
    || name === "curated-knowledge"
    || name === "knowledge-graph"
    || name === "claim-ledger"
    || name === "knowledge-directories"
    || name.startsWith("knowledge-")
  ) {
    return "Knowledge base";
  }
  if (name.startsWith("repository-")) {
    return "Repositories";
  }
  if (name === "installation") {
    return "Installation";
  }
  return "Other";
}

function isSkillName(name: string): boolean {
  return /^(codex|claude|user)-skill-/.test(name);
}

function printCheckLine(check: DoctorCheck): void {
  process.stdout.write(
    `  ${checkSymbol(check.status)} ${bold(checkLabel(check.name))} `
      + `${dim(`— ${humanCheckMessage(check)}`)}\n`,
  );
}

function checkSymbol(status: DoctorCheck["status"]): string {
  if (status === "pass") {
    return green("✓");
  }
  if (status === "warn") {
    return yellow("!");
  }
  return red("✗");
}

function humanCheckMessage(check: DoctorCheck): string {
  if (check.name === "qmd-models" && check.status !== "pass") {
    if (check.message.includes("did not report")) {
      return "Semantic model status could not be verified";
    }
    return check.message.includes("pull --refresh")
      ? "Semantic model cache contains an invalid model file"
      : "Semantic models are not installed";
  }
  if (check.name === "qmd-embeddings" && check.status !== "pass") {
    const count = check.message.match(/(\d+)\s+active documents need embeddings/i)?.[1];
    return count
      ? `${count} indexed documents need semantic embeddings`
      : "Semantic embeddings are missing or stale";
  }
  return check.message.split(/\r?\n/).find((line) => line.trim() !== "")?.trim()
    ?? check.message;
}

function checkLabel(name: string): string {
  const labels: Record<string, string> = {
    config: "Profile",
    git: "Git repository",
    "agent-skills": "Agent skills",
    "workflow-skills": "Agent skills",
    "qmd-version": "QMD version",
    "qmd-native-skill": "QMD agent skill",
    "qmd-index-config": "QMD collections",
    "qmd-status": "QMD index",
    "qmd-bm25-index": "Lexical search",
    "qmd-doctor": "QMD diagnostics",
    "qmd-models": "Semantic models",
    "qmd-embeddings": "Semantic embeddings",
    "qmd-update": "Lexical index update",
    "graphify-cli": "Graphify CLI",
    "graphify-graph": "Source graph",
    "graphify-scope": "Graphify scope",
    "graphify-ignore": "Graphify Git ignore",
    knowledge: "Knowledge bundle",
    "knowledge-repository": "Knowledge repository",
    "maintainer-guide": "Maintainer guide",
    "curated-knowledge": "Curated knowledge",
    "knowledge-graph": "Knowledge graph",
    "claim-ledger": "Claim ledger",
    "knowledge-directories": "Workflow directories",
    "repository-registry": "Leaf repositories",
    "repository-connection": "Repository connection",
    installation: "Workflow assets",
  };
  return labels[name] ?? name.replaceAll("-", " ");
}

function printQmdSetup(checks: DoctorCheck[]): void {
  const models = checks.find((check) => check.name === "qmd-models");
  const embeddings = checks.find((check) => check.name === "qmd-embeddings");
  const needsModels = models !== undefined && models.status !== "pass";
  const needsEmbeddings = embeddings !== undefined && embeddings.status !== "pass";
  if (!needsModels && !needsEmbeddings) {
    return;
  }

  const knowledge = checks.find((check) => check.name === "knowledge");
  const knowledgeRoot = knowledge?.message.match(/ found at (.+)$/)?.[1];
  const steps = [
    ...(needsModels
      ? [qmdModelSetupStep(models)]
      : []),
    ...(needsEmbeddings
      ? [{ command: "qmd embed", detail: "Build or refresh semantic embeddings" }]
      : []),
    { command: "wfctl check", detail: "Verify that semantic search is ready" },
  ];

  process.stdout.write(
    `\n${yellow(bold("Next step · Enable semantic search"))}\n`
      + `  Run these commands from ${
        knowledgeRoot ? cyan(knowledgeRoot) : "the connected knowledge repository"
      }:\n`,
  );
  for (const [index, step] of steps.entries()) {
    process.stdout.write(
      `  ${index + 1}. ${cyan(step.command.padEnd(12))} ${dim(step.detail)}\n`,
    );
  }
  process.stdout.write(
    `  ${dim("Lexical BM25 search remains available until setup is complete.")}\n`,
  );
}

function qmdModelSetupStep(check: DoctorCheck | undefined): {
  command: string;
  detail: string;
} {
  if (check?.message.includes("pull --refresh")) {
    return {
      command: "qmd pull --refresh",
      detail: "Replace invalid cached semantic model files",
    };
  }
  if (check?.message.includes("did not report")) {
    return {
      command: "qmd doctor",
      detail: "Inspect why semantic model state is unavailable",
    };
  }
  return {
    command: "qmd pull",
    detail: "Download local semantic models (~2 GB, once)",
  };
}

function printCheckSummary(checks: DoctorCheck[]): void {
  const passed = checks.filter((check) => check.status === "pass").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const failed = checks.filter((check) => check.status === "fail").length;
  process.stdout.write(
    `\n${bold("Summary")}  ${green(`${passed} checks passed`)}  `
      + `${
        warnings > 0
          ? yellow(`${warnings} ${warnings === 1 ? "warning" : "warnings"}`)
          : dim("0 warnings")
      }  `
      + `${
        failed > 0
          ? red(`${failed} ${failed === 1 ? "check failed" : "checks failed"}`)
          : dim("0 failed")
      }\n`,
  );
}

function operationCount(status: OperationStatus, count: number): string {
  const value = status === "conflict"
    ? `${count} ${count === 1 ? "conflict" : "conflicts"}`
    : `${count} to ${status}`;
  if (status === "create") {
    return green(value);
  }
  if (status === "update") {
    return cyan(value);
  }
  if (status === "delete" || status === "conflict") {
    return count > 0 ? red(value) : dim(value);
  }
  return dim(value);
}

function operationHeading(status: OperationStatus, count: number): string {
  const label = `${status[0]?.toUpperCase()}${status.slice(1)} (${count})`;
  if (status === "create") {
    return green(bold(label));
  }
  if (status === "update") {
    return cyan(bold(label));
  }
  return red(bold(label));
}

function operationSymbol(status: OperationStatus): string {
  if (status === "create") {
    return green("+");
  }
  if (status === "update") {
    return cyan("~");
  }
  return red(status === "delete" ? "−" : "!");
}

async function confirm(question: string): Promise<boolean> {
  if (!interactive()) {
    return false;
  }
  const answer = (await ask(`${question} [y/N] `)).toLowerCase();
  return answer === "y" || answer === "yes";
}

async function confirmDefaultYes(question: string): Promise<boolean> {
  if (!interactive()) {
    return false;
  }
  const answer = (await ask(`${question} [Y/n] `)).toLowerCase();
  return answer === "" || answer === "y" || answer === "yes";
}

async function ask(question: string): Promise<string> {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await reader.question(question)).trim();
  } finally {
    reader.close();
  }
}

function interactive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
