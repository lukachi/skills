import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the distribution the running binary belongs to.
 *
 * It used to prove the directory by finding `skills/` and `rules/` beside it.
 * Neither exists any more, so the marker is the guidance bundle — the thing
 * this tool now actually installs.
 */
export async function findDistributionRoot(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, ".."), resolve(here, "../.."), resolve(here, "../../..")];

  for (const candidate of candidates) {
    if (await exists(join(candidate, "templates", "guidance"))) return candidate;
  }

  throw new Error("Cannot locate wfctl distribution assets");
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
