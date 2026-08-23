import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { brief, checkpoint, flowClose, handoff, promotionDraft, recallAnswer, recallRoute, workStart, advance } from "./commands.js";
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
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]
`;

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
