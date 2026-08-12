import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { readRepositoryMetadata } from "../src/git.js";
import { findDecisions } from "../src/decided.js";
import { hashKnowledgeConcept, validateKnowledge } from "../src/knowledge.js";
import { buildInstallPlan } from "../src/planner.js";
import { collectWorkflowState } from "../src/state.js";
import { STATE_COLLECTORS } from "../src/state-collectors.js";
import { readWorkGate, renderWorkGate } from "../src/work-ask.js";
import { applyPromotion, stagePromotion } from "../src/work-promotion.js";
import {
  approveWork,
  beginWork,
  closeWork,
  createWorkIssue,
  reviewWorkBundleFile,
  updateWorkCheckpoint,
  verifyWork,
  workBundleContext,
} from "../src/work.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The night this replaced.
 *
 * Four bundles were framed and approved for one unattended run. Two were
 * delivered in sixty-two minutes and then stopped at a completion gate only a
 * sleeping maintainer could open; the other two were never started. What the
 * gate was asking — is this done — the record already answered. What nobody had
 * asked was whether the project should now say what the work had proved.
 */

test("delivered work closes without waking anyone, and waits to be taught", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();

  const staged = await stagePromotion({ target: leaf, id });
  assert.equal(staged.status, "pending");
  assert.deepEqual(staged.drafts, ["decisions/world-loop.md"]);
  await settle(leaf, id);

  // Nothing is left for a person at closure: the framing they approved is
  // satisfied and every other check is arithmetic.
  assert.deepEqual((await verifyWork(leaf, id)).issues, []);

  const closed = await closeWork({ target: leaf, id, outcome: "completed" });
  // Closed, and in the queue rather than the archive. Where it sits is the
  // state, so nothing has to be scanned to find what is waiting.
  assert.match(closed.archivePath, /changes\/promotion\//);
  await assert.rejects(access(join(knowledge, "changes/archive", id)));
  await assert.rejects(access(join(knowledge, "knowledge/decisions/world-loop.md")));

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const waiting = report.signals.find((signal) => signal.id === "work.promotion-pending");
  assert.equal(waiting?.awaits, "maintainer");
  // Named, never counted: the pages carry titles and a path is an address.
  assert.match(String(waiting?.facts?.pages), /World loop authority/);
});

test("the packet is the pages themselves, and it says what each one replaces", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });

  const gate = await readWorkGate(knowledge, id, { stage: "promotion", distributionRoot });
  assert.equal(gate.pages.length, 1);
  assert.equal(gate.pages[0]?.title, "World loop authority");
  assert.equal(gate.pages[0]?.replaces, false);

  const rendered = renderWorkGate(gate);
  assert.match(rendered, /The project has said nothing about this until now/);
  assert.match(rendered, /The world loop follows the reviewed authority model/);
  // The decision is about the product, so nothing in it is something to open.
  assert.doesNotMatch(rendered, /knowledge\/decisions/);
  assert.doesNotMatch(rendered, /AC-01/);
});

test("their word is what writes the pages, and archiving happens in the same act", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });

  const promoted = await applyPromotion({
    target: leaf,
    id,
    by: "human:test-maintainer",
    method: "attested",
    attested: "да, это то что проект теперь говорит",
    session: "the session that read the packet",
  });
  assert.deepEqual(promoted.concepts, ["knowledge/decisions/world-loop.md"]);
  assert.match(promoted.archivePath, /changes\/archive\//);

  // The page is in the corpus, it cites the change that authorised it, and that
  // citation resolves — which is the deadlock this replaced. A page used to be
  // citable only from a change the maintainer had already accepted, while
  // accepting the change required the page to have been written first.
  const validation = await validateKnowledge(knowledge, ["knowledge/decisions/world-loop.md"]);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));

  const archived = parseWorkSpec(
    await readFile(join(knowledge, "changes/archive", id, "change.md"), "utf8"),
  );
  const promotion = archived.metadata.knowledge_promotion as Record<string, unknown>;
  assert.equal(promotion.status, "applied");
  const review = archived.metadata.maintainer_review as Record<string, Record<string, unknown>>;
  assert.equal(review.promotion?.status, "approved");
  assert.equal(review.promotion?.attested, "да, это то что проект теперь говорит");

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    report.signals.some((signal) => signal.id === "work.promotion-pending"),
    false,
  );
});

