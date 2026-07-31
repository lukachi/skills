# 08 — Review, correct, and recover

## Use this when

Use this guide when the agent needs a decision, work has drifted, a session was
interrupted, a checkout changed, or the workflow itself needs maintenance.

## Problem

Evidence can establish implementation and external facts, but it cannot always
establish product intent. Agents also fail in predictable ways: they infer
missing decisions, trust fluent prose, lose checkout context, or redefine
completion around unfinished work.

## Outcome

You know which decisions belong to you, what the agent must prove, and how to
resume or stop work without losing its useful state.

## Your authority

You own:

- project purpose and product intent;
- corrections, scope, and priority choices;
- decisions that available evidence cannot establish;
- approval of the implementation framing;
- acceptance of completed, partial, or abandoned outcomes;
- authorization for commits and other external state changes.

The agent owns routine CLI use, source and knowledge investigation, living
record maintenance, verification, and proposed knowledge updates.

## What a useful review packet contains

The agent should not ask you to inspect an internal ledger or repeat its
investigation. It should show:

- the decision in project language;
- current evidence and its limits;
- the recommended choice and tradeoffs;
- which records or behavior will change;
- what remains blocked if you defer.

Approve, correct, reject, or explicitly defer. An unanswered question remains
unresolved.

## Common situations

| Situation | What to do |
| --- | --- |
| The agent misunderstood the goal | Correct it immediately. It must update the living record before continuing. |
| Product intent is unknown | Decide it or explicitly defer it. Do not let implementation become intent by default. |
| Code and knowledge disagree | Ask for a conflict packet, then identify whether implementation, recorded intent, or both are stale. |
| The session was compacted or restarted | Ask to resume. The agent reads the current checkpoint, canonical record, and exact workflow context. |
| You changed branch or worktree | Tell the agent. It must stop until you approve an explicit rebind. |
| The task cannot be completed | Accept a truthful partial or abandoned outcome with gaps preserved. |
| New raw files appeared | Ask the knowledge agent to process the new raw material. |
| An unowned significant finding came from lightweight work | Ask the agent to capture it for later triage. If an active record already owns it, update that record instead. |
| The workflow has an update | Ask the agent to preview and apply the upgrade in the current repository. |

## Correct false completion

Do not accept “done” without:

- evidence for every acceptance criterion;
- explicit deviations and remaining risks;
- a clean, correctly bound implementation revision;
- separate receipts for every affected repository;
- the resulting knowledge update or an honest reason no update is needed.

Deterministic checks prove structure and accounting. The agent still has to
perform semantic verification against the real implementation.

## Recover from a wrong checkout

Work records bind repository, revision, branch, checkout, and worktree
identity. If those no longer match, the agent must not guess where to write
code.

Choose whether to return to the original checkout or approve a rebind. A rebind
records the transition instead of rewriting history.

## Upgrade safely

From the repository being upgraded, you may run:

```sh
wfctl upgrade
```

Or ask:

> Upgrade the workflow in this repository.

The agent previews changes and conflicts first. Existing text outside managed
blocks remains untouched. Restart the session afterward so updated skills are
loaded.

## Result

The workflow keeps authority human, evidence explicit, and incomplete work
recoverable without depending on chat memory.

## Continue

Return to [the project overview](../README.md), or consult the
[engine contract](../spec/ENGINE.md) when developing the workflow itself.
