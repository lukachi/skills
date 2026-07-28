import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import {
  beginIntakeCase,
  closeIntakeCase,
  inspectIntakeCase,
  inventoryRaw,
  markIntakeSource,
} from "../src/intake.js";
import { validateKnowledge } from "../src/knowledge.js";
import { buildInstallPlan } from "../src/planner.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("freezes intake coverage to exact Git blobs and detects working-tree drift", async () => {
  const target = await initializedKnowledgeRepository("wfctl-intake-");
  await mkdir(join(target, "raw/notes"), { recursive: true });
  await writeFile(
    join(target, "raw/notes/history.md"),
    "---\ntitle: Old notes\n---\n\n# First\n\nA claim.\n\n## Detail\n\nMore.\n",
    "utf8",
  );
  await writeFile(join(target, "raw/blob.bin"), Buffer.from([0, 1, 2, 3]));
  commitAll(target, "add legacy input");
  const unseen = await inventoryRaw({ target });
  assert.deepEqual(
    unseen.entries.map((entry) => [entry.path, entry.state]),
    [
      ["raw/blob.bin", "unseen"],
      ["raw/notes/history.md", "unseen"],
    ],
  );

  const started = await beginIntakeCase({
    target,
    slug: "legacy-loop",
    title: "Legacy loop",
    paths: ["raw/notes", "raw/blob.bin"],
    distributionRoot,
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  assert.equal(started.files, 2);
  assert.match(started.baseline, /^[0-9a-f]{40}$/);
  const initial = parseWorkSpec(await readFile(started.path, "utf8"));
  const sources = initial.metadata.sources as Array<Record<string, unknown>>;
  assert.deepEqual(
    sources.map((source) => source.path),
    ["raw/blob.bin", "raw/notes/history.md"],
  );
  assert.ok(sources.every((source) => /^[0-9a-f]{40}$/.test(String(source.object_id))));
  assert.ok((await inventoryRaw({ target })).entries.every((entry) => entry.state === "active"));

  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/blob.bin",
    status: "no-relevant-claims",
    note: "Opaque artifact contains no reviewable project claim.",
    now: new Date("2026-07-28T12:10:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/notes/history.md",
    status: "reviewed",
    candidateIds: ["legacy-loop-claim"],
    note: "Read in full; one implementation claim requires adjudication.",
    now: new Date("2026-07-28T12:20:00.000Z"),
  });
  const reviewed = parseWorkSpec(await readFile(started.path, "utf8"));
  reviewed.metadata.candidate_claims = [{
    id: "legacy-loop-claim",
    claim: "The legacy notes describe a loop.",
    authority: "implementation",
    disposition: "unresolved",
  }];
  reviewed.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The candidate was rejected after source verification.",
    validation: "not-needed",
  };
  reviewed.metadata.omission_audit = {
    result: "passed",
    notes: ["Every frozen file was read or explicitly classified."],
  };
  await writeFile(started.path, serializeWorkSpec(reviewed), "utf8");
  assert.ok(
    (await inspectIntakeCase(target, started.id)).issues.some(
      (issue) => issue === "candidate_claims[0].disposition remains unresolved",
    ),
  );
  await assert.rejects(
    closeIntakeCase({
      target,
      id: started.id,
      outcome: "completed",
      now: new Date("2026-07-28T12:25:00.000Z"),
    }),
    /disposition remains unresolved/,
  );

  reviewed.metadata.candidate_claims = [{
    id: "legacy-loop-claim",
    claim: "The legacy notes describe a loop.",
    authority: "implementation",
    disposition: "rejected",
  }];
  await writeFile(started.path, serializeWorkSpec(reviewed), "utf8");
  assert.deepEqual((await inspectIntakeCase(target, started.id)).issues, []);

  await writeFile(
    join(target, "raw/notes/history.md"),
    "---\ntitle: Old notes\n---\n\n# First\n\nA changed claim.\n\n## Detail\n\nMore.\n",
    "utf8",
  );
  const changed = await inspectIntakeCase(target, started.id);
  assert.ok(changed.issues.some((issue) => /uncommitted changes/.test(issue)));
  assert.deepEqual((await inventoryRaw({ target })).uncommitted, ["raw/notes/history.md"]);
  commitAll(target, "change raw source");
  const changedInventory = await inventoryRaw({ target });
  assert.equal(
    changedInventory.entries.find((entry) => entry.path === "raw/notes/history.md")?.state,
    "changed",
  );
});

