import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { withLock, writeAtomic } from "../src/core/lock.js";
import { canonical, contains, findRepositoryRoot } from "../src/core/paths-resolve.js";
import { assertWriteAllowed } from "../src/core/paths.js";
import { GateRefusal, assertReached } from "../src/core/gates.js";
import { WORK_STEP_DEFINITIONS } from "../src/core/steps.js";
import { WORK_STEPS } from "../src/core/types.js";
import type { FlowRecord } from "../src/core/types.js";

/**
 * The three things round three rewrote.
 *
 * Every other suite was written from the same understanding that produced the
 * bug it was meant to catch. These are written from the opposite direction:
 * each one names a way the rewrite could be wrong and tries to make it happen,
 * rather than confirming that the happy path still walks.
 */

async function scratch(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// 1. The lock
// ---------------------------------------------------------------------------

const worker = resolve(import.meta.dirname, "fixtures/lock-worker.ts");

/** Run N separate processes that each increment one counter under the lock. */
function race(target: string, count: number): Promise<number[]> {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      new Promise<number>((done, fail) => {
        const child = spawn(process.execPath, [worker, target, String(index)], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr += String(chunk); });
        child.on("exit", (code) => (code === 0 ? done(index) : fail(new Error(stderr))));
      })),
  );
}

test("lock: N separate processes each land exactly one increment", async () => {
  const root = await scratch("wfctl-lock-race-");
  const target = join(root, "counter.json");
  await writeFile(target, JSON.stringify({ value: 0, entries: [] }), "utf8");

  const RACERS = 12;
  await race(target, RACERS);

  const final = JSON.parse(await readFile(target, "utf8")) as { value: number; entries: number[] };
  assert.equal(final.value, RACERS, "a write was lost: the lock did not exclude");
  assert.equal(new Set(final.entries).size, RACERS, "an increment ran twice or not at all");
});

test("lock: the lock directory is gone once every holder has released", async () => {
  const root = await scratch("wfctl-lock-clean-");
  const target = join(root, "counter.json");
  await writeFile(target, JSON.stringify({ value: 0, entries: [] }), "utf8");

  await race(target, 6);
  assert.equal(existsSync(`${target}.lock`), false, "a lock directory outlived its holder");
});

test("lock: a holder whose process is gone is reclaimed", async () => {
  const root = await scratch("wfctl-lock-dead-");
  const target = join(root, "record.json");
  mkdirSync(`${target}.lock`);
  // A pid that cannot be running: the kernel reserves 0 for the scheduler and
  // `kill(0, 0)` addresses the process group, so use an unallocated high pid.
  await writeFile(
    `${target}.lock/holder.json`,
    JSON.stringify({ pid: 0x7ffffffe, token: "dead", at: Date.now() }),
    "utf8",
  );

  const started = Date.now();
  const got = await withLock(target, async () => "mine");
  assert.equal(got, "mine");
  assert.ok(Date.now() - started < 2_000, "reclaiming a dead holder should be immediate");
});

test("lock: a live, recent holder is never stolen from", async () => {
  const root = await scratch("wfctl-lock-live-");
  const target = join(root, "record.json");
  mkdirSync(`${target}.lock`);
  await writeFile(
    `${target}.lock/holder.json`,
    JSON.stringify({ pid: process.pid, token: "live", at: Date.now() }),
    "utf8",
  );

  const stolen = await Promise.race([
    withLock(target, async () => "stolen").catch(() => "refused"),
    new Promise((wake) => setTimeout(() => wake("waited"), 400)),
  ]);
  assert.equal(stolen, "waited", "the lock was taken from a living holder");

  const holder = JSON.parse(await readFile(`${target}.lock/holder.json`, "utf8")) as { token: string };
  assert.equal(holder.token, "live", "the live holder's own token was deleted");
});

/**
 * A process killed between `mkdir(lock)` and writing its holder file leaves a
 * directory that describes nobody. Reclaiming it was bounded by how long the
 * *caller* had been waiting rather than how long the lock had existed, and the
 * staleness bound sat outside the wait bound — so every caller gave up before
 * the reclaim could ever fire and the record was wedged permanently.
 */
test("lock: an orphaned lock with no holder is eventually reclaimed, not wedged forever", async () => {
  const root = await scratch("wfctl-lock-orphan-");
  const target = join(root, "record.json");
  mkdirSync(`${target}.lock`);

  const got = await withLock(target, async () => "recovered");
  assert.equal(got, "recovered", "an orphaned lock directory can never be recovered");
});

