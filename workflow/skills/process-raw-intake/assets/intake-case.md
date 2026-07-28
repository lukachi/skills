---
intake_case_version: 2
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
promotion:
  status: pending
  concepts: []
  reason: ""
  validation: pending
omission_audit:
  result: pending
  notes: []
---

# Question

State the bounded truth this case is trying to establish.

# Candidate claims

Add one frontmatter object per candidate:

```yaml
- id: stable-lowercase-id
  claim: Exact atomic claim
  authority: implementation
  disposition: confirmed
```

Explain each candidate here: supporting and conflicting observations, missing
authority, verification result, and why it is confirmed, rejected, or
unresolved. Raw locations may appear only as intake locators, never as
evidence.

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

Preserve conflicting accounts and state what resolved them. If nothing can,
keep the candidate unresolved.

# Promotion

List the confirmed claims and the curated concepts that express them. Record
why rejected or unresolved candidates were not promoted.

# Omission audit

Reconcile the case against every frozen source and every candidate. Explicitly
check for lost conditions, exceptions, alternatives, negative results, and
chronology. QMD retrieval is a discovery aid; it is not the coverage proof.
