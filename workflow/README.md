# wfctl

`wfctl` installs and maintains a shared agent workflow across one project
knowledge repository and any number of leaf source repositories.

New to the workflow? Start with
**[Getting started with wfctl](GETTING_STARTED.md)**. It explains maintainer
behavior, the daily work loop, and common situations without requiring CLI
knowledge.

The package is the canonical distribution source. Consumer repositories receive
versioned rules and templates, managed instruction blocks, and profile-specific
skills installed through the pinned `skills` CLI.

Project skills are copied independently into each selected agent's native skill
directory. `wfctl` does not create cross-agent skill symlinks.

Graphify remains an external prerequisite. Its `graphify` CLI and official
native `graphify` skill must both be available; the workflow-provided
`analyze-with-graphify` skill only enforces routing and session checks.

[QMD](https://github.com/tobi/qmd) is the external knowledge retrieval engine.
`wfctl` installs its project-local collection configuration but does not
reimplement indexing, embeddings, retrieval, or reranking.

## Development

Requirements:

- Node.js 20 or newer for `wfctl`; Node.js 22 or newer when using current QMD
- Bun 1.3 or newer
- Deno for the full runtime compatibility check
- QMD for installed workflow operation: `bun install -g @tobilu/qmd`

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

## Setup skill

The setup skill can be installed independently when an agent must prepare a
clean repository. During local development:

```sh
bunx skills add /absolute/path/to/agent-skills/workflow \
  --skill setup-workflow-environment \
  --agent codex \
  --agent claude-code
```

Project installations remain profile-specific:

| Profile | Installed skills |
| --- | --- |
| Both | `setup-workflow-environment`, `analyze-with-graphify` |
| Knowledge | `operate-project-knowledge`, `process-raw-intake`, `curate-project-knowledge` |
| Leaf | `align-project-knowledge`, `manage-project-work`, `verify-project-work`, `curate-project-knowledge` |

## Initialize

`init` always previews its changes before applying them. Skill scope defaults
to the project and can be changed interactively or with `--skills user|none`.
The setup agent should execute initialization, upgrades, and diagnostics when
it has terminal access; manual commands remain available for bootstrap and
recovery.

```sh
wfctl init knowledge --target /path/to/project-knowledge

wfctl init leaf --target /path/to/source-repository \
  --knowledge /path/to/project-knowledge
```

Use `wfctl init ... --dry-run` for a non-mutating preview, `wfctl upgrade` for
an existing installation, and `wfctl check` for diagnostics. Existing text
outside managed blocks is preserved. Replaceable file conflicts require an
explicit per-file decision and a backup; structural conflicts stop installation.

Every profile receives a visible root `PROJECT_WORKFLOW.md`. It is the
maintainer-facing guide: it explains the raw/intake/changes/knowledge boundary, work
routing, review packets, and the exact decisions that require human approval.
The agent-facing rules enforce the same gates.

## Knowledge operations

`raw/` is a continuous append-only dump surface, not evidence. The knowledge
agent inventories exact Git blobs, uses QMD to propose bounded thematic batches,
freezes an accepted scope into a Git-backed case, reads every frozen file,
adjudicates candidate claims against source repositories and maintainer
decisions, then promotes only independently verified truth:

```sh
cd /path/to/project-knowledge
qmd update
qmd embed -c raw

wfctl knowledge raw inventory

wfctl knowledge case start world-loop-notes \
  --title "Review world-loop notes" \
  --path raw/world-loop \
  --baseline HEAD \
  --target /path/to/project-knowledge

qmd query "world loop chronology" -c raw --json

wfctl knowledge case mark <case-id> raw/world-loop/history.md \
  --status reviewed \
  --candidate <claim-id> \
  --note "Read in full; recorded all candidate claims" \
  --target /path/to/project-knowledge

wfctl knowledge case check <case-id> --target /path/to/project-knowledge
wfctl knowledge validate --target /path/to/project-knowledge
```

The case stores the exact baseline commit and Git blob identity for every
selected file. That proves corpus identity and file accounting, not semantic
understanding. QMD provides BM25, vector, hybrid, and reranked retrieval; the
agent still performs full-file review and a second omission audit.
`knowledge/` must never link to or cite `raw/` or `intake/`.

`knowledge/index.md` is the human entry point.
`knowledge/areas/<area>/index.md` is the primary map for each durable product
or functional Area. It separates current human-facing behavior from technical
realization and links capabilities, rules, flows, decisions, and local
evolution. Decision changes create immutable successor records with reciprocal
lineage links; they do not clone whole versioned Areas.

The generated QMD collections preserve the trust boundary: `knowledge` is the
only default collection, while `changes`, `intake`, and `raw` require explicit
selection. The `.qmd/index.sqlite` cache is ignored and can always be rebuilt.

## Project work

Significant work creates one central shaping/spec/progress file before extended
discussion, then passes through Graphify analysis, curated knowledge alignment,
framing review, evidence-based
verification, current-knowledge promotion, and an immutable archived change
record. The agent owns these commands during routine work;
the maintainer supplies review decisions rather than operating the CLI:

```sh
wfctl work handoff ui-copy-findings \
  --title "Retain non-obvious UI copy findings"

wfctl work start world-loop \
  --title "Implement the world loop" \
  --mode full

wfctl work status 2026-07-28-world-loop
wfctl work verify 2026-07-28-world-loop
wfctl work close 2026-07-28-world-loop --outcome completed
```

`handoff` creates a lightweight record under `changes/inbox/` with exact
repository, revision, checkout, and worktree metadata. It has no completion or
authority status; the agent later triages it into a normal change, curated
knowledge, or rejection.

`start` binds the record to one exact leaf checkout or linked worktree. The
central record lives under `changes/active/`, while `.workflow/current/` in the leaf
stores the pointer and source identity. `status`, `verify`, and `close` refuse
to operate from a different checkout, even when it belongs to the same Git
repository.

The initial record is `shaping`. The agent updates its current state and
append-only decision/discussion ledger after every material maintainer turn.
Graphify evidence, knowledge alignment, resolved blocking questions, and
framing approval are required before implementation. After interruption or
compaction, the agent recovers from the full spec and `wfctl work status`, not
from conversation memory.

`verify` enforces structural honesty; it does not replace semantic review of the
implementation. Significant completion also requires explicit framing and
completion decisions recorded under `maintainer_review`, plus either validated
curated concept paths or an explicit no-update reason. Partial and abandoned
work must be closed with their real outcome. A completed close requires a clean
bound checkout so its commit contains the verified implementation; `wfctl`
never commits automatically. The final verification revision and worktree ID
must match that checkout. Closing never writes into `raw/`.

See [SPEC.md](SPEC.md) for the complete model and safety contract.
