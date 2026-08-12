import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { isMissingFileError, readConfig, resolveKnowledgeRoot } from "./config.js";
import { validateKnowledge } from "./knowledge.js";
import { recordApproval } from "./approval.js";
import { initializeDocumentCheckpoint, reviewBundleFile } from "./work-bundle.js";
import {
  type ApprovalMethod,
  decisionAccountingIssues,
  isRecord,
  parseWorkSpec,
  promotionGateIssues,
  serializeWorkSpec,
} from "./work-spec.js";
import type { WorkSpecDocument } from "./types.js";

/**
 * Promotion, and why it is the gate rather than closure.
 *
 * Closing a bundle asks whether the work was done. Every part of that answer is
 * already in the record — verified criteria, passed receipts, pinned revisions,
 * terminal issues — so a person asked to confirm it is being asked to sign
 * arithmetic they cannot check better than the tool. Promotion asks something
 * else entirely: whether this is what the project now says about itself. Nothing
 * in the repository can answer that, and it is the answer the next session reads.
 *
 * Moving the gate here also removes a deadlock that used to be paid for with a
 * broken corpus. A curated page cites the change that authorises it, and that
 * citation resolved only from a change the maintainer had already accepted —
 * while accepting the change required the pages to have been written. The way
 * through was to write them, leave `knowledge/` invalid, and wait. Now the pages
 * wait in the bundle instead, closure makes the change citable on its own
 * evidence, and the corpus goes from correct to correct.
 *
 * Three directories, and the bundle's location is the queue:
 *
 * - `changes/active/` — being worked.
 * - `changes/promotion/` — closed, and holding pages nobody has approved.
 * - `changes/archive/` — closed, and everything it settled has been taught.
 */

export const PROMOTION_DIRECTORY = "changes/promotion";

export interface PromotionDraft {
  /** Where the page will land, relative to `knowledge/`. */
  destination: string;
  /** Where it is now, relative to the bundle root. */
  source: string;
}

export interface StagePromotionOptions {
  target: string;
  id: string;
  /** Nothing this work did changes what the project says, and why. */
  none?: string;
  now?: Date;
}

export interface StagePromotionResult {
  id: string;
  status: "pending" | "not-needed";
  drafts: string[];
  specPath: string;
}

export interface ApplyPromotionOptions {
  target: string;
  id: string;
  by: string;
  method: ApprovalMethod;
  note?: string;
  attested?: string;
  session?: string;
  now?: Date;
}

export interface ApplyPromotionResult {
  id: string;
  concepts: string[];
  archivePath: string;
  receipt: string;
}

/** Every page drafted in a bundle, in the order they will be written. */
export async function readPromotionDrafts(bundleRoot: string): Promise<PromotionDraft[]> {
  const root = join(bundleRoot, "promotion");
  const found: PromotionDraft[] = [];
  const walk = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const destination = relative(root, path).split(sep).join("/");
      found.push({ destination, source: `promotion/${destination}` });
    }
  };
  await walk(root);
  return found.sort((left, right) => left.destination.localeCompare(right.destination));
}

/**
 * Record which pages are waiting, from what is on disk rather than from a flag.
 *
 * The agent has already written them; asking it to also list them is asking the
 * same question twice and accepting whichever answer it gives. What the
 * maintainer is shown and what gets written are then the same set by
 * construction, and there is no way to approve a page that will not land or land
 * a page nobody approved.
 */
export async function stagePromotion(
  options: StagePromotionOptions,
): Promise<StagePromotionResult> {
  const knowledgeRoot = await requireKnowledgeRoot(options.target);
  const bundleRoot = join(knowledgeRoot, "changes/active", options.id);
  const specPath = join(bundleRoot, "change.md");
  const document = await readSpec(specPath, options.id);
  const at = (options.now ?? new Date()).toISOString();
  const none = (options.none ?? "").trim();
  const drafts = await readPromotionDrafts(bundleRoot);

  if (none && drafts.length > 0) {
    throw new Error(
      `${options.id} has ${drafts.length} page(s) drafted under its promotion/ directory, `
        + "so it does change what the project says. Remove them, or drop the reason and put "
        + "them to the maintainer.",
    );
  }
  if (!none && drafts.length === 0) {
    throw new Error(
      `${options.id} has no pages under its promotion/ directory. Draft the curated pages this `
        + "work changes, at the path each will occupy inside knowledge/, or record that none "
        + "are needed: wfctl work promotion "
        + `${options.id} --none "<why nothing the project says changed>"`,
    );
  }

  const accounting = decisionAccountingIssues(document);
  if (accounting.length > 0) {
    throw new Error(
      `Promotion is blocked until this work accounts for what it decided: ${
        accounting.join("; ")
      }`,
    );
  }

  document.metadata.knowledge_promotion = {
    ...(isRecord(document.metadata.knowledge_promotion)
      ? document.metadata.knowledge_promotion
      : {}),
    status: none ? "not-needed" : "pending",
    ...(none ? { reason: none } : { drafts: drafts.map((draft) => draft.destination) }),
    staged_at: at,
  };
  document.metadata.updated_at = at;
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
  return {
    id: options.id,
    status: none ? "not-needed" : "pending",
    drafts: drafts.map((draft) => draft.destination),
    specPath,
  };
}

