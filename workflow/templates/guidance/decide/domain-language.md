# Sharpening the language while you design

This is the active discipline — challenging terms, inventing edge-case
scenarios, and writing the language down the moment it crystallises. Reading
curated knowledge for vocabulary is a habit any work has; this is for when you
are changing the model.

While a term is unsettled it lives in the work record. Once the maintainer has
settled it, it becomes a domain concept page through the ordinary promotion
route, never during the session.

**Challenge against what the project already says.** When a term conflicts with
curated knowledge or the record's own glossary, call it out immediately. "The
project defines cancellation as X, and you seem to mean Y — which is it?"

**Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise
canonical term. "You are saying account — do you mean the customer or the person
signing in? Those are different things."

**Stress-test with concrete scenarios.** Invent cases that probe the edges and
force precision about where one concept stops and the next begins.

**Cross-reference with the source.** When they state how something works, check
whether the code agrees. Where it contradicts them, surface it.

**Record each term as it resolves**, right there, and checkpoint after. Batching
loses the ones the session ends on. For each: the canonical form, a one or two
sentence definition of what it *is*, its contextual boundary, the accepted
aliases, and the names to avoid. Be opinionated — where several words exist for
one concept, pick one and list the rest as names to avoid.

Keep it a glossary. Only terms this project owns belong here; timeouts, error
types and general programming vocabulary do not, however much the project uses
them.

## When a decision earns its own page

Only when all three hold:

1. **Hard to reverse** — changing your mind later carries a real cost.
2. **Surprising without context** — a later reader will wonder why on earth it
   was done this way.
3. **The result of a real trade-off** — there were genuine alternatives and one
   was chosen for specific reasons.

With any of the three missing, the choice belongs in the owning record's ledger.
What qualifies: architectural shape, integration patterns, technology choices
carrying lock-in, ownership and scope boundaries, deliberate deviations from the
obvious path, constraints invisible in the code, and a rejected alternative whose
rejection is non-obvious.
