import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { GateRefusal } from "../src/core/gates.js";
import {
  assertCorrectable,
  closeBundle,
  destinationFor,
  hasDraftedPages,
  listQueue,
  promote,
} from "../src/core/promotion-queue.js";
import { readReviewArtifact } from "../src/core/review-artifact.js";

async function knowledge(): Promise<string> {
  return mkdtemp(join(tmpdir(), "wfctl-promo-"));
}

async function bundle(root: string, id: string, withDrafts: boolean): Promise<void> {
  await mkdir(resolve(root, "changes/active", id), { recursive: true });
  await writeFile(resolve(root, "changes/active", id, "change.md"), "# record\n", "utf8");
  if (withDrafts) {
    await mkdir(resolve(root, "changes/active", id, "promotion/areas/billing"), { recursive: true });
    await writeFile(
      resolve(root, "changes/active", id, "promotion/areas/billing/index.md"),
      "# billing\n",
      "utf8",
    );
  }
}

test("a partial outcome holding pages goes to the queue, not the archive", async () => {
  const root = await knowledge();
  await bundle(root, "b1", true);

  const result = await closeBundle({ knowledgeRoot: root, bundleId: "b1", outcome: "partial" });
  assert.equal(result.waitingOnPromotion, true);
  assert.match(result.to, /changes\/promotion\/b1$/);
  assert.deepEqual(await listQueue(root), ["b1"]);
});

test("an abandoned outcome holding pages also keeps them promotable", async () => {
  const root = await knowledge();
  await bundle(root, "b2", true);
  const result = await closeBundle({ knowledgeRoot: root, bundleId: "b2", outcome: "abandoned" });
  assert.equal(result.waitingOnPromotion, true);
});

test("a record with nothing to say archives directly", async () => {
  const root = await knowledge();
  await bundle(root, "b3", false);
  const result = await closeBundle({ knowledgeRoot: root, bundleId: "b3", outcome: "completed" });
  assert.equal(result.waitingOnPromotion, false);
  assert.match(result.to, /changes\/archive\/b3$/);
  assert.deepEqual(await listQueue(root), []);
});

test("the destination depends on drafts, never on the outcome", () => {
  for (const outcome of ["completed", "partial", "abandoned"] as const) {
    assert.match(destinationFor(outcome, true), /promotion/);
    assert.match(destinationFor(outcome, false), /archive/);
  }
});

test("a queued record is still correctable, and an archived one is not", async () => {
  const root = await knowledge();
  await bundle(root, "b4", true);
  await closeBundle({ knowledgeRoot: root, bundleId: "b4", outcome: "completed" });

  const correctable = await assertCorrectable(root, "b4");
  assert.match(correctable, /changes\/promotion\/b4$/);

  await promote({ knowledgeRoot: root, bundleId: "b4" });
  await assert.rejects(
    () => assertCorrectable(root, "b4"),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /already in curated knowledge/);
      return true;
    },
  );
});

test("drafted pages are detected at any depth", async () => {
  const root = await knowledge();
  await bundle(root, "b5", true);
  assert.equal(await hasDraftedPages(root, "b5"), true);
  await bundle(root, "b6", false);
  assert.equal(await hasDraftedPages(root, "b6"), false);
});

test("a review returned by the agent under review is refused", async () => {
  const root = await knowledge();
  const path = resolve(root, "review.json");
  await writeFile(
    path,
    JSON.stringify({ reviewer: "agent:me", attacks: [], findings: [], stubSurvivors: [], stubPass: { ran: true, note: "stubbed; all red" } }),
    "utf8",
  );
  await assert.rejects(
    () => readReviewArtifact(path, "agent:me"),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /agent under review/);
      return true;
    },
  );
});

test("an attack with no test, or a test never run, is refused", async () => {
  const root = await knowledge();
  const path = resolve(root, "review.json");

  await writeFile(
    path,
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [{ lens: "correctness", target: "negatives", test: "", output: "x", broke: false }],
    }),
    "utf8",
  );
  await assert.rejects(() => readReviewArtifact(path, "agent:me"), /carries no test/);

  await writeFile(
    path,
    JSON.stringify({
      reviewer: "agent:other",
      attacks: [{ lens: "correctness", target: "negatives", test: "expect(x)", output: "", broke: false }],
    }),
    "utf8",
  );
  await assert.rejects(() => readReviewArtifact(path, "agent:me"), /never run/);
});

test("a valid review artifact parses", async () => {
  const root = await knowledge();
  const path = resolve(root, "review.json");
  await writeFile(
    path,
    JSON.stringify({
      reviewer: "agent:other",
      fixedPoint: "abc123",
      framingDigest: "d",
      attacks: [
        { lens: "test-integrity", target: "stubbing", test: "expect(fn()).toThrow()", output: "fail", broke: true },
      ],
      findings: [],
      stubSurvivors: [],
      stubPass: { ran: true, note: "stubbed the implementation; every test went red" },
    }),
    "utf8",
  );
  const review = await readReviewArtifact(path, "agent:me");
  assert.equal(review.reviewer, "agent:other");
  assert.equal(review.attacks.length, 1);
});
