# Reconstruction model

## Why reconstruction is separate

A raw-intake case proves full review of a bounded dump. A reconstruction case
builds or audits the current project map across source repositories and optional
inputs. Neither operation runs on every implementation task.

The source lanes have different authority:

| Input | What it can establish | What it cannot establish alone |
| --- | --- | --- |
| Source at a pinned commit | Observed structure and implementation | Intended product meaning, correctness, completeness, rationale |
| Tests and runtime checks | The behavior actually exercised | All reachable behavior or product intent |
| Git history | Recorded code chronology | Unrecorded history or why a change was desired |
| Reviewed change record | The scoped outcome and receipts it contains | Unverified or abandoned claims |
| Documentation | An authored claim with provenance | Current truth without authority and verification |
| Raw material | Candidate ideas, terminology, contradictions, leads | Evidence or current truth |
| Maintainer decision | Current intent and accepted normative meaning | Implementation reality |

The agent reconciles sources; it never ranks one universal source of truth.

## When a source is worse than the table assumes

The table describes each input at its best. This project's copy may be far
worse: documents pointing at deleted scratch directories, specifications
rewritten many times with no supersession, temporary agent notes that became the
only written intent, tests that no longer run.

Observe that condition per repository and per lane, record it in the dossier
with the evidence that established it, and then hold three lines.

**Demotion is never promotion.** Learning that documents are unreliable narrows
what documents can establish. It does not make raw material authoritative for
intent. Replacing one ranked source with another is the same mistake with a new
winner, and it is the easiest one to make immediately after discovering the
first source is bad.

**A degraded source is still read.** Rewritten and contradictory material still
carries terminology, chronology, and leads, and still shows what was once
believed. Downgrade it as evidence; do not drop it as input. Where one source
contradicts itself over time, reconcile by chronology instead of picking a
version.

**Measure what a document covers before using it.** An unfinished document is
not an unreliable one. It is exact inside its edge and silent past it, and the
silence establishes nothing either way. Judging the lane from a sample produces
a verdict that a fuller reading then overshoots in the opposite direction, and
both verdicts are wrong for the same reason. Record what the document covers,
what it puts out of scope, and when it was written, and read it as a statement
of intent at that date rather than as current truth.

**Report `unknown` rather than inventing.** If no source establishes intended
meaning, record `intent: unknown` next to the observed delivery and put the
question to the maintainer. A baseline that is mostly unknown intent is the
correct description of a project whose intent was never written down. Do not
close the gap with the least-bad source available; that turns a guess into
curated knowledge, and the maintainer can no longer see that it was a guess.

Say this to the maintainer in plain terms when it happens. "Nothing in the
repositories or the raw history reliably states what this was for; the code
shows what it does. I can record the behavior now and ask you about intent
capability by capability" is a better first turn than a new theory of which
source to trust.

## Two independent state axes

Product intent and implementation delivery evolve independently. Record both:

- intent: `accepted`, `proposed`, `superseded`, `rejected`, `unknown`, or
  `not-applicable`;
- delivery: `absent`, `partial`, `implemented`, `verified`, `retired`,
  `unknown`, or `not-applicable`;
- alignment: `aligned`, `drifted`, `unknown`, or `not-applicable`.

Examples:

| Intent | Delivery | Alignment | Meaning |
| --- | --- | --- | --- |
| accepted | verified | aligned | Intended behavior is implemented and freshly checked |
| accepted | partial | drifted | The project intends more than the current code delivers |
| accepted | absent | drifted | Accepted capability is not implemented |
| proposed | absent | unknown | Idea exists but is not current knowledge |
| unknown | implemented | unknown | Legacy behavior exists without known product authority |
| superseded | retired | aligned | Former behavior and implementation were intentionally retired |

Document lifecycle (`draft`, `stable`, `deprecated`) is separate. It describes
the knowledge file, not product delivery.

## When the maintainer says it should work differently

This is the most common adjudication answer and it carries two different
meanings. Ask which one before recording anything:

> Was it always meant to work that way, or is that a change you want now?

