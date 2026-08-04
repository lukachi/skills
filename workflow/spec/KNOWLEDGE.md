# Knowledge contract

## Status

This document is normative for project knowledge, trust boundaries, intake,
curation, retrieval, lifecycle, and generated relationship artifacts.

## Information surfaces

| Surface | Purpose | Authority |
| --- | --- | --- |
| `raw/` | Continuous append-oriented input | Untrusted; never evidence or current truth |
| `intake/` | Bounded review of frozen raw inputs | Audit and candidate state only |
| `reconstruction/` | Source-first baselines and audits | Audit and candidate state only |
| `trajectories/` | Product subjects as lines, and declared visions | Declared direction is maintainer authority; the rest is working state |
| `changes/inbox/` | Pending captures without an active or curated owner | Non-authoritative queue |
| `changes/active/` | Canonical living work records with hash-bound checkpoints | Approved intent within recorded scope |
| `changes/archive/` | Honest closed outcomes and resolved capture receipts | Durable project history, not current knowledge by itself |
| `knowledge/` | Curated OKF v0.2 bundle | Current project knowledge and durable history |

`knowledge/` must never cite or link to `raw/` or `intake/`. Curated claims use
independent evidence, approved change records, exact source revisions, primary
external references, or explicit maintainer authority.

## Evidence and authority

- Source code is implementation authority at an exact revision.
- Source code does not establish accepted product intent.
- Raw material is a clue even when it accurately predicted later code.
- A decision the maintainer recorded in raw is still not authority, but it is
  not a clue either: it is their own wording, dated, awaiting confirmation
  rather than recovery. Ask whether it still stands, once per decision record
  with named exceptions, and let the confirmation carry the authority while the
  record carries the text. Reopening written decisions as if nothing were
  written turns a body of accepted work into an unanswered queue.
- Git identity proves which corpus was reviewed, not what it means.
- QMD retrieval and generated graphs locate relationships; they do not create
  authority.
- Unknown chronology or truth remains unresolved until evidence or a
  maintainer decision resolves it.
- Capture order, file age, confidence, and fluency never choose current truth.

## Human knowledge structure

`knowledge/index.md` is the project entry point. Area indexes are the primary
maps for durable product or functional responsibilities.

An Area owns its:

- capabilities;
- use cases;
- domain concepts and canonical language;
- rules;
- implementation;
- durable decisions;
- local evolution and chronology.

Project-level vision, cross-Area flows, architecture, decisions, repositories,
uncertainties, and references are allowed only when no Area is the honest
primary owner.

## Two first-class knowledge roads

Knowledge exposes two linked ways through the same project:

- the **maintainer/product road** uses product concepts to explain current
  behavior, audience, capabilities, rules, exceptions, examples, delivery, and
  evolution in stakeholder language;
- the **engineering road** uses engineering concepts to explain
  implementation, ownership, source boundaries, contracts, failures,
  operations, and verification.

Both humans and agents may navigate either road. Neither road is subordinate or
derived from the other. They share Area ownership, capabilities, changes, and
decision lineages. Decision records and evolution provide rationale and durable
history to both roads rather than forming a third flat document stream.

Every concept declares `view`, `purpose`, and `audience`. Product concepts must
not contain code, identifiers, endpoints, schemas, source paths, or
implementation walkthroughs. Engineering concepts link established product
meaning before explaining realization and do not infer intent from code.

Product-bearing concepts keep document lifecycle separate from:

- `realization.intent`;
- `realization.delivery`;
- `realization.alignment`.

A proposed idea remains outside curated current knowledge.

## Decisions and language

Canonical domain vocabulary belongs to its owning Area concept and records
definitions, contextual boundaries, aliases, and discouraged names.

A standalone decision record is created only when a choice is hard to reverse,
surprising without context, or resolves a real tradeoff.

Decision changes use immutable successor records, reciprocal acyclic
supersession links, and one stable current record per lineage. Area evolution
summarizes meaningful changes; whole Areas are not cloned into version folders.

## Semantic quality

Every stable concept requires:

1. deterministic structural validation;
2. an independent authority/truth review;
3. an independent reader-communication review;
4. normal evidence verification.

Both semantic reviews and normal verification bind the same material content
hash. Editing material content invalidates their receipts. Quality metadata
does not create authority.

## Raw intake v4

Each intake case freezes explicit Git pathspecs at one full commit and records
every matching blob. Every frozen file is read completely.

Every material statement becomes an atomic candidate claim with independent:

- semantic role;
- authority class;
- epistemic disposition;
- intent state;
- delivery state;
- intent/delivery alignment;
- temporal scope;
- explicit claim relations;
- routing lane and destinations.

Supersession and contradiction are explicit claim relations. Current truth,
former durable truth, proposals, rejected material, and unresolved material are
not flattened.

### Routing

| Lane | Meaning | Allowed destination |
| --- | --- | --- |
| `current-knowledge` | Confirmed current product or implementation truth | Curated non-index concepts |
| `history` | Confirmed former state or durable chronology | Curated decision, history, or evolution concepts |
| `change` | Reviewed proposal or plan with an active owner | `changes/active/` |
| `capture` | Useful pending material without an active or curated owner | `changes/inbox/` |
| `case-only` | Rejected, unresolved, or non-durable material | No destination |