test("a page that does not validate is not written, and nothing is half-taught", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  const draft = join(knowledge, "changes/active", id, "promotion/decisions/world-loop.md");
  // Break the citation the page rests on: it now names a change that does not exist.
  await writeFile(
    draft,
    (await readFile(draft, "utf8")).replace(id, "2026-07-28-a-change-nobody-made"),
    "utf8",
  );
  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });

  await assert.rejects(
    applyPromotion({
      target: leaf,
      id,
      by: "human:test-maintainer",
      method: "attested",
      attested: "да",
    }),
    /nothing was written/,
  );
  await assert.rejects(access(join(knowledge, "knowledge/decisions/world-loop.md")));
  // Still in the queue, so the maintainer's answer is not lost and the corpus is
  // exactly as correct as it was before they gave it.
  await access(join(knowledge, "changes/promotion", id, "change.md"));
});

test("scope that left the route by the agent's own hand reopens the maintainer's gate", async () => {
  const { knowledge, leaf, id, repository } = await deliveredBundle();
  await createWorkIssue({
    target: leaf,
    id,
    slug: "the-half-nobody-built",
    title: "Prove the loop under load",
    phase: "delivery",
    type: "delivery",
    satisfies: ["AC-01"],
    repositories: [repository],
    distributionRoot,
  });
  const issuePath = join(
    knowledge,
    "changes/active",
    id,
    "issues/ISSUE-001-the-half-nobody-built.md",
  );
  const issue = parseWorkSpec(await readFile(issuePath, "utf8"));
  issue.metadata.status = "dropped";
  await writeFile(issuePath, serializeWorkSpec(issue), "utf8");
  await settle(leaf, id);

  const held = (await verifyWork(leaf, id)).issues.join("; ");
  assert.match(held, /delivery no longer matches the approved framing/);
  assert.match(held, /Prove the loop under load/);

  // And the same completion approval that used to be routine opens it — asked
  // once, where there is genuinely something left to decide.
  await approveWork({
    target: leaf,
    id,
    stage: "completion",
    by: "human:test-maintainer",
    method: "attested",
    attested: "да, закрывай без него",
  });
  await settle(leaf, id);
  assert.equal(
    (await verifyWork(leaf, id)).issues.some((entry) => /no longer matches/.test(entry)),
    false,
  );
});

test("criteria reworded after approval are not silently the ones that were approved", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  const specPath = join(knowledge, "changes/active", id, "change.md");
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  (document.metadata.acceptance as Array<Record<string, unknown>>)[0]!.criterion =
    "The world loop behavior is delivered, more or less.";
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
  await settle(leaf, id);

  assert.match(
    (await verifyWork(leaf, id)).issues.join("; "),
    /what will make this finished has been reworded/,
  );
});

test("a framing is not approved against pages the project has not been taught", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });

  const next = await beginWork({
    target: leaf,
    slug: "the-loop-again",
    title: "The loop again",
    mode: "full",
    distributionRoot,
  });
  await prepareFraming(next.specPath, ["knowledge/areas/world/index.md"]);
  await assert.rejects(
    approveWork({
      target: leaf,
      id: next.id,
      stage: "framing",
      by: "human:test-maintainer",
      method: "attested",
      attested: "утверждаю",
    }),
    /knowingly behind in the same part of the project/,
  );

  // A framing that rests on a different Area is never held by it.
  await prepareFraming(next.specPath, ["knowledge/areas/billing/index.md"]);
  await approveWork({
    target: leaf,
    id: next.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "attested",
    attested: "утверждаю",
  });
});

/**
 * The chain, end to end.
 *
 * `verify-project-work` drafts the page, routes it to a curation skill, and that
 * skill routes it to the quality gate, which seals it with a content hash. Every
 * link in that chain resolved paths under `knowledge/`, so the moment drafts
 * moved into the bundle the gate could not read the page it was sealing — the
 * page landed unsealed, and an unsealed page cannot be stable.
 */
