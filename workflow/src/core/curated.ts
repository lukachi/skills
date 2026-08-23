import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * What a curated page may say, and what it may cite.
 *
 * The curation guidance tells the agent that structural validation refuses the
 * failures a check can see and that a content hash seals the two-axis review.
 * Neither existed, so both were prose — the page was told it had been checked
 * by something that was not there.
 */
export const KNOWLEDGE_DIR = "knowledge";

/**
 * Paths that may never appear in a curated page.
 *
 * Raw material is a clue even when it turns out to be right. A page that cites
 * it has borrowed authority from something that has none, and the borrowing is
 * invisible once the sentence reads well.
 */
const UNTRUSTED = ["reconstruction/raw/", "reconstruction/active/", "intake/", "raw/"];

export interface PageIssue {
  path: string;
  problem: string;
  remedy: string;
}

/**
 * The content hash both semantic reviews bind to.
 *
 * Frontmatter and body, never location — a page drafted under a record's
 * `promotion/` directory is copied byte for byte into the corpus, so a seal
 * taken on the draft still matches once it lands. Hashing the path would
 * invalidate every review at the moment of promotion, which is when nothing has
 * changed.
 */
export function contentHash(body: string): string {
  return createHash("sha256").update(body.trim()).digest("hex");
}

/**
 * Read the frontmatter the way the shipped templates write it.
 *
 * An earlier version only understood inline values, so both templates failed
 * the validator that ships beside them — an agent following the guidance to
 * "use the template" produced a page the tool rejected. Block sequences count:
 * a key whose value is a list of `- ` lines is declared.
 */
