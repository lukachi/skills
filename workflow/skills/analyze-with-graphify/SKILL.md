---
name: analyze-with-graphify
description: Navigate and analyze codebases or project knowledge corpora through Graphify before using text search. Use for code search, architecture questions, dependency tracing, debugging, impact analysis, implementation discovery, raw-record reconciliation, concept discovery, or any task requiring relationship claims about repository code or knowledge.
---

# Analyze with Graphify

Use the graph as the primary map and text search only as a precision follow-up.

## Procedure

1. Check that `graphify` is installed.
   - If unavailable, stop codebase analysis.
   - Tell the maintainer what is missing and offer the supported installation path.
2. Check for `graphify-out/graph.json`.
   - If present, query it immediately.
   - If absent, build the graph before making codebase claims.
3. Start with `graphify query "<question>"`.
4. For code, use `graphify path "<source>" "<target>"` for a concrete dependency or flow.
5. For project knowledge, trace relationships among raw records, curated concepts, decisions, repositories, and uncertainties.
6. Use `graphify explain "<node>"` to resolve the meaning and neighborhood of a specific node.
7. Inspect the source locations returned by Graphify.
8. Only then use `rg` or equivalent text search to verify exact tokens, literals, generated artifacts, or gaps not represented in the graph.
9. Record relevant queries, paths, and source locations in the active spec or curation record.

## Honesty

- Distinguish extracted edges from inferred or ambiguous edges.
- Do not turn a missing graph result into proof that code or knowledge does not exist.
- State when the graph is stale and update it before relying on changed sources.
- Do not substitute grep output for relationship analysis.
