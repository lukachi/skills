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

Git is the enumeration authority. The manifest freezes every tracked tree
entry, including files unsupported by Graphify.

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

- exact blob;
- line range and total lines;
- actor;
- timestamp.

An inspected text file is complete only when its receipts cover the whole file
without gaps. Confirmed source-code evidence must resolve to an inspected file.

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

Raw is optional. When declared reviewed, its frozen snapshot must converge to
zero:

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
- invalid or missing knowledge promotion;
- absent maintainer approval.

`partial` and `abandoned` are honest outcomes when the gate cannot be completed.
No command may convert complete accounting into a claim of perfect
understanding.
