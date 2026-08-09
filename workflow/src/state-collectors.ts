import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { listCaptures } from "./capture.js";
import { readPark } from "./park.js";
import { collectDebts } from "./debts.js";
import { compileTrajectories } from "./trajectory.js";
import { isMissingFileError } from "./config.js";
import { runTool } from "./dependencies.js";
import { sessionBasis } from "./knowledge-session.js";
import { reconstructionCheckpointBasis } from "./reconstruction.js";
import { listRepositoryConnections } from "./repository-registry.js";
import type { StateCollector, StateContext, StateSignal } from "./state.js";
import { WORKFLOW_VERSION } from "./types.js";
import { workCheckpointBasis } from "./work-bundle.js";
import { parseWorkSpec } from "./work-spec.js";

/**
 * Every collector observes one domain and knows nothing about the others. Add a
 * new state by adding a collector here; nothing else in the workflow changes.
 */
export const STATE_COLLECTORS: readonly StateCollector[] = [
  installCollector(),
  sourcesCollector(),
  corpusCollector(),
  retrievalCollector(),
  reconstructionCollector(),
  intakeCollector(),
  rawCollector(),
  trajectoryCollector(),
  workCollector(),
  inboxCollector(),
];

function installCollector(): StateCollector {
  return {
    id: "install",
    profiles: ["knowledge", "leaf"],
    async collect(context) {
      const signals: StateSignal[] = [];
      if (context.config.installedVersion !== WORKFLOW_VERSION) {
        signals.push({
          id: "install.version-drift",
          domain: "install",
          level: "attention",
          summary: "Installed assets are older than the running CLI",
          facts: { installed: context.config.installedVersion, cli: WORKFLOW_VERSION },
          awaits: "maintainer",
        });
      }
      if (context.config.skills?.scope === "none") {
        signals.push({
          id: "install.skills-disabled",
          domain: "install",
          level: "attention",
          summary: "Agent skills are not installed; the CLI works but agent behavior is unguided",
          awaits: "maintainer",
        });
      }
      return signals;
    },
  };
}

function sourcesCollector(): StateCollector {
  return {
    id: "sources",
    profiles: ["knowledge"],
    async collect(context) {
      const connections = await listRepositoryConnections(context.knowledgeRoot);
      if (connections.length === 0) {
        return [{
          id: "sources.none",
          domain: "sources",
          level: "attention",
          summary: "No source repositories are registered",
          awaits: "maintainer",
          blocks: ["reconstruct-baseline", "reconstruct-audit"],
        }];
      }

      const signals: StateSignal[] = [{
        id: "sources.registered",
        domain: "sources",
        level: "ok",
        summary: "Source repositories are registered",
        facts: {
          repositories: connections.length,
          connected: connections.filter((entry) => entry.connected).length,
        },
      }];
      for (const connection of connections) {
        if (!connection.connected) {
          signals.push({
            id: "sources.unbound",
            domain: "sources",
            level: "blocked",
            summary: "Repository is registered but has no local checkout in this clone",
            subject: connection.repository,
            awaits: "maintainer",
            blocks: ["reconstruct-baseline", "reconstruct-audit"],
          });
          continue;
        }
        const unavailable = connection.checkouts.filter((checkout) => !checkout.available);
        if (unavailable.length > 0) {
          signals.push({
            id: "sources.missing-checkout",
            domain: "sources",
            level: "attention",
            summary: "A recorded checkout path no longer exists on this machine",
            subject: connection.repository,
            facts: { missing: unavailable.length, known: connection.checkouts.length },
            awaits: "maintainer",
          });
        }
        if (!connection.activeRoot) {
          // One candidate is the agent's to announce and select; several is a
          // project decision only the maintainer can make.
          const ambiguous = connection.checkouts.length > 1;
          signals.push({
            id: "sources.unselected",
            domain: "sources",
            level: "blocked",
            summary: "Repository has no selected reconstruction checkout",
            subject: connection.repository,
            facts: { candidates: connection.checkouts.length },
            awaits: ambiguous ? "maintainer" : "agent",
            blocks: ["reconstruct-baseline", "reconstruct-audit"],
          });
        }
      }
      return signals;
    },
  };
}

