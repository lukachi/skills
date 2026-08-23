# Settling a direction by asking

Interview the maintainer until you reach a shared understanding. Map it as a
**design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose
prerequisites are already settled — the questions you can ask now without
guessing at answers you have not heard yet. Ask the whole frontier in one round,
numbered, each with your recommended answer. Then wait.

```
❓ **Q1** - **<question title>**: <question body, possibly several paragraphs, including the options>

➡️ <your recommended answer>
```

A numbered frontier round is the shape that carries several questions well. The
failure it is often mistaken for is a prose message with asks buried in it, which
reads as a status report and gets answered as none of them. Keep the format: one
numbered question per decision, each with its recommendation, and nothing else in
the message.

Each round of answers reshapes the tree: settled decisions push the frontier
outward and unblock questions that depended on them. Recompute and ask the next
round. A question whose answer depends on another still open in this round
belongs to a later round.

## Finding facts is your job

Never spend a round on something you could look up. Before a question reaches the
frontier, check in this order:

1. Whether they have already answered it — their own words, with a date. Most
   answers are in a work record rather than on a curated page, so a knowledge
   search alone reads like a question nobody has answered.
2. Curated knowledge, and the source graph, for anything about what the project
   already does.
3. A subagent, for a fact that needs reading you have not done.

Do not block on a running exploration: it is an unsettled prerequisite, so only
the questions downstream of it wait. Ask the rest of the frontier now.

The decisions are theirs. Put each to them and wait.

## Persist each round before the next

A round of answers that lives only in the session is lost to compaction, and
asking again spends their turn on your bookkeeping. After every round, before
asking the next: append each answer to the owning record with their wording,
update the affected state and open questions, and checkpoint last.

## Done

Done is when the frontier is empty: every branch visited, nothing left silently
assumed. Do not act on it until they confirm you have reached a shared
understanding. That confirmation is what releases the writing.
