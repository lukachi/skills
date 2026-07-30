# Knowledge model

## Surfaces and trust

- `raw/`: continuous, append-only, untrusted input. It can trigger investigation but
  cannot support a knowledge claim.
- `intake/`: Git-frozen operational coverage and reconciliation records. It
  may locate raw material but is not current truth or an OKF source.
- `reconstruction/`: source-first baseline and audit records with repository
  dossiers, candidate adjudication, coverage review, and exact repository
  revisions. It is an opt-in evidence workflow, not the default reading
  surface.
- `changes/active/`: one proposed change and progress record per active
  significant task.
- `changes/archive/`: immutable historical change records. Their outcome,
  verification, and review fields qualify what they can support.
- `changes/inbox/`: lightweight handoffs awaiting triage. These are inputs, not
  authoritative project history.
- `knowledge/`: curated OKF v0.2 current knowledge. This is the only default
  project-knowledge reading surface.
- source repositories: implementation authority at exact revisions.

QMD indexes these Markdown surfaces for retrieval. Only `knowledge` is included
in unscoped queries; every other collection is opt-in. The QMD database is a
rebuildable cache and never a source.

Project change records must not cite raw or intake paths. A completed record
that does so cannot support a current knowledge concept.

All input lanes converge through the same promotion gate:

1. raw intake yields candidate claims;
2. source-first reconstruction yields implementation observations, repository
   boundaries, history evidence, and explicit unknowns;
3. active changes yield verified implementation and decision receipts;
4. claims are checked against their proper authority;
5. the maintainer adjudicates normative or ambiguous truth;
6. strict OKF concepts are updated and validated.

## Human information architecture

- `index.md`: the human entry point and progressive map.
- `vision/`: project purpose, outcomes, principles, constraints, and non-goals.
- `areas/`: the primary durable product or functional decomposition.
- `product/`: a concise project map of users, Areas, and cross-Area flows.
- `architecture/`: cross-Area boundaries, contracts, invariants, data flow, and
  operations.
- `decisions/`: only truly cross-Area decisions; Area decisions live under the
  primary Area.
- `repositories/`: ownership and integration boundaries.
- `uncertainties/`: live questions supported by trusted evidence.
- `references/`: primary external material represented as concepts.

Each `areas/<area>/index.md` is the main human-facing page for that Area. It
maps purpose, scope, current model, capabilities, use cases/flows, technical
realization, current decisions, evolution, and open questions. Add detail under
`capabilities/`, `concepts/`, `rules/`, `use-cases/`, `implementation/`, and
`decisions/` as needed. Use `log.md` for local chronology.

Area is the ownership container. The typed collections inside it are siblings,
not a mandatory nesting chain:

```text
areas/<area>/
├── index.md
├── capabilities/
├── use-cases/
├── concepts/
├── rules/
├── implementation/
├── decisions/
└── log.md
```

A capability or use-case document is a human navigation node. It links its
rules, concepts, implementation, decisions, and neighboring flows. Do not bury
all related documents inside `capabilities/<name>/` or
`use-cases/<name>/`; that creates false ownership when an artifact supports
several capabilities. When one typed collection becomes large, subdivide only
that collection by topic, for example
`implementation/revival/api.md` and `implementation/revival/client.md`.

Use root collections only for honest project-wide ownership:

- `product/flows/` for end-to-end flows that genuinely cross Areas;
- `architecture/` for system-wide technical boundaries;
- `decisions/` for decisions with no primary Area.

When one Area is primary, store the artifact under that Area and link it from
every affected Area. Cross-links form the knowledge graph. A bounded context is
a technical modeling boundary used only when code and language actually
justify it.

Do not mirror file trees, function lists, or implementation detail that
Graphify and direct source inspection can answer reliably.

## Authored relations and the compiled graph

The Markdown corpus is the source of truth. The generated
`.workflow/current/knowledge-graph.json` is a disposable navigation and
validation artifact. Rebuild it with `wfctl knowledge build`; never edit it or
cite it as authority.

The same build writes `.workflow/current/claim-ledger.json`. It normalizes
atomic claims from intake and reconstruction cases and compiles only their
explicit supersession, contradiction, refinement, implementation, and
derivation relations. It helps the agent trace how a raw proposal, source
finding, maintainer decision, and durable output connect. It does not infer a
missing relation or decide which claim is true.

Every concept declares:

```yaml
x-wf:
  relations: []
```

Add a relation only when it materially helps a reader traverse meaning:

```yaml
x-wf:
  relations:
    - kind: governed-by
      target: knowledge/areas/combat/rules/revival-eligibility.md
      context: >-
        Revival behavior is constrained by this rule; the rule defines the
        item and state conditions that the capability summary omits.
```

The target must also appear as a normal Markdown link in the body. This keeps
the human document, plain GitHub rendering, OKF-compatible tooling, and the
compiled graph consistent. `context` may be a short paragraph; preserve
conditions and boundaries that a one-line label would lose.

Supported authored relation kinds are:

- `supports`
- `governed-by`
- `implemented-by`
- `depends-on`
- `affects`
- `conflicts-with`
- `related-to`

