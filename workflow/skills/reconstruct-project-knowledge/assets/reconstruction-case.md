---
reconstruction_version: 3
id: "<case-id>"
title: "<title>"
mode: baseline
status: active
created_at: "<ISO-8601>"
updated_at: "<ISO-8601>"
repositories: []
supplemental_inputs:
  raw:
    status: pending
    baseline: "<full-knowledge-git-commit>"
    case_ids: []
    candidate_ids: []
    notes: []
  documentation:
    status: pending
    candidate_ids: []
    notes: []
  change_records:
    status: pending
    candidate_ids: []
    notes: []
cross_repository_analysis:
  status: pending
  notes: []
candidate_claims: []
promotion:
  status: pending
  concepts: []
  reason: ""
  validation: pending
coverage_audit:
  result: pending
  notes: []
reconciliation_audit:
  result: pending
  notes: []
maintainer_review:
  status: pending
  by: ""
  at: ""
  notes: []
---

# Reconstruction question

State the bounded baseline or audit question. Describe what a trustworthy
current project map must let a maintainer understand.

# Source order

Record how the repository dossiers, current curated knowledge, Git history,
optional documentation, change records, and raw candidates were used. Source
code establishes observed implementation only. It does not establish intended
product meaning, rationale, completeness, or correctness.

# Candidate claims

Keep atomic candidates in frontmatter. Classify each claim independently:

```yaml
- id: stable-lowercase-id
  claim: Exact claim
  claim_class: implementation
  semantic_role: observation
  intent_state: unknown
  delivery_state: implemented
  alignment: unknown
  temporal:
    captured_at: "<ISO-8601>"
    asserted_at: ""
    valid_from: ""
    valid_to: ""
  relations:
    supersedes: []
    superseded_by: []
    contradicts: []
    refines: []
    implements: []
    derived_from: []
  evidence:
    - kind: source-code
      resource: git:owner/repository@<full-commit>#<path>:<symbol>
  disposition: confirmed
  reason: ""
  maintainer_decision:
    status: not-needed
    by: ""
    at: ""
  routing:
    lane: current-knowledge
    destinations:
      - knowledge/areas/<area>/implementation/<concept>.md
```

Use `deferred` for a reviewed proposal that is intentionally kept outside
current knowledge. `unresolved` blocks completed reconstruction. The
reconstruction v3 gate still accepts legacy `promoted_to`, but new cases must
author the richer routing and relation fields so the shared claim ledger can
preserve cross-source lineage.

# Contradictions and adjudication

For every conflict, separate observed implementation, accepted product intent,
historical evidence, and unsupported explanation. Record the exact maintainer
decision when evidence cannot choose the current intended truth.

# Promotion map

Map every confirmed claim to the smallest current concept, or explain why an
audit produced no durable update. Proposed ideas never enter current knowledge.

# Coverage audit

Reconcile every repository's complete Git manifest, Graphify communities,
declared entrypoints/runtime surfaces, direct-reading receipts, dossier,
cross-repository boundary, supplemental input class, candidate, and promoted
concept. Look explicitly for Graphify-unindexed source, missing conditions,
negative behavior, unowned capabilities, stale intent, accidental
implementation, and knowledge that claims more than the evidence proves.

# Maintainer review

Present current product intent, observed delivery, alignment or drift, history
confidence, unknowns, and the proposed knowledge map. Record explicit approval;
continued conversation is not approval.
