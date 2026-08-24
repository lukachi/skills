/**
 * One process, one increment, taken under the lock.
 *
 * The lock is only interesting across processes: within one, the event loop
 * already serialises the read-modify-write and every in-process test passes
 * against a lock that does not exclude at all.
 */
import { readFile, writeFile } from "node:fs/promises";
import { withLock } from "../../src/core/lock.js";

const target = process.argv[2] ?? "";
const index = process.argv[3] ?? "";

await withLock(target, async () => {
  const state = JSON.parse(await readFile(target, "utf8")) as { value: number; entries: number[] };
  // A window wide enough that an unlocked reader is guaranteed to see the same
  // value we did.
  await new Promise((wake) => setTimeout(wake, 15));
  state.value += 1;
  state.entries.push(Number(index));
  await writeFile(target, JSON.stringify(state), "utf8");
});
