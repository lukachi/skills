
## Knowledge repository practice

The knowledge repository supports two different operations.

### What to ask the knowledge agent

Use an agent here for shared project understanding, not leaf implementation.
Typical requests include:

- explain the current state of an Area, capability, flow, or decision;
- trace how a decision evolved and why;
- inventory and process new `raw/` material;
- reconcile contradictory historical claims;
- audit stale, missing, duplicated, or weakly sourced knowledge;
- improve Area indexes and human navigation without inventing truth;
- curate verified results from completed changes;
- triage `changes/inbox/` and active intake cases.

The agent may inspect multiple leaf repositories through Graphify to verify
implementation claims, but it never edits their source code from this
repository. If the outcome requires implementation, continue from the owning
leaf repository.

The current CLI has no knowledge-only living-spec mode: `wfctl work start`
requires a leaf checkout. Exploration may happen here, but a new authoritative
product or architecture decision must pass through the most relevant leaf
workflow before promotion. If no leaf owner exists, preserve the material in
`raw/` and keep it untrusted or unresolved.

### Continuous raw intake

`raw/` remains available for ideas, notes, chat exports, research, historical
artifacts, and other low-friction captures throughout the project. Work in
bounded topics rather than asking an agent to summarize the entire dump.

1. The agent runs `wfctl knowledge raw inventory`. Git identifies exact
   `path + blob ID` sources; QMD helps it map unseen and changed material.
2. The agent proposes coherent batches with topic and file counts. You review
   the proposed batch, not a blind list of paths.
3. Commit accepted raw captures so they have a stable identity.
4. The agent creates a bounded case with `wfctl knowledge case start --path
   raw/<path>`. The case records every matching Git tree entry and blob ID.
5. The agent runs QMD from this repository, explicitly searches the `raw`
   collection, and follows related terminology and contradictions.
6. The agent then reads every frozen source in full, records its result with
   `wfctl knowledge case mark`, and maintains atomic candidate claims in the
   case. Retrieval snippets do not count as complete review.
7. Implementation candidates are checked in exact source repositories through
   Graphify followed by direct source and test inspection.
8. You answer only unresolved intent, chronology, or authority questions.
9. `wfctl knowledge case check <case-id>` must pass before the agent claims
   complete file accounting for that bounded case. It fails on Git drift,
   missing sources, pending reviews, or incomplete candidate linkage.
10. Confirmed claims pass through `curate-project-knowledge`; unresolved raw
   claims stay outside current knowledge.

### Current knowledge maintenance

Your main road is `knowledge/index.md` → `knowledge/areas/<area>/index.md`.
Each Area explains purpose, scope, current behavior, capabilities, flows,
technical realization, decisions, evolution, and open questions. Human-facing
meaning remains readable before technical detail.

Within an Area, `capabilities/`, `use-cases/`, `concepts/`, `rules/`,
`implementation/`, and `decisions/` are sibling collections. Start with the
Area index and capability, follow links to rules or use cases, then open
implementation or decision records only when you need technical realization or
rationale. Genuinely cross-Area flows live under `product/flows/`; system-wide
architecture and decisions use their root collections.

The agent uses QMD only against the `knowledge` collection, reads selected
concepts directly, updates the smallest coherent Area, uses claim-level
authoritative sources, preserves immutable decision records, runs
`wfctl knowledge validate`, and refreshes QMD. Current decisions live at one
stable path; predecessors remain deprecated with reciprocal links. Area
Evolution sections explain what changed and why, while Area `log.md` files
carry local chronology. The root log is only a high-level aggregator.

Ask for a review packet rather than reading the entire corpus. Focus on product
intent, meaning, normative architecture, ownership, contracts, decisions,
accepted risk, and contradictions that evidence alone cannot resolve.
