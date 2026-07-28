---
name: curate-project-knowledge
description: Promote independently verified claims from reviewed change records, raw-intake cases, source code, primary external sources, and explicit maintainer decisions into the current OKF knowledge bundle. Use when a significant change alters durable project intent, product meaning, architecture, contracts, ownership, decisions, or operational knowledge; when confirmed raw candidates are ready for promotion; when superseding a decision; or when validating Area indexes and history. Never use raw files as evidence.
---

# Curate Project Knowledge

Maintain the smallest trustworthy description of current project truth. The
knowledge bundle complements source code; it does not duplicate discoverable
implementation detail.

Read [the knowledge model](references/knowledge-model.md) before first-time
promotion or decision migration.

## Accepted inputs

A promotion may start from:

- a completed, maintainer-reviewed record in `changes/archive/`;
- confirmed candidate IDs in a raw intake case;
- directly inspected source and tests at an exact Git revision;
- a primary external source;
- an explicit current maintainer decision.

`raw/` is never an accepted source. Do not open a raw file and translate it
directly into a concept. For raw material, invoke `process-raw-intake` first.

## Handle common promotion cases

- **Completed significant change:** compare the accepted work record with the
  verified implementation and update only durable project truth.
- **Confirmed raw candidates:** promote the candidate claims, not the raw
  wording, and attach their independent authoritative evidence.
- **Changed product rule or decision:** create a successor decision, deprecate
  predecessors reciprocally, and update the Area's current model and Evolution
  summary.
- **New Area or capability:** create the smallest useful Area map and only the
  typed documents needed now. Do not pre-create speculative hierarchies.
- **Implementation drift:** refresh implementation concepts from a pinned leaf
  revision after Graphify-assisted direct inspection; do not rewrite product
  intent to match accidental code.
- **Duplicate or misplaced knowledge:** choose one stable owner, merge without
  losing material conditions or exceptions, and replace duplicates with clear
  links where useful.
- **Cross-Area behavior:** keep one honest primary Area when possible. Use a
  root flow, architecture document, or decision only when ownership is truly
  shared.
- **Navigation-only maintenance:** preserve claims and provenance. Use
  `operate-project-knowledge` unless the edit changes semantic truth.

## Authority by claim

- Product intent and domain meaning require an explicit maintainer decision.
- Implementation reality requires pinned source-code locations and direct
  inspection; runtime behavior also requires a fresh receipt when static code
  cannot prove it.
- Architectural rationale, ownership, contracts, and policy require a
  maintainer-reviewed decision and must not contradict current code.
- Historical implementation requires Git or review history and a reviewed
  archived change.
- External facts require primary sources.
- Agent-written concepts and Graphify output have no independent authority.

If one concept mixes authority classes, attribute each material claim with a
matching `[^source-id]` footnote.

## Promotion procedure

1. Work from the knowledge root. Start at `knowledge/index.md`, then use
   `qmd search ... -c knowledge` or `qmd query ... -c knowledge --json` to
   discover relevant concepts. QMD MCP `query` is equivalent when called with
   `collections: ["knowledge"]`. Read selected files directly; QMD rank is not
   evidence.
2. Inspect lifecycle, freshness, provenance, verification, and supersession
   before relying on an existing concept.
3. If implementation reality matters, invoke `analyze-with-graphify` in the
   exact source checkout. Use it for navigation, then inspect actual source,
   tests, and runtime evidence at the recorded revision.
4. Identify the primary Area before choosing a file. Place capabilities,
   use cases, concepts, rules, implementation, and decisions in their sibling
   typed collections under that Area. Link relationships; do not physically
   nest implementation or decisions below a capability or flow. Use
   `product/flows/`, root `architecture/`, or root `decisions/` only when no
   single Area is the honest primary owner. A flow may link several Areas. Use
   a bounded context only when technical analysis proves a coherent model and
   language boundary; do not use it as a synonym for Area.
5. Compare the proposed claim with current concepts and accepted change
   records. Separate current human-facing truth, technical realization,
   history, and unresolved questions.
6. Ask the maintainer only for missing intent, authority, or a material
   decision. Present the decision, evidence, conflicts, recommendation, and
   requested response.
7. Create or update the smallest coherent concepts using
   [the concept template](assets/concept.md). For a new Area, create its
   human-facing `index.md` from [the Area template](assets/area-index.md) and
   add only the needed `capabilities/`, `concepts/`, `rules/`, `use-cases/`,
   `implementation/`, `decisions/`, and `log.md`. Make capability and use-case
   documents link their related rules, implementation, and decisions.
8. Give every source a stable `id`, `resource`, and workflow `kind`; attach
   material claims with matching footnotes.
9. Set `generated.at` to the latest material edit. Old verification does not
   survive that edit.
10. Use `status: stable` only after a suitable verification at or after
   `generated.at`. Normative claims require a human verification.
11. Author decisions from [the decision template](assets/decision.md). Preserve
    each approved decision's substantive body; later changes may update only
    lifecycle and lineage metadata. When a decision changes:
    - create a new record with a stable `decision_id`, `effective_at`, and
      project-relative `supersedes` paths;
    - mark each predecessor `deprecated` and set its reciprocal
      `superseded_by`;
    - keep exactly one `stable` current decision per connected lineage;
    - explain context, exact decision, rationale, alternatives, consequences,
      affected Areas/capabilities, transition, and unresolved questions;
    - never create `v1/`, `v2/`, or date-versioned copies of the whole Area.
12. Update the Area index's `Current model` and `Evolution` sections. The
    Evolution summary must explain what changed, why, and what it affected,
    then link the full decisions. Append detail to that Area's `log.md`. Keep
    the root `knowledge/log.md` as a high-level recent aggregator only.
13. Run `wfctl knowledge validate --target <knowledge-root>`, then `qmd update`
    so retrieval reflects the validated files. Re-run `qmd embed -c knowledge`
    when semantic vectors are needed.
14. Do not report promotion complete while validation fails.

Unresolved candidates from raw intake stay in the intake case. Use
`knowledge/uncertainties/` only for a live project question established by
trusted current evidence.
