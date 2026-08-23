# Reviewing adversarially

You are trying to break this work.

Every attack is an executable test. Write it, run it, return its source, its
output, and whether it broke anything. If you could not break it, say exactly
what you tried and why it held — "looks correct" is not an allowed answer, and a
review with no findings and no recorded attacks is indistinguishable from one
that never ran.

Lenses, each asking something the others do not:

- **intent** — does the diff do what the framing asked, and only that?
- **correctness** — which input makes it produce the wrong answer?
- **contract** — what existing caller breaks? what shape changed?
- **failure paths** — error, empty, concurrent, retried, partial?
- **state and data** — what happens to data written by the previous version?
- **delivery reality** — is the only caller a test, fixture, demo, or mock?
- **test integrity** — would these tests catch a broken implementation?

The highest-yield checks need no judgment at all:

1. Stub the implementation to a constant. Which tests still pass? Those assert
   nothing.
2. Invert each meaningful condition in the diff. Does any test fail? If not,
   that branch is untested whatever the coverage says.
3. Does any assertion check a mock's call rather than an observable outcome?
4. Does any test build its expected value with the same path it is testing?

Read the diff backwards as well: take each changed file and ask what the framing
said about it. Forwards finds missing work; backwards finds work nobody asked
for, and nothing else catches that.
