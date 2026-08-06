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
import { approvalRecordPath, recordApproval } from "../src/approval.js";
import {
  createCapture,
  listCaptures,
  resolveCapture,
} from "../src/capture.js";
import { readRepositoryMetadata } from "../src/git.js";
import { hashKnowledgeConcept } from "../src/knowledge.js";
import { buildInstallPlan } from "../src/planner.js";
import { addLeafRepository } from "../src/repository-registry.js";
import {
  CURRENT_CHANGE_VERSION,
  GATED_CHANGE_VERSIONS,
  includesVersion,
  parseWorkSpec,
  serializeWorkSpec,
  SUPPORTED_CHANGE_VERSIONS,
  SUPPORTED_ISSUE_VERSIONS,
} from "../src/work-spec.js";
import {
  approveWork,
  beginWork,
  claimWorkIssue,
  closeWork,
  completeWorkIssue,
  createWorkIssue,
  finishWayfinder,
  rebindWork,
  reviewWorkBundleFile,
  setWorkIssueBlocker,
  verifyWork,
  workBundleContext,
  workStatus,
  updateWorkCheckpoint,
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
  assert.equal(document.metadata.workflow_version, 5);
  assert.match(document.body, /^# Discovery ledger\s*$/m);
  assert.equal(document.metadata.checkpoint_version, 1);
  assert.equal(
    (document.metadata.checkpoint as Record<string, unknown>).status,
    "active",
  );
  assert.deepEqual(
    (document.metadata.knowledge_alignment as Record<string, unknown>).reviewed,
    [],
  );
  assert.deepEqual(
    (document.metadata.graph_evidence as Record<string, unknown>).queries,
    [],
  );
  // The pointer directory is shared, gitignored scratch space. A file that is
  // not a work binding must be passed over, not read as a broken one: when the
  // stop guard kept its state here, every work command failed with
  // "Unsupported or malformed active work binding" until it was moved.
  await writeFile(
    join(leaf, ".workflow/current/stop-guard.json"),
    JSON.stringify({ key: "x", count: 1, fingerprint: "abc", answer: "def" }),
    "utf8",
  );
  await writeFile(
    join(leaf, ".workflow/current/not-json.json"),
    "this is not JSON at all\n",
    "utf8",
  );
  assert.deepEqual(
    (await workStatus(leaf)).map((entry) => entry.id),
    [started.id],
    "only work bindings are bindings",
  );

  const status = await workStatus(leaf, started.id);
  assert.equal(status[0]?.valid, true);
  assert.equal(status[0]?.title, "World loop");
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
  await recordMaintainerApprovals(document, knowledge, started.id);
  document.metadata.knowledge_promotion = {
    status: "applied",
    concepts: ["knowledge/decisions/world-loop.md"],
    reason: "",
  };
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  accountEveryRepository(document);
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
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "Implementation and knowledge promotion are ready for final review.",
    lastCompleted: "Acceptance evidence and curated knowledge were recorded.",
    nextAction: "Review every current bundle file and close the change.",
    now: new Date("2026-07-28T11:56:00.000Z"),
  });
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
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "The verified revision is corrected and closure is ready.",
    lastCompleted: "Verification was rebound to the current source revision.",
    nextAction: "Review the corrected change record and close the bundle.",
    now: new Date("2026-07-28T11:59:40.000Z"),
  });
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

