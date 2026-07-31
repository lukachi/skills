import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { createCapture } from "../src/capture.js";
import {
  beginIntakeCase,
  closeIntakeCase,
  inspectIntakeCase,
  inventoryRaw,
  markIntakeSource,
  migrateIntakeCase,
  recordIntakeProbe,
} from "../src/intake.js";
import {
  hashKnowledgeConcept,
  validateKnowledge,
} from "../src/knowledge.js";
import { writeKnowledgeGraph } from "../src/knowledge-graph.js";
import {
  compileClaimLedger,
  writeClaimLedger,
} from "../src/claim-ledger.js";
import { buildInstallPlan } from "../src/planner.js";
import {
  beginProjectReconstruction,
  closeProjectReconstruction,
  inspectProjectReconstruction,
  markReconstructionCommunity,
  markReconstructionFiles,
  readReconstructionSource,
  recordReconstructionSurface,
  reviewReconstructionSurfaces,
} from "../src/reconstruction.js";
import { addLeafRepository } from "../src/repository-registry.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function intakeClaim(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "candidate",
    claim: "Atomic candidate claim.",
    claim_class: "implementation",
    semantic_role: "observation",
    intent_state: "not-applicable",
    delivery_state: "verified",
    alignment: "not-applicable",
    temporal: {
      captured_at: "2026-07-28T12:20:00.000Z",
      asserted_at: "",
      valid_from: "",
      valid_to: "",
    },
    relations: {
      supersedes: [],
      superseded_by: [],
      contradicts: [],
      refines: [],
      implements: [],
      derived_from: [],
    },
    evidence: [],
    disposition: "unresolved",
    reason: "Verification remains incomplete.",
    maintainer_decision: {
      status: "not-needed",
      by: "",
      at: "",
    },
    routing: {
      lane: "case-only",
      destinations: [],
    },
    ...overrides,
  };
}

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
  reviewed.metadata.candidate_claims = [intakeClaim({
    id: "legacy-loop-claim",
    claim: "The legacy notes describe a loop.",
    disposition: "unresolved",
    reason: "Source verification is still required.",
  })];
  reviewed.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The candidate was rejected after source verification.",
    validation: "not-needed",
  };
  reviewed.metadata.omission_audit = {
    result: "passed",
    notes: ["Every frozen file was read or explicitly classified."],
    probes: [],
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

  reviewed.metadata.candidate_claims = [intakeClaim({
    id: "legacy-loop-claim",
    claim: "The legacy notes describe a loop.",
    disposition: "confirmed",
    evidence: [],
    intent_state: "accepted",
    routing: {
      lane: "current-knowledge",
      destinations: ["knowledge/architecture/legacy-loop.md"],
    },
  })];
  reviewed.metadata.promotion = {
    status: "applied",
    concepts: ["knowledge/architecture/legacy-loop.md"],
    reason: "",
    validation: "passed",
  };
  await writeFile(started.path, serializeWorkSpec(reviewed), "utf8");
  assert.ok(
    (await inspectIntakeCase(target, started.id)).issues.some(
      (issue) => /confirmed implementation requires pinned source-code evidence/.test(issue),
    ),
  );

  reviewed.metadata.candidate_claims = [intakeClaim({
    id: "legacy-loop-claim",
    claim: "The legacy notes describe a loop.",
    disposition: "rejected",
    reason: "Pinned source inspection disproved the raw candidate.",
  })];
  reviewed.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The candidate was rejected after source verification.",
    validation: "not-needed",
  };
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

test("reviewed reconstruction raw input must converge at its frozen baseline", async () => {
  const target = await initializedKnowledgeRepository("wfctl-raw-convergence-");
  await mkdir(join(target, "raw"), { recursive: true });
  await writeFile(
    join(target, "raw/idea.md"),
    "# Idea\n\nA historical idea with no current product authority.\n",
    "utf8",
  );
  commitAll(target, "add raw idea");
  const leaf = await initializedLeafRepository(
    "wfctl-raw-convergence-leaf-",
    target,
  );
  const reconstruction = await beginProjectReconstruction({
    target,
    slug: "raw-convergence",
    title: "Raw convergence baseline",
    leaves: [leaf],
    distributionRoot,
    runner: graphifyFixtureRunner,
    now: new Date("2026-07-28T12:30:00.000Z"),
  });
  const caseDocument = parseWorkSpec(
    await readFile(reconstruction.path, "utf8"),
  );
  const supplemental = caseDocument.metadata.supplemental_inputs as Record<
    string,
    Record<string, unknown>
  >;
  supplemental.raw!.status = "reviewed";
  supplemental.raw!.case_ids = [];
  supplemental.raw!.notes = ["Review the frozen raw snapshot."];
  await writeFile(
    reconstruction.path,
    serializeWorkSpec(caseDocument),
    "utf8",
  );
  const blocked = await inspectProjectReconstruction(
    target,
    reconstruction.id,
  );
  assert.ok(blocked.issues.some((issue) =>
    /supplemental_inputs\.raw\.case_ids/.test(issue)
  ));
  assert.ok(blocked.issues.some((issue) =>
    /raw\/idea\.md: frozen raw input remains unseen/.test(issue)
  ));

  const intake = await beginIntakeCase({
    target,
    slug: "raw-convergence",
    title: "Review frozen raw idea",
    paths: ["raw/idea.md"],
    baseline: String(supplemental.raw!.baseline),
    distributionRoot,
    now: new Date("2026-07-28T12:40:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: intake.id,
    path: "raw/idea.md",
    status: "no-relevant-claims",
    note: "Read completely; the unsupported historical idea is not current truth.",
    now: new Date("2026-07-28T12:45:00.000Z"),
  });
  const intakeDocument = parseWorkSpec(await readFile(intake.path, "utf8"));
  intakeDocument.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "No independently authoritative claim was found.",
    validation: "not-needed",
  };
  intakeDocument.metadata.omission_audit = {
    result: "passed",
    notes: ["The only frozen source was read completely."],
    probes: [],
  };
  await writeFile(intake.path, serializeWorkSpec(intakeDocument), "utf8");
  await closeIntakeCase({
    target,
    id: intake.id,
    outcome: "completed",
    now: new Date("2026-07-28T12:50:00.000Z"),
  });

  supplemental.raw!.case_ids = [intake.id];
  await writeFile(
    reconstruction.path,
    serializeWorkSpec(caseDocument),
    "utf8",
  );
  const converged = await inspectProjectReconstruction(
    target,
    reconstruction.id,
  );
  assert.equal(
    converged.issues.some((issue) =>
      /frozen raw input remains|raw-intake case|final raw review/.test(issue)
    ),
    false,
  );
});

