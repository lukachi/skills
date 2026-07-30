# Maintainer review

OKF records provenance, trust, and lifecycle; it does not provide an approval
process. Follow the project review protocol in `PROJECT_WORKFLOW.md`.

Require an explicit maintainer decision before:

- choosing a workflow route when significance is ambiguous;
- starting raw processing, whole-project reconstruction, durable external
  research, semantic curation, or broad direction shaping when the maintainer
  did not already request that outcome;
- implementing a significant spec whose outcome, scope, exclusions, acceptance
  criteria, or material decisions have not already been explicitly accepted;
- selecting current truth when evidence cannot resolve chronology or authority;
- accepting material re-scoping, unresolved risk, or a completion claim;
- recording `verified` by a `human:<id>` actor.

Do not request review for freezing a clean Git raw scope, file accounting, QMD
refresh, index or log maintenance, or source-backed drafts that keep their
trust state honest. Raw intake itself never counts as evidence.

Present a compact review packet containing the exact decision, evidence,
conflicts, recommendation, and requested response. Record approve, correct, or
defer. Ask one focused question at a time. Silence is not approval.

For significant work, record framing and completion decisions in the living
spec under `maintainer_review`. Existing explicit maintainer instructions may
satisfy the framing gate; do not ask for the same decision twice. Reopen the
gate when the approved framing changes materially.

After every material maintainer turn, update the spec's mutable current state
and append the decision/discussion ledger before continuing. Preserve proposed,
approved, rejected, deferred, and superseded outcomes without copying the
conversation transcript.