function corpusCollector(): StateCollector {
  return {
    id: "corpus",
    profiles: ["knowledge"],
    async collect(context) {
      const graphPath = join(context.knowledgeRoot, ".workflow/current/knowledge-graph.json");
      const graph = await readJson(graphPath);
      if (!graph) {
        return [{
          id: "corpus.not-compiled",
          domain: "corpus",
          level: "info",
          summary: "The knowledge graph has not been compiled in this clone",
          awaits: "agent",
        }];
      }

      const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const concepts = nodes.filter((node) =>
        recordValue(node)?.kind === "concept"
      ).length;
      if (concepts === 0) {
        return [{
          id: "corpus.empty",
          domain: "corpus",
          level: "attention",
          summary: "Curated knowledge holds no concepts yet; only the empty template exists",
          facts: { documents: nodes.length },
        }];
      }

      const signals: StateSignal[] = [{
        id: "corpus.populated",
        domain: "corpus",
        level: "ok",
        summary: "Curated knowledge is populated",
        facts: { concepts, documents: nodes.length },
      }];
      // A reconstruction's whole purpose is separating what the project meant
      // from what it built, and it records the gap faithfully. Nothing then
      // reads those rows, so the debt is complete, precise, and invisible from
      // the moment it is written. Naming the pages is the point: a count of
      // drifted capabilities is a number nobody can act on.
      const drifted = nodes.filter((node) =>
        stringValue(recordValue(recordValue(node)?.realization)?.alignment) === "drifted"
      );
      if (drifted.length > 0) {
        signals.push({
          id: "corpus.intent-delivery-drift",
          domain: "corpus",
          level: "attention",
          summary:
            "Curated knowledge records accepted intent the implementation does not deliver",
          facts: {
            capabilities: drifted.length,
            named: nameThem(
              drifted.map((node) =>
                stringValue(recordValue(node)?.title) || stringValue(recordValue(node)?.path)
              ),
            ),
          },
          // Nobody owes an action this minute. The rows are an accurate record
          // of a finished reconstruction, and whether to pay the debt down is a
          // separate decision per capability. Claiming it awaits the maintainer
          // would park an unclearable question in their queue forever, and
          // claiming it awaits the agent would arm the stop guard on a fact.
        });
      }
      // Curated knowledge runs on two roads: what the product does for a person,
      // and how it is built. Every check before this one was per-file, so a road
      // with no files on it passed them all trivially — the corpus validated,
      // the graph matched it, and the count of pages said "populated". Three
      // repositories can be read end to end and produce nothing that says how
      // they work, and the only reader who notices is the maintainer, by eye.
      const engineering = nodes.filter((node) =>
        recordValue(node)?.kind === "concept"
        && stringValue(recordValue(node)?.view) === "engineering"
      ).length;
      if (engineering === 0) {
        const connections = await listRepositoryConnections(context.knowledgeRoot);
        if (connections.length > 0) {
          signals.push({
            id: "corpus.engineering-road-empty",
            domain: "corpus",
            level: "attention",
            summary:
              "Source repositories are registered and nothing in curated knowledge describes how they work",
            facts: {
              repositories: connections.length,
              productPages: concepts,
              engineeringPages: 0,
            },
            // Writing that road is a deliberate undertaking, not a step someone
            // takes before ending a turn. Claiming it awaits the agent would arm
            // the stop guard against work no turn can finish; claiming it awaits
            // the maintainer would put a question in their queue that is not
            // theirs to answer. It is a fact about the corpus, and being in the
            // brief at all is the whole of what it needs to do.
          });
        }
      }
      const compiledAt = stringValue(graph.generatedAt);
      const newest = await newestModification(join(context.knowledgeRoot, "knowledge"));
      if (compiledAt && newest && newest > Date.parse(compiledAt)) {
        signals.push({
          id: "corpus.stale-compilation",
          domain: "corpus",
          level: "info",
          summary: "Curated knowledge changed after the graph was compiled",
          since: compiledAt,
          awaits: "agent",
        });
      }
      return signals;
    },
  };
}

/**
 * Indexing and embedding are separate operations: `qmd update` records new
 * documents and marks them as needing vectors, and only `qmd embed` builds
 * them. Nothing in the workflow runs the second one, so an agent writing
 * reconstruction packets all day leaves semantic search behind on exactly the
 * material it just produced and is never told. `qmd status` answers in about
 * a fifth of a second and prints the pending line only when work is waiting.
 *
 * This awaits nobody. Embedding is needed before retrieval rather than after
 * writing, so the obligation belongs to the paths that search — they already
 * read `qmd status` — and a signal that claimed the agent owed work here would
 * cost a turn on every reply until someone ran a maintenance command.
 */
function retrievalCollector(): StateCollector {
  return {
    id: "retrieval",
    profiles: ["knowledge"],
    async collect(context) {
      const result = runTool("qmd", ["status"], { cwd: context.knowledgeRoot });
      if (result.status !== 0) {
        // Tool availability is the doctor's subject, not the repository's state.
        return [];
      }
      const pending = Number(
        /^\s*Pending:\s+(\d+)\s+need embedding/mi.exec(result.stdout)?.[1] ?? "0",
      );
      if (!Number.isFinite(pending) || pending <= 0) {
        return [];
      }
      return [{
        id: "corpus.embeddings-stale",
        domain: "corpus",
        level: "info",
        summary: "Indexed documents have no semantic vectors; search falls back to lexical BM25",
        facts: { documents: pending, command: "qmd embed" },
      }];
    },
  };
}

