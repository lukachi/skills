# Adversarial verification

**Use when a claim matters and the person making it wrote the evidence.**

The agent writes the criteria, writes the tests, writes the code, and reports
that its tests pass its criteria. Every term in that sentence has the same
author. Reviewing harder does not help — the failure is structural.

## The shape

- **A different agent**, and it does not receive your reasoning. It gets the
  diff, the framing as approved, and the repository.
- **Every attack is an executable test.** A prose finding is settled by whoever
  writes more confidently; a test that runs settles it without either of them.
- **Prompt to refute, not to check.** "Try to break this" and "review this"
  produce different work. Where a claim can fail in more than one way, give each
  reviewer a distinct lens rather than running the same one twice.
- **Silence is not success.** A reviewer that broke nothing must still say what
  it tried and why it held.
- **Run the stub pass.** Replace each implementation with a constant and run the
  tests again. Anything still green asserts nothing. It needs no judgment and it
  catches most fake green.

`wfctl work verify --brief <lens>` prints the brief to hand over, including the
shape the artifact must come back in. Do not compose it from memory.
