# wfctl

`wfctl` installs and maintains a shared agent workflow across one project
knowledge repository and any number of leaf source repositories.

New to the workflow? Start with
**[Getting started with wfctl](GETTING_STARTED.md)**. It explains maintainer
behavior, the daily work loop, and common situations without requiring CLI
knowledge.

For maintainers, the normal CLI surface is only `wfctl init knowledge` and
`wfctl init leaf`; both may also be delegated to the setup skill. Installed
agents own routine `check`, `upgrade`, `knowledge`, `work`, QMD, and Graphify
operations. The detailed commands below are an agent, automation, recovery, and
workflow-development reference—not a prerequisite for using the workflow.

The package is the canonical distribution source. Consumer repositories receive
versioned rules and templates, managed instruction blocks, and profile-specific
skills installed through the pinned `skills` CLI.

Project skills are copied independently into each selected agent's native skill
directory. `wfctl` does not create cross-agent skill symlinks. It also resolves
QMD's version-matched official skill through `qmd skills path qmd` and installs
that skill through the same pinned installer.

Graphify remains an external prerequisite. Its `graphify` CLI and official
native `graphify` skill must both be available; the workflow-provided
`analyze-with-graphify` skill only enforces routing and session checks. Leaf
initialization runs an incremental `graphify update .` from that exact checkout
before reporting success and safely adds `graphify-out/` to the repository
`.gitignore`.

