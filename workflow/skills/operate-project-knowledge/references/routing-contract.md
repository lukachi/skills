# Knowledge-mode routing contract

## Default

Natural language is the interface. Select the least expensive mode that can
answer honestly. Do not ask the maintainer to name a skill or CLI command.

## Read-only automatic modes

These do not need confirmation:

- progressive product exploration;
- current decision-history tracing;
- read-only engineering explanation;
- ownership and navigation questions;
- structural knowledge-health diagnosis;
- reporting an intake or reconstruction frontier.

They may run retrieval, validation, graph navigation, and direct reads, but
must not create or change project truth.

## Deliberate modes

Start these only when the user explicitly asks for the outcome or accepts a
clear recommendation:

- process a raw batch;
- reconstruct or audit a project baseline;
- shape a broad project direction;
- conduct research that creates a durable project record;
- semantically curate or repair current knowledge.

Before proposing a deliberate mode, provide the useful answer already
available, state the gap it cannot resolve, explain the cost and output of the
mode, and recommend whether to proceed. Ask one focused question.

## Mandatory internal gates

Once a deliberate workflow is active, its evidence, QMD, Graphify, living
record, maintainer review, semantic verification, validation, and closure
gates are mandatory. They are not user-selectable modes and do not require the
maintainer to know their names.

## Collision rules

- “What does the project do?” means exploration, not reconstruction.
- “How is it implemented?” means read-only engineering explanation, not
  engineering curation.
- “This document is wrong; update it” means curation after authority checks.
- “Here is a raw idea” means intake or a lightweight handoff, never direct
  curation.
- “Let us brainstorm” stays conversational until a material direction must be
  retained. A broad consequential initiative may then be offered direction
  shaping.
- A code fix belongs to the owning leaf and its task workflow, not knowledge
  curation.