function reconstructionCollector(): StateCollector {
  return {
    id: "reconstruction",
    profiles: ["knowledge"],
    async collect(context) {
      const root = join(context.knowledgeRoot, "reconstruction/active");
      const signals: StateSignal[] = [];
      for (const entry of await activeRecords(root)) {
        const metadata = entry.document.metadata;
        const repositories = recordArray(metadata.repositories);
        const totals = { files: 0, pendingFiles: 0, communities: 0, pendingCommunities: 0 };
        for (const repository of repositories) {
          const relative = stringValue(repository.coverage);
          if (!relative) {
            continue;
          }
          const ledger = await readJson(join(entry.root, relative));
          const manifest = recordValue(ledger?.manifest);
          const graphify = recordValue(ledger?.graphify);
          const files = Array.isArray(manifest?.files) ? manifest.files : [];
          const communities = Array.isArray(graphify?.communities) ? graphify.communities : [];
          totals.files += files.length;
          totals.pendingFiles += files.filter(isPending).length;
          totals.communities += communities.length;
          totals.pendingCommunities += communities.filter(isPending).length;
        }
        const decisions = pendingDecisions(metadata);
        const frontierClear = totals.pendingFiles === 0 && totals.files > 0;
        signals.push({
          id: frontierClear && decisions > 0
            ? "reconstruction.awaiting-decision"
            : "reconstruction.active",
          domain: "reconstruction",
          level: "attention",
          summary: frontierClear && decisions > 0
            ? "A reconstruction has read its frontier and is waiting on a maintainer decision"
            : "A reconstruction is in progress",
          subject: entry.id,
          facts: {
            title: stringValue(metadata.title) || entry.id,
            mode: stringValue(metadata.mode),
            repositories: repositories.length,
            filesReviewed: totals.files - totals.pendingFiles,
            files: totals.files,
            communitiesReviewed: totals.communities - totals.pendingCommunities,
            communities: totals.communities,
            ...(decisions > 0 ? { decisions } : {}),
          },
          ...(stringValue(metadata.updated_at)
            ? { since: stringValue(metadata.updated_at) }
            : {}),
          awaits: frontierClear && decisions > 0 ? "maintainer" : "agent",
        });
        signals.push(...checkpointSignals(
          "reconstruction",
          entry.id,
          metadata,
          await reconstructionBasis(context.knowledgeRoot, entry),
        ));
        signals.push(...await workstreamSignals(entry));

        const scope = recordValue(
          recordValue(recordValue(metadata.supplemental_inputs)?.raw)?.scope,
        );
        if (scope && !stringValue(scope.mode)) {
          signals.push({
            id: "reconstruction.raw-scope-pending",
            domain: "reconstruction",
            level: "blocked",
            summary: "The reconstruction is waiting for a raw-scope decision: all, selected themes, or none",
            subject: entry.id,
            awaits: "maintainer",
            blocks: ["process-raw-intake"],
          });
        }
      }
      return signals;
    },
  };
}

/**
 * Candidates whose `maintainer_decision` is `required` and unanswered. A case
 * that has finished reading and holds one of these is not waiting on the agent
 * for anything: every remaining move is the maintainer's. Reporting it as
 * agent-owned work is how eleven finished reviews sat unmentioned for a week
 * while the one rule written to protect the maintainer's attention — a signal
 * with `awaits: maintainer` is a question for them — had nothing to fire on.
 */
function pendingDecisions(metadata: Record<string, unknown>): number {
  return recordArray(metadata.candidate_claims).filter((candidate) => {
    const decision = recordValue(candidate.maintainer_decision);
    return stringValue(decision?.status) === "required" && !stringValue(decision?.at);
  }).length;
}

function intakeCollector(): StateCollector {
  return {
    id: "intake",
    profiles: ["knowledge"],
    async collect(context) {
      const root = join(context.knowledgeRoot, "intake/cases/active");
      const signals: StateSignal[] = [];
      for (const entry of await activeRecords(root)) {
        const metadata = entry.document.metadata;
        const sources = recordArray(metadata.sources);
        const reviewed = sources.filter((source) =>
          source.status === "reviewed" || source.status === "no-relevant-claims"
        ).length;
        const blocked = sources.filter((source) =>
          source.status === "needs-maintainer" || source.status === "unreadable"
        ).length;
        const decisions = pendingDecisions(metadata);
        const readingDone = reviewed === sources.length && sources.length > 0;
        // A record that says it is blocked is blocked. Gating the maintainer's
        // queue on unanswered candidates alone made the queue shed a case the
        // moment its last candidate was answered, so the more finished a case
        // was the more reliably it vanished — and the stop guard, reading the
        // same signal, pushed every new session to re-read sources whose own
        // next action says not to.
        const checkpoint = recordValue(metadata.checkpoint);
        const heldForMaintainer = stringValue(checkpoint?.status) === "blocked"
          || (Array.isArray(checkpoint?.blockers) && checkpoint.blockers.length > 0);
        const since = stringValue(metadata.updated_at)
          ? { since: stringValue(metadata.updated_at) }
          : {};
        signals.push(
          readingDone && (decisions > 0 || heldForMaintainer)
            ? {
              id: "intake.awaiting-decision",
              domain: "intake",
              level: "attention",
              summary: "A raw-intake case is read and waiting on a maintainer decision",
              subject: entry.id,
              facts: {
                title: stringValue(metadata.title) || entry.id,
                sources: sources.length,
                decisions,
                ...(heldForMaintainer ? { blocked: true } : {}),
              },
              ...since,
              awaits: "maintainer",
            }
            : {
              id: "intake.active",
              domain: "intake",
              level: "attention",
              summary: "A raw-intake case is in progress",
              subject: entry.id,
              facts: {
                title: stringValue(metadata.title) || entry.id,
                reviewed,
                sources: sources.length,
                ...(decisions > 0 ? { decisions } : {}),
              },
              ...since,
              awaits: "agent",
            },
        );
        if (blocked > 0) {
          signals.push({
            id: "intake.blocked-sources",
            domain: "intake",
            level: "blocked",
            summary: "Raw sources cannot be resolved without a maintainer decision",
            subject: entry.id,
            facts: { blocked },
            awaits: "maintainer",
          });
        }
        // An intake checkpoint's basis is the case record alone; it owns no
        // dossier or coverage ledger the way a reconstruction does.
        signals.push(...checkpointSignals(
          "intake",
          entry.id,
          metadata,
          sessionBasis(entry.document),
        ));
      }
      return signals;
    },
  };
}

