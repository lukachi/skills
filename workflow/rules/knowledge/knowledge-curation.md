# Knowledge authority

The repository has four separate surfaces:

- `raw/`: continuous untrusted input; never evidence and never current truth.
- `intake/`: Git-frozen reconciliation state; never cited from knowledge.
- `changes/`: active proposals and archived historical change records.
- `knowledge/`: curated OKF v0.2 current project knowledge.

Use this repository for current-knowledge explanation, decision-history
tracing, raw processing, contradiction reconciliation, knowledge audits,
navigation maintenance, verified promotion, and inbox/case triage. Leaf source
repositories may be inspected for evidence but never edited from here.

Use `operate-project-knowledge` as the default router for these common
knowledge-repository requests. It must delegate raw intake to
`process-raw-intake`, semantic promotion to `curate-project-knowledge`, and
code-backed verification to `analyze-with-graphify` in the exact leaf.

Use `process-raw-intake` for raw intake and
`curate-project-knowledge` for promotion. Never copy, link, footnote, or cite a
raw path from `knowledge/`.

Treat `raw/` as permanent append-only intake. Run
`wfctl knowledge raw inventory` to distinguish exact Git blobs that are unseen,
changed, active, reviewed, blocked, or unresolved. Let QMD and direct reading
help the agent propose bounded thematic cases; do not require the maintainer to
choose raw paths blindly.

Use the project-local QMD index for retrieval. Unscoped queries may search only
the `knowledge` collection; select `changes`, `intake`, or `raw` explicitly.
QMD output is navigation, not evidence or coverage.

Use `wfctl knowledge build` to validate and compile explicit Markdown links,
typed `x-wf.relations`, Area ownership, and decision lineage into
`.workflow/current/knowledge-graph.json`. The graph is disposable navigation,
not evidence. Never edit it. Every typed target must also be a human-visible
Markdown link, and every stable concept must remain reachable from
`knowledge/index.md`.

For code claims, invoke `analyze-with-graphify` in the exact source checkout,
then inspect the actual source and checks. Graphify output is navigation, not
authority.

Authority is claim-specific: maintainers own intent and normative decisions;
pinned source and runtime checks own implementation reality; primary sources
own external facts. Agent-written documents do not authorize themselves.

Keep unresolved raw candidates in intake cases. Use current knowledge
uncertainties only for live questions established by trusted evidence.

Use `knowledge/index.md` as the human entry point and
`knowledge/areas/<area>/index.md` as the primary map for each durable product or
functional Area. Organize detail by capabilities, concepts, rules, use cases,
implementation, decisions, and local evolution. Keep product meaning readable
without requiring implementation detail.

Treat those typed Area folders as sibling collections. Link implementation and
decisions from capabilities and use cases instead of nesting them underneath.
Use `product/flows/`, root `architecture/`, or root `decisions/` only when no
single Area is the honest primary owner.

Keep current truth at one stable path. Preserve changed decisions as immutable
records with reciprocal, acyclic `supersedes` and `superseded_by` links, one
stable current record per lineage, and a meaningful Evolution summary in the
Area index.

Every concept must satisfy the strict workflow profile: explicit lifecycle and
generation metadata, claim-level authoritative sources, current verification
for stable content, human verification for normative claims, explicit
`x-wf.relations`, valid human-visible links, explicit decision lineage, and no
raw references.

Run `wfctl knowledge validate` and `wfctl knowledge build` after promotion. A
failed validation or build blocks a completed knowledge update.
