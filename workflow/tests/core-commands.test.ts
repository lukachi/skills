import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  advance,
  brief,
  checkpoint,
  flowClose,
  handoff,
  promotionDraft,
  recallAnswer,
  recallRoute,
  workStart,
} from "../src/core/commands.js";
import { currentFlow } from "../src/core/flow.js";
import { RECALL_ITEMS } from "../src/core/recall.js";
import { decideWrite } from "../src/core/write-hook.js";
import type { CommandContext } from "../src/core/commands.js";

const assets = resolve(import.meta.dirname, "..", "templates");

async function context(): Promise<CommandContext> {
  return { root: await mkdtemp(join(tmpdir(), "wfctl-cmd-")), assets, actor: "agent:test" };
}

async function answerGroup(ctx: CommandContext, group: string, route: "qmd" | "graphify") {
  for (const item of RECALL_ITEMS.filter((entry) => entry.group === group)) {
    await recallAnswer(ctx, {
      item: item.id,
      answer: "checked",
      route,
      source: "knowledge/index.md",
    });
  }
}

test("with no flow open the brief says how to start one", async () => {
  const ctx = await context();
  const result = await brief(ctx);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /No flow is open/);
  assert.match(result.stdout, /wfctl work start/);
  assert.match(result.stdout, /knowledge repository/);
});

test("work start refuses without a weight, and explains what the distinction means", async () => {
  const ctx = await context();
  const result = await workStart(ctx, { title: "account recovery" });
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /significant/);
  assert.match(result.stdout, /remedy:/);
});

test("starting a flow prints the next step's guidance, not a path to it", async () => {
  const ctx = await context();
  const result = await workStart(ctx, { title: "account recovery", weight: "significant" });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /What the project already says/);
  assert.match(result.stdout, /nothing covers it/);
});

test("advancing refuses while the current step's recall is short, and names the fix", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });
  await advance(ctx, "aligned");

  const blocked = await advance(ctx, "framed");
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /Recall is incomplete/);
  assert.match(blocked.stdout, /wfctl recall answer/);
  assert.match(blocked.stdout, /E14/);
});

test("an answer without a source is refused", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });
  const result = await recallAnswer(ctx, {
    item: "E14",
    answer: "nothing",
    route: "qmd",
    source: "  ",
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /guess with a sentence around it/);
});

test("a full pass reaches framing once alignment is genuinely answered", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });
  await advance(ctx, "aligned");
  await answerGroup(ctx, "E", "qmd");

  const framed = await advance(ctx, "framed");
  assert.equal(framed.exitCode, 0);
  assert.match(framed.stdout, /cheapest moment to change the scope/);
  assert.match(framed.stdout, /numbered round/);
});

test("the checkpoint is one act, and the brief renders its body for the bound flow", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });
  await checkpoint(ctx, {
    summary: "short line",
    handoff: "the detailed recall a fresh session needs",
    last: "opened the flow",
    next: "align against curated knowledge",
  });

  const rendered = await brief(ctx);
  assert.match(rendered.stdout, /the detailed recall a fresh session needs/);

  const body = await handoff(ctx);
  assert.match(body.stdout, /the detailed recall/);
});

test("closing clears the fence so the next flow may open", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "first", weight: "lightweight" });
  const blocked = await workStart(ctx, { title: "second", weight: "lightweight" });
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /wfctl capture/);

  await flowClose(ctx);
  const second = await workStart(ctx, { title: "second", weight: "lightweight" });
  assert.equal(second.exitCode, 0);
});

test("the promotion draft is created by the tool, never named by the agent", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });
  const result = await promotionDraft(ctx, {
    knowledgeRoot: ctx.root,
    page: "areas/billing/index.md",
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /promotion/);
  assert.match(result.stdout, /draft created at:/);
});

test("the write hook refuses a first write with no traversal, then goes silent on known ground", async () => {
  const ctx = await context();
  await workStart(ctx, { title: "thing", weight: "significant" });

  let flow = await currentFlow(ctx.root);
  assert.ok(flow);

  const refused = decideWrite({
    flow,
    knowledgeRoot: ctx.root,
    target: "/leaf/src/thing.ts",
    writtenThisUnit: [],
  });
  assert.ok(refused.refusal);
  assert.match(refused.refusal.remedy, /recall route graphify/);

  await recallRoute(ctx, { route: "graphify", covered: ["/leaf/src/thing.ts"] });
  flow = await currentFlow(ctx.root);
  assert.ok(flow);

  const first = decideWrite({
    flow,
    knowledgeRoot: ctx.root,
    target: "/leaf/src/thing.ts",
    writtenThisUnit: [],
  });
  assert.match(first.message ?? "", /first write of this unit/);

  const silent = decideWrite({
    flow,
    knowledgeRoot: ctx.root,
    target: "/leaf/src/thing.ts",
    writtenThisUnit: ["/leaf/src/thing.ts"],
  });
  assert.equal(silent.message, undefined);
  assert.equal(silent.refusal, undefined);

  const widened = decideWrite({
    flow,
    knowledgeRoot: ctx.root,
    target: "/leaf/src/elsewhere.ts",
    writtenThisUnit: ["/leaf/src/thing.ts"],
  });
  assert.match(widened.message ?? "", /outside what any traversal/);
});
