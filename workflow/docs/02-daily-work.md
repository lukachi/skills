# 02 — Work day to day

## Use this when

Use this guide whenever you discuss, implement, or resume project work with an
agent.

## Problem

A task often begins as a conversation and changes as its constraints become
clear. If the conversation is the only record, compaction, a new session, or a
second repository can destroy the real plan.

## Outcome

Every consequential task has one durable record that follows it from early
discussion through implementation, verification, and honest closure.

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

1. Create one living work record before extended discussion.
2. Record material requirements, constraints, alternatives, answers, and
   decisions after each meaningful conversation turn.
3. Bind the record to the exact repository checkout or worktrees where code
   may be changed.
4. Investigate source through Graphify and compare the task with current
   knowledge.
5. Show a short framing packet: outcome, scope, exclusions, decisions,
   unknowns, and acceptance criteria.
6. Wait for your explicit framing approval.
7. Implement only in the bound leaf checkout—not in the knowledge repository.
8. Verify the actual implementation and show evidence, deviations, and risks.
9. Ask for your completion decision and archive the real outcome.

Correct the framing as soon as something is wrong. Silence is not approval.

## Where the record and code live

The canonical record lives in the knowledge repository under
`changes/active/`. Source code remains in its owning leaf repository.

The agent stores local path bindings separately and verifies them before every
implementation or completion action. A worktree is not a special workflow
mode, but its exact identity matters: changing branches or checkouts cannot
silently redirect the task.

If one outcome spans several repositories, the agent binds the relevant
worktrees to the same record. Each leaf receives its own final verification
receipt.

## Lightweight work

Clearly local presentation polish, copy changes, formatting, or mechanical
corrections that preserve behavior and contracts may skip the full workflow.

If the impact is ambiguous, the agent explains the risk and recommends either:

- use the significant-work record; or
- proceed lightly and optionally retain a compact handoff afterward.

You choose. The workflow should not turn every edit into a ceremony.

## Broad or uncertain work

When important dependent choices are still unresolved, ask:

> Help me shape the account-security direction before we decide what to build.

After you confirm this deliberate mode, the agent uses the same living record
to map the destination, affected Areas, domain language, decision frontier,
uncertainty, tradeoffs, and non-goals. It asks one focused question at a time
and records each material answer before continuing.

When a bounded change becomes clear, that same record continues into normal
planning. The agent does not create a competing strategy document.

## Resume after interruption

Say:

> Resume the active work.

The agent restores the task from the canonical record and workflow status, not
from chat memory. Confirm any unresolved checkout or product decision before it
continues.

## Honest endings

Completion is not the only valid outcome:

- `completed` means the accepted scope is implemented and verified;
- `partial` preserves delivered work and explicit gaps;
- `abandoned` preserves the investigation and explains why work stopped.

Accepting a partial result is safer than allowing the agent to rewrite the
scope until everything appears complete.

## Next

Continue with
[03 — Use the knowledge repository](03-knowledge-repository.md).
