---
workflow_version: 2
id: "{{WORK_ID}}"
title: "{{TITLE}}"
mode: "{{MODE}}"
status: shaping
scope: leaf
created_at: "{{CREATED_AT}}"
updated_at: "{{CREATED_AT}}"
repositories: []
knowledge_alignment:
  reviewed: []
  conflicts: []
graph_evidence:
  queries: []
knowledge_promotion:
  status: pending
  concepts: []
  reason: ""
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
  revision: ""
  worktree_id: ""
  repositories: []
  acceptance_reviewed: false
  implementation_reviewed: false
  knowledge_reviewed: false
  checks: []
  unresolved: []
---

# Summary

State the intended outcome and why it matters.

# Current state

Maintain the latest agreed problem, desired outcome, constraints, scope,
assumptions, risks, and next action. Rewrite this section whenever the current
understanding changes.

# Open questions

- Record unresolved questions that can change the solution, authority, or scope.

# Discussion and decision ledger

Append one concise entry after every material maintainer turn. Preserve rejected,
deferred, and superseded directions instead of rewriting history.

| At | Status | Subject | Outcome and rationale |
| --- | --- | --- | --- |
| {{CREATED_AT}} | proposed | Initial framing | Awaiting discussion. |

# Current behavior and evidence

Record Graphify queries, the source locations they led to, and direct inspection
of the actual code. Graph output is navigation evidence, never the authority for
an implementation claim. Add supplementary text-search findings only after
graph analysis.

# Knowledge alignment

List relevant vision, product, architecture, decision, repository, and uncertainty concepts. Record conflicts and maintainer resolutions.

# Scope

## In

- Define included behavior.

## Out

- Define explicit exclusions.

# Decisions

- Record the current approved decisions with enough rationale to guide
  implementation. Link each entry to its ledger history when it evolved.

# Plan and progress

- [ ] Add concrete implementation and validation steps.

# Acceptance criteria

- [ ] Add observable, testable completion criteria.

# Verification evidence

Record fresh commands, results, directly inspected code at the bound revision,
and criterion-by-criterion inspection. A passing test suite or Graphify result
alone is not complete evidence.

# Knowledge promotion

List the curated concepts updated by this change, or explain why the completed
change does not alter durable project intent, meaning, decisions, contracts,
boundaries, ownership, or operational knowledge. Promote only claims verified
against authoritative sources; untrusted raw intake is never provenance.

# Deviations and unresolved work

State deviations, remaining risks, placeholders, mocks, follow-ups, or `None`.

# Handoff

Record the exact next action, last completed action, blocking question, and the
paths reported by `wfctl work status`. This section must be sufficient to resume
after compaction without relying on conversation memory.
