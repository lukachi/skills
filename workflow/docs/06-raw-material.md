# 06 — Process raw material

## Use this when

Use this guide when new ideas, meeting notes, chat exports, research, old
specifications, or historical documents have been placed in `raw/`.

## Problem

Raw input is intentionally easy to create and therefore unreliable. One file
may mix current behavior, old truth, abandoned plans, future intent, technical
guesses, and entirely new Areas. File order and modification time cannot tell
which statement is authoritative.

Reading the entire dump in one unbounded pass also makes silent omission likely.

## Outcome

Every reviewed statement becomes an accounted candidate with an explicit
meaning, evidence state, time scope, relationship, and destination. Accepted
knowledge, durable history, proposed work, and unresolved material remain
separate.

## Add material freely

Treat `raw/` as a low-friction, append-oriented inbox. Organize it if convenient,
but do not delay capture to design the perfect taxonomy.

Commit new or changed raw files. Git blob identity lets the workflow distinguish
new input from material already reviewed without rewriting earlier cases.

## Ask the agent to process it

Open the agent in the knowledge repository and say:

> Process the new raw material.

The agent:

1. inventories unseen and changed committed blobs;
2. uses QMD to propose bounded thematic batches;
3. asks you to approve a useful next batch;
4. freezes its exact files and Git identities into an intake case;
5. reads every frozen file completely;
6. splits material statements into atomic candidate claims;
7. verifies or adjudicates each claim;
8. routes every claim and checks the durable result for omissions.

You do not need to choose files blindly or operate case IDs.

## How candidates are separated

| Candidate meaning | Destination |
| --- | --- |
| Confirmed current truth | Curated product or engineering knowledge |
| Confirmed former durable truth | Decision history or Area evolution |
| Reviewed proposal or plan | Change inbox or active work |
| Rejected, unresolved, or non-durable material | Intake case only |

A proposed idea cannot become current knowledge merely because it is plausible.
A newer note cannot supersede an earlier rule without evidence or maintainer
authority. A repeated rejected proposal stays case-only unless you explicitly
adopt its boundary as a durable non-goal.

## Verify that nothing important disappeared

After routing, the agent asks diagnostic questions that must be answerable from
the durable outputs without reopening `raw/`. Each non-rejected candidate is
covered.

If an exception, condition, chronology step, or relationship is missing, the
probe fails and creates repair work. The generated claim ledger helps audit
explicit lineage, but it never decides truth.

## Continue over time

Raw intake is continuous, not a one-time migration. A closed case keeps its
frozen snapshot. Later files or changed blobs become a new generation and a
later bounded case.

At every handoff, the agent shows:

- current generation and reviewed counts;
- active themes and blockers;
- decisions needed from you;
- recommended next batch;
- the condition for completing the current intake scope.

## Result

Useful input is preserved without allowing the dump itself to become a source
of truth or a permanent reading surface.

## Next

Continue with
[07 — Review, correct, and recover](07-maintainer-control.md).
