---
intake_case_version: 4
session_record_version: 1
id: "<case-id>"
title: "<bounded topic>"
status: active
created_at: "<ISO-8601>"
updated_at: "<ISO-8601>"
baseline:
  repository: "<repository>"
  commit: "<full-git-commit>"
  paths: []
sources: []
candidate_claims: []
maintainer_decisions: []
migration:
  from_version: null
  status: not-needed
  reviewed_by: ""
  reviewed_at: ""
  notes: []
promotion:
  status: pending
  concepts: []
  reason: ""
  validation: pending
omission_audit:
  result: pending
  notes: []
  probes: []
checkpoint:
  status: active
  stage: source-review
  actor: system:wfctl
  current_state: Intake case created from frozen Git blobs.
  last_completed: Exact raw scope was frozen into the source ledger.
  next_action: Read every frozen source completely and classify its atomic candidates.
  blockers: []
  updated_at: "<ISO-8601>"
  basis_sha256: "<sha256>"
---

# Question

State the bounded truth this case is trying to establish.

# Candidate claims

Add one frontmatter object per candidate:

```yaml
- id: stable-lowercase-id
  claim: Exact atomic claim
  claim_class: implementation
  semantic_role: observation
  intent_state: not-applicable
  delivery_state: verified
  alignment: not-applicable
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

Explain each candidate here: supporting and conflicting observations, missing
authority, verification result, and why it is confirmed, rejected, or
unresolved. Classify what kind of statement it is separately from whether it
is true, intended, delivered, current, historical, or proposed. Raw locations
may appear only as intake locators, never as evidence.

# Source review

`wfctl` generated `sources` from the exact Git tree. For every source, read the
complete file rather than only search snippets, then use
`wfctl knowledge case mark`. A `reviewed` source must list every candidate ID
it yielded. Use `no-relevant-claims` only after the full file was considered.
Do not edit path, object ID, type, or mode.

# Source verification

Record exact source repositories, revisions, paths, symbols, tests, runtime
receipts, primary external sources, and maintainer decisions.

# Contradictions and chronology

Preserve atomic conflicting accounts through claim relations. Record asserted
and effective time when known. Capture order and file order do not establish
truth. If independent evidence and maintainer authority cannot resolve the
conflict, keep the candidate unresolved.

# Discovery ledger

Persist consequential review information as soon as losing it would make a
later session repeat work, omit a condition, or route a candidate differently.
Use `DISC-NNN — title` headings with non-empty `Observation`, `Evidence`,
`Implication`, `Scope`, and `Disposition` fields. Raw locations may identify
what triggered the discovery, but they are never authoritative evidence. This
ledger remains operational case memory and is not curated truth.

# Promotion

Route each candidate explicitly:

- current accepted truth to `current-knowledge`;
- former durable truth to `history`;
- reviewed, owned proposals and plans to `change`;
- useful unowned proposals or findings to `capture`;
- rejected or unresolved material to `case-only`.

List knowledge destinations in `promotion.concepts`. Record why rejected,
deferred, or unresolved candidates were not promoted as current truth.

# Omission audit

Reconcile the case against every frozen source and every candidate. Then write
diagnostic probes that are answered from routed `knowledge/` or `changes/`
outputs without consulting raw or this case. Every non-rejected candidate must
be covered by at least one passed or explicitly human-waived probe. Explicitly
check for lost conditions, exceptions, alternatives, negative results, and
chronology. QMD retrieval is a discovery aid; it is not the coverage proof.
