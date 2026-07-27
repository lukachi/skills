---
name: verify-project-work
description: Verify significant project work against its living specification and the resulting code without hiding gaps. Use before claiming a feature, fix, refactor, migration, slice, or other significant task is complete; before flushing a completed work record; or when auditing whether a prior implementation actually satisfies its spec.
---

# Verify Project Work

Completion is a claim that requires fresh, reviewable evidence.

## Verification passes

1. **Spec reconciliation**
   - Re-read the entire living spec.
   - Map every acceptance criterion and planned item to implementation evidence.
   - Treat unchecked, ambiguous, or silently dropped items as incomplete.
2. **Implementation trace**
   - Invoke `analyze-with-graphify`.
   - Trace the changed behavior through callers, boundaries, state, errors, and consumers.
   - Confirm that the intended production path reaches the implementation.
3. **Adversarial gap check**
   - Look for placeholders, disabled paths, unhandled branches, temporary compatibility code, mocks, fixtures, fakes, and comments indicating deferred work.
   - Use text search only after graph analysis.
   - Inspect the actual diff or changed files, not memory.
4. **Fresh execution**
   - Run the relevant tests, build, lint, type checks, and focused runtime checks.
   - Record exact commands, results, and limitations.
5. **Honesty audit**
   - Separate verified facts from inference.
   - Record all remaining risks and unresolved work.
   - Do not use passing tests as proof of untested acceptance criteria.
6. **Maintainer completion review**
   - Present acceptance results, implementation evidence, checks, deviations,
     and remaining risks as a compact review packet.
   - Record only an explicit maintainer decision under
     `maintainer_review.completion`.
   - Do not treat silence or the agent's own judgment as approval.

Read [the completion gate](references/completion-gate.md) and update the spec's structured `verification` fields. Run `wfctl work verify` for structural consistency. Only then set `status: completed`.
