# Trajectories — design record

Non-normative. Records a design agreed in discussion, ahead of any spec change.
When this lands, its parts move into `spec/KNOWLEDGE.md`,
`spec/RECONSTRUCTION.md`, `spec/CLI.md`, and the affected rules and skills.

## The defect

Today a candidate claim is classified and routed at read time
(`spec/KNOWLEDGE.md:120-134`): one pass over one bounded slice produces semantic
role, intent state, delivery state, alignment, temporal scope, relations, **and**
a routing lane into `knowledge/`.

Two consequences follow by construction:

- The decision about current truth is made before the material that contradicts
  it has been read. A contradiction found in slice ten cannot un-route a claim
  promoted from slice two; it can only create repair work.
- The agent escalates at the point of local unresolvability — which is exactly
  the point where the answer most likely sits in unread material. The maintainer
  is asked precisely the questions the agent could have answered later itself.

The contract already treats both as known hazards and patches them with norms
rather than order: `rules/common/maintainer-review.md:70-74` tells the agent to
re-read the source before asking, because "the candidate was extracted at reading
time"; `rules/common/maintainer-review.md:53-79` tells it to re-establish the
subject by hand, because no layer holds one.

A third defect compounds them: the maintainer's decisions are about the
workflow's own bookkeeping. `wfctl knowledge reconstruct close --outcome
completed|partial` asks whether the agent finished its own accounting.
`reconstruction-model.md:175-176` requires explicit adjudication for five
candidate classes, per candidate. Neither is a product question.

## The model

Four layers. The invariant that makes it work:

> No layer below a trajectory may assert anything about the present.

| Layer | Carries | Time | Maintainer sees |
| --- | --- | --- | --- |
| Observation | This file at this revision says X | Date of observation | No |
| Finding | Observations about one subject, reduced to a situation that occurred | Period | No |
| Trajectory | Findings about one subject ordered in time, plus current source state | Progression | **Yes, only this** |
| Claim | What enters `knowledge/` | Present | Consequence of the answer |

Routing into `knowledge/` becomes impossible before the trajectory layer exists.

### A trajectory

One subject — a feature or an idea — as a single line:

```
how it was conceived  →  what changed and why  →  what the source shows now
```

Plus the place a declared vision attaches, and a gap computed from it.

Every change carries a cause, because a changelog is not something you can steer
from:

| Cause | What it means to someone setting direction |
| --- | --- |
| `decision` | Recorded, with author and date. Understand it before changing it |
| `compromise` | Deliberate, under a constraint. The constraint may be gone |
| `drift` | Nobody decided. Reversible without discussion |
| `defect` | Matches nothing that was ever stated |
| `external` | Platform, dependency, or requirement moved. Not our will |
| `not-found` | **No decision record was found.** Not the same as `drift` |
| `unknown` | Honest. Not a question for the maintainer |

`not-found` is separate from `drift` on purpose. Absence of a record is not
evidence of absence of a decision, and promoting one to the other is the failure
already fixed once in this repository (`34e5737`).

**A cause carries its own evidence, separate from the claim's.** The pointers that
establish what the source does are not the pointers that establish why it does it,
and a record that carries only the first cannot classify at all. The equipment
prototype settled this empirically: every delivery fact was confirmable from the
candidate's `evidence[]` alone, and neither cause was — the deferral that makes the
shield hole a `decision` rather than `drift` lives in a progress file cited only in
prose, and the boundary that makes unbuilt attunement a `decision` is documented in
the service source, also only in prose. Two of seven causes would have been
classified `drift` falsely, telling the maintainer nobody decided things that were
deliberately scheduled.

```
finding:
  evidence:        pointers establishing what happened
  cause:
    kind:          decision | compromise | drift | defect | external | not-found | unknown
    evidence:      pointers establishing why — required unless kind is not-found or unknown
