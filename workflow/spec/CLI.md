# CLI reference

## Audience

This reference is for workflow authors, agents, automation, diagnostics, and
recovery. Maintainers normally initialize repositories and then speak to the
installed agent in project language.

Run `wfctl <command> --help` for the exact current options.

## Maintainer surface

### Initialize knowledge

From the target knowledge directory:

```sh
wfctl init knowledge
```

`init` previews all mutations and dependency checks before applying them.
Interactive setup may offer to initialize Git. Automation must opt in:

```sh
wfctl init knowledge --target /path/to/knowledge --init-git --yes
```

Knowledge initialization installs assets, creates project-local QMD
collections, refreshes BM25 retrieval, validates knowledge, and builds the
deterministic knowledge graph and claim ledger.

### Initialize a leaf

From the exact source checkout:

```sh
wfctl init leaf --knowledge /path/to/knowledge
```

Leaf initialization requires an existing Git repository, Graphify CLI, and the
native Graphify skill. It installs assets, refreshes the checkout-local
Graphify graph, registers the repository and local checkout with knowledge, and
adds generated graph output to `.gitignore`.

When the Graphify CLI is absent, preflight fails before writes and returns a
structured remediation in JSON. Human output renders the same steps: install
`graphifyy`, install Graphify's native skill for every selected agent platform,
restart the agent, and repeat the command. `wfctl` must not silently install
external user-level tooling. Native-skill availability is verified by the
setup and source-analysis skills against the current session catalog because a
standalone CLI cannot prove that a running agent loaded an on-disk skill.

### Upgrade

From an initialized repository:

```sh
wfctl upgrade
```

The recorded profile and configuration are reused. `--target` is optional for
agents or automation working from another directory.

### Check

```sh
wfctl check
```

Human output groups checks, compacts repetitive successes, and gives actionable
QMD semantic setup instructions. `--json` returns the complete machine report.

## Session orientation

```sh
wfctl brief --json
```

`brief` reports the current state of an initialized repository so a starting
agent does not have to discover it by scanning records. It is the first command
of a session and is safe to run at any time: it reads durable records only, and
never writes, locks, starts work, or contacts QMD, Graphify, or the network.

Its output has two parts and no third:

- **signals** — observed facts. Each carries a stable dotted `id`, a `domain`,
  a `level` of `ok`, `info`, `attention`, or `blocked`, an optional `subject`
  identifying the record it describes, machine-readable `facts`, and `awaits`
  naming whether an agent or the maintainer can resolve it. A signal may declare
  the capabilities it `blocks`.
- **capabilities** — deliberate operations whose preconditions are mechanical.
  Availability is derived: a capability is available when no collected signal
  blocks it and every signal it `requires` is present. `blockedBy` and `missing`
  name the exact reasons, and they mean different things: `blockedBy` is
  something in the way, `missing` is an operation with no subject yet. Human
  output must keep them distinct, because an unmet requirement printed as a
  blocker reads as a problem the maintainer has to solve.

The command composes no advice and describes no scenario. Ranking facts into a
short human orientation is the agent's work, not the CLI's.

Collectors are independent and profile-scoped. A collector that fails degrades
into the `degraded` list with its reason and never fails the report, because
this runs at session start where a thrown error costs the maintainer a turn. An
uninitialized directory returns one `install.absent` signal rather than an
error.

Adding a new observable state means adding a collector. It must not mean adding
a branch to a renderer, and no consumer may reintroduce per-scenario handling
of these signals.

### Delivering the brief automatically

Installed agent instructions ask every agent to run `brief` first, which is the
portable path and the only one available to hosts without an event model. Claude
Code can also deliver it mechanically:

```sh
wfctl hooks install
wfctl hooks status
wfctl hooks remove
```

`hooks install` adds one `SessionStart` entry running `wfctl brief --hook` to
the repository's `.claude/settings.json`. That file belongs to the maintainer,
so installation is explicit rather than part of `init`, edits exactly one entry,
preserves every other key and every unrelated hook, and is idempotent by command
identity. Removal drops only its own entry, and prunes the event or the `hooks`
key only when nothing else remains.

`brief --hook` prints the host's `SessionStart` envelope with the report as
`additionalContext`. It always exits successfully: a collection failure becomes
a note inside the envelope, because a hook that fails costs the session rather
than one command.

## Knowledge operations

Installed knowledge agents own these commands.

### Raw inventory and cases

- `wfctl knowledge raw inventory` compares committed raw `path + blob`
  identities with active and archived intake coverage. Repeated `--path`
  restricts inventory to an already approved reconstruction scope.
