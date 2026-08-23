# Researching an external fact

Produce a reviewable evidence packet that can inform a decision without silently
becoming project truth. See [the research contract](../references/research-contract.md)
before a material pass.

## Bound the question

State the exact decision or gap the research must inform. Record scope,
exclusions, freshness, jurisdiction or version, and the completion test. Do not
start a broad literature survey when one authoritative fact is enough.

If an active record already owns the question, update that record. Otherwise
create a non-authoritative capture.

## Research

Spin up a **background subagent** to do the reading, so the session that asked
keeps working while it reads. Only the questions downstream of the fact wait.

1. Prefer specifications, standards bodies, official documentation, original
   papers, source repositories, regulators, and first-party product
   documentation. Follow every claim back to the source that owns it.
2. Use secondary sources to discover primary material or to represent a
   materially different interpretation. Never hide the source class.
3. Record for each material source: title, publisher or author, stable
   identifier, publication date, access date, applicable version, and the exact
   claim it supports or contradicts.
4. Read the relevant primary material directly. A search snippet, a ranking, a
   generated summary, or a citation copied from another article is not evidence.
5. Compare claims in a matrix. Preserve conflicts, exceptions, uncertainty and
   applicability limits instead of averaging them into consensus.
6. Stop when the bounded completion test passes. Name what remains unknown.

## Return a candidate, not authority

Write into the owning record: the question and why it matters, a concise answer,
the claim-to-source matrix, conflicting evidence and limits, applicability to
this project, a recommendation and alternatives, the exact decision or
verification still required, and the next action.

An external primary source can authorize an external fact. It cannot authorize
the project's product intent, architecture choice, or implementation state.

If an owned research question answers nothing material, record that negative
result rather than manufacturing a recommendation.