[QMD](https://github.com/tobi/qmd) is the external knowledge retrieval engine.
`wfctl` installs its project-local collection configuration but does not
reimplement indexing, embeddings, retrieval, or reranking.

`wfctl` does compile a separate deterministic relationship graph from authored
Markdown links and workflow metadata. This is not semantic search: it makes
human-visible relationships, decision lineage, Area ownership, broken links,
and orphaned stable concepts mechanically checkable.

## Development

Requirements:

- Node.js 20 or newer for `wfctl`; Node.js 22 or newer when using current QMD
- Bun 1.3 or newer
- Deno for the CLI-core runtime smoke test (`--skills none`)
- QMD 2.5.3 or newer for installed workflow operation:
  `bun install -g @tobilu/qmd@2.5.3`
- Graphify for leaf initialization and its real integration test

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
| Both | `setup-workflow-environment`, `analyze-with-graphify`, official `qmd` |
| Knowledge | `operate-project-knowledge`, `reconstruct-project-knowledge`, `process-raw-intake`, `align-project-knowledge`, `manage-project-work`, `verify-project-work`, `curate-project-knowledge` |
| Leaf | `align-project-knowledge`, `manage-project-work`, `verify-project-work`, `curate-project-knowledge` |

## Initialize

`init` always previews its changes and dependency preflight before applying
them. A missing/old QMD, missing QMD native skill source, non-Git target, invalid
knowledge link, or missing Graphify in a leaf stops before any workflow file is
written. Skill scope defaults
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

Knowledge initialization builds the deterministic relationship graph and runs
`qmd update`, so structural navigation and lexical BM25 retrieval are part of
installation success. Leaf initialization builds or incrementally refreshes
the checkout-local Graphify graph, registers the repository with knowledge,
and adds that exact worktree to the machine-local registry. It never silently
changes the active reconstruction worktree. Tracked registry state contains no
local paths; ignored runtime state stores known worktrees and the explicit
active selection. `wfctl check` detects a missing source graph
or a missing or stale knowledge graph and reports QMD version, status, indexed
documents, core doctor health, model cache, and embedding freshness separately.
Missing semantic models or embeddings are warnings: exact/lexical retrieval
still works. Run `qmd pull` and `qmd embed` only when semantic/hybrid retrieval
is needed; the default model set is roughly 2 GB.

Installed skills become visible only to a new agent session. Restart Codex or
Claude after the first `init` or after a skill upgrade.

Every profile receives a visible root `PROJECT_WORKFLOW.md`. It is the
maintainer-facing guide: it explains the
raw/intake/reconstruction/changes/knowledge boundary, work routing, review
packets, and the exact decisions that require human approval.
The agent-facing rules enforce the same gates.

## Agent-operated knowledge reference

For an existing project, build the baseline from source repositories first.
The command requires initialized clean leaves that point to this knowledge
root. It updates Graphify in each exact checkout, records only durable
repository/worktree identity in the case, and keeps absolute paths in ignored
runtime state:

```sh
wfctl knowledge reconstruct start project-baseline \
  --title "Reconstruct the current project baseline" \
  --mode baseline

wfctl knowledge reconstruct check <case-id>
wfctl knowledge reconstruct close <case-id> --outcome completed
```

Before the first default reconstruction, the agent inspects the source
registry. It uses an available active worktree, announces and selects the sole
available candidate when none is active, or asks the maintainer to choose in
project terms when several candidates are valid. The agent executes the
corresponding `sources` commands itself. Baseline reconstruction includes
every registered repository and fails when any repository has no available
active worktree. An explicit repeated `--leaf` scope may use known inactive
worktrees without changing the saved selection. The agent completes one
dossier per selected repository, then reconciles partial observations into whole-project
capabilities, flows, and contracts. Repository names, roles, and count are
never predefined. It reviews Git history, optional documentation, changes, and
raw-intake candidates, and separates accepted intent from observed delivery
and alignment. Completed
baseline reconstruction requires validated promotion and explicit maintainer
review. It never edits leaf source.

`raw/` is a continuous append-only dump surface, not evidence. The knowledge
agent inventories exact Git blobs, uses QMD to propose bounded thematic batches,
freezes an accepted scope into a Git-backed case, reads every frozen file,
adjudicates candidate claims against source repositories and maintainer
decisions, then promotes only independently verified truth:

```sh
cd /path/to/project-knowledge
qmd update
# Optional after model-download approval:
qmd pull
qmd embed -c raw

wfctl knowledge raw inventory

wfctl knowledge case start world-loop-notes \
  --title "Review world-loop notes" \
  --path raw/world-loop \
  --baseline HEAD \
  --target /path/to/project-knowledge

qmd query -c raw --format json $'intent: Reconstruct the world-loop chronology without treating newer notes as automatically authoritative.\nlex: world loop chronology timeline superseded\nvec: history of how the world loop design changed'

wfctl knowledge case mark <case-id> raw/world-loop/history.md \
  --status reviewed \
  --candidate <claim-id> \
  --note "Read in full; recorded all candidate claims" \
  --target /path/to/project-knowledge

wfctl knowledge case check <case-id> --target /path/to/project-knowledge
wfctl knowledge validate --target /path/to/project-knowledge
wfctl knowledge build --target /path/to/project-knowledge
```

The case stores the exact baseline commit and Git blob identity for every
selected file. That proves corpus identity and file accounting, not semantic
understanding. QMD provides BM25, vector, hybrid, and reranked retrieval; the
agent still performs full-file review and a second omission audit.
`knowledge/` must never link to or cite `raw/` or `intake/`.

The build writes `.workflow/current/knowledge-graph.json`, an ignored and fully
rebuildable artifact. Markdown remains authoritative. QMD finds candidate
documents, the compiled graph expands through explicit relationships, and the
agent reads the selected files before drawing conclusions.

`knowledge/index.md` is the human entry point.
`knowledge/areas/<area>/index.md` is the primary map for each durable product
or functional Area. It separates current human-facing behavior from technical
realization and links capabilities, rules, flows, decisions, and local
evolution. Decision changes create immutable successor records with reciprocal
lineage links; they do not clone whole versioned Areas.

The generated QMD collections preserve the trust boundary: `knowledge` is the
only default collection, while `changes`, `intake`, `reconstruction`, and
`raw` require explicit selection. The `.qmd/index.sqlite` cache is ignored and
can always be rebuilt.

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

`start` supports three scopes: project-only from knowledge with no code root,
one exact leaf checkout, or several explicitly selected leaf worktrees. The
central record lives under `changes/active/`; ignored local bindings hold
machine paths. `status`, `verify`, and `close` refuse a different checkout,
worktree, or branch until `work rebind` is explicitly requested.

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
work must be closed with their real outcome. A completed close requires every
bound checkout to be clean so its commit contains the verified implementation;
`wfctl` never commits automatically. Every repository needs a matching final
revision, worktree ID, and checks receipt. Stable concept verification also
binds to a deterministic current content hash. Closing never writes into
`raw/`.

See [SPEC.md](SPEC.md) for the complete model and safety contract.
