# The framing

This is the cheapest moment to change the scope, and the last one where it is
free. It has two halves: find out what the project already says, then settle
what this work is.

# Part one — What the project already says

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

# Part two — Settling what the work is

## Settle it by asking, not by composing

Everything else in this workflow pulls toward acting alone, and that pull is
correct on accepted work and wrong here. A specification composed from two
answers and an inference has settled the rest by guessing, and the guesses are
invisible once they are prose.

Map the open decisions as a tree and ask the whole frontier of them in one
numbered round, each with your recommended answer. A round they can answer in
one sitting is what a relentless interview looks like from their side — one
question per turn is not thoroughness, it is a queue.

Facts are yours to find: what has already been decided, then curated knowledge,
then the source. Decisions are theirs. Nothing is written into the contract
until they say you understand each other.

## Sketch the seams

Write down the seams the behaviour will be tested at. Prefer existing seams to
new ones, and use the highest seam that can prove the behaviour. The fewer seams
across the codebase the better — the ideal number is one.

Check the seams match their expectations before they go into the framing.

## What the framing carries

- **Summary** — the problem and the intended outcome, both from the perspective
  of the person the product serves.
- **User stories** — a long numbered list, in the form *As a `<actor>`, I want
  `<capability>`, so that `<benefit>`*. Extensive enough to cover every aspect of
  the change: this is the part a person can read and judge, and the part
  acceptance criteria are derived from rather than a substitute for.
- **Scope** — what is in, and the explicit exclusions.
- **Decisions** — the approved product and engineering choices with enough
  rationale to guide implementation: the modules and interfaces that change, the
  clarifications given, architectural choices, schema changes, contracts.
- **Acceptance criteria** — stable ids, each an observable outcome traceable to
  a user story. Preserve an id when wording improves without changing meaning;
  supersede changed meaning explicitly.
- **Test seams** — the seams above and what behaviour each proves.
- **Uncertainty** — unresolved authority and facts, left unresolved rather than
  guessed away.

Keep volatile source paths and large code snippets out of the contract. Exact
source evidence belongs in verification.

## Repositories declare things the centre cannot see

Work spanning more than one repository is shaped at the centre, because only the
centre sees them all at once. What the centre cannot see is what each repository
declares about itself — the instructions its maintainer wrote in its own agent
file, and the skills installed only there. One opens with a plan file to read
first; another calls its navigation rule binding.

Each bound repository is either read, with a note on what its rules require of
this work, or declared untouched with a reason. Saying nothing is not a third
option, and neither is a note that only says the file was opened.

## Putting it to them

Render the packet; do not compose it. It carries what gets done, what
deliberately does not, what will make it finished, and in what order — from the
record, so it cannot print an identifier it never reads.

The maintainer reads that packet, never the record itself: a specification is
written for the next agent, and handing them a long document to review is how a
framing decision turns into an afternoon of reading.

Where the render reads wrong, repair the record it read. A packet edited by hand
is composed again, and composed is what put file paths and criterion ids in front
of them.

The acceptance criteria are digested when this is approved. That digest is what
later distinguishes a reworded contract from the one that was agreed to.

**Approving a framing settles what the work is, never that it begins.**
