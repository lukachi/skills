# <Area name>

## Purpose

Explain what recognizable responsibility or functionality this Area provides
and why it exists.

## Scope and boundaries

State what belongs here, what does not, and which neighboring Areas interact
with it.

## Current model

Summarize the current human-facing behavior and language. Link detailed
concepts and rules instead of flattening them here.

## Capabilities

- Link each file under `capabilities/` and state the outcome it provides. Each
  capability links its related use cases, rules, implementation, and current
  decisions; those artifacts remain in their own sibling collections.

## Use cases and flows

- Link Area-local use cases from `use-cases/`.
- Link genuinely cross-Area flows from `knowledge/product/flows/`.

## Technical realization

- Link Area-owned implementation from `implementation/`. Link system-wide
  architecture from `knowledge/architecture/`, plus repository ownership,
  contracts, and pinned code evidence.

## Decisions

- Link Area-owned current decisions from `decisions/`. Use root
  `knowledge/decisions/` only for genuinely cross-Area decisions.
- Link the current stable decision for each active lineage.
- Link deprecated predecessors only through the current decision or Evolution.

## Evolution

Summarize meaningful changes with enough context to understand what changed,
why, and what it affected. Link full immutable decision records and the local
`log.md`; do not reduce evolution to bare `A supersedes B` links.

## Open questions

- Link trusted current uncertainties. Raw candidates do not belong here.
