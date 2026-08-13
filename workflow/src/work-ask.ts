import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { findDistributionRoot } from "./assets.js";
import { readConfig, resolveKnowledgeRoot } from "./config.js";
import { draftTitle, readPromotionDrafts } from "./work-promotion.js";
import { isRecord, parseWorkSpec, type MaintainerReviewStage } from "./work-spec.js";

/**
 * The framing gate, rendered for the person who has to answer it.
 *
 * Asked to approve a framing, a maintainer asked back what approving one meant.
 * That was the right question and the tool had no answer: the only surface was a
 * command with a bundle id, a stage name and their own identity in it, and
 * behind it a change record written for an agent — a hundred lines of scope
 * blocks, discovery ledgers, promotion status and verification receipts. The
 * agent ended up explaining it in prose, correctly, four times.
 *
 * A framing is four things and nothing else: what gets done, what deliberately
 * does not, what will make it finished, and in what order. Everything else in the
 * record is bookkeeping the approval does not touch, and putting it in front of
 * the maintainer is how a product decision turns into paperwork.
 *
 * Generated from the record, so it cannot contain a schema token or a path: it
 * only ever reads fields whose contents were written in product language, and
 * the id it does print is the one thing the maintainer may need to say back.
 */

export interface WorkGate {
  id: string;
  title: string;
  stage: MaintainerReviewStage;
  /** Already approved, in which case there is nothing to ask. */
  approved: boolean;
  order: string;
  /** Framing: the four things approving one fixes. */
  doing: string[];
  notDoing: string[];
  doneWhen: string[];
  /** Completion: the four things accepting one fixes. */
  delivered: string[];
  undelivered: string[];
  carried: string[];
  learned: string[];
  /** Completion settled nothing durable, and said why. */
  learnedNothingBecause: string;
  /** Promotion: the pages waiting, and what each of them will claim. */
  pages: PromotionPage[];
}

export interface PromotionPage {
  /** What the page is called, in its own words. */
  title: string;
  /** What it will say, taken from the page itself. */
  says: string[];
  /** Whether a page already stands where this one will land. */
  replaces: boolean;
}

export interface ReadWorkGateOptions {
  stage?: MaintainerReviewStage;
  distributionRoot?: string;
}

export async function readWorkGate(
  targetInput: string,
  id: string,
  options: ReadWorkGateOptions = {},
): Promise<WorkGate> {
  const stage = options.stage ?? "framing";
  // From the knowledge repository or from any leaf bound to it. Delivery happens
  // in a source checkout, so requiring the centre meant an agent working in a
  // leaf could not show the maintainer the decision it was asking them for —
  // and the refusal it got instead was a missing-file path from inside the tool.
  const target = await resolveCentre(resolve(targetInput));
  // A promotion is asked about a bundle that has already closed, so it is read
  // from wherever the bundle now is rather than from the one place open work
  // lives. Closure is what moved it, and the question survives the move.
  const bundleRoot = await locateBundle(target, id);
  const path = join(bundleRoot, "change.md");
  const document = parseWorkSpec(await readFile(path, "utf8"));
  const metadata = document.metadata;
  const review = isRecord(metadata.maintainer_review)
    ? metadata.maintainer_review[stage]
    : undefined;
  const boilerplate = await templateLines(options.distributionRoot);

  const promotion = isRecord(metadata.knowledge_promotion) ? metadata.knowledge_promotion : {};
  const verification = isRecord(metadata.verification) ? metadata.verification : {};

  return {
    id,
    title: text(metadata.title) || id,
    stage,
    approved: isRecord(review) && text(review.status) === "approved",
    order: section(document.body, "Summary", boilerplate).join(" ").trim(),
    doing: section(document.body, "In", boilerplate),
    notDoing: section(document.body, "Out", boilerplate),
    doneWhen: acceptance(metadata.acceptance),
    delivered: acceptance(metadata.acceptance, "verified"),
    undelivered: acceptance(metadata.acceptance, "pending"),
    carried: [
      ...lines(verification.unresolved),
      ...section(document.body, "Uncertainty and fog", boilerplate),
    ],
    learned: decisions(promotion.decisions),
    learnedNothingBecause: text(promotion.decisions_none),
    pages: stage === "promotion" ? await readPages(target, bundleRoot, boilerplate) : [],
  };
}

/**
 * The pages themselves, because the pages are the decision.
 *
 * Nothing stands in for them: a list of paths asks the maintainer to go and open
 * files, and a summary of a page written for readers is a second author between
 * them and the text they are approving. What is shown is what will land, and the
 * only editing is dropping the machine-facing frontmatter that is not addressed
 * to them.
 */
async function readPages(
  target: string,
  bundleRoot: string,
  boilerplate: Set<string>,
): Promise<PromotionPage[]> {
  const pages: PromotionPage[] = [];
  for (const draft of await readPromotionDrafts(bundleRoot)) {
    const content = await readFile(join(bundleRoot, draft.source), "utf8");
    const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    pages.push({
      title: draftTitle(content) || draft.destination,
      says: prose(body, boilerplate),
      replaces: await exists(join(target, "knowledge", draft.destination)),
    });
  }
  return pages;
}