test("captures unassigned material and closes its inbox lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-capture-"));
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

  const created = await createCapture({
    target: leaf,
    slug: "small-observation",
    title: "Small observation",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  assert.equal(created.knowledgeRoot, await realpath(knowledge));
  assert.match(created.path, /changes\/inbox\/2026-07-28-small-observation\.md$/);
  const content = await readFile(created.path, "utf8");
  assert.match(content, /kind: capture/);
  assert.match(content, /status: pending/);
  assert.match(content, /repository:/);
  assert.match(content, /worktree_id: main/);
  await assert.rejects(
    access(join(leaf, ".workflow/current", `${created.id}.json`)),
  );

  const pending = await listCaptures(leaf);
  assert.deepEqual(pending.captures.map((entry) => entry.id), [created.id]);
  await assert.rejects(
    resolveCapture({
      target: leaf,
      id: created.id,
      outcome: "routed",
      reason: "An index is not a semantic owner.",
      destinations: ["knowledge/index.md"],
    }),
    /concrete knowledge concept/,
  );
  const destination = join(knowledge, "knowledge/references/captured-observation.md");
  await writeFile(destination, "# Captured observation\n", "utf8");
  const resolved = await resolveCapture({
    target: leaf,
    id: created.id,
    outcome: "routed",
    reason: "The verified result belongs in the curated knowledge index.",
    destinations: ["knowledge/references/captured-observation.md"],
    now: new Date("2026-07-28T10:04:00.000Z"),
  });
  assert.match(resolved.archivePath, /changes\/archive\/captures\/2026-07-28-small-observation\.md$/);
  assert.deepEqual(resolved.destinations, ["knowledge/references/captured-observation.md"]);
  const archived = await readFile(resolved.archivePath, "utf8");
  assert.match(archived, /status: routed/);
  assert.match(archived, /knowledge\/references\/captured-observation\.md/);
  assert.equal((await listCaptures(knowledge)).captures.length, 0);

  const repeated = await createCapture({
    target: leaf,
    slug: "small-observation",
    title: "A later observation with the same slug",
    distributionRoot,
    now: new Date("2026-07-28T10:04:30.000Z"),
  });
  assert.equal(repeated.id, "2026-07-28-small-observation-2");
  await resolveCapture({
    target: leaf,
    id: repeated.id,
    outcome: "discarded",
    reason: "Duplicate finding.",
  });

  const legacyPath = join(knowledge, "changes/inbox/2026-07-28-legacy-note.md");
  await writeFile(
    legacyPath,
    `---
handoff_version: 1
id: 2026-07-28-legacy-note
title: Legacy note
status: inbox
created_at: 2026-07-28T09:00:00.000Z
source: {}
claim_refs: []
---

# Summary

Legacy material.
`,
    "utf8",
  );
  assert.equal((await listCaptures(knowledge)).captures[0]?.legacy, true);
  const migrated = await resolveCapture({
    target: knowledge,
    id: "2026-07-28-legacy-note",
    outcome: "discarded",
    reason: "Legacy input was reviewed and is no longer useful.",
  });
  const migratedContent = await readFile(migrated.archivePath, "utf8");
  assert.match(migratedContent, /capture_version: 1/);
  assert.doesNotMatch(migratedContent, /handoff_version/);

  const projectOnly = await createCapture({
    target: knowledge,
    slug: "raw-proposal",
    title: "Raw proposal",
    distributionRoot,
    now: new Date("2026-07-28T10:05:00.000Z"),
  });
  assert.equal(projectOnly.codeRoot, undefined);
  assert.equal(projectOnly.knowledgeRoot, await realpath(knowledge));
  assert.match(projectOnly.path, /changes\/inbox\/2026-07-28-raw-proposal\.md$/);
  assert.match(await readFile(projectOnly.path, "utf8"), /status: pending/);
  const discarded = await resolveCapture({
    target: knowledge,
    id: projectOnly.id,
    outcome: "discarded",
    reason: "No material claim survived review.",
    now: new Date("2026-07-28T10:06:00.000Z"),
  });
  assert.match(discarded.archivePath, /changes\/archive\/captures\/2026-07-28-raw-proposal\.md$/);
  assert.match(await readFile(discarded.archivePath, "utf8"), /status: discarded/);
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
  await completeWorkDocument(document, "project", knowledge, started.id);
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await updateWorkCheckpoint({
    target: knowledge,
    id: started.id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "Project-only work is ready for final review.",
    lastCompleted: "Knowledge change and verification evidence completed.",
    nextAction: "Review the current change record and close the bundle.",
  });
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
  await completeWorkDocument(document, "multi-repo", knowledge, started.id);
  const sources = [readRepositoryMetadata(api), readRepositoryMetadata(client)];
  const verification = document.metadata.verification as Record<string, unknown>;
  verification.repositories = sources.map((source) => ({
    repository: source.repository,
    revision: source.commit,
    worktree_id: source.worktreeId,
    checks: [{ command: `test ${source.repository}`, result: "passed" }],
  }));
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  await updateWorkCheckpoint({
    target: knowledge,
    id: started.id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "All selected leaf revisions are ready for final review.",
    lastCompleted: "Multi-repository verification receipts recorded.",
    nextAction: "Review the current bundle and close the coordinated change.",
  });
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

test("clean-session context discovers only an unambiguous active binding", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-context-discovery-"));
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

  await assert.rejects(
    workBundleContext(leaf, undefined, "resume"),
    /No active work records are bound/,
  );

  const first = await beginWork({
    target: leaf,
    slug: "first-resume",
    title: "First resumable outcome",
    mode: "full",
    distributionRoot,
  });
  const discovered = await workBundleContext(leaf, undefined, "resume");
  assert.equal(discovered.id, first.id);
  assert.deepEqual(
    discovered.requiredFiles.map((entry) => entry.path),
    ["change.md"],
  );
  const firstDocument = parseWorkSpec(await readFile(first.specPath, "utf8"));
  firstDocument.body = firstDocument.body.replace(
    "# Knowledge alignment",
    "## DISC-001 — Incomplete discovery\n\n- **Observation:** A consequential fact.\n\n# Knowledge alignment",
  );
  await writeFile(first.specPath, serializeWorkSpec(firstDocument), "utf8");
  assert.ok(
    (await workBundleContext(leaf, first.id, "resume")).validationIssues.some(
      (issue) => /DISC-001 requires a non-empty Evidence field/.test(issue),
    ),
  );
  firstDocument.body = firstDocument.body.replace(
    "## DISC-001 — Incomplete discovery\n\n- **Observation:** A consequential fact.",
    `## DISC-001 — Complete discovery

- **Observation:** A consequential fact.
- **Evidence:** Direct inspection at the bound revision.
- **Implication:** The next action must change.
- **Scope:** This active change until the invariant is replaced.
- **Disposition:** Owned by this change and pending verification.`,
  );
  await writeFile(first.specPath, serializeWorkSpec(firstDocument), "utf8");
  assert.equal(
    (await workBundleContext(leaf, first.id, "resume")).validationIssues.some(
      (issue) => /DISC-001 requires/.test(issue),
    ),
    false,
  );
  firstDocument.body = firstDocument.body.replace(
    /^# Discovery ledger\s*$/m,
    "# Removed discovery ledger",
  );
  await writeFile(first.specPath, serializeWorkSpec(firstDocument), "utf8");
  assert.ok(
    (await workBundleContext(leaf, first.id, "resume")).validationIssues.some(
      (issue) => /Discovery ledger section is required/.test(issue),
    ),
  );
  firstDocument.metadata.workflow_version = 4;
  await writeFile(first.specPath, serializeWorkSpec(firstDocument), "utf8");
  assert.equal(
    (await workBundleContext(leaf, first.id, "resume")).validationIssues.some(
      (issue) => /Discovery ledger section is required/.test(issue),
    ),
    false,
  );

  const second = await beginWork({
    target: leaf,
    slug: "second-resume",
    title: "Second resumable outcome",
    mode: "full",
    distributionRoot,
  });
  await assert.rejects(
    workBundleContext(leaf, undefined, "resume"),
    new RegExp(`Multiple active work records.*${first.id}.*${second.id}.*do not guess`),
  );
  assert.equal((await workBundleContext(leaf, second.id, "resume")).id, second.id);
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
  assert.ok(
    (await workBundleContext(leaf, started.id, "shape")).validationIssues.some((issue) =>
      /checkpoint is stale/.test(issue)
    ),
  );
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    stage: "implement",
    currentState: "Acceptance and recovery semantics are specified for issue splitting.",
    lastCompleted: "Specification updated with the bottom-of-file requirement.",
    nextAction: "Create and execute the delivery frontier.",
  });
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
  assert.match(
    (await readFile(join(started.bundleRoot, first.path), "utf8")),
    /^# Discovery ledger\s*$/m,
  );
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
  // Implementation may not start on a framing nobody accepted. Asking at the
  // first delivery claim is the whole point: the same decision, at a moment
  // when no work is parked waiting for it.
  await assert.rejects(
    claimWorkIssue({
      target: leaf,
      id: started.id,
      issueId: first.id,
      actor: "agent:test-session",
    }),
    /framing is not approved/,
  );
  // Framing approval now rests on the framing itself: what curated knowledge
  // says about the work, and what each bound repository declares about itself.
  // Prepare both so this test reaches what it is actually about.
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
    note: "Framing accepted in a terminal.",
  });
  // Approving edits change.md, so its checkpoint and its read receipt both go
  // stale — the documented consequence, now exercised on the path that meets it.
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    stage: "implement",
    currentState: "Framing is approved and the first slice is ready to claim.",
    lastCompleted: "Recorded the maintainer's framing approval.",
    nextAction: "Claim the first delivery issue.",
  });
  await reviewWorkBundleFile(leaf, started.id, "change.md", "reviewed", "");
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
  claimedDocument.body += "\nImplemented the first behavior-first step.\n";
  await writeFile(
    join(started.bundleRoot, first.path),
    serializeWorkSpec(claimedDocument),
    "utf8",
  );
  assert.ok(
    (await workBundleContext(leaf, started.id, "implement", first.id)).validationIssues.some(
      (issue) => /checkpoint is stale/.test(issue),
    ),
  );
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    issueId: first.id,
    actor: "agent:test-session",
    status: "active",
    currentState: "The first behavior-first step is implemented and awaiting final checks.",
    lastCompleted: "Implemented the first behavior-first step.",
    nextAction: "Run focused checks and complete this issue with evidence.",
  });
  assert.equal(
    (await workBundleContext(leaf, started.id, "implement", first.id)).checkpoints
      .find((entry) => entry.issue === first.id)?.valid,
    true,
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
  await updateWorkCheckpoint({
    target: knowledge,
    id: started.id,
    actor: "agent:wayfinder-test",
    status: "active",
    stage: "review",
    currentState: "Wayfinder answers are synthesized into bounded acceptance.",
    lastCompleted: "Fog cleared and delivery acceptance drafted.",
    nextAction: "Review every current bundle file and finish Wayfinder.",
  });
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

/**
 * Record both maintainer approvals through the approval module and mirror the
 * resulting receipts into the in-memory document, so a test may keep editing
 * the record without losing the receipt binding.
 */
async function recordMaintainerApprovals(
  document: ReturnType<typeof parseWorkSpec>,
  knowledge: string,
  id: string,
): Promise<void> {
  const knowledgeRoot = await realpath(knowledge);
  const review: Record<string, unknown> = {};
  const stages = [
    ["framing", "2026-07-28T10:05:00.000Z"],
    ["completion", "2026-07-28T11:55:00.000Z"],
  ] as const;
  for (const [stage, at] of stages) {
    const record = await recordApproval({
      knowledgeRoot,
      id,
      stage,
      by: "human:test-maintainer",
      method: "token",
      now: new Date(at),
    });
    review[stage] = {
      status: "approved",
      by: record.by,
      at: record.at,
      method: record.method,
      receipt: record.receipt,
      notes: [],
    };
  }
  document.metadata.maintainer_review = review;
}

async function completeWorkDocument(
  document: ReturnType<typeof parseWorkSpec>,
  scope: "project" | "multi-repo",
  knowledge: string,
  id: string,
): Promise<void> {
  await recordMaintainerApprovals(document, knowledge, id);
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
  accountEveryRepository(document);
  document.metadata.graph_evidence = {
    queries: scope === "project" ? [] : ["Trace the shared contract"],
  };
  document.metadata.knowledge_promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The reviewed work changes no durable project meaning.",
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

test("keeps the bundle template inside the enforced completion gate", async () => {
  const template = parseWorkSpec(
    await readFile(
      join(distributionRoot, "skills/manage-project-work/assets/work-spec.md"),
      "utf8",
    ),
  );
  const version = Number(template.metadata.workflow_version);
  assert.equal(version, CURRENT_CHANGE_VERSION);
  assert.ok(
    includesVersion(SUPPORTED_CHANGE_VERSIONS, version),
    `work-spec.md workflow_version ${version} is not a supported change schema`,
  );
  assert.ok(
    includesVersion(GATED_CHANGE_VERSIONS, version),
    `work-spec.md workflow_version ${version} is outside GATED_CHANGE_VERSIONS, so `
      + "bundleCompletionIssues would silently skip the whole completion gate",
  );

  const issue = parseWorkSpec(
    await readFile(
      join(distributionRoot, "skills/manage-project-work/assets/work-issue.md"),
      "utf8",
    ),
  );
  assert.ok(
    includesVersion(SUPPORTED_ISSUE_VERSIONS, Number(issue.metadata.workflow_version)),
  );
});

test("enforces the bundle completion gate on the current schema", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-gate-"));
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
    slug: "gate-regression",
    title: "Gate regression",
    mode: "full",
    distributionRoot,
    now: new Date("2026-08-01T10:00:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
  assert.equal(Number(document.metadata.workflow_version), CURRENT_CHANGE_VERSION);
  document.metadata.status = "completed";
  document.metadata.acceptance = [{
    id: "AC-01",
    criterion: "Never actually delivered.",
    status: "pending",
  }];
  const source = readRepositoryMetadata(leaf);
  document.metadata.verification = {
    result: "passed",
    revision: source.commit,
    worktree_id: source.worktreeId,
    acceptance_reviewed: true,
    implementation_reviewed: true,
    checks: [{ command: "true", result: "passed" }],
    acceptance: [],
    unresolved: [],
  };
  await recordMaintainerApprovals(document, knowledge, started.id);
  document.metadata.knowledge_promotion = {
    status: "not-needed",
    concepts: [],
    reason: "Nothing durable changed.",
  };
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  accountEveryRepository(document);
  document.metadata.graph_evidence = { queries: ["Trace the gate"] };
  document.body = document.body.replaceAll("- [ ]", "- [x]");
  await writeFile(started.specPath, serializeWorkSpec(document), "utf8");

  const repository = String(
    ((document.metadata.repositories as Record<string, unknown>[])[0]!).repository,
  );
  await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "never-done",
    title: "Never done",
    phase: "delivery",
    type: "delivery",
    satisfies: ["AC-01"],
    repositories: [repository],
    distributionRoot,
  });
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test",
    status: "active",
    stage: "review",
    currentState: "Deliberately incomplete bundle awaiting the gate.",
    lastCompleted: "Created one delivery issue and left it open.",
    nextAction: "Confirm that the completion gate refuses this bundle.",
    now: new Date("2026-08-01T10:07:00.000Z"),
  });
  await reviewWorkBundleFile(leaf, started.id, "change.md", "reviewed", "");

  const verified = await verifyWork(leaf, started.id);
  for (const expected of [
    "acceptance AC-01 must be verified",
    "verification.acceptance must contain passed evidence for AC-01",
    "ISSUE-001 is not completed or dropped",
    "issues/ISSUE-001-never-done.md is unseen in bundle review",
  ]) {
    assert.ok(
      verified.issues.includes(expected),
      `completion gate did not report "${expected}"; got ${JSON.stringify(verified.issues)}`,
    );
  }
  await assert.rejects(
    closeWork({
      target: leaf,
      id: started.id,
      outcome: "completed",
      now: new Date("2026-08-01T10:10:00.000Z"),
    }),
    /Completed close is blocked/,
  );
});

