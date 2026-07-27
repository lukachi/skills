import { Command } from "@cliffy/command";
import { resolve } from "node:path";
import { applyInstallPlan } from "./applier.js";
import {
  findDistributionRoot,
  renderAgentInstructions,
  renderMaintainerGuide,
} from "./assets.js";
import {
  applyBootstrapPlan,
  buildBootstrapPlan,
  summarizeBootstrapPlan,
} from "./bootstrap.js";
import type { BootstrapAgent } from "./bootstrap.js";
import {
  createConfig,
  errorMessage,
  readConfig,
  resolveKnowledgeRoot,
} from "./config.js";
import { doctorPassed, runDoctor } from "./doctor.js";
import { buildInstallPlan, summarizePlan } from "./planner.js";
import type { Profile, WorkMode, WorkOutcome } from "./types.js";
import { WORKFLOW_VERSION } from "./types.js";
import { beginWork, flushWork, verifyWork } from "./work.js";

const main = new Command()
  .name("wfctl")
  .version(WORKFLOW_VERSION)
  .description("Bootstrap and enforce a shared agent project workflow.")
  .throwErrors()
  .command("plan", installCommand("Show the exact installation plan.", false))
  .command("apply", installCommand("Apply a conflict-free installation plan.", true))
  .command("init", installCommand("Initialize a workflow environment.", true))
  .command("sync", syncCommand())
  .command("bootstrap", bootstrapCommand())
  .command("render", renderCommand())
  .command("doctor", doctorCommand())
  .command("work", workCommand());

try {
  await main.parse(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`wfctl: ${errorMessage(error)}\n`);
  process.exitCode = 1;
}

function installCommand(description: string, apply: boolean) {
  return new Command()
    .description(description)
    .arguments("<profile:string>")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("-k, --knowledge <path:string>", "Knowledge repository for a leaf profile.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options, profileValue) => {
      const profile = parseProfile(profileValue);
      const target = resolve(options.target);
      const knowledge = options.knowledge ? resolve(options.knowledge) : undefined;
      const plan = await buildInstallPlan({
        target,
        profile,
        ...(knowledge ? { knowledge } : {}),
      });
      if (!apply) {
        printPlan(plan, options.json === true);
        if (plan.operations.some((operation) => operation.status === "conflict")) {
          process.exitCode = 2;
        }
        return;
      }

      const result = await applyInstallPlan(plan);
      if (options.json) {
        printJson({ ...summarizePlan(plan), applied: result });
      } else {
        process.stdout.write(
          `Applied ${result.changed} change(s) to ${plan.target}\nState: ${result.statePath}\nGuide: ${resolve(plan.target, "PROJECT_WORKFLOW.md")}\n`,
        );
      }
    });
}

function syncCommand() {
  return new Command()
    .description("Synchronize an existing workflow installation.")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("--plan", "Show the plan without applying it.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const target = resolve(options.target);
      const config = await readConfig(target);
      const knowledge = config.profile === "leaf"
        ? resolveKnowledgeRoot(target, config)
        : undefined;
      const plan = await buildInstallPlan({
        target,
        profile: config.profile,
        ...(knowledge ? { knowledge } : {}),
      });
      if (options.plan) {
        printPlan(plan, options.json === true);
        if (plan.operations.some((operation) => operation.status === "conflict")) {
          process.exitCode = 2;
        }
        return;
      }
      const result = await applyInstallPlan(plan);
      if (options.json) {
        printJson({ ...summarizePlan(plan), applied: result });
      } else {
        process.stdout.write(`Synchronized ${result.changed} change(s) in ${target}\n`);
      }
    });
}

function bootstrapCommand() {
  return new Command()
    .description("Install the user-level setup skill for clean repositories.")
    .command("plan", bootstrapActionCommand(false))
    .command("install", bootstrapActionCommand(true));
}

