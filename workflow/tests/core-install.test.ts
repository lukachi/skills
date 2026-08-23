import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  KNOWLEDGE_DIRECTORIES,
  RUNTIME_DIR,
  applyInstall,
  assertProfileSupported,
  planInstall,
  readInstallState,
} from "../src/core/install.js";
import { GateRefusal } from "../src/core/gates.js";

const distribution = resolve(import.meta.dirname, "..");

async function target(): Promise<string> {
  return mkdtemp(join(tmpdir(), "wfctl-install-"));
}

test("a leaf installation is refused, and the refusal explains what replaced it", () => {
  assert.throws(
    () => assertProfileSupported("leaf"),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /no leaf installation/);
      assert.match(error.remedy, /init knowledge/);
      return true;
    },
  );
  assert.doesNotThrow(() => assertProfileSupported("knowledge"));
});

test("installation creates the knowledge shape, with raw under reconstruction and no intake", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  const created = plan.operations
    .filter((operation) => operation.kind === "create-directory")
    .map((operation) => operation.path);

  assert.ok(created.includes("reconstruction/raw"));
  assert.ok(created.includes("changes/inbox"));
  assert.ok(!created.some((path) => path.startsWith("intake")));
  assert.ok(!created.includes("raw"));
  assert.deepEqual(created.sort(), [...KNOWLEDGE_DIRECTORIES].sort());
});

test("it installs the runtime guards and nothing else — guidance ships with the CLI", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  const result = await applyInstall(plan, { distribution, version: "1.0.0" });

  assert.ok(result.written.every((path) => path.startsWith(`${RUNTIME_DIR}/`)));
  assert.ok(result.written.some((path) => path.endsWith("guard-stop.mjs")));
  assert.ok(result.written.every((path) => !path.includes("skills")));

  /**
   * Copying guidance into the project bought a per-project override nobody
   * asked for and cost an upgrade step to keep it current. It is read from
   * where wfctl lives, so upgrading wfctl upgrades it.
   */
  assert.ok(!existsSync(resolve(root, ".workflow/guidance")));
});

test("a second run rewrites nothing", async () => {
  const root = await target();
  const first = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(first, { distribution, version: "1.0.0" });

  const second = await planInstall({ target: root, distribution, version: "1.0.0" });
  const result = await applyInstall(second, { distribution, version: "1.0.0" });
  assert.equal(result.written.length, 0);
  assert.ok(result.skipped.length > 0);
});

test("a file the maintainer edited is reported and never replaced silently", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const edited = resolve(root, RUNTIME_DIR, "guard-stop.mjs");
  await writeFile(edited, "the maintainer wrote this instead\n", "utf8");

  const next = await planInstall({ target: root, distribution, version: "1.0.0" });
  assert.ok(next.edited.includes(join(RUNTIME_DIR, "guard-stop.mjs")));

  const result = await applyInstall(next, { distribution, version: "1.0.0" });
  assert.ok(result.conflicts.includes(join(RUNTIME_DIR, "guard-stop.mjs")));
  assert.equal(await readFile(edited, "utf8"), "the maintainer wrote this instead\n");
});

test("installed files are hash-tracked so an upgrade can tell ours from theirs", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const state = await readInstallState(root);
  assert.ok(state);
  assert.equal(state.installedVersion, "1.0.0");
  assert.match(state.files[join(RUNTIME_DIR, "guard-stop.mjs")]?.sha256 ?? "", /^[0-9a-f]{64}$/);
});

test("installation places the hooks that reach an agent which never runs a command", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const settings = JSON.parse(await readFile(resolve(root, ".claude/settings.json"), "utf8"));
  const events = Object.keys(settings.hooks).sort();
  assert.deepEqual(events, ["PreToolUse", "SessionStart", "Stop"]);

  const matchers = settings.hooks.PreToolUse.map((entry: { matcher: string }) => entry.matcher);
  assert.ok(matchers.includes("Edit|Write|MultiEdit"));
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /wfctl brief/);

  const guard = await readFile(resolve(root, ".workflow/runtime/guard-write.mjs"), "utf8");
  assert.match(guard, /first write of a unit/);
});

test("merging hooks preserves settings the project already had", async () => {
  const root = await target();
  await mkdir(resolve(root, ".claude"), { recursive: true });
  await writeFile(
    resolve(root, ".claude/settings.json"),
    JSON.stringify({
      permissions: { allow: ["Bash(npm test)"] },
      hooks: { PreToolUse: [{ matcher: "WebFetch", hooks: [{ type: "command", command: "mine" }] }] },
    }),
    "utf8",
  );

  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const settings = JSON.parse(await readFile(resolve(root, ".claude/settings.json"), "utf8"));
  assert.deepEqual(settings.permissions.allow, ["Bash(npm test)"]);
  const matchers = settings.hooks.PreToolUse.map((entry: { matcher: string }) => entry.matcher);
  assert.ok(matchers.includes("WebFetch"));
  assert.ok(matchers.includes("Bash"));
});

test("the managed block lands in both conventions and keeps the maintainer's text", async () => {
  const root = await target();
  await writeFile(resolve(root, "AGENTS.md"), "# Our project\n\nRead the deploy notes first.\n", "utf8");

  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");
  assert.match(agents, /Read the deploy notes first/);
  assert.match(agents, /wfctl:begin/);
  assert.match(agents, /there\s+are no skills to find/);

  const claude = await readFile(resolve(root, "CLAUDE.md"), "utf8");
  assert.match(claude, /wfctl brief/);
});

test("a second install replaces only the block, never the surrounding text", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });
  await writeFile(
    resolve(root, "AGENTS.md"),
    `${await readFile(resolve(root, "AGENTS.md"), "utf8")}\n## Ours\n\nkeep me\n`,
    "utf8",
  );

  const second = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(second, { distribution, version: "1.0.0" });

  const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");
  assert.match(agents, /keep me/);
  assert.equal(agents.split("wfctl:begin").length - 1, 1);
});
