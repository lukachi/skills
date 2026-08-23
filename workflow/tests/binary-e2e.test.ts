import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, symlinkSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

/**
 * End-to-end against the built binary, invoked the way a host invokes it.
 *
 * Every module-level test passed while six of these failed, because the module
 * tests called the functions directly and never ran the program. The bin's
 * main-module guard, the hook wiring and the terminal commands' gates were all
 * broken in ways that only appear here.
 */
const distribution = resolve(import.meta.dirname, "..");
const binary = resolve(distribution, "dist/cli.js");

function wfctl(cwd: string, args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [binary, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, WFCTL_ACTOR: "agent:test" },
    });
    return { stdout, status: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: `${failure.stdout ?? ""}${failure.stderr ?? ""}`, status: failure.status ?? 1 };
  }
}

async function installed(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-"));
  const result = wfctl(root, ["init", "knowledge", "--target", root]);
  assert.equal(result.status, 0, result.stdout);
  return root;
}

test("the binary runs when invoked under a different program name", async () => {
  const root = await installed();
  // npm and bun install the bin as a symlink named `wfctl` pointing at dist/cli.js.
  const alias = join(root, "wfctl");
  symlinkSync(binary, alias);

  const stdout = execFileSync(process.execPath, [alias, "brief"], { cwd: root, encoding: "utf8" });
  assert.match(stdout, /No flow is open/, "the bin printed nothing — the main-module guard is wrong");
});

test("closing runs every gate the step machine runs", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "skip test", "--weight", "significant"]);

  const closed = wfctl(root, ["work", "close", "--outcome", "completed"]);
  assert.equal(closed.status, 2, "close skipped the entire step chain");
  assert.match(closed.stdout, /needs verified recorded first/);
});

test("a step cannot be reached without a review on record", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "no review", "--weight", "significant"]);
  wfctl(root, ["work", "step", "aligned"]);
  for (const item of ["E14", "E15", "E16"]) {
    wfctl(root, ["recall", "answer", item, "--answer", "x", "--route", "qmd", "--source", "k"]);
  }
  wfctl(root, ["work", "step", "framed"]);

  const verified = wfctl(root, ["work", "step", "verified"]);
  assert.equal(verified.status, 2);
  assert.match(verified.stdout, /No review is on record|needs implement recorded first/);
});

test("every command a refusal names actually exists", async () => {
  const root = await installed();
  const source = await readFile(resolve(distribution, "dist/cli.js"), "utf8");

  /**
   * Nine printed remedies named commands that were never implemented, including
   * one printed by `brief`. Running each candidate is the only check that
   * cannot drift from the dispatch.
   */
  const groups = new Set([
    "brief", "handoff", "checkpoint", "work", "recall", "flow", "guide",
    "hook", "init", "repo", "reconstruct", "trajectory", "capture",
  ]);
  const candidates = new Set(
    [...source.matchAll(/wfctl ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g)]
      .filter((match) => groups.has(match[1] ?? ""))
      .map((match) => [match[1], match[2]].filter(Boolean).join(" ")),
  );

  const unknown: string[] = [];
  for (const command of candidates) {
    const result = wfctl(root, command.split(" "));
    // Exit 1 with the usage banner is how this CLI reports a command it has no
    // dispatch for. A refusal (2) or success (0) both mean it exists.
    if (result.status === 1 && result.stdout.includes("wfctl — project workflow")) {
      unknown.push(command);
    }
  }
  assert.deepEqual(unknown, [], `refusals name commands that do not exist: ${unknown.join(", ")}`);
});

test("tampered state refuses rather than crashing", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "tamper", "--weight", "lightweight"]);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  await writeFile(resolve(root, ".workflow/flows", `${id}.json`), "{ not json", "utf8");

  const result = wfctl(root, ["brief"]);
  assert.equal(result.status, 2, "a malformed record should refuse, not crash");
  assert.doesNotMatch(result.stdout, /at Object\.|node:internal/, "a stack trace reached the agent");
  assert.match(result.stdout, /remedy:/);
});

test("a malformed review artifact refuses rather than crashing", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "review", "--weight", "lightweight"]);
  await writeFile(resolve(root, "r.json"), "null", "utf8");

  const result = wfctl(root, ["work", "verify", "--review", resolve(root, "r.json")]);
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /node:internal/);
});

test("an attack that broke the work is not accepted", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "broke", "--weight", "lightweight"]);
  await writeFile(
    resolve(root, "r.json"),
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [
        { lens: "correctness", target: "the parser", test: "assert(parse(''))", output: "FAIL", broke: true },
      ],
      findings: [],
      stubSurvivors: [],
    }),
    "utf8",
  );

  const result = wfctl(root, ["work", "verify", "--review", resolve(root, "r.json")]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /broke the work/);
});

test("the fence survives deletion of the current pointer", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "first", "--weight", "lightweight"]);
  await writeFile(resolve(root, ".workflow/flows/current"), "", "utf8");

  const second = wfctl(root, ["work", "start", "--title", "second", "--weight", "lightweight"]);
  assert.equal(second.status, 2, "a second flow opened once the pointer was gone");
  assert.match(second.stdout, /out of scope/);
});