/**
 * The maintainer's word, and the pages landing in the same act.
 *
 * Writing them is not a second step the agent might forget or a maintainer might
 * have to chase: approving is what writes them. If curated validation then
 * refuses the result, every file this call created is removed and the bundle
 * stays where it was, because a corpus half-taught is worse than one not taught.
 */
export async function applyPromotion(
  options: ApplyPromotionOptions,
): Promise<ApplyPromotionResult> {
  const knowledgeRoot = await requireKnowledgeRoot(options.target);
  const bundleRoot = await requirePromotionBundle(knowledgeRoot, options.id);
  const specPath = join(bundleRoot, "change.md");
  const document = await readSpec(specPath, options.id);

  const pending = promotionGateIssues(document);
  if (pending.length > 0) {
    throw new Error(`Promotion is blocked: ${pending.join("; ")}`);
  }
  const drafts = await readPromotionDrafts(bundleRoot);
  const recorded = stringArray(
    isRecord(document.metadata.knowledge_promotion)
      ? document.metadata.knowledge_promotion.drafts
      : undefined,
  );
  const onDisk = drafts.map((draft) => draft.destination);
  const changed = recorded.filter((path) => !onDisk.includes(path))
    .concat(onDisk.filter((path) => !recorded.includes(path)));
  if (changed.length > 0) {
    throw new Error(
      `The pages on disk are no longer the ones recorded for approval (${changed.join(", ")}). `
        + `Re-run wfctl work promotion ${options.id} and put the result to the maintainer again.`,
    );
  }

  const record = await recordApproval({
    knowledgeRoot,
    id: options.id,
    stage: "promotion",
    by: options.by,
    method: options.method,
    ...(options.note ? { note: options.note } : {}),
    ...(options.attested ? { attested: options.attested } : {}),
    ...(options.session ? { session: options.session } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const written: string[] = [];
  const concepts: string[] = [];
  try {
    for (const draft of drafts) {
      const destination = resolveInsideKnowledge(knowledgeRoot, draft.destination);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(bundleRoot, draft.source), destination);
      written.push(destination);
      concepts.push(`knowledge/${draft.destination}`);
    }
    const validation = await validateKnowledge(knowledgeRoot, concepts);
    if (!validation.valid) {
      throw new Error(
        `the pages do not pass curated validation: ${
          validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
        }`,
      );
    }
  } catch (error) {
    for (const path of written) {
      await rm(path, { force: true });
    }
    throw new Error(`Promotion was not applied and nothing was written: ${message(error)}`);
  }

  const review = isRecord(document.metadata.maintainer_review)
    ? document.metadata.maintainer_review
    : {};
  review.promotion = {
    status: "approved",
    by: record.by,
    at: record.at,
    method: record.method,
    receipt: record.receipt,
    ...(record.attested ? { attested: record.attested } : {}),
    ...(record.session ? { session: record.session } : {}),
    ...(record.note ? { notes: [record.note] } : {}),
  };
  document.metadata.maintainer_review = review;
  document.metadata.knowledge_promotion = {
    ...(isRecord(document.metadata.knowledge_promotion)
      ? document.metadata.knowledge_promotion
      : {}),
    status: "applied",
    concepts,
    promoted_at: record.at,
  };
  document.metadata.updated_at = record.at;
  // This call just edited the record, so its own accounting is stale by its own
  // hand. Left that way the archived bundle reads as changed-after-review, and a
  // change that fails its completion gate is not one a page may cite — so the
  // page this promotion just wrote would be invalid the moment it landed. The
  // checkpoint is written into the document rather than through the ordinary
  // update, which refuses a complete status outside closure and is right to.
  initializeDocumentCheckpoint(document, {
    status: "complete",
    stage: "complete",
    actor: record.by,
    currentState: `Promoted on the maintainer's word: ${concepts.length} page(s) written.`,
    lastCompleted: "The project now says what this work settled.",
    nextAction: "None — this bundle is closed and its knowledge is promoted.",
    blockers: [],
    now: new Date(record.at),
  });
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
  await reviewBundleFile(bundleRoot, "change.md", "reviewed", "", new Date(record.at));

  const archivePath = join(knowledgeRoot, "changes/archive", options.id);
  await mkdir(dirname(archivePath), { recursive: true });
  await rename(bundleRoot, archivePath);
  return { id: options.id, concepts, archivePath, receipt: record.receipt };
}

export interface PendingPromotion {
  id: string;
  document: WorkSpecDocument;
  /** Where each page will land, for deciding what it is stale against. */
  drafts: string[];
  /** What each page is called, for saying so to the maintainer. */
  titles: string[];
}

/** Every closed bundle whose pages nobody has approved yet. */
export async function pendingPromotions(knowledgeRoot: string): Promise<PendingPromotion[]> {
  const root = join(knowledgeRoot, PROMOTION_DIRECTORY);
  const found: PendingPromotion[] = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const bundleRoot = join(root, entry.name);
    try {
      const document = parseWorkSpec(await readFile(join(bundleRoot, "change.md"), "utf8"));
      const promotion = isRecord(document.metadata.knowledge_promotion)
        ? document.metadata.knowledge_promotion
        : {};
      found.push({
        id: entry.name,
        document,
        drafts: stringArray(promotion.drafts),
        titles: await draftTitles(bundleRoot),
      });
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
  return found;
}

/**
 * What each waiting page calls itself.
 *
 * A path is an address, and the rule the whole corpus is written to says an
 * address never reaches the maintainer. So the queue is named by the titles the
 * pages carry, which is also what they will be called once they land.
 */
async function draftTitles(bundleRoot: string): Promise<string[]> {
  const titles: string[] = [];
  for (const draft of await readPromotionDrafts(bundleRoot)) {
    try {
      titles.push(
        draftTitle(await readFile(join(bundleRoot, draft.source), "utf8")) || draft.destination,
      );
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
  return titles;
}

/**
 * What a curated page calls itself.
 *
 * Its frontmatter `title`, which is the name the corpus indexes it under and the
 * name a reader sees. The first heading in the body is a section of the page —
 * "Decision", "Behavior" — and reading that instead names every decision page in
 * the project identically.
 */
export function draftTitle(content: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  const declared = frontmatter && /^title:\s*(.+)$/m.exec(frontmatter[1]!);
  if (declared) {
    return declared[1]!.trim().replace(/^["']|["']$/g, "");
  }
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? "";
}

/**
 * The Area a curated path belongs to, or nothing when it belongs to none.
 *
 * Used to tell whether an unpromoted delivery and a framing about to be approved
 * touch the same part of the project. Area is the coarsest boundary the corpus
 * actually has, which is what makes it the right one: finer would let a stale
 * page slip past on a filename, coarser would hold every framing on every
 * outstanding promotion anywhere.
 */
export function areaOf(path: string): string {
  const match = /(?:^|\/)areas\/([^/]+)\//.exec(path.replace(/\\/g, "/"));
  return match?.[1] ?? "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

async function requireKnowledgeRoot(target: string): Promise<string> {
  return resolveKnowledgeRoot(target, await readConfig(target));
}

async function requirePromotionBundle(knowledgeRoot: string, id: string): Promise<string> {
  for (const location of [PROMOTION_DIRECTORY, "changes/active"]) {
    const candidate = join(knowledgeRoot, location, id);
    try {
      await readFile(join(candidate, "change.md"), "utf8");
      return candidate;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
  throw new Error(
    `No bundle named ${id} is waiting to be promoted. A closed bundle whose pages are already `
      + "in curated knowledge has been archived, and there is nothing left to approve.",
  );
}

async function readSpec(specPath: string, id: string): Promise<WorkSpecDocument> {
  try {
    return parseWorkSpec(await readFile(specPath, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`Work bundle not found: ${id}`);
    }
    throw error;
  }
}

function resolveInsideKnowledge(knowledgeRoot: string, destination: string): string {
  const normalized = destination.replace(/^\/+/, "").replace(/^knowledge\//, "");
  const absolute = resolve(knowledgeRoot, "knowledge", normalized);
  const boundary = `${resolve(knowledgeRoot, "knowledge")}${sep}`;
  if (!absolute.startsWith(boundary)) {
    throw new Error(`Promotion draft resolves outside curated knowledge: ${destination}`);
  }
  return absolute;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
