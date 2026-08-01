# 03 — Work in a source repository

## Use this when

You open an agent in a repository that contains code, and you want something
built, fixed, changed, or investigated.

## What you decide

| The agent handles | You decide |
| --- | --- |
| Classifying the request and running the workflow | Whether its classification is right |
| Investigating source and current knowledge | What the change should actually achieve |
| Drafting scope, exclusions, and acceptance criteria | Whether that framing is approved |
| Implementing, testing, and gathering evidence | Whether the result is done, partial, or abandoned |
| Proposing knowledge updates | Whether they become accepted truth |

You start by describing an outcome, not by naming a command:

> Change how account recovery works so a locked-out user can get back in with a
> second factor.

## Two routes

The first thing that happens is a classification, and it decides how much
process you get.

**Lightweight** — clearly local, behavior preserved: a typo, formatting, a
mechanical rename with no design choice. The agent just does it.

**Significant** — anything that may change observable behavior, product meaning,
a contract, data or control flow, stored state, security, operations,
architecture, or coordination between components.

Size is not the test. A one-line change to what an endpoint returns is
significant. A thousand-line formatting sweep is not.

When it is genuinely ambiguous, you should be told the specific risk, given one
recommendation, and asked once:

```text
you    → "Just bump the payment client retry count, small change."
agent  → "That changes retry behavior against a third-party API — duplicate
          charges are possible. I recommend the full route. Your call?"
```

If you say proceed lightly, that is the answer. Ceremony on everything is its
own failure.

## A significant change, start to finish

```text
you    → describe the outcome
agent  → creates one central record before extended discussion
agent  → binds the exact checkout it may change
       ── discussion: constraints, alternatives, what is out of scope
agent  → investigates the real source and compares with current knowledge
agent  → shows a framing packet: outcome, scope, exclusions, decisions,
          unknowns, acceptance criteria
you    → wfctl work approve <id> --stage framing --by human:<you>
agent  → splits into issues if the work spans sessions
agent  → claims one issue, implements it, records evidence
       ── repeat per issue
agent  → verifies the whole thing, shows acceptance results and deviations
you    → wfctl work approve <id> --stage completion --by human:<you>
agent  → archives the real outcome and promotes what durably changed
```

Correct the framing the moment something looks wrong. It is far cheaper before
implementation than after.

### The two approvals are yours to type

Framing and completion approvals are recorded by a command that asks for a typed
confirmation in your terminal:

```sh
wfctl work approve <change-id> --stage framing --by human:<your-id> \
  --note "What you accepted"
```

The agent can prepare it and hand it to you, but it cannot answer that prompt,
and a receipt written into the record by hand fails verification. This proves
the approval came from a deliberate separate step — not that a specific person
typed it. Treat it as a guard against silent self-approval, not as a signature.

## Where the record lives

The canonical record is in the knowledge repository, at
`changes/active/<change-id>/`:

| File | Holds |
| --- | --- |
| `change.md` | The outcome, scope, decisions, acceptance criteria, progress |
| `map.md` | Only for Wayfinder: how a foggy route got cleared |
| `issues/` | Bounded units of work and their evidence |
| `artifacts/` | Referenced research or prototypes |
| `review.md` | Which files were read, at which exact content |

This repository keeps only an ignored pointer — never a second spec or tracker.
If one outcome spans several repositories, they all bind to the same record and
each gets its own final verification receipt.

Two things inside those files are worth knowing about, because they are what
makes an interrupted session recoverable.

A **checkpoint** is one short resume state per active unit: where things stand,
the last completed action, the exact next one. Its hash proves which version of
the record it summarized. It does not prove the summary is honest, and it never
replaces reading the record.

A **discovery ledger** holds anything learned whose loss would make a later
session repeat work, choose differently, misunderstand the task, or act unsafely
— with its evidence, implication, scope, and current status. It is deliberately
not a fixed list of categories, and it is not an activity log. Superseded
entries stay visible with their status corrected.

## When the route is too foggy to specify

Some initiatives have a visible destination and several dependent choices that
have to be made first. Forcing acceptance criteria there produces guesses.

> Help me shape the account-security direction before we decide what to build.

After you confirm, the agent charts a map in the same record: the destination,
the boundary it must not cross, precise questions as claimable issues, and
still-unphraseable uncertainty parked as fog. Each session resolves one decision
or investigation and stores the full answer with it.

Wayfinder finds a route; it does not build the destination. No product code, no
delivery issues, no second strategy document. When the fog is gone, the map
collapses into an ordinary specification with acceptance criteria, and only then
does delivery start.

Do not use it for a large but already-bounded task. That is just a spec.

## Picking up after a break

> Resume the active work.

You should not need the work ID. One bound active record resumes automatically;
with several, you get their human outcomes and pick. The agent reads the record
and its discovery ledger rather than relying on conversation memory.

If you changed branch or checkout under an active task, say so. Work must stop
until you approve an explicit rebind — a worktree is an exact workspace, not an
interchangeable copy of the repository.

## Honest endings

Three outcomes are all valid:

- **completed** — the accepted scope is implemented and verified;
- **partial** — real work delivered, gaps preserved and named;
- **abandoned** — the investigation is preserved and why it stopped is recorded.

Accepting a partial result is safer than letting the scope be rewritten until
everything appears complete. Watch for that specifically: acceptance criteria
quietly narrowing is the most common way "done" becomes false.

## What is actually guaranteed

| Mechanically enforced | Not enforced — your judgment |
| --- | --- |
| Every acceptance criterion has recorded passing evidence | That the evidence proves the behavior |
| Every issue is completed or explicitly dropped, no open claims | That the work was done well |
| Every record file was read at its current content hash | That reading it produced understanding |
| The bound checkout is clean and matches the verified commit | That the commit contains what the summary claims |
| Approvals came from the approval command | Who typed the confirmation |

Fixtures, mocks, and stubs cannot establish that a capability is delivered
unless that artifact was the agreed scope. Ask directly when it matters:

> Is this wired to the real service, or still behind the fixture?

## Next

[04 — Your part](04-your-part.md) — what only you can decide, and how to catch
the failures this list does not prevent.
