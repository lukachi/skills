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

- `wfctl work handoff <slug>` creates a lightweight, non-authoritative inbox
  record from knowledge or a leaf.
- `wfctl work start <slug>` creates one early project-only, single-leaf, or
  multi-repository living record.
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
wfctl work verify <id>
wfctl work close <id> --outcome completed
```

Completed closure requires current matching verification, explicit framing and
completion decisions, clean bound source checkouts, one final receipt per
repository, and a knowledge delta or explicit no-update reason. `wfctl` never
commits automatically and never closes completed work into `raw/`.

## Non-interactive operation

Use `--dry-run` for preview, `--yes` only after reviewing the plan, `--target`
when operating outside the target directory, and `--json` for automation.

Conflicts and dependency failures must be resolved before retrying; automation
must not bypass structural or ownership checks.
