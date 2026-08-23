# Prototyping a decision

A prototype is **throwaway code that answers a question**. The question decides
the shape.

- *"Does this logic or state model feel right?"* → [the logic branch](../references/logic.md).
  A tiny interactive app that pushes the state machine through cases that are
  hard to reason about on paper.
- *"What should this look like?"* → [the UI branch](../references/ui.md). Several
  radically different variations on one route, switchable from a floating bar.

The two produce very different artifacts, and getting this wrong wastes the whole
prototype. Where it is genuinely ambiguous and the maintainer is not reachable,
default to whichever branch matches the surrounding code and state the assumption
at the top.

## Rules for both

1. **Throwaway from day one, and clearly marked.** Locate it close to where it
   would actually be used so the context is obvious, and name it so a casual
   reader sees it is a prototype.
2. **One command to run.** They must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing
   the prototype is *checking*, not something it should depend on.
4. **Skip the polish.** No tests, no error handling beyond what makes it
   runnable, no abstractions. The point is to learn something fast.
5. **Surface the state.** After every action, show the full relevant state so
   they can see what changed.
6. **Hand it over and let them drive.** The interesting moments are "wait, that
   should not be possible" and "I assumed that would be different" — those are
   the bugs in the *idea*, which is the whole point.

## Where the answer lands

The prototype is throwaway; what it settled is not. The verdict goes into the
record that owns the question. The validated decision folds into the real code
through the ordinary route, never by promoting prototype code. The prototype
itself is a primary source: commit it to a throwaway branch out of the main line
and link it as an artifact.

Where it produced a schema, state machine or type shape that encodes a decision
more precisely than prose can, the framing may inline the decision-rich part and
say it came from a prototype. Trim it — a working demo is not a contract.
