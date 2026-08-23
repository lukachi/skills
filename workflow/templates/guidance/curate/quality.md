# The quality gate

Act as an adversarial review coordinator, not the author defending the draft.
Truth and communication are different failure surfaces, and neither may
compensate for the other:
[authority and truth](../references/authority-review.md), and
[reader communication](../references/reader-communication-review.md), scored
against [the rubric](../references/quality-rubric.md).

Structural validation runs separately: `wfctl knowledge validate`. It refuses
what a check can see — a missing view, purpose or audience; a citation of raw
material; implementation on the product road; a stable page whose seal no longer
matches its content. It cannot tell whether a claim is true or whether a reader
can act on it, which is what these two axes are for. It cannot tell whether a claim is true,
whether an exception was dropped, or whether a stakeholder can act on the answer.

## Freeze the target

1. Read the complete page, not a snippet.
2. Read its parent Area index, every linked current counterpart, every current
   decision that governs it, and every material authoritative source.
3. For a code-backed claim, traverse the graph in the exact pinned leaf and
   inspect the cited source, tests and necessary runtime evidence directly.
4. Structural success is necessary and never sufficient. A page still drafted
   under a record's `promotion/` directory has no corpus position yet, so its
   structural validation runs when it is promoted; a refusal there writes
   nothing and leaves the page where it is.
5. Pin the content hash before semantic review: `wfctl knowledge hash <path>`.
   It reads frontmatter and body and ignores the seal line, so a hash taken on a
   draft still matches once the page is copied into the corpus. The hash reads frontmatter and
   body, never location, so a seal bound to the draft still matches once the
   page is copied byte for byte into the corpus.

## Two independent axes

1. Apply each axis from its own checklist and its own evidence packet. **Do not
   reuse the first pass's verdict as evidence for the second** — a
   strong-evidence page nobody can read fails, and so does a clear page that
   claims more than it can prove.
2. Use independent reviewer contexts where the runtime safely provides them;
   otherwise perform two explicitly separated passes.
3. Search across both for an omitted exception, unsupported present tense, mixed
   audiences, hidden implementation detail, intent inferred from code, history
   presented as current, and a claim broader than its evidence.
4. Return one packet: the overall result, each axis separately, every failed,
   uncertain, unread or blocked check with its evidence and any conflicting
   evidence, the smallest correction, and the authority still needed from the
   maintainer.
5. Recompute the content hash. If it changed, discard both passes and rerun them
   against the new revision.
6. Do not write a passed receipt while any item is failed, uncertain, unread or
   blocked.

The receipt proves that the declared review was performed against one exact
revision. It creates no authority and does not make an incorrect review true.
