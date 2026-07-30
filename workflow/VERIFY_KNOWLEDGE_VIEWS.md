# Verify the Knowledge Views Workflow

This guide verifies both deterministic enforcement and real agent behavior.
Passing automated tests proves the package contract. It does not prove that an
agent understood a domain correctly; the black-box sessions cover that layer.

## 1. Verify the package

From this package directory:

```sh
bun install
bun run check
```

Expected result:

- type checking passes;
- unit tests run in isolated sequential Bun processes and pass;
- integration tests pass;
- all skills pass structural validation;
- the bundled CLI runs under Bun, Node, and Deno;
- package smoke tests include every new skill and guide.

Inspect the focused tests:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
```

The tests deliberately prove that validation rejects:

- a product document in the wrong path or view;
- missing stakeholder sections;
- code or inline identifiers in a product body;
- prose inside the link-only Engineering details section;
- engineering knowledge that claims product meaning from code;
- a missing, incomplete, or stale semantic quality receipt;
- an incomplete stakeholder Area index.

## 2. Verify installation

Create disposable Git repositories or use clean test worktrees. Install one
knowledge profile and one leaf profile:

```sh
wfctl init knowledge --target /path/to/test-knowledge
wfctl init leaf --target /path/to/test-leaf --knowledge /path/to/test-knowledge
```

Confirm both selected agent targets contain:

```text
curate-project-knowledge
curate-product-knowledge
curate-engineering-knowledge
verify-knowledge-quality
```

The knowledge profile receives the complete authoring stack. A leaf receives
the same view and verification skills because it may prepare evidence-backed
change output, but durable curated knowledge is still written only in the
configured knowledge repository.

Run:

```sh
wfctl check --target /path/to/test-knowledge
wfctl check --target /path/to/test-leaf
```

For an existing installation, use `wfctl upgrade`. Existing curated concepts
from workflow 0.3 require a semantic migration: the agent assigns their view,
purpose, audience, separates mixed bodies, performs quality review, and records
fresh hashes. `wfctl` must report the missing fields rather than silently
guessing the migration.

## 3. Run a positive black-box session

Start a fresh Codex or Claude session inside the initialized knowledge
repository. Do not name the skills. Ask:

> Explain the current revival capability to the client who funded the game.
> They should understand how it works without code or architecture details.
> If current knowledge is incomplete, verify it from the configured leaves and
> ask me only for product authority that evidence cannot establish.

Observe the session and resulting files. A pass requires:

1. `operate-project-knowledge` routes the request.
2. Product authoring uses `curate-product-knowledge`.
3. Source claims use Graphify first, then direct pinned source and tests.
4. The product body explains outcome, audience, current behavior, rules,
   exceptions, delivery, examples, and evolution.
5. It contains no classes, functions, endpoints, schemas, packages,
   repositories, source paths, or implementation walkthrough.
6. Engineering material is separate and linked.
7. Accepted intent, observed delivery, and alignment remain distinct.
8. `verify-knowledge-quality` runs before stable status.
9. The quality receipt and normal verification use the current
   `wfctl knowledge hash` result.
10. `wfctl knowledge validate` and `wfctl knowledge build` pass.

Repeat the same prompt in the other agent. Compare artifacts, not eloquence.

## 4. Run engineering separation

In another fresh session, ask:

> Document how the verified revival capability is implemented across the
> selected source repositories, including ownership, data/control flow,
> contracts, failure behavior, operations, and verification.

A pass requires:

- `curate-engineering-knowledge` is used;
- product meaning is linked, not re-derived from code;
- every implementation claim is pinned to exact source or runtime evidence;
- repository observations converge into one whole-project realization;
- no machine-local worktree path enters durable knowledge;
- the product page remains unchanged unless product behavior actually changed.

## 5. Run adversarial cases

Use fresh sessions and one case at a time:

1. **Accepted but absent:** the maintainer accepts a capability but complete
   reconstruction finds no implementation. The product view must say accepted
   and unavailable; it must not invent a source path.
2. **Legacy unknown intent:** code contains behavior with no product authority.
   The agent may document observed engineering reality but must ask before
   calling it intended product behavior.
3. **Conflicting raw and code:** raw says one rule and code implements another.
   Raw remains a clue; code proves delivery only; stable product truth blocks
   pending a maintainer decision.
4. **Technical leak:** place an endpoint, class name, and source path in a
   product draft. Both deterministic validation and semantic review must fail.
5. **Omitted exception:** remove a rare but material boundary while keeping
   fluent prose. Deterministic checks may pass, but semantic quality must fail.
6. **Stale receipt:** edit one sentence after review. Validation must reject
   the old quality and verification hashes.
7. **Near miss:** ask only to recolor a button or fix a local null pointer.
   Product and engineering curation skills must not trigger.
8. **Proposal only:** brainstorm an unaccepted future feature. It must remain
   in a change record, not current product knowledge.

The canonical prompts and assertions live in:

```text
evals/knowledge-views/trigger-evals.json
evals/knowledge-views/behavior-evals.json
```

Run every prompt at least three times per agent/version when measuring
triggering. Record model, agent version, installed workflow version, triggered
skills, files changed, validator output, failures, and token/time cost. Keep
the test input and expected assertions hidden from the tested agent beyond the
ordinary task prompt.

## 6. Review like a maintainer

For each product result, answer without reading engineering files:

- Can I explain what this provides?
- Do I know who it serves?
- Do I understand current behavior and delivery?
- Are important rules and exceptions visible?
- Can I distinguish current, planned, retired, and unknown behavior?
- Can I follow meaningful evolution without reading a flat event dump?

Then open Engineering details:

- Can an engineer locate ownership and exact implementation?
- Are flow, contracts, failures, operations, and verification covered?
- Does the technical view link product meaning instead of redefining it?

Any “no” is a failed eval even when the CLI passes. Add the failure as a new
regression case before changing the skill or validator.
