# Getting started with wfctl

`wfctl` is a collaboration workflow for a maintainer and coding agents. It
keeps product intent, implementation work, decisions, and project knowledge
connected over the lifetime of a project.

You normally describe work in plain language. The agent operates `wfctl`,
maintains records, checks code and knowledge, and asks you only for decisions
that require human authority.

## Set up a project once

A project has:

- one **knowledge repository** for project-wide knowledge and work records;
- one or more **leaf repositories** containing source code.

Ask the agent to initialize the knowledge repository, then connect every leaf
repository to it. Manual setup commands are documented in
[README.md](README.md#initialize), but routine CLI operation belongs to the
agent.

After setup, each repository has a `PROJECT_WORKFLOW.md` describing its
installed contract.

## Your normal working day

Start by describing the desired outcome:

> Change how account recovery works.

The agent classifies the task and chooses the lightest safe route.

### Significant work

Work is significant when it may change behavior, product meaning, contracts,
data or control flow, persistent state, security, operations, architecture, or
coordination between components.

The agent must:

1. Create a shaping record before extended discussion.
2. Keep requirements, constraints, alternatives, decisions, questions, and
   progress in that record after every material conversation turn.
3. Inspect code through Graphify and align the task with current project
   knowledge.
4. Present a short framing packet: outcome, scope, exclusions, decisions, and
   acceptance criteria.
5. Wait for your explicit approval before implementation.
6. Implement and verify only in the exact bound checkout or worktree.
7. Show completion evidence, deviations, risks, and the resulting knowledge
   change.
8. Record your completion decision and archive the honest outcome.

Approve, correct, defer, or reject the proposed framing. Silence does not count
as approval.

### Lightweight work

Presentation polish, copy edits, formatting, or mechanical corrections that
clearly preserve behavior and contracts may skip the full workflow. The agent
may offer a small handoff when the work produced a reusable finding.

If significance is unclear, the agent explains the possible impact and
recommends a route. You choose whether to use the full workflow.

## Work with an agent inside the knowledge repository

Open an agent in the knowledge repository when the job is about shared project
understanding rather than implementing code in one leaf repository.
The installed `operate-project-knowledge` skill is the default entry point: it
recognizes the common request and routes raw intake, code verification, or
semantic promotion to the stricter specialized skill when needed.

| What you want | What to ask | What the knowledge agent does |
| --- | --- | --- |
| Understand current truth | “Explain the current account-recovery model.” | Reads curated knowledge, follows Areas and current decisions, and gives a human-facing summary. |
| Explore decision history | “Show how the recovery policy changed and why.” | Follows the current decision lineage, predecessors, Area Evolution, and local log. |
| Process new material | “Process the new raw material.” | Inventories new blobs, proposes bounded batches, extracts candidate claims, and verifies them. |
| Resolve old contradictions | “Reconcile the conflicting notes about session ownership.” | Builds an evidence packet from raw candidates, code, history, and maintainer authority. |
| Audit knowledge health | “Find stale, missing, duplicated, or contradictory knowledge.” | Reviews Areas, provenance, verification, links, decision lineages, and code-backed claims. |
| Improve navigation | “Organize the economy Area so a newcomer can understand it.” | Repairs Area indexes and links without inventing new truth. |
| Curate verified results | “Promote the confirmed findings from this completed change.” | Updates the smallest coherent current concepts, validates them, and refreshes retrieval. |
| Review pending input | “Triage the knowledge inbox and active intake cases.” | Classifies handoffs and cases, then recommends promotion, more verification, deferral, or rejection. |

The knowledge agent may inspect several leaf repositories through Graphify to
verify implementation claims. It does not implement source changes from the
knowledge repository. When the requested outcome requires code, move the task
to the appropriate leaf repository and let its agent create the bound shaping
record.

### Current knowledge-only work limitation

The current CLI cannot create a living significant-work record that is bound
only to the knowledge repository. `wfctl work start` requires a leaf checkout.

You may still explore ideas and compare alternatives with the knowledge agent,
but a new authoritative product or architecture decision must continue through
the most relevant leaf workflow before promotion. If no leaf owner exists,
capture the discussion in `raw/` and keep it untrusted or unresolved until a
project-level work mode exists. Do not publish it directly as stable knowledge.

## Find your way through project knowledge

Start with:

```text
knowledge/index.md
→ areas/
→ <area>/index.md
```

An **Area** is the primary container for one durable product or functional
responsibility, such as identity, billing, combat, economy, or deployment.
Most durable knowledge belongs to one primary Area.

Inside an Area, documents are grouped by type:

```text
knowledge/areas/<area>/
├── index.md
├── capabilities/
├── use-cases/
├── concepts/
├── rules/
├── implementation/
├── decisions/
└── log.md
```

These folders are siblings. A decision or implementation document is not
normally buried inside a capability or flow directory. Instead, the Area index,
capability, and use-case documents link the relevant rules, decisions, and
implementation records.

For example:

```text
knowledge/areas/combat/
├── index.md
├── capabilities/revival.md
├── use-cases/revive-character.md
├── concepts/death-state.md
├── rules/revival-eligibility.md
├── implementation/revival-runtime.md
├── decisions/require-revival-item.md
└── log.md
```

To understand revival as a user:

1. Read `areas/combat/index.md`.
2. Open `capabilities/revival.md` for current behavior.
3. Follow a relevant use case or rule for exact conditions.
4. Open `implementation/revival-runtime.md` only for technical realization.
5. Open the current decision, then its predecessors, to understand why the
   behavior changed.

Another example:

```text
knowledge/areas/identity/
├── capabilities/account-recovery.md
├── use-cases/recover-locked-account.md
├── rules/recovery-verification.md
├── implementation/recovery-service.md
└── decisions/require-two-step-recovery.md
```

Read the capability for product behavior, the use case for the user journey,
the rule for constraints, the implementation document for code and repository
mapping, and decisions for rationale and evolution.

### What may live outside an Area

Use a root collection only when no single Area is the honest primary owner:

- `vision/` — project purpose, outcomes, principles, and non-goals;
- `product/flows/` — genuinely cross-Area end-to-end product flows;
- `architecture/` — system-wide boundaries and architecture;
- `decisions/` — genuinely cross-Area decisions;
- `repositories/` — repository ownership and integration boundaries;
- `uncertainties/` — trusted current questions;
- `references/` — primary external material.

If one Area is clearly primary, keep the document there and link it from every
affected Area. Do not move a document to the root merely because it has several
relationships.

### Follow decision history

The Area index links only the current stable decision for each active decision
lineage. The current decision links its deprecated predecessors. The Area's
`Evolution` section explains the meaningful change in plain language, and
`log.md` provides local chronology. The root `knowledge/log.md` contains only
high-level project changes.

You can ask the agent for a short review packet instead of reading the whole
knowledge repository.

When a decision changes, state the new intended truth. The agent compares it
with the current decision, asks for confirmation, creates a successor record,
and preserves the earlier decision as history. Old decisions are not silently
rewritten or deleted.

## Capture ideas and historical material

Use `raw/` as a low-friction inbox for ideas, notes, research, chat exports,
old specifications, and other potentially useful material. Raw content is
untrusted and never becomes current truth automatically.

Tell the agent:

> Process the new raw material.

The agent inventories new and changed Git blobs, groups them by topic, and
proposes bounded review batches. You approve a batch; the agent reads every
included source, verifies candidate claims against code or human authority, and
promotes only confirmed knowledge.

## Common situations

| Situation | What you should do |
| --- | --- |
| The agent misunderstood the goal | Correct it immediately. The agent updates the shaping record before continuing. |
| Product intent is unknown | Decide it or explicitly defer it. The agent must not guess. |
| Code and knowledge disagree | Review the conflict packet and identify whether implementation or recorded intent is stale. |
| The session was compacted or interrupted | Ask to resume. The agent restores the task from `wfctl work status` and the complete living record, not chat memory. |
| You switched worktrees | Tell the agent. It rechecks the exact code-root/spec binding before editing. |
| Work cannot be completed | Accept an honest `partial` or `abandoned` outcome rather than a false completion claim. |
| New raw files appeared | Ask the agent to process raw; do not choose files blindly unless you already know the desired batch. |
| The workflow itself has an update | Ask the agent to preview and apply `wfctl upgrade`, resolving conflicts before replacement. |

## Your responsibilities

You own:

- project purpose and product intent;
- corrections and scope choices;
- decisions that evidence cannot establish;
- framing and completion approval;
- authorization for commits or other external state changes.

The agent owns routine CLI use, code and knowledge investigation, living-record
maintenance, verification, and knowledge promotion.

## Current boundary

One active work record is currently bound to one leaf checkout. For a change
spanning several repositories, tell the agent at the start so repository
boundaries and coordination are recorded explicitly.