**It was always meant to be Y.** The code drifted, or was never finished.
Record `intent: accepted` on the maintainer's authority with this adjudication
as its provenance, `delivery` as whatever the source actually shows, and
`alignment: drifted`. The gap is a fact about the project and belongs in the
baseline. Do not soften the delivery claim to make the two agree.

**It works as intended, and you want Y now.** That is a new decision, not
recovered history. Record the existing behavior honestly — `intent: accepted`
or `unknown`, `delivery: implemented`, `alignment: aligned` — and route the
want to `changes/inbox/` as a capture, or to a change bundle if the maintainer
wants to pursue it immediately. It never enters the baseline as intent.
Recording a want as historical intent tells every later reader that the project
always meant Y, and erases the fact that it was decided here, on this date, by
this person. That is the decision lineage the product road exists to carry.

**The maintainer is not sure.** Common, and not a failure. `intent: unknown`
with the observed delivery, and the desire captured separately if there is one.

Reconstruction never edits source, so no answer here produces a fix. Drift
becomes curated knowledge that a later change bundle acts on; a want becomes a
capture that someone triages. Say that plainly rather than leaving the
maintainer expecting the code to move.

## Candidate classes and gates

- `implementation` needs pinned source code. An `absent` delivery claim uses a
  reviewed reconstruction receipt because there is no source path for
  nonexistent implementation; the coverage audit must justify the negative
  finding.
- `history` needs pinned version-control evidence.
- `product-intent`, `product-meaning`, `architecture`, `ownership`, and
  `contract` need explicit maintainer adjudication.
- `architecture` and `contract` additionally need a recorded Graphify query,
  recorded as `graph-query` evidence with the resource
  `graphify:<repository>#<query>`. They assert that parts relate, and a path or
  a file name cannot show a relationship. A query that found nothing still
  counts and is itself a finding about the lane; record it in the dossier's
  source condition.
- `uncertainty` records a supported current question, not an unsupported guess.

`confirmed` means the claim may enter current knowledge. `deferred` means it was
reviewed but deliberately stays outside current knowledge. `unresolved` blocks
a completed reconstruction.

Reconstruction and raw intake use one claim vocabulary. In addition to
authority class and the intent/delivery/alignment axes, new reconstruction
candidates record:

- semantic role: idea, requirement, decision, design, plan, status,
  observation, or outcome;
- temporal capture, assertion, and effective bounds;
- explicit supersession, contradiction, refinement, implementation, and
  derivation relations;
- routing to current knowledge, history, change, or case-only.

Use `intake:<case-id>#<candidate-id>` and
`reconstruction:<case-id>#<candidate-id>` for cross-case relations. This lets
the deterministic claim ledger connect an old raw proposal to the
reconstruction finding that confirmed, rejected, refined, or superseded it.
The ledger is navigation and audit state; evidence still determines truth.

## Coverage without false certainty

The pinned Git tree provides complete file enumeration. Graphify provides the
initial structural map and relationship traversal. Direct pinned source,
tests, and runtime evidence establish claims. Text search helps detect exact
tokens and gaps after graph traversal. No tool proves semantic completeness.

The coverage ledger keeps three independent accounts:

- every Git-tracked entry, including formats Graphify does not parse;
- every recorded Graphify query and what it established or failed to establish;
- every declared entrypoint, runtime surface, and boundary.

Read-only exploration remains free to cross a workstream slice: the slice says
who owns a conclusion, not what an agent is allowed to see. Material expansion
is recorded for synthesis. Pinned `wfctl` reads turn selected source ranges into
stable, actor-attributed receipt IDs. Final workstream evidence must resolve to
those receipts; a path written in prose is not evidence. An inspected text file
is complete only when receipts cover every line. `structural-only` is for
non-product-bearing structure and always needs a reason; it cannot close
source, tests, contracts, configuration, product data, or documentation.
`irrelevant` also needs a scoped reason. Pending and blocked entries prevent a
completed baseline.

The agent turns these ledgers into a human-readable reconstruction frontier at
every pause or completed batch: pinned source set, outstanding file/community/surface
accounting, optional-input status, cross-repository reconciliation, unresolved
claims, maintainer decisions, and next action. The frontier is derived
presentation. It never replaces the complete ledgers or proves semantic
coverage.

