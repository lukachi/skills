---
workflow_version: 1
kind: work-issue
id: "{{ISSUE_ID}}"
title: "{{TITLE}}"
phase: delivery
type: delivery
status: draft
blocked_by: []
satisfies: []
repositories: []
artifacts: []
claim: null
resolution: null
created_at: "{{CREATED_AT}}"
updated_at: "{{CREATED_AT}}"
---

# Outcome

State the complete behavior, decision, or fact this issue must deliver. Keep it
small enough for one fresh agent session when possible.

# Acceptance contribution

Explain how this issue contributes to its `satisfies` acceptance IDs. For a
Wayfinder issue, state the precise question it resolves instead.

# Constraints and boundaries

Record relevant project knowledge, approved decisions, repository scope, and
explicit exclusions. Do not copy the parent specification.

# Progress

Keep the last completed action, current state, blocker, and next action current
after every material turn.

# Verification

Record direct source inspection, executable checks, outcomes, and limitations.
Graph or search output is navigation evidence, not implementation proof.

# Handoff

State what a fresh session must do next and which exact bundle and code roots it
must revalidate with `wfctl work context`.
