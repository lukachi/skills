import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, symlinkSync } from "node:fs";
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
  const leaf = await mkdtemp(join(tmpdir(), "wfctl-leaf-"));
  await mkdir(resolve(leaf, "graphify-out"), { recursive: true });
  await writeFile(resolve(leaf, "graphify-out/graph.json"), "{}", "utf8");
  wfctl(root, ["repo", "add", "acme/a", "--path", leaf]);

  wfctl(root, ["work", "start", "--title", "quiet", "--weight", "lightweight"]);
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

test("brief --json satisfies the stop guard's contract, not just a stub's", async () => {
  /**
   * The stop-guard suite stubs `wfctl brief --json`, so it stayed green for as
   * long as the flag did not exist and the guard silently allowed every turn.
   * This checks the two sides against each other.
   */
  const root = await installed();
  wfctl(root, ["work", "start", "--title", "contract", "--weight", "significant"]);

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
  assert.match(decision, /wfctl checkpoint --summary/, "the guard named a command that does not exist");
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
  assert.match(off.stdout, /Restart the session/);
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
  wfctl(root, ["work", "start", "--title", "leaf work", "--weight", "significant"]);

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
  wfctl(root, ["work", "start", "--title", "w", "--weight", "significant"]);
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
  wfctl(root, ["work", "start", "--title", "w", "--weight", "significant"]);
  wfctl(root, ["recall", "route", "graphify", "--covered", resolve(a, "src/a.ts")]);
  wfctl(root, ["work", "issue", "create", "--title", "unit"]);
  wfctl(root, ["work", "issue", "claim", "U001", "--repository", "acme/a", "--worktree", "main"]);

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
