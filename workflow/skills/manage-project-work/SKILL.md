---
name: manage-project-work
description: Classify project work and maintain one living specification and progress file for significant tasks or optional lightweight handoffs. Use when starting, planning, implementing, resuming, changing scope, recording progress, or handing off any feature, fix, refactor, investigation, migration, operational change, or cross-repository task.
---

# Manage Project Work

Choose the least expensive process that still preserves important project knowledge and verification.

## Classify

Use the full workflow when work may change:

- observable behavior or domain meaning,
- an interface, schema, protocol, data flow, or control flow,
- persistent state, security, reliability, or operations,
- architecture, ownership, or component boundaries,
- coordination across repositories or teams.

Treat work as lightweight only when it clearly preserves behavior and contracts. Size is not the deciding factor.

If uncertain, describe the possible impact and ask the maintainer whether to use the full workflow. Recommend one answer.

## Full workflow

1. Invoke `analyze-with-graphify`.
2. Invoke `align-project-knowledge`.
3. Resolve any blocking uncertainty with the maintainer.
4. Create the canonical file with `wfctl work begin <slug> --title "<title>" --mode full|slice`.
5. Present a framing review packet covering outcome, scope, exclusions,
   acceptance criteria, and new decisions.
6. Obtain explicit maintainer approval before implementation and record it
   under `maintainer_review.framing`. Existing explicit instructions may
   satisfy this gate; do not ask the maintainer to repeat them.
7. Use one file for specification and progress. Do not create a separate progress document.
8. Keep its decisions, scope, checklist, evidence, deviations, and handoff current during implementation.
9. Re-scope explicitly when evidence changes the plan. Reopen framing review
   when the approved framing changes materially.
10. Invoke `verify-project-work`.
11. Present the completion review packet and record the maintainer's explicit
    decision under `maintainer_review.completion`.
12. Flush only with an accurate outcome.

Choose `slice` when a complete reviewable path should ship before the full destination. Choose `full` when the task can be completed safely as one unit. Do not force every task into a vertical slice.

## Lightweight work

Proceed without the full gate when classification is clear. Before closing, offer to create a compact `handoff` record if the work produced a reusable decision, investigation result, operational fact, or non-obvious limitation.

Use [the work spec template](assets/work-spec.md) as the schema. The live copy is created by `wfctl`; do not create a second copy in the leaf repository.

Follow the review protocol in `PROJECT_WORKFLOW.md`. Silence or continued
conversation is not approval.
