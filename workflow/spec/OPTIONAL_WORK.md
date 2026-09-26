# Optional work records

This is the active overview for change records and agent recovery in `wfctl`.
[ENGINE.md](ENGINE.md), [WORK.md](WORK.md), and [CLI.md](CLI.md) define the current mechanics. Promotion, review, and knowledge curation are separate design work and are not defined here.

## Ordinary work

An agent handles the user's request normally. No workflow record, namespace, startup brief, recall counter, claim, or review step is needed before editing source or completing a request. The CLI does not classify work as lightweight or significant.

At a useful pause, the agent may offer to preserve a specific delivery or task. It names what would be recorded and checks existing scopes first. An explicit request or an accepted offer authorizes record creation. A declined or unanswered offer creates nothing and does not delay the ordinary work.

## Durable project records

A bundle is an agreed delivery scope. It may be a feature, a collection of features, or a milestone. It may grow through further agreement. A bundle can exist without units.

A unit is an agreed task contract inside exactly one bundle. Its document records the intended outcome, boundary, decisions, progress, and completion evidence. An action, file, bug, step, or session is not automatically a unit.

The authoritative documents are human-editable Markdown:

```text
changes/active/<bundle-id>/change.md
changes/active/<bundle-id>/units/<unit-id>.md
```

The CLI creates these only through explicit commands with agreement text. It never regenerates them from hidden JSON. Subsequent edits to their meaning require agreement; routine progress may be recorded in the current document. Supporting research, plans, specifications, and evidence are retained as tracked project material when their meaning warrants it. File names alone do not decide their value.

Existing records are read before creating another. Creating a bundle with an existing directory or a unit with an existing file is refused. Concurrent collaborators reconcile tracked Markdown through normal repository collaboration. The CLI does not claim a distributed lock.

## Agent recovery

A flow is one small, replaceable checkpoint and handoff for one thread of one agent. It carries the current instruction, last completed action, next action, unresolved questions, and links needed to resume. It does not own bundle or unit contracts, accumulated notes, reviews, or a history of previous checkpoints.

A maintainer, user, orchestrator, or management process explicitly selects the agent namespace. Commands require that namespace and the thread id; none is inferred from a checkout, session, newest file, or bundle. Different agents in one repository use different namespaces. Ordinary work can proceed without a namespace or flow.

Recovery notes live under `.workflow/flows/<namespace>/<thread>.md` and are ignored by Git. There is no repository-wide current pointer. A fresh clone has durable project records but none of another agent's local recovery notes.

## Installation

The installed skill describes when records are useful. No session-start, pre-write, or stop hook is installed. No executable runtime scripts are copied into project repositories. The CLI may be invoked voluntarily. An explicit `init` with this version removes earlier wfctl-owned hooks; unrelated host hooks are preserved.

## Tidying

Tidying is a user-guided semantic reconciliation of `changes/`, excluding `changes/archive/`. It can merge or clean bundles and units. The installed guide describes where to inspect, what relationships to consider, and when to resolve meaning with the user. It is not a CLI state machine.
