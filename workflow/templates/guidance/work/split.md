# The units

Break the work into **tracer bullet** slices.

- Each slice cuts a narrow but COMPLETE path through every layer it needs —
  vertical, never a horizontal slice of one layer.
- A completed slice is demonstrable or verifiable on its own.
- Prefactoring goes first, as its own unit: make the change easy, then make the
  easy change.

**Size by scope and coherence.** Not by what fits in one agent session — that
framing taught agents to stop halfway through a context that was still wide
open, and they did.

There are no blocking edges to declare and no frontier to respect. A map that
came out of grilling can be worked efficiently in an order no dependency graph
would predict, and enforcing one restrains you for nothing. Where order genuinely
matters, say so in the unit's notes, which is also where everything else you
learn about it goes.

## Wide refactors are the exception to vertical slicing

A wide refactor is one mechanical change — rename a column, retype a shared
symbol — whose **blast radius** fans across the whole codebase, so a single edit
breaks thousands of call sites at once and no vertical slice can land green.

Sequence it as **expand–contract** instead. First expand: add the new form
beside the old so nothing breaks. Then migrate the call sites in batches sized by
blast radius — per package, per directory — each batch its own unit, keeping
checks green batch to batch because the old form still exists. Finally contract:
delete the old form once no caller remains.

## Put the breakdown to the maintainer

A breakdown is a graph, so draw it rather than describing it — a tree with each
node named by what it delivers. For each unit show its title, what it delivers,
and anything that genuinely has to come first.

Then ask, as one numbered round with your own answer on each rather than three
turns:

- Does the granularity feel right — too coarse, too fine?
- Should any units be merged, or split further?
- Is anything sequenced that does not need to be?

## What each unit carries

- **Outcome** — the end-to-end behaviour this unit makes work, from the
  perspective of the person the product serves, rather than a layer-by-layer
  implementation list.
- **Acceptance contribution** — how it contributes to the criteria it serves.
- **Constraints and boundaries** — the relevant curated knowledge, approved
  decisions, repository scope, and explicit exclusions, linked rather than
  copied.

Keep specific file paths and code snippets out of a unit; they go stale fast.
One exception: where a prototype produced a schema, state machine, or type shape
that encodes a decision more precisely than prose can, inline the decision-rich
part and say it came from a prototype.

## Bad splits

- One unit per technical layer.
- One giant unit that silently relies on conversation memory.
- Sequencing used as a preference rather than a real constraint.
- Acceptance text duplicated from the parent and allowed to drift.
- Source paths or snippets treated as permanent requirements.
- A leaf-local checklist competing with the central record.
