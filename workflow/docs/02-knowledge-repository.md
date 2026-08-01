# 02 — Work in the knowledge repository

## Use this when

You open an agent in the knowledge repository. That is where you go to
understand the project, build or repair its shared understanding, and process
material that is not code.

Source changes happen elsewhere — see
[03 — Work in a source repository](03-leaf-repository.md).

## What you decide

| The agent handles | You decide |
| --- | --- |
| Commands, case IDs, file paths, indexes, coverage ledgers | What the product is for and how it should behave |
| Finding, reading, and cross-checking documents | Which of two conflicting claims is true when evidence cannot settle it |
| Proposing batches, scopes, and next steps | Whether to start an expensive operation at all |
| Drafting knowledge and its evidence | Whether a draft becomes accepted project truth |

You should never need to know a skill name, a case ID, or a `wfctl` subcommand.
If the agent asks you to run one outside of setup or recovery, that is a defect.

## The five surfaces

Everything in this repository sits in one of five places, and they are not
equally trustworthy:

| Place | What it is |
| --- | --- |
| `knowledge/` | Accepted current truth and durable history. The reading surface. |
| `changes/` | Work in progress and its archived outcomes, plus a pending-capture inbox. |
| `reconstruction/` | Source-first audits. Evidence and candidates, not truth. |
| `intake/` | Frozen reviews of raw material. Evidence and candidates, not truth. |
| `raw/` | Whatever you dumped in. Untrusted, permanently. |

Nothing moves from `raw/` to `knowledge/` by being plausible, recent, or well
written. [`spec/KNOWLEDGE.md`](../spec/KNOWLEDGE.md) defines the rules; this
guide covers what you do about them.

---

## Case: understand the project

Ask in plain language:

> I am new here. What is this project for and what can it do today?

You should get a compact product map — purpose, main directions, what is
delivered, what is uncertain — followed by three to five concrete places to look
next. Pick one:

> Tell me more about billing.

Then narrow again:

> How does invoice retry work today?

Current behavior comes first, then rules and exceptions, then delivery state.
History appears only where it is needed to explain the present. If you want the
reasoning, ask separately:

> Why did it change?

**These questions are read-only.** Asking what the project does must not create,
repair, or promote anything. If knowledge is thin, you should be told that and
offered a next step — not have an expensive operation started for you.

## Case: read it yourself

The curated Markdown is meant to be readable without an agent:

```text
knowledge/index.md
└── knowledge/areas/<area>/
    ├── index.md          the map for this responsibility
    ├── capabilities/     what it provides
    ├── use-cases/        how people use it
    ├── concepts/         domain language
    ├── rules/            behavior and exceptions
    ├── implementation/   how it is actually built
    ├── decisions/        why it is like this
    └── log.md            local chronology
```

An **Area** is one durable responsibility — identity, billing, combat,
deployment. Those subdirectories are siblings: a decision is not buried inside a
capability.

Two roads run through the same Areas. The **product** road (capabilities, use
cases, rules, flows) contains no code, paths, schemas, or endpoints and is meant
for maintainers, product people, and domain experts. The **engineering** road
(implementation, architecture, contracts, operations) links product meaning
rather than inventing it from code. Neither is generated from the other.

Project-level directories — `vision/`, `product/flows/`, `architecture/`,
`decisions/`, `repositories/`, `uncertainties/`, `references/` — hold only what
no single Area honestly owns.

## Case: the project already has code but no baseline

This is the expensive one. Do it once, deliberately, after setup.

```text
you    → "Reconstruct the project baseline from the connected repositories."
agent  → shows which checkout it will use per repository; asks only if ambiguous
agent  → freezes each repository at an exact clean commit
agent  → inventories every tracked file, every Graphify community, every entrypoint
you    → approve the raw scope: all of it, selected themes, or none
agent  → reads pinned source and builds one dossier per repository
agent  → reconciles dossiers into project-wide capabilities and flows
you    → correct intent that code cannot establish; adjudicate contradictions
agent  → drafts curated knowledge and shows a baseline review packet
you    → approve, or accept an honest partial outcome
```

Three things in that sequence are yours alone.