test("validates the strict curated knowledge trust profile", async () => {
  const target = await initializedKnowledgeRepository("wfctl-knowledge-validation-");
  const conceptPath = join(target, "knowledge/decisions/current-loop.md");
  await mkdir(
    join(target, "changes/archive/2026-07-28-world-loop"),
    { recursive: true },
  );
  await writeFile(
    join(target, "changes/archive/2026-07-28-world-loop/change.md"),
    `---
id: 2026-07-28-world-loop
status: completed
outcome: completed
maintainer_review:
  framing:
    status: approved
    by: human:test-maintainer
    at: 2026-07-28T11:00:00Z
  completion:
    status: approved
    by: human:test-maintainer
    at: 2026-07-28T12:00:00Z
verification:
  result: passed
---

Reviewed project change.
`,
    "utf8",
  );
  const validContent = `---
type: Architecture Decision
title: Current loop authority
status: stable
decision_id: current-loop-authority
effective_at: 2026-07-28T12:05:00Z
supersedes: []
superseded_by: ""
authority: [decision]
generated: { by: workflow-agent/1, at: 2026-07-28T12:00:00Z }
verified: { by: human:test-maintainer, at: 2026-07-28T12:05:00Z }
sources:
  - id: loop-decision
    kind: maintainer-decision
    resource: project-change:2026-07-28-world-loop#decision
    author: human:test-maintainer
---

# Decision

The world loop is server-authoritative.[^loop-decision]

[^loop-decision]: Reviewed world-loop decision.
`;
  await writeFile(conceptPath, validContent, "utf8");

  const valid = await validateKnowledge(target);
  assert.equal(valid.valid, true);
  const archivedPath = join(
    target,
    "changes/archive/2026-07-28-world-loop/change.md",
  );
  const archivedContent = await readFile(archivedPath, "utf8");
  await writeFile(
    archivedPath,
    `${archivedContent}\nLegacy locator: raw/old-spec.md\n`,
    "utf8",
  );
  const taintedChange = await validateKnowledge(target);
  assert.ok(taintedChange.errors.some((issue) =>
    /project change that cites raw or intake/.test(issue.message)
  ));
  await writeFile(archivedPath, archivedContent, "utf8");

  await writeFile(
    conceptPath,
    (await readFile(conceptPath, "utf8")).replace(
      "project-change:2026-07-28-world-loop#decision",
      "../raw/old-spec.md",
    ),
    "utf8",
  );
  const invalid = await validateKnowledge(target);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((issue) => /must not reference raw\/ or intake/.test(issue.message)));

  await writeFile(
    conceptPath,
    validContent.replace(
      "generated: { by: workflow-agent/1, at: 2026-07-28T12:00:00Z }",
      "generated: { by: workflow-agent/1, at: 2026-07-28T13:00:00Z }",
    ),
    "utf8",
  );
  const stale = await validateKnowledge(target);
  assert.ok(stale.errors.some((issue) => /verification at or after generated/.test(issue.message)));

  await writeFile(conceptPath, validContent, "utf8");
  await writeFile(
    join(target, "knowledge/architecture/runtime.md"),
    `---
type: Architecture
title: Runtime implementation
status: draft
authority: [implementation]
generated: { by: workflow-agent/1, at: 2026-07-28T12:00:00Z }
sources:
  - id: runtime-code
    kind: source-code
    resource: git:dnd-api@main#src/runtime.ts
---

# Runtime

The runtime uses the current implementation.[^runtime-code]

[^runtime-code]: Runtime source.
`,
    "utf8",
  );
  const unpinned = await validateKnowledge(target);
  assert.ok(unpinned.errors.some((issue) => /must pin repository, full commit/.test(issue.message)));

  await writeFile(
    join(target, "knowledge/decisions/world-loop-history.md"),
    `---
type: Project History
title: World loop history
status: draft
authority: [history]
generated: { by: workflow-agent/1, at: 2026-07-28T12:00:00Z }
sources:
  - id: archived-loop
    kind: archived-change
    resource: project-change:2026-07-28-world-loop#summary
  - id: loop-commit
    kind: version-control
    resource: git:dnd-api@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
---

# History

The reviewed change established the recorded history.[^archived-loop][^loop-commit]

[^archived-loop]: Archived world-loop change.
[^loop-commit]: Pinned world-loop commit.
`,
    "utf8",
  );
  await writeFile(
    archivedPath,
    (await readFile(archivedPath, "utf8")).replace(
      "outcome: completed",
      "outcome: partial",
    ),
    "utf8",
  );
  const partialHistory = await validateKnowledge(target);
  assert.ok(partialHistory.errors.some((issue) =>
    /completed, human-reviewed archived change/.test(issue.message)
  ));
});

