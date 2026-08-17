---
name: grill-project-decisions
description: Grill the maintainer relentlessly about a plan, decision, or direction until you reach a shared understanding. Use when the maintainer asks to be grilled or uses any 'grill' trigger phrase, when a shaping or specification session needs the decisions behind it settled, or when another skill needs the maintainer's own answers before it may write anything.
---

# Grill Project Decisions

Interview the maintainer relentlessly until you reach a shared understanding. Map
this as a **design tree**: every decision branches into the decisions that hang
off it.

Work the tree in **rounds**. The **frontier** is every decision whose
prerequisites are already settled: the questions you can ask _now_ without
guessing at answers you have not heard yet. Ask the whole frontier in one round:
number each question and give your recommended answer. Then wait for the
maintainer's answers before the next round.

Each question is formatted like so:

```
❓ **Q1** - **<question title>**: <question body, possibly several paragraphs, including the options>

➡️ <your recommended answer>
```

A numbered frontier round is the shape that carries several questions well. The
failure it is often mistaken for is a prose message with asks buried in it,
which reads as a status report and gets answered as none of them. Keep the
format: one numbered question per decision, each with its recommendation, and
nothing else in the message.

Every question is read by someone who was not watching, so the reader test in
`maintainer-review` governs each one: they should not have to look anything up to
answer it. Name the thing in the product's own language and put the identifier
after it, if at all.

Each round of answers reshapes the tree: settled decisions push the frontier
outward and unblock questions that depended on them. Recompute the frontier and
ask the next round. A question whose answer depends on another question still
open in this round belongs to a _later_ round, not this one.

## Finding facts is your job

Never spend a round on something you could look up. Before a question reaches the
frontier, check in this order:

1. `wfctl knowledge decided "<subject>"` — they may have answered it already, and
   it reports the date and their own words. Most answers are not on a curated
   page, so a knowledge search alone reads like a question nobody has answered.
2. Curated knowledge through QMD, and source through `analyze-with-graphify`,
   for anything about what the project already does.
3. A subagent, for a fact that needs reading you have not done.

Do not block on a running exploration: it is an unsettled prerequisite, so only
the questions downstream of it wait. Ask the rest of the frontier now.

The _decisions_ are the maintainer's. Put each to them and wait.

## Persist each round before the next

A round of answers that lives only in the session is lost to compaction, and
asking again spends their turn on your bookkeeping. After every round, before
asking the next:

- append each answer to the owning record's decision ledger, with their wording;
- update the affected current state, scope, and open questions;
- run `wfctl work checkpoint <id>` last, so its hash binds what you just wrote.

## Done

The session is done when the frontier is empty: every branch of the design tree
visited, nothing left silently assumed.

Do not act on it until the maintainer confirms you have reached a shared
understanding. Their confirmation is what releases the work — record it, and
where a bundle owns this grilling, it is the answer the framing gate is waiting
for.
