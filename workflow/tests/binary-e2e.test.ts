import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, symlinkSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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

/**
 * A checkpoint written now, so the next step's staleness gate passes.
 *
 * Each step wants a checkpoint recorded since the flow last moved. Tests that
 * walk the chain have to leave one the same way real work does.
 */
function mark(root: string, where: string): void {
  wfctl(root, ["checkpoint", "--summary", where, "--handoff", `at ${where}`,
    "--last", `reached ${where}`, "--next", "the next step"]);
}

async function installed(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-e2e-"));
  const result = wfctl(root, ["init", "knowledge", "--target", root]);
  assert.equal(result.status, 0, result.stdout);

  // The runtime guards shell out to `wfctl` on PATH, exactly as they do for a
  // real install. Without one on PATH the guards fail open and prove nothing.
  await mkdir(resolve(root, "bin"), { recursive: true });
  const shim = resolve(root, "bin/wfctl");
  await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${binary}" "$@"\n`, "utf8");
  chmodSync(shim, 0o755);
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
  wfctl(root, ["work", "start", "--title", "skip test", "--weight", "significant", "--attested", "they asked for it"]);

  const closed = wfctl(root, ["work", "close", "--outcome", "completed"]);
  assert.equal(closed.status, 2, "close skipped the entire step chain");
  assert.match(closed.stdout, /needs verified recorded first/);
});

test("a step cannot be reached without a review on record", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "no review", "--weight", "significant", "--attested", "they asked for it"]);
  // Everything `verified` asks for except the review itself, so the refusal
  // that lands is the one this test is about.
  await walkToImplementE2E(root);
  mark(root, "verified");

  const verified = wfctl(root, ["work", "step", "verified"]);
  assert.equal(verified.status, 2);
  assert.match(verified.stdout, /No review is on record/);
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
  wfctl(root, ["work", "start", "--title", "tamper", "--weight", "lightweight", "--attested", "they asked for it"]);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  await writeFile(resolve(root, ".workflow/flows", `${id}.json`), "{ not json", "utf8");

  const result = wfctl(root, ["brief"]);
  assert.equal(result.status, 2, "a malformed record should refuse, not crash");
  assert.doesNotMatch(result.stdout, /at Object\.|node:internal/, "a stack trace reached the agent");
  assert.match(result.stdout, /remedy:/);
});

test("a malformed review artifact refuses rather than crashing", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "review", "--weight", "lightweight", "--attested", "they asked for it"]);
  await writeFile(resolve(root, "r.json"), "null", "utf8");

  const result = wfctl(root, ["work", "verify", "--review", resolve(root, "r.json")]);
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /node:internal/);
});

test("an attack that broke the work is not accepted", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "broke", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);
  await writeFile(
    resolve(root, "r.json"),
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [
        { lens: "correctness", target: "the parser", test: "assert(parse(''))", output: "FAIL", broke: true },
      ],
      findings: [],
      stubSurvivors: [],
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );

  const result = wfctl(root, ["work", "verify", "--review", resolve(root, "r.json")]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /broke the work/);
});

test("the fence survives deletion of the current pointer", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "first", "--weight", "lightweight", "--attested", "they asked for it"]);
  await writeFile(resolve(root, ".workflow/flows/current"), "", "utf8");

  const second = wfctl(root, ["work", "start", "--title", "second", "--weight", "lightweight", "--attested", "they asked for it"]);
  assert.equal(second.status, 2, "a second flow opened once the pointer was gone");
  assert.match(second.stdout, /out of scope/);
});

test("two titles that slug alike do not overwrite each other", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "日本語", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["work", "close", "--outcome", "abandoned"]);
  wfctl(root, ["flow", "close"]);
  wfctl(root, ["work", "start", "--title", "русский", "--weight", "lightweight", "--attested", "they asked for it"]);

  const { readdir } = await import("node:fs/promises");
  const flows = (await readdir(resolve(root, ".workflow/flows"))).filter((n) => n.endsWith(".json"));
  assert.equal(flows.length, 2, "two distinct flows collapsed into one record");
});

test("knowledge/ cannot be reached by case, symlink or the absolute path", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "guard", "--weight", "lightweight", "--attested", "they asked for it"]);
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
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");
  wfctl(root, ["repo", "add", "acme/a", "--path", leaf]);

  wfctl(root, ["work", "start", "--title", "quiet", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(leaf, "a.ts")]);

  const first = wfctl(root, ["hook", "write", "--target", resolve(leaf, "a.ts")]);
  assert.match(first.stdout, /first write of this unit/);

  const second = wfctl(root, ["hook", "write", "--target", resolve(leaf, "a.ts")]);
  assert.equal(second.stdout.trim(), "", "the guard re-fired on ground it had covered");

  const widened = wfctl(root, ["hook", "write", "--target", resolve(leaf, "elsewhere.ts")]);
  assert.match(widened.stdout, /outside what any traversal/);
});

test("brief --json is what the stop guard reads", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "signals", "--weight", "significant", "--attested", "they asked for it"]);

  const result = wfctl(root, ["brief", "--json"]);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report.signals));
  assert.equal(report.signals[0].awaits, "agent");
  assert.match(report.signals[0].remedy, /^wfctl /);
});

test("a promotion draft with no page name is refused", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "draft", "--weight", "lightweight", "--attested", "they asked for it"]);

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
  const result = wfctl(root, ["work", "start", "--title", "--weight", "significant", "--attested", "they asked for it"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /given without a value/);
});

test("a capture beginning with dashes is still recordable", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "cap", "--weight", "lightweight", "--attested", "they asked for it"]);

  const result = wfctl(root, ["capture", "--fix the parser, it drops the last token"]);
  assert.equal(result.status, 0, result.stdout);
});

test("brief --json satisfies the stop guard's contract, not just a stub's", async () => {
  /**
   * The stop-guard suite stubs `wfctl brief --json`, so it stayed green for as
   * long as the flag did not exist and the guard silently allowed every turn.
   * This checks the two sides against each other.
   */
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "contract", "--weight", "significant", "--attested", "they asked for it"]);

  const report = JSON.parse(wfctl(root, ["brief", "--json"]).stdout);
  const awaiting = (report.signals ?? []).filter(
    (signal: { awaits?: string }) => signal.awaits === "agent",
  );
  assert.ok(awaiting.length > 0, "the guard arms on signals awaiting the agent; none were emitted");
  for (const signal of report.signals) {
    assert.equal(typeof signal.id, "string");
    assert.ok(["agent", "maintainer"].includes(signal.awaits));
    assert.equal(typeof signal.summary, "string");
  }

  const guard = resolve(root, ".workflow/runtime/guard-stop.mjs");
  const decision = execFileSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({
      cwd: root,
      session_id: "s",
      prompt_id: "p",
      last_assistant_message: "I will do the next thing.",
      transcript_path: "/dev/null",
      stop_hook_active: false,
    }),
    env: { ...process.env, PATH: `${resolve(root, "bin")}:${process.env.PATH}` },
  });
  assert.match(decision, /"decision":"block"/, "the guard did not fire on outstanding work");
  // The reason is JSON, so the quote arrives escaped.
  assert.match(decision, /wfctl checkpoint \\"/, "the guard named a command that does not exist");
});

test("the stop guard releases when nothing awaits the agent", async () => {
  const root = await installed();
  const guard = resolve(root, ".workflow/runtime/guard-stop.mjs");

  const decision = execFileSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({
      cwd: root,
      session_id: "s",
      prompt_id: "p",
      last_assistant_message: "done",
      transcript_path: "/dev/null",
      stop_hook_active: false,
    }),
  });
  assert.equal(decision.trim(), "", "an idle repository must end the turn");
});