```

`not-found` and `unknown` are the only kinds that may carry no cause evidence, which
is what makes them honest rather than convenient: they are the two that claim
nothing.

### Three axes, not two

| Axis | Meaning | Owner | Exists today |
| --- | --- | --- | --- |
| `intent` | What the project stated — recovered | Agent, from the trajectory | Yes (`spec/KNOWLEDGE.md:82-86`) |
| `delivery` | What the source delivers now, at a pinned revision | Agent, comparison phase | Yes |
| `vision` | What it should become | **Maintainer only** | **No** |

`alignment` today conflates two different gaps. Split them:

| Gap | Meaning |
| --- | --- |
| Delivery debt | `intent` ↔ `delivery` — stated, not built |
| Direction debt | `vision` ↔ `delivery` — built, but not what it should be |
| Hole | Present in neither; visible only when the trajectory is read whole |

A hole is not stored. It becomes part of the vision, and the vision produces the
gap.

### The gap is never stored

It is derived from `vision` and `delivery`, both of which are stored. A stored
gap desynchronises from the source on the first commit and becomes a third
source of truth that lies.

What is stored is the gap's **status** — the only thing the maintainer says
about it:

| Status | Produces |
| --- | --- |
| `open` | Nothing. Visible in the trajectory |
| `to-close` | A record under `changes/` bound to the trajectory |
| `deferred` | Nothing, but visible as acknowledged |
| `accept` | **An edit to the vision**, not an accepted gap |

`accept` deliberately has no resting state. A gap that is right as it stands is a
vision that was wrong; recording it as an accepted gap loses the difference
between "we decided this is correct" and "we gave up".

### Vision is a decision, not a field

A field is silently rewritten by any edit. A vision has an author, a date, a
reason, and a successor when it changes — which is the definition of a decision
record, and `spec/KNOWLEDGE.md:98-100` already provides immutable successors,
reciprocal acyclic supersession, and one current record per lineage. Reuse it.

Vision exists at two scales:

| Scale | Count | When |
| --- | --- | --- |
| Product | One, rarely changes | **Before** trajectory assembly, coarsely; refined after |
| Feature | Per trajectory root | After assembly, by editing what the agent proposed |

Product vision is asked first because it is cheap and because it gives the agent
a ranking criterion during collection: what to read first, which trajectories to
assemble earlier. Vision is an input as well as an output.

### Trajectories form a graph

Four edge types. Vision inherits along one of them only:

| Edge | Meaning | Inherits vision |
| --- | --- | --- |
| `part-of` | Y is part of X | **Yes**, downward |
| `depends-on` | X does not work without Y | No |
| `succeeds` | Y replaced X | No |
| `conflicts` | X and Y pull apart | No — this is a question, not an edge |

A node with no product intent is not a trajectory. It carries nothing a vision can
attach to, so it is **evidence under** a trajectory rather than a node in the graph.
The existing `realization.intent: not-applicable` already marks these honestly and
gives the filter a deterministic input: discard everything that declares no product
intent, then build the graph from what remains. Four of the six combat pages declare
exactly that, and none of them is a subject anyone could decide about.

Rules:

- A vision is required at each **root**. Children inherit until one refines.
- A child vision contradicting its parent is a detected conflict surfaced as one
  product question — never resolved silently in either direction.
- Vision attaches to the trajectory, not to its position in the graph.
  Regrouping recomputes inheritance and preserves every answer already given.
- `part-of` is acyclic. `depends-on` need not be.
- Two parents are allowed; exactly one is marked primary, and only the primary
  inherits.

Child gaps sum upward, so the root with the largest total gap is asked about
first. Question order comes from the product rather than from file coverage.

The risk this carries: the agent builds the hierarchy, so the agent decides what
the maintainer is asked about and in what order. Composition must be derived from
product language with code structure as a signal only — source code does not
establish product intent (`spec/KNOWLEDGE.md:27`) — and the agent records why it
grouped, with the same discipline it records why something changed.

## Record shapes

Every field below exists because a prototype needed it. Nothing is here on
speculation.

### Observation

```yaml
observation:
  id: obs-<slug>
  at: <ISO-8601>              # when the source said it
  read_at: <ISO-8601>         # when this agent read it
  source:
    kind: raw | source-code | version-control | external | maintainer
    resource: <pinned pointer>
  says: <one sentence>
