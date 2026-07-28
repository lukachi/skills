---
name: manage-project-work
description: Classify project work, bind implementation to one exact checkout or worktree, and maintain one central living specification and progress file for significant tasks or optional lightweight handoffs. Use when starting, planning, implementing, resuming, changing scope, recording progress, or handing off any feature, fix, refactor, investigation, migration, operational change, or cross-repository task.
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
   shaping file with
   `wfctl work start <slug> --title "<title>" --mode full|slice`. Do this before
   extended solution discussion, Graphify analysis, or knowledge alignment so
   the discussion survives compaction.
2. Run `wfctl work status <id>` and record its exact `Code root` and `Spec`.
3. Treat `Code root` as the only checkout where implementation may be edited,
   and `Spec` as the only living specification that may be updated.
4. Immediately write the current user request, known constraints, open
   questions, and next action into `Spec`. Keep `status: shaping`.
5. Invoke `analyze-with-graphify` from `Code root`.
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
14. Ensure the implementation is preserved in the bound Git commit
    and the checkout is clean. Obtain normal maintainer authorization before
    committing; `wfctl` never commits automatically.
15. Invoke `verify-project-work` against that exact clean commit. Record its
    commit under `verification.revision` and the bound worktree under
    `verification.worktree_id`.
16. Decide whether the verified change alters durable current knowledge. If it
    does, invoke `curate-project-knowledge`, list the updated concepts under
    `knowledge_promotion.concepts`, and run
    `wfctl knowledge validate --target <Knowledge root>` using the exact root
    returned by `wfctl work status`. If it does not, set
    `knowledge_promotion.status: not-needed` with a concrete reason.
17. Present the completion review packet, including the knowledge delta or
    no-update reason, and record the maintainer's explicit decision under
    `maintainer_review.completion`.
18. Run `wfctl work close <id> --outcome completed|partial|abandoned` with the
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

1. Run `wfctl work status <id> --target <current-leaf>`.
2. Confirm the reported `Code root`, `Knowledge root`, and `Spec`.
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
includes exact repository/worktree metadata, and remains non-authoritative
until triaged. Refresh QMD from the knowledge root so it appears in the
explicit `changes` collection.

Use [the work spec template](assets/work-spec.md) as the significant-work
schema. The live copy is created by `wfctl`; do not create a second copy in the
leaf repository.

## Workspace boundary

The knowledge repository is a record surface, not the implementation checkout.

Before the first code edit, after any `cd`, after resuming, and before running
verification or close:

1. Run `wfctl work status <id> --target <current-leaf>`.
2. Run `git -C <Code root> rev-parse --show-toplevel`.
3. Require both paths to match exactly.
4. Use `Code root` as the working directory for every code read, edit, build,
   test, and Git command.
5. Update progress only at the exact `Spec` path returned by the status command.

Do not infer the checkout from repository name, branch, remote, sibling
directories, Git common directory, or the location of the spec. A linked
worktree is a distinct code root. If the pointer, worktree identity, or paths
disagree, stop before editing and ask the maintainer to resolve the binding.

Follow the review protocol in `PROJECT_WORKFLOW.md`. Silence or continued
conversation is not approval.
