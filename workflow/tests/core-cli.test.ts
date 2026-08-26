import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { run } from "../src/core/cli.js";
import type { CommandContext } from "../src/core/commands.js";

const assets = resolve(import.meta.dirname, "..", "templates", "guidance");

async function context(): Promise<CommandContext> {
  return { root: await mkdtemp(join(tmpdir(), "wfctl-cli-")), assets, actor: "agent:test" };
}

test("the whole changes flow is walkable without knowing the sequence", async () => {
  const ctx = await context();

  const start = await run(["work", "start", "--title", "account recovery", "--weight", "significant", "--attested", "they asked for it"], ctx);
  assert.equal(start.exitCode, 0);
  assert.match(start.stdout, /What the project already says/);

  await run(["work", "step", "aligned"], ctx);

  const blocked = await run(["work", "step", "framed"], ctx);
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /remedy: wfctl recall answer/);

  for (const item of ["E14", "E15", "E16"]) {
    const answered = await run(
      ["recall", "answer", item, "--answer", "checked", "--route", "qmd", "--source", "knowledge/index.md"],
      ctx,
    );
    assert.equal(answered.exitCode, 0);
  }

  // The step now wants a checkpoint written since the flow last moved, and the
  // refusal is what says so — following the tool is still the whole route.
  const owed = await run(["work", "step", "framed"], ctx);
  assert.equal(owed.exitCode, 2);
  assert.match(owed.stdout, /remedy: wfctl checkpoint/);
  await run(["checkpoint", "--summary", "aligned", "--handoff", "what was found",
    "--last", "read the index", "--next", "frame it"], ctx);

  const framed = await run(["work", "step", "framed"], ctx);
  assert.equal(framed.exitCode, 0);
  assert.match(framed.stdout, /numbered round/);
});

test("a leaf init is refused with what replaced it", async () => {
  const ctx = await context();
  const result = await run(["init", "leaf"], ctx);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /no leaf installation/);
});

test("init knowledge installs guidance and says to restart", async () => {
  const ctx = await context();
  const result = await run(["init", "knowledge", "--target", ctx.root], ctx);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /files written/);
  assert.match(result.stdout, /Restart the agent session/);
});

test("the recall checklist is listable", async () => {
  const ctx = await context();
  const result = await run(["recall", "list"], ctx);
  assert.match(result.stdout, /A1  Has the maintainer already answered this\?/);
  assert.match(result.stdout, /H24/);
});

test("the brief is what a session opens with", async () => {
  const ctx = await context();
  const empty = await run(["brief"], ctx);
  assert.match(empty.stdout, /No flow is open/);

  await run(["work", "start", "--title", "thing", "--weight", "lightweight", "--attested", "they asked for it"], ctx);
  await run(
    ["checkpoint", "--summary", "s", "--handoff", "the body", "--last", "l", "--next", "n"],
    ctx,
  );
  const briefed = await run(["brief"], ctx);
  assert.match(briefed.stdout, /the body/);
});

test("an unknown step is named rather than silently ignored", async () => {
  const ctx = await context();
  const result = await run(["work", "step", "nonsense"], ctx);
  // A refusal, like every other refusal: exit 2, and it names the command that
  // answers the question the caller was probably asking.
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /wfctl work step/);
  assert.match(result.stdout, /The steps are: opened, aligned/);
});

test("the guide serves detail on demand and lists its topics", async () => {
  const ctx = await context();

  const listed = await run(["guide"], ctx);
  assert.equal(listed.exitCode, 0);
  assert.match(listed.stdout, /topics: .*recall/);

  const page = await run(["guide", "wfctl"], ctx);
  assert.equal(page.exitCode, 0);
  assert.match(page.stdout, /You do not need to know the sequence/);

  const recall = await run(["guide", "recall"], ctx);
  assert.match(recall.stdout, /cannot feel that something is missing/);

  const unknown = await run(["guide", "nonsense"], ctx);
  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.stdout, /No guide named nonsense/);
});

test("a recall refusal points at the guide that explains it", async () => {
  const ctx = await context();
  await run(["work", "start", "--title", "thing", "--weight", "significant", "--attested", "they asked for it"], ctx);
  await run(["work", "step", "aligned"], ctx);

  const blocked = await run(["work", "step", "framed"], ctx);
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /wfctl guide recall/);
});
