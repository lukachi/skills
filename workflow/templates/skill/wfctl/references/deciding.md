# Settling a direction with the maintainer

Everything else in this workflow pulls toward acting alone. That pull is correct
on accepted work and wrong here.

Map the open decisions as a **design tree**: every decision branches into the
decisions that hang off it. The **frontier** is every decision whose
prerequisites are already settled — the questions you can ask now without
guessing at answers you have not heard.

**Ask the whole frontier in one numbered round**, each question with your
recommended answer:

```
❓ **Q1** - **<question title>**: <the question, with its options>

➡️ <your recommended answer>
```

A round they can answer in one sitting is what a relentless interview looks like
from their side. One question per turn is not thoroughness — it is a queue. And
a prose message with asks buried in it reads as a status report and gets
answered as none of them.

Each round of answers reshapes the tree. Recompute the frontier and ask the
next. A question whose answer depends on another still open belongs to a later
round.

## Finding facts is your job

Never spend a round on something you could look up. Before a question reaches
the frontier:

1. Has the maintainer already answered it? Their own words, with a date. Most
   answers sit in a work record rather than on a curated page, so a knowledge
   search alone reads like a question nobody has answered.
2. Curated knowledge, and the source graph, for anything about what the project
   already does.
3. A subagent, for a fact that needs reading you have not done.

Do not block on a running exploration — only the questions downstream of it
wait. Ask the rest of the frontier now.

## Persist each round before the next

A round of answers that lives only in the session is lost to compaction, and
asking again spends their turn on your bookkeeping. Append each answer to the
owning record with their wording, update the affected state, checkpoint last.

## Done

Done is when the frontier is empty: every branch visited, nothing left silently
assumed. Do not act on it until they confirm you have reached a shared
understanding.

## Sharpening the language while you go

When a term conflicts with what the project already says, call it out
immediately. When a term is vague or overloaded, propose a precise canonical one
— "you are saying account: do you mean the customer or the person signing in?"
Stress-test relationships with concrete edge cases. Where the code contradicts
what they just said, surface it.

Record each term as it resolves, not in a batch at the end — batching loses the
ones the session ends on. For each: the canonical form, a one-sentence
definition of what it *is*, its contextual boundary, accepted aliases, and the
names to avoid.

## When a decision earns a page of its own

Only when all three hold: hard to reverse, surprising without context, and the
result of a real trade-off. With any missing, it belongs in the owning record's
ledger.

## When the route itself is unknown

A destination you can name with no visible way to it is a **map**, not a
framing. Planning only: product source stays untouched for the whole of it. Use
`wfctl guide wayfind`.
