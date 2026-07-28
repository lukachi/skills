---
name: verify-project-work
description: Verify significant project work against its central living specification and code from the bound checkout or worktree without hiding gaps. Use before claiming a feature, fix, refactor, migration, slice, or other significant task is complete; before closing a completed work record; or when auditing whether a prior implementation actually satisfies its spec.
---

# Verify Project Work

Completion is a claim that requires fresh, reviewable evidence.

Run the status and verification commands yourself. The maintainer reviews the
evidence packet and supplies the completion decision; do not ask them to
operate `wfctl` or edit verification fields.

## Bind the verification workspace

Run `wfctl work status <id>` before reading implementation evidence. Use the
returned `Code root` for every code inspection and executable check, and the
returned `Spec` for specification reconciliation. Stop if status reports a
checkout, worktree, pointer, or spec mismatch. Never verify code from the
knowledge repository or a sibling checkout.

## Verification passes

1. **Spec reconciliation**
   - Re-read the entire living spec at the exact `Spec` path.
   - Map every acceptance criterion and planned item to implementation evidence.
   - Treat unchecked, ambiguous, or silently dropped items as incomplete.
2. **Implementation trace**
   - Invoke `analyze-with-graphify`.
   - Run it against the exact `Code root`.
   - Trace the changed behavior through callers, boundaries, state, errors, and consumers.
   - Open the actual source locations at the bound revision and confirm that
     the intended production path reaches the implementation. Graphify output
     alone is not evidence.
3. **Adversarial gap check**
   - Look for placeholders, disabled paths, unhandled branches, temporary compatibility code, mocks, fixtures, fakes, and comments indicating deferred work.
   - Use text search only after graph analysis.
   - Inspect the actual diff or changed files, not memory.
4. **Fresh execution**
   - Run the relevant tests, build, lint, type checks, and focused runtime checks.
   - Record exact commands, results, and limitations.
   - Require the completed implementation to exist in a clean recorded Git
     commit. Run the final checks against that commit and record it under
     `verification.revision` plus the worktree identity under
     `verification.worktree_id`. `wfctl` compares both at close.
5. **Honesty audit**
   - Separate verified facts from inference.
   - Record all remaining risks and unresolved work.
   - Do not use passing tests as proof of untested acceptance criteria.
6. **Knowledge delta**
   - Decide whether verified durable truth changed.
   - Update and validate curated concepts before completion, or record a
     concrete `knowledge_promotion.status: not-needed` reason.
   - Run knowledge validation against the exact `Knowledge root` returned by
     work status, not against the leaf working directory.
   - Never cite raw intake or Graphify output as authority.
7. **Maintainer completion review**
   - Present acceptance results, implementation evidence, checks, deviations,
     and remaining risks as a compact review packet.
   - Record only an explicit maintainer decision under
     `maintainer_review.completion`.
   - Do not treat silence or the agent's own judgment as approval.

Read [the completion gate](references/completion-gate.md) and update the
change record's structured `verification` and `knowledge_promotion` fields.
Run `wfctl work verify <id>` from the bound code root for structural
consistency. Only then set `status: completed`.
