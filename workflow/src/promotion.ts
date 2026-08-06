import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isMissingFileError } from "./config.js";
import {
  compileTrajectories,
  type TrajectoryGraph,
  type TrajectoryRecord,
  type TrajectoryVision,
} from "./trajectory.js";
import { parseWorkSpec, serializeWorkSpec } from "./work-spec.js";

/**
 * Phase six: curated knowledge written from a trajectory.
 *
 * Two things this deliberately does not do.
 *
 * It does not finish the page. A trajectory holds what the subject does, how it
 * got there and where it is going; a curated concept also holds who it serves,
 * the words the domain uses for it, and an example — none of which any record in
 * this pipeline contains, because nobody ever wrote them down. Those sections
 * come out marked, and a marked draft fails validation until an author fills
 * them. Generating placeholder prose would produce a page that validates and
 * says nothing, which is worse than one that refuses to.
 *
 * And it does not delete. The pages a subject replaces are named by the
 * trajectory, checked for existence, and reported; removing them is a separate
 * deliberate act after the draft validates. A tool that quietly retires
 * knowledge is a tool nobody can run twice with confidence.
 *
 * What it does do, and used to refuse to, is write a subject whose direction the
 * maintainer has not declared. Refusing made the knowledge base a derivative of
 * their decision queue: a subject read in full from source did not exist in
 * curated knowledge until they said where it should go, so "what does this
 * project do" answered with a filtered subset and said nothing about the filter.
 * Direction is a decision and current behavior is an observation; making the
 * observation wait on the decision loses the observation for as long as the
 * decision is open, which can be forever. So a subject without a declared
 * direction gets the page its evidence supports and no more: what it does today,
 * read at the pin, with no accepted intent and no alignment — because there is
 * nothing yet to be aligned with. Declaring the direction later promotes again
 * over the same path and the page gains its second half.
 */

const AUTHOR_MARK = "<!-- AUTHOR: ";

/**
 * The sections this pipeline cannot fill, and therefore must never overwrite.
 *
 * A page is written twice by design: once when the subject is read, and again
 * when the maintainer declares where it should go. Between those two runs a
 * person writes the parts no record holds. Rewriting the file wholesale on the
 * second run destroys exactly that work, every time, on the path the design
 * calls normal — so the second run replaces what it generated and keeps what it
 * did not.
 *
 * `Engineering details` belongs here even though it carries no marker: it is
 * generated as a bare "Not applicable." because the section is validated as
 * links-only, and a comment inside it would be a second error saying nothing
 * new. Once an engineering page exists and someone links it, that link is
 * authored content under a generated default.
 */
const AUTHOR_SECTIONS = [
  "Who it serves",
  "Domain language",
  "Rules and outcomes",
  "Boundaries and exceptions",
  "Examples",
  "Engineering details",
] as const;

const ENGINEERING_DEFAULT = "Not applicable.";

export interface PromotionResult {
  trajectory: string;
  path: string;
  created: boolean;
  /**
   * Whether the maintainer has said where this subject should go. An undeclared
   * page is complete for what it claims and half of what the subject deserves;
   * the caller says so rather than letting a reader assume the page is finished.
   */
  direction: "declared" | "undeclared";
  /** Sections the trajectory cannot supply, left marked for an author. */
  awaitingAuthor: string[];
  /**
   * Sections carried over from the page that was already there because a person
   * had written them. Reported rather than silent: what they say was not
   * re-derived from the records this run read, so a reader deciding whether the
   * page is current needs to know which parts this run did not touch.
   */
  preserved: string[];
  /**
   * True when a preserved section cites a footnote and the source list changed
   * under it. Declaring a direction prepends the vision as source 1 and shifts
   * every pinned source down, so a citation written against the old numbering
   * now points at a different claim. Nothing renumbers it, because guessing
   * which claim an author meant is worse than saying the citation moved.
   */
  citationsMayHaveShifted: boolean;
  /** Observations dropped because curated knowledge may not cite untrusted input. */
  droppedRawSources: number;
  /** Pages this subject claims to replace, and whether each is on disk. */
  replaces: Array<{ path: string; present: boolean }>;
  /** Pages in the area that no trajectory claims. */
  unclaimed: string[];
}

export interface PromoteOptions {
  target: string;
  trajectory: string;
  force?: boolean;
  now?: Date;
}

