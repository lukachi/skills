# Completion gate

A completed record requires:

- every plan and acceptance checkbox resolved;
- at least one relevant Graphify query recorded;
- at least one curated knowledge concept recorded for significant work;
- `acceptance_reviewed: true`;
- `implementation_reviewed: true`;
- one or more fresh checks with commands and outcomes;
- `verification.result: passed`;
- no unresolved item without an explicit accepted disposition;
- a deviations section that says `None` or names every remaining gap.

The CLI validates the record's structure. It cannot establish semantic correctness. The agent and maintainer remain responsible for the truth of recorded evidence.

If a requirement is intentionally dropped, update scope and record who accepted the change. Do not merely check it off.
