---
name: assemble-trajectories
description: Lift what has been read into trajectories — one product subject as a line from how it was conceived, through what changed and why, to what the source shows now — then put the single product question to the maintainer. Use after a reconstruction or intake pass has read its material, before any page is written, or when existing candidates must be converted into subjects the maintainer can set a direction against. Do not use to read material, to write curated knowledge, or to decide direction on the maintainer's behalf.
---

# Assemble Trajectories

Turn what was read into subjects a person can decide about. One invariant holds
across everything below:

> No layer below a trajectory may assert anything about the present.

An observation says what one source said, on a date. A finding says what
happened, over a period. Only a trajectory speaks about now, and only after the
current source has been read at a named revision. A claim about current truth
made while reading is a claim made before the material that contradicts it has
been read.

Read [the trajectory contract](../../TRAJECTORIES.md) before the first
assembly in a session.

## Where observations come from

The material is not lying in the shape this needs, and pretending otherwise wastes
the first hour of a run. In a corpus assembled under the previous model:

- Case bodies are templates. The substance lives in the frontmatter.
- A candidate's `reason` is prose containing several observations at once. Split
  it, and attribute each statement to the source it came from rather than to the
  candidate.
- `sources[].candidate_ids` maps candidates back to the raw paths they were drawn
  from. That mapping is how a candidate becomes citable observations.
- No entry carries its own date. Derive `at` from what the material asserts, else
  the commit date of the pinned revision, else the page's `generated.at` — and
  treat the last as a last resort, because it dates the reading and not the
  material.

Re-read a cited source when the prose is ambiguous about what it actually said.
That is not new reading; it is checking a quotation.

## What you never do here

- Do not widen the scope by reading material outside it. Reading a source your
  own findings cite is fine; opening a new area is not.
- Do not write anything under `knowledge/`. Curation is phase six.
- Do not decide a vision. Recording one the maintainer gave you is your work;
  supplying the answer yourself is the one betrayal this workflow cannot detect
  afterwards, and `--attested` is where it would hide.
- Do not ask the maintainer anything during phases two through four. Every
  question that occurs to you there is a question whose answer is probably in
  material you have already read.

## Say where you are

Phases two through four run without contact, and a long silence reads as a hung
agent. At each phase boundary emit one line of counts and nothing else:

```
findings: 17 from 41 observations · causes 9 decision, 5 not-found, 1 drift, 1 defect, 1 unknown
compared: 11 implementation findings against dnd-admin@2743a3ef, dnd-api@34cf66cb
assembled: 5 trajectories, 1 root, 8 gaps
```

Counts only. A phase boundary is not an opportunity to ask something.

## Phase two — findings

A finding reduces observations about one subject into a situation that occurred.
It is past tense. It carries the period it held for, and `to: null` only when the
last comparison found it still true.

Every finding carries a cause, because a changelog is not something anyone can
steer from:

| Cause | Use when |
| --- | --- |
| `decision` | A record says someone chose this, with an author or a date |
| `compromise` | Deliberate, under a named constraint |
| `drift` | Positive evidence that nobody decided — not merely no record |
| `defect` | It matches nothing that was ever stated |
| `external` | A platform, dependency, or requirement moved |
| `not-found` | You looked for a decision record and did not find one |
| `unknown` | You cannot tell, and say so |

**`not-found` is not `drift`.** Absence of a record is not evidence that no
decision was made; the record may not have survived, may be in unread material,
or may never have been written down. Recording silence as `drift` tells the
maintainer nobody decided something the project may have scheduled deliberately,
and they will reverse it on that basis.

The cause carries its own evidence, separate from the finding's. The pointers
that establish what the source does are not the pointers that establish why. Only
`not-found` and `unknown` may carry none, which is what makes them honest rather
than convenient — they are the two that claim nothing.

Put in `scope_limits` everything the finding does **not** establish. This is the
material that gets lost first, and a page written from a finding without them
states a conclusion the evidence never supported.

## Phase three — compare against the source

Split the corpus rather than sweeping it.

- **Implementation findings** are compared against source at a pinned revision.
- **Intent findings are not.** Checking intent against code is the inference the
  knowledge contract forbids, and code cannot establish accepted product intent.

Read the pinned revision, not the working tree. They differ more often than they
look like they will — a checkout can sit behind the pin, on another branch, or
carry uncommitted work. "What the source shows now" names a revision or it is not
a statement, and `now.pinned` is where that name goes.

Record what changed between the finding's period and now, not just the current
state. A closed gap is as much a part of the line as an open one.

Every pointer you write is resolved by `wfctl knowledge trajectory check`: a
repo-relative path must exist, and a `git:<owner>/<repo>@<40-hex>#<path>` pointer
is checked against a connected checkout. A pinned pointer whose repository is not
connected comes back as a warning rather than a pass — those are the ones still
worth your own eyes.

Phase-three evidence carries no read receipt. `wfctl knowledge reconstruct read`
writes into `reconstruction/`, which does not belong to this pipeline, so what a
pointer proves here is that the path exists at that revision and no more. Say so
rather than implying the source was verified line by line.