export async function promoteTrajectory(options: PromoteOptions): Promise<PromotionResult> {
  const target = resolve(options.target);
  const compilation = await compileTrajectories(target);
  if (compilation.errors.length > 0) {
    throw new Error(
      `Cannot promote while ${compilation.errors.length} trajectory error(s) remain; run trajectory check`,
    );
  }
  const record = compilation.graph.trajectories.find((entry) => entry.id === options.trajectory);
  if (!record) {
    throw new Error(`No trajectory named ${options.trajectory}`);
  }
  const vision = compilation.graph.visions.find((entry) => entry.id === record.vision);

  const path = join("knowledge/areas", record.area, `${record.id.replace(/^traj-/, "")}.md`);
  const absolute = join(target, path);
  const existed = await exists(absolute);
  if (existed && !options.force) {
    throw new Error(`${path} already exists; pass --force to rewrite it`);
  }

  const at = (options.now ?? new Date()).toISOString();
  const { sources, dropped } = deriveSources(record, vision);
  if (sources.length === 0) {
    // Every citable observation was raw, and no declared vision stands in as the
    // one thing a page may cite an actor for. A page here would assert the
    // subject's behavior on nothing a reader could check.
    throw new Error(
      `${record.subject} has no direction declared and nothing citable to rest on: all `
        + `${dropped} observation(s) come from untrusted input, which curated knowledge may not `
        + "cite. Read the subject at a pinned revision, or declare where it should go.",
    );
  }
  const generated = renderBody(record, compilation.graph, vision, sources);
  const { body, preserved, citationsMayHaveShifted } = existed
    ? keepAuthoredSections(await readFile(absolute, "utf8"), generated)
    : { body: generated, preserved: [], citationsMayHaveShifted: false };
  const document = {
    metadata: {
      okf_version: "0.2",
      id: `${record.area}.capabilities.${record.id.replace(/^traj-/, "")}`,
      type: "capability",
      title: record.subject,
      status: "draft",
      view: "product",
      purpose: "current-behavior",
      audience: ["stakeholder", "maintainer", "domain-expert"],
      area: record.area,
      generated: {
        by: "wfctl/trajectory-promotion",
        at,
        method: "trajectory-promotion",
      },
      // Accepted intent is the maintainer's word, and product meaning is a
      // claim about what the project means to offer. An undeclared subject
      // carries neither: what it holds is read from the pin, so implementation
      // is the only authority its evidence supports. That also keeps the page
      // out of the product-bearing branch of validation, where an unstated
      // intent would be an error rather than a fact.
      authority: vision
        ? ["product-meaning", "intent", "implementation"]
        : ["implementation"],
      sources,
      realization: vision
        ? {
          intent: "accepted",
          delivery: deliveryFrom(record),
          alignment: record.gaps.length > 0 ? "drifted" : "aligned",
          vision: vision.id,
          assessed_at: at,
        }
        : {
          intent: "not-applicable",
          delivery: deliveryFrom(record),
          // Drift is distance from an intent. With none declared there is no
          // distance to report, and calling it "aligned" would invent agreement
          // with something nobody has stated.
          alignment: "not-applicable",
          assessed_at: at,
        },
      "x-wf": {
        relations: [{
          kind: "supports",
          target: `knowledge/areas/${record.area}/index.md`,
          context: vision
            ? `What ${record.subject} is, and where it is going.`
            : `What ${record.subject} is, read at the pinned revision.`,
        }],
      },
    },
    body,
  };

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, serializeWorkSpec(document), "utf8");

  return {
    trajectory: record.id,
    path,
    created: !existed,
    direction: vision ? "declared" : "undeclared",
    awaitingAuthor: [
      ...body.split("\n")
        .filter((line) => line.startsWith(AUTHOR_MARK))
        .map((line) => line.slice(AUTHOR_MARK.length).replace(/ -->$/, "")),
      // Only while it still says the generated default. Once someone links an
      // engineering concept there, asking again would be asking for work done.
      ...(preserved.includes("Engineering details")
        ? []
        : ["Engineering details says not-applicable; link the engineering concepts if any exist"]),
    ],
    preserved,
    citationsMayHaveShifted,
    droppedRawSources: dropped,
    replaces: await replacementState(target, record),
    unclaimed: await unclaimedPages(target, record.area, compilation.graph, new Set([path])),
  };
}

/**
 * Replace what this pipeline generated and keep what a person wrote.
 *
 * Section order, and everything outside the author sections, comes from the
 * fresh render — that is the point of running again. Only a section this
 * pipeline cannot fill, and that no longer holds its own placeholder, survives
 * from the previous page.
 */
