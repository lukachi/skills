import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  realpath,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { readRepositoryMetadata } from "../src/git.js";
import { hashKnowledgeConcept } from "../src/knowledge.js";
import { buildInstallPlan } from "../src/planner.js";
import { addLeafRepository } from "../src/repository-registry.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";
import {
  beginWork,
  claimWorkIssue,
  closeWork,
  completeWorkIssue,
  createWorkIssue,
  createHandoff,
  finishWayfinder,
  rebindWork,
  reviewWorkBundleFile,
  setWorkIssueBlocker,
  verifyWork,
  workBundleContext,
  workStatus,
} from "../src/work.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("runs the completed central work lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-work-"));
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
  await writeFile(join(knowledge, "raw/legacy.md"), "Untrusted legacy claim.\n", "utf8");
  commitAll(leaf, "initialize workflow");

  await assert.rejects(
    beginWork({
      target: leaf,
      slug: "raw-reference",
      title: "Raw reference",
      mode: "full",
      knowledgeRef: "raw/legacy.md",
      graphQuery: "Trace the world loop",
      distributionRoot,
    }),
    /must identify a Markdown file under knowledge/,
  );

  const started = await beginWork({
    target: leaf,
    slug: "world-loop",
    title: "World loop",
    mode: "full",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });

  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  const leafRoot = await realpath(leaf);
  const knowledgeRoot = await realpath(knowledge);
  assert.equal(document.metadata.workspace, undefined);
  assert.equal(document.metadata.scope, "leaf");
  assert.doesNotMatch(await readFile(started.specPath, "utf8"), new RegExp(escapeRegExp(leafRoot)));
  assert.equal(started.codeRoot, leafRoot);
  assert.equal(started.knowledgeRoot, knowledgeRoot);
  assert.match(started.specPath, /changes\/active\/2026-07-28-world-loop\/change\.md$/);
  assert.equal(document.metadata.status, "shaping");
  assert.deepEqual(
    (document.metadata.knowledge_alignment as Record<string, unknown>).reviewed,
    [],
  );
  assert.deepEqual(
    (document.metadata.graph_evidence as Record<string, unknown>).queries,
    [],
  );
  const status = await workStatus(leaf, started.id);
  assert.equal(status[0]?.valid, true);
  assert.equal(status[0]?.codeRoot, leafRoot);
  assert.equal(status[0]?.specPath, started.specPath);
  document.metadata.status = "completed";
  document.metadata.acceptance = [{
    id: "AC-01",
    criterion: "The reviewed world loop behavior is delivered.",
    status: "verified",
  }];
  const verifiedSource = readRepositoryMetadata(leaf);
  document.metadata.verification = {
    result: "passed",
    revision: verifiedSource.commit,
    worktree_id: verifiedSource.worktreeId,
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
  document.metadata.maintainer_review = {
    framing: {
      status: "approved",
      by: "human:test-maintainer",
      at: "2026-07-28T10:05:00.000Z",
      notes: [],
    },
    completion: {
      status: "approved",
      by: "human:test-maintainer",
      at: "2026-07-28T11:55:00.000Z",
      notes: [],
    },
  };
  document.metadata.knowledge_promotion = {
    status: "applied",
    concepts: ["knowledge/decisions/world-loop.md"],
    reason: "",
  };
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  document.metadata.graph_evidence = {
    queries: ["Trace the world loop"],
  };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await writeFile(
    join(knowledge, "knowledge/decisions/world-loop.md"),
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
    resource: project-change:${started.id}#decision
    author: human:test-maintainer
---

# Decision

The world loop follows the reviewed authority model.[^world-loop-decision]

[^world-loop-decision]: Reviewed decision in the bound change.
`,
    "utf8",
  );
  await sealConcept(knowledge, "knowledge/decisions/world-loop.md");

  document.body += "\nEvidence: raw/legacy.md\n";
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  assert.ok(
    (await verifyWork(leaf, started.id)).issues.includes(
      "project change records must not cite raw/ or intake/ paths",
    ),
  );
  document.body = document.body.replace("\nEvidence: raw/legacy.md\n", "");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await reviewWorkBundleFile(leaf, started.id, "change.md", "reviewed", "");

  const verified = await verifyWork(leaf, started.id);
  assert.deepEqual(verified.issues, []);

  const dirtyPath = join(leaf, "uncommitted.txt");
  await writeFile(dirtyPath, "not preserved\n", "utf8");
  await assert.rejects(
    closeWork({
      target: leaf,
      id: started.id,
      outcome: "completed",
      now: new Date("2026-07-28T11:59:00.000Z"),
    }),
    /bound source checkout must be clean/,
  );
  await unlink(dirtyPath);

  (document.metadata.verification as Record<string, unknown>).revision = "b".repeat(40);
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await assert.rejects(
    closeWork({
      target: leaf,
      id: started.id,
      outcome: "completed",
      now: new Date("2026-07-28T11:59:30.000Z"),
    }),
    /verification revision does not match current commit/,
  );
  (document.metadata.verification as Record<string, unknown>).revision = verifiedSource.commit;
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await reviewWorkBundleFile(leaf, started.id, "change.md", "reviewed", "");

  const closed = await closeWork({
    target: leaf,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  const archived = await readFile(join(closed.archivePath, "change.md"), "utf8");
  assert.match(archived, /outcome: completed/);
  assert.match(archived, /checkout: leaf-repo/);
  assert.match(archived, /worktree: false/);
  assert.match(archived, /commit_at_start: [0-9a-f]{40}/);
  assert.doesNotMatch(archived, new RegExp(escapeRegExp(leafRoot)));
  assert.match(archived, /sources_at_close:/);
  await assert.rejects(access(started.pointerPath));
});

test("blocks significant completion without explicit maintainer reviews", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-review-gate-"));
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

  const started = await beginWork({
    target: leaf,
    slug: "review-gate",
    title: "Review gate",
    mode: "full",
    knowledgeRef: "knowledge/index.md",
    graphQuery: "Trace review gate",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  document.metadata.verification = {
    result: "passed",
    acceptance_reviewed: true,
    implementation_reviewed: true,
    checks: [{ command: "bun test", result: "passed" }],
    unresolved: [],
  };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");

  const verified = await verifyWork(leaf, started.id);
  assert.ok(verified.issues.includes("maintainer_review.framing.status must be approved"));
  assert.ok(verified.issues.includes("maintainer_review.completion.status must be approved"));
});

test("creates a lightweight handoff in the knowledge inbox", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-handoff-"));
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

  const created = await createHandoff({
    target: leaf,
    slug: "small-observation",
    title: "Small observation",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  assert.equal(created.knowledgeRoot, await realpath(knowledge));
  assert.match(created.path, /changes\/inbox\/2026-07-28-small-observation\.md$/);
  const content = await readFile(created.path, "utf8");
  assert.match(content, /status: inbox/);
  assert.match(content, /repository:/);
  assert.match(content, /worktree_id: main/);
  await assert.rejects(
    access(join(leaf, ".workflow/current", `${created.id}.json`)),
  );

  const projectOnly = await createHandoff({
    target: knowledge,
    slug: "raw-proposal",
    title: "Raw proposal",
    distributionRoot,
    now: new Date("2026-07-28T10:05:00.000Z"),
  });
  assert.equal(projectOnly.codeRoot, undefined);
  assert.equal(projectOnly.knowledgeRoot, await realpath(knowledge));
  assert.match(projectOnly.path, /changes\/inbox\/2026-07-28-raw-proposal\.md$/);
  assert.match(await readFile(projectOnly.path, "utf8"), /status: inbox/);
});

test("detects linked Git worktrees for close metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-worktree-"));
  const main = join(root, "main");
  const feature = join(root, "feature");
  await mkdir(main);
  initializeGit(main);
  execFileSync("git", ["-C", main, "worktree", "add", "-b", "feature", feature], {
    stdio: "ignore",
  });

  const metadata = readRepositoryMetadata(feature);
  assert.equal(metadata.worktree, true);
  assert.equal(metadata.checkout, "feature");
  assert.equal(metadata.branch, "feature");
  assert.equal(metadata.root, await realpath(feature));
  assert.equal(metadata.worktreeId, "feature");
  assert.notEqual(metadata.commit, "unknown");
});

test("blocks work commands from a different checkout of the same repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-worktree-boundary-"));
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
  const other = join(root, "other");
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

  const started = await beginWork({
    target: leaf,
    slug: "bound-worktree",
    title: "Bound worktree",
    mode: "full",
    knowledgeRef: "knowledge/index.md",
    graphQuery: "Trace the bound worktree",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });

  execFileSync("git", ["-C", leaf, "worktree", "add", "-b", "other", other], {
    stdio: "ignore",
  });
  await mkdir(join(other, ".workflow/current"), { recursive: true });
  await copyFile(
    join(leaf, ".workflow/config.json"),
    join(other, ".workflow/config.json"),
  );
  await copyFile(
    started.pointerPath,
    join(other, ".workflow/current", `${started.id}.json`),
  );

  await assert.rejects(
    verifyWork(other, started.id),
    /outside the bound workspaces|not bound to the work/,
  );
});

test("runs project-only knowledge work without inventing a code checkout", async () => {
  const knowledge = await mkdtemp(join(tmpdir(), "wfctl-project-work-"));
  initializeGit(knowledge);
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));

  const started = await beginWork({
    target: knowledge,
    slug: "vision-review",
    title: "Vision review",
    mode: "full",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  assert.equal(started.scope, "project");
  assert.deepEqual(started.codeRoots, []);
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.deepEqual(document.metadata.repositories, []);
  completeWorkDocument(document, "project");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await reviewWorkBundleFile(knowledge, started.id, "change.md", "reviewed", "");
  assert.deepEqual((await verifyWork(knowledge, started.id)).issues, []);

  const closed = await closeWork({
    target: knowledge,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  const archived = await readFile(join(closed.archivePath, "change.md"), "utf8");
  assert.doesNotMatch(archived, new RegExp(escapeRegExp(knowledge)));
});

test("coordinates one project change across every selected leaf", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-multi-work-"));
  const knowledge = join(root, "knowledge");
  const api = join(root, "api");
  const client = join(root, "client");
  await mkdir(knowledge);
  await mkdir(api);
  await mkdir(client);
  initializeGit(knowledge);
  initializeGit(api);
  initializeGit(client);
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  for (const leaf of [api, client]) {
    await applyInstallPlan(await buildInstallPlan({
      target: leaf,
      profile: "leaf",
      knowledge,
      distributionRoot,
    }));
    commitAll(leaf, "initialize workflow");
    await addLeafRepository(knowledge, leaf);
  }

  const started = await beginWork({
    target: knowledge,
    slug: "shared-contract",
    title: "Shared contract",
    mode: "full",
    leaves: [api, client],
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  assert.equal(started.scope, "multi-repo");
  assert.equal(started.codeRoots.length, 2);
  assert.equal(started.pointerPaths.length, 3);
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  completeWorkDocument(document, "multi-repo");
  const sources = [readRepositoryMetadata(api), readRepositoryMetadata(client)];
  const verification = document.metadata.verification as Record<string, unknown>;
  verification.repositories = sources.map((source) => ({
    repository: source.repository,
    revision: source.commit,
    worktree_id: source.worktreeId,
    checks: [{ command: `test ${source.repository}`, result: "passed" }],
  }));
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await reviewWorkBundleFile(knowledge, started.id, "change.md", "reviewed", "");
  assert.deepEqual((await verifyWork(knowledge, started.id)).issues, []);

  const closed = await closeWork({
    target: knowledge,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  const archived = await readFile(join(closed.archivePath, "change.md"), "utf8");
  assert.doesNotMatch(archived, new RegExp(escapeRegExp(api)));
  assert.doesNotMatch(archived, new RegExp(escapeRegExp(client)));
});

test("detects a branch switch until the work is explicitly rebound", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-rebind-"));
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
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
  const started = await beginWork({
    target: leaf,
    slug: "branch-binding",
    title: "Branch binding",
    mode: "full",
    distributionRoot,
  });
  execFileSync("git", ["-C", leaf, "switch", "-q", "-c", "feature/rebound"]);
  const drifted = await workStatus(leaf, started.id);
  assert.equal(drifted[0]?.valid, false);
  assert.ok(drifted[0]?.issues.some((issue) => /run wfctl work rebind/.test(issue)));
  await rebindWork(leaf, started.id);
  assert.equal((await workStatus(leaf, started.id))[0]?.valid, true);
});

test("enforces full bundle reads, exact claims, dependency frontier, and stale review", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-bundle-"));
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
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
  commitAll(leaf, "initialize workflow");

  const started = await beginWork({
    target: leaf,
    slug: "bundle-coverage",
    title: "Bundle coverage",
    mode: "full",
    distributionRoot,
    now: new Date("2026-07-31T10:00:00.000Z"),
  });
  const change = parseWorkSpec(await readFile(started.specPath, "utf8"));
  change.metadata.acceptance = [{
    id: "AC-01",
    criterion: "A user can complete the reviewed behavior.",
    status: "pending",
  }];
  change.body += "\nBottom-of-file requirement: preserve recovery semantics.\n";
  await writeFile(started.specPath, serializeWorkSpec(change), "utf8");
  const repository = String(
    ((change.metadata.repositories as Record<string, unknown>[])[0]!).repository,
  );
  const first = await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "first-slice",
    title: "Deliver the first complete slice",
    phase: "delivery",
    type: "delivery",
    satisfies: ["AC-01"],
    repositories: [repository],
    distributionRoot,
  });
  const second = await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "follow-up-slice",
    title: "Deliver the dependent slice",
    phase: "delivery",
    type: "delivery",
    blockedBy: [first.id],
    satisfies: ["AC-01"],
    repositories: [repository],
    distributionRoot,
  });
  await assert.rejects(
    setWorkIssueBlocker(leaf, started.id, first.id, second.id, true),
    /create a cycle/,
  );
  const context = await workBundleContext(leaf, started.id, "implement", first.id);
  assert.deepEqual(
    context.requiredFiles.map((entry) => entry.path),
    ["change.md", first.path],
  );
  await assert.rejects(
    claimWorkIssue({
      target: leaf,
      id: started.id,
      issueId: first.id,
      actor: "agent:test-session",
    }),
    /required context is reviewed/,
  );
  for (const path of context.requiredFiles.map((entry) => entry.path)) {
    await reviewWorkBundleFile(leaf, started.id, path, "reviewed", "");
  }
  const claimed = await claimWorkIssue({
    target: leaf,
    id: started.id,
    issueId: first.id,
    actor: "agent:test-session",
  });
  assert.equal(claimed.status, "claimed");
  const claimedDocument = parseWorkSpec(await readFile(join(started.bundleRoot, first.path), "utf8"));
  assert.equal(
    (claimedDocument.metadata.claim as Record<string, unknown>).worktree_id,
    readRepositoryMetadata(leaf).worktreeId,
  );
  await assert.rejects(
    completeWorkIssue({
      target: knowledge,
      id: started.id,
      issueId: first.id,
      summary: "This must not resolve from the record workspace.",
      evidence: ["No valid leaf context"],
    }),
    /source claim must be operated from its bound leaf/,
  );
  await completeWorkIssue({
    target: leaf,
    id: started.id,
    issueId: first.id,
    summary: "The first complete behavior is implemented and checked.",
    evidence: ["Direct source inspection", "bun test first-slice"],
  });
  const afterCompletion = await workBundleContext(leaf, started.id, "resume");
  assert.ok(afterCompletion.frontier.includes(second.id));

  await reviewWorkBundleFile(leaf, started.id, second.path, "reviewed", "");
  const secondPath = join(started.bundleRoot, second.path);
  await writeFile(
    secondPath,
    `${await readFile(secondPath, "utf8")}\nLate requirement that must not be guessed away.\n`,
    "utf8",
  );
  const changed = await workBundleContext(leaf, started.id, "review");
  assert.equal(
    changed.inventory.find((entry) => entry.path === second.path)?.accounting,
    "changed-after-review",
  );
});

test("Wayfinder resolves one shared map before delivery specification", async () => {
  const knowledge = await mkdtemp(join(tmpdir(), "wfctl-wayfinder-"));
  initializeGit(knowledge);
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  const started = await beginWork({
    target: knowledge,
    slug: "account-system",
    title: "Find the account-system direction",
    mode: "wayfinder",
    distributionRoot,
    now: new Date("2026-07-31T10:00:00.000Z"),
  });
  const mapPath = join(started.bundleRoot, "map.md");
  const map = parseWorkSpec(await readFile(mapPath, "utf8"));
  map.metadata.destination = "A reviewable specification for the account system";
  map.metadata.fog = ["The recovery authority is not yet precise"];
  await writeFile(mapPath, serializeWorkSpec(map), "utf8");
  const issue = await createWorkIssue({
    target: knowledge,
    id: started.id,
    slug: "recovery-authority",
    title: "Choose the recovery authority",
    phase: "wayfinding",
    type: "grilling",
    distributionRoot,
  });
  const context = await workBundleContext(knowledge, started.id, "wayfind", issue.id);
  assert.deepEqual(
    context.requiredFiles.map((entry) => entry.path),
    ["change.md", issue.path, "map.md"],
  );
  for (const path of context.requiredFiles.map((entry) => entry.path)) {
    await reviewWorkBundleFile(knowledge, started.id, path, "reviewed", "");
  }
  await claimWorkIssue({
    target: knowledge,
    id: started.id,
    issueId: issue.id,
    actor: "agent:wayfinder-test",
  });
  await completeWorkIssue({
    target: knowledge,
    id: started.id,
    issueId: issue.id,
    summary: "Recovery is controlled by a separately verified ownership factor.",
    evidence: ["Maintainer decision recorded during focused grilling"],
  });
  await assert.rejects(
    finishWayfinder(knowledge, started.id, "full"),
    /not-yet-specified fog/,
  );

  const updatedMap = parseWorkSpec(await readFile(mapPath, "utf8"));
  updatedMap.metadata.fog = [];
  await writeFile(mapPath, serializeWorkSpec(updatedMap), "utf8");
  const change = parseWorkSpec(await readFile(started.specPath, "utf8"));
  change.metadata.acceptance = [{
    id: "AC-01",
    criterion: "The approved recovery authority is specified as observable behavior.",
    status: "pending",
  }];
  await writeFile(started.specPath, serializeWorkSpec(change), "utf8");
  await assert.rejects(
    finishWayfinder(knowledge, started.id, "full"),
    /every bundle file is reviewed/,
  );
  const review = await workBundleContext(knowledge, started.id, "review");
  for (const file of review.requiredFiles) {
    await reviewWorkBundleFile(knowledge, started.id, file.path, "reviewed", "");
  }
  const finished = await finishWayfinder(knowledge, started.id, "full");
  assert.equal(finished.mode, "full");
  assert.equal(parseWorkSpec(await readFile(mapPath, "utf8")).metadata.status, "resolved");
  assert.equal(parseWorkSpec(await readFile(started.specPath, "utf8")).metadata.mode, "full");
});

async function sealConcept(target: string, relativePath: string): Promise<void> {
  const absolute = join(target, relativePath);
  const document = parseWorkSpec(await readFile(absolute, "utf8"));
  const verified = (
    typeof document.metadata.verified === "object"
    && document.metadata.verified !== null
    && !Array.isArray(document.metadata.verified)
  )
    ? document.metadata.verified as Record<string, unknown>
    : {};
  document.metadata.verified = {
    ...verified,
    content_hash: "0".repeat(64),
  };
  const workflow = (
    typeof document.metadata["x-wf"] === "object"
    && document.metadata["x-wf"] !== null
    && !Array.isArray(document.metadata["x-wf"])
  )
    ? document.metadata["x-wf"] as Record<string, unknown>
    : {};
  workflow.quality = {
    status: "passed",
    by: "workflow-agent/1",
    at: "2026-07-28T11:55:00Z",
    content_hash: "0".repeat(64),
    checks: [
      "factuality",
      "audience-fit",
      "abstraction",
      "completeness",
      "delivery-state",
    ],
    axes: {
      "authority-truth": {
        status: "passed",
        by: "workflow-agent/1",
        at: "2026-07-28T11:55:00Z",
        content_hash: "0".repeat(64),
      },
      "reader-communication": {
        status: "passed",
        by: "workflow-agent/1",
        at: "2026-07-28T11:55:00Z",
        content_hash: "0".repeat(64),
      },
    },
  };
  document.metadata["x-wf"] = workflow;
  await writeFile(absolute, serializeWorkSpec(document), "utf8");
  const sealed = parseWorkSpec(await readFile(absolute, "utf8"));
  const hash = (await hashKnowledgeConcept(target, relativePath)).contentHash;
  (sealed.metadata.verified as Record<string, unknown>).content_hash = hash;
  (
    (sealed.metadata["x-wf"] as Record<string, unknown>).quality as Record<string, unknown>
  ).content_hash = hash;
  const axes = (
    (sealed.metadata["x-wf"] as Record<string, unknown>).quality as Record<string, unknown>
  ).axes as Record<string, Record<string, unknown>>;
  axes["authority-truth"]!.content_hash = hash;
  axes["reader-communication"]!.content_hash = hash;
  await writeFile(absolute, serializeWorkSpec(sealed), "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function completeWorkDocument(
  document: ReturnType<typeof parseWorkSpec>,
  scope: "project" | "multi-repo",
): void {
  document.metadata.status = "completed";
  document.metadata.acceptance = [{
    id: "AC-01",
    criterion: "The scoped project outcome is verified.",
    status: "verified",
  }];
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  document.metadata.graph_evidence = {
    queries: scope === "project" ? [] : ["Trace the shared contract"],
  };
  document.metadata.knowledge_promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The reviewed work changes no durable project meaning.",
  };
  document.metadata.maintainer_review = {
    framing: {
      status: "approved",
      by: "human:test-maintainer",
      at: "2026-07-28T10:05:00.000Z",
      notes: [],
    },
    completion: {
      status: "approved",
      by: "human:test-maintainer",
      at: "2026-07-28T11:55:00.000Z",
      notes: [],
    },
  };
  document.metadata.verification = {
    result: "passed",
    acceptance_reviewed: true,
    implementation_reviewed: scope !== "project",
    knowledge_reviewed: scope === "project",
    checks: [{ command: "wfctl knowledge validate", result: "passed" }],
    acceptance: [{
      id: "AC-01",
      result: "passed",
      evidence: ["Fresh structural and semantic checks"],
    }],
    unresolved: [],
    repositories: [],
  };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
}

function initializeGit(root: string): void {
  execFileSync("git", ["-C", root, "init", "-q"]);
  writeFileSync(join(root, "seed.txt"), "seed\n");
  execFileSync("git", ["-C", root, "add", "seed.txt"]);
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=wfctl tests",
      "-c",
      "user.email=wfctl@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "-q",
      "-m",
      "seed",
    ],
  );
}

function commitAll(root: string, message: string): void {
  execFileSync("git", ["-C", root, "add", "-A"]);
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=wfctl tests",
      "-c",
      "user.email=wfctl@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "-q",
      "-m",
      message,
    ],
  );
}
