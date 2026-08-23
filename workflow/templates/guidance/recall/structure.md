# Searching by structure

Before locating, reading, explaining, planning, changing, debugging, reviewing,
or verifying code — and before tracing callers, dependencies, data or control
flow, or estimating impact — go through the graph first.

This is not about tool preference. Grep answers "where does this string appear",
which is a question you can only ask about names you already thought of. The
graph answers "what reaches this, and what does this reach", which is the
question whose answer you do not have.

## Order

1. Query the existing graph, or build it when it is missing or stale.
2. Trace the relationships before drawing any conclusion.
3. Open and inspect the actual source at the locations it returned. **The source
   at the recorded revision, not the graph, is implementation authority.**
4. Only then use text search, for exact tokens, literals, generated artifacts,
   or gaps the graph does not represent.

## Honesty

- Distinguish extracted edges from inferred or ambiguous ones.
- A missing graph result is not proof that code does not exist.
- Say when the graph is stale, and update it before relying on changed sources.
- Do not substitute text-search output for relationship analysis.
- Do not cite the generated graph as proof in curated knowledge. Cite pinned
  source locations and fresh checks reached through it.

## Not for prose

Markdown, curated knowledge, specifications and raw material use retrieval over
the document collection plus direct reading, not the source graph. Use the graph
when the work crosses into a source repository.