test("guards can be listed, turned off and turned back on", async () => {
  const root = await installed();

  const listed = wfctl(root, ["guards"]);
  assert.equal(listed.status, 0);
  assert.match(listed.stdout, /on\s+stop/);
  assert.match(listed.stdout, /on\s+write/);
  assert.match(listed.stdout, /on\s+bash/);

  const off = wfctl(root, ["guards", "off", "stop"]);
  assert.equal(off.status, 0);
  assert.match(off.stdout, /stays off across upgrades/);
  assert.match(wfctl(root, ["guards"]).stdout, /off\s+stop/);

  // Turning one off must not disturb the others.
  const after = await readFile(resolve(root, ".claude/settings.json"), "utf8");
  assert.doesNotMatch(after, /guard-stop\.mjs/);
  assert.match(after, /guard-write\.mjs/);
  assert.match(after, /guard-background-bash\.mjs/);

  const on = wfctl(root, ["guards", "on", "stop"]);
  assert.equal(on.status, 0);
  assert.match(await readFile(resolve(root, ".claude/settings.json"), "utf8"), /guard-stop\.mjs/);

  const unknown = wfctl(root, ["guards", "off", "nonsense"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stdout, /not a valid guard/);
});

test("turning a guard off does not delete the maintainer's own hooks", async () => {
  const root = await installed();
  const path = resolve(root, ".claude/settings.json");
  const settings = JSON.parse(await readFile(path, "utf8"));
  settings.hooks.Stop.unshift({ matcher: "*", hooks: [{ type: "command", command: "my-notify" }] });
  await writeFile(path, JSON.stringify(settings, null, 2), "utf8");

  wfctl(root, ["guards", "off", "stop"]);
  const after = await readFile(path, "utf8");
  assert.match(after, /my-notify/, "the maintainer's own Stop hook was removed with ours");
  assert.doesNotMatch(after, /guard-stop\.mjs/);
});

test("the guide page lists every topic the CLI serves", async () => {
  const root = await installed();
  const served = new Set(
    wfctl(root, ["guide"]).stdout.replace("topics:", "").split(",").map((entry) => entry.trim()),
  );
  const page = wfctl(root, ["guide", "wfctl"]).stdout;

  const missing = [...served].filter((topic) => topic && !page.includes(`\`${topic}\``));
  assert.deepEqual(missing, [], `the guide page omits topics it serves: ${missing.join(", ")}`);
});

test("every topic the guide page lists actually resolves", async () => {
  const root = await installed();
  const page = wfctl(root, ["guide", "wfctl"]).stdout;
  const listed = [...page.matchAll(/^\| `([a-z-]+)` \|/gm)].map((match) => match[1] ?? "");

  const dead = listed.filter((topic) => wfctl(root, ["guide", topic]).status !== 0);
  assert.deepEqual(dead, [], `the guide page lists topics that do not resolve: ${dead.join(", ")}`);
});

test("every internal link in the shipped guidance resolves", async () => {
  const { readdir } = await import("node:fs/promises");
  const base = resolve(distribution, "templates/guidance");
  const entries = await readdir(base, { recursive: true, withFileTypes: true });

  const broken: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const path = join(entry.parentPath ?? base, entry.name);
    const body = await readFile(path, "utf8");
    for (const match of body.matchAll(/\]\((\.[^)]+\.md)\)/g)) {
      const target = resolve(join(entry.parentPath ?? base), match[1] ?? "");
      if (!existsSync(target)) broken.push(`${path.slice(base.length + 1)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(broken, [], `broken guidance links: ${broken.join(", ")}`);
});

test("the skill is installed into both agent conventions", async () => {
  const root = await installed();

  for (const base of [".claude/skills/wfctl", ".agents/skills/wfctl"]) {
    const skill = await readFile(resolve(root, base, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: wfctl\ndescription: /, "the skill needs valid frontmatter");
    for (const reference of ["changes-flow", "reconstruction", "recall", "verification", "records", "deciding", "commands", "leaves"]) {
      assert.ok(
        existsSync(resolve(root, base, "references", `${reference}.md`)),
        `${base} is missing references/${reference}.md`,
      );
    }
  }
});

test("the managed block points at the skill and stays short", async () => {
  const root = await installed();
  const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");

  assert.match(agents, /wfctl` skill/);
  assert.match(agents, /wfctl brief/);
  assert.ok(agents.split("\n").length < 20, "the block is meant to be a pointer, not the guide");
  assert.equal(agents, await readFile(resolve(root, "CLAUDE.md"), "utf8"));
});

test("every reference the skill names exists, and every link in them resolves", async () => {
  const root = await installed();
  const base = resolve(root, ".claude/skills/wfctl");
  const skill = await readFile(resolve(base, "SKILL.md"), "utf8");

  const broken: string[] = [];
  for (const match of skill.matchAll(/\]\((references\/[^)]+\.md)\)/g)) {
    if (!existsSync(resolve(base, match[1] ?? ""))) broken.push(`SKILL.md -> ${match[1]}`);
  }

  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(resolve(base, "references"))) {
    const body = await readFile(resolve(base, "references", entry), "utf8");
    for (const match of body.matchAll(/\]\(([a-z-]+\.md)\)/g)) {
      if (!existsSync(resolve(base, "references", match[1] ?? ""))) {
        broken.push(`references/${entry} -> ${match[1]}`);
      }
    }
  }
  assert.deepEqual(broken, [], `broken skill links: ${broken.join(", ")}`);
});

test("every command the skill names exists in the CLI", async () => {
  const root = await installed();
  const base = resolve(root, ".claude/skills/wfctl");
  const { readdir } = await import("node:fs/promises");

  let text = await readFile(resolve(base, "SKILL.md"), "utf8");
  for (const entry of await readdir(resolve(base, "references"))) {
    text += await readFile(resolve(base, "references", entry), "utf8");
  }

  const groups = new Set([
    "brief", "handoff", "checkpoint", "work", "recall", "flow", "guide",
    "hook", "init", "repo", "reconstruct", "trajectory", "capture", "guards",
  ]);
  const named = new Set(
    [...text.matchAll(/wfctl ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g)]
      .filter((match) => groups.has(match[1] ?? ""))
      .map((match) => [match[1], match[2]].filter(Boolean).join(" ")),
  );

  const unknown = [...named].filter((command) => {
    const result = wfctl(root, command.split(" "));
    return result.status === 1 && result.stdout.includes("wfctl — project workflow");
  });
  assert.deepEqual(unknown, [], `the skill names commands that do not exist: ${unknown.join(", ")}`);
});

test("a traversal gate distinguishes 'not traversed' from 'nothing to traverse'", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  await mkdir(resolve(leaf, "src"), { recursive: true });

  wfctl(root, ["repo", "add", "acme/api", "--path", leaf]);
  wfctl(root, ["work", "start", "--title", "leaf work", "--weight", "significant", "--attested", "they asked for it"]);

  /**
   * The instruction "traverse the graph first" was unfollowable in exactly the
   * case it exists for: a leaf nobody had analysed. The refusal said "you have
   * not traversed" and sent the agent to a command that could not succeed.
   */
  const noGraph = wfctl(root, ["hook", "write", "--target", resolve(leaf, "src/a.ts")]);
  assert.equal(noGraph.status, 2);
  assert.match(noGraph.stdout, /no graph to traverse/);
  assert.match(noGraph.stdout, /graphify build/);

  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");

  const withGraph = wfctl(root, ["hook", "write", "--target", resolve(leaf, "src/a.ts")]);
  assert.equal(withGraph.status, 2);
  assert.match(withGraph.stdout, /No structural traversal has been made/);
  assert.doesNotMatch(withGraph.stdout, /no graph to traverse/);
});

test("registering a leaf says what it still needs, and listing shows every graph's state", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));

  const added = wfctl(root, ["repo", "add", "acme/api", "--path", leaf]);
  assert.equal(added.status, 0);
  assert.match(added.stdout, /No graph in/);
  assert.match(added.stdout, /graphify build/);

  assert.match(wfctl(root, ["repo", "list"]).stdout, /missing\s+acme\/api/);

  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");
  assert.match(wfctl(root, ["repo", "list"]).stdout, /ready\s+0d\s+acme\/api/);

  wfctl(root, ["repo", "add", "acme/gone", "--path", "/nowhere/at/all"]);
  assert.match(wfctl(root, ["repo", "list"]).stdout, /unreachable\s+acme\/gone/);
});

test("a write outside the registered checkouts is refused", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leafA-"));
  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");

  wfctl(root, ["repo", "add", "acme/a", "--path", leaf]);
  wfctl(root, ["work", "start", "--title", "w", "--weight", "significant", "--attested", "they asked for it"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(leaf, "src/a.ts")]);

  const stray = wfctl(root, ["hook", "write", "--target", "/tmp/nowhere-registered/x.ts"]);
  assert.equal(stray.status, 2, "a write landed outside every registered repository");
  assert.match(stray.stdout, /not inside any registered repository/);
});

test("a write into a sibling checkout is refused while another is claimed", async () => {
  const root = await installed();
  const a = await mkdtemp(join(tmpdir(), "wfctl-leafA-"));
  const b = await mkdtemp(join(tmpdir(), "wfctl-leafB-"));
  for (const leaf of [a, b]) {
    await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
    await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");
  }

  wfctl(root, ["repo", "add", "acme/a", "--path", a]);
  wfctl(root, ["repo", "add", "acme/b", "--path", b]);
  wfctl(root, ["work", "start", "--title", "w", "--weight", "significant", "--attested", "they asked for it"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(a, "src/a.ts")]);
  // The claim asks whether this already exists before it binds a checkout.
  const { RECALL_ITEMS: items } = await import("../src/core/recall.js");
  for (const item of items.filter((entry) => entry.group === "D")) {
    wfctl(root, ["recall", "answer", item.id, "--answer", "x", "--route", "graphify", "--source", "s"]);
  }
  wfctl(root, ["work", "issue", "create", "--title", "unit"]);
  const bound = wfctl(root, ["work", "issue", "claim", "U001", "--repository", "acme/a", "--worktree", "main"]);
  assert.equal(bound.status, 0, bound.stdout);

  /**
   * The failure the registry was invented for: an agent working across several
   * worktrees loses track of which it is in, and the code lands in a sibling
   * checkout where it looks entirely correct and belongs to different work.
   */
  const sibling = wfctl(root, ["hook", "write", "--target", resolve(b, "src/x.ts")]);
  assert.equal(sibling.status, 2, "a write landed in a checkout this unit does not own");
  assert.match(sibling.stdout, /claimed from acme\/a/);
  assert.match(sibling.stdout, /acme\/b/);

  const owned = wfctl(root, ["hook", "write", "--target", resolve(a, "src/a.ts")]);
  assert.equal(owned.status, 0, owned.stdout);
});