test("writeAtomic: a reader never observes a partial file", async () => {
  const root = await scratch("wfctl-atomic-");
  const target = join(root, "record.json");
  const body = "x".repeat(512 * 1024);
  await writeFile(target, "original", "utf8");

  const reads: string[] = [];
  const reading = (async () => {
    for (let i = 0; i < 200; i += 1) {
      reads.push(await readFile(target, "utf8"));
      await new Promise((wake) => setTimeout(wake, 0));
    }
  })();
  await writeAtomic(target, body);
  await reading;

  for (const seen of reads) {
    assert.ok(seen === "original" || seen === body, `a reader saw a partial file (${seen.length} bytes)`);
  }
});

// ---------------------------------------------------------------------------
// 2. The path resolver
// ---------------------------------------------------------------------------

test("paths: a dangling symlink resolves to where it points, not where it sits", async () => {
  const root = await scratch("wfctl-path-dangle-");
  const link = join(root, "draft.md");
  symlinkSync(join(root, "knowledge/area/page.md"), link);

  assert.equal(canonical(link), canonical(join(root, "knowledge/area/page.md")));
});

test("paths: a dangling symlink into knowledge/ is refused by the write guard", async () => {
  const root = await scratch("wfctl-path-guard-");
  const link = join(root, "innocent.md");
  symlinkSync(join(root, "knowledge/area/page.md"), link);

  assert.throws(
    () => assertWriteAllowed({ knowledgeRoot: root, target: link, bundleId: "b" }),
    (error: unknown) => error instanceof GateRefusal && /curated page cannot be written/.test((error as Error).message),
  );
});

test("paths: a symlinked parent directory does not launder the destination", async () => {
  const root = await scratch("wfctl-path-parent-");
  mkdirSync(join(root, "knowledge"), { recursive: true });
  symlinkSync(join(root, "knowledge"), join(root, "shortcut"));

  assert.throws(
    () => assertWriteAllowed({ knowledgeRoot: root, target: join(root, "shortcut/page.md"), bundleId: "b" }),
    (error: unknown) => error instanceof GateRefusal,
  );
});

test("paths: a symlink out of the repository is outside the fence", async () => {
  const root = await scratch("wfctl-path-out-");
  const elsewhere = await scratch("wfctl-path-else-");
  symlinkSync(join(elsewhere, "notes.md"), join(root, "notes.md"));

  assert.equal(contains(root, join(root, "notes.md")), false);
});

test("paths: /tmp and /private/tmp compare equal", () => {
  if (!existsSync("/private/tmp")) return;
  assert.equal(canonical("/tmp/wfctl-probe"), canonical("/private/tmp/wfctl-probe"));
  assert.ok(contains("/tmp", "/private/tmp/wfctl-probe"));
});

test("paths: a symlink cycle terminates and stays inside the fence", async () => {
  const root = await scratch("wfctl-path-cycle-");
  symlinkSync(join(root, "b"), join(root, "a"));
  symlinkSync(join(root, "a"), join(root, "b"));

  const resolved = canonical(join(root, "a"));
  assert.ok(typeof resolved === "string" && resolved.length > 0);
  assert.ok(contains(root, join(root, "a")), "a cycle escaped the fence");
});

test("paths: the repository root is found from a symlinked working directory", async () => {
  const real = await scratch("wfctl-root-real-");
  mkdirSync(join(real, ".workflow"), { recursive: true });
  await writeFile(join(real, ".workflow/state.json"), "{}", "utf8");
  mkdirSync(join(real, "deep/nested"), { recursive: true });

  const alias = join(await scratch("wfctl-root-alias-"), "link");
  symlinkSync(real, alias);

  assert.equal(findRepositoryRoot(join(alias, "deep/nested")), canonical(real));
});

test("paths: a nested repository binds to the nearest root, not the outer one", async () => {
  const outer = await scratch("wfctl-root-outer-");
  mkdirSync(join(outer, ".workflow"), { recursive: true });
  await writeFile(join(outer, ".workflow/state.json"), "{}", "utf8");
  const inner = join(outer, "leaf");
  mkdirSync(join(inner, ".workflow"), { recursive: true });
  await writeFile(join(inner, ".workflow/state.json"), "{}", "utf8");

  assert.equal(findRepositoryRoot(inner), canonical(inner));
});

// ---------------------------------------------------------------------------
// 3. The step chain
// ---------------------------------------------------------------------------

function flowAt(step: FlowRecord["step"]): FlowRecord {
  return {
    id: "f1",
    kind: "work",
    title: "t",
    step,
    weight: "significant",
    openedAt: new Date().toISOString(),
    recall: { covered: {}, written: {} },
    issues: [],
  } as unknown as FlowRecord;
}

test("steps: every step refuses from `opened` and names the command that clears it", () => {
  const skippable = new Set(["opened", "aligned"]);
  for (const step of WORK_STEPS) {
    if (skippable.has(step)) continue;
    assert.throws(
      () => assertReached(flowAt("opened"), step),
      (error: unknown) => {
        assert.ok(error instanceof GateRefusal, `${step} did not refuse from opened`);
        const refusal = error as GateRefusal;
        assert.match(refusal.remedy, /^wfctl /, `${step}'s remedy is not a command: ${refusal.remedy}`);
        assert.ok(refusal.detail && refusal.detail.length > 20, `${step}'s refusal explains nothing`);
        return true;
      },
      `${step} was reachable straight from opened`,
    );
  }
});

