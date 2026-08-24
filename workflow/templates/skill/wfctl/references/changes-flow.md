# The changes flow

Eight steps. Each is unlocked by the one before it, and each command prints what
the next one needs — so you can walk this without memorising it.

| Step | What is settled | Whose |
| --- | --- | --- |
| `opened` | significant or lightweight | maintainer's |
| `aligned` | what the project already says about this subject | yours |
| `framed` | the outcome, the boundary, the acceptance criteria | maintainer's |
| `split` | the units of delivery | yours |
| `implement` | one slice at a time, in a bound checkout | yours |
| `verified` | an adversarial review by a different agent | yours |
| `closed` | nothing | nobody's |
| `promoted` | what the project now says about itself | maintainer's |

`split` may be skipped for lightweight work.

## Opening

```sh
wfctl work start --title "<what this is>" --weight <significant|lightweight> \
  --attested "<what the maintainer said>"
```

Both the weight and their answer are recorded, never inferred. A bundle exists
because they asked for it, and this is the only place that is written down —
without it, a record they agreed to is indistinguishable from one you opened
because you noticed something. If you cannot quote them, it is a capture.

When the work already exists somewhere — a stranded bundle, two records that are
the same work said differently, an issue, a branch — assemble it instead:

```sh
wfctl work list                                  # what exists, and what can reach it
wfctl work adopt <bundle> --weight <...> --attested "<what they said>"
wfctl work adopt <other> --attested "<what they said>"   # folds another in
```

Adoption parses nothing and repairs nothing. It is this same opening with the
details taken from where the work lives; every gate below is walked here
regardless of what was walked elsewhere. Each absorption needs its own answer,
and an absorbed bundle is marked where it sits rather than deleted.

The weight itself is recorded, never inferred. Significant work may change behaviour,
product meaning, contracts, data or control flow, persistent state, security,
operations or architecture. Lightweight work is clearly local and mechanical and
preserves both behaviour and contracts.

Put that distinction to the maintainer in your own words, in product language.
Do not read the definition out, and do not decide it yourself — the previous
workflow let the agent judge it silently, and it judged generously. If the
impact is genuinely ambiguous, say so and let them choose.

## Aligning

Find out what the project has already said about this subject, and record it.

Search with the project's own vocabulary — the canonical term, its aliases, the
names it discourages. Your paraphrase is the wrong key.

**If nothing is written yet, record that nothing covers it.** An empty corpus
passes a conflict check in silence, and "no conflicts found" reads exactly like
a check that ran and found nothing wrong. A project that has never been
reconstructed is the ordinary first case, not an error.

## Framing

The cheapest moment to change the scope, and the last one where it is free.

Settle it by interviewing rather than composing — a specification assembled from
two answers and an inference has settled the rest by guessing, and the guesses
are invisible once they are prose. See [deciding](deciding.md).

What it carries: the problem and outcome from the perspective of the person the
product serves; extensive user stories; scope and explicit exclusions; the
approved decisions with enough rationale to guide implementation; acceptance
criteria with stable ids; the seams the behaviour will be tested at; and the
uncertainty left unresolved rather than guessed away.

The criteria are digested at approval. That digest is what later distinguishes a
reworded contract from the one that was agreed to.

## Splitting

Tracer-bullet vertical slices, each cutting a narrow but complete path through
every layer it needs. **Sized by scope and coherence** — never "for one agent
session", which taught agents to stop halfway through a context that was still
wide open.

There are no blocking edges and no frontier to respect. A map that came out of
grilling can be worked efficiently in an order no dependency graph would
predict. Where order genuinely matters, write it in the unit's notes, which is
also where everything else you learn about it goes.

Wide refactors are the exception to vertical slicing. A mechanical change whose
blast radius fans across the codebase is sequenced expand–migrate–contract: add
the new form beside the old, migrate call sites in batches sized by blast
radius, delete the old form once no caller remains.

## Implementing

```sh
wfctl work issue claim <id> --repository <owner/name> [--worktree <id>]
```

A claim binds repository and worktree — never branch or commit. Pinning a
revision that then moved under the record was the cause of every recorded
binding deadlock.

Read the structure before you change it: follow the graph outward from what you
are touching. Duplicating something that already exists and contradicting an
architecture you never read look identical from inside the edit.

One slice at a time, test-first at the agreed seams. Write one externally
meaningful failing check, confirm it fails for the intended reason, make the
minimum change that passes it, run the focused check, repeat. Refactoring
belongs to review, not to this loop.

Finishing a unit is not finishing. The next unit is available work.

## Verifying

You cannot do this yourself — see [verification](verification.md).

## Closing

Nobody is asked. Draft the pages first: a record closing with drafted pages
waits in the promotion queue rather than archiving, whatever its outcome, and a
partial delivery is exactly when there is most to say.

```sh
wfctl work promotion draft "<area>/<page>.md"   # the tool creates it and prints where
wfctl work close --outcome <completed|partial|abandoned>
```

Use the honest outcome. A `completed` that had to be argued for is the one worth
doubting.

Every unit must be terminal — done or deliberately dropped. An open unit is
exactly the work nobody got to, and closing over it reports undelivered work as
delivered:

```sh
wfctl work issue drop <id> --reason "<why it left the route>"
```

## Promoting

```sh
wfctl work promote --subject "<product subject>" --summary "<what it now does>"
```

This writes the pages **and** appends to the subject's line. A closed change is
an event on that line; a promotion that writes only pages leaves the line to be
rediscovered by the next reconstruction at the cost of reading everything again.
