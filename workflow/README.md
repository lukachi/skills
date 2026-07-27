# wfctl

`wfctl` installs and maintains a shared agent workflow across one project
knowledge repository and any number of leaf source repositories.

The package is the canonical distribution source. Consumer repositories receive
versioned copies of rules and skills, managed instruction blocks, and only the
symlinks that are safe for their existing layout.

## Development

Requirements:

- Node.js 20 or newer
- Bun 1.3 or newer
- Deno for the full runtime compatibility check

```sh
bun install
bun run check
```

Until the package is published, build and register the local executable:

```sh
bun run build
bun link
wfctl --help
```

The bundled executable can also be run directly with Bun, Node.js, or Deno:

```sh
bun /absolute/path/to/agent-skills/workflow/dist/cli.js --help
node /absolute/path/to/agent-skills/workflow/dist/cli.js --help
deno run -A /absolute/path/to/agent-skills/workflow/dist/cli.js --help
```

## Bootstrap

Always inspect the plan before applying it:

```sh
wfctl plan knowledge --target /path/to/project-knowledge
wfctl apply knowledge --target /path/to/project-knowledge

wfctl plan leaf --target /path/to/source-repository \
  --knowledge /path/to/project-knowledge
wfctl apply leaf --target /path/to/source-repository \
  --knowledge /path/to/project-knowledge
```

Use `wfctl render agents --profile knowledge|leaf` when an instruction file
needs a maintainer-controlled semantic merge. Use `wfctl sync` for an existing
installation and `wfctl doctor` after installation.

## Project work

Significant work is routed through Graphify analysis, curated knowledge
alignment, one central living specification, evidence-based verification, and
an immutable raw record:

```sh
wfctl work begin world-loop \
  --title "Implement the world loop" \
  --mode full \
  --knowledge-ref knowledge/index.md \
  --graph-query "Trace the existing world loop"

wfctl work verify 2026-07-28-world-loop
wfctl work flush 2026-07-28-world-loop --outcome completed
```

`verify` enforces structural honesty; it does not replace semantic review of the
implementation. Partial and abandoned work must be flushed with their real
outcome.

See [SPEC.md](SPEC.md) for the complete model and safety contract.
