import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { run } from "../src/core/cli.js";
import type { CommandContext } from "../src/core/commands.js";
import { RECALL_ITEMS } from "../src/core/recall.js";

/**
 * Walk a flow to `verified` the way the tool requires.
 *
 * Tests used to reach closure by calling `work close` directly, which is
 * exactly the hole six test agents found: closure skipped every gate. Now that
 * it does not, a test that wants a closable flow has to earn one.
 */
export async function walkToVerified(ctx: CommandContext): Promise<void> {
  await run(["work", "step", "aligned"], ctx);
  for (const item of RECALL_ITEMS.filter((entry) => entry.group === "E")) {
    await run(["recall", "answer", item.id, "--answer", "checked", "--route", "qmd", "--source", "knowledge/index.md"], ctx);
  }
  await run(["work", "step", "framed"], ctx);
  for (const item of RECALL_ITEMS.filter((entry) => ["A", "B", "C"].includes(entry.group))) {
    await run(["recall", "answer", item.id, "--answer", "checked", "--route", "qmd", "--source", "knowledge/index.md"], ctx);
  }
  await run(["work", "step", "split"], ctx);
  await run(["work", "step", "implement"], ctx);
  for (const item of RECALL_ITEMS.filter((entry) => entry.group === "D")) {
    await run(["recall", "answer", item.id, "--answer", "checked", "--route", "graphify", "--source", "src/x.ts"], ctx);
  }

  for (const item of RECALL_ITEMS.filter((entry) => entry.group === "G")) {
    await run(["recall", "answer", item.id, "--answer", "checked", "--route", "read", "--source", "src/x.ts"], ctx);
  }

  const review = resolve(ctx.root, "walk-review.json");
  await writeFile(
    review,
    JSON.stringify({
      reviewer: "agent:reviewer",
      fixedPoint: "abc",
      framingDigest: "",
      attacks: [{ lens: "correctness", target: "edges", test: "expect(f()).toThrow()", output: "held", broke: false }],
      findings: [],
      stubSurvivors: [],
    }),
    "utf8",
  );
  await run(["work", "verify", "--review", review], ctx);
}
