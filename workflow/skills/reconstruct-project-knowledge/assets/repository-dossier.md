---
reconstruction_repository_version: 1
case_id: "<case-id>"
repository: "<repository>"
commit: "<full-git-commit>"
status: pending
graphify_queries: []
candidate_ids: []
coverage:
  purpose: pending
  areas_capabilities: pending
  entrypoints: pending
  boundaries_contracts: pending
  data_state_control_flow: pending
  invariants_failure_modes: pending
  tests_runtime: pending
  unknowns: pending
history:
  status: pending
  notes: []
---

# Repository role

<Explain what this repository demonstrably does, its likely responsibility,
and what remains interpretation rather than source-backed fact.>

# Area and capability observations

<Map implemented behavior to candidate Areas and capabilities. Do not infer
product intent merely because code exists.>

# Entrypoints and flows

<Trace the principal entrypoints, data/state/control flows, and externally
observable behavior.>

# Boundaries and contracts

<Record owned boundaries, integrations, schemas, protocols, persistence, and
cross-repository contracts with pinned source locations.>

# Invariants, failures, and operations

<Record enforced invariants, error behavior, security or reliability
boundaries, runtime configuration, and important negative behavior.>

# Tests and runtime evidence

<Explain what tests or fresh runtime checks establish and what they do not.>

# Git evolution

<Trace only history supported by Git. Separate observed code evolution from
why a maintainer intended it. If history is shallow or unavailable, say so.>

# Contradictions and unknowns

<List conflicting implementations, stale documentation, missing ownership,
unexplained behavior, and maintainer questions.>

# Candidate claims

<List the atomic claim IDs added to the parent reconstruction case and the
pinned evidence that supports or contradicts each one.>