test("runs a bounded legacy reconciliation case lifecycle", async () => {
  const target = await initializedKnowledgeRepository("wfctl-intake-case-");
  await writeFile(join(target, "raw/history.md"), "# Claim\n\nLegacy statement.\n", "utf8");
  commitAll(target, "add history");

  const started = await beginIntakeCase({
    target,
    slug: "legacy-loop",
    title: "Legacy loop",
    distributionRoot,
    now: new Date("2026-07-28T11:00:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/history.md",
    status: "no-relevant-claims",
    note: "Read in full; no independently verifiable durable claim.",
    now: new Date("2026-07-28T11:30:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.path, "utf8"));
  document.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The scoped material yielded no authoritative project claim.",
    validation: "not-needed",
  };
  document.metadata.omission_audit = {
    result: "passed",
    notes: ["The only scoped section has an explicit disposition."],
  };
  await writeFile(started.path, serializeWorkSpec(document), "utf8");
  assert.deepEqual((await inspectIntakeCase(target, started.id)).issues, []);

  const closed = await closeIntakeCase({
    target,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:00:00.000Z"),
  });
  await access(join(closed.archivePath, "case.md"));
  await assert.rejects(access(started.path));
});

test("validates reciprocal acyclic decision evolution", async () => {
  const target = await initializedKnowledgeRepository("wfctl-decision-lineage-");
  const changeId = "2026-07-28-revival-rule";
  await mkdir(join(target, "changes/archive", changeId), { recursive: true });
  await writeFile(
    join(target, "changes/archive", changeId, "change.md"),
    `---
id: ${changeId}
status: completed
outcome: completed
maintainer_review:
  framing: { status: approved, by: "human:test-maintainer", at: 2026-07-28T10:00:00Z }
  completion: { status: approved, by: "human:test-maintainer", at: 2026-07-28T11:00:00Z }
verification: { result: passed }
---

Reviewed revival rule.
`,
    "utf8",
  );
  const decisions = join(target, "knowledge/areas/combat/decisions");
  await mkdir(decisions, { recursive: true });
  const oldPath = "knowledge/areas/combat/decisions/no-revival.md";
  const currentPath = "knowledge/areas/combat/decisions/item-revival.md";
  const decision = (
    id: string,
    title: string,
    status: "stable" | "deprecated",
    supersedes: string[],
    supersededBy: string,
  ) => `---
type: Decision
title: ${title}
status: ${status}
decision_id: ${id}
effective_at: 2026-07-28T11:00:00Z
supersedes: ${JSON.stringify(supersedes)}
superseded_by: ${JSON.stringify(supersededBy)}
authority: [decision]
generated: { by: workflow-agent/1, at: 2026-07-28T11:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-28T11:00:00Z }
sources:
  - id: revival-decision
    kind: maintainer-decision
    resource: project-change:${changeId}#decision
    author: "human:test-maintainer"
---

# Decision

${title}.[^revival-decision]

[^revival-decision]: Reviewed maintainer decision.
`;
  await writeFile(
    join(target, oldPath),
    decision("no-revival", "No revival", "deprecated", [], currentPath),
    "utf8",
  );
  await writeFile(
    join(target, currentPath),
    decision("item-revival", "Item revival", "stable", [oldPath], ""),
    "utf8",
  );
  assert.equal((await validateKnowledge(target)).valid, true);

  await writeFile(
    join(target, currentPath),
    decision("item-revival", "Item revival", "stable", [], ""),
    "utf8",
  );
  const nonReciprocal = await validateKnowledge(target);
  assert.ok(nonReciprocal.errors.some((issue) => /reciprocally list/.test(issue.message)));

  await writeFile(
    join(target, oldPath),
    decision("no-revival", "No revival", "deprecated", [currentPath], currentPath),
    "utf8",
  );
  await writeFile(
    join(target, currentPath),
    decision("item-revival", "Item revival", "deprecated", [oldPath], oldPath),
    "utf8",
  );
  const cyclic = await validateKnowledge(target);
  assert.ok(cyclic.errors.some((issue) => /contains a cycle/.test(issue.message)));
});

async function initializedKnowledgeRepository(prefix: string): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), prefix));
  execFileSync("git", ["-C", target, "init", "-q"]);
  execFileSync("git", ["-C", target, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", target, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", target, "config", "commit.gpgsign", "false"]);
  await applyInstallPlan(await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  }));
  commitAll(target, "initialize workflow");
  return target;
}

function commitAll(target: string, message: string): void {
  execFileSync("git", ["-C", target, "add", "."]);
  execFileSync("git", ["-C", target, "commit", "-q", "-m", message]);
}