function bootstrapActionCommand(apply: boolean) {
  return new Command()
    .description(
      apply
        ? "Install or safely update the user-level setup skill."
        : "Show the user-level setup skill installation plan.",
    )
    .option("--agent <agent:string>", "codex, claude, or both.", { default: "both" })
    .option("--codex-skills-root <path:string>", "Override the Codex user skills root.")
    .option("--claude-skills-root <path:string>", "Override the Claude user skills root.")
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const plan = await buildBootstrapPlan({
        agent: parseBootstrapAgent(options.agent),
        ...(options.codexSkillsRoot
          ? { codexSkillsRoot: resolve(options.codexSkillsRoot) }
          : {}),
        ...(options.claudeSkillsRoot
          ? { claudeSkillsRoot: resolve(options.claudeSkillsRoot) }
          : {}),
      });
      if (!apply) {
        printBootstrapPlan(plan, options.json === true);
        if (plan.operations.some((operation) => operation.status === "conflict")) {
          process.exitCode = 2;
        }
        return;
      }

      const result = await applyBootstrapPlan(plan);
      if (options.json) {
        printJson({ ...summarizeBootstrapPlan(plan), applied: result });
      } else {
        process.stdout.write(
          `Installed bootstrap skill with ${result.changed} change(s)\n${
            result.statePaths.map((path) => `State: ${path}`).join("\n")
          }\n`,
        );
      }
    });
}

function renderCommand() {
  return new Command()
    .description("Render text for manual integration.")
    .command(
      "agents",
      new Command()
        .description("Render the wfctl AGENTS.md / CLAUDE.md managed block.")
        .option("-p, --profile <profile:string>", "knowledge or leaf.", { required: true })
        .option("-t, --target <path:string>", "Target repository.", { default: "." })
        .option("-k, --knowledge <path:string>", "Knowledge repository for a leaf profile.")
        .action(async (options) => {
          const profile = parseProfile(options.profile);
          const target = resolve(options.target);
          const config = createConfig(
            profile,
            target,
            options.knowledge ? resolve(options.knowledge) : undefined,
          );
          const distributionRoot = await findDistributionRoot();
          const body = await renderAgentInstructions(
            distributionRoot,
            profile,
            config.knowledge?.path,
          );
          process.stdout.write(`<!-- wfctl:begin -->\n${body}\n<!-- wfctl:end -->\n`);
        }),
    )
    .command(
      "guide",
      new Command()
        .description("Render the maintainer-facing project workflow guide.")
        .option("-p, --profile <profile:string>", "knowledge or leaf.", { required: true })
        .option("-t, --target <path:string>", "Target repository.", { default: "." })
        .option("-k, --knowledge <path:string>", "Knowledge repository for a leaf profile.")
        .action(async (options) => {
          const profile = parseProfile(options.profile);
          const target = resolve(options.target);
          const config = createConfig(
            profile,
            target,
            options.knowledge ? resolve(options.knowledge) : undefined,
          );
          const distributionRoot = await findDistributionRoot();
          const guide = await renderMaintainerGuide(
            distributionRoot,
            profile,
            config.knowledge?.path,
          );
          process.stdout.write(`<!-- wfctl:begin -->\n${guide}\n<!-- wfctl:end -->\n`);
        }),
    );
}

function doctorCommand() {
  return new Command()
    .description("Diagnose a workflow installation.")
    .option("-t, --target <path:string>", "Target repository.", { default: "." })
    .option("--json", "Print machine-readable JSON.")
    .action(async (options) => {
      const report = await runDoctor(options.target);
      if (options.json) {
        printJson(report);
      } else {
        process.stdout.write(`Workflow doctor: ${report.target}\n`);
        for (const check of report.checks) {
          process.stdout.write(`${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.message}\n`);
        }
      }
      if (!doctorPassed(report)) {
        process.exitCode = 2;
      }
    });
}

