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
import {
  createCapture,
  listCaptures,
  resolveCapture,
  type CaptureOutcome,
} from "./capture.js";
import { buildInstallPlan, summarizePlan } from "./planner.js";
import { installSkillsTransactional } from "./skill-installer.js";
import {
  beginIntakeCase,
  closeIntakeCase,
  intakeContext,
  inspectIntakeCase,
  inventoryRaw,
  markIntakeSource,
  migrateIntakeCase,
  readIntakeSource,
  recordIntakeProbe,
  updateIntakeCheckpoint,
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
import {
  initializeGitRepository,
  isGitRepository,
  readRepositoryMetadata,
} from "./git.js";
import {
  activeReconstructionPins,
  approveReconstructionRawScope,
  beginProjectReconstruction,
  claimReconstructionWorkstream,
  closeProjectReconstruction,
  createReconstructionWorkstream,
  escalateReconstructionWorkstream,
  reconstructionContext,
  inspectProjectReconstruction,
  inspectReconstructionCoverage,
  markReconstructionCommunity,
  markReconstructionFiles,
  readReconstructionSource,
  recordReconstructionSurface,
  repinReconstructionRepository,
  reviewReconstructionWorkstream,
  reviewReconstructionSurfaces,
  submitReconstructionWorkstream,
  updateReconstructionCheckpoint,
  ReconstructionDependencyError,
  type ReconstructionRawScopeMode,
} from "./reconstruction.js";
import {
  RECONSTRUCTION_ESCALATION_ACTIONS,
  RECONSTRUCTION_ESCALATION_TRIGGERS,
  RECONSTRUCTION_PROFILES,
  RECONSTRUCTION_WORKLOADS,
  type ReconstructionEscalationAction,
  type ReconstructionEscalationTrigger,
  type ReconstructionProfile,
  type ReconstructionWorkload,
} from "./reconstruction-orchestration.js";
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
  approveWork,
  beginWork,
  claimWorkIssue,
  closeWork,
  completeWorkIssue,
  createWorkIssue,
  dropWorkIssue,
  finishWayfinder,
  rebindWork,
  releaseWorkIssue,
  reviewWorkBundleFile,
  setWorkIssueBlocker,
  verifyWork,
  workBundleContext,
  workStatus,
  updateWorkCheckpoint,
} from "./work.js";
import type {
  ApprovalMethod,
  MaintainerReviewStage,
} from "./work-spec.js";
import type {
  BundleReviewStatus,
  WorkBundleStage,
  WorkCheckpointStage,
  WorkCheckpointStatus,
  WorkIssuePhase,
  WorkIssueType,
} from "./work-bundle.js";
import {
  findDistributionRoot,
  renderAgentInstructions,
  renderMaintainerGuide,
} from "./assets.js";
import { collectWorkflowState } from "./state.js";
import type { CapabilityState, StateLevel, StateReport } from "./state.js";
import {
  installBackgroundGuardHook,
  installSessionBriefHook,
  installStopGuardHook,
  removeSessionBriefHook,
  SESSION_BRIEF_COMMAND,
  sessionBriefHookInstalled,
  sessionStartEnvelope,
} from "./hooks.js";

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
      + "Orientation:\n"
      + "  brief      Report current repository state at session start\n"
      + "  hooks      Install or remove the session-start brief hook\n\n"
      + "Knowledge operations:\n"
      + "  knowledge  Process raw input, validate knowledge, and build its graph\n\n"
      + "Project work:\n"
      + "  work       Operate captures, checkpoints, change bundles, issues, and closure",
  )
  .throwErrors()
  .command("init", initCommand())
  .command("check", checkCommand())
  .command("upgrade", upgradeCommand())
  .command("brief", briefCommand())
  .command("hooks", hooksCommand())
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

/**
 * A reconstruction reads a leaf at a commit frozen when the case started, and
 * nothing moves a pin. Upgrading a leaf refreshes its checkout-local Graphify
 * graph and adds a workflow-asset commit, so the graph stops describing the
 * commit the case reads. That belongs in preflight, before the prompt: after
 * the write the only remaining choices are finishing on the old pin or
 * abandoning the baseline. It warns rather than fails because an abandoned or
 * already-drifted case is a legitimate reason to go ahead.
 */
async function reconstructionPinChecks(input: {
  target: string;
  profile: Profile;
  knowledge?: string;
}): Promise<DoctorCheck[]> {
  if (input.profile !== "leaf" || !input.knowledge) {
    return [];
  }
  let repository: string;
  let head: string;
  try {
    const metadata = readRepositoryMetadata(input.target);
    repository = metadata.repository;
    head = metadata.commit;
    const pins = await activeReconstructionPins(input.knowledge, repository);
    return pins.map((pin) => ({
      name: "reconstruction-pin",
      status: "warn" as const,
      message: pin.commit === head
        ? `Reconstruction ${pin.caseId} reads this repository at ${abbreviate(pin.commit)}, `
          + "which is the current HEAD. Upgrading refreshes the Graphify graph and adds a "
          + "workflow-asset commit, so the graph stops matching the pin."
        : `Reconstruction ${pin.caseId} reads this repository at ${abbreviate(pin.commit)} `
          + `while HEAD is ${abbreviate(head)}. The pinned tree stays readable, but the `
          + "Graphify graph already describes a different commit.",
      remediation: {
        title: "Advancing a bound leaf leaves the graph describing another commit",
        steps: [
          {
            command: "wfctl knowledge reconstruct repin",
            detail:
              "Move the case to this checkout's new commit afterwards. Byte-identical "
              + "blobs keep their reading; changed ones return to pending.",
          },
          {
            command: "wfctl upgrade",
            detail:
              "Run it in the knowledge repository instead. Rules and skills reach the "
              + "reconstruction agent from there, and that upgrade touches no pin.",
          },
        ],
      },
    }));
  } catch {
    // Orientation only. A leaf outside Git, an unreadable knowledge root, or a
    // malformed case must never stop an upgrade the maintainer asked for.
    return [];
  }
}

