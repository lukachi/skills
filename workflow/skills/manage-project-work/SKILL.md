---
name: manage-project-work
description: "Classify and route project work through the central knowledge-backed workflow. Use when a requested feature, fix, refactor, migration, investigation, operational change, product decision, or architecture change may be significant; when resuming active work after interruption; or when retaining a useful lightweight handoff. This is the default project-work router: it decides between lightweight work, a bounded change, and deliberate Wayfinder, then invokes the appropriate explicit mode."
---

# Manage Project Work

Choose the least expensive path that preserves important intent, progress, and
evidence. Operate `wfctl` yourself; the maintainer supplies product authority,
corrections, and review decisions rather than managing files or commands.

## Route the request

Treat work as significant when it may change observable behavior, domain
meaning, a contract, state, security, reliability, operations, architecture,
ownership, or cross-repository coordination. Size alone is not decisive.

- **Lightweight:** clearly local and behavior-preserving. Work directly. Offer
  `wfctl work handoff` only when a non-obvious reusable fact should survive.
- **Bounded significant change:** the outcome can be specified honestly now.
  Start one central bundle and use `specify-project-change`.
- **Wayfinder:** a consequential destination is visible, but dependent product
  or architecture choices make an honest spec impossible across one session.
  Recommend `shape-project-direction`; enter only after maintainer agreement.

If classification is genuinely ambiguous, explain the material risk, recommend
one route, and ask for the maintainer's choice. Do not force full ceremony onto
trivial work or hide a significant change as lightweight.

## Start one canonical bundle

Create the bundle before extended significant-task discussion so the reasoning
survives compaction:

```sh
wfctl work start <slug> --title "<title>" --mode full|slice|wayfinder
```

Start from one leaf for single-repository delivery. Start from knowledge with
no leaf for project-only work, or repeat `--leaf` for known multi-repository
scope. Do not bind guessed leaves merely because Wayfinder may need them later.

Run `wfctl work status <id>` and `wfctl work context <id> --stage shape`.
Use the returned bundle in knowledge for records and only the returned code
roots for implementation. Never create a competing spec or issue tracker in a
leaf.

## Persist the conversation

A turn is material when it changes a requirement, constraint, idea,
alternative, decision, rejection, deferral, scope boundary, evidence, risk,
question, or next action. Before continuing after such a turn:

1. update current state and handoff;
2. append a concise proposed, approved, rejected, deferred, or superseded
   ledger entry;
3. update affected scope, acceptance, issues, decisions, and progress;
4. preserve rationale without copying the chat transcript.

After compaction or interruption, run context/status, read every required file
in full, and resume from recorded state and exact worktree claims. Never
reconstruct the task from conversation memory.

## Route the active bundle

- Use `shape-project-direction` only for deliberate Wayfinder.
- Use `specify-project-change` to synthesize bounded work or collapse a clear
  map into stable acceptance criteria.
- Use `split-project-change` when approved work needs several dependency-aware
  sessions.
- Use `implement-work-item` for exactly one frontier issue. A small bounded
  change may be implemented directly from `change.md` after framing approval,
  while preserving the same workspace and progress rules.
- Use `verify-project-work` for complete file accounting, spec/implementation
  reconciliation, knowledge promotion, completion review, and archival.

`changes/active/<id>/` is already the knowledge-side living record. There is
no final dump into `raw/`. Completed closure moves the entire bundle intact to
`changes/archive/<id>/`; verified durable truth is separately curated into
`knowledge/`.

## Lightweight handoff

When the maintainer accepts retaining a useful lightweight result, run:

```sh
wfctl work handoff <slug> --title "<fact to retain>"
```

Complete the returned inbox record. It is a non-authoritative candidate until
normal knowledge review; never cite raw or intake material as current truth.
