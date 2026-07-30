---
name: verify-knowledge-quality
description: Perform the mandatory semantic quality gate for curated workflow knowledge before a document becomes stable or is reported as complete. Use after creating or materially editing any product, engineering, decision, reference, or uncertainty concept; when reviewing stakeholder readability; when checking that implementation detail did not leak into product knowledge; when checking that product meaning was not inferred from code; and when auditing delivery labels, exceptions, evidence coverage, current truth, or abstraction boundaries. Produce a content-hash-bound quality receipt only after every rubric item passes.
---

# Verify Knowledge Quality

Act as an adversarial reviewer, not the author defending the draft. Verify the
current document against its full authoritative sources and neighboring view.

Read [the quality rubric](references/quality-rubric.md) before the first review
in a session.

## Review procedure

1. Read the complete target document, not a snippet.
2. Read its parent Area index, every linked current product or engineering
   counterpart, every current decision that governs it, and every material
   authoritative source.
3. For code-backed claims, invoke `analyze-with-graphify` in the exact pinned
   leaf and directly inspect the cited source, tests, and necessary runtime
   evidence.
4. Run `wfctl knowledge validate --concept <path>` and distinguish structural
   failures from semantic failures.
5. Apply every rubric check for the declared `view`. Search specifically for
   omitted exceptions, unsupported present tense, mixed audiences, hidden
   implementation detail, intent inferred from code, history presented as
   current, and claims broader than evidence.
6. Return a review packet with:
   - result: passed or failed;
   - each failed or uncertain check;
   - exact evidence and conflicting evidence;
   - the smallest correction;
   - authority needed from the maintainer, if any.
7. Do not write a passed receipt while any item is failed, uncertain, unread,
   or blocked.

## Record a passed receipt

After all substantive content is final:

1. Run `wfctl knowledge hash --concept <path>`.
2. Set:

```yaml
x-wf:
  quality:
    status: passed
    by: "<producer>/<version>"
    at: "<ISO-8601>"
    content_hash: "<wfctl knowledge hash output>"
    checks:
      - factuality
      - audience-fit
      - abstraction
      - completeness
      - delivery-state
```

3. Use the same hash in the normal `verified` event after the applicable
   machine or human authority review.
4. Re-run `wfctl knowledge validate --concept <path>`. A material edit changes
   the hash and invalidates both receipts.

The receipt proves that the declared review was performed against one exact
document revision. It does not create authority and does not make an incorrect
review true.
