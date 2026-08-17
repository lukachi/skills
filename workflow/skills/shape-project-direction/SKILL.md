---
name: shape-project-direction
description: Chart a chunk of work too big for one agent session as a shared map of decision issues in the central bundle, and resolve them one at a time until the way to the destination is clear. Use when the maintainer asks for Wayfinder, or accepts that recommendation because dependent product or architecture choices still hide the route.
---

# Shape Project Direction

A loose idea has arrived — too big for one agent session, and wrapped in fog: the
way from here to the **destination** is not visible yet. Wayfinding is about
finding that way, not charging at the destination. This skill charts the way as a
**map** inside the central change bundle, then works its **decision issues** —
questions whose resolution is a decision, not slices of a build to execute — one
at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it
shapes every issue. It might be a specification to hand to delivery, a decision to
lock before planning starts, or a change made in place.

## Plan, don't do

Wayfinder is **planning**: each issue resolves a decision, and the map is done
when the way is clear — nothing left to decide before someone goes and builds the
thing. The pull to just do the work is usually the signal you have reached the
edge of the map and it is time to hand off to `specify-project-change`. Produce
decisions, not deliverables; product source stays untouched for the whole of it.

## Refer by name

Every map and issue has a **name** — its title. In everything the maintainer
reads — narration, the map's resolved route, a question you put to them — refer to
it by that name, never by a bare id, number, or slug. A wall of `ISSUE-004,
ISSUE-005, ISSUE-006` is illegible; names read at a glance. The id does not
vanish, it rides _inside_ the name, and most of the time it does not need to
appear at all.

## The Map

`map.md` in the bundle is the map. Its issues live under `issues/` with
`--phase wayfinding`.

The map is an **index**, not a store. It lists the decisions made and points at
the issues that hold their detail; a decision lives in exactly one place — its
issue — so the map never restates it, only gists it and links. `wfctl work issue
complete` appends that gist itself; do not write the resolved route by hand.

The map body is the whole map at low resolution, loaded once per session:

- **Destination** — what reaching the end of this map looks like: the
  specification, decision, or change this effort is finding its way to. One or two
  lines; every session orients to it before choosing an issue.
- **Standing notes** — domain, constraints, accepted vocabulary, and the skills
  every session must consult.
- **Resolved route** — one line per completed issue, enough to judge relevance
  before opening it.
- **Not yet specified** — in-scope fog you cannot phrase as an issue yet.
- **Out of scope** — work ruled beyond the destination.

Open issues are not listed on the map. `wfctl work map status <id>` finds them.

Each issue's body is the question, sized to one fresh agent session. The answer is
not part of the body; it is recorded on resolution.

A session **claims** an issue before any work, so a concurrent session skips it:

```sh
wfctl work issue claim <change-id> <issue-id> --actor "agent:<identity>"
```

Blocking uses `--blocked-by` at creation and `wfctl work issue block|unblock`
when later evidence changes an edge. An issue is **unblocked** when every issue
blocking it is complete; the **frontier** is the open, unblocked, unclaimed
issues — the edge of the known.

## Issue types

Every issue is either **HITL** — human in the loop, worked _with_ a maintainer who
speaks for themselves — or **AFK**, driven by the agent alone. A HITL issue only
resolves through that live exchange; the agent never stands in for the human's
side of it. A grilling that answers its own questions has broken this.

- **Grilling** (HITL): conversation. **The default case.** Always call the Skill
  tool twice, for `grill-project-decisions` and `model-project-domain`.
- **Research** (AFK): reading documentation, third-party APIs, or knowledge
  outside this working directory to surface a fact a decision waits on. Resolved
  by a subagent calling `research-project-context`.
- **Prototype** (HITL): raise the fidelity of the discussion by making a cheap,
  rough, concrete artifact to react to — an outline, a stub, or logic and UI code
  through `prototype-project-decision`. Link the prototype as a bundle artifact.
  Use it when "how should it look" or "how should it behave" is the key question.
- **Task** (HITL or AFK): manual work that must happen before a _decision_ can be
  made — nothing to decide, prototype, or research, but the discussion is blocked
  until it is done. Provisioning access, signing up for a service so its API can
  be judged, moving data so its shape can be seen. This is the one type that
  _does_ rather than decides, and it earns its place by unblocking a decision
  rather than by delivering the destination. Drive it alone where you can;
  otherwise hand the maintainer a precise checklist. Its resolution records what
  was done and any resulting facts later issues depend on.

## Fog of war