## Phase four — assemble

**A subject is named in product language.** Not a file, not a symbol, not a
module, not a service. The compiler rejects a path, a namespace operator and a
source-file extension — a paste, not a judgement. Everything else is yours:
`Engine Isolation` is exactly the failure this rule exists for and looks like
ordinary prose, so a clean compile establishes nothing about it.

The test is whether a maintainer could state where the subject should go. Nobody
sets a direction for "engine isolation" — that is a structural fact, evidence
under a subject rather than a subject. Nobody sets one for "the presentation
layer boundary" either. They do set one for what a player sees when a fight
starts.

**A record that declares no product intent is not a trajectory.** Where curated
material already carries `realization.intent: not-applicable`, or where the
material carries no product intent at all, produce observations and findings and
attach them under a subject that does. A hierarchy assembled from paths is
correct about the repository and useless for deciding anything.

Derive composition from what the product's own language groups. Source structure
is a signal and never the source. Record why you grouped, with the same
discipline you record why something changed — the grouping decides what the
maintainer is asked about and in what order, and it is yours, so it must be
visible and cheap to contest.

Edges:

| Edge | Meaning | Inherits vision |
| --- | --- | --- |
| `part-of` | Y is part of X | Yes, from one primary parent |
| `depends-on` | X does not work without Y | No |
| `succeeds` | Y replaced X | No |
| `conflicts` | X and Y pull apart | No — surface it as a question |

Then run:

```sh
wfctl knowledge trajectory check --build
```

Every error it reports is yours to fix. None of them is a maintainer question.

## Phase five — the one gate

The output lists the roots awaiting a vision, largest total gap first. That
order is the product's, not the corpus's; work it in that order.

Do not compose the packet. Render it:

```sh
wfctl knowledge trajectory ask [<trajectory>]
```

It emits what this is, how it was conceived, what changed and why with the causes
in words, what it does today, and what is open — all from the record, so it cannot
contain an identifier because it never reads one.

Then add the two parts no record holds:

- **A proposed vision**, written out, for the maintainer to correct. Never a blank
  question. Fifty subjects with "what should this be?" is the same overload in new
  clothes.
- **What closing the gap would cost**, coarsely. A vision declared without its
  price is a wishlist.

### The two parts you write obey the same line

Apply the reader test from `maintainer-review` to every sentence you add:

> Would the maintainer have to look something up to understand this?

The rendered part cannot fail it, because the renderer never reads an address. The
proposal and the cost are yours, composed freely, and that is exactly where the
failure lands: a message written from your working context carries file names as
evidence, record ids as subjects, and schema values as categories, while the
records behind it were written in product language and are clean.

Do not over-correct into emptiness. Dropping the substance along with the address
produces a sentence nobody can decide on either. Say what the thing does for the
product, with enough in it to be judged, and leave the pointer in the record where
it is load bearing.

If a sentence genuinely cannot be written without naming a file, that is a finding
about the product having no name for the thing — record it as one.

Then record the answer yourself. Do not hand the maintainer a command. An id, a
trajectory slug and their own name are your bookkeeping, and passing that to the
person who is here to decide about the product is the exact failure this pipeline
exists to remove:

```sh
wfctl knowledge trajectory declare <trajectory> \
  --statement "<the agreed text>" \
  --attested "<their answer, word for word>" \
  --session "<where they said it>"
```

`--attested` carries what they actually said, not your paraphrase and not a
restatement of the proposal. If their answer was "yes but drop the third one",
that is the string, and the final statement is the proposal with the third one
dropped. A reader months later must be able to see the answer and the statement
side by side and judge whether one follows from the other.

Use `--supersedes` when a vision replaces an earlier one for the same subject.
Never edit a vision document by hand; the receipt will not match, and the
compiler will say so.

"Leave it as it is" is a declared vision, not the absence of one. Record it with
their words. Otherwise half the corpus sits in a state nobody can distinguish
from neglect.

Where the maintainer wants a stronger record than an attestation, they run the
command themselves in a terminal and it records `interactive`. That is their
choice to make, not a default to impose on them.

## Phase six — the page

Write every subject's curated page from its trajectory, whether or not a
direction has been declared for it:

```sh
wfctl knowledge trajectory promote <trajectory>
```

It fills everything the records hold — what the subject does, where it is going,
the gap, the pinned evidence, the three axes — and marks the sections no record in
this pipeline carries: who it serves, the words the domain uses, an example. Those
are yours to write, and the page does not validate until you have.

**Do not wait for a direction before publishing.** A subject with none still gets
its page: what it does today, read at the pin, with no accepted intent and no
alignment, because there is nothing yet to be aligned with. Waiting instead makes
curated knowledge a derivative of the maintainer's decision queue — a subject read
in full from source does not appear to exist until they answer, so "what does this
project do" quietly returns a filtered subset and never mentions the filter.
Current behavior is an observation and direction is a decision; publish the
observation when you have it. When the direction arrives, promote again with
`--force` and the same page gains its second half.