/** A page's own sentences, its headings and its machine-facing rows removed. */
function prose(body: string, boilerplate: Set<string>): string[] {
  const collected: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.replace(/^\s*[-*]\s+/, "").trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("|")) {
      continue;
    }
    if (/^\{\{.*\}\}$/.test(trimmed) || boilerplate.has(trimmed)) {
      continue;
    }
    collected.push(trimmed);
  }
  return collected;
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * The knowledge repository, whether this is one or is bound to one.
 *
 * Rendering a packet reads a bundle and nothing else, so a directory that holds
 * one but carries no installation is answered rather than refused — that is what
 * a test fixture and a detached inspection both look like.
 */
async function resolveCentre(target: string): Promise<string> {
  try {
    const config = await readConfig(target);
    return config.profile === "knowledge" ? target : resolveKnowledgeRoot(target, config);
  } catch {
    return target;
  }
}

async function locateBundle(target: string, id: string): Promise<string> {
  for (const location of ["changes/active", "changes/promotion", "changes/archive"]) {
    const candidate = join(target, location, id);
    try {
      await readFile(join(candidate, "change.md"), "utf8");
      return candidate;
    } catch {
      continue;
    }
  }
  return join(target, "changes/active", id);
}

/**
 * What the project now says that it did not, in the maintainer's own words.
 *
 * Their answer is what the decision record already holds; the concept it was
 * promoted into is a path, and a path is something to look up rather than
 * something to read. So the page is where the answer lives and never what gets
 * shown for it.
 */
function decisions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((entry) => text(entry.disposition) !== "not-durable")
    .map((entry) => text(entry.what))
    .filter(Boolean);
}

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      return isRecord(entry) ? text(entry.note) || text(entry.what) || text(entry.summary) : "";
    })
    .filter(Boolean);
}

/**
 * Every line the shipped template writes for the author to replace.
 *
 * A section still holding those words has not been written, and echoing them
 * back reads as content: the first render of an untouched bundle offered
 * "Define included behavior" as the scope. Matching against the template is
 * language-independent and guesses nothing — a line identical to what shipped is
 * a line nobody authored — where a list of known instruction phrases would have
 * to be extended for every wording and every language anyone writes in.
 */
async function templateLines(distributionRoot?: string): Promise<Set<string>> {
  try {
    const root = distributionRoot ?? await findDistributionRoot();
    const template = await readFile(
      join(root, "skills/manage-project-work/assets/work-spec.md"),
      "utf8",
    );
    return new Set(
      template.split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        .filter(Boolean),
    );
  } catch {
    // Without the template every line reads as authored, which overstates the
    // framing rather than hiding it. That is the safer direction to fail in.
    return new Set();
  }
}

export function renderWorkGate(gate: WorkGate): string {
  if (gate.stage === "promotion") {
    return renderPromotion(gate);
  }
  return gate.stage === "completion" ? renderCompletion(gate) : renderFraming(gate);
}

/**
 * The promotion gate, which is now the one a maintainer is asked every time.
 *
 * It replaced a completion approval that asked whether the work was done — a
 * question the receipts had already answered, and one that cost an unattended
 * night its second half because nobody was awake to say yes. This asks the
 * question nothing in the repository can answer: whether this is what the
 * project should now say about itself.
 *
 * It is also the only decision here that compounds. An approval receipt is read
 * by an auditor, once, if ever. A page is read by every session that touches this
 * part of the project, and it is what the next framing will be aligned against.
 */
function renderPromotion(gate: WorkGate): string {
  const lines: string[] = [];
  lines.push(`# ${gate.title}`, "");
  if (gate.approved) {
    lines.push("These pages are already promoted. Nothing here is waiting on you.", "");
  }

  lines.push("## What this work settled", "");
  if (gate.learned.length > 0) {
    lines.push(...gate.learned.map((entry) => `- ${entry}`));
  } else if (gate.learnedNothingBecause) {
    lines.push(gate.learnedNothingBecause);
  } else {
    lines.push("The record does not account for what this work decided.");
  }

  lines.push("", "## What the project will say");
  if (gate.pages.length === 0) {
    lines.push(
      "",
      "No page is waiting. Nothing this work did changes what the project says about itself, "
        + "or nobody has written the pages yet.",
    );
  }
  for (const page of gate.pages) {
    lines.push("", `### ${page.title}`, "");
    lines.push(
      page.replaces
        ? "This replaces what the project says today."
        : "The project has said nothing about this until now.",
      "",
    );
    lines.push(...bullets(page.says, "The page is empty."));
  }

  lines.push("");
  lines.push(
    "Approving this writes these pages into the project's own knowledge. From then on they",
    "are what the project says, what a new session reads first, and what the next piece of",
    "work is checked against. Declining changes nothing that was built — the work is done",
    "and closed either way. What is being decided is whether the project has learned it.",
    "",
    "Say so if a page is wrong, and it gets rewritten rather than argued for.",
    "",
  );
  return lines.join("\n");
}

