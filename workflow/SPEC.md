# Workflow Engine v2

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
- `reconstruction/` contains bounded source-first baselines and audits. Each
  selected leaf is pinned to a clean commit and worktree identity, analyzed
  through Graphify and direct source, and represented by a repository dossier.
  Local absolute checkout paths live only in ignored runtime bindings.
- `.workflow/repositories.json` durably registers the full project source set
  without local paths. `.workflow/current/repositories.json` stores any number
  of known local worktrees per repository plus one explicit active selection
  used only by default reconstruction.
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
- Raw candidates, source-first reconstruction claims, and ongoing change
  receipts converge through the same verification, maintainer adjudication,
  promotion, and validation gate.
- QMD is a rebuildable retrieval cache, not a source. Only curated `knowledge`
  participates in unscoped queries; `changes`, `intake`, `reconstruction`, and
  `raw` are explicitly selected collections.
- Product-bearing concepts keep document lifecycle separate from
  `realization.intent`, `realization.delivery`, and `realization.alignment`.
  Proposed ideas remain outside curated current knowledge.
- Authored Markdown links, typed `x-wf.relations`, Area ownership, and decision
  lineage compile deterministically into an ignored navigation graph. The
  Markdown remains the source; the graph adds no inferred facts.

## Work routing

- Significant work creates a shaping spec first, then uses Graphify analysis,
  knowledge alignment, framing approval, implementation, evidence-based
  verification, and close.
- Clearly lightweight work may bypass the full gate.
- Ambiguous work requires a maintainer decision.
- Bypassed work should be offered a compact handoff record so useful information is not lost.

## CLI surface

- The normal maintainer-facing CLI surface is `wfctl init knowledge` and
  `wfctl init leaf`. Installed agents own every routine command below and
  translate natural-language requests into CLI, QMD, Graphify, Git-inspection,
  and record operations. Manual use remains supported for automation,
  diagnostics, recovery, and workflow development.
- `wfctl init [knowledge|leaf]`: preview the file plan and dependency
  preflight, resolve safe conflicts, install a workflow, and build the
  profile's required local index (`qmd` plus the authored knowledge graph for
  knowledge; Graphify for a leaf). Interactive knowledge initialization may
  offer to run `git init`; non-interactive callers must opt in with
  `--init-git`. Leaf initialization never creates a Git repository.
- `wfctl upgrade`: update an existing installation using its recorded configuration.
- `wfctl check`: diagnose installation, Git, knowledge linkage, Graphify
  requirements for leaf repositories, QMD version/core health, lexical-index
  readiness, deterministic knowledge-graph freshness, and optional semantic
  readiness. Human terminal output must group checks, summarize repetitive
  successes, color statuses when supported, and turn missing QMD semantic
  setup into explicit next-step commands. JSON output retains every raw check.
- `wfctl knowledge raw inventory`: compare committed raw `path + blob ID`
  identities with active and archived intake coverage without semantic
  indexing.
- `wfctl knowledge case start`: freeze explicit raw pathspecs at a full Git
  commit and record every matching tree entry.
- `wfctl knowledge case mark`: record one frozen file's complete review result
  and candidate IDs.
- `wfctl knowledge case check|close`: enforce Git identity, file accounting,
  candidate linkage, omission audit, and promotion state.
- `wfctl knowledge sources add|select|list`: register arbitrary project
  repositories, remember any number of machine-local worktrees, and explicitly
  select one active reconstruction checkout per repository.
- `wfctl knowledge reconstruct start`: bind every registered repository's
  active clean worktree for a default baseline, or bind explicit known
  worktrees for a reviewed baseline/audit scope, refresh Graphify, and create a
  bounded case plus repository dossiers without durable absolute paths.
- `wfctl knowledge reconstruct check|close`: enforce exact checkout bindings,
  repository coverage, candidate classification, optional-input disposition,
  cross-repository reconciliation, validated promotion, and maintainer review.
- `wfctl knowledge validate`: enforce the strict curated-knowledge profile.
- `wfctl knowledge build`: validate and compile the deterministic knowledge
  relationship graph into `.workflow/current/knowledge-graph.json`.
- `wfctl work handoff`: create a non-authoritative lightweight inbox record
  with exact repository and worktree metadata.
- `wfctl work start`: create an early project-only, single-leaf, or
  multi-repository shaping spec with one central record.
- `wfctl work rebind`: explicitly move one repository binding to the current
  branch/worktree and record the transition.
- `wfctl work status`: show and validate the code-root/spec binding.
- `wfctl work verify`: validate the structural completion gate without claiming semantic correctness.
- `wfctl work close`: archive the change record with final repository and
  worktree metadata; never write a completed record into raw.

## Safety contract

- Preview before mutation and require confirmation in interactive use.
- Fail dependency preflight before any workflow or skill write.
- Never overwrite an unowned file without a per-file decision and backup.
- Never replace an existing file or directory with a symlink.
- Stop on structural, symlink, marker, or path-type conflicts.
- Update an owned file only when its current hash matches the last installed hash.
- Delegate profile-specific skill placement to the pinned `skills` CLI.
- Resolve QMD's version-matched official skill from the installed QMD package
  and install it through the same selected agent targets and scope.
