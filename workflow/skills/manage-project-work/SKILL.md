---
name: manage-project-work
description: Classify project work, bind implementation to the exact selected checkout or worktrees, and maintain one central living specification and progress file for significant leaf, multi-repository, or project-only work plus optional lightweight handoffs. Use when starting, discussing, planning, implementing, resuming, changing scope, recording progress, making product or architecture decisions, or handing off any feature, fix, refactor, investigation, migration, operational change, or cross-repository task.
---

# Manage Project Work

Choose the least expensive process that still preserves important project knowledge and verification.

## Command ownership

Run every required `wfctl work` command and update the living spec yourself.
Do not ask the maintainer to operate the CLI, locate files, or edit structured
records during routine work. Ask them only for product intent, corrections,
review decisions, identity, or authority that the agent cannot supply. If tool
access blocks a command, report the exact blocker and provide the command as a
manual recovery path without claiming the gate passed.

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

1. As soon as the task is classified as significant, create the canonical
   shaping file with `wfctl work start <slug> --title "<title>"
   --mode full|slice`. Start from a leaf for one-repository implementation.
   Start from knowledge with no `--leaf` for product/architecture work that
   has no implementation checkout, or repeat `--leaf` for multi-repository
   implementation. Do this before
   extended solution discussion, Graphify analysis, or knowledge alignment so
   the discussion survives compaction.
2. Run `wfctl work status <id>` and record its exact `Code roots`, `Knowledge
   root`, and `Spec`.
3. Treat every reported `Code root` as an explicit implementation workspace
   and `Spec` as the only living specification. If the scope is `project` and
   has no code roots, do not write product source anywhere.
4. Immediately write the current user request, known constraints, open
   questions, and next action into `Spec`. Keep `status: shaping`.
5. Invoke `analyze-with-graphify` once in every code root whose implementation
   informs the task. Skip it only for genuinely project-only work with no code
   claim.
6. Invoke `align-project-knowledge` against `Knowledge root`.
7. Resolve blocking uncertainty with the maintainer and update `Spec`.
8. Present a framing review packet covering outcome, scope, exclusions,
   acceptance criteria, and new decisions.
9. Obtain explicit maintainer approval before implementation and record it
   under `maintainer_review.framing`. Existing explicit instructions may
   satisfy this gate; do not ask the maintainer to repeat them.
10. Set `status: active` only after Graphify evidence, knowledge alignment, open
    blocking questions, and framing approval are recorded. Do not edit code
    while the record is still `shaping`.
11. Use one file under `changes/active/` for proposal, specification, and
   progress. Do not create a separate progress document.
12. Keep its current state, decisions, scope, checklist, evidence, deviations,
    questions, ledger, and handoff current throughout discussion and
    implementation.
13. Re-scope explicitly when evidence changes the plan. Reopen framing review
   when the approved framing changes materially.
14. Ensure each implementation is preserved in its bound Git commit and every
    checkout is clean. Obtain normal maintainer authorization before
    committing; `wfctl` never commits automatically.
15. Invoke `verify-project-work` against every exact clean commit. A
    single-leaf record may use `verification.revision` and
    `verification.worktree_id`. A multi-repository record must add one
    `verification.repositories` receipt per repository. Project-only work
    records `verification.knowledge_reviewed: true` and knowledge checks
    instead of inventing code receipts.
16. Decide whether the verified change alters durable current knowledge. If it
    does, invoke `curate-project-knowledge`. Route product behavior and
    engineering realization separately, invoke `verify-knowledge-quality` for
    every changed concept, list the updated concepts under
    `knowledge_promotion.concepts`, and run
    `wfctl knowledge validate --target <Knowledge root>` using the exact root
    returned by `wfctl work status`. If it does not, set
    `knowledge_promotion.status: not-needed` with a concrete reason.
17. Present the completion review packet, including the drafted knowledge
    delta or no-update reason, and record the maintainer's explicit decision
    under `maintainer_review.completion`. Set `status: completed` only when all
    non-CLI gates are ready. Stable promoted concepts may now use this active
    but completion-ready record as their receipt.
18. For every promoted stable concept, compute and record its current
    `content_hash`, then run knowledge validation and build.
19. Run `wfctl work verify <id>`, followed by
    `wfctl work close <id> --outcome completed|partial|abandoned` with the
    accurate outcome.

Choose `slice` when a complete reviewable path should ship before the full destination. Choose `full` when the task can be completed safely as one unit. Do not force every task into a vertical slice.

## Multi-turn persistence

Treat a maintainer turn as material when it adds or changes a requirement,
constraint, idea, alternative, decision, rejection, deferral, scope boundary,
evidence, risk, open question, or next action.

After every material turn:

1. Update `Current state` to the latest coherent understanding.
2. Append a concise entry to `Discussion and decision ledger` with one of:
   `proposed`, `approved`, `rejected`, `deferred`, or `superseded`.
3. Update affected scope, decisions, questions, criteria, plan, and handoff.
4. Write the update before continuing analysis or implementation.

Do not paste chat transcripts. Current sections are mutable; ledger entries are
append-only. Preserve why an option was rejected, deferred, or superseded so a
later agent does not propose it as new.

## Resume after interruption or compaction

1. Run `wfctl work status <id>` from knowledge or a currently bound leaf.
2. Confirm every reported `Code root`, the `Knowledge root`, and `Spec`.
3. Read the entire `Spec`, including current state, open questions, ledger,
   progress, verification, and handoff.
4. Restate the current goal, last completed action, blocking question, and next
   action from the file.
5. Continue only from that recorded state. Never reconstruct the task from
   conversation memory or infer another checkout.

## Lightweight work

Proceed without the full gate when classification is clear. Before closing,
offer to create a compact inbox handoff if the work produced a
reusable decision, investigation result, operational fact, or non-obvious
limitation.

After the maintainer accepts, run:

```sh
wfctl work handoff <slug> --title "<what should be retained>"
```

Update the returned `Handoff` file using
[the handoff template](assets/handoff.md). It lives under `changes/inbox/`,
includes exact source-repository metadata, and remains non-authoritative until
triaged. The command works from a leaf for implementation observations and
from knowledge for project-only intake or reconstruction proposals. When it
routes atomic candidates, fill `claim_refs` with their fully qualified claim
IDs. Refresh QMD from the knowledge root so it appears in the explicit
`changes` collection.

Use [the work spec template](assets/work-spec.md) as the significant-work
schema. The live copy is created by `wfctl`; do not create a second copy in the
leaf repository.

## Workspace boundary

The knowledge repository is a record surface, not the implementation checkout.

Before the first code edit, after any `cd`, after resuming, and before running
verification or close:

1. Run `wfctl work status <id>` from the current knowledge or leaf checkout.
2. For each repository you will touch, run
   `git -C <Code root> rev-parse --show-toplevel`.
3. Require every path to match its reported root exactly.
4. Use only those code roots for code reads, edits, builds, tests, and Git
   commands. Never use the knowledge checkout as a substitute.
5. Update progress only at the exact `Spec` path returned by the status command.

Do not infer a checkout from repository name, branch, remote, sibling
directories, Git common directory, or the location of the spec. A linked
worktree is a distinct code root. Branch or worktree changes invalidate the
binding. Stop before editing and run `wfctl work rebind <id> --target
<replacement-leaf>` only after the maintainer explicitly accepts that move.

Follow the review protocol in `PROJECT_WORKFLOW.md`. Silence or continued
conversation is not approval.
