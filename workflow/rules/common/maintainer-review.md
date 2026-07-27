# Maintainer review

OKF records provenance, trust, and lifecycle; it does not provide an approval
process. Follow the project review protocol in `PROJECT_WORKFLOW.md`.

Require an explicit maintainer decision before:

- choosing a workflow route when significance is ambiguous;
- implementing a significant spec whose outcome, scope, exclusions, acceptance
  criteria, or material decisions have not already been explicitly accepted;
- selecting current truth when evidence cannot resolve chronology or authority;
- accepting material re-scoping, unresolved risk, or a completion claim;
- recording `verified` by a `human:<id>` actor.

Do not request review for immutable raw capture, deterministic index or log
maintenance, or source-backed drafts that keep their trust state honest.

Present a compact review packet containing the exact decision, evidence,
conflicts, recommendation, and requested response. Record approve, correct, or
defer. Silence is not approval.

For significant work, record framing and completion decisions in the living
spec under `maintainer_review`. Existing explicit maintainer instructions may
satisfy the framing gate; do not ask for the same decision twice. Reopen the
gate when the approved framing changes materially.
