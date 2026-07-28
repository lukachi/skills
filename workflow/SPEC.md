# Workflow Engine v1

## Destination

Ship a deterministic `wfctl` package that bootstraps and maintains a shared project workflow for Codex and Claude, with a central knowledge repository and any number of leaf repositories.

## Source of truth

- This directory is the canonical source for the CLI, rules, skills, and templates.
- Installed consumer files are generated copies or symlinks owned through `.workflow/state.json`.
- Existing consumer instructions are preserved. `wfctl` only edits its marked block in `AGENTS.md` or `CLAUDE.md`.
- Package releases, not mutable remote downloads, distribute canonical assets. A consumer can pin the exact `wfctl` version.

## Knowledge model

- `raw/` is continuous, append-only, untrusted input. It is neither evidence
  nor current truth and must never be cited by trusted derivatives.
- `intake/` contains bounded raw cases whose source lists are frozen to an
  exact Git commit and blob IDs. It may locate raw input but is outside the
  trust boundary.
- `changes/active/` contains the one canonical proposal/spec/progress file for
  each active significant task.
- `changes/archive/` preserves closed change records, final source/worktree
  metadata, reviews, and receipts.
- `changes/inbox/` receives lightweight handoffs before they are triaged into
  a normal change, knowledge update, or rejection.
- `knowledge/` is the curated OKF v0.2 bundle and the current project knowledge surface.
- Source repositories are implementation authority at exact revisions;
  Graphify navigates them but is not itself evidence.
- Unknown chronology or truth must remain outside current knowledge until
  authoritative evidence or a maintainer decision resolves it.
- `knowledge/index.md` and Area indexes are the primary human road. Areas own
  capabilities, concepts, rules, use cases, implementation, decisions, and
  local evolution without flattening the project.
- Decisions evolve through immutable records, reciprocal acyclic supersession
  links, and one stable current record per lineage.
- Raw candidate claims and ongoing change receipts converge through the same
  verification, maintainer adjudication, promotion, and validation gate.
- QMD is a rebuildable retrieval cache, not a source. Only curated `knowledge`
  participates in unscoped queries; `changes`, `intake`, and `raw` are
  explicitly selected collections.

## Work routing

- Significant work creates a shaping spec first, then uses Graphify analysis,
  knowledge alignment, framing approval, implementation, evidence-based
  verification, and close.
- Clearly lightweight work may bypass the full gate.
- Ambiguous work requires a maintainer decision.
- Bypassed work should be offered a compact handoff record so useful information is not lost.

## CLI surface

- `wfctl init [knowledge|leaf]`: preview, resolve safe conflicts, and install a workflow.
- `wfctl upgrade`: update an existing installation using its recorded configuration.
- `wfctl check`: diagnose installation, Git, knowledge linkage, and Graphify
  requirements for leaf repositories.
- `wfctl knowledge raw inventory`: compare committed raw `path + blob ID`
  identities with active and archived intake coverage without semantic
  indexing.
- `wfctl knowledge case start`: freeze explicit raw pathspecs at a full Git
  commit and record every matching tree entry.
- `wfctl knowledge case mark`: record one frozen file's complete review result
  and candidate IDs.
- `wfctl knowledge case check|close`: enforce Git identity, file accounting,
  candidate linkage, omission audit, and promotion state.
- `wfctl knowledge validate`: enforce the strict curated-knowledge profile.
- `wfctl work handoff`: create a non-authoritative lightweight inbox record
  with exact repository and worktree metadata.
- `wfctl work start`: create an early shaping spec bound to one exact leaf checkout.
- `wfctl work status`: show and validate the code-root/spec binding.
- `wfctl work verify`: validate the structural completion gate without claiming semantic correctness.
- `wfctl work close`: archive the change record with final repository and
  worktree metadata; never write a completed record into raw.

## Safety contract