test("reconstructs a source-first baseline without raw input or durable checkout paths", async () => {
  const target = await initializedKnowledgeRepository("wfctl-reconstruction-");
  const leaf = await initializedLeafRepository(
    "wfctl-reconstruction-leaf-",
    target,
  );
  const started = await beginProjectReconstruction({
    target,
    slug: "existing-project",
    title: "Existing project baseline",
    leaves: [leaf],
    distributionRoot,
    runner: graphifyFixtureRunner,
    now: new Date("2026-07-28T13:00:00.000Z"),
  });
  assert.equal(started.mode, "baseline");
  assert.equal(started.repositories.length, 1);
  const caseText = await readFile(started.path, "utf8");
  assert.doesNotMatch(caseText, new RegExp(escapeRegExp(leaf)));
  const bindingText = await readFile(
    join(target, ".workflow/current/reconstruction", `${started.id}.json`),
    "utf8",
  );
  assert.match(bindingText, new RegExp(escapeRegExp(leaf)));
  const initial = await inspectProjectReconstruction(target, started.id);
  assert.ok(initial.issues.some((issue) => /dossier status must be reviewed/.test(issue)));
  assert.ok(initial.issues.some((issue) => /baseline reconstruction requires/.test(issue)));
  assert.ok(initial.issues.some((issue) => /file coverage is pending/.test(issue)));

  const repository = started.repositories[0]!;
  const caseDocument = parseWorkSpec(caseText);
  const rawBaseline = (
    (
      caseDocument.metadata.supplemental_inputs as Record<string, unknown>
    ).raw as Record<string, unknown>
  ).baseline;
  caseDocument.metadata.supplemental_inputs = {
    raw: {
      status: "not-available",
      baseline: rawBaseline,
      candidate_ids: [],
      notes: ["No raw material exists; source-first reconstruction remains complete."],
    },
    documentation: {
      status: "not-available",
      candidate_ids: [],
      notes: ["No independent project documentation exists."],
    },
    change_records: {
      status: "not-available",
      candidate_ids: [],
      notes: ["The project predates the workflow and has no change records."],
    },
  };
  caseDocument.metadata.cross_repository_analysis = {
    status: "not-relevant",
    notes: ["Only one leaf repository is in scope."],
  };
  caseDocument.metadata.candidate_claims = [
    {
      id: "greeting-capability",
      claim: "The project provides a greeting capability.",
      claim_class: "product-meaning",
      intent_state: "accepted",
      delivery_state: "verified",
      alignment: "aligned",
      evidence: [{
        kind: "source-code",
        resource: `git:${repository.repository}@${repository.commit}#src/main.ts:greet`,
      }],
      disposition: "confirmed",
      maintainer_decision: {
        status: "approved",
        by: "human:test-maintainer",
        at: "2026-07-28T14:00:00Z",
      },
      promoted_to: ["knowledge/areas/core/capabilities/greeting.md"],
    },
    {
      id: "farewell-capability",
      claim: "The project accepts a farewell capability that is not implemented.",
      claim_class: "product-intent",
      intent_state: "accepted",
      delivery_state: "absent",
      alignment: "drifted",
      evidence: [],
      disposition: "confirmed",
      maintainer_decision: {
        status: "approved",
        by: "human:test-maintainer",
        at: "2026-07-28T14:00:00Z",
      },
      promoted_to: ["knowledge/areas/core/capabilities/farewell.md"],
    },
  ];
  caseDocument.metadata.promotion = {
    status: "applied",
    concepts: [
      "knowledge/areas/core/capabilities/greeting.md",
      "knowledge/areas/core/capabilities/farewell.md",
    ],
    reason: "",
    validation: "passed",
  };
  caseDocument.metadata.coverage_audit = {
    result: "passed",
    notes: ["Every dossier dimension and candidate was reconciled."],
  };
  caseDocument.metadata.reconciliation_audit = {
    result: "passed",
    notes: ["Observed delivery and accepted intent were reviewed independently."],
  };
  caseDocument.metadata.maintainer_review = {
    status: "approved",
    by: "human:test-maintainer",
    at: "2026-07-30T14:00:00Z",
    notes: ["Approved the reconstructed baseline."],
  };
  await writeFile(started.path, serializeWorkSpec(caseDocument), "utf8");

  const dossierDocument = parseWorkSpec(await readFile(repository.dossier, "utf8"));
  dossierDocument.metadata.status = "reviewed";
  dossierDocument.metadata.graphify_queries = [
    "Trace project entrypoints, capability flow, and tests.",
  ];
  dossierDocument.metadata.candidate_ids = [
    "greeting-capability",
    "farewell-capability",
  ];
  dossierDocument.metadata.coverage = {
    purpose: "reviewed",
    areas_capabilities: "reviewed",
    entrypoints: "reviewed",
    boundaries_contracts: "not-relevant",
    data_state_control_flow: "reviewed",
    invariants_failure_modes: "reviewed",
    tests_runtime: "reviewed",
    unknowns: "reviewed",
  };
  dossierDocument.metadata.history = {
    status: "reviewed",
    notes: ["Reviewed the complete local Git history."],
  };
  dossierDocument.body = `# Repository role

The repository exports one greeting capability.

# Evidence

The capability is implemented and tested at the pinned revision.
`;
  await writeFile(repository.dossier, serializeWorkSpec(dossierDocument), "utf8");
  dossierDocument.metadata.candidate_ids = ["greeting-capability"];
  await writeFile(repository.dossier, serializeWorkSpec(dossierDocument), "utf8");
  assert.ok(
    (await inspectProjectReconstruction(target, started.id)).issues.some(
      (issue) => /candidate farewell-capability is not linked/.test(issue),
    ),
  );
  dossierDocument.metadata.candidate_ids = [
    "greeting-capability",
    "farewell-capability",
  ];
  await writeFile(repository.dossier, serializeWorkSpec(dossierDocument), "utf8");

  await markReconstructionFiles({
    target,
    id: started.id,
    paths: ["**"],
    category: "other",
    status: "irrelevant",
    reason: "Fixture support files are outside the reconstructed greeting behavior.",
  });
  const sourceRead = await readReconstructionSource({
    target,
    id: started.id,
    path: "src/main.ts",
    actor: "workflow-agent/test",
    now: new Date("2026-07-28T13:30:00.000Z"),
  });
  assert.equal(sourceRead.complete, true);
  await markReconstructionFiles({
    target,
    id: started.id,
    paths: ["src/main.ts"],
    category: "source",
  });
  await markReconstructionCommunity({
    target,
    id: started.id,
    community: "1",
    status: "inspected",
    note: "Mapped the greeting implementation and its public entrypoint.",
    queries: ["Trace the greeting entrypoint and implementation."],
  });
  await recordReconstructionSurface({
    target,
    id: started.id,
    surface: "greeting-entrypoint",
    kind: "entrypoint",
    description: "Exported greeting function.",
    paths: ["src/main.ts"],
    status: "inspected",
    note: "Read the complete pinned source file.",
    candidateIds: ["greeting-capability"],
  });
  await reviewReconstructionSurfaces({
    target,
    id: started.id,
    status: "reviewed",
    note: "All fixture entrypoints and runtime surfaces were reconciled.",
  });

  const capabilityDirectory = join(target, "knowledge/areas/core/capabilities");
  await mkdir(capabilityDirectory, { recursive: true });
  await writeFile(
    join(target, "knowledge/areas/index.md"),
    "# Areas\n\n- [Core](core/)\n",
    "utf8",
  );
  await writeFile(
    join(target, "knowledge/areas/core/index.md"),
    areaIndex("Core", "- [Capabilities](capabilities/)\n"),
    "utf8",
  );
  await writeFile(
    join(capabilityDirectory, "index.md"),
    "# Core capabilities\n\n- [Greeting](greeting.md)\n- [Farewell](farewell.md)\n",
    "utf8",
  );
  await writeFile(
    join(capabilityDirectory, "greeting.md"),
    `---
type: Capability
title: Greeting
description: Return a greeting for a supplied name.
status: stable
view: product
purpose: current-behavior
audience: [stakeholder, maintainer, domain-expert]
area: core
authority: [product-meaning, implementation]
generated: { by: workflow-agent/1, at: 2026-07-28T14:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-28T14:00:00Z }
realization:
  intent: accepted
  delivery: verified
  alignment: aligned
  assessed_at: 2026-07-28T14:00:00Z
x-wf:
  relations: []
sources:
  - id: baseline-decision
    kind: maintainer-decision
    resource: project-reconstruction:${started.id}#greeting-capability
    author: "human:test-maintainer"
  - id: greeting-source
    kind: source-code
    resource: git:${repository.repository}@${repository.commit}#src/main.ts:greet
---

# What this provides

The project accepts and delivers a greeting capability.[^baseline-decision][^greeting-source]

# Who it serves

People who request a greeting.

# Domain language

No new terms.

# Current behavior

A supplied name receives a greeting.

# Rules and outcomes

The greeting uses the supplied name.

# Boundaries and exceptions

No additional behavior is established by this baseline.

# Delivery

The capability is verified as available.

# Examples

A person supplies a name and receives a greeting addressed to that name.

# Evolution

This baseline establishes the current behavior.

# Related knowledge

- [Core Area](../index.md)

# Engineering details

Not applicable.

[^baseline-decision]: Maintainer-approved reconstruction claim.
[^greeting-source]: Pinned implementation.
`,
    "utf8",
  );
  await writeFile(
    join(capabilityDirectory, "farewell.md"),
    `---
type: Capability
title: Farewell
description: Return a farewell for a supplied name.
status: stable
view: product
purpose: current-behavior
audience: [stakeholder, maintainer, domain-expert]
area: core
authority: [intent, implementation]
generated: { by: workflow-agent/1, at: 2026-07-28T14:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-28T14:00:00Z }
realization:
  intent: accepted
  delivery: absent
  alignment: drifted
  assessed_at: 2026-07-28T14:00:00Z
x-wf:
  relations: []
sources:
  - id: farewell-decision
    kind: maintainer-decision
    resource: project-reconstruction:${started.id}#farewell-capability
    author: "human:test-maintainer"
  - id: farewell-coverage
    kind: reconstruction-review
    resource: project-reconstruction:${started.id}#farewell-capability
---

# What this provides

The project accepts a farewell capability, but the reviewed source baseline
contains no implementation.[^farewell-decision][^farewell-coverage]

# Who it serves

People who would receive a farewell.

# Domain language

No new terms.

# Current behavior

The accepted farewell is not currently available.

# Rules and outcomes

No delivered farewell outcome exists yet.

# Boundaries and exceptions

Acceptance does not imply availability.

# Delivery

The capability is absent from the reviewed implementation.

# Examples

A farewell request cannot currently produce the accepted outcome.

# Evolution

The baseline records accepted intent before delivery.

# Related knowledge

- [Core Area](../index.md)

# Engineering details

Not applicable.

[^farewell-decision]: Maintainer-approved product intent.
[^farewell-coverage]: Reviewed whole-scope reconstruction receipt.
`,
    "utf8",
  );
  await sealConcept(
    target,
    "knowledge/areas/core/capabilities/greeting.md",
  );
  await sealConcept(
    target,
    "knowledge/areas/core/capabilities/farewell.md",
  );

  const ready = await inspectProjectReconstruction(target, started.id);
  assert.deepEqual(ready.issues, []);
  const closed = await closeProjectReconstruction({
    target,
    id: started.id,
    outcome: "completed",
    now: new Date("2026-07-28T14:10:00.000Z"),
  });
  await access(join(closed.archivePath, "case.md"));
  await assert.rejects(access(started.path));
  await assert.rejects(
    access(join(target, ".workflow/current/reconstruction", `${started.id}.json`)),
  );
  assert.equal((await validateKnowledge(target)).valid, true);
  const capabilityPath = join(capabilityDirectory, "greeting.md");
  await writeFile(
    capabilityPath,
    (await readFile(capabilityPath, "utf8")).replace(
      "intent: accepted",
      "intent: proposed",
    ),
    "utf8",
  );
  const proposedCurrentTruth = await validateKnowledge(target, [
    "knowledge/areas/core/capabilities/greeting.md",
  ]);
  assert.ok(proposedCurrentTruth.errors.some((issue) =>
    /realization.intent must be accepted, superseded/.test(issue.message)
  ));
});

