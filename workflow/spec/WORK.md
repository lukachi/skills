# Project work bundle contract

## Status

This document is normative for significant project work, direction shaping,
delivery issues, claims, review accounting, and archival. The engine and CLI
contracts own repository binding and command safety; this contract owns the
content and state of one change bundle.

## One durable bundle

Every significant initiative has one canonical directory in the knowledge
repository:

```text
changes/active/<change-id>/
├── change.md
├── map.md                  # only when Wayfinder is used
├── issues/
│   └── ISSUE-NNN-<slug>.md
├── artifacts/
│   └── <supporting material>
└── review.md
```

The directory moves intact to `changes/archive/<change-id>/` when work closes.
A leaf checkout stores only an ignored runtime pointer to the bundle and its
exact repository/worktree binding. It never owns a second spec or tracker.

The files have distinct authority:

- `change.md` owns the current problem, outcome, scope, stable acceptance IDs,
  approved decisions, overall progress, verification, and knowledge delta;
- `map.md` is a low-resolution Wayfinder index: destination, standing notes,
  resolved ticket pointers, fog, and out-of-scope boundaries;
- `issues/` owns bounded questions or delivery units, dependency edges,
  checkout claims, progress, resolutions, and evidence;
- `artifacts/` holds referenced research or prototypes, never unlinked
  alternative specifications;
- `review.md` records complete file accounting at exact content hashes.

Knowledge remains the statement of current project truth. A closed bundle is
the evidence-backed history of how a change was shaped and delivered; it does
not become current truth merely because it was archived.

## Stable acceptance and issue graph

Acceptance criteria live in `change.md` metadata and use stable IDs such as
`AC-01`. Rewording a criterion preserves the ID when its meaning is unchanged;
a materially different requirement receives a new ID and the old decision is
retained in the ledger.

Delivery issues are tracer-bullet units sized for one fresh agent session when
possible. Each issue declares:

- its phase and type;
- the acceptance IDs it contributes to;
- its repository scope;
- explicit blocking issue IDs;
- one current checkout claim, if work is in progress;
- a resolution and reviewable evidence before completion.

The issue graph must be acyclic. The frontier is the set of ready, unclaimed
issues whose blockers are completed. A dropped blocker never silently
unblocks its dependants; their dependency edges must be reviewed explicitly.

Issues are optional for a small bounded change that fits safely in the
canonical `change.md`. Once issues exist, every acceptance criterion must be
covered by at least one non-dropped delivery issue.

## Wayfinder

Wayfinder is a deliberate pre-specification phase for a consequential effort
whose route cannot fit honestly in one session. It is not the default for a
large but already bounded task.

1. Name the destination and explicit out-of-scope boundary.
2. Create only the questions that can already be stated precisely.
3. Keep still-vague, in-scope uncertainty in `map.md` as fog; do not invent
   premature tickets.
4. Resolve one non-research frontier issue per session. Research issues may be
   worked independently when their evidence does not overlap.
5. Claim an issue before work so another session will not select it.
6. Store the full answer in the issue. Add only a one-line named pointer to the
   map, then create newly visible questions and remove the corresponding fog.
7. Produce decisions and facts, not destination implementation. A prototype
   is an artifact used to answer a question, not production delivery.
8. When no open issue or unresolved fog remains, synthesize the complete map
   into `change.md`, define stable acceptance criteria, and explicitly finish
   Wayfinder into `full` or `slice` delivery mode.

The map stays in the bundle as decision history. Delivery issues are created
only after the map has been collapsed into an approved specification. The
agent must not jump directly from an unresolved map to product code.

## Context and review accounting

An agent never treats a directory name as proof that all content was read.
Before shaping, resuming, working an issue, or reviewing completion it asks
`wfctl` for the stage-specific context. The result lists the exact required
files, issue frontier, repository bindings, and each file's accounting state.

Before final verification, every bundle file except `review.md` must have an
explicit receipt at its current SHA-256 hash:

- `reviewed` means the whole file was read and reconciled for the current
  stage;
- `irrelevant` is allowed only for a supporting artifact and requires a
  reason;
- `unseen` means no receipt exists;
- `changed-after-review` means the file changed after its receipt;
- `invalid` means its schema or graph relation is malformed.

The receipt proves explicit accounting, not comprehension. Semantic review by
the agent and maintainer remains required. `wfctl work verify` and completed
closure fail on missing or stale receipts, malformed issues, cycles, open
claims, incomplete issues, uncovered acceptance criteria, or unresolved
Wayfinder state.

## Concurrency and worktree safety

An issue claim records the exact repository, branch, commit, worktree ID, and
local checkout selected from the existing work binding. A delivery issue with
source scope must be claimed from a bound leaf, never from the knowledge
checkout. Project-only and Wayfinder issues may be claimed from knowledge.

Claims coordinate sessions sharing one knowledge checkout. Teams using
multiple clones must also synchronize the tracked bundle through their normal
Git collaboration; the workflow does not pretend a local filesystem lock is a
distributed lock.

Before code edits, after directory changes, after compaction, and before
verification, the agent re-reads the context and checks every code root. A
worktree is an exact workspace, not a repository alias.

## State transitions

```text
wayfinder/charting -> ready-for-spec -> shaping -> active -> completed
                                      \-> partial | abandoned
```

- Wayfinder may finish only when its fog is empty and every map issue is
  completed or explicitly removed from the route.
- `shaping` becomes `active` only after knowledge/source alignment and explicit
  framing approval.
- An issue moves `draft -> ready -> claimed -> completed`; it may be dropped
  with a recorded reason.
- A completed change closes only after semantic verification, clean exact
  source revisions, complete bundle review, maintainer completion approval,
  and knowledge promotion or a concrete no-update reason.

`wfctl` enforces structure and exact identities. It does not declare product
meaning correct, approve decisions, or promote a bundle into truth by itself.
