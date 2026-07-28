# Completion gate

A completed record requires:

- every plan and acceptance checkbox resolved;
- at least one relevant Graphify query recorded for code-scoped work;
- at least one curated knowledge concept recorded for significant work;
- `acceptance_reviewed: true`;
- `implementation_reviewed: true` for code-scoped work, or
  `knowledge_reviewed: true` for project-only work;
- `maintainer_review.framing.status: approved` with a human actor and timestamp;
- `maintainer_review.completion.status: approved` with a human actor and timestamp;
- `knowledge_promotion.status: applied` with validated concept paths, or
  `not-needed` with a concrete reason;
- one or more fresh checks with commands and outcomes;
- `verification.result: passed`;
- no unresolved item without an explicit accepted disposition;
- a deviations section that says `None` or names every remaining gap.
- every bound source checkout clean so each recorded commit actually contains
  its verified implementation;
- a matching revision, worktree ID, and checks receipt for every bound
  repository. Single-leaf work may use the top-level verification fields;
  multi-repository work uses `verification.repositories`.

The CLI validates the record's structure and any promoted concept files. It
cannot prove that a conversation occurred, that semantic evidence is correct,
or that no material claim was omitted. The agent must record a maintainer
approval only after an explicit decision, and the maintainer remains
responsible for that decision.

If a requirement is intentionally dropped, update scope and record who accepted the change. Do not merely check it off.
