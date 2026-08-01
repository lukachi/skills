# Reconstruction completeness contract

## Status

This document is normative for source-first project baselines and audits.

The workflow guarantees complete accounting of selected revisions, not perfect
semantic understanding.

## Source selection

- `.workflow/repositories.json` durably registers the complete project source
  set without machine-local paths.
- `.workflow/current/repositories.json` stores any number of known local
  checkouts or worktrees plus one explicit active reconstruction selection per
  repository.
- Leaf initialization registers repository identity and the exact local
  checkout but never changes an existing active selection.
- A default baseline includes every registered repository and requires one
  available selected clean checkout for each.
- When no selection exists, the agent announces and selects the sole valid
  candidate or asks the maintainer to choose when several are valid.
- An explicitly scoped audit may bind known alternative worktrees without
  changing the saved default.
- Reconstruction never scans every known worktree merely because it exists.

## Frozen identity

At case start, every selected leaf is bound to:

- durable repository identity;
- full commit;
- branch and worktree identity;
- a clean checkout;
- a complete Git tree manifest.

Absolute checkout paths live only in ignored runtime bindings. The durable case
must remain portable.

## Three coverage lanes

### Git inventory lane

Git is the enumeration authority. The CLI streams the pinned tree and freezes
every tracked entry without a fixed subprocess-output buffer, including files
unsupported by Graphify.

A completed case rejects:

- missing or added manifest entries;
- duplicate entries;
- blob or mode mismatches;
- evidence from a different revision;
- graph-only files that cannot be pinned to the Git tree.

### Graphify structural lane

Graphify is a navigation aid. Every indexed source file is reconciled with the
Git manifest, and every Graphify community receives a final disposition and
note.

Communities are technical clusters, not product Areas or capabilities. Each
repository dossier maps a community to product concepts or explains why no
mapping is appropriate.

Graphify absence never proves project absence.

### Direct-reading lane

Source and test evidence comes from pinned Git blobs. Reading receipts record:

- deterministic receipt ID;
- exact blob;
- line range and total lines;
- actor;
- timestamp.

An inspected text file is complete only when its receipts cover the whole file
without gaps. Blob reads stream through Git and retain only the requested line
window, so a large file is not loaded into CLI memory as one buffer. Agents may
explore with any safe read-only tool, but final workstream evidence must resolve
to a receipt owned by that worker. Confirmed source-code evidence must resolve
to an inspected file.

## File dispositions

Every tracked file receives one semantic category and one state:

- `pending`;
- `inspected`;
- `structural-only`;
- `irrelevant`;
- `blocked`.

`pending` and `blocked` prevent completion. `structural-only` and `irrelevant`
require an explanation.

Product-bearing source, tests, contracts, configuration, product data, and
documentation cannot finish as `structural-only`.

## Communities and runtime surfaces

Every Graphify community uses the same state model and requires a note.

Every discovered entrypoint, runtime surface, and boundary records relevant
paths and a final disposition. Each repository has a final surface audit. An
empty surface list is valid only with an explicit reviewed explanation.

The initial ledger conservatively proposes likely entrypoints, boundaries, and
runtime surfaces from manifest paths. Each proposal remains `pending` until an
agent inspects or rejects it; discovery is a review queue, never truth.

Unexplained communities or runtime surfaces block completion.

## Repository dossiers

Each selected repository produces one dossier containing:

- purpose and observed responsibility;
- source coverage;
- structural communities;
- entrypoints and runtime surfaces;
- implementation claims and exact evidence;
- known product mappings;
- delivery gaps, contradictions, and unknowns.

Repository names, roles, and count are never predefined by the workflow.

## Adaptive multi-agent execution

Reconstruction version 5 adds an execution contract without making subagents a
requirement for every case.

- One orchestrator owns the complete frozen frontier, parent case, repository
  dossiers, final coverage dispositions, candidate reconciliation, and curated
  knowledge writes.
- The orchestrator selects `single-agent` or `orchestrator-workers` after
  inspecting actual independent work and host capabilities. It records bounded
  parallelism, total workstream, and retry budgets plus a reason.
- Parallel work is read-heavy and semantically partitioned by repository or
  community outcome, runtime surface, cross-repository flow or contract,
  bounded raw-history question, or adversarial audit. Arbitrary path ranges do
  not establish semantic ownership.
- Every worker receives exact roots and frozen identities at dispatch, reads
  the parent case plus only relevant dossiers, frontier items, and explicit
  dependencies, updates one unique durable workstream packet, and attributes
  pinned-source receipts to its workstream actor.
- Packet coverage slices qualify every leaf file, community, and surface with
  repository identity and must resolve against the frozen frontier; raw case
  IDs must already belong to the parent reconstruction. A slice assigns
  responsibility, not visibility. Workers may follow adjacent read-only
  evidence and record material expansion under `explored_context`.
- `result.evidence_refs` contains receipt IDs, not arbitrary paths or prose.
  Each ID must exist, belong to the packet owner, and resolve to an assigned or
  explicitly explored file.
- Worker packets are untrusted findings. Only the orchestrator accepts them,
  updates shared dossiers and final coverage states, and synthesizes
  whole-project candidates.
