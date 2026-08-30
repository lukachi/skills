import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * "I am still working."
 *
 * The stop guard gets one catch per maintainer message. That bound is what
 * keeps it from arguing with an agent that is right to stop — but a long run
 * genuinely needs to be watched at every stop, not only the first, and nothing
 * out here can tell the two apart by reading prose.
 *
 * So the agent answers with an act instead. Refilling the budget is a claim it
 * has to make deliberately, and the claim is exactly the one worth making: keep
 * watching me. Not refilling is the other answer, and it is the safe default —
 * the next stop is clean.
 *
 * There is no gate here and nothing to get wrong. The cost of refilling when
 * you should not have is one more turn; the cost of not refilling when you
 * should have is that the maintainer says "continue".
 */
const MEMORY = ".workflow/current/hooks/stop-guard.json";

interface Memory {
  key: string;
  budget: number;
  fires: number;
  answer: string;
}

async function read(root: string): Promise<Memory> {
  try {
    const value = JSON.parse(await readFile(resolve(root, MEMORY), "utf8")) as Partial<Memory>;
    return {
      key: typeof value.key === "string" ? value.key : "",
      budget: Number.isInteger(value.budget) ? (value.budget as number) : 0,
      fires: Number.isInteger(value.fires) ? (value.fires as number) : 0,
      answer: typeof value.answer === "string" ? value.answer : "",
    };
  } catch {
    return { key: "", budget: 0, fires: 0, answer: "" };
  }
}

export async function keepWatching(root: string): Promise<string> {
  const carried = await read(root);
  const path = resolve(root, MEMORY);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  /**
   * The budget is refilled; the last answer is kept.
   *
   * Clearing it was the first attempt and it removed the only bound that
   * survives a refill. The guard releases when a turn repeats the exact message
   * that was just blocked — an agent that asks to be watched again and then
   * says the same thing is the stuck case, and it is the one shape that could
   * otherwise refill in a loop.
   */
  await writeFile(temporary, `${JSON.stringify({ ...carried, budget: 1 })}\n`, "utf8");
  await rename(temporary, path);

  return [
    "Watching again. The next turn that ends is checked the same way this one was.",
    "",
    "Nothing else changed — this records no state and moves no work. If the work",
    "itself moved, that belongs where recovery reads it:",
    "",
    '  wfctl checkpoint "<what has happened since>"',
  ].join("\n");
}