function keepAuthoredSections(
  previous: string,
  generated: string,
): { body: string; preserved: string[]; citationsMayHaveShifted: boolean } {
  const before = splitPage(parseWorkSpec(previous).body);
  const after = splitPage(generated);
  const preserved: string[] = [];

  for (const heading of AUTHOR_SECTIONS) {
    const old = before.sections.get(heading);
    if (old === undefined || !after.sections.has(heading) || isPlaceholder(heading, old)) {
      continue;
    }
    after.sections.set(heading, old);
    preserved.push(heading);
  }

  const shifted = preserved.some((heading) => /\[\^\d+\]/.test(after.sections.get(heading) ?? ""))
    && before.footnotes !== after.footnotes;

  const lines = [after.head];
  for (const heading of after.order) {
    lines.push(`## ${heading}`, "", after.sections.get(heading) ?? "");
  }
  if (after.footnotes) {
    lines.push(after.footnotes);
  }
  return {
    body: `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`,
    preserved,
    citationsMayHaveShifted: shifted,
  };
}

/** A section still saying what the generator put there, rather than an answer. */
function isPlaceholder(heading: string, content: string): boolean {
  if (content.includes(AUTHOR_MARK)) {
    return true;
  }
  return heading === "Engineering details" && content.trim() === ENGINEERING_DEFAULT;
}

interface PageParts {
  /** The title and anything above the first section. */
  head: string;
  sections: Map<string, string>;
  order: string[];
  /** The `[^n]:` block, which trails the last section rather than belonging to it. */
  footnotes: string;
}

function splitPage(body: string): PageParts {
  const sections = new Map<string, string>();
  const order: string[] = [];
  const head: string[] = [];
  const footnotes: string[] = [];
  let current: string | undefined;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current !== undefined) {
      sections.set(current, buffer.join("\n").trim());
    }
    buffer = [];
  };

  for (const line of body.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      flush();
      current = heading[1]!.trim();
      order.push(current);
      continue;
    }
    // Footnote definitions sit after the final section and belong to the page,
    // not to whichever section happens to precede them.
    if (/^\[\^[^\]]+\]:/.test(line)) {
      footnotes.push(line);
      continue;
    }
    if (current === undefined) {
      head.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();

  return {
    head: head.join("\n").trim(),
    sections,
    order,
    footnotes: footnotes.join("\n").trim(),
  };
}

/**
 * Curated knowledge may never cite untrusted input, so a raw observation cannot
 * become a source however load bearing it was. The count is returned rather than
 * swallowed: a subject established mostly from raw is a subject whose page rests
 * on less than the trajectory did, and whoever promotes it should know by how
 * much.
 */
function deriveSources(
  record: TrajectoryRecord,
  vision: TrajectoryVision | undefined,
): { sources: Array<Record<string, unknown>>; dropped: number } {
  const sources: Array<Record<string, unknown>> = vision
    ? [{
      id: "1",
      kind: "trajectory-vision",
      author: vision.declaredBy,
      resource: `trajectory-vision:${vision.id}`,
      claim: "Where this subject is going, as the maintainer declared it.",
    }]
    : [];
  let dropped = 0;
  let next = sources.length + 1;
  const seen = new Set<string>();
  for (const observation of record.observations) {
    if (observation.source.kind === "raw") {
      dropped += 1;
      continue;
    }
    if (observation.source.kind !== "source-code" || seen.has(observation.source.resource)) {
      continue;
    }
    seen.add(observation.source.resource);
    sources.push({
      id: String(next),
      kind: "source-code",
      resource: observation.source.resource,
      claim: observation.says,
    });
    next += 1;
  }
  return { sources, dropped };
}

function deliveryFrom(record: TrajectoryRecord): string {
  if (record.gaps.length === 0) {
    return "implemented";
  }
  return record.gaps.every((gap) => gap.kind === "hole") ? "implemented" : "partial";
}

