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

## Knowledge operations

Installed knowledge agents own these commands.

### Raw inventory and cases

- `wfctl knowledge raw inventory` compares committed raw `path + blob`
  identities with active and archived intake coverage.
- `wfctl knowledge case start` freezes explicit raw pathspecs at one full Git
  commit.
- `wfctl knowledge case context [id]` auto-selects only one active case and
  returns its complete file, source frontier, discovery validation, and
  hash-bound checkpoint for clean-session resume.
- `wfctl knowledge case checkpoint <id>` refreshes current state and the next
  safe action after semantic case updates.
- `wfctl knowledge case mark` records complete review of one frozen file and
  its candidate claims.
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

wfctl knowledge case start world-loop-notes \
  --title "Review world-loop notes" \
  --path raw/world-loop \
  --baseline HEAD
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
  complete coverage ledgers.
- `context [id]` auto-selects only one active reconstruction and returns the
  exact full-read case, dossiers, local binding, complete coverage frontier,
  discovery validation, and hash-bound checkpoint.
- `checkpoint <id>` refreshes current state and the next safe action after the
  case, dossiers, and coverage have been updated.
- `coverage`, `files`, and `read` expose outstanding Git inventory and bounded
  pinned source ranges.
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
