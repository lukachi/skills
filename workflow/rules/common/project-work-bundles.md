# Central project work bundles

The agent owns routine `wfctl work` commands and structured records. The
maintainer supplies intent, corrections, authority, and explicit review
decisions; do not make them operate the tracker.

For significant work, create exactly one bundle under
`changes/active/<change-id>/` before extended discussion. `change.md` is the
parent contract, `map.md` is optional Wayfinder lineage, `issues/` contains
bounded work, `artifacts/` contains referenced support, and `review.md` records
full-file accounting. A leaf stores only an ignored binding pointer.

After every material maintainer turn, update current state, decisions,
acceptance, progress, and handoff before continuing. After interruption or
compaction, run `wfctl work context` and `wfctl work status`, read every required
file completely, and resume from the bundle rather than conversation memory.

Before claiming an issue, record a current review receipt for every required
context file. Claim from the exact bound leaf before code work. Never infer a
worktree from repository name, branch, sibling paths, or bundle location.

Wayfinder is deliberate and planning-only. It resolves precise question issues
and fog into a reviewed specification before any delivery issue or product-code
implementation begins.

Before completed closure, enumerate the entire bundle with `wfctl work context
--stage review`, re-read every file, refresh stale receipts, reconcile every
stable acceptance ID against direct evidence, promote durable truth separately,
and obtain explicit maintainer completion approval.
