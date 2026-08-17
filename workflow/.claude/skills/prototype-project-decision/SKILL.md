---
name: prototype-project-decision
description: Build a throwaway prototype to answer a design question. Use when the maintainer wants to sanity-check whether a state model or logic feels right, explore what a screen should look like, or when a Wayfinder prototype issue needs a cheap artifact to react to.
---

# Prototype Project Decision

A prototype is **throwaway code that answers a question**. The question decides
the shape.

## Pick a branch

Identify which question is being answered — from the maintainer's prompt, the
surrounding code, or by asking if they are around:

- **"Does this logic or state model feel right?"** → [the logic
  branch](references/logic.md). Build a tiny interactive app that pushes the state
  machine through cases that are hard to reason about on paper.
- **"What should this look like?"** → [the UI branch](references/ui.md). Generate
  several radically different variations on a single route, switchable from a
  floating bar.

The two branches produce very different artifacts, and getting this wrong wastes
the whole prototype. Where the question is genuinely ambiguous and the maintainer
is not reachable, default to whichever branch better matches the surrounding code —
a backend module means logic, a page or component means UI — and state the
assumption at the top of the prototype.

## Rules that apply to both

1. **Throwaway from day one, and clearly marked.** Locate the prototype close to
   where it will actually be used so the context is obvious, and name it so a
   casual reader sees it is a prototype rather than production. For a throwaway
   route, obey whatever routing convention the project already uses.
2. **One command to run.** Whatever the project's existing task runner supports.
   The maintainer must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing
   the prototype is _checking_, not something it should depend on. Where the
   question genuinely involves a database, hit a scratch one with a name that says
   it is a prototype and can be wiped.
4. **Skip the polish.** No tests, no error handling beyond what makes it runnable,
   no abstractions. The point is to learn something fast.
5. **Surface the state.** After every action, or on every variant switch, show the
   full relevant state so the maintainer can see what changed.
6. **Hand it over and let them drive.** The interesting moments are when they say
   "wait, that should not be possible" or "I assumed that would be different" —
   those are the bugs in the _idea_, which is the whole point. Where they want new
   actions, add them. Prototypes evolve.

## Where the answer and the artifact land

The prototype is throwaway; what it settled is not.

- **The answer** — the verdict and the question it settled — goes into the record
  that owns the question. For a Wayfinder prototype issue, that is the issue's
  resolution through `wfctl work issue complete`. Otherwise it is the owning
  bundle's decision ledger, and the checkpoint refreshed after.
- **The validated decision** folds into the real code, through the ordinary
  delivery route rather than by promoting prototype code.
- **The prototype itself** is a primary source: commit it to a throwaway branch out
  of the main line, and link that branch from the record as a bundle artifact. The
  main line keeps only the validated decision.

Where a prototype produced a schema, state machine, or type shape that encodes a
decision more precisely than prose can, the specification may inline the
decision-rich part and say it came from a prototype. Trim it to the important bits;
a working demo is not a contract.