The coverage audit must reconcile:

- every repository durably registered for a baseline, not merely the checkout
  paths remembered by the current agent;
- every tracked file, Graphify-indexed or not;
- graph-to-manifest reconciliation, without confusing a technical cluster for a product
  Area or capability;
- every discovered entrypoint, runtime surface, and boundary;
- exact direct-reading receipts behind source-code evidence;
- each selected repository and dossier dimension;
- cross-repository inputs and outputs;
- optional source-lane dispositions;
- every candidate and contradiction;
- every promoted concept;
- negative results and missing implementation;
- the distinction between current fact, historical fact, intended future, and
  unknown.

The maintainer review remains essential because a deterministic gate cannot
prove that an agent understood the whole project.

## Adaptive orchestration

Reconstruction is breadth-heavy enough to benefit from parallel research, but
only when its units are genuinely independent. The workflow therefore uses one
adaptive orchestrator rather than a permanent swarm.

The orchestrator owns the frozen frontier, assignment plan, shared dossiers,
final coverage states, candidate reconciliation, and all promotion. Workers
operate in isolated contexts over bounded semantic units and return durable
evidence packets. Their summaries are inputs, never authority.

Execution proceeds wide to narrow:

1. deterministically inventory repositories, Graphify communities, runtime
   surfaces, current knowledge, and approved optional inputs;
2. run a bounded breadth wave over independent repository, structural, or raw
   units;
3. fan in and compare every result with the complete frontier;
4. create narrower cross-repository, historical, contradiction, or omission
   work only where the first wave found a concrete reason;
5. synthesize once at the whole-project boundary;
6. use a fresh critic to test completeness, provenance soundness,
   contradiction transparency, and negative claims before maintainer review.

A workstream is defined by an independently reviewable outcome, exact snapshot,
coverage slice, and output contract. Alphabetical file sharding may help
distribute byte-complete reading but cannot define a product or architecture
conclusion. Cross-repository Areas, capabilities, flows, and contracts are
always reconciled after repository-local fan-in.

Parallelism is bounded by the host and the frontier, not maximized. Small,
tightly dependent, or shared-context work remains single-agent. Repeated
failure, unavailable authority, or blocked evidence stops at a human gate
instead of spawning more workers.

Each worker writes only its unique `workstreams/*.md` packet and uses attributed
`wfctl` reads for pinned source evidence, while remaining free to explore all
relevant read-only context. Shared machine coverage updates are serialized.
Only the orchestrator accepts a packet and applies final dispositions. The
case, every dossier, every coverage ledger, and every workstream present on
disk are part of the resumable session basis. The close gate rejects a packet
that is present but omitted from the orchestration list. Worker claim, submit,
and review transitions are CLI-managed under a case lock. Review identity is
reported provenance, not cryptographic authentication; the case separately
records whether the final critic was an independent agent, a separate session,
or the maintainer.

Raw participation is a separate maintainer-owned scope decision. The agent may
map and recommend the complete frozen snapshot, selected themes, or exclusion,
but cannot authorize the choice. Every reconstruction-owned intake case binds
the approved parent scope, time, paths, and baseline at creation. When raw is
reviewed, only that approved scope must converge through completed child cases.
Later raw blobs are a new intake generation and do not invalidate an already
frozen baseline.

## Project-wide convergence

Repository dossiers are observations, not separate project truths. Each one
maps what that repository demonstrably owns and links atomic candidate IDs.
The parent reconstruction case is the convergence boundary. It combines
candidate evidence across repositories, optional source lanes, and maintainer
intent before promotion.

As one purely illustrative topology, a client may expose a user flow while an
API owns its state transition and an admin application owns moderation. These
names and roles are not part of the workflow model: a project may register any
number of arbitrarily named repositories, and their responsibilities must be
discovered from evidence. In the illustration, the three dossiers remain
separate for traceability, but the promoted product capability is authored
once with links to all relevant implementation concepts and contracts. Missing
coverage in one repository remains an explicit negative or unknown; it is not
filled by inference from another repository.