- `wfctl knowledge case start` freezes explicit raw pathspecs at one full Git
  commit. `--reconstruction <id>` is mandatory for reconstruction-owned intake
  and rejects undecided scope, path escape, baseline drift, or pre-approval
  creation.
- `wfctl knowledge case context [id]` auto-selects only one active case and
  returns its complete file, source frontier, discovery validation, and
  hash-bound checkpoint for clean-session resume.
- `wfctl knowledge case checkpoint <id>` refreshes current state and the next
  safe action after semantic case updates.
- `wfctl knowledge case read` returns at most 400 lines from the exact frozen
  blob and atomically records attributed line receipts. Repeated ranges must
  cover the complete text before a final text disposition is accepted.
- `wfctl knowledge case mark` records the semantic result and candidate links
  only after complete text coverage. Binary or unsupported blobs require an
  explicit `--non-text-reason`.
- `wfctl knowledge case migrate` converts an active v3 case to conservative v4
  fields. Semantic migration review is a separate operation.
- `wfctl knowledge case probe` records one omission probe against routed
  durable outputs.
- `wfctl knowledge case check|close` enforces identity, accounting, claim
  classification, routing, reciprocal lineage, probes, and promotion.

Example:

```sh
wfctl knowledge raw inventory

wfctl knowledge case context --json
wfctl knowledge case read <case-id> raw/<path>

wfctl knowledge case start world-loop-notes \
  --title "Review world-loop notes" \
  --path raw/world-loop \
  --baseline <frozen-commit> \
  --reconstruction <parent-case-id>
```

### Source registry

- `wfctl knowledge sources add` registers durable repository identity and one
  known local checkout.
- `wfctl knowledge sources select` explicitly chooses the default
  reconstruction checkout for one repository.
- `wfctl knowledge sources list` shows registered repositories, known local
  checkouts, and current selection.

Tracked registry state contains no absolute local paths.

### Reconstruction

- `wfctl knowledge reconstruct start` binds every default repository selection
  or an explicit reviewed scope, refreshes Graphify, and creates dossiers and
  complete coverage ledgers. It preflights the Graphify CLI first and fails with
  the same structured remediation as leaf initialization, before any case
  directory exists.
- `context [id]` auto-selects only one active reconstruction and returns the
  exact full-read case, dossiers, local binding, complete coverage frontier,
  durable workstream frontier, discovery validation, and hash-bound checkpoint.
- Workstream files are agent-owned records, not user CLI chores. Context reads
  every packet present on disk; check rejects unreferenced packets and resolves
  repository-qualified coverage slices against the frozen ledgers.
- `workstream create`, `claim`, `submit`, and `review` manage packet registration,
  run provenance, ownership transitions, receipt-backed submission, and
  separate review under a case lock. They are agent-facing operations; the
  maintainer normally uses plain-language requests.
- `checkpoint <id>` refreshes current state and the next safe action after the
  case, dossiers, and coverage have been updated.
- `raw-scope <id>` records the maintainer's `all`, `selected`, or `excluded`
  decision before linked intake starts. `unavailable` is permitted only when
  the frozen snapshot is empty. Legacy v3 cases upgrade through this command.
- `coverage`, `files`, and `read` expose outstanding Git inventory and bounded
  pinned source ranges. `read` prints a stable receipt ID for workstream
  evidence and streams large blobs instead of buffering the entire file.
- `community` records Graphify-community review.
- `surface` and `surfaces` record entrypoint/runtime-surface review.
- `check` and `close` enforce the
  [reconstruction contract](RECONSTRUCTION.md).

Example:

```sh
wfctl knowledge reconstruct start project-baseline \
  --title "Reconstruct the current project baseline" \
  --mode baseline

wfctl knowledge reconstruct context --json
wfctl knowledge reconstruct raw-scope <case-id> \
  --mode selected \
  --path raw/world-loop \
  --by human:<maintainer-id> \
  --note "Only world-loop history belongs to this baseline"
wfctl knowledge reconstruct coverage <case-id>
wfctl knowledge reconstruct check <case-id>
wfctl knowledge reconstruct close <case-id> --outcome completed
```

### Curated knowledge

- `wfctl knowledge hash` computes the material content hash used by
  verification receipts.
- `wfctl knowledge validate` checks views, required sections, provenance,
  realization state, semantic receipts, links, and decision lifecycle.
- `wfctl knowledge build` validates and compiles the deterministic knowledge
  graph and cross-case claim ledger.

### Trajectories

- `wfctl knowledge trajectory check` compiles every record under
  `trajectories/`, reports structural errors, and lists the roots awaiting a
  vision, largest total gap first. `--build` writes the compiled graph when no
  error remains.