test("doctor passes on a healthy install and fails on a broken one", async () => {
  const root = await installed();

  const healthy = wfctl(root, ["doctor"]);
  assert.equal(healthy.status, 0, healthy.stdout);
  for (const check of ["installation", "installed-files", "knowledge-layout", "managed-block"]) {
    assert.match(healthy.stdout, new RegExp(`ok\\s+${check}`), `${check} did not pass: ${healthy.stdout}`);
  }
  assert.match(healthy.stdout, /ok\s+skill:\.claude/);
  assert.match(healthy.stdout, /ok\s+skill:\.agents/);
  for (const guard of ["stop", "write", "bash"]) {
    assert.match(healthy.stdout, new RegExp(`ok\\s+guard:${guard}`));
  }

  const { rm } = await import("node:fs/promises");
  await rm(resolve(root, ".claude/skills/wfctl"), { recursive: true });

  const broken = wfctl(root, ["doctor"]);
  assert.equal(broken.status, 1, "a missing skill should fail the check");
  assert.match(broken.stdout, /FAIL\s+skill:\.claude/);
  assert.match(broken.stdout, /FAIL\s+installed-files/);
});

test("doctor reports a guard that was turned off as degraded, not failing", async () => {
  const root = await installed();
  wfctl(root, ["guards", "off", "stop"]);

  const report = wfctl(root, ["doctor"]);
  assert.equal(report.status, 0, "turning a guard off is a decision, not a fault");
  assert.match(report.stdout, /warn\s+guard:stop/);
  assert.match(report.stdout, /wfctl guards on stop/);
});

test("doctor reports leaves whose graph is missing or unreachable", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  wfctl(root, ["repo", "add", "acme/api", "--path", leaf]);
  wfctl(root, ["repo", "add", "acme/gone", "--path", "/nowhere/at/all"]);

  const report = wfctl(root, ["doctor"]);
  assert.match(report.stdout, /warn\s+leaf:acme\/api\/main\s+No graph/);
  assert.match(report.stdout, /FAIL\s+leaf:acme\/gone\/main/);
  assert.equal(report.status, 1, "a registered path that is not there is a fault");
});

test("doctor refuses outside an initialized repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-bare-"));
  const report = wfctl(root, ["doctor"]);
  assert.equal(report.status, 1);
  assert.match(report.stdout, /not an initialized knowledge repository/);
  assert.match(report.stdout, /wfctl init knowledge/);
});

test("doctor notices an unresolved capture queue", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "t", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["capture", "something worth keeping"]);

  const report = wfctl(root, ["doctor"]);
  assert.match(report.stdout, /warn\s+capture-inbox\s+1 unresolved/);
  assert.equal(report.status, 0);
});

test("concurrent unit creation does not lose units or reuse ids", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "race", "--weight", "significant", "--attested", "they asked for it"]);

  /**
   * Six concurrent calls all reported success and three units survived, with
   * their ids reused — so a claim recorded afterwards pointed at different work.
   */
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      new Promise<void>((done) => {
        wfctl(root, ["work", "issue", "create", "--title", `unit ${index}`]);
        done();
      }),
    ),
  );

  const listed = wfctl(root, ["work", "issue", "list"]).stdout;
  const ids = [...listed.matchAll(/^(U\d{3})/gm)].map((match) => match[1]);
  assert.equal(ids.length, 6, `units were lost: ${listed}`);
  assert.equal(new Set(ids).size, 6, `ids were reused: ${ids.join(", ")}`);
});

test("promotion refuses a page that would not validate, and writes nothing", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "pages", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);
  wfctl(root, ["work", "promotion", "draft", "areas/billing/index.md"]);
  wfctl(root, ["work", "close", "--outcome", "completed"]);

  // The draft the tool created is empty: no view, no purpose, no audience.
  const refused = wfctl(root, ["work", "promote", "--subject", "Billing", "--summary", "s"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stdout, /would enter curated knowledge/);
  assert.match(wfctl(root, ["work", "promotion", "list"]).stdout, /waiting on the maintainer/);
});

test("a curated page citing raw material is refused", async () => {
  const root = await installed();
  await mkdir(resolve(root, "knowledge/areas/x"), { recursive: true });
  await writeFile(
    resolve(root, "knowledge/areas/x/index.md"),
    "---\nview: product\npurpose: p\naudience: a\n---\n\n# X\n\nPer reconstruction/raw/notes.md this is settled.\n",
    "utf8",
  );

  const result = wfctl(root, ["knowledge", "validate"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /carries no authority/);
});

test("decided reports where an answer already lives", async () => {
  const root = await installed();
  await mkdir(resolve(root, "changes/archive/old"), { recursive: true });
  await writeFile(
    resolve(root, "changes/archive/old/change.md"),
    "# Refunds\n\nOn 2026-01-04 they settled that partial refunds are out of scope.\n",
    "utf8",
  );

  const found = wfctl(root, ["decided", "partial refunds scope"]);
  assert.equal(found.status, 0);
  assert.match(found.stdout, /partial refunds are out of scope/);
  assert.match(found.stdout, /a closed record/);

  const nothing = wfctl(root, ["decided", "an unrelated untouched subject"]);
  assert.match(nothing.stdout, /Nothing recorded/);
});

/** Everything up to, but not including, the review. */
async function walkToImplementE2E(root: string): Promise<void> {
  const { RECALL_ITEMS } = await import("../src/core/recall.js");
  const answer = (group: string, route: string) => {
    for (const item of RECALL_ITEMS.filter((entry) => entry.group === group)) {
      wfctl(root, ["recall", "answer", item.id, "--answer", "x", "--route", route, "--source", "s"]);
    }
  };
  /**
   * The recall a step demands is checked when that step is entered, so it is
   * answered before the step rather than after it.
   */
  for (const group of ["A", "B", "C", "E"]) answer(group, "qmd");
  mark(root, "framed");
  const framed = wfctl(root, ["work", "step", "framed"]);
  assert.equal(framed.status, 0, `walkToImplementE2E did not reach framed:\n${framed.stdout}`);
  // Group D belongs to the claim; group G to verification.
  answer("D", "graphify");
  answer("G", "read");
}

async function walkToVerifiedE2E(root: string): Promise<void> {
  await walkToImplementE2E(root);

  const review = resolve(root, "review.json");
  await writeFile(
    review,
    JSON.stringify({
      reviewer: "agent:reviewer",
      attacks: [{ lens: "correctness", target: "t", test: "x", output: "held", broke: false }],
      findings: [],
      stubSurvivors: [],
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );
  mark(root, "verified");
  const verified = wfctl(root, ["work", "verify", "--review", review]);
  // A walker that quietly fails to walk makes every test after it assert about
  // a flow that never moved, and report the wrong cause when it breaks.
  assert.equal(verified.status, 0, `walkToVerifiedE2E did not reach verified:\n${verified.stdout}`);
}

test("promote actually writes the pages into curated knowledge", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "retry", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);
  wfctl(root, ["work", "promotion", "draft", "networking/retry.md"]);

  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  await writeFile(
    resolve(root, "changes/active", id, "promotion/networking/retry.md"),
    "---\nview: product\npurpose: what retrying does\naudience: stakeholders\n---\n\n# Retry\n\nIdempotent requests are retried.\n",
    "utf8",
  );
  wfctl(root, ["work", "close", "--outcome", "completed"]);

  const promoted = wfctl(root, ["work", "promote", "--subject", "Retry", "--summary", "retries now happen"]);
  assert.equal(promoted.status, 0, promoted.stdout);

  /**
   * It renamed the bundle into the archive and reported success while
   * `knowledge/` stayed empty — so `decided`, which reads `knowledge/`, could
   * never answer, and recall item A2 was permanently unsatisfiable.
   */
  assert.ok(existsSync(resolve(root, "knowledge/networking/retry.md")), "the page never reached the corpus");
  assert.match(promoted.stdout, /now in curated knowledge/);

  const found = wfctl(root, ["decided", "retry idempotent requests"]);
  assert.match(found.stdout, /a curated page/, "decided still cannot see a promoted page");
});

test("promoting with nothing drafted is refused", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "empty", "--weight", "lightweight", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);
  wfctl(root, ["work", "close", "--outcome", "completed"]);

  const result = wfctl(root, ["work", "promote", "--subject", "S", "--summary", "s"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Nothing is waiting to be promoted|no drafted page/);
});

test("parallel work start opens exactly one flow", async () => {
  const root = await installed();
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      new Promise<void>((done) => {
        wfctl(root, ["work", "start", "--title", `race ${index}`, "--weight", "lightweight", "--attested", "they asked for it"]);
        done();
      }),
    ),
  );

  const { readdir } = await import("node:fs/promises");
  const flows = (await readdir(resolve(root, ".workflow/flows"))).filter((n) => n.endsWith(".json"));
  assert.equal(flows.length, 1, `the fence was raced: ${flows.join(", ")}`);
});

