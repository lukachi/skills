# Direction-shaping contract

## Purpose

Direction shaping reduces strategic uncertainty. It does not produce an
implementation plan by pretending that every question is already answered.

## Entry test

Use this mode only when all are true:

- the initiative can materially change product meaning, architecture,
  ownership, or several Areas;
- multiple dependent decisions remain unresolved;
- ordinary task framing would require guesses about those decisions;
- the maintainer explicitly selected or accepted this mode.

A bounded feature, fix, migration, audit, or refactor belongs to the normal
significant-work flow. An ordinary idea conversation stays conversational
until a material direction or decision must be retained.

## Resolution levels

Move from low to high resolution:

1. **Destination:** the outcome, actors, affected Areas, constraints, and
   non-goals.
2. **Shape:** capabilities, flows, ownership boundaries, and major tradeoffs.
3. **Decisions:** accepted choices and their consequences.
4. **Execution frontier:** the next bounded change that can be specified and
   verified.

Do not design low-level implementation while the destination or shape remains
contested.

## Frontier discipline

The frontier contains only questions whose answers can change scope, product
meaning, architecture, ownership, or the next safe action. Rank it by leverage
and dependency. Ask one question at a time and record the answer before moving
on.

`Uncertainty and fog` is broader. It may contain facts to research,
contradictions, risks, and deferred concerns. Every item states its impact and
what evidence or authority would resolve it.

## Canonical language

Treat terminology as a design surface:

- reuse an accepted term when it already has the intended meaning;
- define a new term before using it as a boundary;
- record aliases, overloaded terms, and discouraged names;
- keep proposed vocabulary in the active spec;
- promote vocabulary into the owning Area concept only after approval and
  semantic verification.

## Completion test

Direction shaping is ready to hand over only when:

- the destination and non-goals are explicit;
- every frontier item is resolved, deferred with an owner/reason, or blocked
  with a named requirement;
- accepted terms and decisions are distinguishable from proposals;
- the next bounded change can be framed without guessing;
- the maintainer reviewed the direction.

The same canonical spec continues into normal project work. There is no
separate strategy artifact to synchronize.