test("reconstruction detects bound leaf drift and local path leakage", async () => {
  const target = await initializedKnowledgeRepository("wfctl-reconstruction-drift-");
  const leaf = await initializedLeafRepository(
    "wfctl-reconstruction-drift-leaf-",
    target,
  );
  const started = await beginProjectReconstruction({
    target,
    slug: "drift",
    title: "Drift audit",
    mode: "audit",
    leaves: [leaf],
    distributionRoot,
    runner: graphifyFixtureRunner,
    now: new Date("2026-07-28T15:00:00.000Z"),
  });
  await writeFile(
    started.repositories[0]!.dossier,
    `${await readFile(started.repositories[0]!.dossier, "utf8")}\nLocal path: ${leaf}\n`,
    "utf8",
  );
  await writeFile(join(leaf, "src/main.ts"), "export const changed = true;\n", "utf8");
  const result = await inspectProjectReconstruction(target, started.id);
  assert.ok(result.issues.some((issue) => /uncommitted changes/.test(issue)));
  assert.ok(result.issues.some((issue) => /absolute paths|checkout path/.test(issue)));

  const closed = await closeProjectReconstruction({
    target,
    id: started.id,
    outcome: "partial",
    now: new Date("2026-07-28T15:10:00.000Z"),
  });
  await access(join(closed.archivePath, "case.md"));
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
    completedProjectChange("2026-07-28-world-loop"),
    "utf8",
  );
  let validContent = `---
type: Architecture Decision
title: Current loop authority
status: stable
view: decision
purpose: decision-history
audience: [maintainer, domain-expert, engineer]
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
  await sealConcept(target, "knowledge/decisions/current-loop.md");
  validContent = await readFile(conceptPath, "utf8");
  await writeFile(
    join(target, "knowledge/decisions/index.md"),
    "# Cross-area Decisions\n\n- [Current loop authority](current-loop.md)\n",
    "utf8",
  );

  const valid = await validateKnowledge(target);
  assert.equal(valid.valid, true);
  await writeFile(
    conceptPath,
    validContent.replace(
      "The world loop is server-authoritative.",
      "The world loop is client-authoritative.",
    ),
    "utf8",
  );
  const tampered = await validateKnowledge(target);
  assert.ok(tampered.errors.some((issue) => /current content hash/.test(issue.message)));
  await writeFile(conceptPath, validContent, "utf8");
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
  assert.ok(
    taintedChange.errors.some((issue) =>
      /project change that cites raw or intake|completed, human-reviewed archived change/.test(
        issue.message,
      )
    ),
    JSON.stringify(taintedChange.errors),
  );
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

  const staleDocument = parseWorkSpec(validContent);
  staleDocument.metadata.generated = {
    by: "workflow-agent/1",
    at: "2026-07-28T13:00:00Z",
  };
  await writeFile(conceptPath, serializeWorkSpec(staleDocument), "utf8");
  const stale = await validateKnowledge(target);
  assert.ok(stale.errors.some((issue) => /verification at or after generated/.test(issue.message)));

  await writeFile(conceptPath, validContent, "utf8");
  await writeFile(
    join(target, "knowledge/architecture/runtime.md"),
    `---
type: Architecture
title: Runtime implementation
status: draft
view: engineering
purpose: technical-realization
audience: [engineer, operator, maintainer]
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
    /completed, human-reviewed archived change|archived project change/.test(issue.message)
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
    probes: [],
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

test("migrates intake v3 conservatively and requires semantic review", async () => {
  const target = await initializedKnowledgeRepository("wfctl-intake-migrate-");
  await writeFile(join(target, "raw/legacy.md"), "# Legacy\n\nOld statement.\n", "utf8");
  commitAll(target, "add legacy statement");
  const started = await beginIntakeCase({
    target,
    slug: "migration",
    title: "Migrate legacy intake",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/legacy.md",
    status: "reviewed",
    candidateIds: ["legacy-statement"],
    note: "Read completely; the statement is not authoritative.",
    now: new Date("2026-07-28T10:05:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.path, "utf8"));
  document.metadata.intake_case_version = 3;
  delete document.metadata.migration;
  document.metadata.candidate_claims = [{
    id: "legacy-statement",
    claim: "The raw file asserts an old implementation state.",
    authority: "implementation",
    evidence: [],
    disposition: "rejected",
    reason: "Pinned source inspection disproved it.",
    promoted_to: [],
  }];
  document.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "The claim was rejected.",
    validation: "not-needed",
  };
  document.metadata.omission_audit = {
    result: "passed",
    notes: ["Legacy audit text."],
  };
  await writeFile(started.path, serializeWorkSpec(document), "utf8");

  const migrated = await migrateIntakeCase({
    target,
    id: started.id,
    now: new Date("2026-07-28T10:10:00.000Z"),
  });
  assert.equal(migrated.fromVersion, 3);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.migrationStatus, "needs-review");
  const blocked = await inspectIntakeCase(target, started.id);
  assert.ok(blocked.issues.some((issue) => /migration\.status/.test(issue)));
  assert.ok(blocked.issues.some((issue) => /semantic_role must be classified/.test(issue)));

  const upgraded = parseWorkSpec(await readFile(started.path, "utf8"));
  const candidate = (upgraded.metadata.candidate_claims as Array<Record<string, unknown>>)[0]!;
  candidate.semantic_role = "observation";
  candidate.intent_state = "not-applicable";
  candidate.delivery_state = "unknown";
  candidate.alignment = "not-applicable";
  upgraded.metadata.omission_audit = {
    result: "passed",
    notes: ["The rejected candidate was preserved and intentionally not routed."],
    probes: [],
  };
  await writeFile(started.path, serializeWorkSpec(upgraded), "utf8");
  await migrateIntakeCase({
    target,
    id: started.id,
    review: true,
    reviewedBy: "workflow-agent/test",
    note: "Reviewed every conservative field against the complete frozen source.",
    now: new Date("2026-07-28T10:15:00.000Z"),
  });
  assert.deepEqual((await inspectIntakeCase(target, started.id)).issues, []);
});

test("does not infer current truth or permit one-step review during v3 migration", async () => {
  const target = await initializedKnowledgeRepository("wfctl-intake-migrate-current-");
  await writeFile(join(target, "raw/legacy.md"), "# Legacy\n\nPromoted once.\n", "utf8");
  commitAll(target, "add formerly promoted statement");
  const started = await beginIntakeCase({
    target,
    slug: "migration-current",
    title: "Do not infer current truth",
    distributionRoot,
    now: new Date("2026-07-28T10:00:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/legacy.md",
    status: "reviewed",
    candidateIds: ["legacy-promoted"],
    note: "Read completely; legacy promotion does not establish current status.",
    now: new Date("2026-07-28T10:05:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.path, "utf8"));
  document.metadata.intake_case_version = 3;
  delete document.metadata.migration;
  document.metadata.candidate_claims = [{
    id: "legacy-promoted",
    claim: "The project should use the legacy rule.",
    authority: "intent",
    evidence: [],
    disposition: "confirmed",
    reason: "",
    promoted_to: ["knowledge/areas/core/rules/legacy-rule.md"],
  }];
  await writeFile(started.path, serializeWorkSpec(document), "utf8");

  await assert.rejects(
    migrateIntakeCase({
      target,
      id: started.id,
      review: true,
      note: "Unsafe one-step review.",
    }),
    /separate gate/,
  );
  assert.equal(
    parseWorkSpec(await readFile(started.path, "utf8")).metadata.intake_case_version,
    3,
  );

  await migrateIntakeCase({ target, id: started.id });
  const migrated = parseWorkSpec(await readFile(started.path, "utf8"));
  const candidate = (migrated.metadata.candidate_claims as Array<Record<string, unknown>>)[0]!;
  assert.deepEqual(candidate.routing, { lane: "case-only", destinations: [] });
  assert.deepEqual(candidate.migration_source, {
    authority: "intent",
    promoted_to: ["knowledge/areas/core/rules/legacy-rule.md"],
  });
  assert.ok((await inspectIntakeCase(target, started.id)).issues.some((issue) =>
    /confirmed candidates require a durable routing lane/.test(issue)
  ));
});

test("enforces claim routing, reciprocal lineage, and omission probes", async () => {
  const target = await initializedKnowledgeRepository("wfctl-claim-ledger-");
  await mkdir(join(target, "raw/ideas"), { recursive: true });
  await writeFile(join(target, "raw/ideas/old.md"), "# Old\n\nAn early proposal.\n", "utf8");
  await writeFile(join(target, "raw/ideas/new.md"), "# New\n\nA refined proposal.\n", "utf8");
  commitAll(target, "add proposal lineage");
  const started = await beginIntakeCase({
    target,
    slug: "proposal-lineage",
    title: "Reconcile proposal lineage",
    paths: ["raw/ideas"],
    distributionRoot,
    now: new Date("2026-07-28T11:00:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/ideas/old.md",
    status: "reviewed",
    candidateIds: ["old-proposal"],
    note: "Read completely; captured the earlier proposal.",
    now: new Date("2026-07-28T11:05:00.000Z"),
  });
  await markIntakeSource({
    target,
    id: started.id,
    path: "raw/ideas/new.md",
    status: "reviewed",
    candidateIds: ["new-proposal"],
    note: "Read completely; captured the refined proposal.",
    now: new Date("2026-07-28T11:10:00.000Z"),
  });
  const document = parseWorkSpec(await readFile(started.path, "utf8"));
  const firstCapture = await createCapture({
    target,
    slug: "proposal-lineage",
    title: "Proposal lineage",
    distributionRoot,
    now: new Date("2026-07-28T11:12:00.000Z"),
  });
  const secondCapture = await createCapture({
    target,
    slug: "refined-proposal",
    title: "Refined proposal",
    distributionRoot,
    now: new Date("2026-07-28T11:13:00.000Z"),
  });
  const capturePath = `changes/inbox/${firstCapture.id}.md`;
  const refinedCapturePath = `changes/inbox/${secondCapture.id}.md`;
  document.metadata.candidate_claims = [
    intakeClaim({
      id: "old-proposal",
      claim: "The project could use the earlier proposal.",
      claim_class: "product-intent",
      semantic_role: "idea",
      intent_state: "proposed",
      delivery_state: "absent",
      alignment: "unknown",
      disposition: "deferred",
      reason: "It remains a reviewed proposal, not accepted intent.",
      relations: {
        supersedes: [],
        superseded_by: ["new-proposal"],
        contradicts: [],
        refines: [],
        implements: [],
        derived_from: [],
      },
      routing: {
        lane: "capture",
        destinations: [capturePath],
      },
    }),
    intakeClaim({
      id: "new-proposal",
      claim: "The project could use the refined proposal.",
      claim_class: "product-intent",
      semantic_role: "idea",
      intent_state: "proposed",
      delivery_state: "absent",
      alignment: "unknown",
      disposition: "deferred",
      reason: "It remains a reviewed proposal, not accepted intent.",
      relations: {
        supersedes: ["old-proposal"],
        superseded_by: [],
        contradicts: [],
        refines: ["old-proposal"],
        implements: [],
        derived_from: [],
      },
      routing: {
        lane: "capture",
        destinations: [refinedCapturePath],
      },
    }),
  ];
  document.metadata.promotion = {
    status: "not-needed",
    concepts: [],
    reason: "Both reviewed proposals remain in the pending capture lane.",
    validation: "not-needed",
  };
  document.metadata.omission_audit = {
    result: "pending",
    notes: ["Probe the durable pending captures without consulting raw."],
    probes: [],
  };
  await writeFile(started.path, serializeWorkSpec(document), "utf8");
  await recordIntakeProbe({
    target,
    id: started.id,
    probeId: "incomplete-combined-probe",
    question: "What are both proposals?",
    candidateIds: ["old-proposal", "new-proposal"],
    status: "passed",
    answer: "Only the earlier proposal was inspected.",
    outputPaths: [capturePath],
    reviewedBy: "workflow-agent/test",
    now: new Date("2026-07-28T11:12:00.000Z"),
  });
  assert.ok((await inspectIntakeCase(target, started.id)).issues.some((issue) =>
    /does not inspect a routed output for candidate new-proposal/.test(issue)
  ));
  await recordIntakeProbe({
    target,
    id: started.id,
    probeId: "incomplete-combined-probe",
    question: "What are both proposals?",
    candidateIds: ["old-proposal", "new-proposal"],
    status: "passed",
    answer: "Both durable proposal records were inspected.",
    outputPaths: [capturePath, refinedCapturePath],
    reviewedBy: "workflow-agent/test",
    now: new Date("2026-07-28T11:13:00.000Z"),
  });
  await assert.rejects(
    recordIntakeProbe({
      target,
      id: started.id,
      probeId: "invalid-waiver",
      question: "Can this probe be skipped?",
      candidateIds: ["old-proposal"],
      status: "waived",
      answer: "No authority was recorded.",
      outputPaths: [],
    }),
    /waiver-by human:<id>/,
  );
  await recordIntakeProbe({
    target,
    id: started.id,
    probeId: "earlier-proposal",
    question: "What earlier proposal preceded the refinement?",
    candidateIds: ["old-proposal"],
    status: "failed",
    answer: "The pending capture omitted the predecessor.",
    outputPaths: [capturePath],
    reviewedBy: "workflow-agent/test",
    now: new Date("2026-07-28T11:15:00.000Z"),
  });
  assert.ok((await inspectIntakeCase(target, started.id)).issues.some((issue) =>
    /omission_audit\.probes\[\d+\]\.status remains failed/.test(issue)
  ));
  await recordIntakeProbe({
    target,
    id: started.id,
    probeId: "earlier-proposal",
    question: "What earlier proposal preceded the refinement?",
    candidateIds: ["old-proposal"],
    status: "passed",
    answer: "The capture preserves the earlier proposal and its successor.",
    outputPaths: [capturePath],
    reviewedBy: "workflow-agent/test",
    now: new Date("2026-07-28T11:20:00.000Z"),
  });
  await recordIntakeProbe({
    target,
    id: started.id,
    probeId: "refined-proposal",
    question: "What proposal currently awaits maintainer consideration?",
    candidateIds: ["new-proposal"],
    status: "passed",
    answer: "The refined proposal is recorded as proposed, not current truth.",
    outputPaths: [refinedCapturePath],
    reviewedBy: "workflow-agent/test",
    now: new Date("2026-07-28T11:25:00.000Z"),
  });
  assert.deepEqual((await inspectIntakeCase(target, started.id)).issues, []);

  const wrongLane = parseWorkSpec(await readFile(started.path, "utf8"));
  const wrongCandidate = (
    wrongLane.metadata.candidate_claims as Array<Record<string, unknown>>
  )[0]!;
  (wrongCandidate.routing as Record<string, unknown>).lane = "change";
  await writeFile(started.path, serializeWorkSpec(wrongLane), "utf8");
  assert.ok((await inspectIntakeCase(target, started.id)).issues.some((issue) =>
    /routing contains an invalid change path/.test(issue)
  ));
  (wrongCandidate.routing as Record<string, unknown>).lane = "capture";
  await writeFile(started.path, serializeWorkSpec(wrongLane), "utf8");
  assert.deepEqual((await inspectIntakeCase(target, started.id)).issues, []);

  const reconstructionDirectory = join(
    target,
    "reconstruction/active/source-baseline",
  );
  await mkdir(reconstructionDirectory, { recursive: true });
  await writeFile(
    join(reconstructionDirectory, "case.md"),
    serializeWorkSpec({
      metadata: {
        reconstruction_version: 3,
        id: "source-baseline",
        created_at: "2026-07-28T11:30:00.000Z",
        updated_at: "2026-07-28T11:30:00.000Z",
        candidate_claims: [{
          id: "source-observation",
          claim: "The source analysis considered the refined proposal.",
          claim_class: "implementation",
          semantic_role: "observation",
          intent_state: "unknown",
          delivery_state: "implemented",
          alignment: "unknown",
          disposition: "confirmed",
          relations: {
            supersedes: [],
            superseded_by: [],
            contradicts: [],
            refines: [],
            implements: [],
            derived_from: [`intake:${started.id}#new-proposal`],
          },
          routing: {
            lane: "current-knowledge",
            destinations: ["knowledge/architecture/source-observation.md"],
          },
        }],
      },
      body: "# Source baseline\n",
    }),
    "utf8",
  );
  const compiled = await compileClaimLedger(target);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.ledger.stats.claims, 3);
  assert.equal(compiled.ledger.stats.intakeCases, 1);
  assert.equal(compiled.ledger.stats.reconstructionCases, 1);
  assert.ok(compiled.ledger.edges.some((edge) =>
    edge.kind === "supersedes"
    && edge.source.endsWith("#new-proposal")
    && edge.target.endsWith("#old-proposal")
  ));
  assert.ok(compiled.ledger.edges.some((edge) =>
    edge.kind === "derived_from"
    && edge.source === "reconstruction:source-baseline#source-observation"
    && edge.target === `intake:${started.id}#new-proposal`
  ));
  const written = await writeClaimLedger(target);
  await access(written.path);

  const broken = parseWorkSpec(await readFile(started.path, "utf8"));
  const old = (broken.metadata.candidate_claims as Array<Record<string, unknown>>)[0]!;
  (old.relations as Record<string, unknown>).superseded_by = [];
  await writeFile(started.path, serializeWorkSpec(broken), "utf8");
  assert.ok((await inspectIntakeCase(target, started.id)).issues.some((issue) =>
    /requires reciprocal superseded_by/.test(issue)
  ));
});

test("does not authorize stable knowledge from an incomplete active change", async () => {
  const target = await initializedKnowledgeRepository("wfctl-incomplete-receipt-");
  const changeId = "2026-07-28-incomplete";
  const changeDirectory = join(target, "changes/active", changeId);
  await mkdir(changeDirectory, { recursive: true });
  const change = parseWorkSpec(completedProjectChange(changeId));
  change.metadata.status = "shaping";
  (change.metadata.verification as Record<string, unknown>).result = "pending";
  await writeFile(
    join(changeDirectory, "change.md"),
    serializeWorkSpec(change),
    "utf8",
  );
  const conceptPath = "knowledge/decisions/incomplete.md";
  await writeFile(
    join(target, conceptPath),
    `---
type: Decision
title: Incomplete decision
status: stable
view: decision
purpose: decision-history
audience: [maintainer, domain-expert, engineer]
decision_id: incomplete-decision
effective_at: 2026-07-28T11:00:00Z
supersedes: []
superseded_by: ""
authority: [decision]
generated: { by: workflow-agent/1, at: 2026-07-28T11:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-28T11:00:00Z }
x-wf:
  relations: []
sources:
  - id: incomplete-source
    kind: maintainer-decision
    resource: project-change:${changeId}#decision
    author: "human:test-maintainer"
---

# Decision

This decision must not become stable yet.[^incomplete-source]

[^incomplete-source]: Incomplete active change.
`,
    "utf8",
  );
  await writeFile(
    join(target, "knowledge/decisions/index.md"),
    "# Cross-area Decisions\n\n- [Incomplete decision](incomplete.md)\n",
    "utf8",
  );
  await sealConcept(target, conceptPath);
  const validation = await validateKnowledge(target);
  assert.ok(validation.errors.some((issue) => /missing project change/.test(issue.message)));
});

test("validates reciprocal acyclic decision evolution", async () => {
  const target = await initializedKnowledgeRepository("wfctl-decision-lineage-");
  const changeId = "2026-07-28-revival-rule";
  await mkdir(join(target, "changes/archive", changeId), { recursive: true });
  await writeFile(
    join(target, "changes/archive", changeId, "change.md"),
    completedProjectChange(changeId),
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
    areaIndex("Combat", "- [Decisions](decisions/)\n"),
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
view: decision
purpose: decision-history
audience: [maintainer, domain-expert, engineer]
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
  await sealConcept(target, oldPath);
  await sealConcept(target, currentPath);
  assert.equal((await validateKnowledge(target)).valid, true);

  await writeFile(
    join(target, currentPath),
    decision("item-revival", "Item revival", "stable", [], ""),
    "utf8",
  );
  await sealConcept(target, currentPath);
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
  await sealConcept(target, oldPath);
  await sealConcept(target, currentPath);
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
view: reference
purpose: external-context
audience: [maintainer, engineer, agent]
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

test("enforces product and engineering view contracts with current quality receipts", async () => {
  const target = await initializedKnowledgeRepository("wfctl-knowledge-views-");
  const changeId = "2026-07-29-revival";
  await mkdir(join(target, "changes/archive", changeId), { recursive: true });
  await writeFile(
    join(target, "changes/archive", changeId, "change.md"),
    completedProjectChange(changeId),
    "utf8",
  );
  const areaRoot = join(target, "knowledge/areas/combat");
  const capabilities = join(areaRoot, "capabilities");
  await mkdir(capabilities, { recursive: true });
  await writeFile(
    join(target, "knowledge/areas/index.md"),
    "# Areas\n\n- [Combat](combat/)\n",
    "utf8",
  );
  await writeFile(
    join(areaRoot, "index.md"),
    areaIndex("Combat", "- [Revival](capabilities/revival.md)\n"),
    "utf8",
  );
  await writeFile(
    join(capabilities, "index.md"),
    "# Combat capabilities\n\n- [Revival](revival.md)\n",
    "utf8",
  );
  const conceptPath = "knowledge/areas/combat/capabilities/revival.md";
  await writeFile(join(target, conceptPath), productConcept(changeId), "utf8");
  await sealConcept(target, conceptPath);

  const valid = await validateKnowledge(target);
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
  assert.equal(
    valid.warnings.some((issue) => /technical-looking identifiers/.test(issue.message)),
    false,
    JSON.stringify(valid.warnings),
  );
  const built = await writeKnowledgeGraph(target);
  const node = built.graph.nodes.find((candidate) => candidate.path === conceptPath);
  assert.equal(node?.view, "product");
  assert.equal(node?.purpose, "current-behavior");
  assert.deepEqual(node?.audience, ["stakeholder", "maintainer", "domain-expert"]);

  const sealed = await readFile(join(target, conceptPath), "utf8");
  await writeFile(
    join(target, conceptPath),
    sealed.replace(
      "# Engineering details\n\nNot applicable.",
      "# Engineering details\n\nThe runtime uses `RevivalService`.",
    ),
    "utf8",
  );
  const leaked = await validateKnowledge(target, [conceptPath]);
  assert.ok(leaked.errors.some((issue) => /inline code|links only/.test(issue.message)));

  await writeFile(join(target, conceptPath), sealed, "utf8");
  const parsed = parseWorkSpec(sealed);
  (
    (parsed.metadata["x-wf"] as Record<string, unknown>).quality as Record<string, unknown>
  ).content_hash = "f".repeat(64);
  await writeFile(join(target, conceptPath), serializeWorkSpec(parsed), "utf8");
  const staleQuality = await validateKnowledge(target, [conceptPath]);
  assert.ok(staleQuality.errors.some((issue) =>
    /quality\.content_hash must match/.test(issue.message)
  ));

  const missingAxis = parseWorkSpec(sealed);
  delete (
    (
      (missingAxis.metadata["x-wf"] as Record<string, unknown>)
        .quality as Record<string, unknown>
    ).axes as Record<string, unknown>
  )["reader-communication"];
  await writeFile(join(target, conceptPath), serializeWorkSpec(missingAxis), "utf8");
  const incompleteQuality = await validateKnowledge(target, [conceptPath]);
  assert.ok(incompleteQuality.errors.some((issue) =>
    /quality\.axes\.reader-communication\.status must be passed/.test(issue.message)
  ));

  const missingSection = parseWorkSpec(sealed);
  missingSection.body = missingSection.body.replace(
    "# Examples\n\nAn eligible defeated character returns to play after revival.\n\n",
    "",
  );
  await writeFile(join(target, conceptPath), serializeWorkSpec(missingSection), "utf8");
  const incompleteProduct = await validateKnowledge(target, [conceptPath]);
  assert.ok(incompleteProduct.errors.some((issue) =>
    /required section is missing: Examples/.test(issue.message)
  ));

  const engineeringPath = join(areaRoot, "implementation/revival.md");
  await mkdir(dirname(engineeringPath), { recursive: true });
  await writeFile(
    engineeringPath,
    `---
type: Implementation
title: Revival implementation
status: draft
view: engineering
purpose: technical-realization
audience: [engineer, operator]
area: combat
authority: [product-meaning, implementation]
generated: { by: workflow-agent/1, at: 2026-07-29T12:00:00Z }
x-wf:
  relations: []
  quality:
    status: pending
sources:
  - id: implementation
    kind: source-code
    resource: git:dnd-api@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#src/revival.ts
---

# Responsibility

Technical responsibility.[^implementation]

# Current implementation

Current implementation.

# Boundaries and ownership

Ownership boundary.

# Data and control flow

Control flow.

# Contracts and invariants

Contract.

# Failure and operational behavior

Failure behavior.

# Verification

Verification evidence.

# Product knowledge

- [Revival](../capabilities/revival.md)

# Relationships

- [Combat Area](../index.md)

[^implementation]: Pinned implementation.
`,
    "utf8",
  );
  const mixedAuthority = await validateKnowledge(target, [
    "knowledge/areas/combat/implementation/revival.md",
  ]);
  assert.ok(mixedAuthority.errors.some((issue) =>
    /link product meaning instead of claiming product authority/.test(issue.message)
  ));
});

test("rejects incomplete stakeholder Area indexes", async () => {
  const target = await initializedKnowledgeRepository("wfctl-area-view-");
  await mkdir(join(target, "knowledge/areas/combat"), { recursive: true });
  await writeFile(
    join(target, "knowledge/areas/combat/index.md"),
    "# Combat\n\n## Purpose\n\nCombat behavior.\n",
    "utf8",
  );
  const result = await validateKnowledge(target);
  assert.ok(result.errors.some((issue) =>
    issue.path === "knowledge/areas/combat/index.md"
    && /required section is missing: Who it serves/.test(issue.message)
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

async function initializedLeafRepository(
  prefix: string,
  knowledge: string,
): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), prefix));
  execFileSync("git", ["-C", target, "init", "-q"]);
  execFileSync("git", ["-C", target, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", target, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", target, "config", "commit.gpgsign", "false"]);
  await mkdir(join(target, "src"), { recursive: true });
  await writeFile(
    join(target, "src/main.ts"),
    "export function greet(name: string): string { return `Hello ${name}`; }\n",
    "utf8",
  );
  await applyInstallPlan(await buildInstallPlan({
    target,
    profile: "leaf",
    knowledge,
    distributionRoot,
  }));
  commitAll(target, "initialize leaf");
  await addLeafRepository(knowledge, target);
  return target;
}

function graphifyFixtureRunner(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
) {
  if (command !== "graphify" || args.join(" ") !== "update ." || !options.cwd) {
    return { status: 1, stdout: "", stderr: "unexpected fixture command" };
  }
  const graphDirectory = join(options.cwd, "graphify-out");
  mkdirSync(graphDirectory, { recursive: true });
  writeFileSync(
    join(graphDirectory, "graph.json"),
    '{"nodes":[{"id":"greet","label":"greet","source_file":"src/main.ts","community":1,"community_name":"Greeting"}],"links":[]}\n',
    "utf8",
  );
  return { status: 0, stdout: "updated", stderr: "" };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function commitAll(target: string, message: string): void {
  execFileSync("git", ["-C", target, "add", "."]);
  execFileSync("git", ["-C", target, "commit", "-q", "-m", message]);
}

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
    at: "2026-07-30T14:00:00Z",
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
        at: "2026-07-30T14:00:00Z",
        content_hash: "0".repeat(64),
      },
      "reader-communication": {
        status: "passed",
        by: "workflow-agent/1",
        at: "2026-07-30T14:00:00Z",
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

function areaIndex(title: string, links: string): string {
  return `# ${title}

## Purpose

Describe the Area purpose.

## Who it serves

Describe the people and neighboring Areas.

## Scope and boundaries

Describe what belongs here.

## Current product behavior

Describe current behavior.

## Capabilities

${links.trim()}

## Use cases and flows

Not applicable.

## Rules and outcomes

Not applicable.

## Delivery overview

Describe current delivery.

## Current decisions

Link current decisions when available.

## Evolution

Describe meaningful change.

## Open questions

None.

## Engineering details

Not applicable.
`;
}

function productConcept(changeId: string): string {
  return `---
type: Product Capability
title: Revival
description: Return an eligible defeated character to play.
status: stable
view: product
purpose: current-behavior
audience: [stakeholder, maintainer, domain-expert]
area: combat
capabilities: [revival]
authority: [product-meaning, implementation]
generated: { by: workflow-agent/1, at: 2026-07-29T12:00:00Z }
verified: { by: "human:test-maintainer", at: 2026-07-29T12:00:00Z }
realization:
  intent: accepted
  delivery: verified
  alignment: aligned
  assessed_at: 2026-07-29T12:00:00Z
x-wf:
  relations: []
  quality:
    status: pending
sources:
  - id: decision
    kind: maintainer-decision
    resource: project-change:${changeId}#decision
    author: "human:test-maintainer"
  - id: delivery
    kind: source-code
    resource: git:dnd-api@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#src/revival.ts
---

# What this provides

Revival returns an eligible defeated character to play.[^decision]

# Who it serves

Players whose characters have been defeated.

# Domain language

Revival means returning an eligible defeated character to play.

# Current behavior

An eligible defeated character returns and can continue playing.[^delivery]

# Rules and outcomes

Revival succeeds only when the current eligibility rule is satisfied.

# Boundaries and exceptions

Ineligible characters remain defeated.

# Delivery

The behavior is verified as available.

# Examples

An eligible defeated character returns to play after revival.

# Evolution

This current explanation is governed by the reviewed revival decision.

# Related knowledge

- [Combat Area](../index.md)

# Engineering details

Not applicable.

[^decision]: Reviewed product decision.
[^delivery]: Pinned implementation evidence.
`;
}

function completedProjectChange(id: string): string {
  return `---
workflow_version: 2
id: ${id}
scope: project
status: completed
outcome: completed
knowledge_alignment:
  reviewed: [knowledge/index.md]
  conflicts: []
graph_evidence:
  queries: []
knowledge_promotion:
  status: not-needed
  concepts: []
  reason: The reviewed decision is already represented by the promoted concept.
maintainer_review:
  framing:
    status: approved
    by: human:test-maintainer
    at: 2026-07-28T10:00:00Z
  completion:
    status: approved
    by: human:test-maintainer
    at: 2026-07-28T11:00:00Z
verification:
  result: passed
  acceptance_reviewed: true
  implementation_reviewed: false
  knowledge_reviewed: true
  checks:
    - command: wfctl knowledge validate
      result: passed
  unresolved: []
---

# Intent

Reviewed project decision.

# Acceptance

- [x] Maintainer review is recorded.
`;
}