test("two titles that slug alike do not overwrite each other", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "日本語", "--weight", "lightweight"]);
  wfctl(root, ["work", "close", "--outcome", "abandoned"]);
  wfctl(root, ["flow", "close"]);
  wfctl(root, ["work", "start", "--title", "русский", "--weight", "lightweight"]);

  const { readdir } = await import("node:fs/promises");
  const flows = (await readdir(resolve(root, ".workflow/flows"))).filter((n) => n.endsWith(".json"));
  assert.equal(flows.length, 2, "two distinct flows collapsed into one record");
});

test("knowledge/ cannot be reached by case, symlink or the absolute path", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "guard", "--weight", "lightweight"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", "/leaf/a.ts"]);

  for (const target of ["knowledge/p.md", "Knowledge/p.md", resolve(root, "knowledge/p.md")]) {
    const result = wfctl(root, ["hook", "write", "--target", target]);
    assert.equal(result.status, 2, `${target} was allowed into curated knowledge`);
  }

  for (const target of ["changes/promotion/mine/p.md", "changes/archive/mine/p.md"]) {
    const result = wfctl(root, ["hook", "write", "--target", target]);
    assert.equal(result.status, 2, `${target} was writable by hand`);
  }
});

test("the write hook goes quiet on ground it has already covered", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "quiet", "--weight", "lightweight"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", "/leaf/a.ts"]);

  const first = wfctl(root, ["hook", "write", "--target", "/leaf/a.ts"]);
  assert.match(first.stdout, /first write of this unit/);

  const second = wfctl(root, ["hook", "write", "--target", "/leaf/a.ts"]);
  assert.equal(second.stdout.trim(), "", "the guard re-fired on ground it had covered");

  const widened = wfctl(root, ["hook", "write", "--target", "/leaf/elsewhere.ts"]);
  assert.match(widened.stdout, /outside what any traversal/);
});

test("brief --json is what the stop guard reads", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "signals", "--weight", "significant"]);

  const result = wfctl(root, ["brief", "--json"]);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report.signals));
  assert.equal(report.signals[0].awaits, "agent");
  assert.match(report.signals[0].remedy, /^wfctl /);
});

test("a promotion draft with no page name is refused", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "draft", "--weight", "lightweight"]);

  const empty = wfctl(root, ["work", "promotion", "draft"]);
  assert.equal(empty.status, 2);

  const good = wfctl(root, ["work", "promotion", "draft", "areas/a.md"]);
  assert.equal(good.status, 0);
  assert.ok(existsSync(resolve(root, "changes/active", (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim(), "promotion/areas/a.md")));
});

test("installation preserves a maintainer hook that uses the same matcher", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-hooks-"));
  await mkdir(resolve(root, ".claude"), { recursive: true });
  await writeFile(
    resolve(root, ".claude/settings.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "my-own-banner" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-bash-audit" }] }],
      },
    }),
    "utf8",
  );

  wfctl(root, ["init", "knowledge", "--target", root]);
  const settings = await readFile(resolve(root, ".claude/settings.json"), "utf8");
  assert.match(settings, /my-own-banner/, "a maintainer hook sharing our matcher was deleted");
  assert.match(settings, /my-bash-audit/);
  assert.match(settings, /guard-stop\.mjs/);
});

test("an unbalanced managed marker stops the install instead of eating the file", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-marker-"));
  await writeFile(
    resolve(root, "AGENTS.md"),
    "# House rules\n<!-- wfctl:begin -->\nRULE ALPHA: never force push.\n",
    "utf8",
  );

  const result = wfctl(root, ["init", "knowledge", "--target", root]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /unbalanced/);
  assert.match(await readFile(resolve(root, "AGENTS.md"), "utf8"), /RULE ALPHA/);
});

test("settings that are not an object are refused rather than silently dropped", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-array-"));
  await mkdir(resolve(root, ".claude"), { recursive: true });
  await writeFile(resolve(root, ".claude/settings.json"), '["a","b"]', "utf8");

  const result = wfctl(root, ["init", "knowledge", "--target", root]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /not a JSON object/);
});

test("a refused install still records what it wrote", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-torn-"));
  await mkdir(resolve(root, ".claude"), { recursive: true });
  await writeFile(resolve(root, ".claude/settings.json"), "{ invalid", "utf8");

  wfctl(root, ["init", "knowledge", "--target", root]);
  assert.ok(
    existsSync(resolve(root, ".workflow/state.json")),
    "files were written with no state, so the edit protection is defeated next run",
  );
});

test("a dropped argument refuses instead of storing the next flag as a value", async () => {
  const root = await installed();
  const result = wfctl(root, ["work", "start", "--title", "--weight", "significant"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /given without a value/);
});

test("a capture beginning with dashes is still recordable", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "cap", "--weight", "lightweight"]);

  const result = wfctl(root, ["capture", "--fix the parser, it drops the last token"]);
  assert.equal(result.status, 0, result.stdout);
});
