---
workflow_version: 2
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
checkpoint_version: 1
checkpoint:
  status: ready
  stage: implement
  actor: system:wfctl
  current_state: Issue is ready but unclaimed.
  last_completed: Issue record created.
  next_action: Read the required context and claim the issue.
  blockers: []
  updated_at: "{{CREATED_AT}}"
  basis_sha256: "{{CHECKPOINT_BASIS}}"
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

# Verification

Record direct source inspection, executable checks, outcomes, and limitations.
Graph or search output is navigation evidence, not implementation proof.
