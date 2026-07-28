---
type: "<descriptive concept type>"
title: "<title>"
description: "<one-sentence current meaning>"
status: draft
area: "<primary-area>"
capabilities: []
authority:
  - "<intent|product-meaning|implementation|architecture-rationale|ownership|contract|operational-policy|decision|history|external>"
generated:
  by: "<producer>/<version>"
  at: "<ISO-8601>"
verified: []
x-wf:
  relations: []
sources:
  - id: "<stable-source-id>"
    kind: "<maintainer-decision|source-code|runtime-check|archived-change|version-control|external-primary>"
    resource: "<pinned authority resource>"
    title: "<source title>"
    author: "<actor when applicable>"
---

# Current meaning and behavior

Explain the current user-facing or operator-facing truth in plain language.[^stable-source-id]

# Boundaries

State constraints, invariants, non-goals, or ownership that materially affect
decisions. Attribute each material claim.

# Relationships

Link the parent Area, related capabilities, rules, use cases, and cross-area
concepts. Add every material semantic edge to `x-wf.relations` and keep a
matching Markdown link here. Use a short paragraph in `context` when one line
would lose an important condition:

```yaml
x-wf:
  relations:
    - kind: governed-by
      target: knowledge/areas/<area>/rules/<rule>.md
      context: >-
        Explain why this relationship matters, including any boundary or
        condition needed to interpret it correctly.
```

# Technical realization

When relevant, summarize the current implementation and link detailed,
pinned implementation concepts. Keep product meaning understandable without
requiring this section.

[^stable-source-id]: Short human-readable source label.