function rawCollector(): StateCollector {
  return {
    id: "raw",
    profiles: ["knowledge"],
    async collect(context) {
      const files = await countFiles(join(context.knowledgeRoot, "raw"));
      if (files === 0) {
        return [{
          id: "raw.empty",
          domain: "raw",
          level: "ok",
          summary: "No raw material is waiting",
          blocks: ["process-raw-intake"],
        }];
      }
      const cases = (await activeRecords(join(context.knowledgeRoot, "intake/cases/active")))
        .length
        + (await directoryCount(join(context.knowledgeRoot, "intake/cases/archive")));
      return [{
        id: cases === 0 ? "raw.unprocessed" : "raw.present",
        domain: "raw",
        level: cases === 0 ? "attention" : "info",
        summary: cases === 0
          ? "Raw material exists and no intake case has ever covered it"
          : "Raw material is present",
        facts: { files, cases },
      }];
    },
  };
}

/**
 * The trajectory pipeline reaching the brief at all.
 *
 * Six commands existed — check, ask, declare, promote, debts, schedule — and not
 * one signal, so nothing ever announced that any of them was due. An agent
 * opening a session saw an open change bundle and no mention of five subjects
 * without a direction or forty-eight debts nobody had taken, and went where the
 * brief pointed. A capability nobody is told about is a capability nobody uses;
 * this is the wire that was missing, not another command.
 *
 * The order of the two gates is the product's, not the corpus's. A debt is owed
 * against a declared direction, so debts cannot be ordered while subjects still
 * lack one — reviewing them earlier asks the maintainer to rank work against a
 * standard nobody has set. Direction first, then what it costs.
 */
function trajectoryCollector(): StateCollector {
  return {
    id: "trajectory",
    profiles: ["knowledge"],
    async collect(context) {
      let ledger;
      let compilation;
      try {
        compilation = await compileTrajectories(context.knowledgeRoot);
        if (compilation.graph.trajectories.length === 0) {
          return [];
        }
        ledger = await collectDebts(context.knowledgeRoot);
      } catch {
        // No trajectories assembled yet, or a repository this does not apply to.
        return [];
      }

      const signals: StateSignal[] = [];
      if (compilation.errors.length > 0) {
        signals.push({
          id: "trajectory.invalid",
          domain: "trajectory",
          level: "attention",
          summary: "Trajectories do not compile, so nothing downstream can be trusted",
          facts: {
            errors: compilation.errors.length,
            command: "wfctl knowledge trajectory check",
          },
          awaits: "agent",
        });
        return signals;
      }

      if (compilation.pending.length > 0) {
        signals.push({
          id: "trajectory.awaiting-vision",
          domain: "trajectory",
          level: "attention",
          summary: "Subjects are waiting on you to say where they should go",
          facts: {
            subjects: compilation.pending.length,
            worstFirst: nameThem(compilation.pending.map((entry) => entry.subject)),
            command: "wfctl knowledge trajectory ask",
          },
          awaits: "maintainer",
        });
      }

      // A subject read from source and never written down exists only in the
      // pipeline's own working records. Curated knowledge is what anyone else
      // reads, so an unpublished subject is a subject the project does not
      // appear to have. This used to be unreachable for anything the maintainer
      // had not given a direction; now the only thing between a read subject and
      // its page is running the promotion, which is the agent's to run.
      const unpublished: string[] = [];
      for (const record of compilation.graph.trajectories) {
        const page = join(
          context.knowledgeRoot,
          "knowledge/areas",
          record.area,
          `${record.id.replace(/^traj-/, "")}.md`,
        );
        if (!await pathExists(page)) {
          unpublished.push(record.subject);
        }
      }
      if (unpublished.length > 0) {
        signals.push({
          id: "trajectory.unpublished",
          domain: "trajectory",
          level: "attention",
          summary: "Subjects were read from source and no curated page carries them",
          facts: {
            subjects: unpublished.length,
            named: nameThem(unpublished),
            command: "wfctl knowledge trajectory promote",
          },
          awaits: "agent",
        });
      }

      const open = ledger.debts.filter((debt) => debt.status === "open");
      const scheduled = ledger.debts.filter((debt) => debt.status === "to-close");
      if (open.length > 0 && compilation.pending.length === 0) {
        // Every subject that owes something has a direction to owe it against,
        // so what the project owes can now be ordered. Until one debt is taken
        // this is the decision the whole reconstruction was for, and it is the
        // maintainer's: which of these matter, and in what order.
        signals.push({
          id: "trajectory.debts-unscheduled",
          domain: "trajectory",
          level: "attention",
          summary: scheduled.length === 0
            ? "Everything the project owes is recorded and none of it is anyone's yet"
            : "Debts are recorded that nobody has taken",
          facts: {
            open: open.length,
            scheduled: scheduled.length,
            command: "wfctl knowledge trajectory debts",
          },
          awaits: "maintainer",
        });
      }
      if (ledger.dangling.length > 0) {
        signals.push({
          id: "trajectory.debt-dangling",
          domain: "trajectory",
          level: "attention",
          summary: "A debt names work that exists nowhere, so it reads as handled",
          facts: { debts: ledger.dangling.length },
          awaits: "agent",
        });
      }
      if (ledger.settled.length > 0) {
        signals.push({
          id: "trajectory.debt-settled",
          domain: "trajectory",
          level: "info",
          summary: "Work naming a debt has landed; the subject needs reading again at a new revision",
          facts: { debts: ledger.settled.length },
          awaits: "agent",
        });
      }
      return signals;
    },
  };
}