test("a page is sealed where it is drafted, and the seal survives the promotion", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  const draft = `changes/active/${id}/promotion/decisions/world-loop.md`;

  const sealed = await hashKnowledgeConcept(knowledge, draft);
  assert.equal(sealed.path, draft);
  assert.match(sealed.contentHash, /^[0-9a-f]{64}$/);

  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });
  await applyPromotion({
    target: leaf,
    id,
    by: "human:test-maintainer",
    method: "attested",
    attested: "да",
  });

  // The hash reads frontmatter and body, never location, and promotion copies
  // byte for byte — so the seal taken on the draft is the seal the corpus holds.
  const landed = await hashKnowledgeConcept(knowledge, "knowledge/decisions/world-loop.md");
  assert.equal(landed.contentHash, sealed.contentHash);
});

test("a closed bundle waiting on the maintainer is still somewhere answers are found", async () => {
  const { knowledge, leaf, id } = await deliveredBundle();
  await stagePromotion({ target: leaf, id });
  await settle(leaf, id);
  await closeWork({ target: leaf, id, outcome: "completed" });

  // The freshest decisions in the project live here, and their pages are exactly
  // the ones the corpus does not hold yet. A search blind to this queue asks the
  // maintainer again for what he settled most recently.
  const found = await findDecisions(knowledge, "the world loop authority model");
  assert.equal(found.decisions.length > 0, true);
  assert.match(found.decisions[0]!.what, /authority model/);
  assert.match(found.decisions[0]!.where, /changes\/promotion\//);
});

/**
 * A bundle that has passed every mechanical gate, with one page drafted and
 * waiting. Its curated page is sealed where it will land and then moved into the
 * bundle, because a promoted page is copied byte for byte and its content hash
 * has to survive the move.
 */
async function deliveredBundle(): Promise<
  { knowledge: string; leaf: string; id: string; repository: string }
> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-promotion-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "leaf-repo");
  await mkdir(knowledge);
  await mkdir(leaf);
  initializeGit(knowledge);
  initializeGit(leaf);
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  await applyInstallPlan(await buildInstallPlan({
    target: leaf,
    profile: "leaf",
    knowledge,
    distributionRoot,
  }));
  await mkdir(join(leaf, "graphify-out"));
  await writeFile(join(leaf, "graphify-out/graph.json"), "{}\n", "utf8");
  commitAll(leaf, "initialize workflow");

  const started = await beginWork({
    target: leaf,
    slug: "world-loop",
    title: "World loop",
    mode: "full",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  const source = readRepositoryMetadata(leaf);
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  document.metadata.acceptance = [{
    id: "AC-01",
    criterion: "The reviewed world loop behavior is delivered.",
    status: "verified",
  }];
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/areas/world/index.md"],
    conflicts: [],
    decided: {
      checked: "how the world loop settles authority",
      found: [],
      none: "Nothing already recorded bears on it.",
    },
  };
  accountEveryRepository(document);
  document.metadata.graph_evidence = { queries: ["Trace the world loop"] };
  document.metadata.knowledge_promotion = {
    decisions: [{
      what: "The world loop follows the reviewed authority model.",
      said: "maintainer_review.framing",
      disposition: "promoted",
      into: "knowledge/decisions/world-loop.md",
    }],
  };
  document.metadata.verification = {
    result: "passed",
    revision: source.commit,
    worktree_id: source.worktreeId,
    acceptance_reviewed: true,
    implementation_reviewed: true,
    checks: [{ command: "bun run test", result: "passed" }],
    acceptance: [{
      id: "AC-01",
      result: "passed",
      evidence: ["Direct source inspection and bun run test"],
    }],
    unresolved: [],
  };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");

  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "attested",
    attested: "утверждаю",
    now: new Date("2026-07-28T10:05:00.000Z"),
  });

  const staged = parseWorkSpec(await readFile(started.specPath, "utf8"));
  staged.metadata.status = "completed";
  await writeFile(started.specPath, serializeWorkSpec(staged), "utf8");

  await draftPage(knowledge, started.id);
  await settle(leaf, started.id);
  return { knowledge, leaf, id: started.id, repository: source.repository };
}

