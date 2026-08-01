---
reconstruction_workstream_version: 2
case_id: "<case-id>"
id: "<workstream-id>"
title: "<bounded outcome>"
wave: 1
role: "<repository-scout|cross-repository-tracer|raw-historian|coverage-critic|other>"
status: planned
owner: ""
attempt: 1
created_at: "<ISO-8601>"
updated_at: "<ISO-8601>"
execution:
  host: ""
  run_id: ""
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
  unexplained: []
  follow_up: []
review:
  status: pending
  by: ""
  at: ""
  notes: []
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