function workCollector(): StateCollector {
  return {
    id: "work",
    profiles: ["knowledge", "leaf"],
    async collect(context) {
      const root = join(context.knowledgeRoot, "changes/active");
      const signals: StateSignal[] = [];
      for (const entry of await activeRecords(root, "change.md")) {
        const metadata = entry.document.metadata;
        const issues = await issueCounts(join(entry.root, "issues"));

        // A bundle carries no status that says an approval became due, so report
        // what closure still requires rather than guessing at a stage machine.
        const review = recordValue(metadata.maintainer_review);
        const outstanding = (["framing", "completion"] as const).filter((stage) =>
          stringValue(recordValue(review?.[stage])?.status) !== "approved"
        );
        const checkpoint = recordValue(metadata.checkpoint);
        const park = readPark(metadata);
        const heldForMaintainer = Boolean(park)
          || outstanding.includes("framing")
          || stringValue(checkpoint?.status) === "blocked"
          || (Array.isArray(checkpoint?.blockers) && checkpoint.blockers.length > 0);

        // Who a bundle waits on is inherited, never assumed. Reporting an open
        // bundle as agent-side while its framing is unapproved armed the stop
        // guard on a state only the maintainer could change: the agent was
        // re-entered on every turn for as long as the approval took, each turn
        // told to take an action it did not have. The same collector was already
        // emitting the maintainer signal two lines down while contradicting it
        // here, so the tool held both answers at once and published the wrong one.
        //
        // A frontier nobody has claimed is available work, not work in hand, and
        // the difference decides whether a turn may end. Treating every open
        // bundle as agent-side turned three bundles into a standing obligation:
        // an agent that had finished a unit cleanly, with fresh checkpoints and a
        // clean `wfctl resumable`, said it would not start the largest remaining
        // task on a spent context because that record warns a half-built change
        // leaves the engine inconsistent — and was returned to the turn and
        // started it anyway. Work is in hand while an issue is claimed, while the
        // bundle has no frontier yet, and while a finished frontier has not
        // closed. A queue of ready issues is none of those.
        const queued = (issues.issuesClaimed ?? 0) === 0 && (issues.issuesOpen ?? 0) > 0;

        signals.push({
          id: "work.active",
          domain: "work",
          level: "attention",
          summary: park
            ? "A change bundle is parked and does not start"
            : heldForMaintainer
            ? "A change bundle is open and held for you"
            : queued
            ? "A change bundle is open and nothing in it is claimed"
            : "A change bundle is open",
          subject: entry.id,
          facts: {
            title: stringValue(metadata.title) || entry.id,
            mode: stringValue(metadata.mode),
            status: stringValue(metadata.status),
            repositories: recordArray(metadata.repositories).length,
            ...issues,
          },
          ...(stringValue(metadata.updated_at)
            ? { since: stringValue(metadata.updated_at) }
            : {}),
          ...(heldForMaintainer
            ? { awaits: "maintainer" as const }
            : queued
            ? {}
            : { awaits: "agent" as const }),
        });
        // Outstanding is not the same as answerable. Completion approves work
        // that has been done and verified; asking for it on a bundle still being
        // shaped is a demand nobody can satisfy, and two of them stood in the
        // live queue permanently, indistinguishable from decisions actually
        // waiting. The capability still reports both as blocking closure —
        // that is what closure requires — but the maintainer is only shown the
        // one they can answer today.
        // Work spanning more than one repository can only be shaped from the
        // centre, where each repository's own rules — the instructions it
        // writes for itself and the skills installed only there — are invisible
        // unless someone goes and reads them. This says which ones nobody has.
        // It is the agent's: reading them needs no decision from anyone.
        const unaccounted = recordArray(metadata.repositories)
          .filter((entry) => {
            const status = stringValue(recordValue(entry.accounted)?.status);
            return status !== "read" && status !== "untouched";
          })
          .map((entry) => stringValue(entry.repository))
          .filter(Boolean);
        if (unaccounted.length > 0 && outstanding.includes("framing")) {
          signals.push({
            id: "work.repositories-unaccounted",
            domain: "work",
            level: "attention",
            summary: "Source repositories have not been read on their own terms",
            subject: entry.id,
            facts: {
              repositories: unaccounted.length,
              named: nameThem(unaccounted),
              command: `wfctl work repositories ${entry.id}`,
            },
            awaits: "agent",
          });
        }
        const verified = stringValue(recordValue(metadata.verification)?.result) === "passed";
        const answerable = outstanding.filter((stage) => stage === "framing" || verified);
        if (answerable.length > 0) {
          signals.push({
            id: "work.approvals-outstanding",
            domain: "work",
            level: "attention",
            summary: "Closure still requires your recorded approval",
            subject: entry.id,
            facts: {
              stages: answerable.join(","),
              command: `wfctl work ask ${entry.id} --stage ${answerable[0]}`,
            },
            awaits: "maintainer",
            blocks: ["close-work"],
          });
        } else if (outstanding.length > 0) {
          signals.push({
            id: "work.approvals-later",
            domain: "work",
            level: "info",
            summary: "Approval will be needed at closure, and cannot be given yet",
            subject: entry.id,
            facts: { stages: outstanding.join(",") },
            // Nobody owes an action. The maintainer cannot approve work that has
            // not been done, and the agent has nothing to do about a future
            // approval — so claiming either would arm the stop guard on a fact.
            blocks: ["close-work"],
          });
        }
        if (stringValue(recordValue(metadata.verification)?.result) !== "passed") {
          // Verification is what happens after the route is finished, so it is
          // the agent's next action only once nothing is left open or claimed.
          //
          // Claiming it earlier armed the stop guard on a bundle whose agent was
          // waiting for a person to look at a page. It was returned nine times
          // in one turn, and each time it found real side work — tests, a
          // refactor, two commits — which changed the state fingerprint and so
          // defeated the guard's own release. A blocked agent that keeps busy is
          // indistinguishable from a productive one, which is why the condition
          // has to be what is left to do rather than how recently something moved.
          const routeFinished = issues.issuesOpen === 0 && issues.issuesClaimed === 0;
          signals.push({
            id: "work.verification-pending",
            domain: "work",
            level: "info",
            summary: "The bundle has not passed verification",
            subject: entry.id,
            // Held for the maintainer means held, whichever way the record says
            // so — parked, framing unapproved, or a checkpoint naming a blocker.
            // The blocker was missing from this condition while the stop guard's
            // own message told agents that recording one is what quiets it, so
            // the one documented escape from a re-entry loop did not work on the
            // signal most likely to have caused it.
            ...(heldForMaintainer
              ? { awaits: "maintainer" as const }
              : routeFinished
              ? { awaits: "agent" as const }
              : {}),
            blocks: ["close-work"],
          });
        }
        signals.push(...checkpointSignals(
          "work",
          entry.id,
          metadata,
          workCheckpointBasis(entry.document),
        ));
      }
      return signals;
    },
  };
}

