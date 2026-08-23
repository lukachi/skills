# The framing

This is the cheapest moment to change the scope, and the last one where it is
free.

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