/** Write the curated page, seal it at its destination, then move it into the bundle. */
async function draftPage(knowledge: string, id: string): Promise<void> {
  const destination = "knowledge/decisions/world-loop.md";
  await writeFile(
    join(knowledge, destination),
    `---
type: Architecture Decision
title: World loop authority
status: stable
view: decision
purpose: decision-history
audience: [maintainer, engineer]
decision_id: world-loop-authority
effective_at: 2026-07-28T11:55:00Z
supersedes: []
superseded_by: ""
authority: [decision]
generated: { by: workflow-agent/1, at: 2026-07-28T11:30:00Z }
verified: { by: human:test-maintainer, at: 2026-07-28T11:55:00Z }
x-wf:
  relations: []
  quality:
    status: pending
sources:
  - id: world-loop-decision
    kind: maintainer-decision
    resource: project-change:${id}#decision
    author: human:test-maintainer
---

# Decision

The world loop follows the reviewed authority model.[^world-loop-decision]

[^world-loop-decision]: Reviewed decision in the bound change.
`,
    "utf8",
  );
  await sealConcept(knowledge, destination);
  const sealed = await readFile(join(knowledge, destination), "utf8");
  const draft = join(knowledge, "changes/active", id, "promotion/decisions/world-loop.md");
  await mkdir(dirname(draft), { recursive: true });
  await writeFile(draft, sealed, "utf8");
  await rm(join(knowledge, destination));
}

/** Refresh the checkpoint and account for every file, as any real turn would. */
async function settle(leaf: string, id: string): Promise<void> {
  await updateWorkCheckpoint({
    target: leaf,
    id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "The bundle is delivered and its pages are drafted.",
    nextAction: "Put the pages to the maintainer.",
  });
  const context = await workBundleContext(leaf, id, "review");
  for (const file of context.inventory) {
    if (file.role === "review") {
      continue;
    }
    await reviewWorkBundleFile(leaf, id, file.path, "reviewed", "");
  }
}

async function prepareFraming(specPath: string, reviewed: string[]): Promise<void> {
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  document.metadata.knowledge_alignment = {
    reviewed,
    conflicts: [],
    decided: {
      checked: "the outcome this bundle is for",
      found: [],
      none: "Nothing already recorded bears on it.",
    },
  };
  accountEveryRepository(document);
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
}

function accountEveryRepository(document: ReturnType<typeof parseWorkSpec>): void {
  for (const entry of Array.isArray(document.metadata.repositories)
    ? document.metadata.repositories
    : []) {
    if (entry && typeof entry === "object") {
      (entry as Record<string, unknown>).accounted = {
        status: "read",
        note: "Its own instructions and repo-local skills were read for this work.",
        at: "2026-07-28T10:00:00.000Z",
        instructions_sha256: "",
        skills: [],
      };
    }
  }
}

async function sealConcept(target: string, relativePath: string): Promise<void> {
  const absolute = join(target, relativePath);
  const document = parseWorkSpec(await readFile(absolute, "utf8"));
  const seal = {
    status: "passed",
    by: "workflow-agent/1",
    at: "2026-07-28T11:55:00Z",
    content_hash: "0".repeat(64),
  };
  document.metadata.verified = {
    ...(document.metadata.verified as Record<string, unknown>),
    content_hash: seal.content_hash,
  };
  const workflow = document.metadata["x-wf"] as Record<string, unknown>;
  workflow.quality = {
    ...seal,
    checks: ["factuality", "audience-fit", "abstraction", "completeness", "delivery-state"],
    axes: { "authority-truth": { ...seal }, "reader-communication": { ...seal } },
  };
  await writeFile(absolute, serializeWorkSpec(document), "utf8");

  const sealed = parseWorkSpec(await readFile(absolute, "utf8"));
  const hash = (await hashKnowledgeConcept(target, relativePath)).contentHash;
  (sealed.metadata.verified as Record<string, unknown>).content_hash = hash;
  const quality = (sealed.metadata["x-wf"] as Record<string, unknown>)
    .quality as Record<string, unknown>;
  quality.content_hash = hash;
  const axes = quality.axes as Record<string, Record<string, unknown>>;
  axes["authority-truth"]!.content_hash = hash;
  axes["reader-communication"]!.content_hash = hash;
  await writeFile(absolute, serializeWorkSpec(sealed), "utf8");
}

function initializeGit(root: string): void {
  execFileSync("git", ["-C", root, "init", "-q"]);
  writeFileSync(join(root, "seed.txt"), "seed\n");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-qm", "seed"]);
}

function commitAll(root: string, message: string): void {
  execFileSync("git", ["-C", root, "add", "-A"]);
  execFileSync(
    "git",
    ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-qm", message],
  );
}
