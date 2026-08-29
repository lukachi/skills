# Before you grep

Grep is the reflex and it is almost always the wrong first move. It answers
"where does this string appear" — a question you can only ask about names you
already thought of. It cannot tell you that the thing exists under a different
name, that it was decided against last month, or that four other files break
when you change it.

The lookup path answers those. It is not a gate and nothing refuses you for
skipping it; it is the order that finds things, and grep is the last step in it
rather than the first.

## The order

**1. Ask what has already been settled.** The knowledge repository is a
searchable collection, not a folder to walk.

```sh
qmd query "<the subject, in the project's own words>"    # hybrid, recommended
qmd get <path>                                           # read what it returned
```

`wfctl decided "<the subject>"` says what has already been settled about it and
where. `wfctl learned list` is what earlier work found out the hard way. Both
are cheap, and both hold things that make a search unnecessary.

**2. Find the canonical term before searching for it.** Your paraphrase is not
the project's word. If retrieval comes back thin, you are probably searching
with your own vocabulary — get the term from a curated page, then search again.

**3. Cross into the source by structure, not by string.**

```sh
wfctl repo list                # which checkouts have a graph, and how stale
graphify build                 # in the leaf, when it is missing or stale
```

Trace what reaches the thing and what the thing reaches. That is the question
whose answer you do not have. Grep cannot ask it.

**4. Open the source it returned.** The source at the recorded revision — not
the graph, not the page — is implementation authority. Retrieval and the graph
*locate*; neither establishes anything.

**5. Now grep.** For exact tokens, literals, generated artifacts, and the gaps
the graph does not represent. This is a real use and a good one. It is step five.

## Record the route as you go

```sh
wfctl recall answer <item> --answer "..." --route <qmd|graphify|grep|read|maintainer> --source "<where>"
wfctl recall route graphify --covered <path> --covered <path>
```

This is not bookkeeping for its own sake. What you recorded as covered is what
the write hook goes quiet about, so recording the traversal is what stops the
tool interrupting you on ground you actually read.

## Honesty about what came back

- A missing result is not proof the code does not exist. Say how many
  independent routes you tried before asserting absence.
- Distinguish extracted edges from inferred or ambiguous ones.
- A stale graph answers confidently about code that is gone, and nothing about
  its answer looks wrong. Rebuild before relying on it.
- Do not cite the generated graph as proof in curated knowledge. Cite pinned
  source locations reached through it.

## Prose is the other half

Markdown, curated knowledge, specifications and raw material are found with
retrieval over the collection plus direct reading — `qmd`, not the source graph.
The graph is for when the work crosses into a source repository. Reaching for
the graph on a prose question fails as reliably as grepping for a concept.
