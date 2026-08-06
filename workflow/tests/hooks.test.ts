import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BACKGROUND_GUARD_COMMAND,
  backgroundGuardHookInstalled,
  installBackgroundGuardHook,
  installSessionBriefHook,
  removeSessionBriefHook,
  SESSION_BRIEF_COMMAND,
  sessionBriefHookInstalled,
  sessionStartEnvelope,
  STOP_GUARD_COMMAND,
  installStopGuardHook,
  setStopGuardEnabled,
  stopGuardEnabled,
  stopGuardHookInstalled,
} from "../src/hooks.js";

async function workspace(settings?: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-hooks-"));
  if (settings !== undefined) {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(
      join(root, ".claude/settings.json"),
      `${JSON.stringify(settings, null, 2)}\n`,
      "utf8",
    );
  }
  return root;
}

async function settingsOf(root: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(root, ".claude/settings.json"), "utf8"));
}

test("installs the session brief hook into a repository without settings", async () => {
  const root = await workspace();
  const result = await installSessionBriefHook(root);

  assert.equal(result.outcome, "installed");
  assert.deepEqual(await settingsOf(root), {
    hooks: {
      SessionStart: [
        { matcher: "*", hooks: [{ type: "command", command: SESSION_BRIEF_COMMAND }] },
      ],
    },
  });
  assert.equal(await sessionBriefHookInstalled(root), true);
});

test("never installs the same hook twice", async () => {
  const root = await workspace();
  await installSessionBriefHook(root);
  const second = await installSessionBriefHook(root);

  assert.equal(second.outcome, "already-installed");
  const settings = await settingsOf(root);
  const event = (settings.hooks as Record<string, unknown[]>).SessionStart ?? [];
  assert.equal(event.length, 1);
});

test("preserves unrelated settings and unrelated hooks", async () => {
  const root = await workspace({
    model: "opus",
    permissions: { defaultMode: "auto" },
    hooks: {
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: "echo done" }] }],
      SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "echo mine" }] }],
    },
  });
  await installSessionBriefHook(root);
  const settings = await settingsOf(root);

  assert.equal(settings.model, "opus");
  assert.deepEqual(settings.permissions, { defaultMode: "auto" });
  const hooks = settings.hooks as Record<string, Array<Record<string, unknown>>>;
  assert.equal(hooks.Stop?.length, 1);
  assert.equal(hooks.SessionStart?.length, 2);
});

test("removes only its own entry from a shared matcher", async () => {
  const root = await workspace({
    model: "opus",
    hooks: {
      SessionStart: [{
        matcher: "*",
        hooks: [
          { type: "command", command: SESSION_BRIEF_COMMAND },
          { type: "command", command: "echo mine" },
        ],
      }],
    },
  });
  const result = await removeSessionBriefHook(root);

  assert.equal(result.outcome, "removed");
  const settings = await settingsOf(root);
  assert.equal(settings.model, "opus");
  assert.deepEqual(
    (settings.hooks as Record<string, Array<{ hooks: unknown[] }>>).SessionStart?.[0]?.hooks,
    [{ type: "command", command: "echo mine" }],
  );
  assert.equal(await sessionBriefHookInstalled(root), false);
});

test("drops the empty event and the empty hooks key when nothing else remains", async () => {
  const root = await workspace({ model: "opus" });
  await installSessionBriefHook(root);
  await removeSessionBriefHook(root);

  assert.deepEqual(await settingsOf(root), { model: "opus" });
});

test("reports an absent hook instead of rewriting the file", async () => {
  const root = await workspace({ model: "opus" });
  const result = await removeSessionBriefHook(root);

  assert.equal(result.outcome, "absent");
  assert.deepEqual(await settingsOf(root), { model: "opus" });
});

test("emits the SessionStart envelope the agent host reads", () => {
  const parsed = JSON.parse(sessionStartEnvelope("state goes here"));

  assert.deepEqual(parsed, {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "state goes here",
    },
  });
});

test("refuses to guess at a settings file that is not an object", async () => {
  const root = await workspace(["not", "an", "object"]);
  await assert.rejects(
    installSessionBriefHook(root),
    /must contain a JSON object/,
  );
});

test("installs the background silence watch beside unrelated settings and hooks", async () => {
  const root = await workspace({
    model: "opus",
    hooks: {
      PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo mine" }] }],
    },
  });
  const first = await installBackgroundGuardHook(root);
  const second = await installBackgroundGuardHook(root);

  assert.equal(first.outcome, "installed");
  assert.equal(second.outcome, "already-installed");
  assert.equal(await backgroundGuardHookInstalled(root), true);

  const settings = await settingsOf(root);
  assert.equal(settings.model, "opus");
  const pre = (settings.hooks as Record<string, Array<Record<string, unknown>>>).PreToolUse ?? [];
  assert.equal(pre.length, 2, "the maintainer's own PreToolUse entry must survive");
  assert.equal(pre[1]?.matcher, "Bash");
});

test("anchors the watch on the project directory so the settings file stays portable", () => {
  assert.match(BACKGROUND_GUARD_COMMAND, /\$CLAUDE_PROJECT_DIR/);
  assert.match(
    BACKGROUND_GUARD_COMMAND,
    /\[ -f .* \] &&/,
    "a session outside an installed repository must not fail every shell call",
  );
});

test("installs the stop guard beside an unrelated Stop entry without disturbing it", async () => {
  const root = await workspace({
    hooks: {
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: "echo mine" }] }],
    },
  });
  const first = await installStopGuardHook(root);
  const second = await installStopGuardHook(root);

  assert.equal(first.outcome, "installed");
  assert.equal(second.outcome, "already-installed");
  assert.equal(await stopGuardHookInstalled(root), true);

  const settings = await settingsOf(root);
  const stop = (settings.hooks as Record<string, unknown[]>).Stop ?? [];
  assert.equal(stop.length, 2, "the maintainer's own Stop entry must survive");
});

test("anchors the stop guard on the project directory and never fails a turn", () => {
  assert.match(STOP_GUARD_COMMAND, /\$CLAUDE_PROJECT_DIR/);
  assert.match(
    STOP_GUARD_COMMAND,
    /\|\| true$/,
    "a guard that errors must end the turn rather than trap the session",
  );
});

test("turning the stop guard off is a switch an upgrade cannot undo", async () => {
  const root = await workspace({});
  await installStopGuardHook(root);
  assert.equal(await stopGuardEnabled(root), true);

  const off = await setStopGuardEnabled(root, false, "reading over its shoulder");
  assert.equal(off.enabled, false);
  assert.equal(off.changed, true);
  assert.equal(await stopGuardEnabled(root), false);

  // The settings entry stays, so `wfctl upgrade` reinstalling it changes
  // nothing. Removing the entry instead would put the guard back on without
  // telling the maintainer who turned it off.
  await installStopGuardHook(root);
  assert.equal(await stopGuardHookInstalled(root), true);
  assert.equal(await stopGuardEnabled(root), false);

  const on = await setStopGuardEnabled(root, true);
  assert.equal(on.changed, true);
  assert.equal(await stopGuardEnabled(root), true);
  assert.equal((await setStopGuardEnabled(root, true)).changed, false);
});