Proposed intent cannot route to current knowledge. Unresolved material cannot
leave the case. Rejected or superseded intent cannot become current knowledge.

Repeated rejected ideas remain case-only unless the maintainer explicitly
adopts their underlying boundary as a durable non-goal.

### Omission probes

After routing, the agent writes diagnostic questions that must be answered from
durable outputs without consulting raw or the case. Every non-rejected
candidate is covered by at least one probe.

A passed probe records:

- expected candidate IDs;
- a non-empty answer;
- every inspected durable output;
- a result.

A multi-candidate probe must inspect a declared routed output for every expected
candidate. Failure creates repair work. Waiver requires an explicit maintainer
decision and remains visible.

Existing v3 cases migrate conservatively through a separate migration and
semantic-review sequence. Legacy destinations remain migration context, never
implicit current routing.

## Trajectories and declared direction

A trajectory is one product subject as a line: how it was conceived, what changed
and why, and what the source shows now at a named revision. It is the unit the
maintainer decides about and the only layer they are shown.

Nothing below a trajectory asserts anything about the present. An observation
says what one source said on a date; a finding says what happened over a period.
Routing into `knowledge/` is not available before a trajectory exists, because a
claim about current truth made while reading is made before the material that
contradicts it has been read.

A finding's cause carries evidence separate from the claim's. `not-found` records
that no decision record was located and is not `drift`, which asserts that none
was made; only `not-found` and `unknown` may carry no cause evidence.

Three axes replace two. `intent` is what the project stated, recovered.
`delivery` is what the source delivers now. **`vision` is what the subject should
become, and only a maintainer declares it.** The gap between vision and delivery
is direction debt, distinct from the delivery debt between intent and delivery. A
gap is never stored: it is derived, and a gap accepted as correct is a vision that
was wrong.

A vision is a decision record with an author, a date, immutable successors, and
one current record per subject. A vision names its trajectory; a trajectory never
names its vision. It is produced only through a command requiring an interactive
terminal or an out-of-band token, and reconciled against an ignored durable
record, for the reason maintainer approval is: recovering what a project meant
and declaring what it should become are different acts, and the agent may perform
only the first.

Composition is derived from product language. A hierarchy assembled from paths is
correct about the repository and carries nothing anyone can decide about. Vision
inherits along `part-of` from one primary parent and along no other relation.

## Reconstruction convergence

Reconstruction findings use the same candidate dimensions, routing,
adjudication, promotion, and validation gates as raw intake. Its additional
source-completeness rules live in
[RECONSTRUCTION.md](RECONSTRUCTION.md).

Raw is optional during reconstruction. Its participation is a human-owned
scope decision, not an agent inference: all frozen raw, selected themes mapped
to paths, or exclusion. The CLI records unavailable automatically only for an
empty starting snapshot. Reconstruction-linked intake cannot start before this
decision or escape its baseline and paths. If a case declares raw reviewed,
its approved frozen scope must converge to zero unseen, changed, active,
blocked, unresolved, or uncommitted selected inputs.

## Active case continuity

Current intake and reconstruction cases are operational working-memory owners,
not truth surfaces. Each contains a consequence-driven discovery ledger.
Reconstruction additionally places repository-local discoveries in dossiers
and cross-repository discoveries in its parent case.

Each active case has one hash-bound checkpoint with current state, last
material action, next action, blockers, actor, and stage. Intake hashes its
case. Reconstruction hashes its parent case, every dossier, and every coverage
ledger. A changed owner makes the checkpoint stale. Clean sessions auto-select
only one active case, enumerate required complete reads, and expose exact
frontier state; several active cases require a human-outcome choice. Neither a
discovery ledger nor a checkpoint is promoted into `knowledge/` or accepted as
evidence.

## Retrieval

QMD is a rebuildable retrieval cache:

- `knowledge` is the only default collection;
- `changes`, `intake`, `reconstruction`, and `raw` require explicit selection;
- lexical BM25 is part of normal installation health;
- semantic models and embeddings are optional warnings;
- candidate documents must still be read before conclusions are drawn.

`wfctl` must not implement a competing semantic Markdown index, embedding
store, or ranking pipeline.

## Deterministic artifacts

`wfctl knowledge build` compiles two ignored, rebuildable artifacts:

- `.workflow/current/knowledge-graph.json` from authored Markdown links, typed
  relations, Area ownership, and decision lineage;
- `.workflow/current/claim-ledger.json` from explicit intake and
  reconstruction candidates, relations, routing, evidence, adjudication, and
  promotion state.

Neither artifact infers missing facts or becomes evidence. The build rejects
broken internal links, invisible typed relations, Area mismatches, unreachable
stable concepts, invalid decision lineages, and inconsistent claim relations.

## Completion

Promotion requires complete candidate routing, valid evidence or maintainer
authority, fresh semantic receipts, successful structural validation, rebuilt
derived artifacts, and explicit maintainer review where required.

Partial and unresolved states remain valid. The workflow must never repair a
failed gate by weakening the claim or silently changing its meaning.
