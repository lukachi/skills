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
concepts.

# Technical realization

When relevant, summarize the current implementation and link detailed,
pinned implementation concepts. Keep product meaning understandable without
requiring this section.

[^stable-source-id]: Short human-readable source label.
