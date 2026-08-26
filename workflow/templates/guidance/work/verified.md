# Verification

A green build proves the build is green. Completion is a claim about what the
product now does, and it holds only because someone looked.

The tool refuses an incomplete accounting on its own — a stale receipt, an open
unit, an unapproved framing, a dirty checkout. It cannot tell reading from
recording, a check that proves something from one that merely passes, or a
criterion nobody exercised from one that failed. Those are yours.

See [the completion gate](../references/completion-gate.md) when a refusal names
a requirement you have not met, or when deciding what a partial closure must say.

## You cannot do this yourself

The agent that wrote the criteria, wrote the tests and wrote the code will report
that its tests pass its criteria. Every term in that sentence has the same
author.

Delegate it. The reviewer receives the diff, the framing as approved, and the
repository. It does not receive this session, your reasoning, or your account of
why anything was done — reading the justification is what makes a reviewer accept
it.

**The brief comes from the tool, not from you:**

  wfctl work verify --brief <lens> --at <fixed point>

It carries the lens question, the rules, the stub pass, and the exact shape the
artifact must come back in. Nothing printed it until 2026-08-26, so briefs were
composed from memory and the stub pass reached the reviewer only by luck.

## The stub pass

Stub each implementation under review to a constant and run the tests again.
Anything still green asserts nothing. It needs no judgment, it catches most fake
green, and the review is refused without it — reported whether or not it found
anything, because an empty survivor list with no account of the pass cannot be
told from a pass that never ran.

A survivor is answered like a finding: repair it, or accept it with a reason.
Accepting is for a test this work does not own.

## Pin the fixed point first

The diff runs from the revision this work started at to the current `HEAD` of
each bound code root. Take the start from the record: the claim on the first
delivery unit carries it.

Capture the diff command once, per repository — `git diff <fixed-point>...HEAD`,
three-dot so the comparison is against the merge-base, plus `git log
<fixed-point>..HEAD --oneline`. Confirm the ref resolves and the diff is
non-empty before dispatching anything: a bad ref should fail here, not inside two
subagents.

## Two axes, in parallel, never merged

- **Standards** — does the code conform to this project's documented standards?
- **Spec** — does the code faithfully implement what the framing asked for?

Run them in separate subagents so neither pollutes the other's context. Give the
standards reviewer the diff commands, the standards the repository documents
about itself, and [the smell baseline](../references/smell-baseline.md). Give the
spec reviewer the diff commands and the framing.

Present both verbatim under their own headings. **Do not merge or rerank the
findings**, and do not pick a single winner across axes — that is the reranking
the separation exists to prevent.

A change can pass one and fail the other. Code that follows every standard and
implements the wrong thing passes Standards and fails Spec. Code that does
exactly what was asked and breaks the project's conventions passes Spec and fails
Standards. Reporting them separately stops one axis from masking the other.

## Every attack is an executable test

Prose findings are settled by whoever writes more confidently. A test that runs
is settled by running it. The reviewer writes it, runs it, and returns the
source, the output, and whether it broke anything.

If it could not break the work, it says exactly what it tried and why it held.
"Looks correct" is not an allowed answer, and a review with no findings and no
recorded attacks is indistinguishable from one that never ran.

The tests and the review are ephemeral. Nothing is added to the suite.

## The checks that need no judgement

1. **Stub the implementation** to a constant and run the tests again. Anything
   still passing was testing itself.
2. **Invert each meaningful condition** in the diff. If no test fails, that
   branch is untested whatever the coverage says.
3. Does any assertion check a mock's call rather than an observable outcome?
4. Does any test build its expected value with the same path it is testing?

## Look where a passing suite hides things

Open the real diff and the production path in every bound code root: source,
callers, boundaries, state, errors, consumers.

Hunt what a green suite conceals — a disabled path, a placeholder, a mock
standing in for the thing, a fixture doing the work, temporary compatibility
code, an unhandled branch, work quietly deferred.

Take each acceptance criterion and find three things: the production behaviour
that delivers it, the evidence that it does, and the path a person using or
operating the product reaches it by. An expected value read off the
implementation confirms the implementation to itself.

## Read the diff backwards as well

Forwards — from each criterion, look for its delivery — finds missing work.
Backwards — from each changed file, ask what the framing said about it — finds
work nobody asked for, and nothing else catches that.

## Then

Refactoring belongs here rather than in the implementation loop. Run the focused
behaviour checks and the broader test, build, type, lint and runtime checks.

Ask before you commit. Closure requires a clean checkout whose recorded commit
contains the reviewed implementation, and the gate cannot see whether anyone
agreed to the commit that made it clean.

For project-only work, verify decisions, knowledge and links, and let code
evidence stay absent rather than invented.