function frontmatter(body: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(body);
  if (!match) return {};

  const fields: Record<string, string> = {};
  const lines = (match[1] ?? "").split("\n");

  for (const [index, raw] of lines.entries()) {
    const pair = /^([a-z_-]+):\s*(.*)$/.exec(raw);
    if (!pair?.[1]) continue;

    const inline = (pair[2] ?? "").replace(/^["']|["']$/g, "").trim();
    if (inline) {
      fields[pair[1]] = inline;
      continue;
    }

    // A block sequence or mapping beneath the key still declares it.
    const following = lines[index + 1] ?? "";
    fields[pair[1]] = /^\s+\S/.test(following) ? following.trim().replace(/^-\s*/, "") : "";
  }
  return fields;
}

/**
 * Structural checks only.
 *
 * None of this establishes that a page is true, and saying so matters: a green
 * structural run reads like a verdict, and the two things it cannot see —
 * whether the claim holds and whether a reader can act on it — are the two the
 * semantic gate exists for.
 */
export function inspectPage(path: string, body: string): PageIssue[] {
  const issues: PageIssue[] = [];
  const fields = frontmatter(body);

  for (const required of ["view", "purpose", "audience"]) {
    if (!fields[required]) {
      issues.push({
        path,
        problem: `no ${required} declared`,
        remedy: `Add ${required}: to the frontmatter`,
      });
    }
  }

  const view = fields.view;
  if (view && view !== "product" && view !== "engineering") {
    issues.push({
      path,
      problem: `view is ${view}; the roads are product and engineering`,
      remedy: "Set view: product or view: engineering",
    });
  }

  const cited = UNTRUSTED.find((untrusted) => body.includes(untrusted));
  if (cited) {
    {
      issues.push({
        path,
        problem: `cites ${cited}, which carries no authority`,
        remedy:
          "Cite the evidence itself — a pinned source location, a promoted decision, " +
          "or the maintainer's own answer",
      });
    }
  }

  /**
   * A product page explaining implementation has stopped being the product
   * road. This is the one abstraction failure a check can see: the rest — an
   * exception dropped to make a sentence read well — is the semantic gate's.
   */
  if (view === "product") {
    if (/```[a-z]*\n/.test(body)) {
      issues.push({
        path,
        problem: "carries a code block",
        remedy: "Move it to the engineering page and link that",
      });
    }
    if (/\b(src|lib|packages)\/[\w./-]+\.[a-z]{2,4}\b/.test(body)) {
      issues.push({
        path,
        problem: "names a source path",
        remedy: "Move it to the engineering page and link that",
      });
    }
  }

  if (!/^#\s+\S/m.test(body.replace(/^---[\s\S]*?---/, ""))) {
    issues.push({ path, problem: "has no heading", remedy: "Give the page a title" });
  }

  const stable = fields.status === "stable";
  if (stable && !fields.content_hash) {
    issues.push({
      path,
      problem: "is stable with no sealed content hash",
      remedy: "Seal the review against this page's hash, or set status: draft",
    });
  }
  if (stable && fields.content_hash && fields.content_hash !== contentHash(stripSeal(body))) {
    issues.push({
      path,
      problem: "changed after its review was sealed",
      remedy: "Review it again and reseal, or set status: draft",
    });
  }

  return issues;
}

/**
 * The hash covers the page without its own seal line.
 *
 * Otherwise sealing a page changes the thing the seal describes, and no page
 * could ever match its own hash. The line is removed with its newline and
 * nothing else is touched — an earlier version also collapsed blank runs, which
 * made the same content hash differently before and after sealing.
 */
export function stripSeal(body: string): string {
  return body.replace(/^content_hash:.*\n/m, "");
}

export async function collectPages(root: string): Promise<string[]> {
  const base = resolve(root, KNOWLEDGE_DIR);
  try {
    const entries = await readdir(base, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => relative(base, join(entry.parentPath ?? base, entry.name)))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Links between pages, and pages nothing links to.
 *
 * A page checked alone can be perfectly formed and unreachable, and a reader
 * who cannot navigate to it is a reader for whom it does not exist. The model
 * says Area indexes link their capabilities and engineering links established
 * product meaning, so both a dead link and an orphan are real failures rather
 * than tidiness.
 *
 * The entry point is never an orphan: it is where a reader starts.
 */
export async function inspectLinks(root: string): Promise<PageIssue[]> {
  const pages = await collectPages(root);
  if (pages.length === 0) return [];

  const known = new Set(pages);
  const linkedTo = new Set<string>();
  const issues: PageIssue[] = [];

  for (const page of pages) {
    const body = await readFile(resolve(root, KNOWLEDGE_DIR, page), "utf8").catch(() => "");
    for (const match of body.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const href = match[1] ?? "";
      if (/^[a-z]+:\/\//.test(href)) continue;
      const target = relative(
        resolve(root, KNOWLEDGE_DIR),
        resolve(root, KNOWLEDGE_DIR, page, "..", href),
      );
      if (!known.has(target)) {
        issues.push({
          path: page,
          problem: `links to ${href}, which is not a curated page`,
          remedy: "Repair the link, or write the page it expects",
        });
        continue;
      }
      linkedTo.add(target);
    }
  }

  for (const page of pages) {
    if (page === "index.md" || linkedTo.has(page)) continue;
    issues.push({
      path: page,
      problem: "nothing links to it",
      remedy: "Link it from its Area index, or from the page that owns the subject",
    });
  }

  return issues;
}

/**
 * Accept the path forms the tool itself prints.
 *
 * `--page` took a knowledge-relative path while every path the CLI prints is
 * either absolute or repository-relative, so following the tool's own output
 * produced "cannot be read → check the path".
 */
export function normalizePage(root: string, page: string): string {
  const base = resolve(root, KNOWLEDGE_DIR);
  const absolute = resolve(root, page);
  const inside = relative(base, absolute);
  if (!inside.startsWith("..")) return inside;
  const fromRoot = relative(base, resolve(base, page));
  return fromRoot.startsWith("..") ? page : fromRoot;
}

export async function validateCurated(root: string, only?: string): Promise<PageIssue[]> {
  const pages = only ? [normalizePage(root, only)] : await collectPages(root);
  const issues: PageIssue[] = [];
  for (const page of pages) {
    const body = await readFile(resolve(root, KNOWLEDGE_DIR, page), "utf8").catch(() => undefined);
    if (body === undefined) {
      issues.push({ path: page, problem: "cannot be read", remedy: "Check the path" });
      continue;
    }
    issues.push(...inspectPage(page, body));
  }
  if (!only) issues.push(...(await inspectLinks(root)));
  return issues;
}

/**
 * The gate promotion runs before anything is copied into the corpus.
 *
 * A refusal here writes nothing and leaves the pages where they are, so the
 * record stays in the queue and correctable rather than half-promoted.
 */
export function assertPromotable(issues: PageIssue[]): void {
  if (issues.length === 0) return;
  throw new GateRefusal(
    `${issues.length} page problem(s) would enter curated knowledge.`,
    issues[0]?.remedy ?? "Repair the page, then promote again",
    issues.map((issue) => `  ${issue.path}: ${issue.problem}\n    → ${issue.remedy}`).join("\n"),
  );
}

export function renderIssues(issues: PageIssue[], pages = 1): string {
  if (pages === 0) {
    return [
      "There are no curated pages.",
      "",
      "That is not a pass. An empty corpus satisfies every structural check, and",
      "reporting it as clean reads exactly like a corpus that was checked.",
    ].join("\n");
  }
  if (issues.length === 0) return `${pages} page(s) pass structural validation.`;
  return [
    ...issues.map((issue) => `${issue.path}\n  ${issue.problem}\n  → ${issue.remedy}`),
    "",
    `${issues.length} problem(s). Structural validation cannot tell whether a page`,
    "is true or whether a reader can act on it — that is the semantic gate's job.",
  ].join("\n");
}
