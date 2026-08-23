# Verification

You cannot do this yourself. The agent that wrote the tests can write the review
that approves them, and it will.

Delegate it to a separate agent. It receives the diff, the framing as approved,
and the repository. It does not receive this session, your reasoning, or your
account of why anything was done — reading the justification is what makes a
reviewer accept it.

Its goal is to break the work, not to confirm it. Every attack is an executable
test: written, run, and returned with its source, its output, and its verdict.
Prose findings are settled by whoever writes more confidently; a test that runs
is settled by running it.

The tests and the review are ephemeral. Nothing is added to the suite.

Run the stub check: replace the implementation with something that does nothing
and run the tests again. Anything still passing was testing itself.
