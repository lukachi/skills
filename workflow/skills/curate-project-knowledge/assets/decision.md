---
type: Decision
title: "<decision title>"
description: "<current decision in one sentence>"
status: draft
decision_id: "<stable-lowercase-id>"
effective_at: "<ISO-8601>"
area: "<primary-area>"
capabilities: []
authority:
  - decision
generated:
  by: "<producer>/<version>"
  at: "<ISO-8601>"
verified: []
supersedes: []
superseded_by: ""
sources:
  - id: "<maintainer-decision-id>"
    kind: maintainer-decision
    resource: "project-change:<change-id>#decision"
    title: "<reviewed decision>"
    author: "human:<reviewer-id>"
---

# Context and problem

Explain the situation and the problem that required a decision.[^maintainer-decision-id]

# Decision

State the exact decision and its boundaries.

# Rationale

Explain why this option was chosen.

# Alternatives

List material alternatives and why they were not selected.

# Consequences and tradeoffs

State benefits, costs, risks, constraints, and accepted tradeoffs.

# Affected Areas and capabilities

Link every materially affected Area, capability, use case, rule, or contract.

# Transition and migration

Explain how the project moves from the predecessor state, or state `None`.

# Unresolved questions

List remaining questions, or state `None`.

# Evolution

Explain what this changes relative to each predecessor. Use project-relative
`knowledge/...` paths in `supersedes` and `superseded_by`; keep reciprocal
links accurate.

[^maintainer-decision-id]: Explicit maintainer approval recorded in the linked project change.
