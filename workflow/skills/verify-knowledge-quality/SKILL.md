---
name: verify-knowledge-quality
description: Perform the mandatory two-axis semantic gate for curated workflow knowledge before a document becomes stable or is reported complete. Use after creating or materially editing any product, engineering, decision, reference, or uncertainty concept, or for an explicit quality audit. Review authority and truth independently from reader communication, then bind both passes to one unchanged content hash. Do not use for ordinary explanation and do not let deterministic validation, polished prose, or a single self-review satisfy both axes.
---

# Verify Knowledge Quality

Act as an adversarial review coordinator, not the author defending the draft. Truth
and communication are different failure surfaces; neither may compensate for the
other.

`wfctl knowledge validate` is the structural gate and it runs separately. It cannot
tell whether a claim is true, whether an exception was dropped, or whether a
stakeholder can act on the answer. That is what these two axes are for:
[authority and truth](references/authority-review.md), and
[reader communication](references/reader-communication-review.md).

## Freeze the review target

1. Read the complete target document, not a snippet.
2. Read its parent Area index, every linked current product or engineering
   counterpart, every current decision that governs it, and every material
   authoritative source.
3. For a code-backed claim, invoke `analyze-with-graphify` in the exact pinned leaf
   and inspect the cited source, tests, and necessary runtime evidence directly.
4. Run `wfctl knowledge validate --concept <path>`. Structural success is necessary
   and never sufficient. A page still drafted under a bundle's `promotion/`
   directory has no corpus position yet, so its structural validation runs when it
   is promoted; a refusal there writes nothing and leaves the page where it is.
5. Run `wfctl knowledge hash --concept <path>` and pin the candidate hash before
   semantic review. The path may be a draft: the hash reads frontmatter and body,
   never location, and a promoted page is copied byte for byte, so a seal bound to
   the draft still matches once it lands.

## Run two independent axes

1. Apply each axis from its own checklist and its own evidence packet. **Do not
   reuse the first pass's verdict as evidence for the second** — a strong-evidence
   page that nobody can read fails, and so does a clear page that claims more than
   it can prove.
2. Use independent reviewer contexts where the runtime safely provides them.
   Otherwise perform two explicitly separated passes.
3. Search across both for an omitted exception, unsupported present tense, mixed
   audiences, hidden implementation detail, intent inferred from code, history
   presented as current, and a claim broader than its evidence.
4. Return one review packet: the overall result, each axis separately, every failed,
   uncertain, unread, or blocked check with its evidence and any conflicting
   evidence, the smallest correction, and the authority still needed from the
   maintainer.
5. Recompute the content hash. If it changed, discard both passes and rerun them
   against the new revision.
6. Do not write a passed receipt while any item is failed, uncertain, unread, or
   blocked.

## Record a passed receipt

After all substantive content is final, run `wfctl knowledge hash --concept <path>`
and record both axes against that one output. The validator checks every field
here, including that each axis is `passed`, that both hashes match the current
content, and that the checks list is complete:

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
    axes:
      authority-truth:
        status: passed
        by: "<producer>/<version>"
        at: "<ISO-8601>"
        content_hash: "<same output>"
      reader-communication:
        status: passed
        by: "<producer>/<version>"
        at: "<ISO-8601>"
        content_hash: "<same output>"
```

Use the same hash in the `verified` event after the applicable machine or human
authority review, then re-run `wfctl knowledge validate --concept <path>`.

The receipt proves that the declared review was performed against one exact
revision. It creates no authority and does not make an incorrect review true.
