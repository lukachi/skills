import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { findDistributionRoot } from "./assets.js";
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
  const target = resolve(targetInput);
  const path = join(target, "changes/active", id, "change.md");
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
  };
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
  return gate.stage === "completion" ? renderCompletion(gate) : renderFraming(gate);
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
