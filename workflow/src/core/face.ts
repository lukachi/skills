import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ACTIVE_DIR } from "./bundles.js";
import { slugify } from "./learned.js";
import type { FlowRecord, IssueRecord } from "./types.js";

/**
 * The bundle, in something a person can read.
 *
 * The record is a JSON file. It is the right shape for the tool and the wrong
 * shape for everyone else: one flow reached 165KB holding 34 units, and when
 * the maintainer asked where the work had been written down the honest answer
 * was "inside a field of a file you cannot open". His reply was "i don't see".
 *
 * Agents kept solving this themselves. Across five commits in one repository
 * they read the JSON with Python and hand-wrote a directory of markdown beside
 * it — inventing the filenames, the front matter and the section headings,
 * slightly differently each time, and committing all of it. Five independent
 * reinventions of the same missing thing is the tool being told what it owes.
 *
 * So it is written here, and it is DERIVED: regenerated whole from the record
 * every time the record changes, never read back, never a second place where
 * state can disagree. Editing one of these files by hand changes nothing and
 * the header on every page says so.
 */
export const FACE_DIR = "units";

function frontMatter(flow: FlowRecord, issue: IssueRecord): string[] {
  const claim = issue.claim
    ? `${issue.claim.repository}${issue.claim.worktreeId ? ` (${issue.claim.worktreeId})` : ""}`
    : "";
  return [
    "---",
    `unit: ${issue.id}`,
    `title: ${JSON.stringify(issue.title)}`,
    `status: ${issue.status}`,
    ...(claim ? [`claimed: ${JSON.stringify(claim)}`] : []),
    ...(issue.acceptance.length > 0 ? [`satisfies: [${issue.acceptance.join(", ")}]`] : []),
    ...(issue.addedDuring ? [`added_during: ${issue.addedDuring}`] : []),
    ...(issue.from ? [`split_from: ${issue.from}`] : []),
    `flow: ${flow.id}`,
    "---",
  ];
}

function unitPage(flow: FlowRecord, issue: IssueRecord): string {
  const lines = [
    ...frontMatter(flow, issue),
    "",
    `# ${issue.id} · ${issue.title}`,
    "",
    "*Written by wfctl from the flow record. Editing this page changes nothing —*",
    `*\`wfctl work issue note ${issue.id} --note "…"\` is what changes it.*`,
    "",
  ];

  if (issue.notes.length > 0) {
    lines.push("## What is known", "");
    for (const note of issue.notes) lines.push(note.trim(), "");
  } else {
    lines.push("## What is known", "", "Nothing written down yet.", "");
  }

  if (issue.evidence) {
    lines.push("## What proves it done", "", issue.evidence.trim(), "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function indexPage(flow: FlowRecord): string {
  const byStatus = (status: IssueRecord["status"]) =>
    flow.issues.filter((issue) => issue.status === status);

  const lines = [
    "---",
    `flow: ${flow.id}`,
    `step: ${flow.step}`,
    `title: ${JSON.stringify(flow.title)}`,
    "---",
    "",
    `# ${flow.title}`,
    "",
    "*Written by wfctl from the flow record, and rewritten whole whenever it*",
    "*changes. Nothing here is read back — `wfctl brief` is authoritative.*",
    "",
    `step: **${flow.step}**   ·   ${flow.issues.length} unit(s)`,
    "",
  ];

  for (const status of ["claimed", "open", "done", "dropped"] as const) {
    const group = byStatus(status);
    if (group.length === 0) continue;
    lines.push(`## ${status} — ${group.length}`, "");
    for (const issue of group) {
      lines.push(`- [\`${issue.id}\`](${issue.id}-${slugify(issue.title)}.md) ${issue.title}`);
    }
    lines.push("");
  }

  if (flow.findings && flow.findings.length > 0) {
    const open = flow.findings.filter((finding) => finding.status === "open");
    if (open.length > 0) {
      lines.push(`## findings this work owes — ${open.length}`, "");
      for (const finding of open) lines.push(`- \`${finding.id}\` ${finding.what}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Rewrite the face, and remove the pages of units that no longer exist.
 *
 * A derived directory that only ever grows is worse than none: a unit renamed
 * or dropped leaves a page that still reads as current, and a stale page beside
 * a fresh one is exactly the two-places-disagreeing failure this avoids by
 * being derived in the first place.
 *
 * Never throws. The face is a convenience; a filesystem that will not take it
 * must not fail the command that changed the record.
 */
export async function writeFace(root: string, flow: FlowRecord): Promise<void> {
  const bundle = flow.members[0] ?? flow.id;
  const directory = resolve(root, ACTIVE_DIR, bundle, FACE_DIR);
  try {
    await mkdir(directory, { recursive: true });

    const wanted = new Map<string, string>();
    wanted.set("README.md", indexPage(flow));
    for (const issue of flow.issues) {
      wanted.set(`${issue.id}-${slugify(issue.title)}.md`, unitPage(flow, issue));
    }

    for (const [name, body] of wanted) {
      await writeFile(resolve(directory, name), body, "utf8");
    }

    for (const entry of await readdir(directory).catch(() => [])) {
      if (!entry.endsWith(".md") || wanted.has(entry)) continue;
      await rm(resolve(directory, entry), { force: true });
    }
  } catch {
    // Derived and disposable. The record is what matters and it already landed.
  }
}