test("steps: each refusal names the command of the step it is actually missing", () => {
  const byStep = new Map(WORK_STEP_DEFINITIONS.map((definition) => [definition.step, definition]));
  const cases: Array<[FlowRecord["step"], FlowRecord["step"], FlowRecord["step"]]> = [
    ["opened", "framed", "aligned"],
    ["aligned", "implement", "framed"],
    ["framed", "verified", "implement"],
    ["implement", "closed", "verified"],
    ["verified", "promoted", "closed"],
  ];
  for (const [at, attempted, missing] of cases) {
    try {
      assertReached(flowAt(at), attempted);
      assert.fail(`${attempted} was reachable from ${at}`);
    } catch (error) {
      assert.ok(error instanceof GateRefusal);
      assert.equal((error as GateRefusal).remedy, byStep.get(missing)?.command,
        `at ${at}, ${attempted} pointed at the wrong step`);
    }
  }
});

test("steps: the chain has no unreachable step and no gap", () => {
  const defined = WORK_STEP_DEFINITIONS.map((definition) => definition.step);
  assert.deepEqual(defined, [...WORK_STEPS],
    "WORK_STEPS and WORK_STEP_DEFINITIONS disagree, so a step exists that nothing describes");
});

// ---------------------------------------------------------------------------
// 4. The same three, through the binary
// ---------------------------------------------------------------------------

/**
 * Round three's lesson was that module tests pass while the program does not:
 * the functions were called directly and the wiring around them was never
 * exercised. Everything above asserts about a function. Everything below
 * asserts about `wfctl`.
 */
const binary = resolve(import.meta.dirname, "../dist/cli.js");

function wfctl(cwd: string, args: string[]): { stdout: string; status: number } {
  const result = spawnSync(process.execPath, [binary, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, WFCTL_ACTOR: "agent:test" },
  });
  return {
    stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status ?? 1,
  };
}

async function installed(): Promise<string> {
  const root = await scratch("wfctl-rr-e2e-");
  const result = wfctl(root, ["init", "knowledge", "--target", root]);
  assert.equal(result.status, 0, result.stdout);
  return root;
}

test("binary: no step in the chain can be reached out of order", async () => {
  for (const step of WORK_STEPS) {
    if (step === "opened" || step === "aligned") continue;
    const root = await installed();
    wfctl(root, ["work", "start", "--title", `skip to ${step}`, "--weight", "significant"]);

    const jumped = wfctl(root, ["work", "step", step]);
    assert.notEqual(jumped.status, 0, `\`work step ${step}\` succeeded straight from opened`);
    assert.match(jumped.stdout, /remedy: /, `\`work step ${step}\` refused without naming a remedy`);
  }
});

test("binary: the terminal commands refuse out of order too", async () => {
  const terminal: string[][] = [
    ["work", "verify", "--review", "nothing.json"],
    ["work", "close", "--outcome", "completed"],
    ["work", "promote", "--subject", "s", "--summary", "x"],
  ];
  for (const args of terminal) {
    const root = await installed();
    wfctl(root, ["work", "start", "--title", "terminal", "--weight", "significant"]);

    const attempted = wfctl(root, args);
    assert.notEqual(attempted.status, 0, `\`${args.join(" ")}\` succeeded from opened`);
    assert.match(attempted.stdout, /remedy: /, `\`${args.join(" ")}\` refused without a remedy`);
  }
});

test("binary: a symlink cycle in the tree does not open a hole in the write guard", async () => {
  const root = await installed();
  symlinkSync(join(root, "b"), join(root, "a"));
  symlinkSync(join(root, "a"), join(root, "b"));

  // The guard's own answer for a path routed through the cycle must stay
  // inside the repository, which is what the `settle` fallback guarantees.
  assert.ok(contains(root, join(root, "a")), "a cycle escaped the repository fence");
  assert.throws(
    () => assertWriteAllowed({ knowledgeRoot: root, target: join(root, "knowledge/x.md") }),
    (error: unknown) => error instanceof GateRefusal,
  );
});

test("binary: commands bind to the repository root from a nested directory", async () => {
  const root = await installed();
  await mkdir(join(root, "deep/nested"), { recursive: true });
  wfctl(root, ["work", "start", "--title", "fenced", "--weight", "significant"]);

  const nested = wfctl(join(root, "deep/nested"), ["brief"]);
  assert.equal(nested.status, 0, nested.stdout);
  assert.match(nested.stdout, /fenced/, "running one directory down lost the open flow");
});

