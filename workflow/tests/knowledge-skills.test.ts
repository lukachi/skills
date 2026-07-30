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
  assert.match(shape, /same\s+canonical living spec|same canonical spec/);
  assert.match(shape, /one focused question/);
  assert.match(shape, /Do not edit product source/);
  assert.match(research, /primary (?:and current )?sources|primary material/);
  assert.match(research, /candidate, not authority/i);
  assert.match(research, /claim-to-source matrix/);
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
});