function abbreviate(commit: string): string {
  return commit.length > 8 ? commit.slice(0, 8) : commit;
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
  const preflight = [
    ...runInstallPreflight({
      target: input.target,
      profile: input.profile,
      ...(input.knowledge ? { knowledge: input.knowledge } : {}),
      initializeGit: input.initializeGit === true,
      requireQmdSkill: input.scope !== "none",
      agents: input.agents,
    }),
    ...await reconstructionPinChecks(input),
  ];
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
  // A background command that stops reporting is invisible until someone
  // notices hours later, so the silence watch ships with the workflow rather
  // than waiting to be requested.
  const backgroundGuard = await installBackgroundGuardHook(input.target);
  // Same reason, the other half of the same loss: a turn that ends on a stated
  // next action leaves the work parked with nothing reported as wrong.
  const stopGuard = await installStopGuardHook(input.target);
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
  report.checks.push({
    name: "background-guard",
    status: "pass",
    message: backgroundGuard.outcome === "already-installed"
      ? "Background shell commands are already watched for silence"
      : `Background shell commands are now watched for silence (${backgroundGuard.path})`,
  });
  report.checks.push({
    name: "stop-guard",
    status: "pass",
    message: stopGuard.outcome === "already-installed"
      ? "A turn ending while work awaits the agent is already re-entered once"
      : `A turn ending while work awaits the agent is now re-entered once (${stopGuard.path})`,
  });
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
    printChangedPaths(applied.changedPaths);
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

/**
 * Names what the run wrote. A count is not actionable: these files are tracked
 * project files that belong in a commit of their own, and an agent handed only
 * a number has nothing to stage, so they ride along in whatever commit lands
 * next. Long lists stay honest by naming the directories rather than stopping
 * at an arbitrary cutoff.
 */
function printChangedPaths(paths: readonly string[]): void {
  if (paths.length === 0) {
    return;
  }
  process.stdout.write(`\n${bold("Files written")}\n`);
  if (paths.length <= 40) {
    for (const path of paths) {
      process.stdout.write(`  ${path}\n`);
    }
  } else {
    const byDirectory = new Map<string, number>();
    for (const path of paths) {
      const directory = path.includes("/") ? `${path.slice(0, path.lastIndexOf("/"))}/` : ".";
      byDirectory.set(directory, (byDirectory.get(directory) ?? 0) + 1);
    }
    for (const [directory, count] of [...byDirectory].sort()) {
      process.stdout.write(`  ${directory} ${dim(`(${count})`)}\n`);
    }
  }
  process.stdout.write(
    `\n  ${dim("These are tracked project files. Commit them on their own before")}\n`
      + `  ${dim("continuing, and restart the session so the agent block is reloaded.")}\n`,
  );
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

function briefCommand() {
  return new Command()
    .description(
      "Report current repository state at session start.\n"
        + "Reads only durable records; never starts work, writes, or contacts a tool.\n"
        + "Signals are facts, capabilities are derived; composing advice is the agent's job.",
    )
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("--json", "Print machine-readable JSON.")
    .option("--hook", "Emit a Claude Code SessionStart envelope; never fails.")
    .action(async (options) => {
      if (options.hook) {
        process.stdout.write(sessionStartEnvelope(await briefContext(options.target)));
        return;
      }
      const report = await collectWorkflowState(options.target);
      if (options.json) {
        printJson(report);
      } else {
        printBrief(report);
      }
    });
}

/**
 * Hook stdout reaches the agent, not the maintainer, so it carries the machine
 * report plus the one instruction the agent needs about what to do with it.
 * Nothing normative belongs here: this reports observed state, and standing
 * behavior lives in the managed agent block and the rules. A failure here would
 * cost a whole session, so it degrades into a note.
 */
async function briefContext(target: string): Promise<string> {
  try {
    const report = await collectWorkflowState(target);
    return [
      "Workflow session brief from `wfctl brief`. This is the authoritative",
      "current state of this repository: signals are observed facts and",
      "capabilities are derived from them. Do not run the command again, do not",
      "rediscover this by scanning records, and do not read it back as a list.",
      "Open with one short orientation and offer what is available.",
      "",
      JSON.stringify(report, null, 2),
    ].join("\n");
  } catch (error) {
    return `The workflow session brief could not be collected: ${errorMessage(error)}`;
  }
}

function hooksCommand() {
  return new Command()
    .description(
      "Install or remove the session-start brief in this repository's Claude Code settings.",
    )
    .command(
      "install",
      new Command()
        .description(`Add a SessionStart hook that runs \`${SESSION_BRIEF_COMMAND}\`.`)
        .option("-t, --target <path:string>", "Target repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await installSessionBriefHook(resolve(options.target));
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `${result.outcome}: ${result.command}\n${dim(result.path)}\n`
                + `${dim("Restart the agent session for the hook to take effect.")}\n`,
            );
          }
        }),
    )
    .command(
      "remove",
      new Command()
        .description("Remove the session-start brief hook and leave every other setting intact.")
        .option("-t, --target <path:string>", "Target repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await removeSessionBriefHook(resolve(options.target));
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(`${result.outcome}: ${result.command}\n${dim(result.path)}\n`);
          }
        }),
    )
    .command(
      "status",
      new Command()
        .description("Report whether the session-start brief hook is installed.")
        .option("-t, --target <path:string>", "Target repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const target = resolve(options.target);
          const installed = await sessionBriefHookInstalled(target);
          if (options.json) {
            printJson({ target, installed, command: SESSION_BRIEF_COMMAND });
          } else {
            process.stdout.write(
              `${installed ? green("installed") : yellow("not installed")}  ${SESSION_BRIEF_COMMAND}\n`,
            );
          }
        }),
    );
}