function renderBody(
  record: TrajectoryRecord,
  graph: TrajectoryGraph,
  vision: TrajectoryVision | undefined,
  sources: Array<Record<string, unknown>>,
): string {
  const children = graph.edges
    .filter((edge) => edge.kind === "part-of" && edge.target === record.id)
    .map((edge) => graph.trajectories.find((entry) => entry.id === edge.source))
    .filter((entry): entry is TrajectoryRecord => Boolean(entry));
  const closed = record.findings.filter((finding) => finding.period.to);
  const limits = [...new Set(record.findings.flatMap((finding) => finding.scopeLimits))];

  const lines: string[] = [];
  lines.push(`# ${record.subject}`, "");
  lines.push("## What this provides", "", record.now.state, "");
  lines.push("## Who it serves", "");
  lines.push(author("name the audiences; no record in this pipeline carries them"), "");
  lines.push("## Domain language", "");
  lines.push(author("define the terms this subject owns, as the product uses them"), "");
  lines.push("## Current behavior", "", record.now.state, "");
  for (const child of children) {
    lines.push(`**${child.subject}.** ${child.now.state}`, "");
  }
  const pinned = sources.filter((source) => source.kind === "source-code");
  if (pinned.length > 0) {
    lines.push("Established at the pinned revision:", "");
    for (const source of pinned) {
      lines.push(`- ${String(source.claim)}[^${String(source.id)}]`);
    }
    lines.push("");
  }
  lines.push("## Where this is going", "");
  if (vision) {
    lines.push(`${vision.statement}[^1]`, "");
    if (record.gaps.length > 0) {
      lines.push("Outstanding against it:", "");
      for (const gap of record.gaps) {
        lines.push(`- ${gap.statement}`);
      }
      lines.push("");
    }
  } else {
    // Stated on the page rather than left out, so a reader meets the absence
    // instead of mistaking a page that stops early for a subject that is done.
    lines.push(
      "No direction has been declared for this subject, so nothing here states where it "
        + "should go. What this page holds is what the source shows at the pinned revision.",
      "",
    );
    if (record.gaps.length > 0) {
      lines.push("Recorded as outstanding on the subject itself:", "");
      for (const gap of record.gaps) {
        lines.push(`- ${gap.statement}`);
      }
      lines.push("");
    }
  }
  lines.push("## Rules and outcomes", "");
  lines.push(author("state the rules a reader can rely on, or link them"), "");
  lines.push("## Boundaries and exceptions", "");
  if (limits.length > 0) {
    lines.push("Established with these limits:", "");
    for (const limit of limits) {
      lines.push(`- ${limit}`);
    }
    lines.push("");
  }
  lines.push(author("state what this subject does not cover"), "");
  lines.push("## Delivery", "");
  if (vision) {
    lines.push(
      record.gaps.length === 0
        ? "Intent accepted and delivered."
        : `Intent accepted, delivery partial. ${record.gaps.length} outstanding.`,
      "",
    );
  } else {
    lines.push(
      record.gaps.length === 0
        ? "No intent is accepted for this subject. What is described is what the pinned "
          + "revision delivers."
        : `No intent is accepted for this subject. What is described is what the pinned `
          + `revision delivers, and ${record.gaps.length} item(s) stand open on it.`,
      "",
    );
  }
  lines.push("**Unproven:** read from the pinned revision; nothing was built or run.", "");
  lines.push("## Examples", "");
  lines.push(author("one concrete example a person would recognise"), "");
  lines.push("## Evolution", "");
  if (closed.length > 0) {
    for (const finding of closed) {
      lines.push(`- ${finding.situation}${finding.cause.note ? ` ${finding.cause.note}` : ""}`);
    }
  } else {
    lines.push("No closed change is recorded for this subject yet.");
  }
  lines.push("");
  lines.push("## Related knowledge", "", `- [${areaTitle(record.area)}](index.md)`, "");
  // No marker here: the section is validated as links-only, so a comment inside
  // it is a second error saying nothing the first does not already say.
  lines.push("## Engineering details", "", "Not applicable.", "");
  for (const source of sources) {
    lines.push(`[^${String(source.id)}]: ${String(source.claim)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function author(instruction: string): string {
  return `${AUTHOR_MARK}${instruction} -->`;
}

function areaTitle(area: string): string {
  return area.charAt(0).toUpperCase() + area.slice(1);
}

async function replacementState(
  target: string,
  record: TrajectoryRecord,
): Promise<Array<{ path: string; present: boolean }>> {
  const state = [];
  for (const path of record.replaces) {
    state.push({ path, present: await exists(join(target, path)) });
  }
  return state;
}

async function unclaimedPages(
  target: string,
  area: string,
  graph: TrajectoryGraph,
  written: Set<string>,
): Promise<string[]> {
  const root = join(target, "knowledge/areas", area);
  const claimed = new Set(
    graph.trajectories
      .filter((entry) => entry.area === area)
      .flatMap((entry) => entry.replaces),
  );
  const found: string[] = [];
  const walk = async (directory: string, prefix: string): Promise<void> => {
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
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(join(directory, entry.name), relative);
      } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
        // A page this run just wrote is not an orphan of the old model.
        if (!claimed.has(relative) && !written.has(relative)) {
          found.push(relative);
        }
      }
    }
  };
  await walk(root, `knowledge/areas/${area}`);
  return found.sort();
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
