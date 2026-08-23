# Charting the way

A loose idea has arrived, wrapped in fog: the way from here to the
**destination** is not visible yet. Wayfinding is about finding that way, not
charging at the destination.

The destination varies per effort, and naming it is the first act of charting —
it shapes everything else. It might be a framing to hand to delivery, a decision
to lock before planning starts, or a change made in place.

## Plan, don't do

This is planning. Each question resolves a decision, and the map is done when
nothing is left to decide before someone goes and builds the thing. The pull to
just do the work is usually the signal you have reached the edge of the map and
it is time to write the framing. **Product source stays untouched for the whole
of it.**

## Refer by name

Every map and question has a name. In everything the maintainer reads, refer to
it by that name, never by a bare id or slug. A wall of `ISSUE-004, ISSUE-005,
ISSUE-006` is illegible; names read at a glance.

## The map is an index, not a store

It lists the decisions made and points at the questions that hold their detail. A
decision lives in exactly one place — its question — so the map never restates
it, only gists it and links.

The map body is the whole map at low resolution, loaded once per session:

- **Destination** — what reaching the end looks like. One or two lines; every
  session orients to it before choosing anything.
- **Standing notes** — domain, constraints, accepted vocabulary.
- **Resolved route** — one line per completed question, enough to judge
  relevance before opening it.
- **Not yet specified** — in-scope fog you cannot phrase as a question yet.
- **Out of scope** — work ruled beyond the destination.

When you put the map to the maintainer — the route so far, where the fog still is
— draw it rather than listing it. A route is a shape, and they can see a wrong
edge in a tree where they cannot find one in a paragraph.

## Kinds of question

Every question is either worked **with** the maintainer, or by the agent alone. A
question that needs them only resolves through that live exchange; never stand in
for their side of it. A grilling that answers its own questions has broken this.

- **Grilling** — conversation. The default case. See
  [settling a direction by asking](../decide/interview.md) and
  [sharpening the language](../decide/domain-language.md).
- **Research** — reading outside this working directory to surface a fact a
  decision waits on. Resolved by a subagent; see
  [researching an external fact](../decide/research.md).
- **Prototype** — raise the fidelity of the discussion by making something cheap
  and concrete to react to. See [prototyping a decision](../decide/prototype.md).
  Use it when "how should it look" or "how should it behave" is the key question.
- **Task** — manual work that must happen before a *decision* can be made:
  provisioning access, signing up so an API can be judged, moving data so its
  shape can be seen. The one kind that does rather than decides, and it earns its
  place by unblocking a decision rather than by delivering the destination.

## Fog of war

The map is *deliberately* incomplete: do not chart what you cannot yet see.
Beyond the live questions lies the fog — decisions you can tell are coming but
cannot pin down, because they hang on questions still open. Resolving one clears
the fog ahead of it.

**Fog or question?** The test is whether you can state it precisely now — *not*
whether you can answer it now. A question when it is already sharp, even if you
cannot act on it yet. Fog when you cannot yet phrase it that sharply; leave it
coarse, since one patch may graduate into several questions, or none.

## Out of scope

Fog only ever gathers *toward* the destination. The destination fixes the scope,
so work beyond it is out of scope — not fog, and it never graduates. It returns
only if the destination is redrawn, and then as a fresh effort.

When a question already created turns out to sit past the destination, drop it
and leave one line in Out of scope: the gist plus why. It stays out of the
resolved route, which records the route actually walked.

## Pace

Resolve as many questions as their answers allow. The old rule was one per
session, and that was session management wearing a planning costume — what
actually paces this is how fast the maintainer can answer and how much a single
answer reshapes the tree, not how much context is left. Research questions never
pace anything: fire them in parallel and let only what depends on them wait.

## Done

The route is clear when every question is resolved or explicitly dropped, no
in-scope fog remains, and the next bounded change can be framed without guessing.
Then write the framing: read every resolved question in full and carry its
accepted conclusions across. The map is an index, so synthesis means reading them
rather than expanding one-line gists into guesses.

The map stays as lineage. Nothing goes from a map straight into implementation.
