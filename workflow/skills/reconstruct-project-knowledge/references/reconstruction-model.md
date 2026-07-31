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

## Candidate classes and gates

- `implementation` needs pinned source code. An `absent` delivery claim uses a
  reviewed reconstruction receipt because there is no source path for
  nonexistent implementation; the coverage audit must justify the negative
  finding.
- `history` needs pinned version-control evidence.
- `product-intent`, `product-meaning`, `architecture`, `ownership`, and
  `contract` need explicit maintainer adjudication.
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
- every Graphify community and its product mapping or explicit no-mapping
  result;
- every declared entrypoint, runtime surface, and boundary.

Pinned `wfctl` reads add blob-and-line receipts. An inspected text file is
complete only when those receipts cover every line. `structural-only` is for
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
- every Graphify community without confusing a technical cluster for a product
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

When raw is reviewed as part of reconstruction, its reconstruction-start Git
snapshot must converge through completed intake cases. Later raw blobs are a
new intake generation and do not invalidate an already frozen baseline.

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
