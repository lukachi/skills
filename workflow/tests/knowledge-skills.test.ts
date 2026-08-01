import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skills = [
  "curate-project-knowledge",
  "explore-project-knowledge",
  "curate-product-knowledge",
  "curate-engineering-knowledge",
  "verify-knowledge-quality",
];

test("knowledge view skills are complete and explicitly routed", async () => {
  const contents = new Map<string, string>();
  for (const skill of skills) {
    const content = await readFile(join(root, "skills", skill, "SKILL.md"), "utf8");
    contents.set(skill, content);
    assert.doesNotMatch(content, /TODO|\[TODO/);
    const frontmatterMatch = /^---\n([\s\S]+?)\n---/.exec(content);
    assert.ok(frontmatterMatch, `${skill} must have YAML frontmatter`);
    const frontmatter = parse(frontmatterMatch[1]!) as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(frontmatter).filter((key) =>
        !["name", "description", "license", "allowed-tools", "metadata"].includes(key)
      ),
      [],
    );
    assert.equal(frontmatter.name, skill);
    assert.equal(typeof frontmatter.description, "string");
    assert.ok(String(frontmatter.description).length <= 1024);
    assert.doesNotMatch(String(frontmatter.description), /[<>]/);

    const openai = parse(await readFile(
      join(root, "skills", skill, "agents/openai.yaml"),
      "utf8",
    )) as { interface?: Record<string, unknown> };
    assert.equal(typeof openai.interface?.display_name, "string");
    assert.ok(String(openai.interface?.short_description).length >= 25);
    assert.ok(String(openai.interface?.short_description).length <= 64);
    assert.equal(typeof openai.interface?.default_prompt, "string");
  }
  const orchestrator = contents.get("curate-project-knowledge")!;
  assert.match(orchestrator, /curate-product-knowledge/);
  assert.match(orchestrator, /curate-engineering-knowledge/);
  assert.match(orchestrator, /verify-knowledge-quality/);

  const router = await readFile(
    join(root, "skills/operate-project-knowledge/SKILL.md"),
    "utf8",
  );
  assert.match(router, /invoke `explore-project-knowledge`/i);

  const explorer = contents.get("explore-project-knowledge")!;
  assert.match(explorer, /what this project is, why it exists, what it can do today/);
  assert.match(explorer, /reveal it gradually/);
  assert.match(explorer, /Ask at most one question/);
  assert.match(explorer, /Do not create or edit knowledge/);

  const product = contents.get("curate-product-knowledge")!;
  assert.match(product, /Area, capability, use case, product flow/);
  assert.match(product, /client or product manager/);
  assert.match(product, /never present planned or uncertain\s+behavior as currently available/i);

  const engineering = contents.get("curate-engineering-knowledge")!;
  assert.match(engineering, /architecture, repository ownership/);
  assert.match(engineering, /never infer intended behavior from code alone/);

  const quality = contents.get("verify-knowledge-quality")!;
  assert.match(quality, /mandatory two-axis semantic gate/);
  assert.match(quality, /authority-truth and reader-communication/);
  assert.match(quality, /bind both passes to one unchanged content hash/);
});

