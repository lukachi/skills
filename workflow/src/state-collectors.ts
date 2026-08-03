import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { listCaptures } from "./capture.js";
import { isMissingFileError } from "./config.js";
import { runTool } from "./dependencies.js";
import { listRepositoryConnections } from "./repository-registry.js";
import type { StateCollector, StateContext, StateSignal } from "./state.js";
import { WORKFLOW_VERSION } from "./types.js";
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
        signals.push(...checkpointSignals("reconstruction", entry.id, metadata, context));
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
        signals.push(...checkpointSignals("intake", entry.id, metadata, context));
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
        signals.push({
          id: "work.active",
          domain: "work",
          level: "attention",
          summary: "A change bundle is open",
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
          awaits: "agent",
        });

        // A bundle carries no status that says an approval became due, so report
        // what closure still requires rather than guessing at a stage machine.
        const review = recordValue(metadata.maintainer_review);
        const outstanding = (["framing", "completion"] as const).filter((stage) =>
          stringValue(recordValue(review?.[stage])?.status) !== "approved"
        );
        if (outstanding.length > 0) {
          signals.push({
            id: "work.approvals-outstanding",
            domain: "work",
            level: "attention",
            summary: "Closure still requires your recorded approval",
            subject: entry.id,
            facts: {
              stages: outstanding.join(","),
              command: `wfctl work approve ${entry.id} --stage ${outstanding[0]}`,
            },
            awaits: "maintainer",
            blocks: ["close-work"],
          });
        }
        if (stringValue(recordValue(metadata.verification)?.result) !== "passed") {
          signals.push({
            id: "work.verification-pending",
            domain: "work",
            level: "info",
            summary: "The bundle has not passed verification",
            subject: entry.id,
            awaits: "agent",
            blocks: ["close-work"],
          });
        }
        signals.push(...checkpointSignals("work", entry.id, metadata, context));
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
function nameThem(captures: readonly { id: string }[]): string {
  const shown = captures.slice(0, 20).map((capture) => capture.id);
  return captures.length > shown.length
    ? `${shown.join(", ")}, and ${captures.length - shown.length} more`
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
            waiting: nameThem(decisions),
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
            waiting: nameThem(triage),
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
  const signals: StateSignal[] = [{
    id: "reconstruction.workstreams",
    domain: "reconstruction",
    level: "info",
    summary: "Worker packets are recorded for this reconstruction",
    subject: entry.id,
    facts: counts,
    awaits: "agent",
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

const STALE_CHECKPOINT_DAYS = 3;

/**
 * A checkpoint that predates the record it summarizes is a resume hazard, and
 * every session-owning record carries one, so the test lives in one place.
 */
function checkpointSignals(
  domain: "reconstruction" | "intake" | "work",
  subject: string,
  metadata: Record<string, unknown>,
  context: StateContext,
): StateSignal[] {
  const checkpoint = recordValue(metadata.checkpoint);
  const updatedAt = stringValue(checkpoint?.updated_at);
  if (!checkpoint || !updatedAt) {
    return [];
  }
  const signals: StateSignal[] = [];
  const age = context.now.getTime() - Date.parse(updatedAt);
  if (Number.isFinite(age) && age > STALE_CHECKPOINT_DAYS * 86_400_000) {
    signals.push({
      id: `${domain}.stale-checkpoint`,
      domain,
      level: "info",
      summary: "The resume checkpoint is older than the record it summarizes",
      subject,
      since: updatedAt,
      facts: { days: Math.floor(age / 86_400_000) },
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
      facts: { blockers: blockers.length, first: stringValue(blockers[0]) },
      awaits: "maintainer",
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