Do not duplicate relationships that already have a first-class owner:

- `area` plus the document path compile to `belongs-to`;
- decision `supersedes` and `superseded_by` compile to lineage edges;
- ordinary Markdown links compile to `references`.

Decision-lineage targets and an Area document's parent Area must also be linked
from the body. Stable concepts must be reachable by following links from
`knowledge/index.md`; otherwise they are not part of the maintained human
reading surface.

Use the four indexes for different jobs:

- QMD finds candidate documents by lexical or semantic meaning.
- The compiled graph expands from those candidates through explicit,
  reviewable knowledge relationships and checks reachability.
- The claim ledger traces explicit adjudication and temporal lineage across
  intake and reconstruction cases.
- Graphify navigates implementation structure in source repositories.

None of these indexes is evidence. Read the selected Markdown and source files
directly before making a claim.

## Strict workflow profile over OKF v0.2

OKF itself requires only `type`; this workflow intentionally requires more:

- explicit `status`;
- explicit claim authority classes;
- `generated.by` and `generated.at`;
- non-empty `sources`;
- `sources[].id`, `sources[].resource`, and workflow `sources[].kind`;
- claim footnotes joined to source IDs;
- explicit `x-wf.relations`, with typed targets mirrored by Markdown links;
- valid internal Markdown links and root reachability for stable concepts;
- current verification for every stable concept;
- human verification for maintainer-decision authority;
- explicit deprecation destination or reason;
- a stable `decision_id`, `effective_at`, reciprocal `supersedes` and
  `superseded_by`, acyclic lineage, and no more than one stable current decision
  per lineage;
- no raw path in a concept, source, link, or footnote.

Supported source kinds:

- `maintainer-decision`
- `source-code`
- `runtime-check`
- `archived-change`
- `reconstruction-review`
- `version-control`
- `external-primary`

Supported authority classes:

- `intent`
- `product-meaning`
- `implementation`
- `architecture-rationale`
- `ownership`
- `contract`
- `operational-policy`
- `decision`
- `history`
- `external`

Normative classes require a `maintainer-decision` source and human
verification before becoming stable. Existing implementation requires pinned
source-code authority. An absent-delivery claim may use a reviewed
reconstruction receipt because no nonexistent path can be pinned.
`architecture-rationale` additionally requires pinned code checked for
contradiction. `history` requires pinned Git or review history plus either an
archived change or a reviewed reconstruction receipt. `external` requires a
primary external source.

Pinned code resources use:

`git:<repository-or-remote>@<40-character-commit>#<path>[:<symbol>]`

Archived changes use a stable project identifier such as:

`project-change:<change-id>#<section>`

The validator resolves that identifier to
`changes/active/<change-id>/change.md` or
`changes/archive/<change-id>/change.md`. An `archived-change` source must
already exist in the archive with a completed outcome and human completion
review. Maintainer-decision and runtime-check sources must resolve to matching
approval and verification receipts.

Approved reconstruction claims use:

`project-reconstruction:<case-id>#<candidate-id>`

The validator resolves that identifier under `reconstruction/active/` or
`reconstruction/archive/`. The candidate must be confirmed and its maintainer
decision must match the case-level human review. The reconstruction record is
a review receipt; implementation and history claims still cite pinned source
or version-control evidence directly. A `reconstruction-review` source may
establish a whole-scope negative finding such as absent delivery; it never
replaces pinned code for implementation that exists.

Authority is claim-specific. A newer document, an agent-written summary, a
Graphify edge, or repeated raw text does not become authoritative by consensus.

## Product intent and realization

Document lifecycle is not product delivery. Product-bearing concepts therefore
declare:

```yaml
realization:
  intent: accepted
  delivery: verified
  alignment: aligned
  assessed_at: 2026-07-28T12:00:00Z
```

- `intent` is `accepted` or `superseded` in curated current knowledge.
  Proposed and rejected ideas remain in reconstruction, raw intake, or change
  records until adopted.
- `delivery` is `absent`, `partial`, `implemented`, `verified`, `retired`,
  `unknown`, or `not-applicable`.
- `alignment` is `aligned`, `drifted`, `unknown`, or `not-applicable`.

A concrete delivery state requires implementation authority. A concrete
alignment claim requires both product and implementation authority. This lets
knowledge say that an accepted capability is absent, a legacy behavior exists
with unknown intent, or code has drifted without rewriting intent to match the
implementation.

## Current truth and evolution

Keep current meaning at one stable path. Do not rewrite the substantive body of
old approved decision records or duplicate an entire Area into version folders.
A changed decision creates a new record; only the predecessor's lifecycle and
lineage metadata change when it becomes deprecated and links reciprocally to
the successor.

The Area index explains the current behavior in plain language and includes a
short but meaningful Evolution summary. Full decision records retain context,
exact choice, rationale, alternatives, consequences, affected Areas and
capabilities, transition, unresolved questions, effective time, and authority.
The local Area log gives chronological navigation without flattening hundreds
of decisions into one global file.
