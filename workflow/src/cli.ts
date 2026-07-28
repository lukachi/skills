import { Command } from "@cliffy/command";
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
  updateGraphifyGraph,
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
} from "./intake.js";
import { hashKnowledgeConcept, validateKnowledge } from "./knowledge.js";
import { writeKnowledgeGraph } from "./knowledge-graph.js";
import {
  addLeafRepository,
  ensureRepositoryRegistry,
  listRepositoryConnections,
  selectLeafRepository,
} from "./repository-registry.js";
import {
  beginProjectReconstruction,
  closeProjectReconstruction,
  inspectProjectReconstruction,
} from "./reconstruction.js";
import type {
  AgentTarget,
  InstallPlan,
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
    ? updateGraphifyGraph(input.target)
    : undefined;
  if (input.profile === "knowledge") {
    const validation = await validateKnowledge(input.target);
    if (validation.valid) {
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
      `Installed ${applied.changed} workflow change(s) in ${resolved.target}\n`
        + `Guide: ${resolve(resolved.target, "PROJECT_WORKFLOW.md")}\n`,
    );
    if (repositoryCheckout) {
      process.stdout.write(
        `Registered leaf checkout: ${repositoryCheckout.repository} `
          + `(${repositoryCheckout.worktreeId}) -> ${repositoryCheckout.knowledgeRoot}\n`
          + `${
            repositoryCheckout.active
              ? "This checkout remains active for reconstruction.\n"
              : "It is not active for reconstruction; select it explicitly from knowledge.\n"
          }`,
      );
    }
    for (const backup of applied.backups) {
      process.stdout.write(`Backup: ${backup}\n`);
    }
    printCheck(report);
  }
  if (!doctorPassed(report)) {
    process.exitCode = 2;
  }
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
        .description("Create a lightweight, non-authoritative inbox handoff.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Leaf checkout.", { default: "." })
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
                + `Code root: ${result.codeRoot}\n`
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
        + "wfctl validates and compiles explicit knowledge relations; QMD provides semantic retrieval.",
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
          "Validate curated knowledge and compile its deterministic navigation graph.",
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
          const result = await writeKnowledgeGraph(options.target);
          if (options.json) {
            printJson({
              built: true,
              path: result.path,
              contentHash: result.graph.contentHash,
              stats: result.graph.stats,
              warnings: result.warnings,
            });
          } else {
            process.stdout.write(
              `Knowledge graph built: ${result.path}\n`
                + `Nodes: ${result.graph.stats.nodes}; edges: ${result.graph.stats.edges}; `
                + `concepts: ${result.graph.stats.concepts}\n`,
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
          "Bind clean leaf checkouts, refresh Graphify, and create repository dossiers.",
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
                  + `(${repository.graphNodes} graph nodes)\n`
                  + `  Dossier: ${repository.dossier}\n`,
              );
            }
          }
        }),
    )
    .command(
      "check",
      new Command()
        .description(
          "Verify checkout bindings, dossier coverage, claim disposition, promotion, and review.",
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
      "Register all known leaf worktrees and explicitly select one active reconstruction checkout per repository.",
    )
    .command(
      "add",
      new Command()
        .description(
          "Add or refresh one known leaf checkout without changing the active reconstruction selection.",
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
                + `${
                  result.active
                    ? "Selection: ACTIVE\n"
                    : "Selection: inactive; use sources select to make it active\n"
                }`,
            );
          }
        }),
    )
    .command(
      "select",
      new Command()
        .description(
          "Explicitly select one previously added worktree as the active reconstruction checkout for its repository.",
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
              `Selected active checkout for ${result.repository}\n`
                + `Checkout: ${result.root}\n`
                + `Worktree: ${result.worktreeId} (${result.branch})\n`
                + `Revision at selection: ${result.commit}\n`,
            );
          }
        }),
    )
    .command(
      "list",
      new Command()
        .description("List every known worktree and show the active reconstruction selection.")
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
                process.stdout.write(
                  `  ${checkout.active ? "ACTIVE  " : "        "}`
                    + `${checkout.available ? "READY   " : "MISSING "} `
                    + `${checkout.root} (${checkout.worktreeId})`
                    + `${
                      checkout.branch
                        ? ` ${checkout.branch}@${checkout.commit}`
                        : ""
                    }\n`,
                );
              }
              if (entry.checkouts.length > 0 && !entry.activeRoot) {
                process.stdout.write("  SELECT REQUIRED before default reconstruction\n");
              }
            }
          }
        }),
    );
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
      "check",
      new Command()
        .description("Check frozen Git coverage, reviews, candidates, and promotion state.")
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

function printPlan(plan: InstallPlan): void {
  const summary = summarizePlan(plan) as {
    counts: Record<string, number>;
  };
  process.stdout.write(
      `Workflow preview: ${plan.profile} -> ${plan.target}\n`
      + `Create ${summary.counts.create ?? 0}, update ${summary.counts.update ?? 0}, `
      + `delete ${summary.counts.delete ?? 0}, unchanged ${summary.counts.unchanged ?? 0}, `
      + `conflicts ${summary.counts.conflict ?? 0}\n`,
  );
  for (const operation of plan.operations) {
    if (operation.status === "unchanged") {
      continue;
    }
    process.stdout.write(
      `${operation.status.toUpperCase().padEnd(9)} ${operation.path} — ${operation.reason}\n`,
    );
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
  if (input.scope === "none") {
    process.stdout.write("Skills: not installed\n");
    return;
  }
  process.stdout.write(
    `Skills: ${input.scope} scope for ${input.agents.join(", ")} via skills CLI\n`,
  );
}

function printDependencyChecks(checks: Awaited<ReturnType<typeof runDoctor>>["checks"]): void {
  process.stdout.write("Dependency preflight:\n");
  for (const check of checks) {
    process.stdout.write(
      `${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.message}\n`,
    );
  }
}

function printCheck(report: Awaited<ReturnType<typeof runDoctor>>): void {
  process.stdout.write(`Workflow check: ${report.target}\n`);
  for (const check of report.checks) {
    process.stdout.write(
      `${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.message}\n`,
    );
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!interactive()) {
    return false;
  }
  const answer = (await ask(`${question} [y/N] `)).toLowerCase();
  return answer === "y" || answer === "yes";
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
