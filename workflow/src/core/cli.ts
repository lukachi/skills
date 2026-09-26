import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GateRefusal } from "./gates.js";
import { normalize as normalizeFlags, validate as validateFlags } from "./flags.js";
import { applyInstall, assertProfileSupported, planInstall } from "./install.js";

export interface CommandContext {
  root: string;
  assets: string;
  actor: string;
}

/**
 * The command surface.
 *
 * Ordinary work is outside the CLI. Record creation and local recovery are
 * explicit operations rather than a required sequence.
 */
export const USAGE = `wfctl — optional project records

  --version
  bundle create --id <id> --title <title> --scope <delivery> --agreed <agreement>
  bundle list | show --id <id>
  unit create --bundle <bundle> --id <id> --title <title>
              --outcome <result> --boundary <limits> --agreed <agreement>
  unit list --bundle <bundle> | show --bundle <bundle> --id <id>

  flow checkpoint --namespace <agent> --id <thread>
                  --instruction <current-request> --last <done> --next <action>
                  [--link <path>]... [--blocker <text>]
                  [--checkout <path>] [--revision <sha>]
  flow handoff --namespace <agent> --id <thread>
  flow list --namespace <agent>

  init knowledge [--target <dir>]
  doctor
  guide [<topic>]
  knowledge validate [--page <path>]
  knowledge hash <path>
  repo add|list|remove ...
  reconstruct ...
  trajectory ...
  decided <subject>

Ordinary work requires no wfctl command. Bundle and unit creation require an
explicit agreement. Flow notes are local, short, and selected by namespace.`;

function ok_(stdout: string): { stdout: string; exitCode: number } {
  return { stdout, exitCode: 0 };
}

function compose_(parts: (string | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
}

/**
 * Read one flag's value.
 *
 * A value that is itself a flag is refused rather than accepted.
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

/** Omit the key entirely when the flag was absent, rather than passing "". */
function optional<K extends string>(key: K, value: string | undefined): Record<K, string> | object {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
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

function exactRecordFlags(argv: string[], repeatable: string[] = []): void {
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new GateRefusal("Unexpected record command argument.", "Use named --flags with one value each.");
    }
    if (seen.has(key) && !repeatable.includes(key)) {
      throw new GateRefusal(`${key} was supplied more than once.`, "Use one value for this field.");
    }
    seen.add(key);
  }
}

/** Require an allowed value for enumerated flags. */
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

/** Dispatch without reminders about unrecorded work. */
export async function run(
  argv: string[],
  context: CommandContext,
): Promise<{ stdout: string; exitCode: number }> {
  return dispatch(argv, context);
}

