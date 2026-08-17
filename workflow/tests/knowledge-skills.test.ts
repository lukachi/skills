import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
  // Behaviour, not wording: planned behaviour may not read as available, and an
  // exception may not be dropped to make a sentence read well.
  const flatProduct = product.replace(/\s+/g, " ");
  assert.match(flatProduct, /present tense only for behavior the declared delivery state supports/i);
  assert.match(flatProduct, /simplify the wording and never the meaning/i);

  const engineering = contents.get("curate-engineering-knowledge")!;
  assert.match(engineering, /architecture, repository ownership/);
  assert.match(engineering, /never infer intended behavior from code alone/);

  const quality = contents.get("verify-knowledge-quality")!;
  assert.match(quality, /mandatory two-axis semantic gate/);
  // The independence is the gate. A phrase can be reworded; this cannot be dropped
  // without dropping the mechanism.
  const flatQuality = quality.replace(/\s+/g, " ");
  assert.match(flatQuality, /Do not reuse the first pass's verdict as evidence for the second/i);
  assert.match(quality, /authority-truth/);
  assert.match(quality, /reader-communication/);
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
  // The reconstruction contract is split between a routing skill and its
  // loaded-on-demand references. Assert the contract, not which file holds it.
  const reconstructionSkill = await readFile(
    join(root, "skills/reconstruct-project-knowledge/SKILL.md"),
    "utf8",
  );
  const reconstructionReferences = join(
    root,
    "skills/reconstruct-project-knowledge/references",
  );
  const reconstruction = [
    reconstructionSkill,
    ...await Promise.all(
      (await readdir(reconstructionReferences))
        .filter((entry) => entry.endsWith(".md"))
        .sort()
        .map((entry) => readFile(join(reconstructionReferences, entry), "utf8")),
    ),
  ].join("\n\n");
  // Every reference must be reachable from the skill, or the split hides it.
  for (const entry of await readdir(reconstructionReferences)) {
    assert.match(
      reconstructionSkill,
      new RegExp(`references/${entry.replace(".", "\\.")}`),
      `${entry} is not linked from reconstruct-project-knowledge/SKILL.md`,
    );
  }
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
  assert.match(shape, /central change bundle/i);
  assert.match(shape, /product source stays untouched|Do not edit product source/i);
  assert.match(research, /primary (?:and current )?sources|primary material/);
  assert.match(research, /candidate, not authority/i);
  assert.match(research, /claim-to-source matrix/);
});

/**
 * The conversational half of the upstream skills, which a paraphrase drops first
 * because no gate can check it. Revision 2ab9580 kept every artifact and state
 * machine and lost all of this: relentless interviewing, the shared-understanding
 * bound, grilling as the default ticket type, naming work rather than numbering
 * it, and the maintainer's own entry point. Each assertion below names one
 * behaviour whose absence was invisible until a maintainer said the sessions did
 * not interrogate them.
 */