- Preview before mutation and require confirmation in interactive use.
- Never overwrite an unowned file without a per-file decision and backup.
- Never replace an existing file or directory with a symlink.
- Stop on structural, symlink, marker, or path-type conflicts.
- Update an owned file only when its current hash matches the last installed hash.
- Delegate profile-specific skill placement to the pinned `skills` CLI.
- Install skills as independent copies; never create cross-agent skill symlinks.
- Default skills to project scope and allow explicit user or disabled scope.
- Refuse non-interactive replacement of existing skills.
- Support non-interactive and JSON output for agents and CI.
- Install one visible, profile-specific `PROJECT_WORKFLOW.md` through a managed
  block that preserves pre-existing maintainer content.
- Install a project-local QMD configuration in the knowledge repository and
  ignore its generated database.
- Never implement a competing Markdown index, embedding store, or ranking
  pipeline inside `wfctl`.

## Verification criteria

- [x] A clean knowledge target previews, initializes, and passes check.
- [x] A clean leaf target links to knowledge, initializes, and passes check.
- [x] Existing `AGENTS.md` and `CLAUDE.md` content survives init and upgrade.
- [x] Locally modified owned files cause conflicts instead of being overwritten.
- [x] Work start produces one canonical central spec.
- [x] Significant discussion is persisted from shaping onward and can resume
  after compaction without chat memory.
- [x] Work commands bind to one exact checkout and reject another worktree.
- [x] Completed close requires recorded verification and emits Git/worktree metadata.
- [x] Completed close rejects a dirty source checkout instead of pinning a
  revision that does not contain the verified implementation.
- [x] Completed close matches the recorded verification revision and worktree
  identity against the exact bound checkout.
- [x] Partial or abandoned work can close without a false completion claim.
- [x] Built CLI runs under Node, Bun, and Deno.
- [x] Knowledge and leaf profiles receive only their relevant skills.
- [x] The setup skill can be installed independently for Codex and Claude.
- [x] Both profiles receive a maintainer-facing operating guide.
- [x] Significant completed work requires explicit framing and completion review
  records from a human actor.
- [x] Raw intake cases freeze exact Git commit, pathspecs, tree entries, and
  blob IDs.
- [x] Raw inventory detects unseen and changed blobs without implementing a
  competing Markdown indexer.
- [x] Intake completion fails closed on Git drift, missing files, pending or
  blocked reviews, and incomplete candidate linkage.
- [x] QMD collections keep curated knowledge default and untrusted surfaces
  opt-in.
- [x] Curated knowledge rejects raw references, stale verification, unpinned
  code sources, and incomplete claim attribution.
- [x] Decision validation rejects missing, non-reciprocal, cyclic, or
  multi-current supersession lineages.
- [x] Completed significant work records an applied knowledge delta or an
  explicit no-update reason.
- [x] Lightweight findings can enter `changes/inbox/` without being mislabeled
  as completed project history.

## Progress

- [x] Research OKF v0.2, living-spec workflows, and cross-runtime CLI frameworks.
- [x] Select Cliffy with bundled npm distribution.
- [x] Define the raw / intake / changes / curated knowledge boundary.
- [x] Implement the filesystem planner and safe applier.
- [x] Implement CLI commands.
- [x] Complete and validate rules, skills, and templates.
- [x] Add automated tests and runtime smoke checks.
- [x] Dry-run against the named DnD repositories.
- [x] Define maintainer review boundaries without conflating OKF trust and
  lifecycle.

## Out of scope for v1

- Hosted registry or automatic GitHub self-update.
- A full-screen Ink interface.
- Automatic semantic reconciliation of contradictory raw material.
- Automatic proof that implementation behavior is correct; agents and maintainers provide semantic evidence, while the CLI enforces structural gates.
- A search or embedding engine. QMD owns retrieval; Git file accounting,
  complete reading, omission audits, and agent/maintainer adjudication own the
  workflow guarantees.
