# Records

## The flow

A `flow_id` fences the workload that was agreed. It is not a bundle id and not a
task id: it groups whatever was settled — several change records, one, or a
reconstruction.

While it is open, work outside it is out of scope. On completion the checkpoint
flushes and the id clears; the next round opens a new one.

## The checkpoint

Your own surface, and the cheapest thing in the tool.

```sh
wfctl checkpoint "<whatever you would not want to look up again>"
```

Nothing about a note is checked and notes accumulate; the second does not erase
the first. `wfctl notes` reads them all back and the brief shows the last few.

Four named fields update the index a fresh session reads — `--summary` one line,
`--handoff` the body, `--last` and `--next` what recovery acts on, `--todo` for
small jobs noticed in passing. Any of them may be given alone, and **what you do
not name is left as it was**, so correcting the next action does not cost you the
handoff.

The brief prints the bound flow's handoff in full and every other flow as one
line, so a truncated brief cannot hide the state that matters.

Write after every material turn. Not because a session is about to end — that
fear is what made runs stop halfway through a context that was still wide open —
but because it is what a fresh session resumes from, and because a run learns
more than it can hold.

## Findings

Something you noticed that **this work should settle**.

```sh
wfctl finding "<what you found>" [--about <unit>] [--artifact <path>]
wfctl finding resolve <id> --how "<what you did about it>"
wfctl finding release <id>
```

It stays inside the fence, which is the whole difference from a capture. A
capture leaves: it goes to the inbox and waits for the maintainer, and that is
right for something outside this work and wrong for the thing you could simply
fix. Resolving takes `--how`, because a finding closed with no account of what
was done reads later exactly like one quietly dropped. `release` sends it to the
inbox when it turns out not to be yours.

## Artifacts

The files this work produced, and which of them it still stands on.

```sh
wfctl artifact add <path> --what "<what it is>" [--supersedes <path>]
wfctl artifact list
```

Superseding is **recorded, not implied**. The alternative is a note at the top
of each file saying which one is current, updated by whoever remembers — which
is what makes a directory of documents unreadable.

**Blockers are not stored.** Where the flow stands in its sequence *is* the
blocker, and the brief derives it. A stored one is a sentence that was true once
and stays after it stops being true.

## Captures

Something worth keeping that this flow does not own:

```sh
wfctl capture "<what you found>" [--awaits]
```

A bug noticed in passing, a gotcha, an idea for later. It does not become a
record — opening a workload because you noticed something is how a repository
ends up with eleven active records nobody agreed to, and both the command and
the write guard refuse it while a flow is open.

`--awaits` marks one only the maintainer can settle. Put it to them as one
decision when there is a reason to, not as a backlog to read out.

## What to preserve, and where

> If this newly learned information disappeared, could a fresh session repeat
> material investigation, choose differently, misunderstand the work, or act
> unsafely?

If yes, it goes in the owning record's discovery ledger: the observation and its
uncertainty, the evidence or its absence, the implication, the applicable scope,
and the current disposition.

The trigger is **consequence of information loss**, not a category. It is not
"traps" or "findings" or "lessons" — those categories are what make an agent
skip a fact that fits none of them.

Preserve invalidated entries with a corrected disposition rather than erasing
them. The lineage is what stops the same wrong conclusion being reached twice.

## The promotion queue

A record that closes holding drafted pages waits in `changes/promotion/` rather
than archiving, **whatever its outcome**. It stays correctable there — the one
lifecycle state where further edits are expected.

An archived record is not correctable. Editing it would change what the project
says it decided with nothing recording that it changed.

## Trajectories

A trajectory is one product subject as a line: how it was conceived, what
changed and why, what the source shows now.

Three axes. `intent` is what the project stated, recovered. `delivery` is what
the source gives now. `vision` is what it should become — **only the maintainer
declares one**, because a direction invented for them is worse than an absent
one.

The gap between axes is derived, never stored: a stored gap is a subtraction
that was true once, and a gap accepted as correct is a vision that was wrong.

Both cases write here. Reconstruction builds lines from what it read; a closed
change appends what it delivered.

## Has this already been decided?

```sh
wfctl decided "<the subject>"
```

Run it before any question reaches the maintainer. It reads the places an answer
lands — curated pages, open and closed records, captures, and declared
directions — and reports their own words with a date.

Most answers are not on a curated page. They are in the record that asked the
question, which is why a knowledge search alone reads like a question nobody has
answered.

Finding nothing is a real answer too: it means this is genuinely worth their
turn. Say so when you ask, rather than asking as though you had not looked.

## What is accepted and not delivered

```sh
wfctl debts
```

The gap for one subject is derived inside its line; this gathers them. Nothing
is stored — a gap is a subtraction, and a stored one is a subtraction that was
true once.

A delivery settles an intent by **naming** it:

```sh
wfctl trajectory append --subject "<subject>" --summary "<what the source shows now>" \
  --axis delivery --settles <event-id>
```

Nothing infers the link. Matching the wording meant echoing the intent sentence
closed the gap while a genuine delivery worded differently never did; matching
by order meant any delivery closed every intent before it, including unrelated
ones. Only the agent reading the source can say that one observation settles one
intention.

Each becomes work the ordinary way. Grouping several by the outcome that would
close them usually turns the list into one decision.

## Paths you never type

Where a path follows from state, the tool creates it and prints it — promotion
drafts in particular. A path assembled from memory is assembled wrong, and the
pages that ended up elsewhere could not be promoted at all.