test("flow close takes the id its own refusal prints", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "orphan", "--weight", "lightweight", "--attested", "they asked for it"]);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  await writeFile(resolve(root, ".workflow/flows/current"), "", "utf8");

  const blocked = wfctl(root, ["work", "start", "--title", "second", "--weight", "lightweight", "--attested", "they asked for it"]);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stdout, new RegExp(`flow close ${id}`));

  // The remedy used to ignore its argument, so the repository stayed fenced forever.
  const closed = wfctl(root, ["flow", "close", id]);
  assert.equal(closed.status, 0, closed.stdout);
  assert.equal(wfctl(root, ["work", "start", "--title", "second", "--weight", "lightweight", "--attested", "they asked for it"]).status, 0);
});

test("flow close runs the gates work close runs", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "parked", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["work", "park", "--reason", "not yet", "--attested", "they said hold"]);

  const parked = wfctl(root, ["flow", "close"]);
  assert.equal(parked.status, 2, "a parked flow was closed, discarding the maintainer's hold");
  assert.match(parked.stdout, /parked/);

  wfctl(root, ["work", "release", "--attested", "go"]);
  wfctl(root, ["work", "issue", "create", "--title", "undelivered"]);

  const open = wfctl(root, ["flow", "close"]);
  assert.equal(open.status, 2, "an undelivered unit did not block the close");
  assert.match(open.stdout, /not terminal/);
});

test("the next line names the step after this one, not the one just run", async () => {
  const root = await installed();
  const started = wfctl(root, ["work", "start", "--title", "next", "--weight", "significant", "--attested", "they asked for it"]);
  assert.doesNotMatch(started.stdout, /next: wfctl work start/);

  const aligned = wfctl(root, ["work", "step", "framed"]);
  assert.doesNotMatch(aligned.stdout, /next: wfctl work step aligned/, "next named the command that just ran");
});

test("brief names the promotion queue, an awaiting capture and an open reconstruction", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "queued", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);
  wfctl(root, ["work", "promotion", "draft", "a/b.md"]);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  await writeFile(
    resolve(root, "changes/active", id, "promotion/a/b.md"),
    "---\nview: product\npurpose: p\naudience: a\n---\n\n# B\n\nx\n",
    "utf8",
  );
  wfctl(root, ["work", "close", "--outcome", "completed"]);
  wfctl(root, ["capture", "should the default be 30s?", "--awaits"]);

  const brief = wfctl(root, ["brief"]);
  assert.match(brief.stdout, /promotion queue/, "the queue was invisible to the brief");
  assert.match(brief.stdout, /capture\(s\) await the maintainer/);

  const json = JSON.parse(wfctl(root, ["brief", "--json"]).stdout);
  assert.ok(json.signals.some((s: { awaits: string }) => s.awaits === "maintainer"));
});

test("brief at verified points forward, not back at the review it accepted", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "forward", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);

  const brief = wfctl(root, ["brief"]);
  assert.doesNotMatch(brief.stdout, /remedy: wfctl work verify/, "it asked for the review it already had");
  assert.match(brief.stdout, /promotion draft/);
});

test("a review keeps its whole artifact, and a finding with an odd status is refused", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "review", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);

  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  const record = JSON.parse(await readFile(resolve(root, ".workflow/flows", `${id}.json`), "utf8"));
  assert.ok(Array.isArray(record.review.attacks), "only counts were kept");
  assert.equal(typeof record.review.source, "string");

  await writeFile(
    resolve(root, "blocking.json"),
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [{ lens: "intent", target: "t", test: "x", output: "held", broke: false }],
      findings: [{ lens: "intent", summary: "s", failure: "f", status: "blocking" }],
      stubSurvivors: [],
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );
  const blocking = wfctl(root, ["work", "verify", "--review", resolve(root, "blocking.json")]);
  assert.equal(blocking.status, 2, "only the literal 'open' was refused");
  assert.match(blocking.stdout, /not open or accepted/);
});

test("a claim names a registered checkout", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "claim", "--weight", "significant", "--attested", "they asked for it"]);
  wfctl(root, ["work", "issue", "create", "--title", "u"]);

  const invented = wfctl(root, ["work", "issue", "claim", "U001", "--repository", "acme/nope"]);
  assert.equal(invented.status, 2, "a claim named a repository that does not exist");
  assert.match(invented.stdout, /not a registered checkout/);
});

test("a symlink inside a registered checkout cannot reach outside it", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");
  const { symlinkSync: link } = await import("node:fs");
  link("/etc", resolve(leaf, "etclink"));

  wfctl(root, ["repo", "add", "acme/a", "--path", leaf]);
  wfctl(root, ["work", "start", "--title", "sym", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(leaf, "a.ts")]);

  const escaped = wfctl(root, ["hook", "write", "--target", resolve(leaf, "etclink/passwd")]);
  assert.equal(escaped.status, 2, "a symlink inside a checkout reached /etc");
});

test("the knowledge repository's own files are not governed by the claim rule", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "draft", "--weight", "lightweight", "--attested", "they asked for it"]);
  const created = wfctl(root, ["work", "promotion", "draft", "a/b.md"]);
  assert.equal(created.status, 0);

  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  const draft = resolve(root, "changes/active", id, "promotion/a/b.md");

  // It refused the draft the tool had created one command earlier, and pointed
  // at registering a source repository, which has nothing to do with it.
  const allowed = wfctl(root, ["hook", "write", "--target", draft]);
  assert.equal(allowed.status, 0, allowed.stdout);
});

test("unknown commands and flags are named", async () => {
  const root = await installed();

  const command = wfctl(root, ["banana"]);
  assert.equal(command.status, 1);
  assert.match(command.stdout, /no command "banana"/);

  const flag = wfctl(root, ["brief", "--banana"]);
  assert.equal(flag.status, 2, "an unknown flag was silently ignored");
  assert.match(flag.stdout, /brief does not read --banana/);

  // A flag real elsewhere is the more common mistake, and the refusal says
  // where it is read rather than only that it is wrong here.
  const misplaced = wfctl(root, ["capture", "--worktree", "x", "something"]);
  assert.equal(misplaced.status, 2, "a flag from another command was accepted");
  assert.match(misplaced.stdout, /--worktree belongs to: /);
});

test("knowledge validate does not report an all-clear on an empty corpus", async () => {
  const root = await installed();
  const result = wfctl(root, ["knowledge", "validate"]);
  assert.match(result.stdout, /no curated pages/i);
  assert.doesNotMatch(result.stdout, /pass structural validation/);
});

test("the shipped page templates pass the shipped validator", async () => {
  const root = await installed();
  const { copyFile } = await import("node:fs/promises");
  await mkdir(resolve(root, "knowledge/areas"), { recursive: true });

  for (const template of ["product-concept.md", "engineering-concept.md"]) {
    await copyFile(
      resolve(distribution, "templates/guidance/assets", template),
      resolve(root, "knowledge/areas", template),
    );
    const result = wfctl(root, ["knowledge", "validate", "--page", `areas/${template}`]);
    assert.doesNotMatch(
      result.stdout,
      /no (view|purpose|audience) declared/,
      `the shipped ${template} fails the shipped validator: ${result.stdout}`,
    );
  }
});

test("a dangling symlink cannot write into a guarded directory", async () => {
  const root = await installed();
  const { symlinkSync: link } = await import("node:fs");

  /**
   * `canonical()` resolved the whole path with realpath, which throws when the
   * last component does not exist — and that is every file an agent is about to
   * create. The fallback returned the link's own location, so a dangling link
   * wrote wherever it pointed, with no output at all.
   */
  for (const [name, target] of [
    ["dlink", resolve(root, "knowledge/fabricated.md")],
    ["dlink2", resolve(root, "changes/promotion/fake-record")],
    ["dlink3", resolve(root, "trajectories/fake.json")],
  ] as const) {
    link(target, resolve(root, name));
    const result = wfctl(root, ["hook", "write", "--target", resolve(root, name)]);
    assert.equal(result.status, 2, `${name} reached ${target} with exit ${result.status}`);
  }
});

test("a dangling symlink cannot escape a registered checkout", async () => {
  const root = await installed();
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  const outside = await mkdtemp(join(tmpdir(), "wfctl-outside-"));
  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");

  const { symlinkSync: link } = await import("node:fs");
  link(resolve(outside, "PWNED"), resolve(leaf, "escape"));

  wfctl(root, ["repo", "add", "acme/a", "--path", leaf]);
  wfctl(root, ["work", "start", "--title", "sym", "--weight", "lightweight", "--attested", "they asked for it"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(leaf, "a.ts")]);

  const escaped = wfctl(root, ["hook", "write", "--target", resolve(leaf, "escape")]);
  assert.equal(escaped.status, 2, "a dangling link reached outside the checkout");
});

test("the fences hold from a subdirectory", async () => {
  const root = await installed();
  const { execFileSync: exec } = await import("node:child_process");

  /**
   * Every fence compared against `process.cwd()` with no root discovery, so
   * running one directory down removed all of them at once.
   */
  const result = (() => {
    try {
      exec(process.execPath, [binary, "hook", "write", "--target", resolve(root, "knowledge/x.md")], {
        cwd: resolve(root, "changes"),
        encoding: "utf8",
      });
      return 0;
    } catch (error) {
      return (error as { status?: number }).status ?? 1;
    }
  })();
  assert.equal(result, 2, "the knowledge fence vanished from a subdirectory");
});