function printBrief(report: StateReport): void {
  const header = [
    `wfctl ${report.workflowVersion}`,
    report.profile ?? "not installed",
    report.root,
  ].join(" · ");
  process.stdout.write(`${bold(header)}\n`);

  if (report.signals.length === 0) {
    process.stdout.write(`${dim("No state signals.")}\n`);
  }
  for (const signal of report.signals) {
    const subject = signal.subject ? ` ${cyan(signal.subject)}` : "";
    const facts = Object.entries(signal.facts ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    process.stdout.write(
      `${levelTag(signal.level)} ${signal.id}${subject}  ${signal.summary}\n`,
    );
    if (facts || signal.since || signal.awaits) {
      const trailer = [
        facts,
        signal.since ? `since=${signal.since}` : "",
        signal.awaits ? `awaits=${signal.awaits}` : "",
      ].filter(Boolean).join(" ");
      process.stdout.write(`${dim(`           ${trailer}`)}\n`);
    }
  }

  if (report.capabilities.length > 0) {
    process.stdout.write("\n");
    for (const capability of report.capabilities) {
      process.stdout.write(
        `${capability.id.padEnd(22)} ${capabilityState(capability)}\n`,
      );
    }
  }

  for (const failure of report.degraded) {
    process.stdout.write(
      `${yellow("degraded")}   ${failure.collector}  ${failure.reason}\n`,
    );
  }
}

/**
 * An unmet requirement means the operation has no subject yet, which reads as an
 * obstacle if it is printed the same way as something actually in the way.
 */
function capabilityState(capability: CapabilityState): string {
  if (capability.available) {
    return green("available");
  }
  if (capability.blockedBy.length > 0) {
    const reasons = [
      ...capability.blockedBy,
      ...capability.missing.map((signal) => `needs ${signal}`),
    ];
    return `${red("blocked")} ${dim(`← ${reasons.join(", ")}`)}`;
  }
  return dim(`n/a       ← needs ${capability.missing.join(", ")}`);
}

function levelTag(level: StateLevel): string {
  const label = level.padEnd(9);
  if (level === "blocked") {
    return red(label);
  }
  if (level === "attention") {
    return yellow(label);
  }
  if (level === "ok") {
    return green(label);
  }
  return dim(label);
}

function workCommand() {
  return new Command()
    .description("Manage pending captures and central work bound to exact checkouts.")
    .command("capture", workCaptureCommand())
    .command("handoff", deprecatedHandoffCommand())
    .command(
      "start",
      new Command()
        .description("Start a central bundle before significant-task discussion continues.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Leaf checkout.", { default: "." })
        .option("--title <title:string>", "Human-readable work title.", { required: true })
        .option("--mode <mode:string>", "full, slice, or wayfinder.", { default: "full" })
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
    .command("context", workContextCommand())
    .command("checkpoint", workCheckpointCommand())
    .command("approve", workApproveCommand())
    .command("issue", workIssueCommand())
    .command("map", workMapCommand())
    .command("review", workReviewCommand())
    .command(
      "status",
      new Command()
        .description("Show and validate the code-root/bundle binding.")
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
                `${result.valid ? "VALID" : "INVALID"} ${result.id} — ${result.title}\n`
                  + `Scope: ${result.scope}\n`
                  + `Code roots: ${
                    result.codeRoots.length > 0 ? result.codeRoots.join(", ") : "none"
                  }\n`
                  + `Knowledge root: ${result.knowledgeRoot}\n`
                  + `Bundle: ${result.bundleRoot}\n`
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
        .description("Check the structural completion gate for a bound change bundle.")
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
        .description("Archive a bound change bundle after its required gates pass.")
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

function workApproveCommand() {
  return new Command()
    .description(
      "Record a maintainer framing or completion approval outside the agent's normal record edits.",
    )
    .arguments("<id:string>")
    .option("-t, --target <path:string>", "Bound checkout.", { default: "." })
    .option("--stage <stage:string>", "framing or completion.", { required: true })
    .option("--by <actor:string>", "Approving maintainer as human:<id>.", { required: true })
    .option("--note <note:string>", "What was approved, in project language.")
    .option(
      "--token <token:string>",
      "Out-of-band approval token; required when no interactive terminal is available. "
        + "Must equal WFCTL_APPROVAL_TOKEN.",
    )
    .option("--json", "Print machine-readable JSON.")
    .action(async (options, id) => {
      const stage = parseApprovalStage(options.stage);
      const method = await resolveApprovalMethod({
        id,
        stage,
        by: options.by,
        ...(options.note ? { note: options.note } : {}),
        ...(options.token ? { token: options.token } : {}),
      });
      const result = await approveWork({
        target: options.target,
        id,
        stage,
        by: options.by,
        method,
        ...(options.note ? { note: options.note } : {}),
      });
      if (options.json) {
        printJson(result);
      } else {
        process.stdout.write(
          `Recorded ${result.stage} approval for ${result.id}\n`
            + `By: ${result.by}\n`
            + `Method: ${result.method}\n`
            + `Receipt: ${result.receipt}\n`
            + `Spec: ${result.specPath}\n`
            + "The change record changed: re-read it, refresh its review receipt and checkpoint.\n",
        );
      }
    });
}

function parseApprovalStage(value: string): MaintainerReviewStage {
  if (value === "framing" || value === "completion") {
    return value;
  }
  throw new Error(`Approval stage must be framing or completion, not ${value}`);
}

/**
 * Approval must not be producible by the same unattended path that writes the
 * rest of the record. Interactive use requires a typed confirmation; automation
 * requires a token supplied out of band through the environment.
 */
async function resolveApprovalMethod(input: {
  id: string;
  stage: MaintainerReviewStage;
  by: string;
  note?: string;
  token?: string;
}): Promise<ApprovalMethod> {
  const expected = process.env.WFCTL_APPROVAL_TOKEN?.trim();
  if (input.token) {
    if (!expected) {
      throw new Error(
        "WFCTL_APPROVAL_TOKEN is not set; a supplied --token cannot be verified",
      );
    }
    if (input.token !== expected) {
      throw new Error("Supplied --token does not match WFCTL_APPROVAL_TOKEN");
    }
    return "token";
  }
  if (!interactive()) {
    throw new Error(
      "Maintainer approval requires an interactive terminal, or --token with a matching "
        + "WFCTL_APPROVAL_TOKEN. wfctl does not record approval from an unattended session.",
    );
  }
  process.stdout.write(
    `\nMaintainer approval requested\n`
      + `  Change: ${input.id}\n`
      + `  Stage:  ${input.stage}\n`
      + `  Actor:  ${input.by}\n`
      + `  Note:   ${input.note ?? "(none)"}\n\n`
      + "This records a durable human decision. Only you should answer.\n",
  );
  const answer = await ask(`Type "approve" to record it, anything else to abort: `);
  if (answer.toLowerCase() !== "approve") {
    throw new Error("Maintainer approval was not confirmed; nothing was recorded");
  }
  return "interactive";
}

function workCaptureCommand() {
  return new Command()
    .description("Capture, inspect, and resolve unassigned non-authoritative material.")
    .command(
      "add",
      new Command()
        .description("Add material that matters but has no active or curated owner yet.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Workflow repository.", { default: "." })
        .option("--title <title:string>", "Human-readable capture title.", {
          required: true,
        })
        .option(
          "--awaits <audience:string>",
          "maintainer when only they can answer it; agent otherwise.",
        )
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const result = await createCapture({
            target: options.target,
            slug,
            title: options.title,
            awaits: options.awaits === "maintainer" ? "maintainer" : "agent",
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Captured ${result.id}\n`
                + (result.codeRoot ? `Source code root: ${result.codeRoot}\n` : "")
                + `Knowledge root: ${result.knowledgeRoot}\n`
                + `Pending capture: ${result.path}\n`,
            );
          }
        }),
    )
    .command(
      "list",
      new Command()
        .description("List every pending capture awaiting knowledge-repository triage.")
        .option("-t, --target <path:string>", "Workflow repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const result = await listCaptures(options.target);
          if (options.json) {
            printJson(result);
          } else if (result.captures.length === 0) {
            process.stdout.write("No pending captures.\n");
          } else {
            process.stdout.write(`Pending captures in ${result.knowledgeRoot}:\n`);
            const decisions = result.captures.filter((capture) =>
              capture.awaits === "maintainer"
            );
            const triage = result.captures.filter((capture) => capture.awaits !== "maintainer");
            const section = (title: string, entries: typeof result.captures) => {
              if (entries.length === 0) {
                return;
              }
              process.stdout.write(`\n${title}\n`);
              for (const capture of entries) {
                process.stdout.write(
                  `- ${capture.id}: ${capture.title}${
                    capture.legacy ? " [legacy handoff]" : ""
                  }\n  ${capture.path}\n`,
                );
              }
            };
            // The maintainer's questions first and named as theirs. Listed
            // together with triage they read as a backlog nobody owes an answer.
            section(`Waiting for your decision (${decisions.length})`, decisions);
            section(`Waiting for agent triage (${triage.length})`, triage);
          }
        }),
    )
    .command(
      "resolve",
      new Command()
        .description("Route a pending capture to real owners or discard it with a reason.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Workflow repository.", { default: "." })
        .option("--outcome <outcome:string>", "routed or discarded.", { required: true })
        .option("--reason <reason:string>", "Why this resolution is correct.", {
          required: true,
        })
        .option(
          "--destination <path:string>",
          "Existing knowledge/ or changes/active/ destination; repeat as needed.",
          { collect: true },
        )
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await resolveCapture({
            target: options.target,
            id,
            outcome: parseCaptureOutcome(options.outcome),
            reason: options.reason,
            destinations: collectedStrings(options.destination),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Resolved ${result.id} as ${result.outcome}\n`
                + `Destinations: ${
                  result.destinations.length > 0 ? result.destinations.join(", ") : "none"
                }\n`
                + `Archive: ${result.archivePath}\n`,
            );
          }
        }),
    );
}

function deprecatedHandoffCommand() {
  return new Command()
    .hidden()
    .description("Deprecated alias for wfctl work capture add.")
    .arguments("<slug:string>")
    .option("-t, --target <path:string>", "Workflow repository.", { default: "." })
    .option("--title <title:string>", "Human-readable capture title.", {
      required: true,
    })
    .option("--json", "Print machine-readable JSON.")
    .action(async (options, slug) => {
      const result = await createCapture({
        target: options.target,
        slug,
        title: options.title,
      });
      if (options.json) {
        printJson({ ...result, deprecated: "Use wfctl work capture add" });
      } else {
        process.stdout.write(
          `${yellow("Deprecated:")} use wfctl work capture add\n`
            + `Captured ${result.id}\n`
            + `Pending capture: ${result.path}\n`,
        );
      }
    });
}

function workCheckpointCommand() {
  return new Command()
    .description("Refresh the one resumable checkpoint owned by a change or claimed issue.")
    .arguments("<id:string>")
    .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
      default: ".",
    })
    .option("--issue <id:string>", "Claimed or terminal issue that owns this session.")
    .option("--actor <identity:string>", "Agent or maintainer identity.", { required: true })
    .option("--status <status:string>", "active, blocked, or complete.", {
      default: "active",
    })
    .option("--stage <stage:string>", "shape, wayfind, implement, review, or complete.")
    .option("--state <text:string>", "Concise current state.", { required: true })
    .option("--last <text:string>", "Last material action completed.")
    .option("--next <text:string>", "Exact next action for a fresh session.", {
      required: true,
    })
    .option("--blocker <text:string>", "Current blocker; repeat as needed.", {
      collect: true,
    })
    .option("--json", "Print machine-readable JSON.")
    .action(async (options, id) => {
      const result = await updateWorkCheckpoint({
        target: options.target,
        id,
        ...(options.issue ? { issueId: options.issue } : {}),
        actor: options.actor,
        status: parseCheckpointStatus(options.status),
        ...(options.stage ? { stage: parseCheckpointStage(options.stage) } : {}),
        currentState: options.state,
        ...(options.last ? { lastCompleted: options.last } : {}),
        nextAction: options.next,
        blockers: collectedStrings(options.blocker),
      });
      if (options.json) {
        printJson(result);
      } else {
        process.stdout.write(
          `Checkpoint refreshed: ${result.path}\n`
            + `Status: ${result.status}; stage: ${result.stage}\n`
            + `Current: ${result.currentState}\n`
            + `Next: ${result.nextAction}\n`
            + `Blockers: ${result.blockers.length > 0 ? result.blockers.join(", ") : "none"}\n`,
        );
      }
    });
}

