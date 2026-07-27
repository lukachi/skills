# Knowledge model

## Surfaces

- `raw/`: immutable, provenance-rich work evidence. Contradictions are allowed.
- `changes/active/`: live task specifications and progress.
- `changes/archive/`: closed task records.
- `knowledge/`: curated OKF v0.2 concepts representing current knowledge.

## Concept areas

- `vision/`: intent, outcomes, principles, constraints, non-goals.
- `product/`: users, domain concepts, capabilities, and flows.
- `architecture/`: responsibilities, boundaries, contracts, data flow, and operations.
- `decisions/`: cornerstone decisions and explicit supersession chains.
- `domains/`: stable cross-repository subject areas.
- `repositories/`: repository ownership and integration boundaries.
- `uncertainties/`: facts that cannot yet be resolved honestly.
- `references/`: source material represented inside the bundle.

## Authority

Authority is claim-specific. Prefer direct code evidence for implementation reality, human-reviewed current decisions for intent, and primary external sources for external facts. A newer agent-written document is not automatically more authoritative.

Use OKF source records and stable footnote IDs for important claims. Keep
`generated`, `verified`, and `status` separate. A stable concept can still be
unverified or machine-confirmed. A concept without explicit human confirmation
of its current material claims must not be represented as human-reviewed.
