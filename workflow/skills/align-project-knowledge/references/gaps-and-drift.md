# An empty corpus, and a corpus that records a gap

Two states the alignment can land in. Read the one that matches what the
corpus actually holds for this subject.

## When there is no baseline yet

An existing project installed into this workflow starts with an empty or barely
populated `knowledge/`, and that is a supported state, not an error. A
reconstruction is expensive enough that nobody runs one before their first fix,
so most first tasks in a real repository run without one.

Report absence rather than a clean result. "No conflicts with curated knowledge"
is literally true against an empty corpus and tells the reader nothing, while
reading exactly like a completed check. Record instead that no curated concept
covers this work, that the contract is therefore unaligned by absence rather
than by verification, and what the alignment rested on instead — pinned source,
tests, maintainer statements. The same applies to a populated corpus that simply
has nothing about this Area: coverage is per-subject, not per-repository.

Recommend a reconstruction when the gap is material and say what it would
establish, then proceed if the maintainer declines. It is a recommendation, and
it never becomes a precondition for doing the work.

## Recorded drift is work nobody has claimed

`realization.alignment: drifted` on a curated page means the project accepted an
intent its implementation does not deliver. That row is a faithful record and
nothing more: reconstruction never edits source, so the gap it names outlives
the case that found it. `wfctl brief` reports `corpus.intent-delivery-drift`
with the pages by name, and a body of debt that only ever appears there is the
same as no record at all.

Read those pages whenever work touches their Area, and treat each one as a
candidate the current task either resolves, widens, or leaves untouched. Say
which, in the alignment record, so the next reader knows the drift was seen
rather than missed.

Drift becomes work through the ordinary route and never by direct promotion.
Group the drifted pages by the outcome that would close them — several rows are
usually one initiative — and put that outcome to the maintainer as one decision
with three honest answers: shape it now, accept the gap and record the intent as
superseded so the drift disappears truthfully, or defer it with a reason. Only
the first creates a bundle, through `shape-project-direction` when the route is
foggy and `specify-project-change` when it is not.

Never resolve drift by editing the page to match the code. That erases an
accepted intent to make a check pass, and the record of what the project meant
is the only thing that made the gap visible.
