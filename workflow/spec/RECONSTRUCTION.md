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

A pin cannot be moved. There is no repin, rebase, or resync operation: a case
finishes on the commits it was started with, or it is abandoned. The pinned tree
itself is durable — reading goes through Git objects, which later commits never
remove — so advancing a leaf does not destroy recorded work. What breaks is the
Graphify graph, which lives in the working tree at `HEAD` rather than at a
commit, and therefore stops describing what the case reads. Anything that
advances a bound leaf, `wfctl upgrade` included, must surface that before it
writes.

This is a known gap rather than a design position, and the data for closing it
is already recorded: every manifest entry and every source-read receipt carries
the Git blob `objectId`. A repin is therefore a content-addressed comparison
rather than a heuristic — an unchanged blob keeps its disposition and receipts
verbatim, a changed one returns to `pending` with a recorded reason, a deleted
one flags the claims that cited it, and a new one enters as `pending`. Auditing
a finished baseline against advanced source is the ordinary case, not an
accident, so the absence is worth stating plainly instead of leaving the next
agent to invent a workaround.

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

Graphify is a map of nodes and the relationships between them. Its value is that
a relationship cannot be seen in a file name: text search finds where a word
occurs, the graph shows what actually reaches what. It exists so an
investigation misses less, not so it can name the project's parts.

Communities are technical clusters. They are not product Areas, capabilities, or
subsystems, and their generated names frequently describe nothing that exists in
the project. Nothing may be concluded about product meaning from a community
name or boundary.

Communities are therefore an index for navigation, not a unit of accounting. The
Git manifest already accounts for every tracked file, and a community is a
second index over those same files; requiring a disposition for each one adds no
completeness while demanding thousands of verdicts about a question communities
cannot answer. Coverage keeps one check here, the one this index can prove: every
indexed source file must reconcile with the pinned manifest, and drift between
the graph and the tree is an error.

The evidence obligation moves to the claims the graph supports. A confirmed
architecture or contract claim asserts that parts relate, which paths and file
names cannot establish, so it must carry a recorded Graphify query. A query that
returned nothing useful still satisfies this and is itself a finding: it belongs
in the repository's source condition as evidence that this lane is degraded here.

Graphify absence never proves project absence.

Graphify writes `graph.json` only when code topology changed, and
`built_at_commit` is stamped only by that write. A commit touching solely
excluded or non-code files therefore leaves the graph pinned to an earlier
revision, and `--force` overrides the shrink guard rather than this short
circuit. Verified against graphify 0.9.26. The CLI must reject the stale pin
rather than reconstruct against it, must not repair third-party state on its
own, and must say what happened and that removing `graph.json` and re-running
`graphify update .` rebuilds it while preserving the AST cache. An agent should
not have to rediscover this.

### Direct-reading lane

Source and test evidence comes from pinned Git blobs. Reading receipts record:

- deterministic receipt ID;
- exact blob;
- line range and total lines;
- actor;
- timestamp.

An inspected text file is complete only when its receipts cover the whole file
without gaps. Gap-free receipts are the precondition for that disposition and
never the act: retrieval establishes that the bytes were fetched and nothing
about whether anyone read them, so the read command must not promote a status it
cannot observe. A ledger that promotes on retrieval counts downloads while
reading like a measure of comprehension, and every figure derived from it —
coverage, completion, the weight behind a claim — inherits the overstatement.
Asserting `inspected` stays a separate, attributable act, and what was actually
understood belongs in the dossier, which can say that a file was received and
skimmed. Blob reads stream through Git and retain only the requested line
window, so a large file is not loaded into CLI memory as one buffer. Agents may
explore with any safe read-only tool, but final workstream evidence must resolve
to a receipt owned by that worker. Confirmed source-code evidence must resolve
to an inspected file.

## Degraded sources

The lanes describe what a kind of input can establish in a well-formed project.
Real projects are not well-formed. Documentation references paths that were
deleted, specifications were rewritten many times without supersession, temporary
scratch files became the only written intent, tests no longer run, and history
records the file moves rather than the decisions.

Source condition is therefore a property of this project's artifacts, not of the
artifact class. A reconstruction must observe it, record it with evidence in the
owning dossier, and carry it into review. It is not a conclusion to reach in
conversation and forget.

Three rules govern what happens next.

**Demotion is never promotion.** Finding one lane unreliable narrows what that
lane can establish. It never widens another. "The documents cannot be trusted,
so intent must come from raw material" is the same error as trusting the README:
one universal source of truth, re-ranked. Every source stays a witness, and
reconciling them is the work rather than a step before it.

**A degraded source is still a source.** Contradictory, rewritten, or abandoned
material still carries terminology, chronology, and leads, and it still shows
what was once believed. It is downgraded as evidence, not discarded as input,
and a source that contradicts itself across time is reconciled by that
chronology rather than by choosing one version.

**Coverage is measured, not inferred.** A document establishes what it covers
and nothing past its edge, and where that edge falls is a fact to observe rather
than a quality to judge. Reading four files and concluding that the
documentation lane establishes nothing, then reading seventy and concluding it
is the project's authoritative statement of intent, is the same mistake twice: a
verdict about a class drawn from a sample, corrected by overshooting. Unfinished
is not unreliable. A nine-page handbook is exact within its nine pages and
silent past them, and that silence is not a negative finding about anything.
Establish what a document covers, what it declares out of scope, and when it was
written, then use it strictly inside that. A document that names its own
boundary — an unbuilt layer, an open to-do, a coverage figure — is stating
intent as of its writing, which is chronology to reconcile rather than current
truth to adopt.

