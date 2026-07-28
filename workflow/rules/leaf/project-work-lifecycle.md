# Project work lifecycle

The agent executes routine `wfctl work` commands and maintains the living spec.
The maintainer supplies intent, corrections, and explicit review decisions;
do not make them operate the CLI or edit workflow records.

For significant work, follow these gates in order:

1. Create one central `shaping` record with `wfctl work start` as soon as the
   task is classified as significant.
2. Run `wfctl work status <id>` and bind the task to its exact code root and spec path.
3. Update that spec after every material maintainer turn before continuing.
4. Analyze current behavior through Graphify from the bound code root.
5. Read the relevant curated knowledge, current decisions, and their provenance.
6. Resolve contradictions or unknown truth with the maintainer.
7. Present the framing review packet and record explicit maintainer approval.
8. Set the record to `active`, then implement only in the bound code root.
9. Reopen framing review after material re-scoping.
10. Reconcile every acceptance criterion against code from the bound root.
11. With normal maintainer authorization, preserve the implementation
    in the bound Git commit and require a clean checkout.
12. Run final checks against that exact commit and record
    `verification.revision` and `verification.worktree_id`.
13. Promote any durable verified truth into `knowledge/`, or record why no
    current knowledge changed.
14. Run `wfctl knowledge validate --target <Knowledge root>` for promoted
    concepts, using the root returned by work status.
15. Present the completion review packet and record explicit maintainer approval.
16. Mark completion only when verification and knowledge promotion records are honest and complete.
17. Close with `wfctl work close --outcome completed`.

The canonical active spec lives in the configured knowledge repository. A leaf repository may contain a pointer, never a competing copy.

The knowledge repository and the implementation checkout are separate
surfaces. Before code edits, after directory changes, on resume, and before
verification or close, run `wfctl work status <id>`. Use the reported `Code
root` for all code operations and the reported `Spec` only for spec/progress
updates. Never select a sibling checkout or main worktree by inference.

On resume or after compaction, run status, read the entire spec, and recover its
current state, open questions, decision ledger, last completed action, and next
action. Never reconstruct these from conversation memory.

For interrupted, rejected, or deliberately partial work, close with an accurate `partial` or `abandoned` outcome. Never relabel incomplete work as complete to pass a gate.
