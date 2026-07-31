# The idea behind wfctl

## The problem

A software project is more than the code that happens to exist today.

It also contains intended outcomes, domain language, rejected alternatives,
partially delivered capabilities, architectural constraints, and the reasons
behind earlier decisions. Those facts are normally scattered across chats,
issues, old specifications, people's memory, and several repositories.

A maintainer faces the same fragmentation as an agent. Without a human road
through the project, they must repeatedly reconstruct current behavior,
delivery, and rationale from code, chats, and whoever happens to remember.

An agent joining one task sees only a narrow slice. Code can establish observed
implementation at a revision, but not product intent or complete runtime
behavior. Notes may be obsolete, speculative, or wrong. Conversation memory may
disappear after compaction or a new session.

The result is predictable: maintainers lose a clear view of their own product,
agents guess, discussions repeat, direction changes silently, and desired work
is reported as delivered work.

## The purpose

`wfctl` is a long-term project partnership system for maintainers and coding
agents. Its purpose is to let both recover, understand, discuss, and govern the
same project from its first idea through years of implementation and change.

It must work when the workflow starts with the project and when it joins an
existing codebase later. Existing notes are useful but optional. Source code is
essential evidence but never the complete product story.

## How the workflow reaches that purpose

### 1. Keep one project accessible through two first-class roads

The workflow maintains two linked ways to understand the same project:

- the **maintainer/product road** explains purpose, audience, capabilities,
  behavior, rules, delivery, and meaningful evolution in human language;
- the **engineering road** explains implementation, architecture, ownership,
  contracts, failures, operations, and verification.

Both humans and agents can follow both roads. The product road is not a
simplified rendering of technical documentation, and the engineering road
cannot redefine product meaning to match code. Areas, capabilities, changes,
and decision lineages connect them.

Decision history is shared connective context, not a third flat road. It lets a
reader move from current product meaning or implementation to why it changed.

### 2. Separate inputs from accepted knowledge

The workflow keeps different kinds of information in different trust lanes:

- source code shows observed implementation at an exact revision;
- raw material provides untrusted ideas, history, and clues;
- external sources establish facts outside the project;
- maintainers establish product intent and adjudicate ambiguity;
- curated knowledge contains only reviewed current truth and durable history.

Nothing becomes accepted knowledge merely because it is newer, implemented,
well written, or easy to retrieve.

### 3. Organize by durable responsibility

Knowledge is organized around Areas: durable product or functional
responsibilities such as identity, billing, combat, or deployment. Capabilities,
use cases, rules, implementation, and decisions remain connected to their
owning Area instead of becoming one flat chronological dump.

Cross-Area material stays at the project level only when no single Area is the
honest owner.

### 4. Keep one living bundle for consequential work

Significant work begins with one canonical bundle. Its parent change keeps the
outcome, scope, language, constraints, decisions, and stable acceptance IDs
current. An optional Wayfinder map resolves a route too foggy for one session;
bounded issues carry execution and progress; complete file receipts support
verification. The directory moves intact into history when it closes.

This prevents chat from becoming the only memory and prevents separate product,
planning, issue, and progress systems from drifting apart.

### 5. Require evidence without claiming perfect understanding

The workflow distinguishes complete accounting from complete understanding.

Git freezes the exact material that was in scope. Graphify maps code structure.
QMD finds relevant knowledge and input. Deterministic validators check declared
relationships and lifecycle rules. The agent still has to read, interpret, and
compare the real sources. The maintainer still decides what evidence cannot.

The system can prove that every selected file, community, claim, and review gate
was accounted for. It cannot mechanically prove that an agent understood every
meaning. That limitation stays visible.

Verification must also distinguish production paths from fixtures, mocks,
demonstrations, and fakes. Non-production behavior cannot prove that a
capability is delivered unless that non-production artifact is itself the
explicit scope.

### 6. Make the agent operate the machinery

This is not only a folder convention. Installed rules and skills tell the agent
when to use the workflow, which repository it is operating in, where the
canonical record lives, how to bind exact worktrees, how to recover after
compaction, and which gates must pass.

The maintainer normally speaks in project language. CLI details, IDs, indexes,
and ledgers remain agent and automation surfaces.

### 7. Keep lightweight work lightweight

Not every edit deserves a full project process. Clearly local, mechanical work
that preserves behavior and contracts may bypass the significant-work gate.
Ambiguous impact is explained to the maintainer instead of silently choosing
the heaviest or lightest route.

## Why these tools have different jobs

- **Git** gives immutable source identity, history, and exact revision
  boundaries.
- **Graphify** provides structural navigation through source repositories.
- **QMD** provides lexical and semantic retrieval over Markdown collections.
- **Deterministic workflow graphs and ledgers** validate only explicit links,
  routing, and lifecycle state.
- **Agents** perform semantic investigation, reconciliation, and writing.
- **Maintainers** own intent, corrections, approval, and unresolved truth.

No one tool is treated as universal authority.

## Goals

`wfctl` aims to:

- let a maintainer or product stakeholder recover the current project,
  delivery, and rationale without reverse-engineering source code;
- help an agent understand the whole project before changing one part;
- keep the product and engineering roads aligned without collapsing them;
- keep decisions and project language durable across sessions and people;
- expose current behavior, intended behavior, delivery, and drift honestly;
- reconstruct a trustworthy baseline for an existing multi-repository project;
- turn ongoing raw dumps into reviewed candidates without losing information;
- make incomplete, partial, blocked, and abandoned outcomes explicit;
- distribute one canonical workflow through both the `AGENTS.md`/`.agents` and
  `CLAUDE.md`/`.claude` conventions.

## Non-goals

`wfctl` does not aim to:

- prescribe a universal specification-driven development methodology. A living
  specification is required for consequential work, not made the center of
  every task;
- build its own search, source-code indexing, or knowledge-graph engine. The
  workflow coordinates specialized tools and defines how their outputs are
  used;
- minimize token consumption as a primary objective. Lower token use may be a
  useful outcome, but never at the expense of coverage, shared understanding,
  or trustworthy project knowledge.

## What success looks like

A maintainer can read the project directly and recover what it is, how it
behaves, what is delivered, and why it changed. An agent can recover that same
meaning, trace it to exact engineering realization, and continue work without
inventing context. Both can discuss one shared model, correct intent before
implementation, and see whether the accepted outcome was actually delivered.

The project remains understandable as it grows instead of accumulating another
unsearchable pile of code, chats, and specifications.
