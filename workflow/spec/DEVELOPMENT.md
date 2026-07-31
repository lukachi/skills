# Development guide

## Audience

Use this guide when changing `wfctl`, its installed assets, or its package
contract. End users should follow the numbered [user guides](../docs/).

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
- preflight integration;
- real QMD behavior;
- real Graphify behavior;
- reconstruction integration;
- Bun, Node.js, and Deno runtime smoke tests;
- packed npm artifact contents and CLI execution.

Focused suites:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
```

Automated tests prove deterministic contracts. They do not prove that an agent
selects the right skill, understands a project, or writes useful stakeholder
knowledge. Use [VERIFICATION.md](VERIFICATION.md) for black-box behavior.

## Distribution contents

The package includes:

- the short package `README.md` and `IDEA.md`;
- numbered user guides under `docs/`;
- normative contracts under `spec/`;
- bundled CLI under `dist/`;
- rules, skills, templates, and eval corpora.

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

## Upstream skill influences

Third-party skill suites are design inputs, not runtime dependencies or a
second consumer workflow. Pin the exact reviewed upstream revision under
`vendor/`, retain its license, and document the local skills influenced by the
review. Integrate selected behavior deliberately into wfctl's own bundle,
commands, rules, tests, and skills. Consumers must never fetch mutable upstream
prompts during installation or maintain two competing issue trackers.

When refreshing an influence:

1. inspect the complete relevant upstream skills and references;
2. update the pinned revision and review scope;
3. preserve wfctl ownership, knowledge authority, and worktree invariants;
4. adapt useful behavior instead of overwriting local skills wholesale;
5. rerun deterministic and black-box behavior verification.

## Documentation ownership

- `README.md` is a short project introduction and route map.
- `IDEA.md` explains purpose, method, goals, and non-goals.
- `docs/01…07` is the sequential user journey.
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