/**
 * A count is not actionable. Reporting fourteen pending captures and nothing
 * else gives an agent no reason to open any of them, and they stay in the
 * directory indefinitely whether or not anyone needed an answer. Naming them
 * costs a line and makes the queue impossible to read past.
 */
/**
 * A queue reported as a number reads as brevity and works as concealment: it
 * says nothing about what the entries contain, and the longer it grows the more
 * it hides. Name them, and say plainly how many were left off.
 */
function nameThem(items: readonly string[]): string {
  const shown = items.slice(0, 20);
  return items.length > shown.length
    ? `${shown.join(", ")}, and ${items.length - shown.length} more`
    : shown.join(", ");
}

function inboxCollector(): StateCollector {
  return {
    id: "inbox",
    profiles: ["knowledge"],
    async collect(context) {
      const captures = await listCaptures(context.knowledgeRoot);
      if (captures.captures.length === 0) {
        return [];
      }
      const since = (entries: typeof captures.captures) =>
        entries.map((capture) => capture.createdAt).filter(Boolean).sort()[0];
      // A capture the maintainer has to answer is a question, not a chore. Both
      // sat under one triage signal, so a queue of adjudications read as agent
      // housekeeping and the maintainer was never told it existed.
      const decisions = captures.captures.filter((capture) => capture.awaits === "maintainer");
      const triage = captures.captures.filter((capture) => capture.awaits !== "maintainer");
      const signals: StateSignal[] = [];
      if (decisions.length > 0) {
        const oldest = since(decisions);
        signals.push({
          id: "inbox.awaiting-decision",
          domain: "inbox",
          level: "attention",
          summary: "Captures are waiting for a maintainer decision",
          facts: {
            captures: decisions.length,
            command: "wfctl work capture list",
            waiting: nameThem(decisions.map((capture) => capture.id)),
          },
          ...(oldest ? { since: oldest } : {}),
          awaits: "maintainer",
        });
      }
      if (triage.length > 0) {
        const oldest = since(triage);
        signals.push({
          id: "inbox.pending",
          domain: "inbox",
          level: "attention",
          summary: "Captures are waiting for triage",
          facts: {
            captures: triage.length,
            command: "wfctl work capture list",
            waiting: nameThem(triage.map((capture) => capture.id)),
          },
          ...(oldest ? { since: oldest } : {}),
          awaits: "agent",
        });
      }
      return signals;
    },
  };
}