function workContextCommand() {
  return new Command()
    .description(
      "Discover and list the exact bundle files and code context an agent must read for one stage.",
    )
    .arguments("[id:string]")
    .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
      default: ".",
    })
    .option("--stage <stage:string>", "shape, wayfind, implement, review, or resume.", {
      default: "resume",
    })
    .option("--issue <id:string>", "Selected work issue for wayfind or implement.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options, id) => {
      const result = await workBundleContext(
        options.target,
        id,
        parseWorkBundleStage(options.stage),
        options.issue,
      );
      if (options.json) {
        printJson(result);
        return;
      }
      process.stdout.write(
        `Work: ${result.id}\n`
          + `Work bundle: ${result.root}\n`
          + `Stage: ${result.stage}${result.selectedIssue ? ` (${result.selectedIssue})` : ""}\n`
          + `Mode: ${result.mode}${result.mapStatus ? `; map ${result.mapStatus}` : ""}\n`
          + `Frontier: ${result.frontier.length > 0 ? result.frontier.join(", ") : "none"}\n`,
      );
      process.stdout.write("Checkpoints:\n");
      if (result.checkpoints.length === 0) {
        process.stdout.write("- legacy bundle: no structured checkpoint\n");
      }
      for (const checkpoint of result.checkpoints) {
        process.stdout.write(
          `- ${checkpoint.path} [${checkpoint.valid ? "current" : "invalid"}; ${checkpoint.status}/${checkpoint.stage}]\n`
            + `  Current: ${checkpoint.currentState || "missing"}\n`
            + `  Next: ${checkpoint.nextAction || "missing"}\n`
            + `  Blockers: ${checkpoint.blockers.length > 0 ? checkpoint.blockers.join(", ") : "none"}\n`,
        );
      }
      process.stdout.write("Required full reads:\n");
      for (const file of result.requiredFiles) {
        process.stdout.write(
          `- ${file.path} [${file.role}; ${file.accounting}; ${file.sha256.slice(0, 12)}]\n`,
        );
      }
      if (result.validationIssues.length > 0) {
        process.stdout.write("Validation issues:\n");
        for (const issue of result.validationIssues) {
          process.stdout.write(`- ${issue}\n`);
        }
        process.exitCode = 2;
      }
    });
}

function workIssueCommand() {
  return new Command()
    .description("Create, claim, resolve, and inspect bounded bundle issues.")
    .command(
      "create",
      new Command()
        .description("Create one dependency-aware issue inside the central change bundle.")
        .arguments("<id:string> <slug:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--title <title:string>", "Human-readable issue title.", { required: true })
        .option("--phase <phase:string>", "wayfinding or delivery.", { required: true })
        .option(
          "--type <type:string>",
          "research, prototype, grilling, task, or delivery.",
          { required: true },
        )
        .option("--blocked-by <id:string>", "Blocking issue ID; repeat as needed.", {
          collect: true,
        })
        .option("--satisfies <id:string>", "Acceptance ID; repeat as needed.", {
          collect: true,
        })
        .option("--repository <id:string>", "Repository identity; repeat as needed.", {
          collect: true,
        })
        .option("--artifact <path:string>", "Referenced artifacts/ path; repeat as needed.", {
          collect: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, slug) => {
          const result = await createWorkIssue({
            target: options.target,
            id,
            slug,
            title: options.title,
            phase: parseWorkIssuePhase(options.phase),
            type: parseWorkIssueType(options.type),
            blockedBy: collectedStrings(options.blockedBy),
            satisfies: collectedStrings(options.satisfies),
            repositories: collectedStrings(options.repository),
            artifacts: collectedStrings(options.artifact),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Created ${result.id}: ${result.title}\n`
                + `Path: ${result.path}\n`
                + `Blocked by: ${result.blockedBy.length > 0 ? result.blockedBy.join(", ") : "none"}\n`,
            );
          }
        }),
    )
    .command(
      "list",
      new Command()
        .description("Show every issue and the current executable frontier.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await workBundleContext(options.target, id, "resume");
          if (options.json) {
            printJson({ issues: result.issues, frontier: result.frontier });
            return;
          }
          if (result.issues.length === 0) {
            process.stdout.write("No work issues in this bundle.\n");
            return;
          }
          for (const issue of result.issues) {
            process.stdout.write(
              `${issue.frontier ? "FRONTIER" : issue.status.toUpperCase()} ${issue.id} ${issue.title}\n`
                + `  ${issue.phase}/${issue.type}; blockers: ${
                  issue.blockedBy.length > 0 ? issue.blockedBy.join(", ") : "none"
                }\n`,
            );
          }
        }),
    )
    .command(
      "show",
      new Command()
        .description("Show one issue and the exact context needed to work it.")
        .arguments("<id:string> <issue:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue) => {
          const resume = await workBundleContext(options.target, id, "resume", issue);
          const selected = resume.issues.find((entry) => entry.id === issue.toUpperCase());
          if (!selected) {
            throw new Error(`Work issue not found: ${issue}`);
          }
          const result = await workBundleContext(
            options.target,
            id,
            selected.phase === "wayfinding" ? "wayfind" : "implement",
            selected.id,
          );
          if (options.json) {
            printJson({ issue: selected, context: result.requiredFiles });
          } else {
            process.stdout.write(
              `${selected.id}: ${selected.title}\n`
                + `Status: ${selected.status}; phase: ${selected.phase}; type: ${selected.type}\n`
                + `Path: ${selected.path}\nRequired full reads:\n`,
            );
            for (const file of result.requiredFiles) {
              process.stdout.write(`- ${file.path} [${file.accounting}]\n`);
            }
          }
        }),
    )
    .command(
      "claim",
      new Command()
        .description("Claim a frontier issue from the exact current work context.")
        .arguments("<id:string> <issue:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--actor <identity:string>", "Agent or maintainer identity.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue) => {
          const result = await claimWorkIssue({
            target: options.target,
            id,
            issueId: issue,
            actor: options.actor,
          });
          if (options.json) printJson(result);
          else process.stdout.write(`Claimed ${result.id}: ${result.title}\n`);
        }),
    )
    .command(
      "block",
      new Command()
        .description("Add one blocking edge and reject dependency cycles.")
        .arguments("<id:string> <issue:string> <blocker:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue, blocker) => {
          const result = await setWorkIssueBlocker(
            options.target,
            id,
            issue,
            blocker,
            true,
          );
          if (options.json) printJson(result);
          else process.stdout.write(`${result.id} is now blocked by ${blocker.toUpperCase()}\n`);
        }),
    )
    .command(
      "unblock",
      new Command()
        .description("Remove one blocking edge after explicit graph review.")
        .arguments("<id:string> <issue:string> <blocker:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue, blocker) => {
          const result = await setWorkIssueBlocker(
            options.target,
            id,
            issue,
            blocker,
            false,
          );
          if (options.json) printJson(result);
          else process.stdout.write(`${result.id} is no longer blocked by ${blocker.toUpperCase()}\n`);
        }),
    )
    .command(
      "release",
      new Command()
        .description("Release an unfinished claim back to the frontier.")
        .arguments("<id:string> <issue:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue) => {
          const result = await releaseWorkIssue(options.target, id, issue);
          if (options.json) printJson(result);
          else process.stdout.write(`Released ${result.id}: ${result.title}\n`);
        }),
    )
    .command(
      "complete",
      new Command()
        .description("Resolve a claimed issue with a concise answer and evidence.")
        .arguments("<id:string> <issue:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--summary <text:string>", "Resolution or delivered outcome.", {
          required: true,
        })
        .option("--evidence <text:string>", "Evidence entry; repeat as needed.", {
          collect: true,
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue) => {
          const result = await completeWorkIssue({
            target: options.target,
            id,
            issueId: issue,
            summary: options.summary,
            evidence: collectedStrings(options.evidence),
          });
          if (options.json) printJson(result);
          else process.stdout.write(`Completed ${result.id}: ${result.title}\n`);
        }),
    )
    .command(
      "drop",
      new Command()
        .description("Remove an issue from the route with an explicit reason.")
        .arguments("<id:string> <issue:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--reason <text:string>", "Why this issue no longer belongs on the route.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, issue) => {
          const result = await dropWorkIssue(options.target, id, issue, options.reason);
          if (options.json) printJson(result);
          else process.stdout.write(`Dropped ${result.id}: ${result.title}\n`);
        }),
    );
}

function workMapCommand() {
  return new Command()
    .description("Operate the deliberate Wayfinder phase of a change bundle.")
    .command(
      "status",
      new Command()
        .description("Show the map, fog state, issue graph, and current frontier.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await workBundleContext(options.target, id, "wayfind");
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Wayfinder ${id}: ${result.mapStatus ?? "missing map"}\n`
                + `Destination: ${result.destination || "not set"}\n`
                + `Fog: ${result.fog?.length ?? 0} item(s)\n`
                + `Frontier: ${result.frontier.length > 0 ? result.frontier.join(", ") : "none"}\n`
                + `Map: ${result.requiredFiles.find((entry) => entry.path === "map.md")?.path ?? "missing"}\n`,
            );
          }
        }),
    )
    .command(
      "finish",
      new Command()
        .description(
          "Finish a clear, already-synthesized map into full or slice delivery shaping.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--mode <mode:string>", "full or slice delivery mode.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await finishWayfinder(
            options.target,
            id,
            parseDeliveryMode(options.mode),
          );
          if (options.json) printJson(result);
          else {
            process.stdout.write(
              `Wayfinder resolved; ${id} returned to ${result.mode} delivery shaping.\n`
                + `Change: ${result.changePath}\nMap: ${result.mapPath}\n`,
            );
          }
        }),
    );
}