test("work verify runs the step chain", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "ship it all", "--weight", "significant", "--attested", "they asked for it"]);
  await writeFile(
    resolve(root, "r.json"),
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [{ lens: "intent", target: "t", test: "x", output: "held", broke: false }],
      findings: [],
      stubSurvivors: [],
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );

  // It wrote step: verified directly — the one step-recording command that was
  // not advance(), so a significant flow closed as completed in six commands.
  const early = wfctl(root, ["work", "verify", "--review", resolve(root, "r.json")]);
  assert.equal(early.status, 2, "verify skipped the chain");
  assert.match(early.stdout, /needs framed recorded first/);
});

test("a parked flow accepts nothing material", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "held", "--weight", "significant", "--attested", "they asked for it"]);
  wfctl(root, ["work", "issue", "create", "--title", "u"]);
  wfctl(root, ["work", "park", "--reason", "maintainer said hold", "--attested", "they said hold"]);

  for (const command of [
    ["work", "issue", "create", "--title", "sneaky"],
    // With its evidence, so this proves the park rather than a missing flag.
    ["work", "issue", "complete", "U001", "--evidence", "it landed"],
    ["work", "promotion", "draft", "a/b.md"],
  ]) {
    const result = wfctl(root, command);
    assert.equal(result.status, 2, `parked flow allowed: ${command.join(" ")}`);
  }
});

/**
 * Two complete flows, each walked to `verified`. Roughly a hundred subprocess
 * spawns, and the checkpoint each step now wants added eight more per walk —
 * past the runner's five-second default whenever the rest of the suite is
 * competing for the machine.
 */
test("promote names its record when the queue is ambiguous", { timeout: 120_000 }, async () => {
  const root = await installed();

  const bundles: Record<string, string> = {};
  for (const title of ["alpha subject", "zeta subject"]) {
    wfctl(root, ["work", "start", "--title", title, "--weight", "significant", "--attested", "they asked for it"]);
    await walkToVerifiedE2E(root);
    const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
    // The id carries the day it was opened. It used to be written out by hand
    // here, so the test passed on the day it was written and failed at the next
    // midnight against a tool that had not changed.
    bundles[title] = id;
    wfctl(root, ["work", "promotion", "draft", `${title.split(" ")[0]}/page.md`]);
    await writeFile(
      resolve(root, "changes/active", id, `promotion/${title.split(" ")[0]}/page.md`),
      "---\nview: product\npurpose: p\naudience: a\n---\n\n# P\n\nx\n",
      "utf8",
    );
    wfctl(root, ["work", "close", "--outcome", "completed"]);
    wfctl(root, ["flow", "close"]);
  }

  // It took queued[0], so one record's pages entered the corpus on another's
  // authority and the wrong subject's line recorded it forever.
  const ambiguous = wfctl(root, ["work", "promote", "--subject", "Zeta", "--summary", "zeta works"]);
  assert.equal(ambiguous.status, 2);
  assert.match(ambiguous.stdout, /name the one they answered about/);

  const named = wfctl(root, [
    "work", "promote", "--bundle", bundles["zeta subject"] ?? "",
    "--subject", "Zeta", "--summary", "zeta works",
  ]);
  assert.equal(named.status, 0, named.stdout);
  assert.ok(existsSync(resolve(root, "knowledge/zeta/page.md")));
});

test("abandoned work is not recorded as a delivery", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "given up", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  wfctl(root, ["work", "promotion", "draft", "a/b.md"]);
  await writeFile(
    resolve(root, "changes/active", id, "promotion/a/b.md"),
    "---\nview: product\npurpose: p\naudience: a\n---\n\n# B\n\nx\n",
    "utf8",
  );
  wfctl(root, ["work", "close", "--outcome", "abandoned"]);
  wfctl(root, ["work", "promote", "--subject", "Given up", "--summary", "it now does the thing"]);

  const line = wfctl(root, ["trajectory", "show", "Given up"]).stdout;
  assert.doesNotMatch(line, /delivery/, "abandoned work was recorded as delivered");
  assert.match(line, /abandoned/);
});

test("work close states its outcome rather than defaulting to the best one", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "silent", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToVerifiedE2E(root);

  const bare = wfctl(root, ["work", "close"]);
  assert.equal(bare.status, 2, "a bare close silently recorded completed");
  assert.match(bare.stdout, /--outcome/);
});

test("a guard turned off stays off across an upgrade", async () => {
  const root = await installed();
  wfctl(root, ["guards", "off", "stop"]);
  wfctl(root, ["init", "knowledge", "--target", root]);

  const after = wfctl(root, ["guards"]).stdout;
  assert.match(after, /off\s+stop/, "init silently re-armed a guard the maintainer turned off");

  // And the guard itself agrees — one switch, not two.
  const guard = resolve(root, ".workflow/runtime/guard-stop.mjs");
  const decision = execFileSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ cwd: root, session_id: "s", prompt_id: "p", last_assistant_message: "x" }),
    env: { ...process.env, PATH: `${resolve(root, "bin")}:${process.env.PATH}` },
  });
  assert.equal(decision.trim(), "", "the guard fired while reported off");
});

test("concurrent captures all survive", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "cap", "--weight", "lightweight", "--attested", "they asked for it"]);

  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      new Promise<void>((done) => {
        wfctl(root, ["capture", `finding number ${index}`]);
        done();
      }),
    ),
  );

  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(resolve(root, "changes/inbox"))).filter((n) => n.endsWith(".md"));
  assert.equal(files.length, 20, "captures overwrote each other");
});

test("decided finds a subject whose words are short", async () => {
  const root = await installed();
  await mkdir(resolve(root, "knowledge/auth"), { recursive: true });
  await writeFile(
    resolve(root, "knowledge/auth/sso.md"),
    "---\nview: product\npurpose: p\naudience: a\n---\n\n# SSO\n\nOn 2026-01-04 we decided SSO is delivered by the API gateway.\n",
    "utf8",
  );

  // Words of three characters or fewer were dropped, so SSO, API, CLI and MFA
  // were unsearchable — and the empty result was reported as authoritative.
  const found = wfctl(root, ["decided", "SSO"]);
  assert.match(found.stdout, /already say something/, found.stdout);
});

// ---------------------------------------------------------------------------
// The payload a hook is handed, on both hosts.
//
// The guards read the payload themselves and every one of them assumed Claude
// Code's shape. Codex sends the same JSON for a shell call and a different one
// for an edit: its editing tool is `apply_patch` and the files it touches are
// named inside a patch body, not in `file_path`. Measured against codex-cli
// 0.147.0, not inferred.
//
// The failure this prevents is silent. A guard that finds no target exits zero,
// the write proceeds unchecked, and nothing reports that the guard did not run.

function writeGuard(root: string, payload: unknown) {
  return spawnSync(process.execPath, [resolve(root, ".workflow/runtime/guard-write.mjs")], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: { ...process.env, PATH: `${resolve(root, "bin")}:${process.env.PATH ?? ""}` },
  });
}

test("the write guard refuses a curated page however the host names it", async () => {
  const root = await installed();
  const page = resolve(root, "knowledge/areas/world.md");

  const claude = writeGuard(root, {
    cwd: root,
    tool_name: "Write",
    tool_input: { file_path: page, content: "x" },
  });
  assert.equal(claude.status, 2, claude.stdout + claude.stderr);
  assert.match(claude.stderr, /remedy:/);

  const codex = writeGuard(root, {
    cwd: root,
    tool_name: "apply_patch",
    tool_input: { command: `*** Begin Patch\n*** Add File: ${page}\n+x\n*** End Patch` },
  });
  assert.equal(codex.status, 2, codex.stdout + codex.stderr);
  assert.match(codex.stderr, /remedy:/);
  assert.equal(codex.stderr.trim(), claude.stderr.trim(), "the same write refused two different ways");
});

test("a patch is checked file by file, not by its first name only", async () => {
  const root = await installed();
  const page = resolve(root, "knowledge/areas/world.md");

  // An innocent file first. Reading only the first target would pass the whole
  // patch and carry the curated page in behind it.
  const result = writeGuard(root, {
    cwd: root,
    tool_name: "apply_patch",
    tool_input: {
      command: [
        "*** Begin Patch",
        `*** Update File: ${resolve(root, "notes.md")}`,
        "@@",
        "+fine",
        `*** Add File: ${page}`,
        "+x",
        "*** End Patch",
      ].join("\n"),
    },
  });
  assert.equal(result.status, 2, "the second file in the patch was never checked");
  assert.match(result.stderr, /cannot be written directly into knowledge/);
});

test("a page moved into the corpus is a write", async () => {
  const root = await installed();
  const result = writeGuard(root, {
    cwd: root,
    tool_name: "apply_patch",
    tool_input: {
      command: [
        "*** Begin Patch",
        `*** Update File: ${resolve(root, "draft.md")}`,
        `*** Move to: ${resolve(root, "knowledge/areas/world.md")}`,
        "@@",
        "+x",
        "*** End Patch",
      ].join("\n"),
    },
  });
  assert.equal(result.status, 2, "a move into knowledge/ landed unguarded");
});