/**
 * The completion gate, rendered for the person who has to accept it.
 *
 * The skill asked for acceptance results, engineering findings, checks,
 * deviations, risks and the knowledge delta in one packet, and got what it asked
 * for: six sections, a table apiece, and a decision somewhere inside. Measured
 * over four hundred of these, sixty-three per cent carried a table and twelve
 * per cent ended in a question.
 *
 * Accepting a completion fixes four things, which is what this prints. Every
 * other field in the record is the evidence behind them, and it stays in the
 * record where an audit can reach it. Generated for the same reason the framing
 * is: a renderer that never reads a path cannot print one, and the decision the
 * maintainer is being asked for was never about paths.
 */
function renderCompletion(gate: WorkGate): string {
  const lines: string[] = [];
  lines.push(`# ${gate.title}`, "");
  if (gate.approved) {
    lines.push("This work is already accepted. Nothing here is waiting on you.", "");
  }
  if (gate.order) {
    lines.push(gate.order, "");
  }

  lines.push("## What it does now", "");
  lines.push(
    ...bullets(
      gate.delivered,
      "Nothing is recorded as verified. Accepting this accepts work whose own record "
        + "does not yet say it was checked.",
    ),
  );

  lines.push("", "## What it still does not do", "");
  lines.push(
    ...bullets(
      gate.undelivered,
      "Everything that was asked for is recorded as verified.",
    ),
  );

  lines.push("", "## What you take on by closing it", "");
  lines.push(
    ...bullets(
      gate.carried,
      "The record names no unresolved risk. That is a claim about this work, not a "
        + "guarantee about the product.",
    ),
  );

  lines.push("", "## What the project now says that it did not", "");
  if (gate.learned.length > 0) {
    lines.push(...gate.learned.map((entry) => `- ${entry}`));
  } else if (gate.learnedNothingBecause) {
    lines.push(gate.learnedNothingBecause);
  } else {
    lines.push(
      "The record does not account for what this work decided. Closing it puts any "
        + "answer you gave into an archive rather than onto a page.",
    );
  }

  lines.push("");
  lines.push(
    "Accepting this closes the work: the record becomes history, its issues stop being",
    "claimable, and what is listed above becomes what the project claims. Declining",
    "keeps it open — nothing is undone by saying no.",
    "",
    "This is drafted from your own answers and the record's own results. The question",
    "is whether it is faithful, not whether each line is news.",
    "",
  );
  return lines.join("\n");
}

function renderFraming(gate: WorkGate): string {
  const lines: string[] = [];
  lines.push(`# ${gate.title}`, "");
  if (gate.approved) {
    lines.push(`This framing is already approved. Nothing here is waiting on you.`, "");
  }
  if (gate.order) {
    lines.push(gate.order, "");
  }
  lines.push("## What this does", "");
  lines.push(...bullets(gate.doing, "The record does not say what is in scope."));
  lines.push("", "## What this deliberately does not do", "");
  lines.push(
    ...bullets(
      gate.notDoing,
      "The record excludes nothing. A framing that excludes nothing has not been bounded, "
        + "and approving it approves whatever the work turns out to touch.",
    ),
  );
  lines.push("", "## What will make it finished", "");
  lines.push(
    ...bullets(
      gate.doneWhen,
      "The record sets no acceptance criteria, so there is no stated way to tell when this "
        + "is done.",
    ),
  );
  lines.push("");
  lines.push(
    "Approving this fixes the boundary: this gets touched, that does not, and here is how",
    "we will know it is finished. It is not approval of an implementation — there is none",
    "yet — and not agreement with how any of it is worded.",
    "",
    "Now is when changing the scope is cheap. After the work is cut into tasks it is not.",
    "",
  );
  return lines.join("\n");
}

function bullets(items: string[], whenEmpty: string): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [whenEmpty];
}

function acceptance(value: unknown, status?: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((entry) => status === undefined || text(entry.status) === status)
    .map((entry) => text(entry.criterion))
    .filter(Boolean);
}

/**
 * One heading's own paragraphs and bullets, at any depth, stopping at the next
 * heading of the same depth or shallower. Nested headings under it belong to it.
 */
function section(body: string, heading: string, boilerplate: Set<string>): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    new RegExp(`^#{1,6}\\s+${escape(heading)}\\s*$`, "i").test(line)
  );
  if (start < 0) {
    return [];
  }
  const depth = (lines[start]!.match(/^#+/) ?? ["#"])[0].length;
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const level = line.match(/^(#{1,6})\s/);
    if (level && level[1]!.length <= depth) {
      break;
    }
    const trimmed = line.replace(/^\s*[-*]\s+/, "").trim();
    if (!trimmed || trimmed.startsWith("#") || /^\{\{.*\}\}$/.test(trimmed)) {
      continue;
    }
    // Unchanged from the shipped template, so nobody wrote it.
    if (boilerplate.has(trimmed)) {
      continue;
    }
    collected.push(trimmed);
  }
  return collected;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