```

`at` and `read_at` are separate because the equipment slice needed both: a design
document asserted things on 2026-07-11 and was read on 2026-08-03. Collapsing them
makes every observation look as old as the reading.

### Finding

```yaml
finding:
  id: fin-<slug>
  situation: <one sentence, past tense>
  period:
    from: <ISO-8601>
    to: <ISO-8601> | null     # null = still true at the last comparison
  observations: [obs-<slug>, ...]
  cause:
    kind: decision | compromise | drift | defect | external | not-found | unknown
    evidence: [<pinned pointer>, ...]   # required unless kind is not-found | unknown
    note: <one sentence>
  scope_limits: [<sentence>, ...]       # what this finding does NOT establish
```

`scope_limits` is a field rather than prose because it is the thing that gets lost.
The equipment candidate carried three; the page written from it dropped all three
and had to be repaired the next day. A field can be checked for survival; a
paragraph cannot.

Observations and findings live inside the file of the trajectory that owns them.
There is no standalone finding: attaching material to a subject means nesting it
under that subject, which is also what "attach it under a subject that does carry
product intent" means for material that carries none.

Every `resource` and every `cause.evidence` entry is resolved:

| Form | Resolution |
| --- | --- |
| `raw/…`, `changes/…`, any repo-relative path | Must exist. A trailing `#anchor` or `:line` is stripped first |
| `git:<owner>/<repo>@<40-hex>#<path>` | Resolved against a connected checkout of that repository; a shorter commit or a missing `#path` is malformed |
| `intake-case:<id>`, `project-reconstruction:<id>` | The case directory must exist, active or archived |
| Anything else with a scheme | Warned as unresolvable by this build |

A pinned pointer whose repository has no connected checkout is reported as
unverified rather than passed. The first real run of this pipeline produced a typo
in a source path and an earlier build accepted it, which made every other
guarantee here worth less than it looked.

### Trajectory

```yaml
trajectory:
  id: traj-<slug>
  area: <area>
  subject: <name in product language>   # never a path, symbol, or module name
  conceived:
    at: <ISO-8601>
    from: [obs-<slug>, ...]
    statement: <one sentence>
  findings: [fin-<slug>, ...]
  now:
    pinned: <revision>
    read_at: <ISO-8601>
    state: <one sentence>
  edges:
    - kind: part-of | depends-on | succeeds | conflicts
      target: traj-<slug>
      primary: true | false             # part-of only; exactly one true per trajectory
  vision: <decision id> | null
  gaps: [...]
```

A subject that declares `realization.intent: not-applicable` in the curated corpus,
or whose material carries no product intent, produces observations and findings but
never a trajectory. It is evidence under one.

### Vision

A decision record, not a field. Immutable successors, acyclic supersession, one
current record per subject.

```yaml
kind: vision
id: vision-<slug>                # derived from the trajectory, never asked for
trajectory: traj-<slug>
declared_by: human:<id>          # from configuration; nobody retypes their own name
at: <ISO-8601>
method: attested | interactive | token
attested: <the maintainer's own answer, verbatim — attested only>
session: <where they said it>
supersedes: vision-<slug> | ""
receipt: <sha256>
---
<the statement, in the body, because prose belongs where a person reads it>
```

**A vision names its trajectory; a trajectory never names its vision.** One
direction means the two cannot drift apart — the same reason a gap is derived
rather than stored. A trajectory that names a vision is an error.

### Three methods, deliberately unequal

| Method | How it is produced | What it establishes |
| --- | --- | --- |
| `attested` | The agent records it after the maintainer answered in the session, storing their own words | An answer exists and is about this statement |
| `interactive` | A typed confirmation at a terminal | A separate channel, not the agent's writing |
| `token` | An out-of-band token for unattended runs | The same, for automation |

`attested` is the ordinary path because the ordinary case is a maintainer who has
already answered. The first real run of this pipeline ended with the agent handing
the maintainer a command carrying a generated slug, a generated id and their own
name to retype — clerical work given to the person whose only job here is to
decide about the product. That is the failure this workflow exists to remove, and
it had reappeared inside the machinery meant to remove it.

An agent can fabricate an attestation. What the field buys is that fabricating
becomes a lie in a named place rather than an absence, and a lie in a field that
reads "here is what you said" is found by the person who said it. That is weaker
than a receipt from another channel, which is exactly why the methods stay
distinguishable in the record instead of collapsing into "approved".

