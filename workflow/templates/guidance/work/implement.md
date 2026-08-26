# Implementing this unit

Build one bounded unit from a fresh, explicit context. The unit tracks local
progress; the framing remains the parent contract.

## Where you are standing

Each code root reported for this flow is an implementation workspace. A linked
worktree is a distinct root even when it shares Git objects — derive a checkout
from the reported roots, never from a branch name, a repository name, a sibling
path, or where the record lives.

## Read the structure before you change it

Follow the graph outward from what you are touching: what calls it, what depends
on it, what already does something similar. Searching by string finds the name
you guessed; searching by structure finds what you did not know to guess.
Duplicating something that already exists, or contradicting an architecture you
never read, both look identical from inside the edit.

The source at the recorded revision, not the graph, is implementation authority:
open the locations the traversal returned. Text search supplements it, for exact
tokens, literals, and generated artifacts the graph does not carry.

A missing graph result is not proof that code does not exist.

## The seams

A **seam** is the public boundary you test at: the interface where you observe
behaviour without reaching inside. Tests live at seams.

Test only at pre-agreed seams. Where this unit needs one the framing does not
carry, write down the seams under test and confirm them before writing a test.
Ask: what is the public interface here, and which seams should we test?

You cannot test everything. Agreeing the seams up front is how the testing
effort lands on the critical paths and the complex logic instead of on every
edge case.

## One tracer bullet at a time

Implement the smallest complete behaviour that satisfies this unit, one cycle at
a time:

1. Write one externally meaningful failing check at a confirmed seam.
2. Confirm it fails for the intended reason — **red before green**.
3. Make the minimum production change that passes it. Anticipate no future test
   and add no speculative feature.
4. Run the focused check.
5. Repeat. One seam, one test, one minimal implementation per cycle.

Typecheck regularly and run single test files regularly. Run the broader
relevant suite once, at the end.

**Refactoring is not part of this loop.** It belongs to review.

## What a good test is

Tests verify behaviour through public interfaces, not implementation details.
The code can change entirely and the tests should not. A good test reads like a
specification — "a player can accept a quest with a valid character" says
exactly what capability exists — and survives a refactor because it does not
care about internal structure.

See [good and bad tests](../references/tests.md) for worked examples, and
[when to mock](../references/mocking.md) before standing anything in for a real
collaborator.

## Three anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private
  methods, or verifies through a side channel such as querying the database
  instead of using the interface. The tell: the test breaks on a refactor while
  the behaviour has not changed.
- **Tautological** — the assertion recomputes the expected value the way the
  code does, so it passes by construction and can never disagree with the code.
  Expected values come from an independent source: the approved contract, a
  known-good literal, a worked example.
- **Horizontal slicing** — all the tests first, then all the implementation.
  Bulk tests verify *imagined* behaviour: they test the shape of things, go
  insensitive to real changes, and commit to a test structure before the
  implementation is understood. Work in vertical slices instead, each test a
  tracer bullet that responds to what the last cycle taught you.

## Keep the record current

Checkpoint after every material turn. Not because a session is about to end —
that fear is what made agents stop halfway through a context that was still wide
open — but because a checkpoint is what a fresh session resumes from, and prose
that lives only in a message goes with the session.

## Finishing a unit is not finishing

Completing it releases the claim and leaves the flow holding units nobody has
taken. That is the shape every long run passes through, and the moment a turn is
most likely to end on "next I will do X" and then not. The next unit is
available work, and available work is yours.

A bug, a gotcha, or an improvement that is not this unit's job gets captured. It
does not become a bundle.

## Resolve honestly

Inspect the real diff and the production path. Record the commands, the direct
source evidence, the limitations, the placeholders, and any unresolved risk. A
partial outcome is not marked complete.

Ask before you commit. Nothing here commits on its own.

## When the last unit is delivered, verify

Do not ask first. Verification is the second half of implementing — deliver,
verify, fix what the review broke — and permission to check your own work is an
answer that is "yes" every time. The maintainer decides what the work is and
what the project then says about itself; whether the work gets checked is not
one of their two decisions, and putting it to them spends a turn and delays the
one step that can still find the change wrong.

  wfctl work verify --brief <lens> --at <fixed point>   # the brief to hand it
  wfctl work verify --review <artifact>                # what it returns

It is delegated to a separate agent because you cannot review your own work, not
because somebody has to open it. Do not write the reviewer's brief yourself —
the tool prints it, with the shape the artifact must come back in.
