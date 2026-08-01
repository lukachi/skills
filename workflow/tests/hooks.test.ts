import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  installSessionBriefHook,
  removeSessionBriefHook,
  SESSION_BRIEF_COMMAND,
  sessionBriefHookInstalled,
  sessionStartEnvelope,
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
