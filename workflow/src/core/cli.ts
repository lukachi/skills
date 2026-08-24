import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  issueDrop,
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
import { normalize as normalizeFlags, validate as validateFlags } from "./flags.js";
import { RECALL_ITEMS } from "./recall.js";
import { applyInstall, assertProfileSupported, planInstall } from "./install.js";
import { listQueue } from "./promotion-queue.js";
import { RECALL_ROUTES, WORK_STEPS, WORK_WEIGHTS, type WorkStep } from "./types.js";

/**
 * The command surface.
 *
 * It is deliberately small. Every command either records something or reports
 * something, and each one ends by printing what the state now demands — the
 * agent is never expected to know which command comes next, only to read what
 * the last one said.
 */
const USAGE = `wfctl — project workflow

  brief [--json]               the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
             --attested "<what the maintainer said>" [--from <where it came from>]
  work adopt <bundle> --attested "<what they said>"
             [--weight <significant|lightweight>] [--title ...] [--from <where>]
  work list                    every bundle, and whether anything can reach it
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id> | drop <id> --reason "<why it left the route>"
  work park --reason ... --attested "<their words>"
  work release --attested "<their words>"
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
               [--bundle <record>] [--settles <event-id>]
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]

  repo add <owner/name> --path <dir> [--worktree <id>] [--checkout <name>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories
  reconstruct status
  reconstruct scope --repository <owner/name> [--revision <sha>] [--raw all|selected|none] [--in <path>]...
  reconstruct read <path> [--at <owner/name>]   record a read, or print the file at the pinned revision
  reconstruct exclude <path> --reason "<why>"
  reconstruct contradiction --subject ... --side ... --side ...
  reconstruct resolve <id> --resolution "<what they decided>"
  reconstruct subject <trajectory-id>
  reconstruct probe --question ... --page <path> --asker <agent> [--passed]
  reconstruct stage            advance when this stage's gate passes
  reconstruct abandon --reason "<why>"
  reconstruct close

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
                    [--settles <event-id>]   a delivery names the intent it settles
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> --covered <path> [--covered <path>]...

  flow close [<flow-id>]       flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  debts                        what is accepted and not delivered, across every subject
  decided "<subject>"          what has already been settled about it, and where
  knowledge validate [--page <path>]
  knowledge hash <path>

  doctor                       verify this installation and what it depends on

  guards [status]              which runtime guards are on
  guards on|off <stop|write|bash>

  hook write --target <path>   used by the pre-write guard, not by hand
`;

function ok_(stdout: string): { stdout: string; exitCode: number } {
  return { stdout, exitCode: 0 };
}

function compose_(parts: (string | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
}

/**
 * Read one flag's value.
 *
 * A value that is itself a flag is refused rather than accepted: `--title
 * --weight significant` used to store the title as "--weight", producing a
 * corrupt record from a dropped argument instead of a refusal.
 */
function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new GateRefusal(
      `--${name} was given without a value.`,
      `--${name} "<value>"`,
      value === undefined ? undefined : `The next argument was ${value}, which is another flag.`,
    );
  }
  return value;
}

function flags(argv: string[], name: string): string[] {
  const values: string[] = [];
  argv.forEach((entry, index) => {
    if (entry !== `--${name}`) return;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new GateRefusal(`--${name} was given without a value.`, `--${name} "<value>"`);
    }
    values.push(value);
  });
  return values;
}

/**
 * One place where every enumerated flag is checked.
 *
 * `--route qmd2`, `--axis delivary` and `--weight BANANA` were all accepted and
 * stored. Each one then behaved as something else: an unknown route satisfied
 * the recall gate while touching no floor, a misspelt axis vanished from every
 * gap calculation while still rendering in the line, and an unknown weight
 * silently took the significant branch.
 */
function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
  fallback?: T,
): T {
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new GateRefusal(`--${name} is required.`, `--${name} <${allowed.join("|")}>`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new GateRefusal(
      `${value} is not a valid ${name}.`,
      `--${name} <${allowed.join("|")}>`,
    );
  }
  return value as T;
}

