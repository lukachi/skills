---
name: shape-project-direction
description: Turn a broad, consequential, and still-uncertain product or architecture initiative into a durable direction inside the canonical workflow change record. Use when several Areas or systems may be affected, the destination is clearer than the route, important choices depend on one another, or ordinary task planning would pretend that unresolved product or architecture questions are settled. Use only after the maintainer explicitly asks to shape the direction or accepts the agent's recommendation. Do not use for routine brainstorming, a bounded implementation task, current-project explanation, or direct code changes.
---

# Shape Project Direction

Resolve the decisions that define a large initiative before implementation
planning becomes falsely precise. Use the normal workflow record as the only
durable state; never create a parallel strategy document.

Read [the direction-shaping contract](references/direction-shaping-contract.md)
before starting or resuming this mode.

## Enter deliberately

1. Confirm that the request is broad, consequential, and genuinely
   under-specified. A large but already bounded task belongs to
   `manage-project-work`.
2. If the maintainer did not explicitly request direction shaping, explain the
   uncertainty, recommend this mode, and wait for agreement before creating
   records.
3. Resolve the knowledge root. Reuse the active canonical change record when
   one already owns the initiative. Otherwise run `wfctl work start <slug>
   --title "<initiative>" --mode full` from knowledge for project-only
   shaping. Bind leaves only when their exact implementation scope is already
   known.
4. Run `wfctl work status <id>`. Record the returned knowledge root, code
   roots, and spec path. Do not edit product source while direction shaping is
   active.

## Build the direction map

Maintain these sections in the canonical spec:

- `Direction map`: destination, current landscape, affected Areas, actors,
  capabilities, constraints, success signals, and explicit non-goals;
- `Domain language`: proposed canonical terms, definitions, aliases to avoid,
  conflicts with existing knowledge, and resolution state;
- `Decision frontier`: the few unresolved decisions that materially change
  the destination or viable routes;
- `Uncertainty and fog`: unknown facts, missing authority, dependencies,
  contradictions, risks, and what would resolve each;
- `Discussion and decision ledger`: append-only proposed, approved, rejected,
  deferred, and superseded outcomes;
- `Handoff`: exact next question or action.

Use QMD and current knowledge to discover existing language, decisions, and
constraints. When source reality matters, invoke `analyze-with-graphify` in
the exact relevant leaf and inspect the source directly. Find discoverable
facts yourself instead of asking the maintainer to recall them.

## Resolve one decision at a time

1. Select the highest-leverage unresolved item from `Decision frontier`.
2. Present one focused question with:
   - why it matters now;
   - verified facts and conflicts;
   - viable choices and tradeoffs;
   - a recommendation.
3. Ask only that question. Do not send an interview checklist.
4. Immediately update the spec after the maintainer's answer: current state,
   terminology, frontier, fog, ledger, exclusions, and handoff.
5. Challenge contradictions and vague terms respectfully. Do not manufacture
   agreement or treat a proposal as approved.
6. Repeat until the frontier is resolved, deliberately deferred, or honestly
   blocked.

## Exit without duplicating state

1. Present a compact direction review: destination, boundaries, canonical
   language, accepted decisions, tradeoffs, deferred questions, risks, and
   recommended next unit of work.
2. Record explicit maintainer approval in the existing spec. Do not ask for a
   decision already stated explicitly.
3. If implementation follows, invoke `manage-project-work` and refine the same
   canonical living spec into scope, acceptance criteria, plan, code bindings,
   and verification. Never copy the direction into a second spec.
4. If the direction itself changes durable project knowledge, route only the
   approved result through `curate-project-knowledge`. Proposed and deferred
   material remains in the change record.
5. If work stops, keep the honest shaping status and a resumable handoff. Do
   not call an unresolved map complete.