**`unknown` is a result.** When no source can establish intended meaning, the
correct baseline records `intent: unknown` beside its observed delivery. A
baseline where most capabilities carry unknown intent is an accurate description
of a project whose intent was never written down, and it is more useful than a
plausible one, because it names exactly what only the maintainer can supply.
Manufacturing intent from the least-bad remaining source launders a guess into
curated knowledge. Only maintainer adjudication moves a claim from `unknown` to
`accepted`.

## Recovered intent and new decisions

Adjudication regularly produces "it should work differently." A reconstruction
must establish which of two things that means before recording it, because they
are opposite claims about the past.

Intent the project always held, which the implementation never reached or later
lost, is recovered history: record it as accepted on maintainer authority, keep
the delivery claim as the source actually shows it, and mark the alignment
drifted. The divergence is part of the baseline.

Intent the maintainer forms during the reconstruction is a new decision. The
baseline records the existing behavior as it stands; the want leaves the case
as a pending capture or an explicit change bundle. It must never be written as
recovered intent. Doing so asserts that the project always meant it and destroys
the decision lineage that separates the two roads — a later reader can no longer
tell an original commitment from one made while reading the code.

When the maintainer cannot tell the two apart, intent stays `unknown`.

Reconstruction never edits source. Neither answer changes the implementation,
and the agent must say so rather than leave the maintainer expecting it.

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

### Workflow assets

A leaf commits the workflow wfctl installed into it, so those files enter the
frontier as tracked project files. They describe agent behavior, not the
project, and a reviewer must never read installed instructions as accepted
product intent.

The CLI categorizes them as `workflow-asset` when the ledger is frozen, from the
identity wfctl already recorded in the pinned tree — `.workflow/state.json` and
the skills the pinned `skills-lock.json` confirms wfctl installed. Ownership is
never inferred from a path pattern: a project may keep its own skills, rules,
and agent instructions in the same directories, and those stay in scope with a
`pending` state.

Wholly owned files are frozen as `irrelevant` with a machine-written reason, so
complete accounting still counts them. Files wfctl only writes a managed block
into carry the category but keep `pending`, because maintainer text may live
outside the markers and only a reader can tell.

An agent may re-disposition any of them; automatic classification is a starting
state, not a verdict.

## Communities and runtime surfaces

A Graphify community may carry a state and a note when an agent has something to
record about it, and an `inspected` community still requires a recorded query.
Neither is demanded of every community, and an undispositioned one does not block
completion.

Every discovered entrypoint, runtime surface, and boundary records relevant
paths and a final disposition. Each repository has a final surface audit. An
empty surface list is valid only with an explicit reviewed explanation.

The initial ledger conservatively proposes likely entrypoints, boundaries, and
runtime surfaces from manifest paths. Each proposal remains `pending` until an
agent inspects or rejects it; discovery is a review queue, never truth.

Unexplained runtime surfaces block completion. Communities do not: they index
files the manifest already covers.

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

Reconstruction version 5 uses orchestration version 3 for adaptive routing
without making subagents a requirement for every case. Existing orchestration
version 2 records retain their original assurance contract.

- One orchestrator owns the complete frozen frontier, parent case, repository
  dossiers, final coverage dispositions, candidate reconciliation, and curated
  knowledge writes.
- The orchestrator selects `single-agent` or `orchestrator-workers` after
  inspecting actual independent work and host capabilities. It records bounded
  parallelism, total workstream, and retry budgets plus a reason.
- Workstream routing separates semantic role from compute. Every packet records
  a workload (`exploration`, `analysis`, `synthesis`, or `review`), the minimum
  sufficient host-neutral profile (`fast`, `balanced`, or `deep`), and its
  rationale. Analysis requires at least `balanced`; synthesis and adversarial
  review require `deep`.
- The agent host maps profiles to concrete models and reasoning effort. Packet
  execution records the known selection or the explicit `host-auto` and
  `profile-default` fallback. Every claim appends this provenance to execution
  history, so retrying cannot erase the earlier worker, profile, model, or
  effort. Provider model names are provenance, never durable workflow
  requirements.
- Routing is a quality-driven cascade. Contradictions, insufficient evidence,
  negative claims, material cross-boundary expansion, review rework, and
  maintainer-only authority are durable escalation triggers. The orchestrator
  records whether it selected a stronger profile, opened a narrower workstream,
  requested maintainer review, retained uncertainty, or justified a
  same-profile correction. Deterministically observable contradictions,
  unexplained results, negative claims, material explored scope,
  maintainer-authority questions, and repeated attempts block acceptance until
  a matching escalation for the current attempt is recorded. A follow-up
  workstream remains planned, belongs to a later wave, and depends on its
  origin. Review and execution histories are append-only.
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
  or separate-session review is an assurance role outside the normal worker
  set, requires `review` / `deep` routing, and records the routing reason plus
  effective host, run ID, model, and reasoning effort. These fields are
  auditable provenance, not cryptographic authentication.
- Every packet present under `workstreams/` enters clean-session context and
  must be referenced. A worker cannot disappear from accounting by leaving its
  packet off the parent list.
  Hosts without subagents may work serially, but still require an honest fresh
  review or maintainer intervention before completed close.

The deterministic ledgers prove corpus accounting. They do not prove worker
understanding, orchestrator synthesis, or semantic truth.

Version 2 workstreams from an already-active reconstruction remain valid under
their original lifecycle after upgrade. They do not receive fabricated routing
history; all newly created packets use version 3.

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
