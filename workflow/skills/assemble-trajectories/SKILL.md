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

## What you never do here

- Do not read new material. Reading belongs to `process-raw-intake` and
  `reconstruct-project-knowledge`; this skill starts from what they produced.
- Do not write anything under `knowledge/`. Curation is phase six.
- Do not declare a vision. `wfctl knowledge trajectory declare` refuses an
  unattended session on purpose, and working around that is the one betrayal
  this workflow cannot detect afterwards.
- Do not ask the maintainer anything during phases two through four. Every
  question that occurs to you there is a question whose answer is probably in
  material you have already read.

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

## Phase four — assemble

**A subject is named in product language.** Not a file, not a symbol, not a
module, not a service. The compiler rejects the obvious forms, but it cannot
catch a subject that is an engineering concept wearing a product-shaped name.

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

Per root, hand over a packet the maintainer answers by editing rather than
authoring:

1. **What this is**, named as the product names it, and where a person meets it.
2. **How it was conceived**, in one or two sentences.
3. **What changed and why**, with the causes stated — a maintainer treats "we
   decided" and "it drifted" completely differently, and the difference is the
   most useful thing you can give them.
4. **What the source shows now**, at the named revision.
5. **A proposed vision**, written out, for them to correct. Never a blank
   question. Fifty subjects with "what should this be?" is the same overload in
   new clothes.
6. **What closing the gap would cost**, coarsely. A vision declared without its
   price is a wishlist.

Then record their answer, which only they can produce:

```sh
wfctl knowledge trajectory declare <trajectory> \
  --id <vision-id> --by human:<maintainer-id> \
  --statement "<what it should become>"
```

Use `--supersedes` when a vision replaces an earlier one for the same subject.
Never edit a vision document by hand; the receipt will not match, and the
compiler will say so.

"Leave it as it is" is a declared vision, not the absence of one. Record it.
Otherwise half the corpus sits in a state nobody can distinguish from neglect.

## What follows

The gap recomputes from the declared vision. Nothing else about it is stored: a
gap accepted as correct is a vision that was wrong, so amend the vision and the
gap disappears. A gap scheduled for closure names the work that closes it under
`changes/`; a gap nobody owns stays visible and unowned, which is honest.

Only then does curation run, and it writes from trajectories rather than from
candidates.
