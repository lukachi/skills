import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { isMissingFileError } from "./config.js";

/**
 * What a source repository declares about itself, read from the centre.
 *
 * Delivery is shaped from the knowledge repository whenever the work spans more
 * than one source repository, because only the centre can see all of them at
 * once. But each repository also carries rules of its own — written by the
 * maintainer in its `AGENTS.md` outside the block this workflow manages, and
 * skills installed only there. Those rules are binding and specific: one of them
 * opens with "read this first" and names a plan file; another calls itself
 * BINDING and orders the graph queried before anything else.
 *
 * A session started inside that repository loads both. A session started at the
 * centre loads neither, and nothing ever told it they existed. So a spec written
 * centrally for three repositories was written without the three sets of rules
 * that govern working in them — not because the agent skipped a step, but
 * because the step had no way to exist.
 *
 * This reads them without leaving the centre. It reports rather than merges: a
 * repository's own instructions belong to that repository and change on its own
 * schedule, so copying them into a bundle would create a second copy that is
 * wrong the first time somebody edits the original.
 */

const MANAGED_START = "<!-- wfctl:begin -->";
const MANAGED_END = "<!-- wfctl:end -->";

export interface LeafSkill {
  name: string;
  description: string;
}

export interface LeafDeclaration {
  repository: string;
  root: string;
  /** False when the bound checkout is not on disk right now. */
  available: boolean;
  /** Everything in its agent file outside the block this workflow manages. */
  instructions: string;
  instructionsPath: string;
  /**
   * Hash of those instructions as read. A receipt binds to this, so a
   * repository that changes its own rules after being accounted for is
   * detectable rather than silently out of date.
   */
  instructionsSha256: string;
  /** Skills present in the checkout that this workflow did not install. */
  skills: LeafSkill[];
  /** Why nothing could be read, when that is the case. */
  unreadable: string;
}

export function leafDeclarationDigest(instructions: string): string {
  return createHash("sha256").update(instructions, "utf8").digest("hex");
}

export async function readLeafDeclaration(
  repository: string,
  root: string,
): Promise<LeafDeclaration> {
  const empty: LeafDeclaration = {
    repository,
    root,
    available: true,
    instructions: "",
    instructionsPath: "",
    instructionsSha256: "",
    skills: [],
    unreadable: "",
  };

  let agentFile: { path: string; content: string } | undefined;
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    try {
      agentFile = { path: name, content: await readFile(join(root, name), "utf8") };
      break;
    } catch (error) {
      if (!isMissingFileError(error)) {
        return { ...empty, available: false, unreadable: `cannot read ${name}` };
      }
    }
  }

  const instructions = agentFile ? unmanagedPart(agentFile.content) : "";
  const skills = await readRepositorySkills(root);

  return {
    ...empty,
    instructions,
    instructionsPath: agentFile?.path ?? "",
    instructionsSha256: instructions ? leafDeclarationDigest(instructions) : "",
    skills,
  };
}

export async function readLeafDeclarations(
  repositories: ReadonlyArray<{ repository: string; root: string }>,
): Promise<LeafDeclaration[]> {
  const declarations: LeafDeclaration[] = [];
  for (const entry of repositories) {
    try {
      declarations.push(await readLeafDeclaration(entry.repository, entry.root));
    } catch (error) {
      declarations.push({
        repository: entry.repository,
        root: entry.root,
        available: false,
        instructions: "",
        instructionsPath: "",
        instructionsSha256: "",
        skills: [],
        unreadable: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return declarations;
}

/**
 * The maintainer's own text, which is everything the managed block is not.
 *
 * A malformed or absent block means the whole file is theirs — the safe reading,
 * because treating their instructions as this workflow's own would hide them.
 */
function unmanagedPart(content: string): string {
  const start = content.indexOf(MANAGED_START);
  const end = content.indexOf(MANAGED_END);
  if (start < 0 || end < 0 || end < start) {
    return content.trim();
  }
  return `${content.slice(0, start)}\n${content.slice(end + MANAGED_END.length)}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A skill this workflow did not put there.
 *
 * `skills-lock.json` records every skill the installer owns, so the difference
 * against what is on disk is exactly what the repository added for itself. That
 * is derived rather than listed by name: a hardcoded list would go stale the
 * first time this workflow shipped one more skill.
 */
async function readRepositorySkills(root: string): Promise<LeafSkill[]> {
  const managed = await readManagedSkillNames(root);
  const skills: LeafSkill[] = [];
  // Both layouts are installed side by side, and they hold the same set. The
  // first that yields anything answers; scanning both would report every skill
  // twice under two directory names.
  for (const directory of [".claude/skills", ".agents/skills"]) {
    let entries;
    try {
      entries = await readdir(join(root, directory), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || managed.has(entry.name)) {
        continue;
      }
      skills.push({
        name: entry.name,
        description: await readSkillDescription(
          join(root, directory, entry.name, "SKILL.md"),
        ),
      });
    }
    if (skills.length > 0) {
      break;
    }
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

async function readManagedSkillNames(root: string): Promise<Set<string>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, "skills-lock.json"), "utf8"));
    if (parsed && typeof parsed === "object" && "skills" in parsed) {
      const skills = (parsed as { skills?: unknown }).skills;
      if (skills && typeof skills === "object") {
        return new Set(Object.keys(skills as Record<string, unknown>));
      }
    }
  } catch {
    // No lock file means nothing here is known to be managed, so every skill
    // present is reported. Over-reporting is recoverable; hiding one is not.
  }
  return new Set();
}

async function readSkillDescription(path: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return "";
  }
  const match = /^description:\s*(.+)$/m.exec(content.split("---")[1] ?? "");
  return (match?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}