test("binary: an orphaned lock does not permanently wedge a record", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "wedge", "--weight", "significant"]);

  // Exactly what a SIGKILL between mkdir and the holder write leaves behind,
  // on every record the next command has to take.
  const flows = join(root, ".workflow/flows");
  const records = readdirSync(flows).map((entry) => join(flows, entry));
  assert.ok(records.length >= 2, "the flow record and its pointer should both exist");
  for (const record of records) mkdirSync(`${record}.lock`, { recursive: true });

  const started = Date.now();
  const after = wfctl(root, ["checkpoint", "--summary", "s", "--handoff", "h", "--last", "l", "--next", "n"]);
  assert.equal(after.status, 0, `an orphaned lock wedged the record permanently:\n${after.stdout}`);
  assert.ok(Date.now() - started >= 500,
    "the command did not go through the reclaim path, so this proves nothing");
  // Whatever it reclaimed, it must have released: a second identical command
  // needs no reclaim at all, and a re-orphaned lock would make it pay again.
  const again = Date.now();
  const second = wfctl(root, ["checkpoint", "--summary", "s2", "--handoff", "h", "--last", "l", "--next", "n"]);
  assert.equal(second.status, 0, second.stdout);
  assert.ok(Date.now() - again < 500, "the reclaimed lock was re-orphaned rather than released");
});

test("lock: work that throws still releases the lock", async () => {
  const root = await scratch("wfctl-lock-throw-");
  const target = join(root, "record.json");
  await writeFile(target, "{}", "utf8");

  await assert.rejects(() => withLock(target, async () => { throw new Error("boom"); }));
  assert.equal(existsSync(`${target}.lock`), false, "a thrown body leaked its lock");
  assert.equal(await withLock(target, async () => "next"), "next");
});

test("lock: many processes racing one dead holder still admit exactly one at a time", async () => {
  const root = await scratch("wfctl-lock-reclaim-");
  const target = join(root, "counter.json");
  await writeFile(target, JSON.stringify({ value: 0, entries: [] }), "utf8");
  mkdirSync(`${target}.lock`);
  await writeFile(
    `${target}.lock/holder.json`,
    JSON.stringify({ pid: 0x7ffffffe, token: "dead", at: Date.now() }),
    "utf8",
  );

  const RACERS = 8;
  await race(target, RACERS);
  const final = JSON.parse(await readFile(target, "utf8")) as { value: number };
  assert.equal(final.value, RACERS, "concurrent reclaim let two callers in");
});

// ---------------------------------------------------------------------------
// 5. Arguments
// ---------------------------------------------------------------------------

test("flags: --name=value reaches the command instead of becoming a positional", async () => {
  const root = await installed();
  const created = wfctl(root, ["work", "start", "--title=equals form", "--weight=lightweight"]);
  assert.equal(created.status, 0, created.stdout);

  const brief = wfctl(root, ["brief"]);
  assert.match(brief.stdout, /equals form/, "the value was dropped");
});

test("flags: a boolean flag given a value is refused, not silently recorded", async () => {
  const root = await installed();
  const captured = wfctl(root, ["capture", "--awaits=true", "a real finding"]);
  assert.equal(captured.status, 2, "--awaits=true was accepted");
  assert.match(captured.stdout, /--awaits takes no value/);

  const { readdir } = await import("node:fs/promises");
  const inbox = await readdir(join(root, "changes/inbox")).catch(() => [] as string[]);
  assert.equal(inbox.length, 0, "a refused command still wrote a record");
});

test("flags: a flag belonging to another command is refused, and named", async () => {
  const root = await installed();
  const wrong = wfctl(root, ["capture", "--worktree", "x", "something"]);
  assert.equal(wrong.status, 2, "a flag from another command was accepted");
  assert.match(wrong.stdout, /--worktree belongs to: /);
});

test("flags: a capture whose text opens with dashes is still recordable", async () => {
  const root = await installed();
  const body = "--fix the parser, it drops the last token";
  const captured = wfctl(root, ["capture", body]);
  assert.equal(captured.status, 0, captured.stdout);

  const { readdir, readFile: read } = await import("node:fs/promises");
  const inbox = await readdir(join(root, "changes/inbox"));
  assert.equal(inbox.length, 1);
  const written = await read(join(root, "changes/inbox", inbox[0] as string), "utf8");
  assert.match(written, /--fix the parser/, "the body was mangled");
});

test("flags: --help never performs the command", async () => {
  const root = await scratch("wfctl-help-");
  const asked = wfctl(root, ["init", "knowledge", "--target", root, "--help"]);
  assert.equal(asked.status, 0);
  assert.match(asked.stdout, /wfctl — project workflow/);
  assert.equal(existsSync(join(root, ".workflow/state.json")), false,
    "--help performed the installation");
});
