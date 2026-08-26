import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GateRefusal } from "./gates.js";

/**
 * What the work taught, kept past the work.
 *
 * The record had three destinations and all three end when the bundle does: a
 * unit note, a checkpoint, an artifact under `changes/`. So every session
 * started from the same ground as the last one, and the same wall got hit
 * twice — which is not a memory problem, it is a filing problem. Nothing in the
 * tool held a thing that was true *after* the work that found it.
 *
 * A learning is the smallest durable unit of that: one problem, solved, written
 * so the next piece of work reads it before starting rather than after failing.
 * It is not a curated page — it makes no claim about what the project *means*,
 * and it does not go through promotion. It is a note from someone who has been
 * here before.
 *
 * It carries the maintainer's word for the same reason a bundle does. A finding
 * lives inside a fence and dies with it; this outlives every fence, and what
 * outlives the work is theirs to allow.
 */
export const LEARNINGS_DIR = "learnings";

export interface Learning {
  path: string;
  title: string;
  body: string;
}

/** Anything a filename can hold, from anything a person would type. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "learning";
}

export async function writeLearning(
  root: string,
  options: { title: string; body: string; attested: string; actor: string; flow?: string },
  now = new Date(),
): Promise<string> {
  if (!options.title.trim()) {
    throw new GateRefusal(
      "A learning needs to say what it is, in one line.",
      'wfctl learned "<the one line>" --detail "<what happened and what to do>" --attested "<what they said>"',
      "The one line is what a future session sees in a list of thirty. If it " +
        "does not distinguish this from the others, it will not be opened.",
    );
  }
  if (!options.body.trim()) {
    throw new GateRefusal(
      "A learning with no detail is a title.",
      `wfctl learned "${options.title}" --detail "<what happened, and what to do about it>"`,
      "Say what was hit, what it cost, and what the next person should do " +
        "instead. A learning that only names the topic sends a reader to find " +
        "out for themselves, which is the situation it exists to prevent.",
    );
  }
  if (!options.attested.trim()) {
    throw new GateRefusal(
      "A learning outlives the work that found it, and that is the maintainer's call.",
      `wfctl learned "${options.title}" --detail "<...>" --attested "<what they said>"`,
      "A finding stays inside this bundle's fence and goes when it does. This " +
        "is read by work nobody has started yet, so it is theirs to allow — " +
        "put it to them in one sentence and record their answer.\n\n" +
        'If they have not answered, it is a finding: wfctl finding "<what you found>"',
    );
  }

  const directory = resolve(root, LEARNINGS_DIR);
  await mkdir(directory, { recursive: true });

  const day = now.toISOString().slice(0, 10);
  const stem = `${day}-${slugify(options.title)}`;
  /**
   * Created exclusively, so two learnings written in the same second are two
   * files. Losing one silently is losing the only copy.
   */
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const path = resolve(directory, `${attempt === 0 ? stem : `${stem}-${attempt}`}.md`);
    const body = [
      "---",
      `title: ${JSON.stringify(options.title.trim())}`,
      `learned_at: ${now.toISOString()}`,
      `actor: ${options.actor}`,
      ...(options.flow ? [`from: ${options.flow}`] : []),
      `attested: ${JSON.stringify(options.attested.trim())}`,
      "---",
      "",
      `# ${options.title.trim()}`,
      "",
      options.body.trim(),
      "",
    ].join("\n");
    try {
      await writeFile(path, body, { flag: "wx" });
      return path;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new GateRefusal(
    "Could not create a file for this learning.",
    "Check that learnings/ is writable.",
  );
}

export async function listLearnings(root: string): Promise<Learning[]> {
  const directory = resolve(root, LEARNINGS_DIR);
  const entries = await readdir(directory).catch(() => []);
  const learnings: Learning[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue;
    const body = await readFile(resolve(directory, entry), "utf8").catch(() => "");
    const titled = /^title:\s*"?(.*?)"?\s*$/m.exec(body);
    learnings.push({
      path: `${LEARNINGS_DIR}/${entry}`,
      title: titled?.[1] ?? entry.replace(/\.md$/, ""),
      body,
    });
  }
  return learnings;
}

/**
 * The line the brief carries.
 *
 * An index, never the contents. The whole failure this replaces is a corpus
 * nobody reads because it arrives all at once; a count and a command is what
 * makes it something an agent reaches for when it has a reason to.
 */
export function summariseLearnings(learnings: Learning[]): string | undefined {
  if (learnings.length === 0) return undefined;
  return `${learnings.length} learning(s) from earlier work   ·   wfctl learned list`;
}

export function renderLearnings(learnings: Learning[]): string {
  if (learnings.length === 0) {
    return [
      "Nothing has been written down as a learning yet.",
      "",
      "A learning is one problem, solved, written so the next piece of work reads",
      "it before starting rather than after failing:",
      "",
      '  wfctl learned "<the one line>" --detail "<what happened, and what to do>" \\',
      '    --attested "<what they said>"',
      "",
      "It is not a curated page. It makes no claim about what the project means,",
      "and it does not go through promotion — it is a note from someone who has",
      "been here before.",
    ].join("\n");
  }
  return [
    ...learnings.map((learning) => `${learning.title}\n  ${learning.path}`),
    "",
    `${learnings.length} learning(s). Read the ones this work could hit.`,
  ].join("\n");
}