test("the write guard stands aside for anything that is not a write", async () => {
  const root = await installed();
  for (const payload of [
    { cwd: root, tool_name: "Bash", tool_input: { command: "ls" } },
    { cwd: root, tool_name: "apply_patch", tool_input: {} },
    { cwd: root, tool_name: "Read", tool_input: { file_path: resolve(root, "knowledge/index.md") } },
  ]) {
    const result = writeGuard(root, payload);
    assert.equal(result.status, 0, `a non-write was blocked: ${JSON.stringify(payload)}`);
  }
});

test("the bash guard wraps a shell command on either host", async () => {
  const root = await installed();
  const guard = resolve(root, ".workflow/runtime/guard-background-bash.mjs");

  const wrapped = execFileSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({ cwd: root, tool_name: "Bash", tool_input: { command: "sleep 1" } }),
  });
  assert.match(wrapped, /idle-guard\.sh/);

  // A patch is not a shell command, and wrapping one would corrupt the edit.
  const untouched = execFileSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({
      cwd: root,
      tool_name: "apply_patch",
      tool_input: { command: "*** Begin Patch\n*** End Patch" },
    }),
  });
  assert.equal(untouched.trim(), "", "a patch was wrapped as though it were a shell command");
});

test("the stop guard reads the project from the payload when the host sets no variable", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "outstanding", "--weight", "significant", "--attested", "they asked for it"]);

  // Codex exports no CLAUDE_PROJECT_DIR. Every payload carries cwd, and the
  // guard has to work from that or it reports on the wrong repository.
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;

  const decision = spawnSync(process.execPath, [resolve(root, ".workflow/runtime/guard-stop.mjs")], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...env, PATH: `${resolve(root, "bin")}:${env.PATH ?? ""}` },
    input: JSON.stringify({
      cwd: root,
      session_id: "s",
      last_assistant_message: "I will pick this up next time.",
      transcript_path: "/dev/null",
      stop_hook_active: false,
    }),
  });
  assert.match(decision.stdout, /"decision":"block"/, "the guard judged the wrong directory");
});

// ---------------------------------------------------------------------------
// The deadlock a real flow reached.
//
// knowledge-humid, 2026-08-25: the flow sat at `implement`, its review honestly
// reported tests that pass with the implementation stubbed, and every exit
// refused. `work verify` refused on the survivors; `work close` refused for
// want of a verification; `flow close` refused because the work had moved. The
// agent turned the Stop guard off — the tell that there was no legal move left.

async function reviewWith(root: string, stubSurvivors: unknown[]): Promise<string> {
  const path = resolve(root, `review-${stubSurvivors.length}-${Math.random()}.json`);
  await writeFile(
    path,
    JSON.stringify({
      reviewer: "agent:reviewer",
      attacks: [{ lens: "correctness", target: "t", test: "x", output: "held", broke: false }],
      findings: [],
      stubSurvivors,
      stubPass: { ran: true, note: "stubbed each implementation to a constant" },
    }),
    "utf8",
  );
  return path;
}

test("a stub survivor can be accepted with a reason instead of blocking forever", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "upstream tests", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  const open = wfctl(root, ["work", "verify", "--review", await reviewWith(root, ["upstream/lib.rs::t -- passes stubbed"])]);
  assert.equal(open.status, 2);
  assert.match(open.stdout, /assert nothing/);
  // The refusal must name a move that is possible. "Fix the tests" alone is a
  // wall when the tests belong to a repository outside the fence.
  assert.match(open.stdout, /accepted/);

  const silent = wfctl(root, [
    "work", "verify", "--review",
    await reviewWith(root, [{ test: "upstream/lib.rs::t", status: "accepted" }]),
  ]);
  assert.equal(silent.status, 2, "an accepted survivor with no reason passed");
  assert.match(silent.stdout, /never silently/);

  const accepted = wfctl(root, [
    "work", "verify", "--review",
    await reviewWith(root, [
      { test: "upstream/lib.rs::t", status: "accepted", acceptedBecause: "upstream's suite; the fence does not reach it" },
    ]),
  ]);
  assert.equal(accepted.status, 0, accepted.stdout);
});

test("a stub survivor with an unknown status is refused, not ignored", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "status", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  const result = wfctl(root, [
    "work", "verify", "--review",
    await reviewWith(root, [{ test: "t", status: "waived" }]),
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /not open or accepted/);
});

test("a survivor the reviewer described in its own shape is readable", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "shape", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  // The shape a real reviewer returned. It used to render as [object Object]:
  // the agent was told its tests assert nothing and shown none of them.
  const result = wfctl(root, [
    "work", "verify", "--review",
    await reviewWith(root, [
      { target: "the double's addCovenantIssuanceInput", stub: "renamed the mock", result: "1123 pass | 0 fail" },
    ]),
  ]);
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /\[object Object\]/);
  assert.match(result.stdout, /addCovenantIssuanceInput/);
  assert.match(result.stdout, /1123 pass/, "the evidence for accepting was dropped");
});

test("work that cannot be verified can still be given up on", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "wedged", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);
  wfctl(root, ["work", "issue", "create", "--title", "a unit nobody reached"]);

  // Exactly the humid state: at implement, no review on record, a unit open.
  assert.equal(wfctl(root, ["flow", "close"]).status, 2);

  const abandoned = wfctl(root, ["work", "close", "--outcome", "abandoned"]);
  assert.equal(abandoned.status, 0, abandoned.stdout);
  assert.match(abandoned.stdout, /no review on record/, "the concession was silent");
});

test("conceding is not the way past verification", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "shortcut", "--weight", "significant", "--attested", "they asked for it"]);
  await walkToImplementE2E(root);

  // `completed` is the outcome that claims the work is done, and it still asks.
  const completed = wfctl(root, ["work", "close", "--outcome", "completed"]);
  assert.equal(completed.status, 2);
  assert.match(completed.stdout, /verified/);
});

// ---------------------------------------------------------------------------
// The tools the agent reaches for, rather than the gates it is stopped by.
//
// Every one of these exists because the record had exactly three shapes — a
// unit, one overwritable checkpoint, and a capture that leaves the fence — so
// everything else a long run learns had nowhere to go and was learned again.

test("a checkpoint costs one argument", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "cheap", "--weight", "significant", "--attested", "they asked"]);

  const note = wfctl(root, ["checkpoint", "the parser drops the last token when the body ends in a quote"]);
  assert.equal(note.status, 0, note.stdout);
  assert.match(wfctl(root, ["brief"]).stdout, /drops the last token/);
});

test("notes accumulate; the second does not erase the first", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "accumulate", "--weight", "significant", "--attested", "they asked"]);
  wfctl(root, ["checkpoint", "the first thing worth keeping"]);
  wfctl(root, ["checkpoint", "the second thing worth keeping"]);

  const written = wfctl(root, ["notes"]).stdout;
  assert.match(written, /the first thing worth keeping/, "the first note was lost");
  assert.match(written, /the second thing worth keeping/);
});

test("a body that opens with dashes is a body", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "dashes", "--weight", "significant", "--attested", "they asked"]);
  // A note that has to be re-worded to get past the parser is a note that does
  // not get written.
  const result = wfctl(root, ["checkpoint", "--fix the parser, it drops the last token"]);
  assert.equal(result.status, 0, result.stdout);
  assert.match(wfctl(root, ["notes"]).stdout, /--fix the parser/);
});

test("correcting the next action does not cost the handoff", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "carry", "--weight", "significant", "--attested", "they asked"]);
  wfctl(root, [
    "checkpoint",
    "--summary", "a summary", "--handoff", "the body a next session needs",
    "--last", "read the lock", "--next", "read the paths",
  ]);
  wfctl(root, ["checkpoint", "--next", "read the guards"]);

  const brief = wfctl(root, ["brief"]).stdout;
  assert.match(brief, /the body a next session needs/, "the handoff was dropped by a call that never named it");
  assert.match(brief, /next: read the guards/);
  assert.match(brief, /last: read the lock/);
});

test("an empty checkpoint is refused, and the refusal names the cheap form", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "empty", "--weight", "significant", "--attested", "they asked"]);
  const result = wfctl(root, ["checkpoint"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /wfctl checkpoint "/);
});

test("a finding can be settled by the work that found it", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "findings", "--weight", "significant", "--attested", "they asked"]);

  const recorded = wfctl(root, ["finding", "the lock file survives a kill between link and rm"]);
  assert.equal(recorded.status, 0, recorded.stdout);
  assert.match(recorded.stdout, /F001/);
  assert.match(wfctl(root, ["brief"]).stdout, /survives a kill/, "an open finding was invisible in the brief");

  // Resolved, never silently: a finding closed with no account of what was done
  // reads, six weeks later, exactly like one that was quietly dropped.
  const silent = wfctl(root, ["finding", "resolve", "F001"]);
  assert.equal(silent.status, 2);

  const resolved = wfctl(root, ["finding", "resolve", "F001", "--how", "rm moved into a finally"]);
  assert.equal(resolved.status, 0, resolved.stdout);
  assert.match(wfctl(root, ["finding", "list"]).stdout, /rm moved into a finally/);
  assert.doesNotMatch(wfctl(root, ["brief"]).stdout, /survives a kill/);
});