What is refused in every mode is a declaration with no answer behind it at all.
`docs/04-your-part.md` already says a receipt proves the command ran and not who
typed it; an attestation proves less about the channel and more about the content,
and neither is strong enough to make the other unnecessary.

### Gap

Derived on read, never authored.

```yaml
gap:
  kind: delivery-debt | direction-debt | hole
  statement: <one sentence>
  status: open | to-close | deferred
  work: <changes/ path> | null          # present only when status is to-close
```

`accept` is absent from `status` on purpose: a gap that is right as it stands is a
vision that was wrong, and recording it as an accepted gap loses the difference
between deciding and giving up. Accepting edits the vision and the gap disappears.

### Worked instance

From the equipment slice, abridged to one finding of each interesting shape.

```yaml
observation:
  id: obs-h1-flagged
  at: 2026-07-11
  read_at: 2026-08-04
  source: {kind: raw, resource: "raw/api/world-loop-review/05-equipment-and-inventory.md#§1"}
  says: Shield is not a hand slot, so a two-handed weapon beside a shield would be permitted; flagged must-close with an instruction to verify the engine first.

finding:
  id: fin-shield-hole-open
  subject: traj-equipment
  situation: The loadout validator permitted a two-handed weapon beside a shield, and the project deferred closing it.
  period: {from: 2026-07-11, to: null}
  observations: [obs-h1-flagged, obs-required-slots, obs-can-equip, obs-progress-deferred]
  cause:
    kind: decision
    evidence: ["raw/api/world-loop-review/PROGRESS.md:1037"]
    note: Listed as DEFERRED (recorded) in the A4 equipment plan — scheduled, not missed.
  scope_limits:
    - What the projected character sheet does with the shield's armour contribution was not traced.

trajectory:
  id: traj-equipment
  area: characters
  subject: Equipment
  now:
    pinned: dnd-api@34cf66cb
    read_at: 2026-08-04
    state: Gear reaches a fight; two recorded rules do not hold.
  edges:
    - {kind: part-of, target: traj-characters, primary: true}
  vision: vision-equipment-authorable
  gaps:
    - kind: direction-debt
      statement: Equip logic is hardcoded; the vision requires it composable and authorable.
      status: to-close
      work: changes/inbox/2026-08-03-2026-08-04-equip-logic-must-become-authorable.md
    - kind: hole
      statement: Whether a two-handed weapon and a shield should be exclusive at all.
      status: open
      work: null
```

The `cause.evidence` pointer on `fin-shield-hole-open` is the whole argument for the
field: without it the same finding classifies as `drift`, and the maintainer is told
nobody decided something the project scheduled deliberately.

## Phase order

| Phase | Work | Maintainer |
| --- | --- | --- |
| 0 | Freeze scope | — |
| 1 | Complete reading → observations. Nothing about the present | — |
| 2 | Observations → findings | — |
| 3 | Compare **implementation** findings against source at a pinned revision → was/now. Intent findings are not compared | — |
| 4 | Assemble trajectories and the graph; classify causes; size gaps | — |
| 5 | **The only gate.** Per trajectory root: edit the proposed vision, or accept it | **Yes** |
| 6 | Write `knowledge/` from trajectories. Debt and plans fall out of the gap | — |

The maintainer is absent in 0–4 and 6.

Phase 3 splits the corpus rather than sweeping it: implementation findings are
checked against code; intent findings are not, because checking intent against
code is the inference the contract already forbids.

Phase 3 reads the pinned revision, not the working tree. In the prototype the pin
sat two commits ahead of the checkout's `HEAD`, on a different branch. "What the
source shows now" is a statement about a named revision or it is not a statement.

### What this does not buy

It does not save context. Measured on the equipment slice: roughly 800 lines of
dense material for one trajectory — a design document, three candidate records, a
curated page, four source reads, and discovery. Extrapolated across this corpus
that is the same order as reading everything, which is what the phases were never
going to avoid: the material has to be read either way.

What it buys is decision load and ordering. The maintainer is asked once instead of
continuously, and no claim can reach `knowledge/` before the material that
contradicts it has been read. Any argument for this design that rests on token cost
is false and should not be made.

## Decision separation

Three categories, not two. Conflating the third with the first is half the reason
the queue grows.

