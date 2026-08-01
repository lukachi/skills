---
reconstruction_repository_version: 2
session_record_version: 1
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
observable behavior. Reconcile this prose with the structured surface ledger;
do not leave an entrypoint or runtime surface only in narrative text.>

# Boundaries and contracts

<Record owned boundaries, integrations, schemas, protocols, persistence, and
cross-repository contracts with pinned source locations.>

# Invariants, failures, and operations

<Record enforced invariants, error behavior, security or reliability
boundaries, runtime configuration, and important negative behavior.>

# Tests and runtime evidence

<List the pinned source and test paths actually read through wfctl receipts.
Explain what tests or fresh runtime checks establish and what they do not.>

# Git evolution

<Trace only history supported by Git. Separate observed code evolution from
why a maintainer intended it. If history is shallow or unavailable, say so.>

# Source condition

<Judge each lane as it actually is in this repository, not as its kind is
supposed to be: pinned source, tests and runtime checks, Git history, change
records, in-repository documentation, and any raw material bound to this case.
Give the evidence that established the judgement — a document citing deleted
paths, specifications rewritten without supersession, tests that no longer run.

A lane found unreliable establishes less. No other lane establishes more
because of it. Keep reading a degraded lane for terminology, chronology, and
leads, and where it contradicts itself over time, reconcile by chronology
rather than choosing a version. If no lane can establish intended meaning,
record that here and carry `intent: unknown` into the claims instead of
assembling intent from whatever is left.>

# Contradictions and unknowns

<List conflicting implementations, stale documentation, missing ownership,
unexplained behavior, and maintainer questions.>

# Discovery ledger

Persist repository-local information whose loss could change later analysis or
force it to be repeated. Use `DISC-NNN — title` headings and the five required
fields: `Observation`, `Evidence`, `Implication`, `Scope`, and `Disposition`.
This ledger is operational memory; it does not make an observation true.

# Candidate claims

<List the atomic claim IDs added to the parent reconstruction case and the
pinned evidence that supports or contradicts each one.>