/**
 * A packet still claimed at session start belongs to a worker that never
 * submitted. It cannot be re-claimed or reviewed, so its scope is stranded
 * until someone cancels it — worth saying before any other planning.
 */
async function workstreamSignals(entry: ActiveRecord): Promise<StateSignal[]> {
  const packets = await markdownRecords(join(entry.root, "workstreams"));
  const counts = { packets: packets.length, claimed: 0, submitted: 0, accepted: 0 };
  const stranded: string[] = [];
  for (const packet of packets) {
    const status = stringValue(packet.document.metadata.status);
    if (status === "claimed" || status === "active") {
      counts.claimed += 1;
      stranded.push(packet.id);
    } else if (status === "submitted") {
      counts.submitted += 1;
    } else if (status === "accepted") {
      counts.accepted += 1;
    }
  }
  if (counts.packets === 0) {
    return [];
  }
  // Inventory, not a task. Packets that are all accepted describe finished work
  // and owe nobody anything; only ones still claimed or submitted put an action
  // on the agent. Marking the description as agent-owned made every turn in a
  // completed reconstruction re-enter the stop guard forever, on a line that
  // said 28 of 28 accepted.
  const inFlight = counts.claimed + counts.submitted;
  const signals: StateSignal[] = [{
    id: "reconstruction.workstreams",
    domain: "reconstruction",
    level: "info",
    summary: "Worker packets are recorded for this reconstruction",
    subject: entry.id,
    facts: counts,
    ...(inFlight > 0 ? { awaits: "agent" as const } : {}),
  }];
  if (stranded.length > 0) {
    signals.push({
      id: "reconstruction.stranded-workstream",
      domain: "reconstruction",
      level: "blocked",
      summary:
        "A worker packet is still claimed and its worker is gone; it cannot be "
        + "re-claimed or reviewed until it is cancelled",
      subject: `${entry.id}/${stranded[0]}`,
      facts: { stranded: stranded.length, packets: stranded.join(",") },
      awaits: "agent",
    });
  }
  return signals;
}

/**
 * A reconstruction basis spans dossiers, workstreams, and coverage ledgers, so
 * a missing or malformed one is a real possibility. The brief keeps reporting
 * every other signal when it cannot be computed and says so explicitly.
 */
async function reconstructionBasis(
  knowledgeRoot: string,
  entry: ActiveRecord,
): Promise<string | undefined> {
  try {
    return await reconstructionCheckpointBasis(knowledgeRoot, entry.id, entry.document);
  } catch {
    return undefined;
  }
}

/**
 * A checkpoint that no longer describes the record it summarizes is a resume
 * hazard, and every session-owning record carries one, so the test lives in one
 * place.
 *
 * The test is the basis digest the checkpoint stamped itself with, never the
 * checkpoint's age. Age answers a different question: a checkpoint written a
 * minute ago can already be forty edits behind, and one untouched for a week is
 * perfectly resumable if nothing moved. Reporting age as freshness is why the
 * one question the maintainer asks every session — "is this safe to close?" —
 * could not be answered from the brief.
 *
 * `currentBasis` is `undefined` when it could not be computed. That is reported
 * as unverified rather than passed over, because silence here reads as a clean
 * bill of health.
 */
