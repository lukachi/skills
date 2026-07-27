---
name: analyze-with-graphify
description: Navigate and analyze a codebase through Graphify before using text search. Use for code search, architecture questions, dependency tracing, debugging, impact analysis, implementation discovery, locating behavior, or any task that requires claims about how repository code works.
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
4. Use `graphify path "<source>" "<target>"` for a concrete dependency or flow.
5. Use `graphify explain "<node>"` to resolve the meaning and neighborhood of a specific node.
6. Inspect the source locations returned by Graphify.
7. Only then use `rg` or equivalent text search to verify exact tokens, literals, generated artifacts, or gaps not represented in the graph.
8. Record relevant queries, paths, and source locations in the active spec.

## Honesty

- Distinguish extracted edges from inferred or ambiguous edges.
- Do not turn a missing graph result into proof that code does not exist.
- State when the graph is stale and update it before relying on changed code.
- Do not substitute grep output for relationship analysis.