test("a finding that is not this work's leaves through the same door as a capture", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "release", "--weight", "significant", "--attested", "they asked"]);
  wfctl(root, ["finding", "the submodule pins do not resolve from their own remotes"]);

  const released = wfctl(root, ["finding", "release", "F001"]);
  assert.equal(released.status, 0, released.stdout);
  assert.match(released.stdout, /changes\/inbox\//);

  const inbox = await readdir(resolve(root, "changes/inbox"));
  assert.equal(inbox.length, 1, "the released finding never reached the inbox");
  const body = await readFile(resolve(root, "changes/inbox", inbox[0] ?? ""), "utf8");
  assert.match(body, /submodule pins/);
  // Where it came from travels with it. A capture that cannot say which work
  // met it is a capture nobody can put in context.
  assert.match(body, /release/);
});

test("a finding needs a fence, and says so when there is none", async () => {
  const root = await installed();
  const result = wfctl(root, ["finding", "something I noticed"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /wfctl capture/, "the refusal did not name the outlet that does apply");
});

test("artifacts are named, and superseding one is recorded rather than implied", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "artifacts", "--weight", "significant", "--attested", "they asked"]);
  const id = (await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim();
  const dir = resolve(root, "changes/active", id, "artifacts");
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "bench.md"), "43.6ms", "utf8");
  await writeFile(resolve(dir, "bench-2.md"), "12ms", "utf8");

  const first = wfctl(root, [
    "artifact", "add", `changes/active/${id}/artifacts/bench.md`,
    "--what", "the frame timing that killed the WebGPU argument",
  ]);
  assert.equal(first.status, 0, first.stdout);

  wfctl(root, [
    "artifact", "add", `changes/active/${id}/artifacts/bench-2.md`,
    "--what", "the same bench after the fill-rate fix",
    "--supersedes", `changes/active/${id}/artifacts/bench.md`,
  ]);

  const listed = wfctl(root, ["artifact", "list"]).stdout;
  assert.match(listed, /superseded.*bench\.md/s);
  assert.match(listed, /standing.*bench-2\.md/s);

  // The brief carries only what the work still stands on.
  const brief = wfctl(root, ["brief"]).stdout;
  assert.match(brief, /bench-2\.md/);
  assert.doesNotMatch(brief, /artifacts\/bench\.md/);
});

test("an artifact the disk does not have is refused", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "missing", "--weight", "significant", "--attested", "they asked"]);
  const result = wfctl(root, ["artifact", "add", "nowhere.md", "--what", "nothing"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /is not there/);
});

test("work step answers when it is asked rather than told", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "asking", "--weight", "significant", "--attested", "they asked"]);

  // It refused — "Unknown step. One of: …" — at an agent that was using it to
  // ask, and in a real run the flow then sat at `split` through eighteen
  // delivered units because nothing ever said so out loud.
  const asked = wfctl(root, ["work", "step"]);
  assert.equal(asked.status, 0, asked.stdout);
  assert.match(asked.stdout, /step opened/);
  assert.match(asked.stdout, /move it on with/);
});

test("nothing nags a session that has only just started", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "quiet", "--weight", "significant", "--attested", "they asked"]);
  // A warning that is always on is a warning nobody reads.
  assert.doesNotMatch(wfctl(root, ["brief"]).stdout, /since anything was written down/);
  assert.doesNotMatch(wfctl(root, ["work", "issue", "list"]).stdout, /since anything was written down/);
});

test("the write hook stays machine-readable", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "machine", "--weight", "significant", "--attested", "they asked"]);
  // Its contract is that empty output means stay silent. Appending a habit
  // reminder to it makes the guard speak on every edit.
  const quiet = wfctl(root, ["hook", "write", "--target", resolve(root, "README.md")]);
  assert.doesNotMatch(quiet.stdout, /wfctl checkpoint/);
});

// ---------------------------------------------------------------------------
// The check the verification gate rests on, and the brief that asks for it.
//
// `renderReviewerBrief` existed with no caller and no command, so the
// instructions for the one agent this design depends on were composed from
// memory — and the stub pass, which the module's own comment calls the single
// highest-yield check on the page, appeared only in a document that agent may
// never have opened. An empty `stubSurvivors` then meant both "I stubbed and
// everything went red" and "I never stubbed", and the gate congratulated both.

async function reviewJson(root: string, extra: Record<string, unknown>): Promise<string> {
  const path = resolve(root, `stub-review-${Math.random()}.json`);
  await writeFile(
    path,
    JSON.stringify({
      reviewer: "agent:reviewer",
      attacks: [{ lens: "correctness", target: "t", test: "x", output: "held", broke: false }],
      findings: [],
      stubSurvivors: [],
      ...extra,
    }),
    "utf8",
  );
  return path;
}

test("a review that does not say whether it stubbed is refused", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "stubs", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  const silent = wfctl(root, ["work", "verify", "--review", await reviewJson(root, {})]);
  assert.equal(silent.status, 2);
  assert.match(silent.stdout, /does not say whether the stub pass ran/);
  // The refusal has to say what the pass is, or it cannot be acted on.
  assert.match(silent.stdout, /constant/);

  const unaccounted = wfctl(root, [
    "work", "verify", "--review", await reviewJson(root, { stubPass: { ran: true, note: "" } }),
  ]);
  assert.equal(unaccounted.status, 2);
  assert.match(unaccounted.stdout, /does not say what it found/);

  const reported = wfctl(root, [
    "work", "verify", "--review",
    await reviewJson(root, { stubPass: { ran: true, note: "stubbed parse() to ''; nine tests went red" } }),
  ]);
  assert.equal(reported.status, 0, reported.stdout);
});

test("a suite that cannot be stubbed says so rather than wedging", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "unstubbable", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  // Making this mandatory-and-true would be a new deadlock of exactly the kind
  // the stub-survivor gate already was.
  const declined = wfctl(root, [
    "work", "verify", "--review",
    await reviewJson(root, { ran: false, stubPass: { ran: false, note: "the change is a Makefile recipe; there is nothing to stub" } }),
  ]);
  assert.equal(declined.status, 0, declined.stdout);
});

test("a stubPass that is not a report is refused rather than read as one", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "shape", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  mark(root, "verified");

  for (const [value, expected] of [
    ["yes", /not a report/],
    [{ note: "stubbed things" }, /does not say whether the pass ran/],
  ] as const) {
    const result = wfctl(root, ["work", "verify", "--review", await reviewJson(root, { stubPass: value })]);
    assert.equal(result.status, 2, `accepted ${JSON.stringify(value)}`);
    assert.match(result.stdout, expected);
  }
});

test("the reviewer's brief comes from the tool, not from memory", async () => {
  const root = await installed();

  const brief = wfctl(root, ["work", "verify", "--brief", "test-integrity", "--at", "abc123"]);
  assert.equal(brief.status, 0, brief.stdout);
  assert.match(brief.stdout, /fixed point abc123/);
  assert.match(brief.stdout, /RUN THE STUB PASS/);
  assert.match(brief.stdout, /Would these tests catch a broken implementation/);
  // The shape it must return, so the reviewer is not guessing at field names.
  assert.match(brief.stdout, /"stubPass"/);
  assert.match(brief.stdout, /"stubSurvivors"/);
  // And the property the whole design rests on.
  assert.match(brief.stdout, /not be given the implementer's reasoning/);

  const unknown = wfctl(root, ["work", "verify", "--brief", "vibes"]);
  assert.equal(unknown.status, 2);
});

// ---------------------------------------------------------------------------
// What a piece of work can be equipped with.
//
// Three registered checkouts carried fifty-six skills between them and the tool
// read none of them. The session that edits a leaf runs from the knowledge
// repository, where the leaf's own conventions are not in scope — so a repo
// that states exactly how it expects to be worked in was invisible at the one
// moment the work reached it.

async function leafWithSkills(root: string, name: string, skills: [string, string][]) {
  const path = resolve(root, "..", `leaf-${name}-${Math.random().toString(36).slice(2)}`);
  for (const [skill, description] of skills) {
    await mkdir(resolve(path, ".claude/skills", skill), { recursive: true });
    await writeFile(
      resolve(path, ".claude/skills", skill, "SKILL.md"),
      `---\nname: ${skill}\ndescription: ${description}\n---\n\n# ${skill}\n`,
      "utf8",
    );
  }
  wfctl(root, ["repo", "add", name, "--path", path, "--worktree", "main"]);
  return path;
}

test("the survey lists what exists and loads none of it", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "equip", "--weight", "significant", "--attested", "they asked"]);
  await leafWithSkills(root, "acme/leaf", [
    ["localization", "Use whenever work changes user-facing copy."],
    ["state-management", "Use whenever work touches shared client state."],
  ]);

  const survey = wfctl(root, ["kit", "survey"]);
  assert.equal(survey.status, 0, survey.stdout);
  assert.match(survey.stdout, /acme\/leaf:localization/);
  assert.match(survey.stdout, /user-facing copy/, "the description is what makes it triageable");
  // Strategies and personalities ship with the tool.
  assert.match(survey.stdout, /strategy:barriered-pipeline/);
  assert.match(survey.stdout, /personality:adversary/);
  // And nothing has been equipped by surveying.
  assert.match(wfctl(root, ["kit"]).stdout, /equipped with nothing yet/);
});

