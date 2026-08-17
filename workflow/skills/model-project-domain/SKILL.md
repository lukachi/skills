---
name: model-project-domain
description: Build and sharpen the project's domain language as you design. Use when a term is fuzzy or overloaded, when the maintainer's wording conflicts with what curated knowledge already says, when a durable decision crystallises during a session, or when another skill needs the domain model maintained while it works.
---

# Model Project Domain

Actively build and sharpen the project's domain language as you design. This is
the _active_ discipline — challenging terms, inventing edge-case scenarios, and
writing the language and the decisions down the moment they crystallise. Merely
reading curated knowledge for vocabulary is not this skill; that is a habit any
skill has. This is for when you are changing the model.

## Where the model lives

| While it is unsettled | Once the maintainer has settled it |
| --- | --- |
| The owning bundle's `Domain language` section | A Domain Concept page, through `curate-product-knowledge` |
| The bundle's decision ledger | A decision page, through `curate-project-knowledge` |

Write into the bundle the moment a term resolves. The curated page comes later,
through the promotion gate, and never during the session.

## During the session

**Challenge against what the project already says.** When the maintainer uses a
term that conflicts with curated knowledge or the bundle's own glossary, call it
out immediately. "The project defines cancellation as X, and you seem to mean Y —
which is it?"

**Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise
canonical term. "You are saying account — do you mean the customer or the person
signing in? Those are different things."

**Discuss concrete scenarios.** When domain relationships are being discussed,
stress-test them with specific scenarios. Invent cases that probe the edges and
force precision about where one concept stops and the next begins.

**Cross-reference with the source.** When the maintainer states how something
works, check whether the code agrees — through `analyze-with-graphify`, then the
actual source. Where it contradicts them, surface it: "The code cancels the whole
order, and you just said part of one can be cancelled — which is right?"

**Record each term as it resolves.** Update the bundle's `Domain language`
section right there, and refresh the checkpoint after. Batching them loses the
ones the session ends on. For each term record the canonical form, a one or two
sentence definition of what it _is_, its contextual boundary, the accepted
aliases, and the names to avoid. Be opinionated: where several words exist for
one concept, pick one and list the rest as names to avoid.

Keep it a glossary. Implementation detail, scope, and plans belong to the
sections that own them.

Only terms this project owns belong here. Timeouts, error types, and general
programming vocabulary do not, however much the project uses them. Before adding
a term, ask whether it is specific to this domain.

**Offer a decision record sparingly.** Only when all three hold:

1. **Hard to reverse** — changing your mind later carries a real cost.
2. **Surprising without context** — a later reader will look at this and wonder
   why on earth it was done this way.
3. **The result of a real trade-off** — there were genuine alternatives and one
   was chosen for specific reasons.

With any of the three missing, the choice belongs in the owning record's ledger
rather than a page of its own. What qualifies: architectural shape, integration
patterns between parts of the system, technology choices carrying lock-in,
ownership and scope boundaries, deliberate deviations from the obvious path,
constraints invisible in the code, and a rejected alternative whose rejection is
non-obvious.
