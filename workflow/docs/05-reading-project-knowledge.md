# 05 — Read project knowledge

## Use this when

Use this guide when browsing the knowledge repository yourself or deciding
which explanation to request from the agent.

## Problem

Even accurate documentation becomes a dump when product behavior,
implementation details, and chronological decisions are flattened into one
list.

## Outcome

You can move from project purpose to one functional Area, then follow either
the maintainer/product road or the engineering road. Shared decision history
explains how either road reached its current state.

## Start at the human road

Browse in this order:

```text
knowledge/index.md
→ knowledge/areas/
→ knowledge/areas/<area>/index.md
```

An **Area** is one durable product or functional responsibility, such as
identity, billing, combat, economy, or deployment. Most knowledge has one
primary Area owner.

An Area index is a map, not a full specification. It introduces the
responsibility and links the capabilities, rules, implementation, current
decisions, and evolution that matter.

## Choose a road

### Maintainer/product road

Read capabilities, use cases, domain concepts, rules, and product flows when
you need to understand:

- what the product provides and for whom;
- current behavior, rules, and exceptions;
- accepted intent and observed delivery;
- useful examples and meaningful evolution.

This view is written for maintainers, product managers, clients, and domain
experts. It contains no code walkthroughs, source paths, endpoints, schemas, or
implementation identifiers.

### Engineering road

Read implementation, architecture, repositories, contracts, runtime, and
operations when you need to change, verify, or operate the software.

Engineering pages establish product meaning first, then explain source
ownership, data or control flow, failures, operations, and exact evidence. Code
may prove delivery; it does not prove intended product behavior.

Neither road is generated from or subordinate to the other. Product meaning
does not have to be reverse-engineered from code, and engineering reality is
not hidden behind a simplified product summary. Both link the same Areas,
capabilities, changes, and decision lineages.

## Inside one Area

```text
knowledge/areas/<area>/
├── index.md
├── capabilities/
├── use-cases/
├── concepts/
├── rules/
├── implementation/
├── decisions/
└── log.md
```

These directories are siblings. A decision or implementation page is not
normally buried inside a capability. The Area index and concept pages link the
related views.

For example:

```text
knowledge/areas/combat/
├── index.md
├── capabilities/revival.md
├── use-cases/revive-character.md
├── concepts/death-state.md
├── rules/revival-eligibility.md
├── implementation/revival-runtime.md
├── decisions/require-revival-item.md
└── log.md
```

To understand revival as a stakeholder, read the Area index, capability, and
relevant rule. Open implementation only when you need engineering detail. Open
the current decision and its predecessors when you need rationale and history.

## Follow change over time

Decision history connects both roads. Read it when you need to know why current
product behavior or engineering realization exists, which tradeoff was
resolved, or what replaced an earlier rule.

The Area index links the current stable decision in each active lineage. The
current decision links its deprecated predecessors. The Area's `Evolution`
section explains meaningful changes in plain language, and `log.md` provides
local chronology.

Old decisions are preserved rather than silently rewritten. Whole Areas are not
cloned into version folders for each change.

Only durable, hard-to-reverse, surprising, or genuinely contested choices need
standalone decision records. Routine choices stay with the owning concept and
Area evolution.

## Material outside an Area

Use project-level collections only when no Area is the honest primary owner:

- `vision/` for purpose, outcomes, principles, and non-goals;
- `product/flows/` for genuinely cross-Area journeys;
- `architecture/` for system-wide boundaries;
- `decisions/` for project-wide choices;
- `repositories/` for ownership and integration;
- `uncertainties/` for trusted open questions;
- `references/` for primary external sources.

If one Area is primary, keep the document there and link it from the others.

## Ask instead of browsing

You can always ask:

> Help me understand this project and what it can do today.

The agent first shows a compact product map, then offers concrete directions.
Choose one naturally; you do not need to know the taxonomy in advance.

## Next

Continue with [06 — Adopt an existing project](06-existing-project.md).
