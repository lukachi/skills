import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skills = [
  "curate-project-knowledge",
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

  const product = contents.get("curate-product-knowledge")!;
  assert.match(product, /Area, capability, use case, product flow/);
  assert.match(product, /client or product manager/);
  assert.match(product, /never present planned or uncertain behavior as currently available/);

  const engineering = contents.get("curate-engineering-knowledge")!;
  assert.match(engineering, /implementation, architecture, repository ownership/);
  assert.match(engineering, /never infer intended behavior from code alone/);

  const quality = contents.get("verify-knowledge-quality")!;
  assert.match(quality, /mandatory semantic quality gate/);
  assert.match(quality, /content-hash-bound quality receipt/);
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
  assert.ok(behavior.every((entry) =>
    entry.prompt.length > 0
    && entry.required.length > 0
    && entry.forbidden.length > 0
  ));
});
