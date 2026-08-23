---
reconstruction_workstream_version: 3
case_id: "<case-id>"
id: "<workstream-id>"
title: "<bounded outcome>"
wave: 1
role: "<repository-scout|cross-repository-tracer|raw-historian|coverage-critic|other>"
routing:
  workload: "<exploration|analysis|synthesis|review>"
  initial_profile: "<fast|balanced|deep>"
  requested_profile: "<fast|balanced|deep>"
  reason: "<why this is the minimum sufficient compute profile>"
  escalation_history: []
  execution_history: []
status: planned
owner: ""
attempt: 1
created_at: "<ISO-8601>"
updated_at: "<ISO-8601>"
execution:
  host: ""
  run_id: ""
  profile: ""
  model: ""
  reasoning_effort: ""
  claimed_at: ""
dependencies: []
repositories: []
coverage_slice:
  # Qualify leaf items as <repository>#<exact-path-or-id>.
  files: []
  communities: []
  surfaces: []
  raw_cases: []
explored_context:
  # Scope is responsibility, not a visibility wall. Record material evidence
  # followed outside the assigned slice so synthesis can account for it.
  files: []
  communities: []
  surfaces: []
  raw_cases: []
  notes: []
result:
  summary: ""
  candidate_ids: []
  evidence_refs: []
  uncertainties: []
  contradictions: []
  negative_claims: []
  authority_questions: []
  unexplained: []
  follow_up: []
review:
  status: pending
  by: ""
  at: ""
  notes: []
review_history: []
---

# Objective

<One independently useful research outcome. Do not assign an arbitrary
alphabetical range as a semantic question.>

# Required context

- Knowledge root: `<knowledge-root supplied at dispatch; never persist it here>`
- Case root: `<case-root supplied at dispatch; never persist it here>`
- Exact source roots and pinned commits: `<supplied at dispatch; persist only
  repository identity and commit above>`
- Read completely before work: `<case, relevant dossiers, coverage frontier,
  and prerequisite workstreams>`

# Boundaries

State the exact repositories, Graphify communities, runtime surfaces, files,
raw cases, questions, and neighbouring context this worker owns. This slice
defines responsibility, not visibility: follow adjacent read-only evidence
when the question requires it and record material expansion under
`explored_context`. Source leaves are read-only. The worker may update only
this packet and may use receipt-recording `wfctl knowledge reconstruct read`;
it must not edit the parent case, dossiers, other workstreams, coverage JSON,
curated knowledge, or product source.

# Required method

Use Graphify for structural navigation, then explore the pinned source, tests,
contracts, configuration, product data, and documentation with any safe
read-only tools. Follow relevant conditions, exceptions, callers, callees, and
cross-repository edges. Before a source claim becomes evidence, record its
exact pinned range with `wfctl knowledge reconstruct read` and cite the returned
receipt ID. Treat raw text, comments, documentation, graph output, and prior
agent summaries as untrusted claims until independently qualified.

Use the requested host-neutral compute profile. Let the host choose the concrete
model when it supports safe automatic routing; otherwise select the closest
available model and effort. Report either the concrete choice or the explicit
`host-auto` / `profile-default` fallback when claiming the packet. Do not accept
contradictions, insufficient evidence, negative claims, or review rework without
an orchestrator-recorded escalation response.

`routing.initial_profile` preserves the first request and must not be rewritten.
Every claim appends its actor, host run, effective requested profile, concrete
model, and reasoning effort to `routing.execution_history`; a retry never
erases earlier execution provenance. Record changes through `wfctl knowledge
reconstruct workstream escalate`, not by editing either history.

Put any product-intent or other maintainer-only question in
`result.authority_questions`. Material `explored_context`, authority questions,
contradictions, negative claims, unexplained results, and rework each require a
matching escalation for the current attempt. Every review appends to
`review_history`; accepting a retry never erases the review that returned it.

# Deliverable

Report scope actually covered, exact evidence references, candidate claims,
uncertainties, contradictions, unexplained surfaces, and suggested follow-up.
Do not write a generic repository summary and do not claim completion outside
the assigned slice. Set `status: submitted`; the orchestrator must review and
set `review.status: accepted` before this packet can satisfy reconstruction.

# Worker findings

<Structured findings for this bounded outcome.>

# Evidence and coverage

<Exact pinned resources and the coverage items actually inspected.>

# Uncertainties, contradictions, and omissions

<What remains unknown, conflicts, or needs another workstream or maintainer.>