function workCommand() {
  return new Command()
    .description("Manage central project work records.")
    .command(
      "begin",
      new Command()
        .description("Create one canonical living spec in the knowledge repository.")
        .arguments("<slug:string>")
        .option("-t, --target <path:string>", "Leaf repository.", { default: "." })
        .option("--title <title:string>", "Human-readable work title.", { required: true })
        .option("--mode <mode:string>", "full, slice, or handoff.", { default: "full" })
        .option("--knowledge-ref <path:string>", "Reviewed curated knowledge concept.")
        .option("--graph-query <query:string>", "Graphify query used before framing.")
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, slug) => {
          const result = await beginWork({
            target: options.target,
            slug,
            title: options.title,
            mode: parseWorkMode(options.mode),
            ...(options.knowledgeRef ? { knowledgeRef: options.knowledgeRef } : {}),
            ...(options.graphQuery ? { graphQuery: options.graphQuery } : {}),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(`Created ${result.id}\nSpec: ${result.specPath}\n`);
          }
        }),
    )
    .command(
      "verify",
      new Command()
        .description("Check the structural completion gate for a living spec.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Leaf repository.", { default: "." })
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
      "flush",
      new Command()
        .description("Archive a living spec and emit an immutable raw work record.")
        .arguments("<id:string>")
        .option("-t, --target <path:string>", "Leaf repository.", { default: "." })
        .option("--outcome <outcome:string>", "completed, partial, or abandoned.", {
          required: true,
        })
        .option("--json", "Print machine-readable JSON.")
        .action(async (options, id) => {
          const result = await flushWork({
            target: options.target,
            id,
            outcome: parseOutcome(options.outcome),
          });
          if (options.json) {
            printJson(result);
          } else {
            process.stdout.write(
              `Flushed ${result.id} as ${result.outcome}\nRaw: ${result.rawPath}\nArchive: ${result.archivePath}\n`,
            );
          }
        }),
    );
}

function parseProfile(value: string): Profile {
  if (value !== "knowledge" && value !== "leaf") {
    throw new Error(`Invalid profile "${value}"; expected knowledge or leaf`);
  }
  return value;
}

function parseBootstrapAgent(value: string): BootstrapAgent {
  if (value !== "codex" && value !== "claude" && value !== "both") {
    throw new Error(`Invalid agent "${value}"; expected codex, claude, or both`);
  }
  return value;
}

function parseWorkMode(value: string): WorkMode {
  if (value !== "full" && value !== "slice" && value !== "handoff") {
    throw new Error(`Invalid mode "${value}"; expected full, slice, or handoff`);
  }
  return value;
}

function parseOutcome(value: string): WorkOutcome {
  if (value !== "completed" && value !== "partial" && value !== "abandoned") {
    throw new Error(`Invalid outcome "${value}"; expected completed, partial, or abandoned`);
  }
  return value;
}

function printPlan(plan: Awaited<ReturnType<typeof buildInstallPlan>>, json: boolean): void {
  const summary = summarizePlan(plan);
  if (json) {
    printJson(summary);
    return;
  }
  process.stdout.write(`Workflow plan: ${plan.profile} -> ${plan.target}\n`);
  for (const operation of plan.operations) {
    process.stdout.write(
      `${operation.status.toUpperCase().padEnd(9)} ${operation.kind.padEnd(13)} ${operation.path} — ${operation.reason}\n`,
    );
  }
}

function printBootstrapPlan(
  plan: Awaited<ReturnType<typeof buildBootstrapPlan>>,
  json: boolean,
): void {
  if (json) {
    printJson(summarizeBootstrapPlan(plan));
    return;
  }
  process.stdout.write(`Bootstrap skill plan: ${plan.agent}\n`);
  for (const operation of plan.operations) {
    process.stdout.write(
      `${operation.status.toUpperCase().padEnd(9)} ${operation.agent.padEnd(7)} ${
        operation.path
      } — ${operation.reason}\n`,
    );
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
