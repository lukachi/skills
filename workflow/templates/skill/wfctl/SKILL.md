---
name: wfctl
description: Operate the wfctl project workflow in a knowledge repository — starting a change or a reconstruction, resuming after a fresh session or compaction, recording what was learned, putting a decision to the maintainer, verifying delivery, and promoting what the project now says about itself. Use whenever work in this repository is more than a question, when a session opens onto an open flow, or when a wfctl command refuses and its remedy needs context. Do not use for questions answered by reading curated knowledge.
---

# wfctl

You are in a knowledge repository. It holds what the project means, what it has
delivered, and the record of work in flight. Source code lives in leaf
repositories this one knows about; you edit those from here, as an orchestrator.

**The tool tells you what comes next.** Every command prints what the current
state demands and the command that records it; the following command refuses
until that exists. You are not expected to know the sequence — this skill is the
map, not the instructions. Follow what you are handed.

## Start every session with the brief

```sh
wfctl brief
```

It reports open flows, what awaits you, and what awaits the maintainer. It is
authoritative: do not rediscover that state by scanning records, and do not read
it back to them. Compose one short orientation — what exists, what is in
progress, what waits on them.

A signal marked `awaits maintainer` is a question for them. Everything marked
`awaits agent` is yours, and available work is yours to take without being told
again.

If a flow is open, read its handoff before acting:

```sh
wfctl handoff
```

## Two things can run, and the maintainer starts them

| | When |
| --- | --- |
| `wfctl work start` | a change: something about the product or its code should become different |
| `wfctl work adopt <bundle>` | the same change, assembled from work that already exists somewhere |
| `wfctl reconstruct start` | a reconstruction: recording what the project already is, because curated knowledge is missing or has drifted |

You never classify between them. The maintainer asks for one explicitly.

Neither is needed for a question. "What does this project do?" is answered by
reading curated knowledge — search it, follow the graph, read the pages. No
flow, no record, no gate.

**One at a time.** A flow is a fence around the workload that was agreed. While
one is open, work outside it is out of scope: something you notice along the way
goes to `wfctl capture`, never into a new record.

## A bundle exists because the maintainer said so

Both ways of opening one refuse without their words:

```
wfctl work start --title "<what this is>" --weight <significant|lightweight> \
  --attested "<what they said>"
```

Put the work to them in your own words — what it is, and whether it changes
behaviour, meaning, contracts, data or operations — then record their answer
verbatim. Never hand them a command to run; the identifiers in it are generated
and their part is deciding about the product, not typing.

This also answers the question you get wrong most often, and answers it by
possession rather than judgment:

> **If you cannot quote them, it is a capture.**

Not "if it feels small", not "if it is out of scope". Those are calls you can
talk yourself past. Whether you are holding their answer is not.

## Work that already exists

`wfctl work list` shows every bundle and whether anything can still reach one.
A bundle with no flow is stranded — nothing can resume, close or promote it.

Adoption is not a repair for old records and it parses nothing. It is the same
bundle creation with the details taken from wherever the work actually lives: a
stranded bundle, two records that are the same work said differently, an inbox
entry that should have been a unit, a branch, a conversation. Assembling those
details may mean grilling and wayfinding again — that is yours to judge, and the
flow's own steps already ask for it.

```
wfctl work adopt <bundle> --weight <significant|lightweight> \
  --attested "<what they said>"     # opens a fence around that bundle
wfctl work adopt <other> --attested "<what they said>"   # folds another into it
```

Three things hold:

- **Every absorption is its own answer.** Merging three confused records is a
  decision about what the work is. Asking once for a batch asks about none.
- **An absorbed bundle is marked, never deleted.** It stays where it is and
  points at the survivor. The duplicate is the evidence of whatever produced it.
- **The flow lands at `opened` whatever the source reached.** A step recorded
  elsewhere is a check this tool never ran, and a flow reporting checks nobody
  ran is the green gate the review exists to stop.

## Two roads over one project

Curated knowledge explains the same project twice, and every page says which
explanation it is. Neither road is derived from the other.

| `view:` | Explains | To |
| --- | --- | --- |
| `product` | behaviour, audience, capabilities, rules, exceptions, delivery | a client or product manager, without source knowledge |
| `engineering` | implementation, ownership, contracts, failures, operations | an engineer, linking product meaning rather than redefining it |
| `decision` | why a hard-to-reverse choice was made, in their words, dated | both — a decision is not on a road, it is the history they share |