The map is _deliberately_ incomplete: do not chart what you cannot yet see. Beyond
the live issues lies the **fog of war** — the dim view of decisions you can tell
are coming but cannot yet pin down, because they hang on questions still open.
Resolving an issue clears the fog ahead of it, graduating whatever is now
specifiable into fresh issues, one at a time, until the way to the destination is
clear and no issues remain.

**Not yet specified** is where that dim view is written down: the suspected
question, the area to revisit. Everything there is in scope, just not sharp enough
to be an issue.

**Fog or issue?** The test is whether you can state the question precisely now —
_not_ whether you can answer it now.

- **An issue** when the question is already sharp, even if it is blocked and you
  cannot act on it yet.
- **Not yet specified** when you cannot yet phrase it that sharply. Leave the fog
  coarse: one patch may graduate into several issues, or none, once the frontier
  reaches it.

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope,
so work beyond it is **out of scope** — it is not fog, and it does not belong in
Not yet specified. Out-of-scope work never graduates; it returns only if the
destination is redrawn, and then as a fresh effort.

When an issue that already exists turns out to sit past the destination, drop it
with `wfctl work issue drop` and leave one line in Out of scope: the gist plus why
it is out, naming the dropped issue. It stays out of the resolved route, which
records the route actually walked.

## Chart the map

The maintainer arrives with a loose idea.

1. **Name the destination.** Call the Skill tool twice, for
   `grill-project-decisions` and `model-project-domain`, to pin down what this map
   is finding its way to. The destination fixes the scope, so it is settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across
   the whole space rather than deep on any one thread, surfacing the open decisions
   and the first steps takeable now. **If this surfaces no fog** — the way is
   already clear, the whole journey small enough for one session — you do not need
   a map. Stop and recommend `specify-project-change` instead.
3. **Create the bundle and the map.** Reuse the initiative's active bundle or run
   `wfctl work start <slug> --title "<destination>" --mode wayfinder`. Bind only
   leaves whose evidence you already know you need. Fill in the destination and
   standing notes, leave the resolved route empty, and sketch the fog into Not yet
   specified.
4. **Read what each bound repository says about itself.** `wfctl work repositories
   <id>` prints the instructions its maintainer wrote and the skills installed only
   there — the rules that decide whether a route is even possible in that
   repository, and invisible from the centre otherwise. Account for every one with
   `--read` or `--untouched`; `wfctl work map finish` refuses until you have.
   Invoke `align-project-knowledge` in the same pass: fog is only fog until you
   check whether the project already answered it.
5. **Create the issues you can specify now**, then wire blocking edges in a
   **second pass** — issues need ids before they can reference each other. Wiring
   sorts them into the frontier and the blocked; everything you cannot yet specify
   stays in the fog.

   ```sh
   wfctl work issue create <change-id> <slug> --title "<name>" \
     --phase wayfinding --type research|prototype|grilling|task
   ```

6. **Fire the research subagents.** For each research issue you just created, spin
   up a subagent calling `research-project-context` to resolve it in parallel.
7. Stop. Charting is one session's work; it hand-resolves nothing.

## Work through the map

The maintainer arrives with the map. An issue is optional — without one, you pick
the next decision, not them. **Never resolve more than one issue per session**,
with the exception of research issues.

1. Load the map with `wfctl work map status <id>` — the low-resolution view, not
   every issue body.
2. Choose the issue. If the maintainer named one, use it. Otherwise take the first
   frontier issue in order. **Claim it** before any work.
3. Resolve it — **zoom as needed**: read the full body of any related or completed
   issue on demand, and call the skills the standing notes name. If in doubt, call
   the Skill tool twice, for `grill-project-decisions` and `model-project-domain`.
4. Record the resolution with `wfctl work issue complete`, which closes the issue
   and appends its gist to the resolved route. The full answer and its evidence
   live in the issue.
5. Add newly surfaced issues, create-then-wire; graduate any fog the answer made
   specifiable, clearing each graduated patch from Not yet specified so it lives
   only as its new issue. Where the answer reveals an issue sits beyond the
   destination, rule it out of scope rather than resolving it on the route. Where
   the decision invalidates other parts of the map, update or drop those issues.
6. Refresh the parent checkpoint last, with the next frontier action.

## Hand off to specification

The route is clear when every issue is complete or explicitly dropped, no in-scope
fog remains, and the next bounded change can be specified without guessing.

Invoke `specify-project-change`. It reads every resolved issue in full, collapses
their detail into `change.md`, obtains framing approval, and runs `wfctl work map
finish <id> --mode full|slice`. The map stays as lineage; it is never copied into
a parallel strategy file, and nothing goes from a map straight into
implementation.