function checkpointSignals(
  domain: "reconstruction" | "intake" | "work",
  subject: string,
  metadata: Record<string, unknown>,
  currentBasis: string | undefined,
): StateSignal[] {
  const checkpoint = recordValue(metadata.checkpoint);
  const updatedAt = stringValue(checkpoint?.updated_at);
  if (!checkpoint || !updatedAt) {
    return [];
  }
  const signals: StateSignal[] = [];
  // The two fields written for the sole purpose of resuming a session were the
  // two the brief did not carry. A new session received seventeen signals about
  // what is outstanding and not one word about where the work actually stopped,
  // so it had to know, unprompted, to go and read the record — and when it did
  // not, it rebuilt the frontier by guessing. The prose costs a few hundred
  // characters and is the whole point of the record.
  const currentState = stringValue(checkpoint.current_state).trim();
  const nextAction = stringValue(checkpoint.next_action).trim();
  if (currentState || nextAction) {
    signals.push({
      id: `${domain}.resume`,
      domain,
      level: "info",
      summary: "Where this work stopped, and the next action it named",
      subject,
      facts: {
        ...(currentState ? { state: currentState } : {}),
        ...(nextAction ? { next: nextAction } : {}),
        stage: stringValue(checkpoint.stage),
      },
      since: updatedAt,
    });
  }
  const recordedBasis = stringValue(checkpoint.basis_sha256);
  if (currentBasis === undefined) {
    signals.push({
      id: `${domain}.unverifiable-checkpoint`,
      domain,
      level: "attention",
      summary: "The resume checkpoint could not be checked against the record it summarizes",
      subject,
      since: updatedAt,
      awaits: "agent",
    });
  } else if (recordedBasis !== currentBasis) {
    signals.push({
      id: `${domain}.stale-checkpoint`,
      domain,
      level: "attention",
      summary: "The resume checkpoint no longer matches the record it summarizes",
      subject,
      since: updatedAt,
      awaits: "agent",
    });
  }
  const blockers = Array.isArray(checkpoint.blockers) ? checkpoint.blockers : [];
  if (blockers.length > 0) {
    signals.push({
      id: `${domain}.blocked`,
      domain,
      level: "blocked",
      summary: "The record records explicit blockers",
      subject,
      // A blocker is the only sentence in a checkpoint addressed to the
      // maintainer rather than to the next agent, so it is the one thing that
      // has to survive the session boundary intact. Showing the first and
      // counting the rest hid every blocker but one.
      facts: {
        blockers: blockers.length,
        blocking: nameThem(blockers.map((entry) => stringValue(entry))),
      },
      awaits: "maintainer",
    });
  }
  // Small jobs carried across the session boundary. They are named rather than
  // counted for the same reason blockers are: a list reported as a number is a
  // list nobody opens, and these are the entries a fresh session has no other
  // way to learn about.
  const todo = Array.isArray(checkpoint.todo) ? checkpoint.todo : [];
  if (todo.length > 0) {
    signals.push({
      id: `${domain}.todo`,
      domain,
      level: "info",
      summary: "The record carries small jobs from an earlier session",
      subject,
      facts: {
        jobs: todo.length,
        outstanding: nameThem(todo.map((entry) => stringValue(entry))),
      },
      since: updatedAt,
      awaits: "agent",
    });
  }
  return signals;
}

interface ActiveRecord {
  id: string;
  root: string;
  document: { metadata: Record<string, unknown>; body: string };
}

async function activeRecords(root: string, file = "case.md"): Promise<ActiveRecord[]> {
  const records: ActiveRecord[] = [];
  for (const name of await directoryNames(root)) {
    const directory = join(root, name);
    try {
      const content = await readFile(join(directory, file), "utf8");
      records.push({ id: name, root: directory, document: parseWorkSpec(content) });
    } catch {
      records.push({ id: name, root: directory, document: { metadata: {}, body: "" } });
    }
  }
  return records;
}

async function markdownRecords(root: string): Promise<ActiveRecord[]> {
  let names: string[];
  try {
    names = (await readdir(root)).filter((name) => name.endsWith(".md")).sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
  const records: ActiveRecord[] = [];
  for (const name of names) {
    const path = join(root, name);
    try {
      records.push({
        id: name.slice(0, -3),
        root: path,
        document: parseWorkSpec(await readFile(path, "utf8")),
      });
    } catch {
      records.push({ id: name.slice(0, -3), root: path, document: { metadata: {}, body: "" } });
    }
  }
  return records;
}

async function issueCounts(root: string): Promise<Record<string, number>> {
  const counts = { issues: 0, issuesOpen: 0, issuesClaimed: 0 };
  let names: string[];
  try {
    names = (await readdir(root)).filter((name) => name.endsWith(".md"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return counts;
    }
    throw error;
  }
  for (const name of names) {
    counts.issues += 1;
    try {
      const status = stringValue(
        parseWorkSpec(await readFile(join(root, name), "utf8")).metadata.status,
      );
      if (status === "claimed") {
        counts.issuesClaimed += 1;
      }
      if (status === "draft" || status === "ready" || status === "claimed") {
        counts.issuesOpen += 1;
      }
    } catch {
      counts.issuesOpen += 1;
    }
  }
  return counts;
}

async function directoryNames(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

async function directoryCount(root: string): Promise<number> {
  return (await directoryNames(root)).length;
}

const FILE_SCAN_LIMIT = 5_000;

async function countFiles(root: string, budget = { left: FILE_SCAN_LIMIT }): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return 0;
    }
    throw error;
  }
  for (const entry of entries) {
    if (budget.left <= 0) {
      break;
    }
    if (entry.name.startsWith(".")) {
      continue;
    }
    if (entry.isDirectory()) {
      total += await countFiles(join(root, entry.name), budget);
    } else if (entry.isFile()) {
      budget.left -= 1;
      total += 1;
    }
  }
  return total;
}

async function newestModification(
  root: string,
  budget = { left: FILE_SCAN_LIMIT },
): Promise<number | undefined> {
  let newest: number | undefined;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
  for (const entry of entries) {
    if (budget.left <= 0) {
      break;
    }
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await newestModification(path, budget);
      if (nested !== undefined && (newest === undefined || nested > newest)) {
        newest = nested;
      }
    } else if (entry.isFile()) {
      budget.left -= 1;
      const modified = (await stat(path)).mtimeMs;
      if (newest === undefined || modified > newest) {
        newest = modified;
      }
    }
  }
  return newest;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return recordValue(parsed);
  } catch {
    return undefined;
  }
}

function isPending(value: unknown): boolean {
  return recordValue(value)?.status === "pending";
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