| Category | Examples | Who |
| --- | --- | --- |
| Product | Vision, gap status, framing | Maintainer, packet required |
| Permission | Commit, push, checkout rebind | Maintainer, one word, no packet |
| Clerical | Everything else | Agent, silently, to the ledger |

Every clerical gate that exists today gets one of three fates: removed (probe
waiver, migration review signature), derived (`completed|partial`), or restated
as the product question hiding behind it (raw scope by theme rather than by
pathspec).

To make the separation strict rather than declarative, a maintainer-facing ask
should be typed at the point it is made — `product` or `permission`, with no
clerical value in the enumeration — so a clerical ask becomes a detectable defect
instead of a matter of style.

## What this removes

| From the contract | Fate |
| --- | --- |
| Routing at read time (`spec/KNOWLEDGE.md:120-134`) | Removed. Routing is phase 6 |
| `rules/common/maintainer-review.md:53-79`, `:70-74` | Removed. Manual workarounds for missing phases |
| Per-candidate adjudication of five classes (`reconstruction-model.md:175-176`) | Not removed — the unit becomes the trajectory |
| "Was it always meant to work that way, or is that a change you want now?" (`reconstruction-model.md:143`) | Answered by structure. The trajectory answers the first half; the vision gate is the second |
| `--outcome completed\|partial` as a question | Derived from resolved claims, read sources, and green gates |
| Unresolvable chronology (`spec/KNOWLEDGE.md:38-39`) | Stays a maintainer question — a small residue, not five classes per candidate |

## Migration

Existing material converts rather than restarts, marked as assembled from the
previous model with incomplete history.

Candidates carry routing and time already, so they convert partially.

Curated pages convert through their `sources[]`, not their prose. A page is an
interpretation, and the interpretations are what this design exists to redo;
placing page text in the observation layer would turn the agent's earlier
mistakes into evidence.

A `sources[]` entry is **not** an observation as it stands, and an earlier version
of this document said it was. It carries a resource and a claim; it carries no
date of its own, and an observation without its own date reads as old as the
reading. Derive `at` explicitly, in this order, and never leave it to be inferred:

1. the date the cited material itself asserts, when the source states one;
2. the commit date of the pinned revision, for a `git:` resource;
3. the page's `generated.at`, which dates the reading rather than the material,
   and is therefore the last resort rather than the default.

Intake and reconstruction cases are worse: the case body is a template and the
observations exist only as prose inside a candidate's `reason`. Recovering them
means reading that prose and attributing each statement to the source it came
from, using `sources[].candidate_ids` to map candidates back to paths. It works,
and it is a manual seam rather than a conversion.

## Evidence that the model is missing, from a live repository

Observed in `DnD/knowledge-shared` on 2026-08-04:

- `knowledge/vision/` exists, declares itself as project intent and non-goals,
  and holds nothing. The location is already reserved.
- `knowledge/areas/presentation/implementation/delivery-gap.md` records a gap as
  a standalone engineering page with `intent: not-applicable` and `alignment:
  not-applicable`. The agent had a gap to state and no axis to state it on, so it
  worked around the model. Once the third axis exists, the gap belongs on the
  subject's own page and this page has no reason to exist.
- Three maintainer decisions — an equipment rework called a must-have, a rename
  acknowledged as debt, and the product's name — sit in `changes/inbox/` as
  `status: pending`, `awaits: maintainer`, in a surface the contract defines as a
  non-authoritative queue (`spec/KNOWLEDGE.md:15`). `changes/active/` is empty.
- That same directory holds six different kinds of object under one type:
  findings, visions, acknowledged debt, holes, product decisions, and open
  questions.

## Prototype

Phases 1–4 were run by hand over the equipment slice of `DnD/knowledge-shared`,
against `dnd-api@34cf66cb`, changing nothing in `wfctl`. Output:
17 observations → 8 findings → 1 trajectory → **1 product question**, with no
maintainer contact anywhere in phases 1–4.

What it settled:

| Question | Result |
| --- | --- |
| Does nuance survive the lift through the layers | **Yes.** All three recorded scope limits reached the trajectory intact |
| Can a cause be assigned without inventing it | **Yes, 7 of 7** — but 2 of 7 would have been classified `drift` falsely without cause evidence |
| Does the trajectory read as something a vision can be set against | **Yes, empirically.** The maintainer produced exactly such a statement on 2026-08-03, unprompted, and it is the format the gate needs |
| Does a finding suffice for phase 3 without reopening the source | **For delivery, yes. For cause, no** — hence `cause.evidence` above |

Under the current model the same material produced three candidates each requiring
adjudication, a capture, and a case-closure decision.

### Second prototype — the combat slice, against risk 1

Chosen because every page in it is named for engineering (`engine-isolation`,
`engine-reachability`, `presentation-layers`, `client-combat-sdk`,
`realtime-combat-contract`). If a product hierarchy is derivable there, the risk is
manageable.

It is derivable, and an agent already derived it: `knowledge/areas/combat/index.md`
names three product capabilities in prose — the tactical engine, the live fight
channel, and the player's combat surface. What it did not do is write them as
subjects. `combat/capabilities/` does not exist.

The two hierarchies are not the same graph:

| | Derived from the file tree | Derived from product capability |
| --- | --- | --- |
| Shape | Six flat peers under `combat` | Three capabilities, one with a child (conformance) |
| Usable for vision | No — nobody sets direction for "engine isolation" | Yes |
| Cross-cutting | Invisible | `realtime-combat-contract` serves two capabilities; `engine-reachability` lands its consequence in **Authoring** |

So risk 1 is real and conditional rather than fatal: composition must be derived
from product capability naming, never from directory structure, and the two must be
expected to differ. An agent that builds the hierarchy from paths produces a graph
that is correct about the repository and useless for deciding anything.

The corpus shows where this already bites. Capability pages exist in three areas and
are absent in four — `combat`, `platform`, `content`, `presentation` carry only
engineering pages. In those four the product layer was derived, stated in a
paragraph, and had nowhere to be recorded.

Incidental, worth keeping: a comment at `services/characters/src/application/equipment.rs:11`
cites "a documented M2 boundary" for the attunement gap, where the design numbers
the attunement action M7 and M2 as equipment persistence. Whether this is a
different numbering or a wrong citation was not established.

### The packet is rendered, not written

Records written against a contract came out in clean product language; the message
summarizing them came out full of file names, record ids, ledger codes, commit
hashes and raw field values. Measured on the first real corpus: zero identifiers
in the prose fields of five trajectories, and identifiers in every section of the
packet built from them.

The norm forbidding this has existed since the beginning
(`rules/common/maintainer-review.md`) and failed exactly as "compact packet"
failed, for the same reason: a prose norm is not a gate. So the packet is
generated by `wfctl knowledge trajectory ask`, which cannot print an identifier
because it never reads one, renders each cause as what it means rather than as its
schema token, and states a limit shared by every finding once instead of thirteen
times.

Addresses are not the enemy and must not be removed from the corpus — `evidence`,
`resource` and `edges` are where traceability lives. They are simply not what a
product owner should have to decode to answer a question about their own product.

## Open risks

1. **Silence before the first question.** The maintainer sees nothing through
   phases 0–4, where today they receive questions early — bad ones, but early. A
   progress signal that requires no decision is needed, or the first run reads as
   a hung agent.
2. **Trajectory boundaries are agent-chosen.** Saying "that is not part of that"
   must be cheap, and must invalidate no vision already given. Untested — both
   prototypes accepted the boundaries as found.
3. **Cause evidence may not exist for older material.** The equipment slice had a
   progress file and self-documenting source. A slice with neither yields
   `not-found` everywhere, which is honest but carries no steering value. Unmeasured.
4. **Vision inheritance across a real graph.** The combat slice has one parent-child
   pair (engine → conformance) and inheritance is trivially correct there. A conflict
   between a parent vision and a child vision has never been produced, so the rule
   that surfaces it as one product question is unexercised.

## Implementation

`src/trajectory.ts` compiles `trajectories/*.md` into
`.workflow/current/trajectory-graph.json`, following the claim-ledger pattern: a
content hash over a stable payload, structural errors reported rather than thrown,
and a refusal to write while any error remains.

`wfctl knowledge trajectory check [--build]` runs it. It does not require valid
curated knowledge, because a trajectory exists before the pages written from it.

