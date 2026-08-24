import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { run } from "../src/core/cli.js";
import type { CommandContext } from "../src/core/commands.js";
import { walkToImplement, walkToVerified } from "./helpers.js";

const assets = resolve(import.meta.dirname, "..", "templates", "guidance");

async function opened(): Promise<CommandContext> {
  const ctx: CommandContext = {
    root: await mkdtemp(join(tmpdir(), "wfctl-units-")),
    assets,
    actor: "agent:test",
  };
  await run(["work", "start", "--title", "thing", "--weight", "significant", "--attested", "they asked for it"], ctx);
  return ctx;
}


test("units carry a status and notes, and nothing schedules them", async () => {
  const ctx = await opened();
  await run(["work", "issue", "create", "--title", "first slice", "--satisfies", "AC-01"], ctx);
  await run(["work", "issue", "create", "--title", "second slice"], ctx);
  await run(["work", "issue", "note", "U002", "--note", "needs the first one landed"], ctx);

  const listed = await run(["work", "issue", "list"], ctx);
  assert.match(listed.stdout, /U001\s+open\s+first slice/);
  assert.match(listed.stdout, /needs the first one landed/);
});

test("completing a unit says the next one is available work", async () => {
  const ctx = await opened();
  await run(["work", "issue", "create", "--title", "first"], ctx);
  await run(["work", "issue", "create", "--title", "second"], ctx);
  await run(["repo", "add", "o/r", "--path", "/tmp"], ctx);
  await run(["work", "issue", "claim", "U001", "--repository", "o/r", "--worktree", "main"], ctx);

  const done = await run(["work", "issue", "complete", "U001"], ctx);
  assert.equal(done.exitCode, 0);
  assert.match(done.stdout, /1 unit\(s\) still open/);
  assert.match(done.stdout, /Finishing a unit is not finishing/);
});

test("a claim records the workspace and never a revision", async () => {
  const ctx = await opened();
  // A claim names a checkout the registry knows; any string used to be accepted.
  await run(["repo", "add", "o/r", "--path", "/tmp", "--worktree", "wt-1"], ctx);
  await run(["work", "issue", "create", "--title", "first"], ctx);
  await run(["work", "issue", "claim", "U001", "--repository", "o/r", "--worktree", "wt-1"], ctx);

  const raw = await readFile(
    resolve(ctx.root, ".workflow/flows", `${(await readFile(resolve(ctx.root, ".workflow/flows/current"), "utf8")).trim()}.json`),
    "utf8",
  );
  const claim = JSON.parse(raw).issues[0].claim;
  assert.deepEqual(Object.keys(claim).sort(), ["checkout", "repository", "worktreeId"]);
});

test("a parked flow refuses a claim, and only their words release it", async () => {
  const ctx = await opened();
  await run(["work", "issue", "create", "--title", "first"], ctx);
  await run(["repo", "add", "o/r", "--path", "/tmp"], ctx);
  await run(["work", "park", "--reason", "client rebuild first"], ctx);

  const blocked = await run(["work", "issue", "claim", "U001", "--repository", "o/r"], ctx);
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /parked/);

  const empty = await run(["work", "release"], ctx);
  assert.equal(empty.exitCode, 2);
  assert.match(empty.stdout, /their own words/);

  const released = await run(["work", "release", "--attested", "go ahead now"], ctx);
  assert.equal(released.exitCode, 0);
  assert.doesNotMatch((await run(["work", "issue", "claim", "U001", "--repository", "o/r"], ctx)).stdout, /parked/);
});

test("a capture is written to the inbox and never becomes a record", async () => {
  const ctx = await opened();
  const result = await run(["capture", "the session cookie never expires"], ctx);
  assert.equal(result.exitCode, 0);

  const inbox = await readdir(resolve(ctx.root, "changes/inbox"));
  assert.equal(inbox.length, 1);
  const body = await readFile(resolve(ctx.root, "changes/inbox", inbox[0] as string), "utf8");
  assert.match(body, /the session cookie never expires/);
  assert.match(body, /awaits: nobody/);

  const second = await run(["work", "start", "--title", "another", "--weight", "lightweight", "--attested", "they asked for it"], ctx);
  assert.equal(second.exitCode, 2);
});

test("verification refuses a review the acting agent produced", async () => {
  const ctx = await opened();
  await walkToVerified(ctx).catch(() => undefined);
  const review = resolve(ctx.root, "review.json");
  await writeFile(
    review,
    JSON.stringify({ reviewer: "agent:test", attacks: [], findings: [], stubSurvivors: [] }),
    "utf8",
  );
  const result = await run(["work", "verify", "--review", review], ctx);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /agent under review/);
});

test("verification accepts a delegated review and hands over the closing guidance", async () => {
  const ctx = await opened();
  await walkToImplement(ctx);
  const review = resolve(ctx.root, "review.json");
  await writeFile(
    review,
    JSON.stringify({
      reviewer: "agent:reviewer",
      fixedPoint: "abc",
      framingDigest: "",
      attacks: [
        { lens: "correctness", target: "negatives", test: "expect(f(-1)).toThrow()", output: "pass", broke: false },
      ],
      findings: [],
      stubSurvivors: [],
    }),
    "utf8",
  );
  const result = await run(["work", "verify", "--review", review], ctx);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /review accepted from agent:reviewer/);
  assert.match(result.stdout, /Nobody is asked/);
});

test("closing refuses while any unit is not terminal", async () => {
  const ctx = await opened();
  await walkToVerified(ctx);
  await run(["work", "issue", "create", "--title", "first"], ctx);

  // An OPEN unit blocks too: sixty-five undelivered units once closed as
  // `completed` because only a claim was checked.
  const result = await run(["work", "close", "--outcome", "completed"], ctx);
  assert.equal(result.exitCode, 2);
  assert.match(result.stdout, /not terminal/);
  assert.match(result.stdout, /wfctl work issue complete U001/);

  // Dropping it deliberately is the way past, and it records why.
  const bare = await run(["work", "issue", "drop", "U001"], ctx);
  assert.equal(bare.exitCode, 2);
  await run(["work", "issue", "drop", "U001", "--reason", "left the route"], ctx);
  assert.equal((await run(["work", "close", "--outcome", "partial"], ctx)).exitCode, 0);
});

test("a partial close holding pages waits in the queue", async () => {
  const ctx = await opened();
  await walkToVerified(ctx);
  await run(["work", "promotion", "draft", "areas/billing/index.md"], ctx);
  const result = await run(["work", "close", "--outcome", "partial"], ctx);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /waits in the promotion queue/);

  const queued = await run(["work", "promotion", "list"], ctx);
  assert.match(queued.stdout, /waiting on the maintainer/);
});

test("a record with nothing to say archives instead", async () => {
  const ctx = await opened();
  await walkToVerified(ctx);
  const result = await run(["work", "close", "--outcome", "completed"], ctx);
  assert.match(result.stdout, /nothing to say about itself/);
});