test("binds maintainer approval to a receipt wfctl work approve produced", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-approval-"));
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
    slug: "approval-receipt",
    title: "Approval receipt",
    mode: "full",
    distributionRoot,
    now: new Date("2026-08-01T10:00:00.000Z"),
  });

  await assert.rejects(
    approveWork({
      target: leaf,
      id: started.id,
      stage: "framing",
      by: "agent:impersonator",
      method: "token",
    }),
    /requires --by human:/,
  );

  // Framing approval now rests on the framing itself: what curated knowledge
  // says about the work, and what each bound repository declares about itself.
  // Prepare both so this test reaches what it is actually about.
  await prepareFraming(started.specPath);

  const approval = await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
    note: "Framing accepted in a terminal.",
    now: new Date("2026-08-01T10:05:00.000Z"),
  });
  assert.match(approval.receipt, /^[0-9a-f]{64}$/);
  const approved = parseWorkSpec(await readFile(started.specPath, "utf8"));
  const framing = (approved.metadata.maintainer_review as Record<string, unknown>)
    .framing as Record<string, unknown>;
  assert.equal(framing.status, "approved");
  assert.equal(framing.method, "interactive");
  assert.equal(framing.receipt, approval.receipt);
  assert.deepEqual(framing.notes, ["Framing accepted in a terminal."]);
  await access(approvalRecordPath(await realpath(knowledge), started.id, "framing"));

  // A hand-written receipt that no approval command produced must not pass.
  framing.receipt = "f".repeat(64);
  await writeFile(started.specPath, serializeWorkSpec(approved), "utf8");
  assert.ok(
    (await verifyWork(leaf, started.id)).issues.includes(
      "maintainer_review.framing.receipt does not match the recorded approval",
    ),
  );

  // So must a receipt whose recorded approval was never made at all.
  const invented = parseWorkSpec(await readFile(started.specPath, "utf8"));
  (invented.metadata.maintainer_review as Record<string, unknown>).completion = {
    status: "approved",
    by: "human:test-maintainer",
    at: "2026-08-01T11:00:00.000Z",
    method: "interactive",
    receipt: "a".repeat(64),
    notes: [],
  };
  await writeFile(started.specPath, serializeWorkSpec(invented), "utf8");
  assert.ok(
    (await verifyWork(leaf, started.id)).issues.includes(
      "maintainer_review.completion.receipt has no recorded approval; "
        + "re-run wfctl work approve --stage completion",
    ),
  );
});

/**
 * Mark every bound repository as read on its own terms.
 *
 * Framing approval and completion both refuse a bundle whose repositories were
 * never looked at, which is the point of that gate; these fixtures are testing
 * other things and would otherwise all fail on it.
 */
function accountEveryRepository(document: ReturnType<typeof parseWorkSpec>): void {
  const repositories = Array.isArray(document.metadata.repositories)
    ? document.metadata.repositories
    : [];
  for (const entry of repositories) {
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

/** Fill what a framing must rest on before anyone may approve it. */
async function prepareFraming(specPath: string): Promise<void> {
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  accountEveryRepository(document);
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
}