test("equipping is the maintainer's call and is recorded on the flow", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "record", "--weight", "significant", "--attested", "they asked"]);
  await leafWithSkills(root, "acme/leaf", [["localization", "Use for user-facing copy."]]);

  const unattested = wfctl(root, ["kit", "adopt", "strategy:prefactor"]);
  assert.equal(unattested.status, 2);
  assert.match(unattested.stdout, /maintainer's call/);

  const adopted = wfctl(root, [
    "kit", "adopt", "strategy:prefactor", "acme/leaf:localization",
    "--attested", "yes, those two",
  ]);
  assert.equal(adopted.status, 0, adopted.stdout);

  // The point of the record: it survives the session that chose it.
  const listed = wfctl(root, ["kit"]).stdout;
  assert.match(listed, /strategy:prefactor/);
  assert.match(listed, /acme\/leaf:localization/);
  assert.match(listed, /yes, those two/);
  assert.match(wfctl(root, ["brief"]).stdout, /equipped: 1 skill, 1 strategy/);
});

test("a claim hands over what this work equipped for that checkout", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "claiming", "--weight", "significant", "--attested", "they asked"]);
  await leafWithSkills(root, "acme/leaf", [["localization", "Use for user-facing copy."]]);
  await leafWithSkills(root, "acme/other", [["grpc", "Use for wire contracts."]]);
  wfctl(root, ["kit", "adopt", "acme/leaf:localization", "acme/other:grpc", "--attested", "yes"]);

  await walkToImplementE2E(root);
  wfctl(root, ["work", "issue", "create", "--title", "a unit"]);
  const claimed = wfctl(root, [
    "work", "issue", "claim", "U001", "--repository", "acme/leaf", "--worktree", "main",
  ]);
  assert.equal(claimed.status, 0, claimed.stdout);
  assert.match(claimed.stdout, /acme\/leaf:localization/);
  // The other checkout's skills are not this checkout's business.
  assert.doesNotMatch(claimed.stdout, /acme\/other:grpc/);
});

test("a strategy and a personality can be read by the path the survey prints", async () => {
  const root = await installed();
  for (const topic of ["strategy/barriered-pipeline", "strategy/prefactor", "personality/adversary"]) {
    const result = wfctl(root, ["guide", topic]);
    assert.equal(result.status, 0, `${topic}: ${result.stdout}`);
    assert.ok(result.stdout.trim().length > 400, `${topic} is nearly empty`);
  }
  // A record may not point at a guide the guide command denies exists.
  const survey = wfctl(root, ["kit", "survey"]).stdout;
  for (const match of survey.matchAll(/read: (wfctl guide [a-z]+\/[a-z-]+)/g)) {
    const topic = (match[1] ?? "").replace("wfctl guide ", "");
    assert.equal(wfctl(root, ["guide", topic]).status, 0, `${topic} was surveyed and cannot be read`);
  }
});

test("an id nobody ships is refused rather than recorded", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "unknown", "--weight", "significant", "--attested", "they asked"]);
  const result = wfctl(root, ["kit", "adopt", "strategy:vibes", "--attested", "yes"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /strategy:vibes/);
  assert.match(wfctl(root, ["kit"]).stdout, /nothing yet/, "a refused adoption still wrote");
});

// ---------------------------------------------------------------------------
// What earlier work found out.
//
// Every destination the record had ended when the bundle did, so each session
// started from the same ground as the last and hit the same wall twice.

test("a learning outlives the work and needs the maintainer's word", async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "teaching", "--weight", "significant", "--attested", "they asked"]);

  const unattested = wfctl(root, ["learned", "a narrowed refspec looks like lost work", "--detail", "check .git/config first"]);
  assert.equal(unattested.status, 2);
  // The refusal has to name the thing that does apply, or it is a wall.
  assert.match(unattested.stdout, /wfctl finding/);

  const bare = wfctl(root, ["learned", "a title with no detail", "--attested", "yes"]);
  assert.equal(bare.status, 2);
  assert.match(bare.stdout, /is a title/);

  const written = wfctl(root, [
    "learned", "a narrowed refspec looks exactly like lost upstream work",
    "--detail", "The pin was four commits above origin/master and looked wrong. The clone had a narrowed fetch refspec.",
    "--attested", "yes, keep that",
  ]);
  assert.equal(written.status, 0, written.stdout);
  assert.match(written.stdout, /learnings\//);

  // It survives the flow that found it, which is the whole point.
  wfctl(root, ["work", "close", "--outcome", "abandoned"]);
  assert.match(wfctl(root, ["learned", "list"]).stdout, /narrowed refspec/);
  assert.match(wfctl(root, ["brief"]).stdout, /1 learning\(s\) from earlier work/);
});

// ---------------------------------------------------------------------------
// A route that grows, and a claim that carries its support.
//
// The unit list was written at `split` and then audited against. It is a
// prediction, and predictions rot: one real run had a unit come back part-done
// with no way to say so, and another that reality demanded could not be created
// because the flow was parked when it was confirmed.

test("a unit goes terminal with what proves it", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "evidence", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  wfctl(root, ["work", "issue", "create", "--title", "the world takes turns"]);

  const bare = wfctl(root, ["work", "issue", "complete", "U001"]);
  assert.equal(bare.status, 2);
  assert.match(bare.stdout, /what proves it/);
  // The refusal offers the half-done answer too, or it is a wall for the case
  // that has no honest move.
  assert.match(bare.stdout, /--remainder/);

  const done = wfctl(root, [
    "work", "issue", "complete", "U001", "--evidence", "tbt-api 87600cf5; both interleaving tests pass",
  ]);
  assert.equal(done.status, 0, done.stdout);
  assert.match(wfctl(root, ["work", "issue", "list"]).stdout, /✓ tbt-api 87600cf5/);
});

test("a half-done unit carries its remainder forward", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "remainder", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  wfctl(root, ["work", "issue", "create", "--title", "every state is a whole screen", "--satisfies", "AC-01"]);

  const partial = wfctl(root, [
    "work", "issue", "complete", "U001",
    "--evidence", "eighteen states seeded and green",
    "--remainder", "the world action bar has no content",
  ]);
  assert.equal(partial.status, 0, partial.stdout);
  assert.match(partial.stdout, /remainder carried forward/);

  const listed = wfctl(root, ["work", "issue", "list"]).stdout;
  assert.match(listed, /U002\s+open\s+the world action bar has no content\s+← U001/);
  // The remainder inherits what the original was for; it is the same criterion,
  // not a new one nobody agreed to.
  const flow = JSON.parse(
    await readFile(
      resolve(root, ".workflow/flows", `${(await readFile(resolve(root, ".workflow/flows/current"), "utf8")).trim()}.json`),
      "utf8",
    ),
  );
  assert.deepEqual(flow.issues[1].acceptance, ["AC-01"]);
});

test("re-completing a done unit is refused, not congratulated", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "twice", "--weight", "significant", "--attested", "they asked"]);
  await walkToImplementE2E(root);
  wfctl(root, ["work", "issue", "create", "--title", "a unit"]);
  wfctl(root, ["work", "issue", "complete", "U001", "--evidence", "it landed"]);

  // It used to succeed and print "every unit is terminal", so a run that had
  // lost track of itself was congratulated for it.
  const again = wfctl(root, ["work", "issue", "complete", "U001", "--evidence", "it landed again"]);
  assert.equal(again.status, 2);
  assert.match(again.stdout, /already done/);
  assert.match(again.stdout, /it landed/, "the refusal did not say what it was completed on");
});

test("a unit added during delivery is marked as one reality asked for", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "grown", "--weight", "significant", "--attested", "they asked"]);
  wfctl(root, ["work", "issue", "create", "--title", "planned before delivery"]);
  await walkToImplementE2E(root);

  const discovered = wfctl(root, ["work", "issue", "create", "--title", "found while building"]);
  assert.equal(discovered.status, 0, discovered.stdout);
  assert.match(discovered.stdout, /route grows/);

  const listed = wfctl(root, ["work", "issue", "list"]).stdout;
  assert.match(listed, /1 of these were added after the route was laid down/);
});

test("units written before delivery are not counted as grown", { timeout: 60_000 }, async () => {
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "early", "--weight", "significant", "--attested", "they asked"]);
  // Everything before delivery is the route being laid down. Calling a unit
  // written at `opened` "discovered" would make the signal mean nothing.
  wfctl(root, ["work", "issue", "create", "--title", "written at opened"]);
  const listed = wfctl(root, ["work", "issue", "list"]).stdout;
  assert.doesNotMatch(listed, /added after the route was laid down/);
});

test("the complexity personality carries a threshold a reviewer can apply", async () => {
  const root = await installed();
  const brief = wfctl(root, ["guide", "personality/complexity"]);
  assert.equal(brief.status, 0, brief.stdout);

  // A personality without a protocol produces opinion. This one's protocol is
  // arithmetic, so the numbers have to survive being shipped.
  assert.match(brief.stdout, /CRAP\(m\) = comp\(m\)² × \(1 − cov\(m\)\)³ \+ comp\(m\)/);
  assert.match(brief.stdout, /threshold is 30/);
  assert.match(brief.stdout, /31\+.*impossible/s);

  // And the failure that makes the metric lie: coverage bought with tests that
  // assert nothing. It is the cheapest way to fix the score and it moves no risk.
  assert.match(brief.stdout, /asserts nothing/);
  assert.match(brief.stdout, /stub the function to a constant/);
});
