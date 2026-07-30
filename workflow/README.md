# wfctl

`wfctl` installs and maintains a shared agent workflow across one project
knowledge repository and any number of leaf source repositories.

New to the workflow? Start with
**[Getting started with wfctl](GETTING_STARTED.md)**. It explains maintainer
behavior, the daily work loop, and common situations without requiring CLI
knowledge. Workflow authors and reviewers can use
**[Verify the knowledge views workflow](VERIFY_KNOWLEDGE_VIEWS.md)** for
deterministic tests and Codex/Claude black-box scenarios.

For maintainers, the normal optional CLI surface is `wfctl init knowledge`,
`wfctl init leaf`, and `wfctl upgrade` from the repository being upgraded; all
may also be delegated to the setup skill. Installed agents own routine
`check`, `knowledge`, `work`, QMD, and Graphify operations. `--target` and the
detailed commands below are agent, automation, recovery, and
workflow-development surfaces—not prerequisites for using the workflow.

After setup, a newcomer can simply ask what the project is and what it can do.
The read-only `explore-project-knowledge` skill builds a progressive product
map from curated knowledge before asking the reader to choose a direction.

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

`wfctl` does compile deterministic relationship artifacts from authored
Markdown links and workflow metadata: one graph for curated knowledge and one
claim ledger for explicit intake/reconstruction lineage. This is not semantic
search or authority: it makes human-visible relationships, decision lineage,
Area ownership, broken links, orphaned stable concepts, and candidate
supersession mechanically checkable.

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
| Knowledge | `operate-project-knowledge`, `explore-project-knowledge`, `reconstruct-project-knowledge`, `process-raw-intake`, `align-project-knowledge`, `manage-project-work`, `verify-project-work`, `curate-project-knowledge`, `curate-product-knowledge`, `curate-engineering-knowledge`, `verify-knowledge-quality` |
| Leaf | `explore-project-knowledge`, `align-project-knowledge`, `manage-project-work`, `verify-project-work`, `curate-project-knowledge`, `curate-product-knowledge`, `curate-engineering-knowledge`, `verify-knowledge-quality` |

## Initialize

`init` always previews its changes and dependency preflight before applying
them. When a new knowledge target is not yet a Git repository, interactive
setup offers to initialize it. Automation must opt in with `--init-git`;
`--dry-run --init-git` reports the planned initialization without creating
`.git`. A leaf must already be an existing Git repository. A missing/old QMD,
missing QMD native skill source, invalid knowledge link, or missing Graphify in
a leaf stops before any workflow file is written. Skill scope defaults
to the project and can be changed interactively or with `--skills user|none`.
The setup agent should execute initialization, upgrades, and diagnostics when
it has terminal access; manual commands remain available for bootstrap and
recovery.

```sh
wfctl init knowledge --target /path/to/project-knowledge

wfctl init knowledge --target /path/to/project-knowledge \
  --init-git --yes

wfctl init leaf --target /path/to/source-repository \
  --knowledge /path/to/project-knowledge
```

Use `wfctl init ... --dry-run` for a non-mutating preview, `wfctl upgrade` for
an existing installation, and `wfctl check` for diagnostics. Existing text
outside managed blocks is preserved. Replaceable file conflicts require an
explicit per-file decision and a backup; structural conflicts stop installation.
Human-readable output uses colored sections and compacts repeated skill and
directory checks; `--json` remains the complete machine-readable report. When
QMD semantic models or embeddings are missing, the health report prints the
exact `qmd pull`, `qmd embed`, and verification path instead of raw model
diagnostics. Long-running leaf graph construction shows a terminal spinner and
an explicit completion result.

Knowledge initialization builds both deterministic relationship artifacts and
runs `qmd update`, so structural navigation, claim-lineage audit, and lexical
BM25 retrieval are part of installation success. Leaf initialization builds or
incrementally refreshes
the checkout-local Graphify graph, registers the repository with knowledge,
and adds that exact worktree to the machine-local registry. It never silently
changes the active reconstruction worktree. Tracked registry state contains no
local paths; ignored runtime state stores known worktrees and the explicit
active selection. `wfctl check` detects a missing source graph
or a missing or stale knowledge/claim graph and reports QMD version, status,
indexed documents, core doctor health, model cache, and embedding freshness
separately.
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
The command requires an initial committed knowledge snapshot plus initialized
clean leaves that point to this knowledge root. It updates Graphify in each
exact checkout, freezes the complete pinned Git tree and every Graphify
community, records only durable repository/worktree identity in the case, and
keeps absolute paths in ignored runtime state:

