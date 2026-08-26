# Fan-out

**Use when several units are genuinely independent and the work is bounded by
one context rather than by difficulty.**

One agent doing twelve independent things in sequence spends its context on
twelve sets of surroundings. Twelve agents doing one thing each spend twelve
contexts and return twelve results. The cost is coordination; the saving is that
none of them has to hold the others.

## The shape

- **The orchestrator owns integration.** Workers return work; the orchestrator
  inspects it, verifies it and commits it. A worker that commits on its own has
  taken authority nobody gave it.
- **A worker gets a packet, not a conversation** — the unit, the checkout, the
  conventions that apply, the definition of done. Not your reasoning: an agent
  shown a justification accepts it.
- **Isolate what would collide.** Independent units in one checkout race on the
  same files. Give each its own worktree, or serialise them.
- **The count comes from what returned**, never from what was launched.

## When not to

- The units share a seam that is still being designed. Fanning out fixes the
  seam by accident, twelve different ways.
- The work is small enough that coordination costs more than the sequence.
- Nobody has decided what "done" is for each unit. A worker cannot be told to
  find out.
