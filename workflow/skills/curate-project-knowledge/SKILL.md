---
name: curate-project-knowledge
description: Orchestrate promotion of independently verified claims into a workflow project's current OKF knowledge bundle. Use when a completed change, reconstruction case, raw-intake candidate, source audit, external source, or maintainer decision is ready to update durable product knowledge, engineering knowledge, decision lineage, Area navigation, or project history. Route stakeholder-facing content to curate-product-knowledge, technical realization to curate-engineering-knowledge, and every material document through verify-knowledge-quality. Never copy raw input into knowledge or let code define product intent.
---

# Curate Project Knowledge

Coordinate the promotion boundary. Do not author product and engineering views as
one blended document.

`wfctl knowledge validate` owns the structural half and names the file and the
field when it refuses: the view a path takes, the sections a view needs, the
authority class it demands, the source formats, the realization enums, the
receipts, the lineage. Run it and read it rather than working from memory. Read
[the knowledge model](references/knowledge-model.md) for the half it cannot check.

## Which route this promotion came in on

Four routes reach `knowledge/`, and they differ in when the maintainer decides —
a change bundle before the write, a reconstruction and a trajectory at their own
gate, an intake case never, because an intake case can never be cited as
authority. [The knowledge model](references/knowledge-model.md) carries the rule
and what follows from it. Know which one you are on before drafting: it decides
where the page is written and what has to be true first.

A promotion may start from a closed change, confirmed reconstruction or intake
candidate IDs, directly inspected source at an exact revision, a primary external
source, or an explicit current maintainer decision. `raw/`, intake prose, QMD
results, compiled graphs, Graphify output, and agent summaries are never authority
for any of them.

## Route each durable claim

Classify claims before selecting files:

| Durable concern | View and owner |
| --- | --- |
| Current product purpose, capability, use case, flow, domain concept, rule, delivery summary, or Area evolution | Invoke `curate-product-knowledge` |
| Current implementation, architecture, repository ownership, contract, data/control flow, runtime, or operations | Invoke `curate-engineering-knowledge` |
| Durable choice that is hard to reverse, surprising without context, and resolves a real tradeoff | Use [the decision template](assets/decision.md), then invoke `verify-knowledge-quality` |
| Primary external context | Use `view: reference`, preserve the primary source, then verify |
| Trusted unresolved current question | Use `view: uncertainty`, state the missing authority, then verify |
| Proposed, rejected, or unadopted behavior | Keep outside `knowledge/` in changes, intake, or reconstruction |

A significant product change normally updates both a product concept and its linked
engineering concept. A refactor with unchanged product behavior may update
engineering knowledge only. Do not create an empty counterpart for symmetry.

## Promotion procedure

1. Work from the knowledge root. Require and invoke the native QMD skill, use QMD
   to locate candidates, and read every selected document directly.
2. Identify the smallest primary Area. Use root product flows, architecture,
   repositories, or decisions only when ownership genuinely crosses Areas.
3. Inspect the existing lifecycle, provenance, realization, quality receipt,
   verification, and decision lineage before changing any of them.
4. When implementation matters, invoke `analyze-with-graphify` in each exact leaf,
   then inspect pinned source, tests, contracts, and runtime evidence.
5. Separate accepted intent, observed delivery, alignment, technical realization,
   decision history, and uncertainty. Ask the maintainer only for missing product
   authority, chronology, ownership, or a material decision.
6. Route product and engineering documents to their specialized skills. Never
   reuse one body for both audiences.
7. For a new Area, create its product-facing index from
   [the Area template](assets/area-index.md), and add only the typed sibling
   collections needed now.
8. Update the product-facing Area index and its Evolution section when current
   behavior changes. Append the detailed chronology to the local log.
9. Invoke `verify-knowledge-quality` for every new or materially changed concept.
   Do not self-approve a failed, uncertain, unread, or blocked check.
10. Finish the content before hashing, because the hash is what both receipts bind
    and any later edit invalidates them.
11. For a page already inside `knowledge/`, run `wfctl knowledge validate`,
    `wfctl knowledge build`, and `qmd update`. Rebuild embeddings only when
    semantic retrieval is needed.
12. Return to the originating workflow and record where each page is. A change
    bundle keeps its pages under `promotion/` and records them with `wfctl work
    promotion <id>`; nothing it wrote is in the corpus yet, and calling it promoted
    would claim a decision the maintainer has not made. Do not report completion
    while any gate fails.

## Authority the validator cannot classify

A rejected proposal remains case-only by default. When repeated proposals reveal a
durable product boundary, ask the maintainer whether the boundary itself is an
accepted non-goal or a negative rule. Only that explicitly accepted rule may become
current product knowledge or a decision; the rejected proposal and its raw origin
stay outside the trust boundary.

Where a concept mixes authority classes, attribute each material claim to the
source that can establish it. Runtime claims need a fresh receipt when static code
is insufficient. An absent delivery claim may rest on a reviewed whole-scope
reconstruction receipt, because nonexistent code cannot be pinned.