- Work proceeds in bounded map, breadth, fan-in, evidence-driven depth,
  synthesis, and independent-review waves. New workers require a concrete
  frontier gap; agent count is not a goal.
- Per-resource barriers prevent concurrent Markdown mutation of the same packet
  or intake record. Submitted packets may be reviewed while unrelated workers
  keep reading. Final shared dossier, case, candidate, and knowledge synthesis
  waits for all workstreams in the wave to reach reviewed terminal states.
- Shared coverage mutations serialize through an ignored runtime lock. Direct
  edits to machine coverage JSON remain invalid.
- Reconstruction-owned raw workers use the same policy through serialized
  `case read` receipts. Final raw source dispositions remain orchestrator-owned;
  workers do not edit intake cases directly.
- A completed version 5 case requires every referenced workstream to be
  accepted or explicitly cancelled with orchestrator review, a passed synthesis
  audit, and a distinct fresh independent review. The review records its actual
  assurance as `independent-agent`, `separate-session`, or `maintainer`; agent
  review also records the host run ID. These fields are auditable provenance,
  not cryptographic authentication.
- Every packet present under `workstreams/` enters clean-session context and
  must be referenced. A worker cannot disappear from accounting by leaving its
  packet off the parent list.
  Hosts without subagents may work serially, but still require an honest fresh
  review or maintainer intervention before completed close.

The deterministic ledgers prove corpus accounting. They do not prove worker
understanding, orchestrator synthesis, or semantic truth.

## Session continuity

The parent case owns whole-project discoveries and each dossier owns
repository-local discoveries. A material discovery records its observation,
evidence boundary, implication, scope, and disposition immediately; it remains
operational memory until normal claim adjudication and promotion establish a
durable destination.

The parent checkpoint records only current state, last material action, next
safe action, blockers, and actor. Its basis hash covers the parent case, every
dossier, and every coverage ledger. Any later semantic or coverage change
makes the checkpoint stale. A clean session uses `reconstruct context --json`
to select only one active case, enumerate every required full read, expose the
complete coverage frontier, and detect staleness. Multiple active cases require
selection by human outcome; recency is never ownership.

Discovery ledgers and checkpoints never enter curated `knowledge/` pages and
never establish truth.

## Whole-project reconciliation

After repository dossiers are complete, the agent reconciles them into:

- project purpose and accepted intent;
- Areas and capabilities;
- cross-repository flows and contracts;
- observed delivery;
- intent/delivery alignment;
- meaningful history;
- proposals and unresolved questions.

One repository's partial observation must not become the whole-project
definition. Code may establish delivery but not accepted intent.

## Optional inputs

Existing documentation, Git history, changes, and raw intake join as separate
candidate inputs.

### Maintainer-approved raw scope

Reconstruction version 5 freezes the raw baseline but does not infer whether
raw belongs to the baseline. When files exist, the agent inventories and maps
the snapshot, recommends a boundary, and records exactly one maintainer choice:

- `all`: every blob in the frozen raw snapshot;
- `selected`: explicit raw pathspecs derived from maintainer-approved themes;
- `excluded`: raw does not participate in this reconstruction.

Raw is untrusted candidate material in every mode. Its inability to prove
current behavior is therefore not a valid reason to recommend exclusion.
Scope recommendations are based on possible relevance to the declared
reconstruction objective and the risk of losing intent, alternatives, or
history. Uncertain relevance favors a bounded selected review; `excluded` is
for material outside the objective or material the maintainer explicitly does
not want considered.

The durable scope records human actor, time, paths, and rationale. The CLI may
record `unavailable` without human input only when the frozen snapshot and
working tree are empty at reconstruction start.

Every reconstruction-owned intake case binds the parent reconstruction ID,
scope mode, approval revision, exact baseline, paths, and blobs at creation.
Creation before approval, path escape, baseline drift, reuse of an unrelated
case, or changing scope after a child case starts fails closed. A revised scope
requires a new reconstruction case.

When `all` or `selected` is declared reviewed, that approved frozen scope must
converge to zero:

- unseen or changed committed blobs;
- active, blocked, or unresolved cases;
- uncommitted changes to selected raw paths.

Raw added after the frozen snapshot belongs to a later intake case and does not
invalidate the closed reconstruction.

## Negative claims

Absence from Graphify, QMD, grep, a community, or one repository never proves
absence from the project.

A negative product claim requires:

- a completed coverage ledger across the relevant source set;
- reviewed optional inputs in declared scope;
- explicit maintainer review.

## Completion

Completion fails closed on:

- any unexplained file, community, entrypoint, or runtime surface;
- graph/tree mismatch;
- incomplete reading receipts;
- evidence outside the pinned baseline;
- unresolved candidate routing;
- unreviewed declared optional inputs;
- missing cross-repository reconciliation;
- unfinished or unreviewed orchestration workstreams;
- missing synthesis or independent omission review;
- invalid or missing knowledge promotion;
- absent maintainer approval.

`partial` and `abandoned` are honest outcomes when the gate cannot be completed.
No command may convert complete accounting into a claim of perfect
understanding.
