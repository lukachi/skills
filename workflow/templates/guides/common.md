# Project Workflow

This is the maintainer-facing operating guide for the workflow installed by
`wfctl`.

- Profile: `{{PROFILE}}`
- Project knowledge: `{{KNOWLEDGE_PATH}}`

The workflow is a collaboration protocol. The agent gathers evidence, keeps the
records current, and presents bounded decisions. The maintainer supplies product
intent, resolves authority conflicts, and approves material commitments.

## What OKF does and does not do

The curated `knowledge/` directory follows
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
OKF defines portable Markdown concepts, provenance, trust signals, lifecycle,
indexes, and logs. It does not prescribe an approval workflow.

This project adds that approval workflow:

- `generated` says who last produced meaningful content.
- `verified` says who checked that content against its sources or resource.
- no `verified` field means `unverified`;
- non-human verification means `machine-confirmed`;
- a `human:<id>` verification means `human-reviewed`;
- `status: draft|stable|deprecated` is lifecycle, not trust.
- an omitted `status` means `stable`, so write `status: draft` explicitly for
  unresolved or not-yet-reviewed material.

Do not treat `stable` as shorthand for human approval. Do not add a
`human:<id>` verification unless that person explicitly reviewed the current
material claim. If meaningful content changed after the latest human review,
surface that fact and request review again before describing the new content as
human-approved.

## Repository surfaces

| Surface | Purpose | Authority |
| --- | --- | --- |
| `raw/` | Immutable evidence and work history | Never current truth by itself |
| `changes/active/` | One living spec/progress record per active significant task | Current execution agreement |
| `changes/archive/` | Closed work records | Historical execution evidence |
| `knowledge/` | Curated OKF concepts | Current knowledge, qualified by provenance, trust, lifecycle, and freshness |

Flushing a work record to `raw/` does not update current knowledge
automatically. Material facts and decisions must be reconciled into
`knowledge/` separately.

## Choose the workflow

Use the full workflow when work may change observable behavior, domain meaning,
interfaces, schemas, protocols, data or control flow, persistent state,
security, reliability, operations, architecture, ownership, or coordination
across components or repositories.

Use the lightweight path only when the change clearly preserves behavior and
contracts. Task size is not the classifier.

When classification is ambiguous, the agent must explain the likely impact,
recommend a route, and ask the maintainer. If the maintainer chooses the
lightweight path, the agent may proceed and should offer a compact handoff
record before closing.

## Maintainer review gates

### 1. Workflow routing

Review only when the work cannot be classified confidently. Accept the full
workflow or explicitly allow the lightweight path.

### 2. Significant-work framing

Before implementation, review the proposed outcome, scope, exclusions,
acceptance criteria, and any new product or technical decision. Existing
explicit instructions can satisfy this gate; the agent must not ask you to
repeat an already clear decision.

The agent records the decision under `maintainer_review.framing` in the living
spec. An approval applies only to the framing that was presented. Material
re-scoping requires another review.

### 3. Unresolved truth or authority

Review whenever evidence cannot establish chronology, original intent, current
intent, or which conflicting source is authoritative. Choose one of:

- confirm the current truth and provide the reason;
- reject the proposed interpretation;
- keep the issue unresolved.

Deferral is valid. The agent must preserve it as an uncertainty rather than
guess.

### 4. Completion

After verification, review a compact completion packet: acceptance results,
implementation evidence, checks run, deviations, and remaining risks. Approve,
request changes, or accept an explicitly partial outcome.

For full or slice work, a completed flush is blocked until the agent records
explicit maintainer approval under `maintainer_review.completion`.

### 5. Curated knowledge

Human review is required before the workflow records human verification for
material claims about:

- project vision, principles, constraints, or non-goals;
- user behavior, domain meaning, or product flows;
- architecture, ownership, contracts, or operational policy;
- decisions, supersession, accepted risk, or resolved contradictions.

The agent may maintain raw records, indexes, logs, and source-backed draft or
machine-confirmed concepts without asking for approval. It must keep their trust
state honest.

## Review packet

The agent should not ask you to rediscover context by reading the entire
repository. Each review request should contain:

1. **Decision** — the exact claim, scope, or outcome being proposed.
2. **Evidence** — relevant code locations, knowledge concepts, sources, and
   verification results.
3. **Conflicts** — contrary evidence, uncertainty, deviations, or risk.
4. **Recommendation** — the agent's preferred answer and reasoning.
5. **Requested response** — approve, correct, or defer.

An approval must be explicit. Silence, continued conversation, or an agent's
own confidence is not approval.

The maintainer does not need to edit YAML by hand. Respond with the decision
and a stable reviewer ID; the agent records:

```yaml
maintainer_review:
  framing:
    status: approved
    by: human:<reviewer-id>
    at: <ISO-8601 datetime>
    notes: []
  completion:
    status: approved
    by: human:<reviewer-id>
    at: <ISO-8601 datetime>
    notes: []
```

Use `status: pending` until approval. Put corrections or deferred decisions in
`notes`; do not represent them as approved.

## Significant-work loop

1. Classify the work.
2. Analyze the current implementation through Graphify.
3. Read relevant curated knowledge and its provenance.
4. Resolve blocking contradictions with the maintainer.
5. Create one living spec with `wfctl work begin`.
6. Obtain framing approval and record it in that spec.
7. Implement while keeping the same spec current.
8. Verify every acceptance criterion against code and fresh checks.
9. Obtain completion approval.
10. Run `wfctl work verify`, then flush the honest outcome with
    `wfctl work flush`.
11. Curate durable new truth from `raw/` into `knowledge/` when needed.

Use `full` for a safely completable unit, `slice` for a complete reviewable path
toward a larger destination, and `handoff` for useful lightweight or
interrupted context. A partial or abandoned outcome is preferable to a false
completion claim.

## Routine health check

Run:

```sh
wfctl doctor --target .
```

Use `wfctl sync --target . --plan` to inspect workflow updates before applying
them. Locally modified generated assets are conflicts and are never silently
overwritten.
