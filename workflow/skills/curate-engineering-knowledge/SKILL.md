---
name: curate-engineering-knowledge
description: Author or materially update engineering-facing current knowledge from verified implementation and reviewed product authority. Use when a completed change, source-first reconstruction, or explicit implementation-drift repair is ready to record architecture, repository ownership, contracts, data or control flow, runtime behavior, operations, or technical constraints. Do not use merely because an engineer asks how existing code works; answer that read-only question through knowledge navigation and Graphify. Keep product meaning in linked product documents and never infer intended behavior from code alone.
---

# Curate Engineering Knowledge

Write the technical realization of current project truth without duplicating or
silently redefining product meaning.

`wfctl knowledge validate` refuses the structural failures, including an
engineering view that claims product authority rather than linking it. Read
[the engineering writing contract](references/engineering-writing-contract.md) for
the separation rules it cannot check. Use
[the engineering concept template](assets/engineering-concept.md) for a new
document.

## Establish the implementation

1. Identify the owning Area, its product concepts, the repository, and the exact
   clean source revision.
2. Invoke `analyze-with-graphify` for navigation and relationship coverage.
3. Directly inspect source, tests, contracts, configuration, and runtime evidence
   at the pinned revision.
4. Distinguish implemented behavior, architectural rationale, ownership, contract,
   policy, history, and external claims, and apply the authority each class
   requires.
5. Treat code as implementation authority only. Link accepted product meaning;
   never derive it from code.

## Author the engineering view

1. Name exact code surfaces only where they help maintenance or verification, and
   pin a material claim to its repository, commit, path, and optional symbol.
   Detail beyond that goes stale faster than anyone updates it.
2. Record partial, absent, accidental, retired, unknown, or drifted delivery
   honestly. **Do not repair intent by rewriting it to match the code** — that
   erases the only record of what the project meant, which is the thing that made
   the gap visible.
3. Keep the product explanation in the product document and describe only the
   technical consequence here.

An engineering page reaches `knowledge/` by whichever route produced it, and the
gate differs per route:
[the knowledge model](../curate-project-knowledge/references/knowledge-model.md)
carries the four and what each one waits on.

## Verify before stable

1. Invoke `verify-knowledge-quality` once the body and its evidence are complete,
   and resolve gaps in source coverage, product linkage, failure behavior, and any
   claim that exceeds its evidence.
2. Run `wfctl knowledge hash --concept <path>` and bind the quality receipt and the
   verification event to that one hash.
3. Run `wfctl knowledge validate`, `wfctl knowledge build`, and `qmd update`. Do
   not report completion while any gate fails.
