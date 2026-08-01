import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { listCaptures } from "./capture.js";
import { isMissingFileError } from "./config.js";
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
        signals.push({
          id: "reconstruction.active",
          domain: "reconstruction",
          level: "attention",
          summary: "A reconstruction is in progress",
          subject: entry.id,
          facts: {
            title: stringValue(metadata.title) || entry.id,
            mode: stringValue(metadata.mode),
            repositories: repositories.length,
            filesReviewed: totals.files - totals.pendingFiles,
            files: totals.files,
            communitiesReviewed: totals.communities - totals.pendingCommunities,
            communities: totals.communities,
          },
          ...(stringValue(metadata.updated_at)
            ? { since: stringValue(metadata.updated_at) }
            : {}),
          awaits: "agent",
        });
        signals.push(...checkpointSignals("reconstruction", entry.id, metadata, context));

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
        signals.push({
          id: "intake.active",
          domain: "intake",
          level: "attention",
          summary: "A raw-intake case is in progress",
          subject: entry.id,
          facts: {
            title: stringValue(metadata.title) || entry.id,
            reviewed,
            sources: sources.length,
          },
          ...(stringValue(metadata.updated_at)
            ? { since: stringValue(metadata.updated_at) }
            : {}),
          awaits: "agent",
        });
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

function inboxCollector(): StateCollector {
  return {
    id: "inbox",
    profiles: ["knowledge"],
    async collect(context) {
      const captures = await listCaptures(context.knowledgeRoot);
      if (captures.captures.length === 0) {
        return [];
      }
      const oldest = captures.captures
        .map((capture) => capture.createdAt)
        .filter(Boolean)
        .sort()[0];
      return [{
        id: "inbox.pending",
        domain: "inbox",
        level: "attention",
        summary: "Captures are waiting for triage",
        facts: { captures: captures.captures.length },
        ...(oldest ? { since: oldest } : {}),
        awaits: "agent",
      }];
    },
  };
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
