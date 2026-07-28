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
import { writeKnowledgeGraph } from "../src/knowledge-graph.js";
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
x-wf:
  relations: []
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
  await writeFile(
    join(target, "knowledge/decisions/index.md"),
    "# Cross-area Decisions\n\n- [Current loop authority](current-loop.md)\n",
    "utf8",
  );

  const valid = await validateKnowledge(target);
  assert.equal(valid.valid, true);
  const built = await writeKnowledgeGraph(target);
  assert.equal(built.graph.stats.concepts, 1);
  assert.ok(built.graph.edges.some((edge) =>
    edge.source === "knowledge/decisions/index"
    && edge.target === "knowledge/decisions/current-loop"
    && edge.origin === "markdown"
  ));
  await access(built.path);
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
  await writeFile(
    join(target, "knowledge/areas/index.md"),
    "# Areas\n\n- [Combat](combat/)\n",
    "utf8",
  );
  await writeFile(
    join(target, "knowledge/areas/combat/index.md"),
    "# Combat\n\n- [Decisions](decisions/)\n",
    "utf8",
  );
  await writeFile(
    join(decisions, "index.md"),
    "# Combat decisions\n\n- [No revival](no-revival.md)\n- [Item revival](item-revival.md)\n",
    "utf8",
  );
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
area: combat
supersedes: ${JSON.stringify(supersedes)}
superseded_by: ${JSON.stringify(supersededBy)}
authority: [decision]
generated: { by: workflow-agent/1, at: 2026-07-28T11:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-28T11:00:00Z }
x-wf:
  relations: []
sources:
  - id: revival-decision
    kind: maintainer-decision
    resource: project-change:${changeId}#decision
    author: "human:test-maintainer"
---

# Decision

${title}.[^revival-decision]

# Relationships

- [Combat Area](../index.md)
${supersedes.map((path) => `- [Predecessor](${path})`).join("\n")}
${supersededBy ? `- [Successor](${supersededBy})` : ""}

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

test("compiles explicit knowledge relations without inferring semantic edges", async () => {
  const target = await initializedKnowledgeRepository("wfctl-knowledge-graph-");
  const references = join(target, "knowledge/references");
  const concept = (
    title: string,
    relation: string,
    bodyLink: string,
  ) => `---
type: External Reference
title: ${title}
description: A test reference.
status: draft
authority: [external]
generated: { by: workflow-agent/1, at: 2026-07-28T12:00:00Z }
x-wf:
  relations: ${relation}
sources:
  - id: primary
    kind: external-primary
    resource: https://example.com/${title.toLowerCase().replaceAll(" ", "-")}
---

# ${title}

This concept records a primary external fact.[^primary]

${bodyLink}

[^primary]: Primary test source.
`;
  await writeFile(
    join(references, "index.md"),
    "# References\n\n- [Alpha](alpha.md)\n- [Beta](beta.md)\n",
    "utf8",
  );
  await writeFile(
    join(references, "alpha.md"),
    concept(
      "Alpha",
      `\n    - kind: related-to\n      target: knowledge/references/beta.md\n      context: >-\n        Alpha and Beta describe adjacent externally sourced concepts whose\n        relationship is useful for navigation but does not establish truth.`,
      "[Related Beta](beta.md)",
    ),
    "utf8",
  );
  await writeFile(
    join(references, "beta.md"),
    concept("Beta", "[]", ""),
    "utf8",
  );

  assert.equal((await validateKnowledge(target)).valid, true);
  const built = await writeKnowledgeGraph(target);
  const firstArtifact = await readFile(built.path, "utf8");
  await writeKnowledgeGraph(target);
  assert.equal(await readFile(built.path, "utf8"), firstArtifact);
  assert.ok(built.graph.edges.some((edge) =>
    edge.source === "knowledge/references/alpha"
    && edge.target === "knowledge/references/beta"
    && edge.kind === "related-to"
    && edge.origin === "x-wf"
  ));
  assert.ok(!built.graph.edges.some((edge) => edge.kind === "semantically-similar"));

  await writeFile(
    join(references, "alpha.md"),
    concept(
      "Alpha",
      `\n    - kind: related-to\n      target: knowledge/references/beta.md\n      context: The relation remains authored but is hidden from human navigation.`,
      "",
    ),
    "utf8",
  );
  const hidden = await validateKnowledge(target);
  assert.ok(hidden.errors.some((issue) =>
    /must also appear as a Markdown link/.test(issue.message)
  ));

  await writeFile(
    join(references, "alpha.md"),
    concept("Alpha", "[]", "[Missing](missing.md)"),
    "utf8",
  );
  const broken = await validateKnowledge(target);
  assert.ok(broken.errors.some((issue) =>
    /internal Markdown link does not resolve/.test(issue.message)
  ));
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
