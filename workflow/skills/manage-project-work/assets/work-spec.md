---
workflow_version: 1
id: "{{WORK_ID}}"
title: "{{TITLE}}"
mode: "{{MODE}}"
status: active
created_at: "{{CREATED_AT}}"
updated_at: "{{CREATED_AT}}"
source:
  repository: "{{REPOSITORY_ID}}"
  checkout: "{{CHECKOUT_NAME}}"
  branch: "{{BRANCH}}"
  commit: "{{COMMIT}}"
  remote: "{{REMOTE}}"
  worktree: false
knowledge_alignment:
  reviewed: []
  conflicts: []
graph_evidence:
  queries: []
maintainer_review:
  framing:
    status: pending
    by: ""
    at: ""
    notes: []
  completion:
    status: pending
    by: ""
    at: ""
    notes: []
verification:
  result: pending
  acceptance_reviewed: false
  implementation_reviewed: false
  checks: []
  unresolved: []
---

# Summary

State the intended outcome and why it matters.

# Current behavior and evidence

Record Graphify findings and exact source locations. Add supplementary text-search findings only after graph analysis.

# Knowledge alignment

List relevant vision, product, architecture, decision, repository, and uncertainty concepts. Record conflicts and maintainer resolutions.

# Scope

## In

- Define included behavior.

## Out

- Define explicit exclusions.

# Decisions

- Record settled decisions with rationale and source pointers.

# Plan and progress

- [ ] Add concrete implementation and validation steps.

# Acceptance criteria

- [ ] Add observable, testable completion criteria.

# Verification evidence

Record fresh commands, results, graph traces, and criterion-by-criterion inspection. A passing test suite alone is not complete evidence.

# Deviations and unresolved work

State deviations, remaining risks, placeholders, mocks, follow-ups, or `None`.

# Handoff

Keep the next action and any live session state concise.