Every rule in this document that could be made mechanical is:

| Rule | Enforced as |
| --- | --- |
| A cause that claims a reason carries evidence for it | Error, unless the kind is `not-found` or `unknown` |
| A subject is product language, never a path or symbol | Error on `/`, `::`, a source extension, kebab-case, or camelCase |
| Vision inherits along `part-of` only | Error when any other edge is marked primary |
| Exactly one parent inherits | Error on zero or several primary `part-of` edges |
| `part-of` is acyclic | Error naming the cycle |
| A gap cannot be accepted | Error stating that accepting edits the vision |
| A debt scheduled for closure names its work | Error both ways — work without `to-close` is also wrong |
| An observation carries its own date | Error on a missing `at` |
| "What the source shows now" names a revision | Error on a missing `now.pinned` |
| Child gaps sum upward | `gapWeight`, and the pending queue is sorted by it |
| Addresses stay out of maintainer-facing prose | Error on a path, id, commit, section or symbol in `situation`, a gap statement or `now.state` |
| The packet is generated, not composed | `trajectory ask` renders from prose fields only, and renders causes as sentences |
| A trajectory does not name its vision | Error; the current vision is derived from the vision records |
| Only a maintainer declares direction | `declared_by` must be `human:<id>`, in both the command and the compiler |
| Direction is not producible unattended | `declare` requires an interactive terminal or `WFCTL_APPROVAL_TOKEN` |
| A vision document matches what was declared | Receipt reconciled against the ignored durable record |
| One current vision per subject | Error naming both; supersede rather than add |
| A lineage stays on one subject and does not cycle | Errors naming the crosswire or the cycle |

Verified end to end against the prototype's own material:

| Property | Observed |
| --- | --- |
| Compiles clean, one root awaiting a vision, gap weight four | `Awaiting your vision (1) … Equipment — 4 open gap(s)` |
| The cause guard fires on a false `drift` | `cause.kind is drift and carries no evidence` |
| A declared vision empties the queue | `No trajectory is waiting on a product decision.` |
| Editing the vision document breaks it | `does not match the recorded declaration's trajectory or actor` |
| An unattended session cannot declare direction | `wfctl does not record product direction from an unattended session` |

What is not yet mechanical: the `intent: not-applicable` exclusion is a rule for
phase 4 rather than a check on the record, because a trajectory that was never
written cannot be rejected. It lives in `skills/assemble-trajectories`, together
with the subject-naming judgement the compiler can only partly guard.

### Where the pieces live

| Piece | Location |
| --- | --- |
| Compiler and validation | `src/trajectory.ts` |
| Vision declaration and receipt | `src/vision.ts` |
| Commands | `wfctl knowledge trajectory check\|declare` |
| Phases 2–5 procedure | `skills/assemble-trajectories/SKILL.md` |
| Routing into it | `rules/knowledge/knowledge-curation.md`, `skills/operate-project-knowledge`, `skills/reconstruct-project-knowledge` |
| Normative contract | `spec/KNOWLEDGE.md`, `spec/CLI.md` |
| Behaviour corpus | `evals/trajectories/` — 8 trigger, 10 behaviour |

### What was deliberately not done

Routing at read time still exists, and the two manual workarounds in
`rules/common/maintainer-review.md` are still in place. Removing them is a
breaking change to a pipeline currently carrying live work, and the replacement
has not yet run a real reconstruction end to end. They come out after it has,
not before.

Note also that the evals are corpus-only until someone runs them: `evals/results/`
is empty, so the routing and behaviour claimed above are specified rather than
demonstrated. That is the repository's existing condition, not a new gap, but it
applies to every claim in this section.

## Next step

1. Run one real reconstruction through phases 1–5 on a live corpus. Everything
   above is verified in pieces and unverified as a pipeline.
2. Record eval runs, so the routing and behaviour in `evals/trajectories/` stop
   being specification and become evidence.
3. A third prototype against risk 4 — a slice where a parent and a child can
   plausibly want different things. The compiler rejects two current visions on
   **one** subject; it does not detect a child vision contradicting its inherited
   parent, which is a different thing and needs a real example to specify.
4. Then retire routing at read time and the two workarounds in
   `rules/common/maintainer-review.md`.
