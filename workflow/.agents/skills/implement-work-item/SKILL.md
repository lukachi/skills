---
name: implement-work-item
description: Claim and implement exactly one ready issue from a central change bundle, test-first at pre-agreed seams, in its exact bound leaf checkout. Use when the maintainer asks to implement a named or next frontier issue, or when resuming its existing claim.
---

# Implement Work Item

Build one bounded unit from a fresh, explicit context. The issue tracks local
progress; `change.md` remains the parent contract.

## Workspace invariants

- The central bundle is the record workspace. Each `Code root` from `wfctl work
  status` is an implementation workspace.
- A linked worktree is a distinct root even when it shares Git objects. Derive a
  checkout from the reported roots, never from a branch name, a repository name, a
  sibling path, or where `change.md` lives.
- Re-run status after a directory change, a branch change, compaction, and before
  verification.

## Load before claiming

1. Run `wfctl work issue show <change-id> <issue-id>` from the exact intended leaf.
   With no issue named, run `wfctl work issue list <change-id>` and choose a
   frontier issue.
2. Read every listed required file completely — the parent spec, the selected
   issue, transitive blockers, referenced artifacts.
3. After each complete read, run `wfctl work review file <change-id> <path>`. A
   receipt over headings, summaries, or excerpts is a receipt for a file nobody
   read.
4. Run `wfctl work status <change-id>` and confirm the current Git root equals the
   reported code root exactly.
5. Claim before analysis or edits:

```sh
wfctl work issue claim <change-id> <issue-id> --actor "agent:<identity>"
```

The claim records repository, branch, revision, and worktree identity. A mismatch
stops the work rather than selecting a sibling checkout.

## Confirm the seams

A **seam** is the public boundary you test at: the interface where you observe
behaviour without reaching inside. Tests live at seams.

**Test only at pre-agreed seams.** The specification records the seams the
maintainer confirmed. Where this issue needs one the spec does not carry, write
down the seams under test and confirm them before writing a test. Ask: what is the
public interface here, and which seams should we test?

You cannot test everything, and agreeing the seams up front is how the testing
effort lands on the critical paths and the complex logic instead of on every edge
case.

## Implement one tracer bullet

Invoke `analyze-with-graphify` in every repository this issue legitimately touches,
then inspect the actual source. Recheck the relevant curated knowledge with
`align-project-knowledge`. Text search supplements the graph.

Implement the smallest complete behaviour that satisfies this issue, one cycle at
a time:

1. Write one externally meaningful failing check at a confirmed seam.
2. Confirm it fails for the intended reason — **red before green**.
3. Make the minimum production change that passes it. Anticipate no future test
   and add no speculative feature.
4. Run the focused check.
5. Repeat. One seam, one test, one minimal implementation per cycle.

Typecheck regularly and run single test files regularly. Run the broader relevant
suite once, at the end.

**Refactoring is not part of this loop.** It belongs to the review stage, which
`verify-project-work` owns.

### What a good test is

Tests verify behaviour through public interfaces, not implementation details. The
code can change entirely and the tests should not. A good test reads like a
specification — "a player can accept a quest with a valid character" says exactly
what capability exists — and survives a refactor because it does not care about
internal structure.

Read [good and bad tests](references/tests.md) for worked examples, and
[when to mock](references/mocking.md) before standing anything in for a real
collaborator.

### Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private
  methods, or verifies through a side channel such as querying the database
  instead of using the interface. The tell: the test breaks on a refactor while
  the behaviour has not changed.
- **Tautological** — the assertion recomputes the expected value the way the code
  does, so it passes by construction and can never disagree with the code.
  Expected values come from an independent source: the approved contract, a
  known-good literal, a worked example.
- **Horizontal slicing** — all the tests first, then all the implementation. Bulk
  tests verify _imagined_ behaviour: they test the shape of things, go insensitive
  to real changes, and commit to a test structure before the implementation is
  understood. Work in vertical slices instead, each test a tracer bullet that
  responds to what the last cycle taught you.

## Keep the record current

After every material maintainer turn or investigation cycle, apply the
preservation test from `manage-project-work`: where losing what you just learned
could make a fresh session repeat material investigation, choose differently,
misunderstand the work, or act unsafely, append a complete entry to the issue's
`Discovery ledger` — observation, evidence, implication, scope, disposition.

Update evidence and current understanding next, then refresh the issue's single
structured checkpoint last:

```sh
wfctl work checkpoint <change-id> --issue <issue-id> \
  --actor "agent:<identity>" \
  --state "<current state>" \
  --last "<last completed action>" \
  --next "<exact next action>"
```

Use `--status blocked --blocker "<what you need from them>"` when the maintainer is
what the work is missing, and `--handoff "<why this session stops here>"` when
nothing is missing except this session. Record a deviation in the parent
`change.md` when it affects approved scope, acceptance, or decisions; refresh the
parent checkpoint and reopen framing review before continuing materially different
work.

The checkpoint may name the latest discovery and its effect on the next action. The
discovery itself stays in the semantic record or a linked artifact.

## Resolve honestly

Inspect the real diff and the production path. Record the commands, the direct
source evidence, the limitations, the placeholders, and any unresolved risk.

Ask before you commit. With that authorization, preserve the implementation in the
exact bound Git commit; `wfctl` never commits on its own.

Resolve only this issue:

```sh
wfctl work issue complete <change-id> <issue-id> \
  --summary "<delivered outcome>" \
  --evidence "<direct inspection or command result>"
```

Completion makes the issue checkpoint terminal; refresh the parent checkpoint with
the next frontier action. A partial outcome is not marked completed. Where the
issue is deliberately given back, `wfctl work issue release` resets it to ready.

Finishing a unit is not finishing: completing an issue releases its claim and
leaves the bundle holding ready issues nobody has claimed. The next unit is
available work.

A fresh session begins with `wfctl work context --stage resume`, reads every
required file and discovery entry completely, and resumes the existing exact
claim rather than inferring another issue, actor, or code root.

Change-wide review, the curated pages this work changes, and closure belong to
`verify-project-work` once every required issue is terminal.