function workReviewCommand() {
  return new Command()
    .description("Account for every bundle file at its current content hash.")
    .command(
      "status",
      new Command()
        .description("Show complete bundle accounting and stale or unseen files.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await workBundleContext(options.target, id, "review");
          if (options.json) {
            printJson(result);
            return;
          }
          for (const file of result.inventory) {
            process.stdout.write(
              `${file.accounting.toUpperCase().padEnd(20)} ${file.path} ${file.sha256.slice(0, 12)}\n`,
            );
          }
        }),
    )
    .command(
      "file",
      new Command()
        .description("Record a full-file review receipt at the current hash.")
        .arguments("<id:string> <path:string>")
        .option("-t, --target <path:string>", "Knowledge repository or bound leaf.", {
          default: ".",
        })
        .option("--status <status:string>", "reviewed or irrelevant.", {
          default: "reviewed",
        })
        .option("--reason <text:string>", "Required when an artifact is irrelevant.", {
          default: "",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, path) => {
          const result = await reviewWorkBundleFile(
            options.target,
            id,
            path,
            parseBundleReviewStatus(options.status),
            options.reason,
          );
          if (options.json) printJson(result);
          else {
            process.stdout.write(
              `${result.accounting.toUpperCase()} ${result.path} ${result.sha256}\n`,
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
        + "Product views explain current behavior to stakeholders; engineering views record verified realization.\n"
        + "wfctl validates views, quality receipts, and explicit relations; QMD provides semantic retrieval.",
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
        .description(
          "Validate knowledge views, provenance, delivery state, and semantic quality receipts.",
        )
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
            agents: await recordedAgents(options.target),
          }).catch((error: unknown) => {
            if (error instanceof ReconstructionDependencyError) {
              if (options.json) {
                printJson({ error: error.message, check: error.check });
              } else {
                process.stderr.write(`wfctl: ${error.message}\n`);
                printRemediations([error.check]);
              }
              process.exitCode = 1;
              return undefined;
            }
            throw error;
          });
          if (!result) {
            return;
          }
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
      "context",
      new Command()
        .description(
          "Discover the active reconstruction and emit the complete clean-session resume context.",
        )
        .arguments("[id:string]")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON with every outstanding coverage item.")
        .action(async (options, id) => {
          const result = await reconstructionContext(options.target, id);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Reconstruction: ${result.id} — ${result.title}\n`
                + `Mode: ${result.mode}\n`
                + `Root: ${result.root}\n`
                + `Raw: ${result.rawScope.status || "pending"}; scope ${result.rawScope.mode || "undecided"}`
                + `${result.rawScope.paths.length > 0 ? ` (${result.rawScope.paths.join(", ")})` : ""}`
                + `${result.rawScope.decidedBy ? `; by ${result.rawScope.decidedBy}` : ""}\n`
                + `Checkpoint: ${
                  result.checkpoint
                    ? `${result.checkpoint.valid ? "current" : "stale/invalid"}; `
                      + `${result.checkpoint.status}/${result.checkpoint.stage}`
                    : "legacy record without structured checkpoint"
                }\n`,
            );
            process.stdout.write(
              `Orchestration: ${result.orchestration.execution || "not planned"}; `
                + `${result.orchestration.status || "pending"}; `
                + `parallel ${result.orchestration.maxParallel}; `
                + `workstreams ${result.workstreams.length}/${result.orchestration.maxWorkstreams}; `
                + `retries ${result.orchestration.maxRetriesPerWorkstream}\n`
                + `Synthesis: ${result.orchestration.synthesisStatus || "pending"}; `
                + `independent review: ${result.orchestration.independentReviewStatus || "pending"}`
                + `${result.orchestration.independentReviewAssurance ? ` (${result.orchestration.independentReviewAssurance})` : ""}`
                + `${result.orchestration.independentReviewProfile ? `; profile ${result.orchestration.independentReviewProfile}` : ""}`
                + `${result.orchestration.independentReviewModel ? `; ${result.orchestration.independentReviewModel}/${result.orchestration.independentReviewReasoningEffort || "unspecified"}` : ""}`
                + `${result.orchestration.independentReviewRunId ? `; run ${result.orchestration.independentReviewRunId}` : ""}\n`,
            );
            if (result.orchestration.reason) {
              process.stdout.write(`Orchestration reason: ${result.orchestration.reason}\n`);
            }
            if (result.checkpoint) {
              process.stdout.write(
                `Current: ${result.checkpoint.currentState || "missing"}\n`
                  + `Last: ${result.checkpoint.lastCompleted || "missing"}\n`
                  + `Next: ${result.checkpoint.nextAction || "missing"}\n`
                  + `Blockers: ${
                    result.checkpoint.blockers.length > 0
                      ? result.checkpoint.blockers.join(", ")
                      : "none"
                  }\n`,
              );
            }
            process.stdout.write("Required complete reads/state:\n");
            for (const file of result.requiredFiles) {
              process.stdout.write(
                `- ${file.path} [${file.role}; ${file.bytes} bytes; ${file.sha256.slice(0, 12)}]\n`,
              );
            }
            process.stdout.write(
              `Workstreams: ${result.workstreams.length === 0 ? "none yet" : result.workstreams.length}\n`,
            );
            for (const workstream of result.workstreams) {
              process.stdout.write(
                `- wave ${workstream.wave} ${workstream.id}: ${workstream.status}`
                  + `; ${workstream.workload || "unclassified"}/${workstream.requestedProfile || "unrouted"}`
                  + `; review ${workstream.reviewStatus || "pending"}`
                  + `${workstream.owner ? `; owner ${workstream.owner}` : ""}\n`
                  + `  execution ${workstream.executionProfile || "unrouted"}`
                  + `/${workstream.executionModel || "not claimed"}`
                  + `/${workstream.executionReasoningEffort || "not claimed"}`
                  + `; escalations ${workstream.escalationCount}\n`
                  + `  ${workstream.title}\n`
                  + `  ${workstream.path}\n`,
              );
            }
            process.stdout.write("Complete coverage frontier:\n");
            for (const summary of result.coverage) {
              printCoverageSummary(summary, true);
            }
            if (result.validationIssues.length > 0) {
              process.stdout.write("Resume validation issues:\n");
              for (const issue of result.validationIssues) {
                process.stdout.write(`- ${issue}\n`);
              }
            }
          }
          if (result.validationIssues.length > 0) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "checkpoint",
      new Command()
        .description("Refresh the resumable reconstruction checkpoint after material progress.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--actor <identity:string>", "Agent or maintainer identity.", { required: true })
        .option("--status <status:string>", "active or blocked.", { default: "active" })
        .option(
          "--stage <stage:string>",
          "setup, repository-analysis, reconciliation, promotion, or review.",
          { required: true },
        )
        .option("--state <text:string>", "Concise current reconstruction state.", { required: true })
        .option("--last <text:string>", "Last material action completed.", { required: true })
        .option("--next <text:string>", "Exact next action for a fresh session.", { required: true })
        .option("--blocker <text:string>", "Current blocker; repeat as needed.", { collect: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await updateReconstructionCheckpoint({
            target: options.target,
            id,
            status: parseKnowledgeSessionStatus(options.status),
            stage: parseReconstructionCheckpointStage(options.stage),
            actor: options.actor,
            currentState: options.state,
            lastCompleted: options.last,
            nextAction: options.next,
            blockers: collectedStrings(options.blocker),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Reconstruction checkpoint refreshed: ${result.status}/${result.stage}\n`
                + `Current: ${result.currentState}\n`
                + `Next: ${result.nextAction}\n`,
            );
          }
        }),
    )
    .command(
      "raw-scope",
      new Command()
        .description(
          "Record the maintainer's reconstruction-start raw decision before linked intake begins.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--mode <mode:string>", "all, selected, excluded, or unavailable.", {
          required: true,
        })
        .option(
          "--path <path:string>",
          "Approved path under raw/; repeat for selected mode.",
          { collect: true },
        )
        .option(
          "--by <actor:string>",
          "Approving human actor; required except for verified unavailable input.",
        )
        .option("--note <text:string>", "Maintainer decision or absence rationale.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await approveReconstructionRawScope({
            target: options.target,
            id,
            mode: parseReconstructionRawScopeMode(options.mode),
            paths: collectedStrings(options.path),
            ...(options.by === undefined ? {} : { approvedBy: options.by }),
            note: options.note,
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Raw reconstruction scope: ${result.mode}\n`
                + `Status: ${result.status}; frozen files: ${result.rawFiles}\n`
                + `Decision: ${result.approvedBy} at ${result.approvedAt}\n`
                + `Paths: ${result.paths.length > 0 ? result.paths.join(", ") : "none"}\n`,
            );
          }
        }),
    )
    .command(
      "repin",
      new Command()
        .description(
          "Move one bound repository to its checkout's current commit.\n"
            + "Carries dispositions and receipts across every byte-identical blob;\n"
            + "changed, added, and deleted paths return to pending.",
        )
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--repository <name:string>", "Durable repository identity to move.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await repinReconstructionRepository({
            target: options.target,
            id,
            repository: options.repository,
          });
          if (options.json) {
            printJson(result);
            return;
          }
          process.stdout.write(
            `Repinned ${result.repository}\n`
              + `${result.fromCommit} -> ${result.toCommit}\n`
              + `unchanged ${result.counts.unchanged}  modified ${result.counts.modified}  `
              + `added ${result.counts.added}  removed ${result.counts.removed}\n`
              + `Receipts invalidated: ${result.invalidatedReceipts.length}\n`,
          );
          if (result.affectedClaims.length > 0) {
            process.stdout.write(
              `Claims citing an invalidated receipt: ${result.affectedClaims.join(", ")}\n`
                + "Re-verify each against the new pin; none were rewritten.\n",
            );
          }
        }),
    )
    .command("workstream", reconstructionWorkstreamCommand())
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
                + `[${result.complete ? "complete" : "more remains"}]\n`
                + `Receipt: ${result.receiptId}\n`,
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

function reconstructionWorkstreamCommand() {
  return new Command()
    .description(
      "Agent-facing lifecycle for bounded reconstruction worker packets.",
    )
    .command(
      "create",
      new Command()
        .description("Create and register one semantic workstream packet.")
        .arguments("<id:string> <workstream:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--title <text:string>", "Bounded human-readable outcome.", { required: true })
        .option("--objective <text:string>", "Independent research question.", { required: true })
        .option("--role <role:string>", "Worker role.", { required: true })
        .option("--workload <kind:string>", "exploration, analysis, synthesis, or review.", { required: true })
        .option("--profile <profile:string>", "Host-neutral compute profile: fast, balanced, or deep.", { required: true })
        .option("--routing-reason <text:string>", "Why this is the minimum sufficient profile.", { required: true })
        .option("--wave <number:string>", "Positive orchestration wave.", { required: true })
        .option("--repository <id:string>", "Owned repository; repeat.", { collect: true })
        .option("--file <ref:string>", "Owned <repository>#<path>; repeat.", { collect: true })
        .option("--community <ref:string>", "Owned <repository>#<community>; repeat.", { collect: true })
        .option("--surface <ref:string>", "Owned <repository>#<surface>; repeat.", { collect: true })
        .option("--raw-case <id:string>", "Owned linked raw intake case; repeat.", { collect: true })
        .option("--dependency <id:string>", "Earlier workstream dependency; repeat.", { collect: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, workstream) => {
          if (!RECONSTRUCTION_WORKLOADS.includes(options.workload as ReconstructionWorkload)) {
            throw new Error("--workload must be exploration, analysis, synthesis, or review");
          }
          if (!RECONSTRUCTION_PROFILES.includes(options.profile as ReconstructionProfile)) {
            throw new Error("--profile must be fast, balanced, or deep");
          }
          const result = await createReconstructionWorkstream({
            target: options.target,
            id,
            workstream,
            title: options.title,
            objective: options.objective,
            role: options.role,
            workload: options.workload as ReconstructionWorkload,
            profile: options.profile as ReconstructionProfile,
            routingReason: options.routingReason,
            wave: parseLineNumber(options.wave, "--wave"),
            repositories: collectedStrings(options.repository),
            files: collectedStrings(options.file),
            communities: collectedStrings(options.community),
            surfaces: collectedStrings(options.surface),
            rawCases: collectedStrings(options.rawCase),
            dependencies: collectedStrings(options.dependency),
          });
          printWorkstreamMutation(result, options.json);
        }),
    )
    .command(
      "claim",
      new Command()
        .description("Claim a planned or rework packet for one concrete agent run.")
        .arguments("<id:string> <workstream:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--by <actor:string>", "Stable worker identity.", { required: true })
        .option("--host <host:string>", "Agent host identity.", { required: true })
        .option("--run-id <id:string>", "Actual host session/run ID, or unavailable:<reason>.", { required: true })
        .option("--model <model:string>", "Selected model, or host-auto when the host routes it.", { default: "host-auto" })
        .option("--effort <effort:string>", "Selected reasoning effort, or profile-default.", { default: "profile-default" })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, workstream) => {
          const result = await claimReconstructionWorkstream({
            target: options.target,
            id,
            workstream,
            actor: options.by,
            host: options.host,
            runId: options.runId,
            model: options.model,
            reasoningEffort: options.effort,
          });
          printWorkstreamMutation(result, options.json);
        }),
    )
    .command(
      "escalate",
      new Command()
        .description("Record how an observable quality signal changes or constrains routing.")
        .arguments("<id:string> <workstream:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--by <actor:string>", "Orchestrator or reviewer identity.", { required: true })
        .option("--trigger <trigger:string>", "Observed escalation trigger.", { required: true })
        .option("--action <action:string>", "Recorded response to the trigger.", { required: true })
        .option("--to-profile <profile:string>", "Higher profile for stronger-profile action.")
        .option("--target-workstream <id:string>", "Registered follow-up packet for new-workstream action.")
        .option("--reason <text:string>", "Evidence-based routing explanation.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, workstream) => {
          if (
            !RECONSTRUCTION_ESCALATION_TRIGGERS.includes(
              options.trigger as ReconstructionEscalationTrigger,
            )
          ) {
            throw new Error(
              `--trigger must be one of: ${RECONSTRUCTION_ESCALATION_TRIGGERS.join(", ")}`,
            );
          }
          if (
            !RECONSTRUCTION_ESCALATION_ACTIONS.includes(
              options.action as ReconstructionEscalationAction,
            )
          ) {
            throw new Error(
              `--action must be one of: ${RECONSTRUCTION_ESCALATION_ACTIONS.join(", ")}`,
            );
          }
          if (
            options.toProfile !== undefined
            && !RECONSTRUCTION_PROFILES.includes(options.toProfile as ReconstructionProfile)
          ) {
            throw new Error("--to-profile must be fast, balanced, or deep");
          }
          const result = await escalateReconstructionWorkstream({
            target: options.target,
            id,
            workstream,
            actor: options.by,
            trigger: options.trigger as ReconstructionEscalationTrigger,
            action: options.action as ReconstructionEscalationAction,
            reason: options.reason,
            ...(options.toProfile === undefined
              ? {}
              : { targetProfile: options.toProfile as ReconstructionProfile }),
            ...(options.targetWorkstream === undefined
              ? {}
              : { targetWorkstream: options.targetWorkstream }),
          });
          printWorkstreamMutation(result, options.json);
        }),
    )
    .command(
      "submit",
      new Command()
        .description("Validate and submit the current owner's completed packet.")
        .arguments("<id:string> <workstream:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--by <actor:string>", "Recorded worker owner.", { required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, workstream) => {
          const result = await submitReconstructionWorkstream({
            target: options.target,
            id,
            workstream,
            actor: options.by,
          });
          printWorkstreamMutation(result, options.json);
        }),
    )
    .command(
      "review",
      new Command()
        .description("Accept or return submitted work, or review-cancel an obsolete packet.")
        .arguments("<id:string> <workstream:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--by <actor:string>", "Reviewer identity; must differ from owner.", { required: true })
        .option("--status <status:string>", "accepted, rework, or cancelled.", { required: true })
        .option("--note <text:string>", "Review finding; repeat.", { collect: true, required: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, workstream) => {
          if (!["accepted", "rework", "cancelled"].includes(options.status)) {
            throw new Error("--status must be accepted, rework, or cancelled");
          }
          const result = await reviewReconstructionWorkstream({
            target: options.target,
            id,
            workstream,
            reviewer: options.by,
            status: options.status as "accepted" | "rework" | "cancelled",
            notes: collectedStrings(options.note),
          });
          printWorkstreamMutation(result, options.json);
        }),
    );
}

function printWorkstreamMutation(
  result: { id: string; workstream: string; status: string; path: string },
  json: boolean | undefined,
): void {
  if (json) {
    printJson(result);
    return;
  }
  process.stdout.write(
    `Workstream ${result.workstream}: ${result.status}\nPacket: ${result.path}\n`,
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
        .option(
          "--path <path:string>",
          "Limit inventory to a path under raw/; repeat as needed.",
          { collect: true },
        )
        .option("--json", "Print machine-readable JSON.")
        .action(async (options) => {
          const paths = collectedStrings(options.path);
          const result = await inventoryRaw({
            target: options.target,
            baseline: options.baseline,
            ...(paths.length > 0 ? { paths } : {}),
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
          "--reconstruction <id:string>",
          "Parent reconstruction with a maintainer-approved raw scope.",
        )
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
            ...(options.reconstruction === undefined
              ? {}
              : { reconstructionId: options.reconstruction }),
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
      "context",
      new Command()
        .description(
          "Discover the active raw-intake case and emit the complete clean-session resume context.",
        )
        .arguments("[id:string]")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await intakeContext(options.target, id);
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Raw-intake case: ${result.id} — ${result.title}\n`
                + `Root: ${result.root}\n`
                + `Sources: ${result.reviewed}/${result.files} reviewed; `
                + `${result.pendingSources.length} pending; ${result.blockedSources.length} blocked\n`
                + `Checkpoint: ${
                  result.checkpoint
                    ? `${result.checkpoint.valid ? "current" : "stale/invalid"}; `
                      + `${result.checkpoint.status}/${result.checkpoint.stage}`
                    : "legacy record without structured checkpoint"
                }\n`,
            );
            if (result.checkpoint) {
              process.stdout.write(
                `Current: ${result.checkpoint.currentState || "missing"}\n`
                  + `Last: ${result.checkpoint.lastCompleted || "missing"}\n`
                  + `Next: ${result.checkpoint.nextAction || "missing"}\n`
                  + `Blockers: ${
                    result.checkpoint.blockers.length > 0
                      ? result.checkpoint.blockers.join(", ")
                      : "none"
                  }\n`,
              );
            }
            process.stdout.write("Required complete reads:\n");
            for (const file of result.requiredFiles) {
              process.stdout.write(
                `- ${file.path} [${file.role}; ${file.bytes} bytes; ${file.sha256.slice(0, 12)}]\n`,
              );
            }
            if (result.pendingSources.length > 0) {
              process.stdout.write("Pending frozen sources:\n");
              for (const path of result.pendingSources) {
                process.stdout.write(`- ${path}\n`);
              }
            }
            if (result.validationIssues.length > 0) {
              process.stdout.write("Resume validation issues:\n");
              for (const issue of result.validationIssues) {
                process.stdout.write(`- ${issue}\n`);
              }
            }
          }
          if (result.validationIssues.length > 0) {
            process.exitCode = 2;
          }
        }),
    )
    .command(
      "checkpoint",
      new Command()
        .description("Refresh the resumable raw-intake checkpoint after material progress.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--actor <identity:string>", "Agent or maintainer identity.", { required: true })
        .option("--status <status:string>", "active or blocked.", { default: "active" })
        .option(
          "--stage <stage:string>",
          "source-review, adjudication, promotion, omission-audit, or review.",
          { required: true },
        )
        .option("--state <text:string>", "Concise current intake state.", { required: true })
        .option("--last <text:string>", "Last material action completed.", { required: true })
        .option("--next <text:string>", "Exact next action for a fresh session.", { required: true })
        .option("--blocker <text:string>", "Current blocker; repeat as needed.", { collect: true })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await updateIntakeCheckpoint({
            target: options.target,
            id,
            status: parseKnowledgeSessionStatus(options.status),
            stage: parseIntakeCheckpointStage(options.stage),
            actor: options.actor,
            currentState: options.state,
            lastCompleted: options.last,
            nextAction: options.next,
            blockers: collectedStrings(options.blocker),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Raw-intake checkpoint refreshed: ${result.status}/${result.stage}\n`
                + `Current: ${result.currentState}\n`
                + `Next: ${result.nextAction}\n`,
            );
          }
        }),
    )
    .command(
      "read",
      new Command()
        .description(
          "Read a bounded range from one frozen raw blob and record the full-read receipt.",
        )
        .arguments("<id:string> <path:string>")
        .option("-t, --target <path:string>", "Knowledge repository.", { default: "." })
        .option("--start <line:string>", "First one-based line.")
        .option("--end <line:string>", "Last one-based line; at most 400 lines per read.")
        .option("--by <actor:string>", "Reading agent actor.", {
          default: "workflow-agent/1",
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id, path) => {
          const result = await readIntakeSource({
            target: options.target,
            id,
            path,
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
              `${result.path} lines ${result.startLine}-${result.endLine}/${result.totalLines} `
                + `[${result.complete ? "complete" : "more remains"}]\n`
                + `Receipt: ${result.receiptId}\n`,
            );
            if (result.content) {
              const width = String(result.endLine).length;
              for (const [offset, line] of result.content.split("\n").entries()) {
                process.stdout.write(
                  `${String(result.startLine + offset).padStart(width)} | ${line}\n`,
                );
              }
            }
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
        .option(
          "--non-text-reason <text:string>",
          "Required disposition rationale for binary or unsupported input.",
        )
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
            ...(options.nonTextReason === undefined
              ? {}
              : { nonTextReason: options.nonTextReason }),
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
  if (value !== "full" && value !== "slice" && value !== "wayfinder") {
    throw new Error(`Invalid mode "${value}"; expected full, slice, or wayfinder`);
  }
  return value;
}

function parseDeliveryMode(value: string): "full" | "slice" {
  if (value !== "full" && value !== "slice") {
    throw new Error(`Invalid delivery mode "${value}"; expected full or slice`);
  }
  return value;
}

function parseWorkBundleStage(value: string): WorkBundleStage {
  if (!["shape", "wayfind", "implement", "review", "resume"].includes(value)) {
    throw new Error(
      `Invalid work context stage "${value}"; expected shape, wayfind, implement, review, or resume`,
    );
  }
  return value as WorkBundleStage;
}

function parseCheckpointStage(value: string): WorkCheckpointStage {
  if (!["shape", "wayfind", "implement", "review", "complete"].includes(value)) {
    throw new Error(
      `Invalid checkpoint stage "${value}"; expected shape, wayfind, implement, review, or complete`,
    );
  }
  return value as WorkCheckpointStage;
}

function parseCheckpointStatus(value: string): WorkCheckpointStatus {
  if (!["active", "blocked", "complete"].includes(value)) {
    throw new Error(
      `Invalid checkpoint status "${value}"; expected active, blocked, or complete`,
    );
  }
  return value as WorkCheckpointStatus;
}

function parseKnowledgeSessionStatus(value: string): "active" | "blocked" {
  if (value !== "active" && value !== "blocked") {
    throw new Error(`Invalid knowledge-session status "${value}"; expected active or blocked`);
  }
  return value;
}

function parseReconstructionCheckpointStage(
  value: string,
): "setup" | "repository-analysis" | "reconciliation" | "promotion" | "review" {
  if (![
    "setup",
    "repository-analysis",
    "reconciliation",
    "promotion",
    "review",
  ].includes(value)) {
    throw new Error(
      `Invalid reconstruction checkpoint stage "${value}"; expected setup, repository-analysis, reconciliation, promotion, or review`,
    );
  }
  return value as "setup" | "repository-analysis" | "reconciliation" | "promotion" | "review";
}

function parseReconstructionRawScopeMode(
  value: string,
): ReconstructionRawScopeMode {
  if (!["all", "selected", "excluded", "unavailable"].includes(value)) {
    throw new Error(
      `Invalid reconstruction raw scope "${value}"; expected all, selected, excluded, or unavailable`,
    );
  }
  return value as ReconstructionRawScopeMode;
}

function parseIntakeCheckpointStage(
  value: string,
): "source-review" | "adjudication" | "promotion" | "omission-audit" | "review" {
  if (![
    "source-review",
    "adjudication",
    "promotion",
    "omission-audit",
    "review",
  ].includes(value)) {
    throw new Error(
      `Invalid intake checkpoint stage "${value}"; expected source-review, adjudication, promotion, omission-audit, or review`,
    );
  }
  return value as "source-review" | "adjudication" | "promotion" | "omission-audit" | "review";
}

function parseCaptureOutcome(value: string): CaptureOutcome {
  if (value !== "routed" && value !== "discarded") {
    throw new Error(`Invalid capture outcome "${value}"; expected routed or discarded`);
  }
  return value;
}

function parseWorkIssuePhase(value: string): WorkIssuePhase {
  if (value !== "wayfinding" && value !== "delivery") {
    throw new Error(`Invalid issue phase "${value}"; expected wayfinding or delivery`);
  }
  return value;
}

function parseWorkIssueType(value: string): WorkIssueType {
  if (!["research", "prototype", "grilling", "task", "delivery"].includes(value)) {
    throw new Error(
      `Invalid issue type "${value}"; expected research, prototype, grilling, task, or delivery`,
    );
  }
  return value as WorkIssueType;
}

function parseBundleReviewStatus(value: string): BundleReviewStatus {
  if (value !== "reviewed" && value !== "irrelevant") {
    throw new Error(`Invalid review status "${value}"; expected reviewed or irrelevant`);
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
  printRemediations(checks);
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
  printRemediations(report.checks);
  printQmdSetup(report.checks);
  printCheckSummary(report.checks);
}

/**
 * Agent platforms recorded at installation, used to render native-skill
 * remediation steps. Falls back to every supported target when the repository
 * chose not to install skills.
 */
async function recordedAgents(target: string): Promise<AgentTarget[]> {
  try {
    const config = await readConfig(resolve(target));
    const agents = config.skills?.agents ?? [];
    return agents.length > 0 ? agents : ["codex", "claude"];
  } catch {
    return ["codex", "claude"];
  }
}

function printRemediations(checks: DoctorCheck[]): void {
  for (const check of checks) {
    if (check.status === "pass" || !check.remediation) {
      continue;
    }
    process.stdout.write(
      `\n${yellow(bold(`Next step · ${check.remediation.title}`))}\n`,
    );
    for (const [index, step] of check.remediation.steps.entries()) {
      const action = step.command ? cyan(step.command) : step.detail;
      const detail = step.command ? ` ${dim(step.detail)}` : "";
      process.stdout.write(`  ${index + 1}. ${action}${detail}\n`);
    }
  }
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
    "reconstruction-pin": "Reconstruction pin",
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
