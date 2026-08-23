# What the project already says

Do not design from code and memory alone. Establish what the project currently
intends before proposing a solution.

## Where to look, in order

1. Start at the knowledge index, then search the curated collection for exact
   terms, and use a structured query for hybrid retrieval where the wording is
   uncertain.
2. Expand what retrieval returned through explicit incoming and outgoing edges —
   typed relationships, Area ownership, decision lineage, authored links — so
   lexical similarity does not define the boundary of the work.
3. Open only the concepts relevant to this work: vision and non-goals, the
   relevant Area index and its capabilities, concepts, rules and flows,
   architectural boundaries, current and superseded decisions, repository
   responsibilities, recorded uncertainties.
4. Ask whether this was already decided. Their answer is usually in a work
   record rather than on a page, and the framing gate holds until this has run.
   Cite the promoted page when there is one and the record when there is not,
   and say which.

Search with the project's own vocabulary — the canonical term, its aliases, and
the names it discourages. Your paraphrase is the wrong key: material is found
with the words it was written in, not the words you would have used.

Retrieval ranking is not authority. Open what it returned and read it.

## Before treating a page as authoritative

Inspect its status, whether it was generated, its verified content hash, its
staleness bound, and its sources. A `stable` status is valid only with a
matching current content hash, and a timestamp without one does not prove the
current text was reviewed. Normative claims additionally require human
verification.

## Two states worth naming

An existing project installed into this workflow starts with an empty or barely
populated corpus, and a populated one can still hold nothing about this Area. A
page can also record that the project accepted an intent its implementation does
not deliver.

Neither is an error and neither is reported as a clean result. **An empty corpus
passes a conflict check in silence, and "no conflicts found" reads exactly like
a check that ran and found nothing wrong.** Those are different states and only
one of them is true here.

See [an empty corpus, and a corpus that records a gap](../references/gaps-and-drift.md).

## Conflicts

- Raw material is neither evidence nor current truth. It is an untrusted clue
  source used only through its own case.
- A later timestamp does not automatically make a source authoritative.
- When sources or code disagree and the correct intent cannot be established,
  ask the maintainer.
- Preserve unresolved uncertainty explicitly. Do not produce a framing that
  silently selects one interpretation.
