---
name: research-project-context
description: Investigate an external fact, standard, domain rule, technology constraint, comparable approach, or documented precedent that can affect a workflow project's product or engineering decisions. Use when the maintainer explicitly asks for research or accepts that recommendation for a material external evidence gap already named by intake, reconstruction, curation, or shaping. Prefer primary and current sources, preserve disagreements and dates, and write into the owning active record or a bounded pending capture when no owner exists. Never treat search results or an agent synthesis as project authority, and do not use this skill for ordinary current-project explanation or source-code analysis.
---

# Research Project Context

Produce a reviewable evidence packet that can inform a project decision without
silently becoming project truth.

Read [the research contract](references/research-contract.md) before a material
research pass.

## Bound the question

1. State the exact decision or knowledge gap the research must inform.
2. Record scope, exclusions, freshness requirements, jurisdiction or version,
   and the completion test.
3. If an active work, intake, reconstruction, or curation record already owns
   the question, update that record and its checkpoint. Otherwise create a
   non-authoritative capture with
   `wfctl work capture add <slug> --title "<research question>"`.
4. Do not start a broad literature survey when one authoritative fact is
   enough.

## Research

Spin up a **background subagent** to do the reading, so the session that asked
keeps working while it reads. A Wayfinder research issue is resolved this way and
never blocks the rest of the frontier: only the questions downstream of the fact
wait for it.

1. Prefer specifications, standards bodies, official documentation, original
   papers, source repositories, regulators, and first-party product
   documentation. Follow every claim back to the source that owns it.
2. Use secondary sources to discover primary material or represent a
   materially different interpretation. Never hide the source class.
3. Record for each material source: title, publisher or author, URL or stable
   identifier, publication/update date, access date, applicable version or
   scope, and the exact claim it supports or contradicts.
4. Read the relevant primary material directly. A search snippet, ranking,
   generated summary, or citation copied from another article is not evidence.
5. Compare claims in a matrix. Preserve conflicts, exceptions, uncertainty,
   and applicability limits instead of averaging them into consensus.
6. Stop when the bounded completion test passes. Name what remains unknown.

## Return a candidate, not authority

Write the result into the owning record or pending capture with:

- question and why it matters;
- concise answer;
- claim-to-source matrix;
- conflicting evidence and limits;
- applicability to this project;
- recommendation and alternatives;
- exact decision or verification still required;
- next action.

An external primary source can authorize an external fact. It cannot authorize
the project's product intent, architecture choice, or implementation state.
Those still require the normal maintainer and source-code authorities.

If the result should become durable current knowledge, invoke
`curate-project-knowledge`; store only the relevant primary-source reference
and independently approved project conclusion. If it should become proposed
work, start or update an active change. Resolve a standalone capture as
`routed` only after those destinations exist, or as `discarded` with the
reviewed negative result. If an owned research question answers nothing
material, record that negative result in its owner rather than manufacturing a
recommendation.
