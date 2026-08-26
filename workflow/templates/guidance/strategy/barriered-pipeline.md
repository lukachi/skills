# Barriered pipeline

**Use when the work is large enough that finishing it is not the same as doing
it well** — a corpus, a migration, a hundred of something.

A long list of units is an invitation to tick boxes. The agent optimises for
completion because completion is the only thing being counted, and quality has
no counter at all. More planning does not fix this; it makes the list longer.

What fixes it is a **barrier**: a boundary partway through where the work stops
and something independent looks before the next stretch begins.

## The shape

Split the work into two or three stretches, not into every unit up front. At the
end of each stretch:

1. **Stop.** Take nothing else on.
2. **Look, independently.** A separate agent reads what the stretch produced
   against what the stretch was for — not your account of it.
3. **Write what the look found**, including what it could not check.
4. **Decide** from that: continue, correct, or change the shape of what remains.

The barrier's output is an artifact. Register it (`wfctl artifact add`) so the
next stretch reads it rather than rediscovering it.

## What makes a barrier real

- **It is not a milestone.** A milestone is a date you pass. A barrier is a
  place where something can come back and say no.
- **The reviewer is not you.** You cannot see the thing you were not looking
  for.
- **It carries what it could not check.** A barrier that reports only findings
  reads like a clean bill of health.

## Measured

One run built a hundred-item corpus across three stretches with two barriers of
557 and 680 lines between them. Its progress record put the evidence for each
claim in the same row as the claim, and derived its count from completed reports
compared against the source list rather than from tasks launched — because tasks
launched is what an agent counts when it is counting itself.
