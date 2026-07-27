# Project work lifecycle

For significant work, follow these gates in order:

1. Analyze current behavior through Graphify.
2. Read the relevant curated knowledge, current decisions, and their provenance.
3. Resolve contradictions or unknown truth with the maintainer.
4. Create one central living spec with `wfctl work begin`.
5. Present the framing review packet and record explicit maintainer approval.
6. Keep that same file current while implementing.
7. Reopen framing review after material re-scoping.
8. Verify every acceptance criterion against the resulting code and fresh checks.
9. Present the completion review packet and record explicit maintainer approval.
10. Mark completion only when the verification record is honest and complete.
11. Flush with `wfctl work flush --outcome completed`.

The canonical active spec lives in the configured knowledge repository. A leaf repository may contain a pointer, never a competing copy.

For interrupted, rejected, or deliberately partial work, flush with an accurate `partial` or `abandoned` outcome. Never relabel incomplete work as complete to pass a gate.
