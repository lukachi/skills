import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Profile } from "./types.js";

export async function findDistributionRoot(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, ".."), resolve(here, "../..")];

  for (const candidate of candidates) {
    if (await exists(join(candidate, "skills")) && await exists(join(candidate, "rules"))) {
      return candidate;
    }
  }

  throw new Error("Cannot locate wfctl distribution assets");
}

export async function renderAgentInstructions(
  distributionRoot: string,
  profile: Profile,
  knowledgePath?: string,
): Promise<string> {
  const common = await readFile(join(distributionRoot, "templates/agents/common.md"), "utf8");
  const specific = await readFile(join(distributionRoot, `templates/agents/${profile}.md`), "utf8");
  return `${common.trimEnd()}\n${specific}`
    .replaceAll("{{KNOWLEDGE_PATH}}", knowledgePath ?? "(not configured)")
    .trim();
}

export async function collectFiles(root: string): Promise<string[]> {
  if (!await exists(root)) {
    return [];
  }

  const result: string[] = [];
  await visit(root, "");
  return result.sort();

  async function visit(current: string, relative: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = relative ? join(relative, entry.name) : entry.name;
      const child = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(child, childRelative);
      } else if (entry.isFile()) {
        result.push(childRelative);
      }
    }
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
