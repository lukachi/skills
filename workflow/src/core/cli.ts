import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  advance,
  brief,
  capture,
  checkpoint,
  close,
  flowClose,
  handoff,
  issueClaim,
  issueComplete,
  issueCreate,
  issueList,
  issueNote,
  park,
  promote,
  promotionDraft,
  recallAnswer,
  recallRoute,
  release,
  verify,
  workStart,
} from "./commands.js";
import type { CommandContext } from "./commands.js";
import { GateRefusal } from "./gates.js";
import { RECALL_ITEMS } from "./recall.js";
import { applyInstall, assertProfileSupported, planInstall } from "./install.js";
import { listQueue } from "./promotion-queue.js";
import { WORK_STEPS, type RecallRoute, type WorkStep, type WorkWeight } from "./types.js";

/**
 * The command surface.
 *
 * It is deliberately small. Every command either records something or reports
 * something, and each one ends by printing what the state now demands — the
 * agent is never expected to know which command comes next, only to read what
 * the last one said.
 */
const USAGE = `wfctl — project workflow

  brief                        the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id>
  work park --reason ... | work release --attested "<their words>"
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]

  repo add <owner/name> --path <dir> [--worktree <id>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  hook write --target <path>   used by the pre-write guard, not by hand
`;

function ok_(stdout: string): { stdout: string; exitCode: number } {
  return { stdout, exitCode: 0 };
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function flags(argv: string[], name: string): string[] {
  const values: string[] = [];
  argv.forEach((entry, index) => {
    if (entry === `--${name}` && argv[index + 1]) values.push(argv[index + 1] as string);
  });
  return values;
}

export async function run(argv: string[], context: CommandContext): Promise<{ stdout: string; exitCode: number }> {
  const [group, ...rest] = argv;

  try {
    switch (group) {
      case undefined:
      case "help":
      case "--help":
        return { stdout: USAGE, exitCode: 0 };

      case "brief":
        return await brief(context);

      case "handoff":
        return await handoff(context, rest[0]);

      case "checkpoint":
        return await checkpoint(context, {
          summary: flag(rest, "summary") ?? "",
          handoff: flag(rest, "handoff") ?? "",
          last: flag(rest, "last") ?? "",
          next: flag(rest, "next") ?? "",
          todo: flags(rest, "todo"),
        });

      case "recall": {
        const [action, ...args] = rest;
        if (action === "list") {
          return {
            stdout: RECALL_ITEMS.map((item) => `${item.id}  ${item.question}`).join("\n"),
            exitCode: 0,
          };
        }
        if (action === "answer") {
          return await recallAnswer(context, {
            item: args[0] ?? "",
            answer: flag(args, "answer") ?? "",
            route: (flag(args, "route") ?? "read") as RecallRoute,
            source: flag(args, "source") ?? "",
          });
        }
        if (action === "route") {
          return await recallRoute(context, {
            route: (args[0] ?? "read") as RecallRoute,
            covered: flags(args, "covered"),
          });
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "work": {
        const [action, ...args] = rest;
        if (action === "start") {
          return await workStart(context, {
            title: flag(args, "title") ?? "",
            ...(flag(args, "weight") ? { weight: flag(args, "weight") as WorkWeight } : {}),
          });
        }
        if (action === "step") {
          const step = args[0] as WorkStep | undefined;
          if (!step || !WORK_STEPS.includes(step)) {
            return {
              stdout: `Unknown step. One of: ${WORK_STEPS.join(", ")}`,
              exitCode: 1,
            };
          }
          return await advance(context, step);
        }
        if (action === "issue") {
          const [sub, ...rest_] = args;
          if (sub === "create") {
            return await issueCreate(context, {
              title: flag(rest_, "title") ?? "",
              acceptance: flags(rest_, "satisfies"),
            });
          }
          if (sub === "list") return await issueList(context);
          if (sub === "note") {
            return await issueNote(context, {
              id: rest_[0] ?? "",
              note: flag(rest_, "note") ?? "",
            });
          }
          if (sub === "claim") {
            return await issueClaim(context, {
              id: rest_[0] ?? "",
              repository: flag(rest_, "repository") ?? "",
              checkout: flag(rest_, "checkout") ?? "",
              worktreeId: flag(rest_, "worktree") ?? "main",
            });
          }
          if (sub === "complete") return await issueComplete(context, rest_[0] ?? "");
          return { stdout: USAGE, exitCode: 1 };
        }
        if (action === "verify") {
          return await verify(context, { review: flag(args, "review") ?? "" });
        }
        if (action === "park") return await park(context, flag(args, "reason") ?? "");
        if (action === "release") return await release(context, flag(args, "attested") ?? "");
        if (action === "close") {
          const outcome = (flag(args, "outcome") ?? "completed") as
            | "completed"
            | "partial"
            | "abandoned";
          if (!["completed", "partial", "abandoned"].includes(outcome)) {
            return { stdout: "outcome must be completed, partial or abandoned", exitCode: 1 };
          }
          return await close(context, { outcome });
        }
        if (action === "promote") {
          return await promote(context, {
            subject: flag(args, "subject") ?? "",
            summary: flag(args, "summary") ?? "",
          });
        }
        if (action === "promotion" && args[0] === "draft") {
          return await promotionDraft(context, {
            knowledgeRoot: context.root,
            page: args[1] ?? "",
          });
        }
        if (action === "promotion" && args[0] === "list") {
          const queued = await listQueue(context.root);
          return {
            stdout: queued.length
              ? `waiting on the maintainer:\n  ${queued.join("\n  ")}`
              : "nothing is waiting to be promoted.",
            exitCode: 0,
          };
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "guide": {
        const { GUIDE_TOPICS, loadGuidance } = await import("./guidance.js");
        const topic = rest[0];
        if (!topic) {
          return {
            stdout: `topics: ${Object.keys(GUIDE_TOPICS).sort().join(", ")}`,
            exitCode: 0,
          };
        }
        const key = GUIDE_TOPICS[topic];
        if (!key) {
          return {
            stdout: `No guide named ${topic}.\ntopics: ${Object.keys(GUIDE_TOPICS).sort().join(", ")}`,
            exitCode: 1,
          };
        }
        const text = await loadGuidance({ root: context.assets }, key);
        return { stdout: text ?? `The ${topic} guide is missing from this installation.`, exitCode: text ? 0 : 2 };
      }

      case "hook": {
        const [action, ...args] = rest;
        if (action === "write") {
          const { currentFlow } = await import("./flow.js");
          const { decideWrite } = await import("./write-hook.js");
          const { loadGuidance } = await import("./guidance.js");
          const flow = await currentFlow(context.root);
          const decision = decideWrite({
            flow,
            knowledgeRoot: context.root,
            target: flag(args, "target") ?? "",
            writtenThisUnit: flags(args, "written"),
            ...(flow
              ? {
                  guidance:
                    (await loadGuidance({ root: context.assets }, "work/implement")) ?? "",
                }
              : {}),
          });
          if (decision.refusal) return { stdout: decision.refusal.render(), exitCode: 2 };
          return { stdout: decision.message ?? "", exitCode: 0 };
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "repo": {
        const { addRepository, readRegistry, removeRepository, renderRegistry } = await import(
          "./registry.js"
        );
        const [action, ...args] = rest;
        if (action === "add") {
          const repository = args[0] ?? "";
          const path = flag(args, "path") ?? "";
          const worktreeId = flag(args, "worktree") ?? "main";
          const entries = await addRepository(context.root, {
            repository,
            checkout: flag(args, "checkout") ?? worktreeId,
            path,
            worktreeId,
          });
          return ok_(renderRegistry(entries));
        }
        if (action === "remove") {
          const entries = await removeRepository(
            context.root,
            args[0] ?? "",
            flag(args, "worktree"),
          );
          return ok_(renderRegistry(entries));
        }
        if (action === "list" || action === undefined) {
          return ok_(renderRegistry(await readRegistry(context.root)));
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "trajectory": {
        const { appendEvent, listTrajectories, readTrajectory, renderTrajectory, subjectId } =
          await import("./trajectory.js");
        const [action, ...args] = rest;
        if (action === "append") {
          const trajectory = await appendEvent(context.root, flag(args, "subject") ?? "", {
            summary: flag(args, "summary") ?? "",
            axis: (flag(args, "axis") ?? "delivery") as "intent" | "delivery" | "vision",
            claims: flags(args, "claim"),
            ...(flag(args, "at") ? { at: flag(args, "at") as string } : {}),
            ...(flag(args, "change") ? { change: flag(args, "change") as string } : {}),
          });
          return ok_(renderTrajectory(trajectory));
        }
        if (action === "show") {
          const trajectory = await readTrajectory(context.root, subjectId(args[0] ?? ""));
          if (!trajectory) {
            return { stdout: `No trajectory for ${args[0]}.`, exitCode: 1 };
          }
          return ok_(renderTrajectory(trajectory));
        }
        const all = await listTrajectories(context.root);
        return ok_(
          all.length === 0
            ? "no trajectories yet."
            : all.map((entry) => `${entry.id}  ${entry.events.length} event(s)  ${entry.subject}`).join("\n"),
        );
      }

      case "reconstruct": {
        const reconstruct = await import("./reconstruct.js");
        const { readRegistry } = await import("./registry.js");
        const [action, ...args] = rest;

        if (action === "start") {
          const repositories = await readRegistry(context.root);
          if (repositories.length === 0) {
            throw new GateRefusal(
              "No repositories are registered, so there is nothing to read.",
              "wfctl repo add <owner/name> --path <dir>",
            );
          }
          const raw = await reconstruct.rawInventory(context.root);
          const baseline = await reconstruct.hasBaseline(context.root);
          const id = `${new Date().toISOString().slice(0, 10)}-reconstruct`;
          await reconstruct.writeCase(context.root, {
            id,
            stage: "scope",
            createdAt: new Date().toISOString(),
            repositories: [],
            rawPaths: raw,
            coverage: { inScope: [], read: [], excluded: [] },
            claims: [],
            contradictions: [],
            trajectories: [],
            probes: [],
            hadBaseline: baseline,
          });
          return ok_(
            [
              `reconstruction ${id} opened`,
              baseline
                ? "Curated knowledge already holds pages, so this is a re-check of an existing baseline."
                : "Curated knowledge is empty, so this is a first baseline.",
              "",
              "registered:",
              ...repositories.map((entry) => `  ${entry.repository}  ${entry.worktreeId}  ${entry.path}`),
              "",
              raw.length > 0
                ? `raw material: ${raw.length} file(s) under reconstruction/raw/`
                : "raw material: none",
              "",
              "Put one scope decision to the maintainer: which repositories, how much of",
              "the raw material, and what is deliberately out. One question, not four.",
            ].join("\n"),
          );
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "capture":
        return await capture(context, {
          text: rest.filter((entry) => !entry.startsWith("--"))[0] ?? "",
          ...(rest.includes("--awaits") ? { awaits: "maintainer" as const } : {}),
        });

      case "flow":
        if (rest[0] === "close") return await flowClose(context);
        return { stdout: USAGE, exitCode: 1 };

      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve(flag(rest, "target") ?? process.cwd());
        const distribution = resolve(context.assets, "..", "..");
        const plan = await planInstall({
          target,
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.9.0",
        });
        const result = await applyInstall(plan, {
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.9.0",
        });
        const lines = [
          `installed into ${target}`,
          `  ${result.created.length} directories, ${result.written.length} files written, ${result.skipped.length} unchanged`,
        ];
        if (result.conflicts.length) {
          lines.push(`  ${result.conflicts.length} left alone because they were edited:`);
          for (const path of result.conflicts) lines.push(`    ${path}`);
        }
        lines.push("", "Restart the agent session so the new instructions load.");
        return { stdout: lines.join("\n"), exitCode: 0 };
      }

      default:
        return { stdout: USAGE, exitCode: 1 };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    throw error;
  }
}

/**
 * Find the guidance bundle by walking up from wherever this file ended up.
 *
 * It runs from two layouts — `src/core/` in the repository and `dist/` in the
 * package — and a fixed number of `..` segments is correct in exactly one of
 * them. Walking up until the directory is actually there is correct in both,
 * and fails loudly rather than installing an empty bundle.
 */
export function findGuidance(start: string): string {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new GateRefusal(
    "The guidance bundle is missing from this installation.",
    "Reinstall wfctl.",
    `Looked upward from ${start} for templates/guidance.`,
  );
}

/* c8 ignore start */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  const context: CommandContext = {
    root: process.cwd(),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown",
  };
  const result = await run(process.argv.slice(2), context);
  process.stdout.write(`${result.stdout}\n`);
  process.exit(result.exitCode);
}
/* c8 ignore stop */
