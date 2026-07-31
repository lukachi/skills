---
name: manage-project-work
description: "Classify and route project work through the central knowledge-backed workflow. Use when a requested feature, fix, refactor, migration, investigation, operational change, product decision, or architecture change may be significant; when resuming active work after interruption; or when a useful lightweight result has no active or curated owner yet. This is the default project-work router: it decides between lightweight work, a pending capture, a bounded change, and deliberate Wayfinder, then maintains the owning active checkpoint."
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
  a pending capture only when a non-obvious reusable result should survive and
  no active change or curated concept already owns it.
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
question, or next action. Before continuing after such a turn, first update the
owning semantic record, then refresh its checkpoint last:

1. append a concise proposed, approved, rejected, deferred, or superseded
   ledger entry;
2. update affected current state, scope, acceptance, issues, decisions, and
   evidence;
3. preserve rationale without copying the chat transcript;
4. run `wfctl work checkpoint <id>` for bundle-level discussion, or add
   `--issue <issue-id>` for a claimed issue. Supply current state, last
   completed action, exact next action, blockers, and actor.

The checkpoint hash binds the record after those edits. Never edit its YAML by
hand. If any owned record changes afterward, `wfctl work context` reports the
checkpoint stale and the agent must refresh it before claiming or closing work.

After compaction or interruption, run context/status, read every required file
in full, inspect the checkpoint shown first, and resume from recorded state and
exact worktree claims. A checkpoint locates the frontier; it never replaces the
required full reads. Never reconstruct the task from conversation memory.

If an upgraded legacy bundle has no structured checkpoint, read its current
record and former Progress/Handoff sections completely, then run `wfctl work
checkpoint` once to adopt the new model. Preserve the old prose as lineage, but
do not maintain a second resume state afterward.

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

## Pending capture

Do not create a capture when an active change, issue, intake case,
reconstruction, or curated concept already owns the material; update that owner
and its checkpoint instead. When useful lightweight material genuinely has no
owner and the maintainer accepts retaining it, run:

```sh
wfctl work capture add <slug> --title "<fact to retain>"
```

Complete the returned pending capture. It remains non-authoritative until the
knowledge agent routes it to a real destination or discards it through
`wfctl work capture resolve`. Never copy active progress into `changes/inbox/`
and never cite raw or intake material as current truth.
