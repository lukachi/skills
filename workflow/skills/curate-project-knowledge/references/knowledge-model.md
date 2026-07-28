# Knowledge model

## Surfaces and trust

- `raw/`: continuous, append-only, untrusted input. It can trigger investigation but
  cannot support a knowledge claim.
- `intake/`: Git-frozen operational coverage and reconciliation records. It
  may locate raw material but is not current truth or an OKF source.
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

Both input lanes converge through the same promotion gate:

1. raw intake yields candidate claims;
2. active changes yield verified implementation and decision receipts;
3. claims are checked against their proper authority;
4. the maintainer adjudicates normative or ambiguous truth;
5. strict OKF concepts are updated and validated.

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

## Strict workflow profile over OKF v0.2

OKF itself requires only `type`; this workflow intentionally requires more:

- explicit `status`;
- explicit claim authority classes;
- `generated.by` and `generated.at`;
- non-empty `sources`;
- `sources[].id`, `sources[].resource`, and workflow `sources[].kind`;
- claim footnotes joined to source IDs;
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
verification before becoming stable. `implementation` requires pinned
source-code authority. `architecture-rationale` additionally requires pinned
code checked for contradiction. `history` requires both an archived change and
pinned Git or review history. `external` requires a primary external source.

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

Authority is claim-specific. A newer document, an agent-written summary, a
Graphify edge, or repeated raw text does not become authoritative by consensus.

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