test("knowledge view templates encode separate audiences and required sections", async () => {
  const product = await readFile(
    join(root, "skills/curate-product-knowledge/assets/product-concept.md"),
    "utf8",
  );
  assert.match(product, /view: product/);
  assert.match(product, /purpose: current-behavior/);
  assert.match(product, /- stakeholder/);
  for (const section of [
    "What this provides",
    "Who it serves",
    "Domain language",
    "Current behavior",
    "Rules and outcomes",
    "Boundaries and exceptions",
    "Delivery",
    "Examples",
    "Evolution",
    "Related knowledge",
    "Engineering details",
  ]) {
    assert.match(product, new RegExp(`# ${section}`));
  }
  assert.doesNotMatch(product, /# Technical realization/);

  const engineering = await readFile(
    join(root, "skills/curate-engineering-knowledge/assets/engineering-concept.md"),
    "utf8",
  );
  assert.match(engineering, /view: engineering/);
  assert.match(engineering, /purpose: technical-realization/);
  assert.match(engineering, /- engineer/);
  assert.match(engineering, /# Current implementation/);
  assert.match(engineering, /# Product knowledge/);
});

test("knowledge-side cases preserve discoveries and clean-session resume state", async () => {
  const reconstruction = await readFile(
    join(root, "skills/reconstruct-project-knowledge/SKILL.md"),
    "utf8",
  );
  const intake = await readFile(
    join(root, "skills/process-raw-intake/SKILL.md"),
    "utf8",
  );
  const reconstructionCase = await readFile(
    join(root, "skills/reconstruct-project-knowledge/assets/reconstruction-case.md"),
    "utf8",
  );
  const dossier = await readFile(
    join(root, "skills/reconstruct-project-knowledge/assets/repository-dossier.md"),
    "utf8",
  );
  const intakeCase = await readFile(
    join(root, "skills/process-raw-intake/assets/intake-case.md"),
    "utf8",
  );
  const workstream = await readFile(
    join(root, "skills/reconstruct-project-knowledge/assets/reconstruction-workstream.md"),
    "utf8",
  );
  for (const content of [reconstruction, intake]) {
    assert.match(content, /context --json/);
    assert.match(content, /without an ID/);
    assert.match(content, /checkpoint/);
    assert.match(content, /DISC-NNN/);
    assert.match(content, /Observation/);
    assert.match(content, /Evidence/);
    assert.match(content, /Implication/);
    assert.match(content, /Scope/);
    assert.match(content, /Disposition/);
  }
  assert.match(reconstruction, /repository dossier/i);
  assert.match(reconstruction, /cross-repository/i);
  assert.match(reconstruction, /checkpoint is stale/i);
  assert.match(reconstruction, /reconstruct raw-scope/);
  assert.match(reconstruction, /--by human:<maintainer-id>/);
  assert.match(reconstruction, /Never start a linked intake case\s+before this decision/i);
  assert.match(
    reconstruction,
    /never by itself a reason to recommend `excluded`/i,
  );
  assert.match(reconstruction, /do not convert uncertainty into\s+exclusion/i);
  assert.match(intake, /--reconstruction <parent-case-id>/);
  for (const template of [reconstructionCase, dossier, intakeCase]) {
    assert.match(template, /session_record_version: 1/);
    assert.match(template, /# Discovery ledger/);
  }
  assert.match(reconstructionCase, /basis_sha256/);
  assert.match(reconstructionCase, /reconstruction_version: 5/);
  assert.match(reconstructionCase, /strategy: adaptive-orchestrator-worker/);
  assert.match(reconstructionCase, /orchestration:\n\s+version: 3/);
  assert.match(reconstructionCase, /independent_review:/);
  assert.match(reconstructionCase, /requested_profile: deep/);
  assert.match(reconstructionCase, /reasoning_effort:/);
  assert.match(reconstructionCase, /assurance:/);
  assert.match(workstream, /reconstruction_workstream_version: 3/);
  assert.match(workstream, /initial_profile:/);
  assert.match(workstream, /execution_history:/);
  assert.match(workstream, /authority_questions:/);
  assert.match(workstream, /review_history:/);
  assert.match(workstream, /requested_profile:/);
  assert.match(workstream, /escalation_history:/);
  assert.match(workstream, /reasoning_effort:/);
  assert.match(workstream, /explored_context:/);
  assert.match(workstream, /responsibility, not visibility/i);
  assert.match(workstream, /receipt ID/i);
  assert.match(reconstruction, /workstream create/);
  assert.match(reconstruction, /workstream claim/);
  assert.match(reconstruction, /workstream escalate/);
  assert.match(reconstruction, /workstream\s+submit/);
  assert.match(reconstruction, /workstream\s+review/);
  assert.match(reconstructionCase, /scope:\n\s+mode: pending/);
  assert.match(intakeCase, /basis_sha256/);
  assert.match(intakeCase, /parent_reconstruction: null/);
});

test("workflow keeps maintainer-product and engineering roads first-class", async () => {
  const readme = await readFile(join(root, "README.md"), "utf8");
  const idea = await readFile(join(root, "IDEA.md"), "utf8");
  const engine = await readFile(join(root, "spec/ENGINE.md"), "utf8");
  const knowledge = await readFile(join(root, "spec/KNOWLEDGE.md"), "utf8");
  const maintainerGuide = await readFile(
    join(root, "templates/guides/common.md"),
    "utf8",
  );
  const agentGuide = await readFile(
    join(root, "templates/agents/common.md"),
    "utf8",
  );

  for (const content of [readme, idea, engine, knowledge, maintainerGuide]) {
    assert.match(content, /maintainer\/product road/i);
    assert.match(content, /engineering road/i);
    assert.match(content, /first-class/i);
  }
  assert.match(readme, /project collaboration and knowledge workflow/i);
  assert.match(idea, /Both humans and agents can follow both roads/);
  assert.match(engine, /Curated Markdown remains a direct human interface/);
  assert.match(knowledge, /Neither road is subordinate or\s+derived/);
  assert.match(agentGuide, /never one derived\s+from the other/i);
  assert.match(agentGuide, /Decision lineage connects both roads/);
});

test("direction shaping and project research are deliberate bounded modes", async () => {
  const shape = await readFile(
    join(root, "skills/shape-project-direction/SKILL.md"),
    "utf8",
  );
  const research = await readFile(
    join(root, "skills/research-project-context/SKILL.md"),
    "utf8",
  );
  for (const [name, content] of [
    ["shape-project-direction", shape],
    ["research-project-context", research],
  ] as const) {
    assert.doesNotMatch(content, /TODO|\[TODO/);
    const frontmatterMatch = /^---\n([\s\S]+?)\n---/.exec(content);
    assert.ok(frontmatterMatch, `${name} must have YAML frontmatter`);
    const frontmatter = parse(frontmatterMatch[1]!) as Record<string, unknown>;
    assert.equal(frontmatter.name, name);
    assert.equal(typeof frontmatter.description, "string");
    assert.ok(String(frontmatter.description).length <= 1024);
    const openai = parse(await readFile(
      join(root, "skills", name, "agents/openai.yaml"),
      "utf8",
    )) as { interface?: Record<string, unknown> };
    assert.ok(String(openai.interface?.short_description).length >= 25);
    assert.ok(String(openai.interface?.short_description).length <= 64);
  }
  assert.match(shape, /same central bundle/i);
  assert.match(shape, /one question at a time|one focused question/i);
  assert.match(shape, /Do not edit product source|does not write source code/i);
  assert.match(research, /primary (?:and current )?sources|primary material/);
  assert.match(research, /candidate, not authority/i);
  assert.match(research, /claim-to-source matrix/);
});

test("project work skills share one bundle, explicit frontier, and full-file gate", async () => {
  const names = [
    "manage-project-work",
    "shape-project-direction",
    "specify-project-change",
    "split-project-change",
    "implement-work-item",
    "verify-project-work",
  ];
  const contents = new Map<string, string>();
  for (const name of names) {
    const content = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
    contents.set(name, content);
    assert.doesNotMatch(content, /TODO|\[TODO/);
    const frontmatterMatch = /^---\n([\s\S]+?)\n---/.exec(content);
    assert.ok(frontmatterMatch, `${name} must have YAML frontmatter`);
    const frontmatter = parse(frontmatterMatch[1]!) as Record<string, unknown>;
    assert.equal(frontmatter.name, name);
    assert.ok(String(frontmatter.description).length <= 1024);
    const openai = parse(await readFile(
      join(root, "skills", name, "agents/openai.yaml"),
      "utf8",
    )) as { interface?: Record<string, unknown>; policy?: Record<string, unknown> };
    assert.ok(String(openai.interface?.short_description).length >= 25);
    assert.ok(String(openai.interface?.short_description).length <= 64);
    if (name !== "manage-project-work" && name !== "verify-project-work") {
      assert.equal(openai.policy?.allow_implicit_invocation, false);
    }
  }
  assert.match(contents.get("manage-project-work")!, /full\|slice\|wayfinder/);
  assert.match(contents.get("manage-project-work")!, /wfctl work capture add/);
  assert.match(contents.get("manage-project-work")!, /wfctl work checkpoint/);
  assert.match(contents.get("manage-project-work")!, /never copy active progress/i);
  assert.match(contents.get("manage-project-work")!, /Discovery ledger/);
  assert.match(contents.get("manage-project-work")!, /could a fresh session repeat/i);
  assert.match(contents.get("manage-project-work")!, /context --stage resume/);
  assert.match(contents.get("manage-project-work")!, /without an ID/);
  assert.match(contents.get("shape-project-direction")!, /fog/i);
  assert.match(contents.get("shape-project-direction")!, /Do not jump from a map directly/i);
  assert.match(contents.get("specify-project-change")!, /Read every required file completely/i);
  assert.match(contents.get("split-project-change")!, /tracer bullet/i);
  assert.match(contents.get("implement-work-item")!, /Claim before analysis or edits/i);
  assert.match(contents.get("implement-work-item")!, /wfctl work checkpoint/);
  assert.match(contents.get("implement-work-item")!, /Discovery ledger/);
  assert.match(contents.get("implement-work-item")!, /Never hide a discovery only in checkpoint/i);
  assert.match(contents.get("verify-project-work")!, /changed-after-review/i);
  assert.match(contents.get("verify-project-work")!, /wfctl work checkpoint/);
  assert.match(contents.get("verify-project-work")!, /before.*final hash receipt/is);

  for (const asset of ["work-spec.md", "work-issue.md"]) {
    const template = await readFile(
      join(root, "skills/manage-project-work/assets", asset),
      "utf8",
    );
    assert.match(template, /# Discovery ledger/);
    assert.match(template, /Observation/);
    assert.match(template, /Evidence/);
    assert.match(template, /Implication/);
    assert.match(template, /Scope/);
    assert.match(template, /Disposition/);
    assert.match(template, /not .*activity log/i);
  }
});

test("directly derived project-work skills retain exact centralized provenance", async () => {
  const manifest = JSON.parse(await readFile(
    join(root, "vendor/mattpocock/upstream.json"),
    "utf8",
  )) as {
    source: { revision: string };
    distribution: {
      strategy: string;
      installOriginalSuite: boolean;
      fetchMutableUpstreamAtInstall: boolean;
    };
    derivations: Array<{
      upstream: string[];
      local: string[];
      relationship: string;
      retained: string[];
      modified: string[];
    }>;
  };
  assert.match(manifest.source.revision, /^[0-9a-f]{40}$/);
  assert.equal(manifest.distribution.strategy, "integrated-derived-skills");
  assert.equal(manifest.distribution.installOriginalSuite, false);
  assert.equal(manifest.distribution.fetchMutableUpstreamAtInstall, false);
  const thirdParty = await readFile(join(root, "THIRD_PARTY.md"), "utf8");
  const upstreamLicense = await readFile(
    join(root, "vendor/mattpocock/LICENSE"),
    "utf8",
  );
  assert.match(thirdParty, /single human-readable attribution/i);
  assert.match(upstreamLicense, /Copyright \(c\) 2026 Matt Pocock/);

  const expected = new Map([
    ["skills/shape-project-direction/SKILL.md", "skills/engineering/wayfinder/SKILL.md"],
    ["skills/specify-project-change/SKILL.md", "skills/engineering/to-spec/SKILL.md"],
    ["skills/split-project-change/SKILL.md", "skills/engineering/to-tickets/SKILL.md"],
    ["skills/implement-work-item/SKILL.md", "skills/engineering/implement/SKILL.md"],
    ["skills/verify-project-work/SKILL.md", "skills/engineering/code-review/SKILL.md"],
  ]);
  assert.equal(manifest.derivations.length, expected.size);
  for (const derivation of manifest.derivations) {
    assert.ok(derivation.retained.length > 0);
    assert.ok(derivation.modified.length > 0);
    for (const local of derivation.local) {
      const upstream = expected.get(local);
      assert.ok(upstream, `unexpected local derivation ${local}`);
      assert.ok(derivation.upstream.includes(upstream));
      assert.match(thirdParty, new RegExp(local.split("/")[1]!));
    }
  }
});

test("trigger and behavior eval corpora cover positives and near misses", async () => {
  const trigger = JSON.parse(await readFile(
    join(root, "evals/knowledge-views/trigger-evals.json"),
    "utf8",
  )) as Array<{
    id: string;
    prompt: string;
    should_trigger: string[];
    should_not_trigger: string[];
  }>;
  const behavior = JSON.parse(await readFile(
    join(root, "evals/knowledge-views/behavior-evals.json"),
    "utf8",
  )) as Array<{
    id: string;
    prompt: string;
    required: string[];
    forbidden: string[];
  }>;
  assert.ok(trigger.length >= 20);
  assert.ok(behavior.length >= 10);
  assert.equal(new Set(trigger.map((entry) => entry.id)).size, trigger.length);
  assert.equal(new Set(behavior.map((entry) => entry.id)).size, behavior.length);
  for (const skill of skills) {
    assert.ok(trigger.some((entry) => entry.should_trigger.includes(skill)));
  }
  for (const skill of skills.slice(1)) {
    assert.ok(trigger.some((entry) => entry.should_not_trigger.includes(skill)));
  }
  assert.ok(trigger.filter((entry) => entry.should_trigger.length === 0).length >= 5);
  assert.ok(trigger.some((entry) =>
    entry.id === "discovery-newcomer-natural"
    && entry.should_trigger.includes("explore-project-knowledge")
  ));
  const discovery = trigger.find((entry) => entry.id === "discovery-newcomer-natural")!;
  assert.doesNotMatch(discovery.prompt, /Area|capability|repository|source|format|skill/i);
  assert.ok(discovery.should_not_trigger.includes("curate-product-knowledge"));
  assert.ok(behavior.some((entry) => entry.id === "discovery-first-visit"));
  assert.ok(behavior.some((entry) => entry.id === "discovery-area-progressive"));
  assert.ok(behavior.some((entry) => entry.id === "discovery-focused-current-behavior"));
  assert.ok(behavior.some((entry) => entry.id === "discovery-sparse-knowledge"));
  assert.ok(behavior.every((entry) =>
    entry.prompt.length > 0
    && entry.required.length > 0
    && entry.forbidden.length > 0
  ));
});

test("routing evals distinguish read-only, deliberate, and mandatory modes", async () => {
  const trigger = JSON.parse(await readFile(
    join(root, "evals/knowledge-routing/trigger-evals.json"),
    "utf8",
  )) as Array<{
    id: string;
    prompt: string;
    should_trigger: string[];
    should_not_trigger: string[];
  }>;
  const behavior = JSON.parse(await readFile(
    join(root, "evals/knowledge-routing/behavior-evals.json"),
    "utf8",
  )) as Array<{
    id: string;
    prompt: string;
    required: string[];
    forbidden: string[];
  }>;
  assert.ok(trigger.length >= 12);
  assert.ok(behavior.length >= 10);
  assert.ok(trigger.some((entry) =>
    entry.should_trigger.includes("shape-project-direction")
  ));
  assert.ok(trigger.some((entry) =>
    entry.should_trigger.includes("research-project-context")
  ));
  assert.ok(trigger.some((entry) =>
    entry.should_trigger.includes("explore-project-knowledge")
    && entry.should_not_trigger.includes("reconstruct-project-knowledge")
  ));
  assert.ok(behavior.some((entry) => entry.id === "direction-one-question"));
  assert.ok(behavior.some((entry) => entry.id === "two-axis-quality"));
  assert.ok(behavior.some((entry) =>
    entry.id === "reconstruction-adaptive-worker-routing"
  ));
  assert.ok(behavior.some((entry) =>
    entry.id === "reconstruction-evidence-driven-escalation"
  ));
  assert.ok(behavior.some((entry) => entry.id === "active-checkpoint-not-capture"));
  assert.ok(behavior.some((entry) => entry.id === "material-discovery-survives-session"));
  assert.ok(behavior.some((entry) => entry.id === "clean-session-resume-discovery"));
  assert.ok(behavior.some((entry) => entry.id === "pending-capture-lifecycle"));
  assert.ok(trigger.some((entry) =>
    entry.id === "clean-session-resume"
    && entry.should_trigger.includes("manage-project-work")
  ));
  assert.ok(behavior.every((entry) =>
    entry.prompt.length > 0
    && entry.required.length > 0
    && entry.forbidden.length > 0
  ));
});

test("verification guide separates natural discovery from authoring conformance", async () => {
  const guide = await readFile(join(root, "spec/VERIFICATION.md"), "utf8");
  assert.match(guide, /## 3\. Test newcomer discovery/);
  assert.match(
    guide,
    /> I am new to this project\. Help me understand what it is for and what it can/,
  );
  assert.match(guide, /Keep these assertions hidden from the tested agent/);
  assert.match(guide, /## 4\. Test progressive follow-ups/);
  assert.match(guide, /## 5\. Test authoring separately/);
  assert.match(guide, /This is a conformance test, not an onboarding prompt/);
  assert.match(guide, /## 8\. Test clean-session recovery and discovery preservation/);
  assert.match(guide, /wfctl work context --stage resume/);
  assert.match(guide, /bottom canaries/i);
});
