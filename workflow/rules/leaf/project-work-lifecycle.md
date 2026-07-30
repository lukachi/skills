# Project work lifecycle

The agent executes routine `wfctl work` commands and maintains the living spec.
The maintainer supplies intent, corrections, and explicit review decisions;
do not make them operate the CLI or edit workflow records.

For significant work, follow these gates in order:

1. Create one central `shaping` record with `wfctl work start` as soon as the
   task is classified as significant.
2. Run `wfctl work status <id>` and bind the task to every exact code root and
   the one spec path.
3. Update that spec after every material maintainer turn before continuing.
4. Analyze current behavior through Graphify from every bound repository that
   informs the change.
5. Read the relevant curated knowledge, current decisions, and their provenance.
6. Resolve contradictions or unknown truth with the maintainer.
7. Present the framing review packet and record explicit maintainer approval.
8. Set the record to `active`, then implement only in the bound code roots.
9. Reopen framing review after material re-scoping.
10. Reconcile every acceptance criterion against code from the bound root.
11. With normal maintainer authorization, preserve the implementation
    in the bound Git commit and require a clean checkout.
12. Run final checks against each exact commit. Record the single-leaf
    revision/worktree fields or one `verification.repositories` receipt per
    repository.
13. Promote any durable verified truth into `knowledge/`, or record why no
    current knowledge changed. Route stakeholder-facing behavior through
    `curate-product-knowledge`, technical realization through
    `curate-engineering-knowledge`, and every changed concept through
    `verify-knowledge-quality`.
14. Present the completion review packet and record explicit maintainer
    approval.
15. Mark the record completed only when verification and promotion records are
    honest and complete.
16. Compute each stable concept's content hash, then run `wfctl knowledge
    validate` and `wfctl knowledge build` using the root returned by status.
17. Run `wfctl work verify`, then close with `wfctl work close --outcome
    completed`.

The canonical active spec lives in the configured knowledge repository. A leaf repository may contain a pointer, never a competing copy.

The knowledge repository and the implementation checkout are separate
surfaces. Before code edits, after directory changes, on resume, and before
verification or close, run `wfctl work status <id>`. Use the reported `Code
roots` for code operations and the reported `Spec` only for spec/progress
updates. Never select a sibling checkout or main worktree by inference. A
branch or worktree change requires explicit `wfctl work rebind`.

On resume or after compaction, run status, read the entire spec, and recover its
current state, open questions, decision ledger, last completed action, and next
action. Never reconstruct these from conversation memory.

For interrupted, rejected, or deliberately partial work, close with an accurate `partial` or `abandoned` outcome. Never relabel incomplete work as complete to pass a gate.