/**
 * Every command enters here, and every command's arguments are normalised and
 * checked against what that command actually reads before anything runs. See
 * `flags.ts` for why both halves exist.
 */
export async function run(argv: string[], context: CommandContext): Promise<{ stdout: string; exitCode: number }> {
  /**
   * `--help` is answered before anything runs.
   *
   * It used to be a name in the global flag set and nothing more, so
   * `wfctl init knowledge --help` passed the check, reached `init`, and
   * performed the installation. A request to be told what a command does must
   * never be the command.
   */
  if (argv.includes("--help")) {
    return { stdout: USAGE, exitCode: 0 };
  }

  let scanned: string[];
  try {
    scanned = normalizeFlags(argv);
    validateFlags(scanned);
  } catch (error) {
    if (error instanceof GateRefusal) {
      return { stdout: error.render(), exitCode: 2 };
    }
    throw error;
  }

  const [group, ...rest] = scanned;

  try {
    switch (group) {
      case undefined:
      case "help":
        return { stdout: USAGE, exitCode: 0 };

      case "brief": {
        if (rest.includes("--json")) {
          const { listFlows, currentFlowId } = await import("./flow.js");
          const { deriveBlocker } = await import("./steps.js");
          const flows = (await listFlows(context.root)).filter((flow) => !flow.closedAt);
          const current = await currentFlowId(context.root);
          /**
           * The Stop guard reads this. It used to call `brief --json`, get the
           * prose brief, fail to parse it and fall silent — so the turn-boundary
           * half of the design did nothing at all.
           */
          const { briefExtras } = await import("./commands.js");
          const extras = await briefExtras(context);
          const signals = flows.flatMap((flow) => {
            const blocker = deriveBlocker(flow);
            return blocker
              ? [{ id: flow.id, awaits: blocker.awaits, summary: blocker.summary, remedy: blocker.remedy }]
              : [];
          });
          for (const id of extras.queued) {
            signals.push({
              id,
              awaits: "maintainer" as const,
              summary: "waits in the promotion queue",
              remedy: 'wfctl work promote --subject "<product subject>" --summary "<what it now does>"',
            });
          }
          if (extras.reconstruction) {
            signals.push({
              id: extras.reconstruction.id,
              awaits: "agent" as const,
              summary: `reconstruction at stage ${extras.reconstruction.stage}`,
              remedy: "wfctl reconstruct status",
            });
          }
          /**
           * The two surfaces have to agree.
           *
           * `briefExtras` computed stranded bundles, awaiting captures and
           * unreadable records, and only the prose brief printed them — so the
           * JSON that every automated consumer reads said the repository held
           * nothing while the human-readable one listed work nobody could reach.
           */
          for (const id of extras.stranded ?? []) {
            signals.push({
              id,
              awaits: "maintainer" as const,
              summary: "has no flow, so nothing can reach it",
              remedy: `wfctl work adopt ${id} --weight <significant|lightweight> --attested "<what they said>"`,
            });
          }
          for (const broken of extras.unreadable ?? []) {
            signals.push({
              id: broken.id,
              awaits: "agent" as const,
              summary: `record cannot be read: ${broken.problem}`,
              remedy: `repair .workflow/flows/${broken.id}.json`,
            });
          }
          if (extras.awaitingCaptures) {
            signals.push({
              id: "changes/inbox",
              awaits: "maintainer" as const,
              summary: `${extras.awaitingCaptures} capture(s) await the maintainer`,
              remedy: "put them one decision at a time, not as a backlog",
            });
          }
          return ok_(JSON.stringify({ current, signals }, null, 2));
        }
        return await brief(context);
      }

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
            route: oneOf(flag(args, "route"), RECALL_ROUTES, "route"),
            source: flag(args, "source") ?? "",
          });
        }
        if (action === "route") {
          return await recallRoute(context, {
            route: oneOf(args[0], RECALL_ROUTES, "route"),
            covered: flags(args, "covered"),
          });
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "work": {
        const [action, ...args] = rest;
        if (action === "adopt") {
          const { workAdopt } = await import("./commands.js");
          return await workAdopt(context, {
            bundle: args[0] ?? "",
            attested: flag(args, "attested") ?? "",
            ...(flag(args, "weight")
              ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") }
              : {}),
            ...(flag(args, "title") ? { title: flag(args, "title") as string } : {}),
            ...(flag(args, "from") ? { from: flag(args, "from") as string } : {}),
          });
        }
        if (action === "list") {
          const { workList } = await import("./commands.js");
          return await workList(context);
        }
        if (action === "start") {
          return await workStart(context, {
            title: flag(args, "title") ?? "",
            attested: flag(args, "attested") ?? "",
            ...(flag(args, "weight")
              ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") }
              : {}),
            ...(flag(args, "from") ? { from: flag(args, "from") as string } : {}),
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
          if (sub === "drop") {
            return await issueDrop(context, {
              id: rest_[0] ?? "",
              reason: flag(rest_, "reason") ?? "",
            });
          }
          /**
           * An incomplete command names its own subcommands rather than
           * reprinting the whole usage, which reads as "this does not exist".
           */
          return {
            stdout: [
              "wfctl work issue <create|list|note|claim|complete>",
              "",
              '  create --title "<what it delivers>" [--satisfies AC-01]...',
              "  list",
              '  note <id> --note "<what you learned>"',
              "  claim <id> --repository <owner/name> [--worktree <id>]",
              "  complete <id>",
            ].join("\n"),
            exitCode: 1,
          };
        }
        if (action === "verify") {
          return await verify(context, { review: flag(args, "review") ?? "" });
        }
        if (action === "park") {
          return await park(context, flag(args, "reason") ?? "", flag(args, "attested") ?? "");
        }
        if (action === "release") return await release(context, flag(args, "attested") ?? "");
        if (action === "close") {
          /**
           * The outcome is stated. It defaulted to `completed` — the most
           * favourable of the three — so a bare `work close` recorded the best
           * possible result silently.
           */
          const outcome = oneOf(
            flag(args, "outcome"),
            ["completed", "partial", "abandoned"] as const,
            "outcome",
          );
          return await close(context, { outcome });
        }
        if (action === "promote") {
          return await promote(context, {
            subject: flag(args, "subject") ?? "",
            summary: flag(args, "summary") ?? "",
            ...(flag(args, "bundle") ? { bundle: flag(args, "bundle") as string } : {}),
            ...(flag(args, "settles") ? { settles: flag(args, "settles") as string } : {}),
          });
        }
        if (action === "promotion" && args[0] === "draft") {
          return await promotionDraft(context, {
            knowledgeRoot: context.root,
            page: args[1] ?? "",
          });
        }
        if (action === "promotion" && args[0] === undefined) {
          return {
            stdout: [
              "wfctl work promotion <draft|list>",
              "",
              '  draft "<area>/<page>.md"   create the page where it belongs',
              "  list                       records waiting on the maintainer",
            ].join("\n"),
            exitCode: 1,
          };
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
          const { mutateFlow } = await import("./flow.js");
          const { recordWritten } = await import("./recall.js");
          const { readRegistry } = await import("./registry.js");
          const { inspectLeaves } = await import("./leaves.js");
          const flow = await currentFlow(context.root);
          const target = flag(args, "target") ?? "";
          const decision = decideWrite({
            flow,
            knowledgeRoot: context.root,
            target,
            leaves: await inspectLeaves(await readRegistry(context.root)),
            writtenThisUnit: flow?.recall.written ?? [],
            ...(flow
              ? {
                  guidance:
                    (await loadGuidance({ root: context.assets }, "work/implement")) ?? "",
                }
              : {}),
          });
          if (decision.refusal) return { stdout: decision.refusal.render(), exitCode: 2 };
          /**
           * Record the write, so the next edit to the same ground is silent.
           * This is what makes "fires on scope change, not on every edit" true.
           */
          if (flow) {
            await mutateFlow(context.root, flow.id, (current) => ({
              ...current,
              recall: recordWritten(current.recall, target),
            }));
          }
          return { stdout: decision.message ?? "", exitCode: 0 };
        }
        return { stdout: USAGE, exitCode: 1 };
      }

      case "repo": {
        const { addRepository, readRegistry, removeRepository, renderRegistry } = await import(
          "./registry.js"
        );
        const { graphSetup, inspectLeaf, inspectLeaves, renderLeaves } = await import("./leaves.js");
        const [action, ...args] = rest;
        if (action === "add") {
          const repository = args[0] ?? "";
          const path = flag(args, "path") ?? "";
          const worktreeId = flag(args, "worktree") ?? "main";
          /**
           * The label defaulted to the worktree id, which defaults to "main" —
           * so a checkout sitting on `brand/icons` was registered, listed and
           * referred to as `main`. The label is how the agent names the
           * checkout it is about to write in; one that names the wrong branch
           * is worse than one that names nothing.
           */
          const { currentBranch } = await import("./git.js");
          const checkout = flag(args, "checkout")
            ?? (flag(args, "worktree") ? worktreeId : currentBranch(path) || worktreeId);
          const entry = { repository, checkout, path, worktreeId };
          const entries = await addRepository(context.root, entry);

          /**
           * Registering is the one moment the path is known and nothing is in
           * flight, so it is the cheapest place to say what this leaf still
           * needs before anything here can read it.
           */
          const state = await inspectLeaf(entry);
          return ok_(
            compose_([
              renderRegistry(entries),
              state.graph === "missing" ? graphSetup(state.path) : undefined,
              state.graph === "unreachable" ? `${state.path} is not there.` : undefined,
              state.graph === "stale"
                ? `Its graph is ${state.ageDays} days old. Rebuild before relying on it: graphify build (in ${state.path})`
                : undefined,
            ]),
          );
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
          return ok_(renderLeaves(await inspectLeaves(await readRegistry(context.root))));
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
            axis: oneOf(flag(args, "axis"), ["intent", "delivery", "vision"] as const, "axis"),
            claims: flags(args, "claim"),
            ...(flag(args, "at") ? { at: flag(args, "at") as string } : {}),
            ...(flag(args, "change") ? { change: flag(args, "change") as string } : {}),
            ...(flag(args, "settles") ? { settles: flag(args, "settles") as string } : {}),
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

        if (action === "adopt") {
          const { workAdopt } = await import("./commands.js");
          return await workAdopt(context, {
            bundle: args[0] ?? "",
            attested: flag(args, "attested") ?? "",
            ...(flag(args, "weight")
              ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") }
              : {}),
            ...(flag(args, "title") ? { title: flag(args, "title") as string } : {}),
            ...(flag(args, "from") ? { from: flag(args, "from") as string } : {}),
          });
        }
        if (action === "list") {
          const { workList } = await import("./commands.js");
          return await workList(context);
        }
        if (action === "start") {
          /**
           * The fence spans both cases. An agent told "work outside this flow
           * is out of scope" simply opened a reconstruction instead.
           */
          const { listFlows } = await import("./flow.js");
          const openFlows = (await listFlows(context.root)).filter((entry) => !entry.closedAt);
          if (openFlows[0]) {
            throw new GateRefusal(
              `Flow ${openFlows[0].id} is open; work outside it is out of scope.`,
              `wfctl flow close ${openFlows[0].id}`,
            );
          }
          const open = await reconstruct.currentCase(context.root);
          if (open) {
            throw new GateRefusal(
              `Reconstruction ${open.id} is already open at stage ${open.stage}.`,
              `wfctl reconstruct close`,
              "Opening another would overwrite it in place, losing its coverage, " +
                "contradictions and probes.",
            );
          }
          const repositories = await readRegistry(context.root);
          if (repositories.length === 0) {
            throw new GateRefusal(
              "No repositories are registered, so there is nothing to read.",
              "wfctl repo add <owner/name> --path <dir>",
            );
          }
          const raw = await reconstruct.rawInventory(context.root);
          const baseline = await reconstruct.hasBaseline(context.root);
          /**
           * Unique per case, not per day. Date-only ids meant the second
           * reconstruction of a day collided with the first in the archive and
           * could never be closed or abandoned.
           */
          const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const id = `${stamp}-reconstruct`;
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
          const { loadGuidance } = await import("./guidance.js");
          const scopeGuidance = await loadGuidance({ root: context.assets }, "reconstruct/scope");
          await reconstruct.setCurrentCase(context.root, id);
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
              scopeGuidance ?? "",
            ].join("\n"),
          );
        }
        const record = await reconstruct.currentCase(context.root);
        if (!record) {
          throw new GateRefusal(
            "No reconstruction is open.",
            "wfctl reconstruct start",
          );
        }

        if (action === "status") return ok_(reconstruct.renderStatus(record));

        if (action === "scope") {
          const { readRegistry } = await import("./registry.js");
          const { head, resolveRevision } = await import("./git.js");
          const registered = await readRegistry(context.root);

          /**
           * The repository, its path and its revision come from the registry
           * and from Git, not from flags. An unregistered repository at an
           * invented revision used to be accepted and printed back as though
           * it had been read.
           */
          const repositories = flags(args, "repository").map((name) => {
            const entry = registered.find((candidate) => candidate.repository === name);
            if (!entry) {
              throw new GateRefusal(
                `${name} is not registered, so there is no checkout to read.`,
                `wfctl repo add ${name} --path <dir>`,
              );
            }
            const asked = flag(args, "revision");
            const observed = head(entry.path);
            return {
              ...entry,
              revision: asked ? resolveRevision(entry.path, asked) : observed.revision,
              dirty: observed.dirty,
            };
          });

          const next = await reconstruct.recordScope(context.root, record, {
            repositories,
            rawScope: oneOf(flag(args, "raw"), ["all", "selected", "none"] as const, "raw", "none"),
            inScope: flags(args, "in"),
            exclude: flags(args, "not"),
          });
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "read" && flag(args, "at")) {
          const { citation, readAt } = await import("./git.js");
          const { readRegistry } = await import("./registry.js");
          const name = flag(args, "at") ?? "";
          const entry = (await readRegistry(context.root)).find(
            (candidate) => candidate.repository === name,
          );
          const pinned = record.repositories.find((candidate) => candidate.repository === name);
          if (!entry || !pinned) {
            throw new GateRefusal(
              `${name} is not in this case's scope.`,
              "wfctl reconstruct status",
            );
          }
          const file = args[0] ?? "";
          const body = readAt(entry.path, pinned.revision, file);
          return ok_(
            [`${citation(name, pinned.revision, file)}`, "", body].join("\n"),
          );
        }

        if (action === "read") {
          const next = await reconstruct.markRead(context.root, record, args[0] ?? "");
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "exclude") {
          const next = await reconstruct.markExcluded(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "reason") ?? "",
          );
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "contradiction") {
          const next = await reconstruct.recordContradiction(context.root, record, {
            subject: flag(args, "subject") ?? "",
            sides: flags(args, "side"),
          });
          const recorded = next.contradictions[next.contradictions.length - 1];
          return ok_(
            `${recorded?.id}  ${recorded?.subject}\n` +
              `recorded; ${next.contradictions.length} to adjudicate after the crawl.\n` +
              `resolve it later with: wfctl reconstruct resolve ${recorded?.id} --resolution "<what they decided>"`,
          );
        }

        if (action === "resolve") {
          const next = await reconstruct.resolveContradiction(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "resolution") ?? "",
          );
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "probe") {
          const next = await reconstruct.recordProbe(context.root, record, {
            question: flag(args, "question") ?? "",
            pages: flags(args, "page"),
            asker: flag(args, "asker") ?? context.actor,
            ...(flag(args, "answer") ? { answer: flag(args, "answer") as string } : {}),
            passed: args.includes("--passed"),
          }, context.actor);
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "subject") {
          const { readTrajectory, subjectId, listTrajectories } = await import("./trajectory.js");
          const named = args[0] ?? "";

          /**
           * The id has to resolve. It was stored as a bare string, so a subject
           * that did not exist — including `../../../../etc/passwd` — satisfied
           * the assemble gate, which counts the array's length and never asked
           * what was in it.
           */
          const found =
            (await readTrajectory(context.root, named)) ??
            (await readTrajectory(context.root, subjectId(named)));
          if (!found) {
            const all = await listTrajectories(context.root);
            throw new GateRefusal(
              `No trajectory for ${named}.`,
              'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>" --axis <intent|delivery|vision>',
              all.length > 0
                ? `Assembled so far:\n${all.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}`
                : "Nothing has been assembled yet.",
            );
          }

          const next = {
            ...record,
            trajectories: [...new Set([...record.trajectories, found.id])],
          };
          await reconstruct.writeCase(context.root, next);
          return ok_(reconstruct.renderStatus(next));
        }

        if (action === "abandon") {
          /**
           * A case opened by mistake, or on the wrong repository, had no way
           * out at all: close refused before promote, start refused while one
           * was open, and only hand-editing state escaped.
           */
          const reason = flag(args, "reason") ?? "";
          if (!reason.trim()) {
            throw new GateRefusal(
              "Abandoning a reconstruction records why.",
              'wfctl reconstruct abandon --reason "<why this pass is not finishing>"',
            );
          }
          /**
           * Abandoning records why and keeps the stage it actually reached.
           * Rewriting it to `promote` made an abandoned pass read, in the
           * archive and in the brief, as one that had reached the maintainer.
           */
          await reconstruct.writeCase(context.root, {
            ...record,
            abandoned: { at: new Date().toISOString(), reason: reason.trim() },
          });
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${record.id} abandoned: ${reason.trim()}\narchived at:\n${archived}`);
        }

        if (action === "stage") {
          const { loadGuidance } = await import("./guidance.js");
          const advanced = await reconstruct.advanceStage(context.root, record, context.actor);
          const slice = await loadGuidance(
            { root: context.assets },
            `reconstruct/${advanced.stage}` as never,
          ).catch(() => undefined);
          return ok_(
            compose_([
              slice,
              reconstruct.renderStatus(advanced.record),
              reconstruct.STAGE_PRESENCE[advanced.stage] === "maintainer"
                ? "This stage needs the maintainer. Put it to them in product language."
                : "This stage runs unattended. Do not interrupt it with questions.",
            ]),
          );
        }

        if (action === "close") {
          reconstruct.assertClosable(record, context.actor);
          const outcome = reconstruct.renderOutcome(record);
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${outcome}\narchived at:\n${archived}`);
        }

        return { stdout: USAGE, exitCode: 1 };
      }

      case "debts": {
        const { collectDebts, renderDebts } = await import("./debts.js");
        return ok_(renderDebts(await collectDebts(context.root)));
      }

      case "decided": {
        const { findDecisions, renderDecisions } = await import("./decided.js");
        const subject = rest.filter((entry) => !entry.startsWith("--")).join(" ");
        if (!subject.trim()) {
          throw new GateRefusal(
            "Naming the subject is the whole of this command.",
            'wfctl decided "<the subject>"',
          );
        }
        return ok_(renderDecisions(subject, await findDecisions(context.root, subject)));
      }

      case "knowledge": {
        const { renderIssues, validateCurated } = await import("./curated.js");
        const [action, ...args] = rest;
        if (action === "validate") {
          const { collectPages } = await import("./curated.js");
          const page = flag(args, "page");
          const issues = await validateCurated(context.root, page);
          const pages = page ? 1 : (await collectPages(context.root)).length;
          return { stdout: renderIssues(issues, pages), exitCode: issues.length > 0 ? 2 : 0 };
        }
        if (action === "hash") {
          const { contentHash, stripSeal, KNOWLEDGE_DIR, normalizePage } = await import(
            "./curated.js"
          );
          const asked = args[0] ?? flag(args, "page") ?? "";
          const page = normalizePage(context.root, asked);
          const body = await readFile(resolve(context.root, KNOWLEDGE_DIR, page), "utf8").catch(
            () => undefined,
          );
          if (body === undefined) {
            throw new GateRefusal(
              `No page at ${asked}.`,
              "wfctl knowledge validate",
              `Looked in knowledge/ for ${page}.`,
            );
          }
          return ok_(contentHash(stripSeal(body)));
        }
        return {
          stdout: [
            "wfctl knowledge <validate|hash>",
            "",
            "  validate [--page <path>]   structural checks over curated pages",
            "  hash <path>                the hash both semantic reviews bind to",
          ].join("\n"),
          exitCode: 1,
        };
      }

      case "doctor": {
        const { exitCodeFor, renderReport, runDoctor } = await import("./doctor.js");
        const report = await runDoctor(context.root, {
          distribution: resolve(context.assets, "..", ".."),
        });
        return { stdout: renderReport(report), exitCode: exitCodeFor(report) };
      }

      case "guards": {
        const { GUARD_NAMES, guardStatus, renderGuards, setGuard } = await import("./install.js");
        const [action, ...args] = rest;
        if (action === "on" || action === "off") {
          const guard = oneOf(args[0], GUARD_NAMES, "guard");
          return ok_(await setGuard(context.root, guard, action === "on"));
        }
        if (action === undefined || action === "status") {
          return ok_(renderGuards(await guardStatus(context.root)));
        }
        return { stdout: "wfctl guards [status] | on <guard> | off <guard>", exitCode: 1 };
      }

      case "capture": {
        /**
         * The finding is the first argument, whatever it starts with.
         *
         * Skipping anything beginning with `--` made a finding phrased as
         * "--fix the parser…" unrecordable — and capture is the only sanctioned
         * outlet while a flow is open.
         */
        const awaits = rest.includes("--awaits");
        const text = rest.filter((entry) => entry !== "--awaits")[0] ?? "";
        return await capture(context, {
          text,
          ...(awaits ? { awaits: "maintainer" as const } : {}),
        });
      }

      case "flow":
        if (rest[0] === "close") return await flowClose(context, rest[1]);
        return { stdout: "wfctl flow close [<flow-id>]", exitCode: 1 };

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

        /**
         * What the install could not settle is printed as work, not swallowed.
         *
         * Nothing here is force-replaced and nothing is silently kept either.
         * A file this tool cannot cleanly own becomes a line the agent meets
         * during the install, with what it is and what resolves it — which is
         * the only place the instruction can arrive in time to be acted on.
         */
        const outstanding: string[] = [];

        if (result.conflicts.length) {
          outstanding.push(
            `${result.conflicts.length} file(s) were edited after they were installed, and were left alone:`,
            ...result.conflicts.map((path) => `  ${path}`),
            "  Compare each against the shipped version and keep the edit or drop it.",
            "  Nothing here is replaced without you deciding that.",
          );
        }

        if (result.obsolete.length) {
          /**
           * Grouped, because the list is the point and its length is not.
           * Upgrading one real repository produced sixty-six lines, which is a
           * wall an agent skims — the exact failure this tool exists to avoid.
           */
          const groups = new Map<string, string[]>();
          for (const path of result.obsolete) {
            const segments = path.split("/");
            const key = segments.length > 1 ? segments.slice(0, 2).join("/") : path;
            groups.set(key, [...(groups.get(key) ?? []), path]);
          }
          outstanding.push(
            `${result.obsolete.length} file(s) belong to an older wfctl and are no longer part of it:`,
            ...[...groups].map(([key, members]) =>
              members.length > 1 ? `  ${key}/  (${members.length} entries)` : `  ${key}`),
            "  They are not read by anything and are not removed for you.",
            "  Delete them once you have checked nothing local depends on them.",
          );
        }

        if (result.replacedHooks.length) {
          outstanding.push(
            `${result.replacedHooks.length} hook entr(ies) from an older wfctl were replaced:`,
            ...result.replacedHooks.map((entry) => `  ${entry}`),
            "  Reported because a hook you did not expect to change is worth knowing about.",
          );
        }

        if (outstanding.length) {
          lines.push("", ...outstanding);
        }

        lines.push(
          "",
          "Guidance is not installed — it ships with wfctl and is read from there,",
          "so upgrading wfctl upgrades it. There is nothing here to refresh.",
          "",
          "Restart the agent session so the new instructions load.",
        );

        // Non-zero while anything is outstanding: an install that reports work
        // and exits clean is an install nobody finishes.
        const unresolved = result.conflicts.length + result.obsolete.length;
        return { stdout: lines.join("\n"), exitCode: unresolved > 0 ? 3 : 0 };
      }

      default:
        return {
          stdout: `wfctl has no command "${group}".\n\n${USAGE}`,
          exitCode: 1,
        };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    /**
     * Everything else is still a refusal, not a crash.
     *
     * Tampered state, a malformed review artifact and an unwritable target all
     * used to surface as raw stack traces at exit 1 — indistinguishable from a
     * usage error, and the review artifact in particular is untrusted input
     * produced by another agent.
     */
    const detail = error instanceof Error ? error.message : String(error);
    return {
      stdout: new GateRefusal(
        "That could not be completed.",
        "Check the file or state this command reads; if it was edited by hand, repair it.",
        detail,
      ).render(),
      exitCode: 2,
    };
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
/**
 * The guidance bundle inside this installation.
 *
 * `start` is the directory this module was loaded from, so the layout is known:
 * `dist/cli.js` sits one level under the package root, and a source run sits
 * two. It climbed six, which walks a global install out of its own package and
 * into `node_modules`, the install root and the home directory — where any
 * unrelated `templates/guidance/` would be read as this tool's own instructions.
 */
