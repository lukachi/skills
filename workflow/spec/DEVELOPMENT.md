# Development guide

## Audience

Use this guide when changing `wfctl`, its installed assets, or its package
contract. End users should follow the [user guides](../docs/).

## Requirements

- Node.js 20 or newer for `wfctl`;
- Node.js 22 or newer for current QMD;
- Bun 1.3 or newer;
- Deno for the CLI-core runtime smoke test;
- QMD 2.5.3 or newer;
- Graphify and its native skill for leaf integration.

Install the pinned QMD version with:

```sh
bun install -g @tobilu/qmd@2.5.3
```

## Build locally

```sh
cd workflow
bun install
bun run build
bun link
wfctl --help
```

The bundled executable must run with all supported runtimes:

```sh
bun dist/cli.js --help
node dist/cli.js --help
deno run -A dist/cli.js --help
```

## Verify changes

Run the complete gate:

```sh
bun run check
```

It covers:

- TypeScript type checking;
- isolated unit tests;
- eval corpus validity and any recorded agent-behavior runs;
- a rebuilt bundle that matches the committed `dist/`;
- preflight integration;
- real QMD behavior;
- real Graphify behavior;
- reconstruction integration;
- Bun, Node.js, and Deno runtime smoke tests;
- packed npm artifact contents and CLI execution.

`.github/workflows/workflow-check.yml` runs the same gate in CI on every push
and pull request that touches `workflow/`.

Focused suites:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
bun run test:evals
```

`dist/cli.js` is committed and shipped. `bun run build` overwrites it, so
`bun run check:dist` exists to reject a stale committed bundle instead of
silently repairing it.

Automated tests prove deterministic contracts. They do not prove that an agent
selects the right skill, understands a project, or writes useful stakeholder
knowledge. Use [VERIFICATION.md](VERIFICATION.md) for black-box behavior.

## Distribution contents

The package includes:

- the short package `README.md` and `IDEA.md`;
- user guides under `docs/`;
- normative contracts under `spec/`;
- bundled CLI under `dist/`;
- rules, skills, templates, and eval corpora;
- third-party provenance, pinned source mappings, and retained licenses.

The package is the only canonical distribution source. Do not make consumer
repositories fetch mutable workflow assets from a branch.

## Skill profiles

Both profiles install:

- `setup-workflow-environment`;
- `analyze-with-graphify`;
- QMD's official version-matched skill.

Knowledge adds:

- `operate-project-knowledge`;
- `explore-project-knowledge`;
- `reconstruct-project-knowledge`;
- `process-raw-intake`;
- `research-project-context`;
- `shape-project-direction`;
- `specify-project-change`;
- `split-project-change`;
- `implement-work-item`;
- `align-project-knowledge`;
- `manage-project-work`;
- `verify-project-work`;
- `curate-project-knowledge`;
- `curate-product-knowledge`;
- `curate-engineering-knowledge`;
- `verify-knowledge-quality`.

Leaf adds every shared work, alignment, exploration, shaping, curation, and
verification skill, but excludes knowledge-only operation, raw intake,
reconstruction, and durable project research.

The pinned `skills` CLI installs independent copies in each selected agent's
native location. `wfctl` must not create cross-agent symlinks.

## Upstream skill derivations

Some third-party skills are direct modified sources; others supply only a
bounded behavior or vocabulary. State that relationship precisely instead of
flattening both into “inspiration.” They remain source inputs, not mutable
runtime dependencies or a second consumer workflow.

For every direct derivation:

- pin the exact reviewed upstream revision and source path under `vendor/`;
- record retained and modified behavior in the machine-readable mapping;
- retain the upstream license once under `vendor/` and keep the detailed
  mapping in `THIRD_PARTY.md` instead of duplicating notices across skills;
- describe the relationship in `THIRD_PARTY.md`, which the setup guide links;
- install only the integrated local skill, never an ambiguous parallel tracker.

When refreshing a derivation or influence:

1. inspect the complete relevant upstream skills and references;
2. update the pinned revision and review scope;
3. preserve wfctl ownership, knowledge authority, and worktree invariants;
4. update the local derivation deliberately instead of overwriting it from
   mutable upstream;
5. rerun deterministic and black-box behavior verification.

## Documentation ownership

- `README.md` is a short project introduction and route map.
- `IDEA.md` explains purpose, method, goals, and non-goals.
- `docs/01…04` is the user journey, organized by the situation the maintainer
  is in — setting up, working in knowledge, working in a source repository, and
  deciding — not by workflow entity. Guides describe what happens and what the
  maintainer decides; they link normative behavior instead of restating it, and
  they say plainly which guarantees are mechanical and which are judgment.
- `spec/` owns normative implementation behavior.
- installed `PROJECT_WORKFLOW.md` owns consumer-local operating guidance.

Do not copy the CLI reference or engine contract back into the README. Update
the smallest document that owns the changed behavior and keep links between
layers.

## Change discipline

When behavior changes:

1. update the owning contract;
2. update rules, skills, templates, and code together;
3. add deterministic regression coverage;
4. add or update hidden behavior evals when routing or agent judgment changes;
5. run the complete gate;
6. test the packed package, not only the source checkout.

Schema versions are a recurring hazard: a bump that reaches a template but not
the matching gate disables that gate silently. Keep supported and enforced
version sets as named constants next to the gate, never as inline literals, and
bind the distributed template to them with a regression test.
