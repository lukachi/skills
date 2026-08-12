# 04 — Your part

## Use this when

The agent is waiting on you, something drifted, a session died, or you are
deciding whether to believe a result. This is the shortest guide and the one
worth rereading.

## What you decide

Nothing here is delegable, in either repository:

- what the project is for and how it should behave;
- corrections, scope, and priority;
- anything evidence cannot settle — chronology, ownership, intent;
- the implementation framing, before code is written;
- whether an outcome is completed, partial, or abandoned;
- permission for commits and other changes to the outside world.

Everything else — commands, investigation, record-keeping, verification, drafts
— belongs to the agent. If you are being asked to run routine `wfctl`, copy IDs,
or edit YAML, something is wrong with the session, not with you.

## What a decision request should look like

You should be handed a compact packet, not an internal ledger:

1. the decision, in project language;
2. the evidence, and where it stops;
3. the recommended answer and its cost;
4. what changes if you agree;
5. what stays blocked if you defer.

One question at a time. Approve, correct, reject, or defer explicitly — an
unanswered question stays unresolved, and continued conversation is not consent.

Two decisions are recorded by you rather than for you:

```sh
wfctl work approve <change-id> --stage framing --by human:<your-id>
wfctl work promote <change-id> --by human:<your-id>
```

The first settles what a piece of work is, before it starts. The second settles
what the project says about itself, after the work has shipped and closed — and
it writes the pages in the same act.

Whether finished work is finished is not one of them. The agent closes that
itself, because the record already answers it. It comes back to you at the end
only when delivery no longer matches the framing you approved.

Ordinarily the agent records the answer you gave in conversation, word for word.
Ask for a typed confirmation, or set a token out of band for automation, if you
want a receipt the agent could not have written. A hand-written approval fails
verification either way.

## Do not accept "done" without

- evidence for every acceptance criterion, not a summary of it;
- the deviations and the remaining risks, stated;
- a clean, correctly bound commit that contains the reviewed implementation;
- a separate receipt for each affected repository;
- the resulting knowledge update, or a concrete reason none was needed.

The specific failure to watch for is scope drift: criteria quietly reworded
until the delivered thing satisfies them. Compare the acceptance list against
what you asked for at the start, not against what the summary says.

Two useful questions:

> Is this the production path, or a fixture?

> Which acceptance criterion is weakest, and why?

## Common situations

| Situation | What to do |
| --- | --- |
| The agent misunderstood the goal | Correct it now. The record must be updated before work continues. |
| Product intent is unknown | Decide it or defer it explicitly. Do not let the implementation become the intent by default. |
| Code and knowledge disagree | Ask for a conflict packet, then decide which side is stale — it can be both. |
| The session was compacted or restarted | Ask it to resume. If several records are active, you pick by outcome, not by ID. |
| You changed branch or worktree | Say so. Work stops until you approve an explicit rebind. |
| The task cannot be completed | Take the partial or abandoned outcome with gaps preserved. |
| A useful finding has no owner | Ask for it to be captured for later triage — unless an active record already owns it. |
| New raw material appeared | Ask the knowledge agent to process it. |
| The workflow itself has an update | Ask for a preview, then apply it and restart the session. |

## When the checkout is wrong

Work records bind repository, revision, branch, checkout, and worktree identity.
When those stop matching, the agent must stop rather than guess where to write.

You choose: go back to the original checkout, or approve a rebind. A rebind
records the transition; it does not rewrite what came before.

## What the machinery cannot do

This workflow is built on a distinction worth internalizing: **complete
accounting is not complete understanding.**

It can prove that every selected file was delivered in full, that every tracked
file and structural cluster got an explicit disposition, that every acceptance
criterion has recorded evidence, that a review receipt matches an exact document
version, that curated knowledge never cites untrusted input, and that an
approval came from a deliberate command.

It cannot prove that anything was understood. Specifically:

| Mechanism | What it proves | What it does not |
| --- | --- | --- |
| Read receipts | The bytes were delivered | That they were comprehended |
| Coverage ledgers | Everything was accounted for | That the account is correct |
| Checkpoints | Which record version was summarized | That the summary is honest |
| Quality receipts | A review was performed on this exact text | That the review was any good |
| Omission probes | Every claim has a diagnostic question | That nothing important was lost |
| Approval receipts | Approval came from a separate command | Who typed it |

There is also a gap you should know about: whether an agent routes a request
correctly, reads what it claims to read, and writes useful stakeholder knowledge
is checked by black-box evals that are **run manually**, not automatically. When
`evals/results/` is empty, agent behavior is unverified for that build. The
deterministic tests being green says nothing about it.

None of this is a reason to distrust the workflow. It is the reason your review
still matters, and why the honest answer to "is it done?" sometimes needs you to
open the diff yourself.

## Where to go deeper

The user guides stop here. Normative behavior lives in the contracts:

| Contract | Owns |
| --- | --- |
| [`spec/ENGINE.md`](../spec/ENGINE.md) | Ownership, installation, routing, safety |
| [`spec/WORK.md`](../spec/WORK.md) | Change bundles, issues, review accounting |
| [`spec/KNOWLEDGE.md`](../spec/KNOWLEDGE.md) | Trust boundaries, curation, retrieval |
| [`spec/RECONSTRUCTION.md`](../spec/RECONSTRUCTION.md) | Source-first completeness |
| [`spec/CLI.md`](../spec/CLI.md) | Every command and option |
| [`spec/VERIFICATION.md`](../spec/VERIFICATION.md) | How the workflow itself is tested |

Return to [the project overview](../README.md).