export function findGuidance(start: string): string {
  let current = start;
  for (let depth = 0; depth < 3; depth += 1) {
    const candidate = resolve(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  /**
   * Missing guidance is reported by the commands that need it, not by the
   * bootstrap. Throwing here made the prose load-bearing in the one way it must
   * never be: every command, including `--help`, died with a stack trace.
   */
  return resolve(start, "templates", "guidance");
}

/* c8 ignore start */
/**
 * Run when invoked as a program, however the program is named.
 *
 * The first version compared `import.meta.url` against argv[1]'s basename. As
 * the `wfctl` bin that is "wfctl" against "cli.js", so the body never ran and
 * every install exited 0 in silence — taking the session hook and the write
 * guard with it, because both shell out to `wfctl`. Resolving argv[1] through
 * the filesystem compares the same thing on both sides.
 */
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const { findRepositoryRoot } = await import("./paths-resolve.js");
  const context: CommandContext = {
    /**
     * The repository, not the directory the command was typed in. Every fence
     * is relative to this, and taking it from cwd meant `cd changes && wfctl …`
     * removed all of them.
     */
    root: process.argv[2] === "init" ? process.cwd() : findRepositoryRoot(process.cwd()),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown",
  };
  const result = await run(process.argv.slice(2), context);

  /**
   * `process.exit` truncates a piped brief at 64KB.
   *
   * Writes to a pipe are asynchronous, and `exit` discards whatever has not
   * drained — with status 0, so nothing downstream can tell. The SessionStart
   * hook *is* a pipe, and `last:` and `next:` are printed after the handoff
   * body, which makes the two fields a session acts on the first to go. A
   * 73,101-byte brief arrived as exactly 65,536 bytes with no marker.
   *
   * Setting `exitCode` lets the process end on its own once stdout has
   * drained. `renderBrief`'s comment already says a truncated brief reads
   * exactly like a complete one; this is where that was happening.
   */
  process.exitCode = result.exitCode;
  process.stdout.write(`${result.stdout}\n`);
}
/* c8 ignore stop */
