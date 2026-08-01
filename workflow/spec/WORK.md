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
  approved decisions, overall progress, its structured checkpoint,
  verification, and knowledge delta;
- `map.md` is a low-resolution Wayfinder index: destination, standing notes,
  resolved ticket pointers, fog, and out-of-scope boundaries;
- `issues/` owns bounded questions or delivery units, dependency edges,
  checkout claims, one checkpoint per issue, resolutions, and evidence;
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

## Active checkpoints

A checkpoint is the single concise resume state owned by an active execution
unit. `change.md` owns the checkpoint for shaping, direct bounded work, and
final review. Each issue owns its own checkpoint so independent claims can
resume without overwriting another issue's state.

Every checkpoint records:

- ready, active, blocked, or complete status;
- shaping, Wayfinder, implementation, review, or complete stage;
- actor and update time;
- current state and last completed action;
- one exact next action;
- explicit blockers;
- a SHA-256 basis over the owning record excluding the checkpoint itself.

The agent updates semantic content first and runs `wfctl work checkpoint` last.
If the record changes afterward, the basis no longer matches and stage context
reports the checkpoint stale. Claim, review, or completion may not use a stale
checkpoint. This proves which record state was summarized, not that the summary
is semantically honest; full-file reading and review remain mandatory.

### Discovery ledger

The semantic owner also keeps a broad discovery ledger. A discovery must be
preserved when its loss could cause a fresh session to repeat material
investigation, choose differently, misunderstand the work, or act unsafely.
The trigger is consequence, not a closed category such as trap, finding, fact,
or lesson.

Each entry records the observation and uncertainty, direct evidence or missing
evidence, implication, applicable scope or lifetime, and current disposition.
The entry may link a larger artifact but keeps ownership explicit. Invalidated
entries remain as lineage with an updated disposition. Routine activity is not
a discovery. The checkpoint may reference an entry and its frontier effect but
does not duplicate it.

New change and issue schema versions require the ledger section. Context
validation accepts an empty ledger, but every real `DISC-*` entry must have a
unique stable ID and non-empty values for all five fields. This proves record
shape, not that the agent noticed every consequential observation.

On a clean session, `wfctl work context --stage resume` without an ID resolves
only an unambiguous single binding. The agent reads the reported checkpoint and
every required file, including complete discovery ledgers, before it acts.
Multiple bindings require a maintainer selection; directory, recency, branch,
or repository name may not select implicitly.

Issue creation, claim, release, completion, and drop transition their
checkpoints automatically. A material turn during a claim still requires an
explicit refresh. Multiple concurrent issues keep separate checkpoints; active
state is never copied into `changes/inbox/`.

## Pending captures

Material that is worth retaining but has no active change, issue, intake,
reconstruction, curation, or knowledge owner may enter
`changes/inbox/<capture-id>.md`. It is a pending, non-authoritative capture—not
a checkpoint, issue, or current project claim.

The knowledge agent lists and reads captures completely. A pending capture may
remain while authority or destination is missing. It becomes terminal only
when the agent either:

- creates and verifies every real `knowledge/` or `changes/active/`
  destination, then resolves it as `routed`; or
- resolves it as `discarded` with a reason.

Resolution moves the receipt to `changes/archive/captures/`. The archive proves
disposition and lineage, not truth. Existing legacy inbox handoffs remain
readable and are normalized when resolved.

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

Every change schema that carries the bundle layout is subject to this gate. A
new schema version that is not listed as gated would silently disable
acceptance, issue, receipt, and checkpoint checking, so the supported and gated
version sets are single constants with a regression test binding them to the
distributed bundle template.

## Maintainer approval

Framing and completion approvals are recorded by `wfctl work approve`, not by
editing `maintainer_review`. The command requires an interactive terminal, or an
out-of-band token supplied through `WFCTL_APPROVAL_TOKEN`, and writes both the
receipt in `change.md` and a durable approval record under ignored runtime
state. Verification and completed closure reject a receipt whose approval record
is missing or inconsistent.

This is provenance, not authentication. Nothing here proves which person typed
the confirmation. What it does establish is that the approval was produced by a
separate deliberate command rather than by the same unattended edit that wrote
the work being approved. Bundles created before approval receipts existed keep
their original contract so an upgrade cannot invalidate completed work.

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