test("the conversational behaviour adapted from upstream survives", async () => {
  const read = (name: string) =>
    readFile(join(root, "skills", name, "SKILL.md"), "utf8");
  const grill = await read("grill-project-decisions");
  const grillMe = await read("grill-me");
  const domain = await read("model-project-domain");
  const shape = await read("shape-project-direction");
  const spec = await read("specify-project-change");
  const split = await read("split-project-change");
  const implement = await read("implement-work-item");
  const verify = await read("verify-project-work");

  // Grilling is an engine with a termination condition the maintainer owns.
  assert.match(grill, /relentlessly/i);
  assert.match(grill, /design tree/i);
  assert.match(grill, /frontier/i);
  assert.match(grill, /Ask the whole frontier in one round/i);
  assert.match(grill, /recommended answer/i);
  assert.match(grill, /until the maintainer confirms/i);
  assert.match(grill, /shared understanding/i);

  // The maintainer can summon it; upstream keeps this user-invoked.
  assert.match(grillMe, /^disable-model-invocation:\s*true$/m);
  assert.match(grillMe, /grill-project-decisions/);
  assert.match(grillMe, /model-project-domain/);
  const waitWhat = await read("wait-what");
  assert.match(waitWhat, /^disable-model-invocation:\s*true$/m);

  // Domain modelling is the active discipline, not a section header.
  assert.match(domain, /Challenge against/i);
  assert.match(domain, /Sharpen fuzzy language/i);
  assert.match(domain, /scenarios/i);
  assert.match(domain, /Hard to reverse/i);

  // Wayfinder's own steering, all of it dropped in the paraphrase.
  assert.match(shape, /Refer by name/i);
  assert.match(shape, /never by a bare id/i);
  assert.match(shape, /\bHITL\b/);
  assert.match(shape, /\bAFK\b/);
  assert.match(shape, /The default case/i);
  assert.match(shape, /fog of war/i);
  assert.match(shape, /never resolve more than one issue per session/i);
  assert.match(shape, /grill-project-decisions/);

  // Specification synthesises; the interview is a separate, earlier act.
  assert.match(spec, /the\s+interview is not this step/i);
  assert.match(spec, /User stories/);
  assert.match(spec, /As a `<actor>`/);
  assert.match(spec, /seams/i);
  assert.match(spec, /Check with the maintainer that these seams/i);

  // Ticket design keeps its rules and its wide-refactor escape hatch.
  assert.match(split, /tracer bullet/i);
  assert.match(split, /prefactor/i);
  assert.match(split, /make the change easy, then make the easy change/i);
  assert.match(split, /expand.contract/i);
  assert.match(split, /blast radius/i);
  assert.match(split, /Does the granularity feel right/i);

  // The test-first loop and its bounds.
  assert.match(implement, /pre-agreed seams/i);
  assert.match(implement, /red before green/i);
  assert.match(implement, /Refactoring is not part of this loop/i);
  assert.match(implement, /Tautological/i);
  assert.match(implement, /Horizontal slicing/i);

  // Two axes, in parallel, never reranked into one verdict.
  assert.match(verify, /Standards/);
  assert.match(verify, /two Agent calls/i);
  assert.match(verify, /smell baseline/i);
  assert.match(verify, /Do not merge or rerank/i);
  assert.match(verify, /Why two axes/i);
  const smells = await readFile(
    join(root, "skills/verify-project-work/references/smell-baseline.md"),
    "utf8",
  );
  for (const smell of ["Mysterious Name", "Feature Envy", "Shotgun Surgery", "Refused Bequest"]) {
    assert.match(smells, new RegExp(smell));
  }
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
  assert.match(
    contents.get("shape-project-direction")!,
    /nothing goes from a map straight into\s+implementation/i,
  );
  assert.match(contents.get("specify-project-change")!, /Read every required file completely/i);
  assert.match(contents.get("split-project-change")!, /tracer bullet/i);
  assert.match(contents.get("implement-work-item")!, /Claim before analysis or edits/i);
  assert.match(contents.get("implement-work-item")!, /wfctl work checkpoint/);
  assert.match(contents.get("implement-work-item")!, /Discovery ledger/);
  assert.match(
    contents.get("implement-work-item")!,
    /The\s+discovery itself stays in the semantic record/i,
  );
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
  assert.equal(manifest.distribution.strategy, "adapted-upstream-skills");
  assert.equal(manifest.distribution.installOriginalSuite, false);
  assert.equal(manifest.distribution.fetchMutableUpstreamAtInstall, false);
  const thirdParty = await readFile(join(root, "THIRD_PARTY.md"), "utf8");
  const upstreamLicense = await readFile(
    join(root, "vendor/mattpocock/LICENSE"),
    "utf8",
  );
  assert.match(thirdParty, /single human-readable attribution/i);
  assert.match(upstreamLicense, /Copyright \(c\) 2026 Matt Pocock/);

  // One row per local skill that adapts upstream text. A local file that appears
  // here and nowhere in THIRD_PARTY.md is an undocumented derivation; a local
  // skill missing from this map is one nobody recorded a lineage for.
  const expected = new Map([
    ["skills/shape-project-direction/SKILL.md", "skills/engineering/wayfinder/SKILL.md"],
    ["skills/specify-project-change/SKILL.md", "skills/engineering/to-spec/SKILL.md"],
    ["skills/split-project-change/SKILL.md", "skills/engineering/to-tickets/SKILL.md"],
    ["skills/implement-work-item/SKILL.md", "skills/engineering/implement/SKILL.md"],
    ["skills/implement-work-item/references/tests.md", "skills/engineering/tdd/tests.md"],
    ["skills/implement-work-item/references/mocking.md", "skills/engineering/tdd/mocking.md"],
    ["skills/verify-project-work/SKILL.md", "skills/engineering/code-review/SKILL.md"],
    [
      "skills/verify-project-work/references/smell-baseline.md",
      "skills/engineering/code-review/SKILL.md",
    ],
    ["skills/grill-project-decisions/SKILL.md", "skills/productivity/grilling/SKILL.md"],
    ["skills/grill-me/SKILL.md", "skills/productivity/grill-me/SKILL.md"],
    ["skills/model-project-domain/SKILL.md", "skills/engineering/domain-modeling/SKILL.md"],
    [
      "skills/prototype-project-decision/SKILL.md",
      "skills/engineering/prototype/SKILL.md",
    ],
    [
      "skills/prototype-project-decision/references/logic.md",
      "skills/engineering/prototype/LOGIC.md",
    ],
    [
      "skills/prototype-project-decision/references/ui.md",
      "skills/engineering/prototype/UI.md",
    ],
    ["skills/wait-what/SKILL.md", "skills/productivity/wait-what/SKILL.md"],
    ["skills/research-project-context/SKILL.md", "skills/engineering/research/SKILL.md"],
  ]);
  const declared = new Set(manifest.derivations.flatMap((entry) => entry.local));
  assert.deepEqual(
    [...expected.keys()].filter((local) => !declared.has(local)),
    [],
    "every adapted local file must declare its upstream lineage",
  );
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

test("the maintainer-review rule keeps the structure that survives a long session", async () => {
  const rule = await readFile(join(root, "rules/common/maintainer-review.md"), "utf8");
  // Prose assertions run against a whitespace-flattened copy so a reflowed
  // paragraph does not read as a deleted rule.
  const flat = rule.replace(/\s+/g, " ");

  // The rules are derived from a reader, not asserted. Upstream's own ordering.
  assert.match(flat, /## What the maintainer cannot see/);
  assert.match(flat, /They did not watch/i);
  assert.match(flat, /hold no identifier you generated/i);

  // Ten numbered rules, and every one of them carries a worked pair. A rule
  // without an example is the shape the corpus already failed in.
  const sections = rule.split(/\n### /).slice(1);
  const numbered = sections.filter((section) => /^\d+\. /.test(section));
  assert.equal(numbered.length, 10, "maintainer-review must carry ten numbered rules");
  for (const section of numbered) {
    const title = section.split("\n")[0]!;
    assert.match(section, /\bBad\b/, `rule "${title}" has no Bad example`);
    assert.match(section, /\bGood\b/, `rule "${title}" has no Good example`);
  }

  // The reader test, and both ways of failing it.
  assert.match(flat, /Would they have to look something up to understand this\?/);
  assert.match(flat, /addressed prose/i);
  assert.match(flat, /emptied prose/i);

  // Substitution, which is what stops the reader test producing emptied prose.
  assert.match(flat, /Show the shape rather than describe it/i);
  assert.match(flat, /show-project-work/);

  // A numbered interview round is not several packets stacked in one message.
  assert.match(flat, /One decision per packet/i);
  assert.match(flat, /A numbered round of questions is not this/i);

  // Named overrides rather than implied ones.
  assert.match(flat, /## When to break them/);
  assert.match(flat, /They repeated the question/i);
  assert.match(flat, /A rule would delete the answer/i);
  assert.match(flat, /A rule fights a gate/i);

  // The register switches itself off; it does not wait to be asked.
  assert.match(flat, /## Auto-clarity/);
  assert.match(flat, /irreversible action is being described/i);
  assert.match(flat, /answered a packet with a question instead of a decision/i);
  assert.match(flat, /Never announce the switch/i);

  // A mechanical check, because judgement is what loses under pressure.
  assert.match(flat, /## Before you send/);
  assert.match(flat, /if they read only the first line and the last line/i);

  // The clause that resolves drift on turn forty.
  assert.match(flat, /## Persistence/);
  assert.match(flat, /If you are unsure whether they still apply, they do/i);
  assert.match(flat, /Write in the language the maintainer writes in/i);

  // Recovered content. `.claude/rules/` is a generated copy of this file, and a
  // rewrite based on a stale one silently dropped both of these once already.
  assert.match(flat, /Write their reply before you send the message/i);
  assert.match(flat, /Three records are ready and all three are waiting on you/);
  assert.match(flat, /an alternative with its consequence/i);
  assert.match(flat, /rewords faster than any list can be kept/);
  assert.match(flat, /a wrong page gets rewritten rather than argued for/i);

  // The gates, and the arithmetic that is not one.
  assert.match(flat, /Closure is arithmetic, so close it/i);
  assert.match(flat, /seven hours and fifty-four minutes/);
  assert.match(flat, /Promotion is the gate that compounds/i);
  assert.match(flat, /A release is never inferred/i);
});

test("show-project-work carries every format, not a description of them", async () => {
  const skill = await readFile(join(root, "skills/show-project-work/SKILL.md"), "utf8");

  // Each format is present as a worked example. An example rewritten into this
  // project's nouns stops demonstrating a format, so these stay as upstream wrote
  // them and the assertions name the example rather than the label.
  assert.match(skill, /```text\non\(save\)/);
  assert.match(skill, /```text\nsubmitForm\n  createSession/);
  assert.match(skill, /```tsx\n<SessionPage>/);
  assert.match(skill, /```text\nsrc\/\n├── commands\//);
  assert.match(skill, /```mermaid\nsequenceDiagram/);
  assert.match(skill, /```ts\nfunction expandSkill/);

  // Four diff shapes, matched to the topic rather than one generic diff.
  const diffs = skill.match(/```diff\n/g) ?? [];
  assert.equal(diffs.length, 4, "the four diff shapes must all be present");
  assert.match(skill, /For a component change/);
  assert.match(skill, /For a file-layout change/);
  assert.match(skill, /For a call-tree or call-stack change/);
  assert.match(skill, /For a state or control-flow change/);

  // Upstream's judgement clause, which is what stops this becoming decoration.
  assert.match(skill, /Pick the smallest view that makes the key point clear/);
  assert.match(skill, /it is unlikely you will use all of\s+them/);

  // What this workflow changes, and nothing else.
  assert.match(skill, /artifacts\//);
  assert.match(skill, /A rendered packet is never replaced by a visual/i);
  assert.match(skill, /wfctl work ask/);
});

test("the maintainer's own entry points persist rather than firing once", async () => {
  const waitWhat = await readFile(join(root, "skills/wait-what/SKILL.md"), "utf8");
  assert.match(waitWhat, /^disable-model-invocation:\s*true$/m);
  assert.match(waitWhat, /ASD-STE100/);
  assert.match(waitWhat, /Then stay in this register/i);
  assert.match(waitWhat, /not for this message/i);
  assert.match(waitWhat, /normal mode/);
  assert.match(waitWhat, /show-project-work/);

  const grillMe = await readFile(join(root, "skills/grill-me/SKILL.md"), "utf8");
  assert.match(grillMe, /^disable-model-invocation:\s*true$/m);
});

test("nothing in the corpus still asks for one question per turn while shaping", async () => {
  // The interview asks a whole numbered round. Four files used to contradict it,
  // including the rule whose entire job is to license asking during shaping.
  const shapingSurfaces = [
    "rules/common/execution-continuity.md",
    "rules/common/maintainer-review.md",
    "templates/agents/common.md",
    "templates/agents/knowledge.md",
    "templates/guides/common.md",
    "templates/guides/knowledge.md",
    "skills/shape-project-direction/SKILL.md",
    "skills/specify-project-change/SKILL.md",
    "skills/split-project-change/SKILL.md",
  ];
  for (const path of shapingSurfaces) {
    const content = await readFile(join(root, path), "utf8");
    assert.doesNotMatch(
      content,
      /(ask|asks|asking) one (material |focused )?question(s)? at a time|asks one at a time/i,
      `${path} still asks for one question at a time`,
    );
  }

  const grill = await readFile(join(root, "skills/grill-project-decisions/SKILL.md"), "utf8");
  assert.match(grill, /Ask the whole frontier in one round/i);

  const continuity = await readFile(join(root, "rules/common/execution-continuity.md"), "utf8");
  assert.match(continuity, /a whole\s+numbered round of them at once is correct/i);
});

test("every adapted upstream is pinned, licensed, and declared", async () => {
  const upstreams = [
    { dir: "mattpocock", copyright: /Matt Pocock/, marker: /mattpocock\/skills/ },
    { dir: "humanlayer", copyright: /HumanLayer/, marker: /humanlayer\/skills/ },
    { dir: "ayghri", copyright: /Ayoub Ghriss/, marker: /i-have-adhd/ },
    { dir: "juliusbrussee", copyright: /Julius Brussee/, marker: /caveman/ },
  ];
  const thirdParty = await readFile(join(root, "THIRD_PARTY.md"), "utf8");
  for (const upstream of upstreams) {
    const manifest = JSON.parse(await readFile(
      join(root, "vendor", upstream.dir, "upstream.json"),
      "utf8",
    )) as {
      source: { revision: string; license: string };
      method: { rule: string };
      distribution: { installOriginalSuite: boolean; fetchMutableUpstreamAtInstall: boolean };
      derivations: Array<{ upstream: string[]; local: string[]; relationship: string }>;
    };
    assert.match(manifest.source.revision, /^[0-9a-f]{40}$/, `${upstream.dir} is not pinned`);
    assert.equal(manifest.distribution.installOriginalSuite, false);
    assert.equal(manifest.distribution.fetchMutableUpstreamAtInstall, false);
    assert.ok(manifest.derivations.length > 0, `${upstream.dir} declares no derivation`);
    for (const derivation of manifest.derivations) {
      assert.ok(derivation.upstream.length > 0);
      assert.ok(derivation.local.length > 0);
    }
    // The rule that the last paraphrase was recorded as satisfying.
    assert.match(manifest.method.rule, /paraphrase/i, `${upstream.dir} states no method`);
    const license = await readFile(join(root, "vendor", upstream.dir, "LICENSE"), "utf8");
    assert.match(license, upstream.copyright);
    assert.match(thirdParty, upstream.marker);
  }
});

test("the curation cluster states the four routes and stops restating the validator", async () => {
  const read = (path: string) => readFile(join(root, "skills", path), "utf8");
  const model = await read("curate-project-knowledge/references/knowledge-model.md");
  const flat = model.replace(/\s+/g, " ");

  // The rule the corpus never stated, and the reason a maintainer could not work
  // out why one route asks them and another does not.
  assert.match(
    flat,
    /a route needs a maintainer gate exactly when it can become a cited authority/i,
  );
  for (const route of ["project-change:", "project-reconstruction:", "trajectory-vision:"]) {
    assert.match(model, new RegExp(route.replace(/[:]/g, "\\$&")));
  }
  // An intake case is the one route that gates nothing, because it can authorize
  // nothing: no source kind names it and curated knowledge may not cite its paths.
  assert.match(flat, /An intake case becomes nothing/i);
  assert.match(flat, /cannot be the authority for anything it promotes/i);
  assert.match(flat, /would ask the maintainer the same question twice/i);

  // Each reference says what the validator already owns, so a reader knows to run
  // it rather than work from the prose.
  for (const path of [
    "curate-project-knowledge/references/knowledge-model.md",
    "curate-product-knowledge/references/product-writing-contract.md",
    "curate-engineering-knowledge/references/engineering-writing-contract.md",
    "verify-knowledge-quality/references/authority-review.md",
    "verify-knowledge-quality/references/reader-communication-review.md",
  ]) {
    assert.match(
      (await read(path)).replace(/\s+/g, " "),
      /cannot check|already (?:refuses|checked|enforces)/i,
      `${path} must say what the validator already owns`,
    );
  }

  // The two axes own their own checks; a third file restating both is what made
  // "run them independently" impossible to follow.
  await assert.rejects(read("verify-knowledge-quality/references/quality-rubric.md"));

  // The required-section lists belong to the templates and the validator, which
  // names the missing one. Prose copies of them drifted from both.
  const contracts = [
    await read("curate-product-knowledge/references/product-writing-contract.md"),
    await read("curate-engineering-knowledge/references/engineering-writing-contract.md"),
  ];
  for (const contract of contracts) {
    assert.doesNotMatch(contract, /^## Required sections$/m);
  }
  // The path-to-view mapping is enforced by expectedViewForPath, so no document
  // restates which directory takes which view.
  assert.doesNotMatch(model, /^- product: `vision\//m);
});
