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
realization:
  intent: "<accepted|superseded|not-applicable>"
  delivery: "<absent|partial|implemented|verified|retired|unknown|not-applicable>"
  alignment: "<aligned|drifted|unknown|not-applicable>"
  assessed_at: "<ISO-8601>"
x-wf:
  relations: []
sources:
  - id: "<stable-source-id>"
    kind: "<maintainer-decision|source-code|runtime-check|archived-change|reconstruction-review|version-control|external-primary>"
    resource: "<pinned authority resource>"
    title: "<source title>"
    author: "<actor when applicable>"
---

# Current meaning and behavior

Explain the current user-facing or operator-facing truth in plain language.[^stable-source-id]

For product-bearing concepts, explain intended meaning separately from current
delivery. Remove `realization` only when the concept has no product intent or
product-meaning authority.

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

Before changing `status` to `stable`, run
`wfctl knowledge hash --concept knowledge/.../<concept>.md` and add a
verification event with `by`, `at`, and the returned `content_hash`. Any
material edit invalidates the old hash and requires a new event.