**The raw scope.** The agent shows what is in the frozen `raw/` snapshot and
recommends a boundary. Exclusion means "outside this baseline's purpose", not
"looks unreliable" — old, contradictory, or speculative notes are often the only
surviving record of intent. If no raw exists, this step is recorded
automatically and you are not asked.

**Product intent.** Code proves what is implemented. It never proves what was
intended, and the gap between them is exactly what you are here to state.

**The outcome.** `partial` is a real result. Accepting one is safer than letting
the scope shrink until everything looks complete.

Expect a visible frontier at every pause: which repositories are covered, what
remains, what is blocked, and which decision is waiting on you. If a session
compacts, say "keep going with the baseline" — you do not need the case ID.

For the completeness rules behind this, see
[`spec/RECONSTRUCTION.md`](../spec/RECONSTRUCTION.md).

## Case: new raw material arrived

`raw/` is a low-friction inbox. Drop notes, chat exports, old specs, research —
organize it if convenient, but do not delay capture to design a taxonomy. Commit
what you add: Git blob identity is how the workflow tells new input from
material already reviewed.

Then:

> Process the new raw material.

You should be offered a small thematic batch, not the whole pile:

```text
agent  → "Three unseen files look like world-loop notes. Review those first?"
you    → yes
agent  → freezes those exact files, reads each one completely
agent  → splits statements into separate claims, each with its own state
you    → settle the ones evidence cannot: which is current, what was superseded
agent  → routes each claim and checks the result for omissions
```

A claim can be "confirmed to exist" and still be a rejected proposal. A newer
note does not supersede an older rule without evidence or your say-so. Rejected
ideas stay in the case unless you explicitly adopt the underlying boundary as a
durable non-goal.

Raw processing is continuous. A closed case keeps its frozen snapshot; changed
files come back later as new input. Nothing is ever marked permanently done.

## Case: knowledge is wrong, stale, or contradictory

State the problem directly:

> The recovery page says tokens expire in 24 hours. That changed months ago.

> Reconcile the conflicting claims about who owns session state.

> Find stale, missing, duplicated, or contradictory knowledge.

For a contradiction you should get an adjudication packet — the question, each
candidate claim, what supports and conflicts with it, what is missing, and a
recommendation — not a silent choice.

Repairs that change meaning go through curation: product content and engineering
content are authored separately, both pass an authority review and a
reader-communication review, and both receipts bind the exact document content.
Editing the text afterwards invalidates them.

An audit finds problems; it does not fix them unless you asked for repair.

## Case: triage the queue

> Show me what is pending.

Two queues exist. `changes/inbox/` holds captures — useful material with no
owner yet. Each one is read completely, then either routed to a destination that
must already exist, or discarded with a reason. Active cases (intake,
reconstruction) are separate and are resumed, not triaged.

A capture is not project truth and not a task tracker.

## Picking up after a break

Say it plainly:

> Continue where we left off.

Exactly one active record resumes automatically. With several, you are asked
which outcome you mean, described in your language — not by ID, date, or
directory name. You should never have to remember an identifier.

If the underlying record changed after the last checkpoint, that checkpoint is
stale and the agent rebuilds its picture from the full record instead of
trusting the old next step.

## The repository boundary

The knowledge agent may read any connected source repository to check a claim.
It must not write code from here.

If what you want requires source changes, continue in the owning repository. The
work record stays central either way; only the implementation moves.

## What is actually guaranteed

Be precise about this, because the difference matters when you are deciding
whether to trust an answer.

| Mechanically enforced | Not enforced — your judgment |
| --- | --- |
| Every frozen file was delivered to the agent, in full, with line receipts | That the agent understood what it read |
| Every tracked file, community, and entrypoint has an explicit disposition | That the disposition is correct |
| Curated claims cannot cite `raw/` or `intake/` | That a cited source actually supports the claim |
| Quality receipts bind an exact document version | That the review behind them was thorough |
| Omission probes cover every non-rejected claim | That nothing important was missed |

Search rank, index freshness, and a confident tone are never evidence. When an
answer matters, ask what it is based on.

## Next

[03 — Work in a source repository](03-leaf-repository.md) covers implementation.
[04 — Your part](04-your-part.md) covers approvals, false completion, and
recovery.
