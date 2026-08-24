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
- the regression suite, written against defects found by adversarial review and
  by scoring real sessions;
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
bun test tests/core-install.test.ts
bun run score <session.jsonl>
```

`dist/cli.js` is committed and shipped. `bun run build` overwrites it, so
`bun run check:dist` exists to reject a stale committed bundle instead of
silently repairing it.

Automated tests prove deterministic contracts. They do not prove that an agent
follows the flow it is handed, understands a project, or writes useful stakeholder
knowledge. Use [VERIFICATION.md](VERIFICATION.md) for black-box behavior.

## Distribution contents

The package includes:

- the short package `README.md` and `IDEA.md`;
- user guides under `docs/`;
- normative contracts under `spec/`;
- bundled CLI under `dist/`;
- the guidance bundle, runtime guards, and templates;
- third-party provenance, pinned source mappings, and retained licenses.

The package is the only canonical distribution source. Do not make consumer
repositories fetch mutable workflow assets from a branch.

## Documentation ownership

- `README.md` is a short project introduction and route map.
- `IDEA.md` explains purpose, method, goals, and non-goals.
- `templates/guidance/` is what the CLI delivers, organized by the state the
  agent is in rather than by the role it is playing. A slice describes what that
  state demands; it links normative behavior instead of restating it, and
  they say plainly which guarantees are mechanical and which are judgment.
- `spec/` owns normative implementation behavior.
- the managed agent block owns consumer-local operating guidance;
- `templates/guidance/` owns everything the CLI delivers, keyed by state.

Do not copy the CLI reference or engine contract back into the README. Update
the smallest document that owns the changed behavior and keep links between
layers.

## Change discipline

When behavior changes:

1. update the owning contract;
2. update the guidance bundle, templates, and code together;
3. add deterministic regression coverage;
4. score a real session with `bun run score` when agent-facing behaviour changes,
   and add a regression test for anything it reports;
5. run the complete gate;
6. test the packed package, not only the source checkout.

Schema versions are a recurring hazard: a bump that reaches a template but not
the matching gate disables that gate silently. Keep supported and enforced
version sets as named constants next to the gate, never as inline literals, and
bind the distributed template to them with a regression test.
