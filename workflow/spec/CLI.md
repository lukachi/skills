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
- `wfctl knowledge trajectory ask [<trajectory>]` renders the packet the
  maintainer reads, for the named subject or the top of the queue. It is
  generated from the record's prose fields, so it cannot carry a path, an
  identifier, a commit, a section number or a raw field value: a cause is
  rendered as what it means rather than as its schema token, and a limit shared
  by every finding is stated once instead of on each.

  Addresses are not banned from the corpus — they are load bearing in `evidence`,
  `resource` and `edges`. They are banned from the text a product owner reads,
  and the compiler rejects one that appears in a `situation`, a gap statement or
  `now.state`.

- `wfctl knowledge trajectory promote <trajectory>` writes the curated page for a
  subject whose vision is declared, and refuses when it is not: without the second
  axis the page would be the old one again. It fills what the records hold and
  marks what they cannot — audience, domain language, examples — so the draft
  fails validation until an author writes them. It reports raw observations that
  could not become evidence, and every page in the area that no trajectory claims.
  It deletes nothing.

- `wfctl knowledge trajectory declare <trajectory> --statement "<what it should
  become>"` records the maintainer's vision. The id is derived from the
  trajectory and the actor comes from the configured `maintainer`, so nobody is
  handed generated identifiers or their own name to retype. `--supersedes`
  replaces a previous vision for the same subject.

  Three methods, and the record keeps them apart. `--attested "<their answer>"`
  records the ordinary case, where the maintainer already decided in the session;
  it stores their words verbatim and is what the agent uses. A terminal run
  records `interactive` after a typed confirmation, and `--token` matching
  `WFCTL_APPROVAL_TOKEN` records `token` for automation. A declaration with no
  answer behind it in any form is refused.

  An attestation proves less about the channel and more about the content than a
  typed receipt, and neither is strong enough to make the other unnecessary. The
  method is stored so a later reader sees which they are looking at.

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
  owned by the change or a selected claimed issue after semantic edits. It takes
  `--blocker` when the maintainer is what the work is missing, and `--handoff`
  when nothing is missing except this session; the two are mutually exclusive,
  and a handoff is cleared by the next checkpoint.
- `wfctl work ask <id> [--stage promotion|completion]` renders the decision the
  maintainer is being asked for, generated from the record rather than composed.
  It runs from the knowledge repository or from any leaf bound to it, because
  delivery happens in a source checkout and that is where the question arises.
- `wfctl work approve <id> --stage framing|completion --by human:<id>` records a
  maintainer decision. It takes the maintainer's own answer through `--attested`,
  or a typed confirmation, or `--token` matching `WFCTL_APPROVAL_TOKEN` for
  automation, and writes both the `maintainer_review` receipt and an ignored
  durable approval record. This is a maintainer-facing command an agent may
  prepare but must not satisfy on its own; `verify` and completed `close` reject
  a receipt with no matching record. `--stage completion` is required only where
  delivery drifted from the approved framing.
- `wfctl work promotion <id> [--none <reason>]` records the curated pages this
  work would write, read from the bundle's `promotion/` directory rather than
  from a flag, so what the maintainer is shown and what lands are the same list.
  A page is filed at the path it will occupy inside `knowledge/`, spelled with or
  without a leading `knowledge/`; both name the same page. It also runs on a
  bundle already waiting in the promotion queue, which is how a page the
  maintainer sent back is corrected and put to them again.
- `wfctl work promote <id> --by human:<id>` records the maintainer's word and
  writes those pages into `knowledge/` in the same act, validates them, and
  archives the bundle. Nothing is left written unless every page validates: a
  refusal puts back whatever each destination held before, byte for byte, and
  says which pages it restored.
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
- `wfctl work bind <id>` gives a record a source repository it does not carry
  yet, run from that repository's own checkout. A bundle started from the centre
  without naming a leaf can hold the work and never deliver it; this is what
  gives it somewhere to deliver into. It refuses a repository the record already
  binds and names `rebind` instead.
- `wfctl work rebind <id>` explicitly moves one repository binding the record
  already carries, and records the transition. It refuses a repository the record
  does not bind and names `bind` instead.
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
wfctl work promotion <id>
wfctl work verify <id>
wfctl work close <id> --outcome completed
wfctl work ask <id> --stage promotion
wfctl work promote <id> --by human:<maintainer-id> --attested "<what they said>"
```

Completed closure also requires a resolved map, terminal issue graph, stable
acceptance coverage and evidence, complete current file accounting, the explicit
framing decision, clean bound source checkouts, one final receipt per repository,
and a recorded promotion state: pages drafted and pending, already applied, or a
concrete no-update reason. It does not require a completion decision unless
delivery drifted from the framing that was approved.
`wfctl` never commits automatically and never closes completed work into
`raw/`.

## Non-interactive operation

Use `--dry-run` for preview, `--yes` only after reviewing the plan, `--target`
when operating outside the target directory, and `--json` for automation.

Conflicts and dependency failures must be resolved before retrying; automation
must not bypass structural or ownership checks.