- `wfctl knowledge trajectory declare <trajectory> --id <id> --by human:<id>
  --statement "<what it should become>"` records a maintainer vision. Like
  `wfctl work approve`, it requires an interactive terminal or `--token`
  matching `WFCTL_APPROVAL_TOKEN`, and it writes both the vision document and an
  ignored durable record the compiler reconciles against. `--supersedes`
  replaces a previous vision for the same subject.

A vision names its trajectory; a trajectory never names its vision. The current
vision is derived, so the two cannot drift apart, and a trajectory that names one
is an error. A hand-written vision document has no durable record and fails: what
a project meant and what it should become are different acts, and only the second
is the maintainer's alone.

It runs before curation and does not require valid curated knowledge, because a
trajectory exists before the pages written from it. Its pending list is the
maintainer queue: everything else the command reports is the agent's own work.

The compiler rejects a finding whose cause claims a reason and carries no
evidence for it, a subject named for a file or symbol rather than in product
language, a `part-of` cycle, more or fewer than one primary parent, a debt
scheduled for closure that names no work, and any attempt to record a gap as
accepted. See [TRAJECTORIES.md](../TRAJECTORIES.md) for why each of those is an
error rather than a warning.

QMD owns retrieval. Agents run `qmd update`, and—with explicit model-download
approval—`qmd pull` and `qmd embed` when semantic retrieval is needed.

## Project work

Installed agents own these commands.

- `wfctl work capture add <slug>` creates a pending, non-authoritative inbox
  record only when material has no active or curated owner.
- `wfctl work capture list` lists the complete pending queue from knowledge or
  a linked leaf.
- `wfctl work capture resolve <id>` requires a reason and either existing
  destinations (`routed`) or none (`discarded`), then moves the receipt to
  `changes/archive/captures/`. The hidden `wfctl work handoff` command remains
  a deprecated compatibility alias for `capture add`.
- `wfctl work start <slug>` creates one project-only, single-leaf, or
  multi-repository bundle in `full`, `slice`, or deliberate `wayfinder` mode.
- `wfctl work context [id]` inventories the complete bundle and returns the
  exact full-read set plus relevant structured checkpoints for shaping,
  Wayfinder, implementation, review, or resume. When the ID is omitted it
  selects exactly one active binding; zero records fail explicitly and several
  records require inspection and a maintainer choice.
- `wfctl work checkpoint <id>` refreshes the one hash-bound resumable state
  owned by the change or a selected claimed issue after semantic edits.
- `wfctl work approve <id> --stage framing|completion --by human:<id>` records a
  maintainer decision. It requires an interactive terminal, or `--token`
  matching `WFCTL_APPROVAL_TOKEN` for automation, and writes both the
  `maintainer_review` receipt and an ignored durable approval record. This is a
  maintainer-facing command an agent may prepare but must not satisfy on its
  own; `verify` and completed `close` reject a receipt with no matching record.
- `wfctl work issue create|list|show` operates the dependency graph and
  executable frontier inside the bundle.
- `wfctl work issue block|unblock` updates dependency edges and rejects cycles.
- `wfctl work issue claim|release|complete|drop` records exact worktree claims
  and honest issue outcomes. Claim requires current full-read receipts.
- `wfctl work map status|finish` exposes Wayfinder fog/frontier and finishes an
  already-synthesized map into `full` or `slice` delivery shaping.
- `wfctl work review status|file` accounts for every bundle file at its current
  SHA-256 content hash.
- `wfctl work status [id]` shows and validates code/spec bindings.
- `wfctl work rebind <id>` explicitly moves one repository binding and records
  the transition.
- `wfctl work verify <id>` checks the structural completion gate without
  claiming semantic correctness.
- `wfctl work close <id>` archives the real outcome after required gates pass.

Example:

```sh
wfctl work start world-loop --title "Implement the world loop" --mode full
wfctl work status
wfctl work context --stage resume
wfctl work context <id> --stage shape
wfctl work checkpoint <id> --actor "agent:session" --state "Framing is current" --last "Scope reviewed" --next "Request framing approval"
wfctl work approve <id> --stage framing --by human:<maintainer-id> --note "Framing accepted"
wfctl work issue list <id>
wfctl work verify <id>
wfctl work close <id> --outcome completed
```

Completed closure also requires a resolved map, terminal issue graph, stable
acceptance coverage and evidence, complete current file accounting, explicit
framing and completion decisions, clean bound source checkouts, one final
receipt per repository, and a knowledge delta or explicit no-update reason.
`wfctl` never commits automatically and never closes completed work into
`raw/`.

## Non-interactive operation

Use `--dry-run` for preview, `--yes` only after reviewing the plan, `--target`
when operating outside the target directory, and `--json` for automation.

Conflicts and dependency failures must be resolved before retrying; automation
must not bypass structural or ownership checks.
