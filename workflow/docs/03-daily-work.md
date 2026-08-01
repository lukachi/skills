# 03 — Work day to day

## Use this when

Use this guide whenever you discuss, implement, or resume project work with an
agent.

## Problem

A task often begins as a conversation and changes as its constraints become
clear. If the conversation is the only record, compaction, a new session, or a
second repository can destroy the real plan.

## Outcome

You and the agent share one durable bundle that follows consequential work from
early discussion through implementation, verification, and honest closure.
Either of you can recover what was decided, why, what changed, and what remains.

## Start with the desired outcome

Speak naturally:

> Change how account recovery works.

You do not need to name a skill or command. The agent classifies the work and
chooses the lightest safe route.

## Significant work

Work is significant when it may change behavior, product meaning, contracts,
data or control flow, persistent state, security, operations, architecture, or
coordination between components.

For significant work, the agent must:

1. Create one central change bundle before extended discussion.
2. Record material requirements, constraints, alternatives, answers, and
   decisions after each meaningful conversation turn. During discussion or
   investigation, preserve consequential discoveries whose loss could make a
   future session repeat work, choose differently, misunderstand the task, or
   act unsafely.
3. Bind the bundle to the exact repository checkout or worktrees where code
   may be changed.
4. Investigate source through Graphify and compare the task with current
   knowledge.
5. Show a short framing packet: outcome, scope, exclusions, decisions,
   unknowns, and acceptance criteria.
6. Wait for your explicit framing approval, which you record yourself with
   `wfctl work approve <change-id> --stage framing --by human:<your-id>`. The
   command asks for a typed confirmation in your terminal; the agent cannot
   record the decision for you.
7. For multi-session work, split the approved contract into bounded issues with
   explicit blockers and acceptance coverage.
8. Claim one ready issue and implement only in the bound leaf checkout—not in
   the knowledge repository.
9. Verify the actual implementation and every bundle file, then show evidence,
   deviations, and risks.
10. Ask for your completion decision, which you record the same way with
    `--stage completion`, then archive the real outcome.

Correct the framing as soon as something is wrong. Silence is not approval, and
neither is an agent-written receipt: verification rejects an approval that no
`wfctl work approve` run produced.

## Where the record and code live

The canonical directory lives at `changes/active/<change-id>/` in knowledge:

- `change.md` is the parent outcome, scope, decisions, and acceptance contract;
- `map.md` appears only for Wayfinder and preserves how a foggy route cleared;
- `issues/` contains bounded decision or delivery work and its progress;
- `artifacts/` contains linked research or prototypes;
- `review.md` accounts for every file at its current content hash.

`change.md` and each issue carry one structured checkpoint in frontmatter. The
agent refreshes the owning checkpoint after material edits. Its hash proves
which record state it summarizes; it does not replace reading that record.

Each change and issue also has a `Discovery ledger`. It is deliberately broad:
the agent records any newly learned information that would materially matter
to a future session, together with its evidence, implication, scope, and
current destination. It is not a list restricted to bugs, traps, or technical
facts, and it is not a transcript or activity log. Superseded observations stay
visible with their disposition corrected.

Source code remains in its owning leaf repository. A leaf contains only an
ignored pointer and exact claim metadata, never a second spec or tracker.

The agent stores local path bindings separately and verifies them before every
implementation or completion action. A worktree is not a special workflow
mode, but its exact identity matters: changing branches or checkouts cannot
silently redirect the task.

If one outcome spans several repositories, the agent binds the relevant
worktrees to the same bundle. Each leaf receives its own final verification
receipt.

## Lightweight work

Clearly local presentation polish, copy changes, formatting, or mechanical
corrections that preserve behavior and contracts may skip the full workflow.

If the impact is ambiguous, the agent explains the risk and recommends either:

- use the significant-work record; or
- proceed lightly and optionally retain a pending capture afterward when a
  reusable result has no existing owner.

You choose. The workflow should not turn every edit into a ceremony.

A capture enters `changes/inbox/` and is not active work or project truth. The
knowledge agent later routes it to an existing curated or active destination,
or discards it with a reason. If work is already active, the agent updates that
bundle and its checkpoint instead of creating an inbox duplicate.

After an upgrade, an older active bundle may initially report no structured
checkpoint. The agent reads its legacy progress and handoff prose once, creates
the checkpoint, and then uses only the checkpoint for resumable state.

## Broad or uncertain work

When important dependent choices are still unresolved, ask:

> Help me shape the account-security direction before we decide what to build.

After you confirm this deliberate mode, the agent creates a Wayfinder map in
the same bundle. It fixes the destination, keeps still-vague in-scope questions
as fog, and turns precise questions into claimable issues. Each session resolves
one decision or investigation; the full answer stays in its issue.

When the route is clear, the agent reads every resolved issue, synthesizes a
normal specification and stable acceptance criteria, and only then creates
delivery issues. It does not jump from the map directly into implementation or
create a competing strategy document.

## Resume after interruption

Say:

> Resume the active work.

The agent asks the workflow for the exact stage-specific file list, reads those
files completely, including their discovery ledgers, and restores the task
from the bundle and exact claim—not from chat memory. Internally it starts with
`wfctl work context --stage resume` and does not need you to know the work ID.
Exactly one bound record may be selected automatically. With several active
records, the agent explains their human outcomes and asks which one you mean;
it never guesses from recency or branch name. Confirm any unresolved checkout
or product decision before it continues.

## Honest endings

Completion is not the only valid outcome:

- `completed` means the accepted scope is implemented and verified;
- `partial` preserves delivered work and explicit gaps;
- `abandoned` preserves the investigation and explains why work stopped.

Accepting a partial result is safer than allowing the agent to rewrite the
scope until everything appears complete.

## Next

Continue with
[04 — Use the knowledge repository](04-knowledge-repository.md).
