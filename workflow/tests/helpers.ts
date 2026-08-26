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
/** Everything up to, but not including, the review. */
async function mark(ctx: CommandContext, where: string): Promise<void> {
  await run(["checkpoint", "--summary", where, "--handoff", `at ${where}`,
    "--last", `reached ${where}`, "--next", "the next step"], ctx);
}

/** Answer every recall item in these groups, by the route each floor wants. */
async function answer(ctx: CommandContext, groups: string[]): Promise<void> {
  for (const group of groups) {
    const route = group === "D" ? "graphify" : group === "G" ? "read" : "qmd";
    for (const item of RECALL_ITEMS.filter((entry) => entry.group === group)) {
      await run(
        ["recall", "answer", item.id, "--answer", "checked", "--route", route, "--source", "k"],
        ctx,
      );
    }
  }
}

/**
 * Framed, and ready to claim.
 *
 * `aligned`, `split` and `implement` were steps and are not any more, so this
 * walks the four transitions that carry authority. Group D is answered because
 * the claim wants it — the traversal obligation moved to the moment code is
 * about to change rather than to a step announcing that it might.
 */
export async function walkToImplement(ctx: CommandContext): Promise<void> {
  await answer(ctx, ["A", "B", "C", "E"]);
  await mark(ctx, "framed");
  const framed = await run(["work", "step", "framed"], ctx);
  if (framed.exitCode !== 0) {
    throw new Error(`walkToImplement did not reach framed:\n${framed.stdout}`);
  }
  await answer(ctx, ["D"]);
}

export async function walkToVerified(ctx: CommandContext): Promise<void> {
  await walkToImplement(ctx);
  await answer(ctx, ["G"]);

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
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );
  await mark(ctx, "verified");
  const verified = await run(["work", "verify", "--review", review], ctx);
  if (verified.exitCode !== 0) {
    throw new Error(`walkToVerified did not reach verified:\n${verified.stdout}`);
  }
}
