# Where drafts go

Inside the bundle's own `promotion/` directory, at the path the page will occupy
in curated knowledge.

You do not type that path. Ask the tool for the draft and it creates the file
and prints where it is. A path assembled from memory is assembled wrong, and the
pages that ended up elsewhere could not be promoted at all.

## Which road the page is on

Curated knowledge runs two roads over the same project, and every page declares
which one it is on. Neither is derived from the other and neither is
subordinate.

| `view:` | Explains | To |
| --- | --- | --- |
| `product` | current behaviour, audience, capabilities, rules, exceptions, delivery, evolution | a client or a product manager, without source knowledge |
| `engineering` | implementation, ownership, source boundaries, contracts, failures, operations, verification | an engineer, linking established product meaning rather than redefining it |
| `decision` | why a hard-to-reverse choice was made, in the maintainer's words, dated | both roads — a decision is not on a road, it is the history they share |

A product page carrying a code block or a source path is refused, because a
product page explaining implementation has stopped being the product road. That
is the one abstraction failure a check can see; the rest is yours.

Write the road's contract before the page, not after:

    wfctl guide curate-product        what belongs on the product road
    wfctl guide curate-engineering    what belongs on the engineering road