async function dispatch(argv: string[], context: CommandContext): Promise<{ stdout: string; exitCode: number }> {
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
  if (argv.length === 1 && argv[0] === "--version") {
    const packageFile = resolve(context.assets, "..", "..", "package.json");
    const metadata = JSON.parse(await readFile(packageFile, "utf8")) as { version?: string };
    return ok_(metadata.version ?? "unknown");
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

      case "bundle": {
        const { bundleCreate, bundleList, bundleShow } = await import("./voluntary-records.js");
        const [action, ...args] = rest;
        exactRecordFlags(args);
        if (action === "list") return ok_(await bundleList(context.root));
        if (action === "show") return ok_(await bundleShow(context.root, flag(args, "id") ?? ""));
        if (action === "create") return ok_(await bundleCreate(context.root, {
          id: flag(args, "id") ?? "",
          title: flag(args, "title") ?? "",
          scope: flag(args, "scope") ?? "",
          agreed: flag(args, "agreed") ?? "",
        }));
        throw new GateRefusal("Unknown bundle action.", "wfctl bundle <create|list|show>");
      }

      case "unit": {
        const { unitCreate, unitList, unitShow } = await import("./voluntary-records.js");
        const [action, ...args] = rest;
        exactRecordFlags(args);
        if (action === "list") return ok_(await unitList(context.root, flag(args, "bundle") ?? ""));
        if (action === "show") return ok_(await unitShow(context.root, flag(args, "bundle") ?? "", flag(args, "id") ?? ""));
        if (action === "create") return ok_(await unitCreate(context.root, {
          bundle: flag(args, "bundle") ?? "",
          id: flag(args, "id") ?? "",
          title: flag(args, "title") ?? "",
          outcome: flag(args, "outcome") ?? "",
          boundary: flag(args, "boundary") ?? "",
          agreed: flag(args, "agreed") ?? "",
        }));
        throw new GateRefusal("Unknown unit action.", "wfctl unit <create|list|show>");
      }

      case "flow": {
        const { recoveryCheckpoint, recoveryHandoff, recoveryList } = await import("./recovery-notes.js");
        const [action, ...args] = rest;
        exactRecordFlags(args, ["--link"]);
        const namespace = flag(args, "namespace") ?? "";
        if (action === "list") return ok_(await recoveryList(context.root, namespace));
        if (action === "handoff") return ok_(await recoveryHandoff(context.root, namespace, flag(args, "id") ?? ""));
        if (action === "checkpoint") return ok_(await recoveryCheckpoint(context.root, {
          namespace,
          id: flag(args, "id") ?? "",
          instruction: flag(args, "instruction") ?? "",
          last: flag(args, "last") ?? "",
          next: flag(args, "next") ?? "",
          links: flags(args, "link"),
          ...optional("blocker", flag(args, "blocker")),
          ...optional("checkout", flag(args, "checkout")),
          ...optional("revision", flag(args, "revision")),
        }));
        throw new GateRefusal("Unknown flow action.", "wfctl flow <checkpoint|handoff|list>");
      }

      case "guide": {
        const { GUIDE_TOPICS, loadGuidance } = await import("./guidance.js");
        type GuidanceKey = Parameters<typeof loadGuidance>[1];
        const topic = rest[0];
        if (topic === "tidy") {
          return ok_(await readFile(resolve(context.assets, "..", "skill/wfctl/references/tidying.md"), "utf8"));
        }
        if (!topic) {
          return {
            stdout: `topics: tidy, ${Object.keys(GUIDE_TOPICS).sort().join(", ")}`,
            exitCode: 0,
          };
        }
        /**
         * Strategies and personalities are addressed by path.
         *
         * They are a growing set the kit surveys by reading the directory, so
         * naming each one in a fixed topic table would mean a strategy could be
         * shipped, surveyed, adopted, and then not readable — a record pointing
         * at a guide the guide command denies exists.
         */
        const key =
          GUIDE_TOPICS[topic] ??
          (/^(strategy|personality)\/[a-z][a-z0-9-]*$/.test(topic)
            ? (topic as GuidanceKey)
            : undefined);
        if (!key) {
          return {
            stdout:
              `No guide named ${topic}.\ntopics: tidy, ${Object.keys(GUIDE_TOPICS).sort().join(", ")}` +
              "\n\nStrategies and personalities are read by their guidance path.",
            exitCode: 1,
          };
        }
        const text = await loadGuidance({ root: context.assets }, key);
        return { stdout: text ?? `The ${topic} guide is missing from this installation.`, exitCode: text ? 0 : 2 };
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

        if (action === "start") {
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

      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve(flag(rest, "target") ?? process.cwd());
        const distribution = resolve(context.assets, "..", "..");
        const plan = await planInstall({
          target,
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.10.0",
        });
        const result = await applyInstall(plan, {
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.10.0",
        });
        const lines = [
          `installed into ${target}`,
          `  ${result.created.length} directories, ${result.written.length} files written, ${result.skipped.length} unchanged`,
        ];

        if (result.removed.length) lines.push(`  ${result.removed.length} retired wfctl file(s) removed`);

        if (result.replacedHooks.length) {
          lines.push(
            `${result.replacedHooks.length} hook entr(ies) from an older wfctl were removed:`,
            ...result.replacedHooks.map((entry) => `  ${entry}`),
          );
        }

        lines.push(
          "",
          "Guidance is not installed — it ships with wfctl and is read from there,",
          "so upgrading wfctl upgrades it. There is nothing here to refresh.",
          "",
          "Restart the agent session so the new instructions load.",
        );

        return { stdout: lines.join("\n"), exitCode: 0 };
      }

      default:
        return {
          stdout: `wfctl has no command "${group}".\n\n${USAGE}`,
          exitCode: 1,
        };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    /** Report filesystem and state errors as actionable refusals. */
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

/** Find this package's guidance directory from source or the built CLI. */
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
/** Run when invoked as a program, whether named cli.js or wfctl. */
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
    /** Resolve project records from the repository root. */
    root: process.argv[2] === "init" ? process.cwd() : findRepositoryRoot(process.cwd()),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown",
  };
  const result = await run(process.argv.slice(2), context);

  /** Let stdout drain before the process exits. */
  process.exitCode = result.exitCode;
  process.stdout.write(`${result.stdout}\n`);
}
/* c8 ignore stop */
