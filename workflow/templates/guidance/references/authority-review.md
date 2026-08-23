# Authority and truth review

The first of the two axes. Review whether the document is entitled to make each
claim. Ignore elegance, tone, and readability except where an ambiguity changes the
meaning.

`wfctl knowledge validate` has already checked that the authority class matches the
view, that every source resolves in the right form, and that a stable page carries
receipts. It cannot check whether a claim is true.

## Evidence packet

Read:

- the complete target;
- every governing current decision;
- every cited authoritative source, in full enough to test the claim it carries;
- the current counterpart view and any contradictory evidence;
- pinned source, tests, and runtime receipts for an implementation claim.

Retrieval snippets, raw, intake prose, compiled graphs, and agent summaries are
navigation only. **A source that was not read cannot pass**, and the receipt says a
review happened rather than that it was right.

## Factuality

- Split each material statement into atomic claims.
- Match every claim to the authority class that can establish it.
- Confirm the source identity, revision, scope, and freshness.
- Reject a claim broader than its evidence.
- Keep conflicting evidence and uncertainty visible rather than averaging them.
- Treat a negative or absence claim as unproven without complete applicable
  coverage.

## Delivery state

- Accepted intent, observed delivery, and alignment stay independent.
- Present tense never implies behavior that is not available.
- `absent`, `partial`, `implemented`, `verified`, `retired`, and `unknown` match
  what the evidence actually shows.
- Planned and rejected behavior stays outside current knowledge.

## Completeness

- No important rule, outcome, boundary, exception, non-goal, failure mode, or
  affected relationship was dropped.
- The document is the smallest coherent unit rather than a fragment that hides a
  material condition.
- Current decisions and supersession lineage are linked.

## Freshness and lineage

- `generated.at`, the sources, the realization assessment, and the linked decisions
  all describe the same current state.
- Historical explanation reads as historical.
- A changed decision updated the current view and preserved its predecessor.

Return `passed`, `failed`, `uncertain`, or `blocked` for each check.
