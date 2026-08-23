import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  GUIDANCE_DIR,
  KNOWLEDGE_DIRECTORIES,
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

test("it installs guidance and no skills at all", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  const result = await applyInstall(plan, { distribution, version: "1.0.0" });

  assert.ok(result.written.some((path) => path === join(GUIDANCE_DIR, "work/framed.md")));
  assert.ok(result.written.every((path) => !path.includes("skills")));

  const body = await readFile(resolve(root, GUIDANCE_DIR, "work/framed.md"), "utf8");
  assert.match(body, /cheapest moment to change the scope/);
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

  const edited = resolve(root, GUIDANCE_DIR, "work/framed.md");
  await writeFile(edited, "the maintainer wrote this instead\n", "utf8");

  const next = await planInstall({ target: root, distribution, version: "1.0.0" });
  assert.ok(next.edited.includes(join(GUIDANCE_DIR, "work/framed.md")));

  const result = await applyInstall(next, { distribution, version: "1.0.0" });
  assert.ok(result.conflicts.includes(join(GUIDANCE_DIR, "work/framed.md")));
  assert.equal(await readFile(edited, "utf8"), "the maintainer wrote this instead\n");
});

test("installed files are hash-tracked so an upgrade can tell ours from theirs", async () => {
  const root = await target();
  const plan = await planInstall({ target: root, distribution, version: "1.0.0" });
  await applyInstall(plan, { distribution, version: "1.0.0" });

  const state = await readInstallState(root);
  assert.ok(state);
  assert.equal(state.installedVersion, "1.0.0");
  assert.match(state.files[join(GUIDANCE_DIR, "work/framed.md")]?.sha256 ?? "", /^[0-9a-f]{64}$/);
});
