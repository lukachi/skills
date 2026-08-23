# The debts become work

The road out, and it is the same road for one debt and for two hundred.

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
wfctl work start <slug> --title "<what becomes true>" --leaf <checkout> [--leaf <checkout> ...]
wfctl knowledge trajectory schedule <trajectory> --gap <n or phrase> --work <bundle>
```

Repeat `--leaf` for every repository the debt actually reaches. A subject is a
unit of direction and a repository is a unit of code, so one debt crossing three
of them is ordinary rather than a sign the grouping is wrong. Shape it from here:
only this repository sees all three at once, and `wfctl work repositories <id>`
reads what each one declares about itself — its own instructions and the skills
installed only there — which a session inside any single checkout would see for
that checkout alone. This is delivery and not another reconstruction: it reads
what the debt touches and ends in one approved specification.

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