The one subject that cannot be published is one whose every observation came from
raw, because curated knowledge may not cite untrusted input and the page would
rest on nothing. Read it at a pin first.

Two things it will tell you that matter more than the page.

**Raw observations could not become evidence.** Curated knowledge may never cite
untrusted input, so whatever a raw observation established rests on nothing once
promoted. If most of a subject came from raw, the page is thinner than the
trajectory was, and that is worth saying rather than hiding.

**Pages nothing claims.** A trajectory names the pages it replaces in `replaces`,
and promotion reports every page in the area that no trajectory named. Each is
either a subject with no trajectory yet or one whose trajectory forgot to claim
it — and the difference matters, because the first is work and the second is a
record that will be orphaned when the old page goes.

Promotion never deletes. Retiring a replaced page is a separate act after the new
one validates, and it is yours: a tool that quietly retires knowledge cannot be
run twice with confidence.

## Phase seven — the debts become work

A reconstruction that ends with every debt correctly recorded and none of it
reaching work has not finished; it has produced a document. This is the road out,
and it is the same road for one debt and for two hundred.

**You do not decide when this happens; the brief does.** The debt gate opens when
every subject that owes something has a direction to owe it against, and not
before — ordering debts against a direction nobody set asks the maintainer to
rank work with no standard. Until then the brief shows the vision gate instead,
and that is the work.

When it opens, do not compose the list. Render it:

```sh
wfctl knowledge trajectory debts --ask
```

Grouped by subject, heaviest first, with what distinguishes each group and no
identifier anywhere — the same rule the vision packet obeys. The order is a
proposal from what the graph knows: how much else stops working without a
subject, and how much its own line owes. Say so, and say plainly that theirs
replaces it. Forty-eight questions is the overload this pipeline exists to
remove; one ordered conversation is not.

Their answer has exactly three outcomes per group, and every debt must land in
one of them:

| They say | You run |
| --- | --- |
| this is next | `wfctl work start`, then `trajectory schedule` for each debt |
| deliberately not now | `wfctl knowledge trajectory defer --reason "<theirs>"` |
| something else first | nothing yet; it stays open and the gate stays open with it |

A debt left in none of the three is a debt that will be forgotten, which is the
failure the ledger exists to prevent. `defer` requires a reason for the same
reason a park does: set aside without one, it cannot be told from unread, and the
next session reopens the decision.

The full ledger, for your own reading rather than theirs:

```sh
wfctl knowledge trajectory debts
```

Open first, then the ones being closed, then the deferred, grouped by subject.
Three lines at the end matter more than the list:

- **Debts on subjects with no declared direction.** What they are owed against is
  unstated, so they cannot be sized or scheduled. Those subjects go back to phase
  five — `trajectory ask` — before anything else happens to them.
- **Debts naming work that has landed.** The debt does not end because a bundle
  closed. Re-read the subject at a new pin and it disappears if it is no longer
  true; if it survives the re-read, the work did not close it and saying so is
  the point.
- **Debts naming a bundle that exists nowhere.** Each reads as handled and is not.
  Fix those before presenting anything.

Then group and open work. Grouping is yours and it is a judgement: debts that
close together belong in one bundle, and a bundle spanning two subjects is
ordinary — a subject is a unit of direction, not a unit of work.

```sh
wfctl work start <slug> --title "<what becomes true>" --leaf <checkout>
wfctl knowledge trajectory schedule <trajectory> --gap <n or phrase> --work <bundle>
```

`schedule` refuses a bundle that does not exist, and refuses a second bundle for
a debt one already claims. Both refusals are the same rule: a debt pointing at
nothing, or at two things, reads as owned and is not.

**What the maintainer decides here is which debts, and in what order — nothing
else.** Which bundle, how it is cut into issues, what the acceptance criteria
say: yours. If a debt's direction is already declared, its cost is already
stated, and nothing conflicts, propose the bundle and open it. Bringing them a
list of twenty debts and asking "shall I open a bundle for each" is the phase-five
failure repeated one stage later.

Frame the bundle from the debt, not from the code: the acceptance criteria say
what becomes true for the product, and the debt statement is usually already that
sentence. Then put the framing to them with `wfctl work ask`, and record their
answer where they gave it:

```sh
wfctl work approve <bundle> --stage framing --by human:<id> \
  --attested "<their answer, word for word>" --session "<where they said it>"
```

Do not hand them the command. An interactive terminal and a token both remain,
and both are theirs to ask for; neither is the default, and sending someone to a
second terminal to retype a bundle id and their own name records no decision that
the attestation does not.

## What follows

The gap recomputes from the declared vision. Nothing else about it is stored: a
gap accepted as correct is a vision that was wrong, so amend the vision and the
gap disappears.

There is no command that marks a debt done, and that absence is deliberate. A
debt ends when the subject is read again at a new revision and the gap is no
longer derivable — never because someone struck it off a list. A tool that let a
subject claim delivery nobody read would reintroduce the exact defect this
pipeline was built to remove.

Only then does curation run, and it writes from trajectories rather than from
candidates.
