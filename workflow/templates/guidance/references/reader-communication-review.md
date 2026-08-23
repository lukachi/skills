# Reader communication review

The second of the two axes, and it runs from its own evidence rather than from the
first axis's verdict. Review whether the intended reader can recover the correct
meaning without hidden context. Do not accept a document because its evidence is
strong.

`wfctl knowledge validate` catches code and identifiers in a product view and a
missing section. It cannot check whether a stakeholder can act on the answer.

## Product view

Evaluate as a product manager, client, maintainer, or domain expert:

- the purpose and the current behavior are clear before any history;
- canonical domain terms are defined and used consistently;
- actors, rules, outcomes, boundaries, exceptions, and delivery are visible;
- examples are recognizable domain scenarios rather than code or API examples;
- the main answer needs no engineering knowledge, and no technical detail leaked
  into it;
- planned, partial, absent, retired, and unknown behavior cannot be mistaken for
  available behavior;
- links offer optional depth and are not required to understand the answer;
- **replacing the implementation without changing behavior would not require
  rewriting this page.** A fluent page that describes the implementation's shape
  passes every other check here and fails this one.
- simplification did not erase a rule or an exception.

## Engineering view

Evaluate as an engineer or operator:

- product meaning is linked rather than re-invented;
- ownership, entrypoints, flow, contracts, state, failures, operations, and
  verification can all be located;
- terminology and boundaries are precise enough for maintenance;
- implementation detail is proportional to maintenance and verification needs;
- the evidence and the revision scope are clear.

## Decision, reference, and uncertainty views

- a decision explains the durable choice, its rationale, its consequences, what it
  affected, and its lineage, without ceremonial padding;
- a reference distinguishes an external fact from a project choice;
- an uncertainty states the live question, its impact, the known facts, and the
  authority or evidence it waits on.

Return `passed`, `failed`, `uncertain`, or `blocked` for each check. Name the
smallest wording or structural correction, and never silently change a fact.