```sh
wfctl knowledge reconstruct start project-baseline \
  --title "Reconstruct the current project baseline" \
  --mode baseline

wfctl knowledge reconstruct coverage <case-id>
wfctl knowledge reconstruct check <case-id>
wfctl knowledge reconstruct close <case-id> --outcome completed
```

Before the first default reconstruction, the agent inspects the source
registry. It uses an available selected worktree, announces and selects the sole
available candidate when no default is selected, or asks the maintainer to choose in
project terms when several candidates are valid. The agent executes the
corresponding `sources` commands itself. Baseline reconstruction includes
every registered repository and fails when any repository has no available
selected worktree. An explicit repeated `--leaf` scope may use known alternative
worktrees without changing the saved selection. The agent accounts for every
tracked file (including Graphify-unindexed formats), dispositions every
Graphify community and runtime surface, and records gap-free pinned line
receipts for inspected source and tests. It completes one dossier per selected
repository, then reconciles partial observations into whole-project
capabilities, flows, and contracts. Repository names, roles, and count are
never predefined. It reviews Git history, optional documentation, changes, and
raw-intake candidates, and separates accepted intent from observed delivery
and alignment. The gate guarantees explicit accounting rather than perfect
semantic understanding. Completed
baseline reconstruction requires validated promotion and explicit maintainer
review. It never edits leaf source.

`raw/` is a continuous, append-oriented dump surface, not evidence. A changed
path is a new Git blob and new input; earlier frozen cases remain intact. The
knowledge agent inventories exact Git blobs, uses QMD to propose bounded
thematic batches, freezes an accepted scope into a Git-backed case, reads every
frozen file,
splits material statements into atomic claims, distinguishes semantic role,
intent, delivery, time, and lineage, verifies each against source repositories
or maintainer authority, routes proposals/history/current truth separately,
then checks the durable result for omissions:

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

# After routing and authoring durable outputs:
wfctl knowledge case probe <case-id> <probe-id> \
  --question "What changed in the world-loop rule, and when?" \
  --candidate <claim-id> \
  --status passed \
  --answer "<answer recovered without raw>" \
  --output knowledge/areas/<area>/decisions/<decision>.md

wfctl knowledge case check <case-id> --target /path/to/project-knowledge
wfctl knowledge validate --target /path/to/project-knowledge
wfctl knowledge build --target /path/to/project-knowledge
```

The case stores the exact baseline commit and Git blob identity for every
selected file. That proves corpus identity and file accounting, not semantic
understanding. QMD provides BM25, vector, hybrid, and reranked retrieval; the
agent still performs full-file review and candidate-covering omission probes.
Existing v3 cases are converted explicitly with `wfctl knowledge case migrate`;
conservative `unknown` fields must be reviewed before completion. Legacy
promotion paths are retained only as migration context and are not treated as
current routes until a separate review corrects them.
`knowledge/` must never link to or cite `raw/` or `intake/`.

The build writes two ignored, fully rebuildable artifacts:
`.workflow/current/knowledge-graph.json` for curated Markdown navigation and
`.workflow/current/claim-ledger.json` for explicit intake/reconstruction claim
lineage. Neither is authority and neither invents missing relations. Markdown,
independent evidence, and maintainer decisions remain authoritative. QMD finds
candidate documents; the agent reads the selected files before drawing
conclusions.

`knowledge/index.md` is the human entry point.
`knowledge/areas/<area>/index.md` is the primary map for each durable product
or functional Area. Product-facing capabilities, use cases, concepts, rules,
flows, delivery, and evolution are written for stakeholders without code or
implementation detail. Separate engineering concepts cover implementation,
architecture, repositories, contracts, runtime, and operations, and link back
to product meaning. Decision changes create immutable successor records with
reciprocal lineage links; they do not clone whole versioned Areas.

Every concept declares `view`, `purpose`, and `audience`. Stable concepts also
carry a content-hash-bound semantic quality receipt after independent
authority/truth and reader-communication reviews. `wfctl knowledge validate`
is the separate structural gate and enforces both axes, the lane, required
sections, product no-code boundary, receipt freshness, authority, provenance,
links, and lifecycle.

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

When a consequential initiative is not yet bounded enough for honest
acceptance criteria, the agent first uses the same spec to record direction,
canonical language, the decision frontier, uncertainty, and non-goals. It
asks one evidence-backed question at a time and does not create a parallel
strategy document.

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
source-repository metadata. From a leaf it preserves revision, checkout, and
worktree identity; from knowledge it creates a project-only handoff suitable
for routed intake/reconstruction proposals. It has no completion or authority
status; the agent later triages it into a normal change, curated knowledge, or
rejection.

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