A product page carrying code or a source path is refused: a product page
explaining implementation has stopped being the product road. `wfctl guide
curate-product` and `wfctl guide curate-engineering` carry each road's contract,
and the tool prints this again when you draft a page.

## The two decisions that are the maintainer's

**What the work is**, before it starts. **What the project says about itself**,
afterwards.

**Verification is neither, and closing is neither.**

Verification is part of the work, not a milestone to be granted: implement,
verify, fix what the review broke. Start it the moment the units are delivered,
the way you would run a test suite. Asking permission to check your own work
spends a turn on an answer that is "yes" every time, and the one time it is not,
they will have said so already.

Closing is neither either. Every part of "is this done" is already checked —
criteria, receipts, revisions, terminal units — and asking them to confirm
arithmetic they cannot check better than the tool costs a night. It returns to
them in exactly one case, and the tool names it: delivery no longer matches the
framing they approved.

Approving a framing settles what the work is, never that it begins. If they
approve and say not yet, park it; only their own word releases it.

## How to decide anything else

You decide it, or you find it. Facts are yours: what has already been decided,
then curated knowledge, then the source graph, then a subagent. Only decisions
are theirs, and they are put as one numbered round rather than one question per
turn — see [interviewing](references/deciding.md).

Where several materially different choices remain, present their human meaning,
evidence and your recommendation. After they choose, run the commands yourself.
Never hand them a command to type.

## Where the detail is

Read the one that matches what you are doing. Each is also served by
`wfctl guide <topic>` at the moment its state is reached.

| Reference | Read it when |
| --- | --- |
| [the changes flow](references/changes-flow.md) | a change is open, or about to be |
| [reconstruction](references/reconstruction.md) | a baseline is being built or re-checked |
| [recall](references/recall.md) | a gate says recall is incomplete, or before any decision |
| [verification](references/verification.md) | work is ready to be reviewed — includes the review artifact's exact shape |
| [records](references/records.md) | checkpoints, captures, the promotion queue, trajectories |
| [deciding](references/deciding.md) | a direction has to be settled with the maintainer |
| [reading a source repository](references/leaves.md) | the work touches code in a leaf — including which checkout you may write to |
| [the command surface](references/commands.md) | you need the exact flags for something |

## Things that fire without being called

Three guards run whether or not you invoke anything:

- the **session brief**, when a session opens;
- the **write guard**, on the first write of a unit and again when you touch a
  file no traversal has covered;
- the **turn guard**, when a turn ends while work still awaits you.

`wfctl guards` shows which are on. Turning one off is the maintainer's decision.

## The checkpoint

`wfctl checkpoint` writes where the work stands, and it is what a fresh session
resumes from. Anything left only in a message is lost with the session.

```
wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \
  --last "<last completed action>" --next "<the exact next action>"
```

**Every step wants one written since the flow last moved.** `wfctl work step`
refuses otherwise, and says so — a checkpoint written at `opened` and left there
describes a flow that no longer exists, and a session resuming from it acts on a
`next:` already done.

The `--handoff` body is the substance and can be long: what was found, what it
rests on, what is still open. `--summary` is one line. `--todo` carries small
jobs noticed in passing and survives the next checkpoint.

## Working habits the tool cannot enforce

**Do not stop to protect context.** That fear made runs park themselves halfway
through a window that was still wide open. The checkpoint is what recovery
reads, and it costs one command.

**Parking is the maintainer's, and it needs their words.** `wfctl work park`
refuses without `--attested`. A park is the one command that stops the turn
guard from firing again on this flow, so an agent may not decide on its own that
work waits.

**End a turn only when you are waiting on the maintainer.** If you are not, take
the next action in the same turn. Finishing a unit is not finishing — completing
one releases its claim and leaves units nobody has taken, which is the moment a
long run is most likely to stop on "next I will do X" and then not.

**When the tool itself misbehaves, ask it.** `wfctl doctor` verifies the
installation and everything it depends on — the guards, the skill, each
registered leaf and its graph, retrieval. A guard that never fires and a
retrieval that returns nothing both look like a quiet, healthy session.

**Act on a refusal, do not work around it.** Every refusal names the command
that clears it. Editing a record by hand to get past one is how a receipt ends
up meaning nothing.

**Search by structure before by string.** Text search finds names you already
thought of. The graph finds what you did not know to look for. That graph lives
in the leaf and somebody has to build it — `wfctl repo list` says which of them
have one, and a gate will tell you at the moment it matters. See
[reading a source repository](references/leaves.md).