- Install skills as independent copies; never create cross-agent skill symlinks.
- Default skills to project scope and allow explicit user or disabled scope.
- Let the pinned skills CLI update wfctl-owned selected skills
  non-interactively; remove only obsolete project-scope skills whose lock
  provenance still identifies this package.
- Support non-interactive and JSON output for agents and CI.
- Install one visible, profile-specific `PROJECT_WORKFLOW.md` through a managed
  block that preserves pre-existing maintainer content.
- Install a project-local QMD configuration in the knowledge repository and
  ignore its generated database.
- Require QMD 2.5.3 or newer and refresh the lexical index during knowledge
  initialization and upgrade.
- Compile the deterministic knowledge graph during a valid knowledge
  initialization or upgrade, and fail diagnostics when it is missing or stale.
- Treat missing semantic models or embeddings as explicit warnings while a
  healthy BM25 index remains usable.
- Never implement a competing semantic Markdown index, embedding store, or
  ranking pipeline inside `wfctl`. The deterministic graph may compile only
  authored links and first-class workflow metadata.
- Never infer product intent from implementation. Reconstruction records
  observed source, accepted intent, delivery, alignment, and unknowns as
  independent fields.
- Never auto-discover sibling repositories or persist machine-local leaf
  paths in Git. Leaf initialization explicitly registers repository identity
  and adds its exact worktree to ignored local state without changing the
  active reconstruction selection. Selection is a separate maintainer-visible
  operation.

## Verification criteria

- [x] A clean knowledge target previews, initializes, and passes check.
- [x] A clean leaf target links to knowledge, initializes, and passes check.
- [x] Existing `AGENTS.md` and `CLAUDE.md` content survives init and upgrade.
- [x] Locally modified owned files cause conflicts instead of being overwritten.
- [x] Work start produces one canonical central spec.
- [x] Significant discussion is persisted from shaping onward and can resume
  after compaction without chat memory.
- [x] Work commands support project-only, one-checkout, and multi-repository
  scopes and reject an unbound branch or worktree.
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
- [x] QMD's official native skill is installed for the selected Codex and
  Claude targets instead of being copied into the workflow source.
- [x] Missing or old dependencies stop initialization before filesystem writes.
- [x] Real QMD integration proves configuration convergence, lexical indexing,
  raw collection isolation, status, and doctor behavior.
- [x] Real Graphify integration produces and validates a non-empty code graph.
- [x] Leaf setup refreshes a checkout-local Graphify graph and keeps its
  generated output out of Git without replacing existing ignore rules.
- [x] Curated knowledge rejects raw references, stale verification, unpinned
  code sources, and incomplete claim attribution.
- [x] Decision validation rejects missing, non-reciprocal, cyclic, or
  multi-current supersession lineages.
- [x] Knowledge graph compilation rejects broken internal links, invalid or
  invisible typed relations, Area mismatches, and unreachable stable concepts.
- [x] Completed significant work records an applied knowledge delta or an
  explicit no-update reason.
- [x] Lightweight findings can enter `changes/inbox/` without being mislabeled
  as completed project history.
- [x] Existing projects can build a baseline without raw files or prior
  documentation.
- [x] Reconstruction binds exact worktrees and commits while keeping absolute
  paths out of durable records.
- [x] Any number of worktrees may be known for one repository; adding or
  initializing one never silently changes that repository's explicit active
  reconstruction selection.
- [x] Completed reconstruction rejects incomplete repository coverage,
  unresolved claims, unreviewed optional inputs, missing promotion, and absent
  maintainer approval.
- [x] Curated product concepts distinguish accepted intent, observed delivery,
  and alignment without treating code as automatic product truth.

## Progress

- [x] Research OKF v0.2, living-spec workflows, and cross-runtime CLI frameworks.
- [x] Select Cliffy with bundled npm distribution.
- [x] Define the raw / intake / changes / curated knowledge boundary.
- [x] Implement the filesystem planner and safe applier.
- [x] Implement CLI commands.
- [x] Complete and validate rules, skills, and templates.
- [x] Add automated tests, real QMD/Graphify integrations, and runtime smoke checks.
- [x] Dry-run against the named DnD repositories.
- [x] Define maintainer review boundaries without conflating OKF trust and
  lifecycle.
- [x] Implement and verify source-first existing-project reconstruction.

## Out of scope for v2

- Hosted registry or automatic GitHub self-update.
- A full-screen Ink interface.
- Automatic semantic reconciliation of contradictory raw material.
- Automatic proof that implementation behavior is correct; agents and maintainers provide semantic evidence, while the CLI enforces structural gates.
- A search or embedding engine. QMD owns retrieval; Git file accounting,
  complete reading, omission audits, and agent/maintainer adjudication own the
  workflow guarantees.
