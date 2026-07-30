# The idea behind wfctl

## The problem

A software project is more than the code that happens to exist today.

It also contains intended outcomes, domain language, rejected alternatives,
partially delivered capabilities, architectural constraints, and the reasons
behind earlier decisions. Those facts are normally scattered across chats,
issues, old specifications, people's memory, and several repositories.

An agent joining one task sees only a narrow slice. It can inspect code, but
code proves implementation—not product intent. It can read notes, but notes may
be obsolete, speculative, or wrong. It can remember the conversation, but that
memory may disappear after compaction or a new session.

The result is predictable: agents guess, repeat old discussions, silently
change direction, or report desired work as completed work.

## The purpose

`wfctl` is a long-term collaboration system for maintainers and coding agents.
Its purpose is to keep a project understandable and governable from its first
idea through years of implementation and change.

It must work when the workflow starts with the project and when it joins an
existing codebase later. Existing notes are useful but optional. Source code is
essential evidence but never the complete product story.

## How the workflow reaches that purpose

### 1. Separate inputs from accepted knowledge

The workflow keeps different kinds of information in different trust lanes:

- source code shows observed implementation at an exact revision;
- raw material provides untrusted ideas, history, and clues;
- external sources establish facts outside the project;
- maintainers establish product intent and adjudicate ambiguity;
- curated knowledge contains only reviewed current truth and durable history.

Nothing becomes accepted knowledge merely because it is newer, implemented,
well written, or easy to retrieve.

### 2. Preserve product meaning and engineering reality separately

Project knowledge has linked views:

- the **product view** explains what the project provides, for whom, under
  which rules, and with what delivery state;
- the **engineering view** explains ownership, architecture, source
  realization, contracts, failures, operations, and verification;
- the **decision view** explains why the current state exists and how it
  evolved.

This lets a stakeholder understand the project without reading code while
letting an engineer trace the same concept to exact implementation evidence.

### 3. Organize by durable responsibility

Knowledge is organized around Areas: durable product or functional
responsibilities such as identity, billing, combat, or deployment. Capabilities,
use cases, rules, implementation, and decisions remain connected to their
owning Area instead of becoming one flat chronological dump.

Cross-Area material stays at the project level only when no single Area is the
honest owner.

### 4. Keep one living record for consequential work

Significant work begins with one canonical record. During discussion, the agent
keeps its outcome, scope, language, constraints, questions, decisions, and
progress current. The same record matures into the implementation spec,
verification report, and archived outcome.

This prevents chat from becoming the only memory and prevents separate product,
planning, and progress documents from drifting apart.

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

- help an agent understand the whole project before changing one part;
- keep decisions and project language durable across sessions and people;
- expose current behavior, intended behavior, delivery, and drift honestly;
- reconstruct a trustworthy baseline for an existing multi-repository project;
- turn ongoing raw dumps into reviewed candidates without losing information;
- make incomplete, partial, blocked, and abandoned outcomes explicit;
- support Codex and Claude Code from the same canonical templates.

## Non-goals

`wfctl` does not aim to:

- infer product intent automatically from source code;
- treat raw notes, search results, or generated graphs as truth;
- prove semantic correctness without agent and maintainer review;
- replace Git, Graphify, QMD, or the coding agent with custom substitutes;
- reconcile every contradiction automatically;
- force a heavyweight specification process onto trivial work;
- make one knowledge document serve every audience;
- hide uncertainty behind a successful command or green validator.

## What success looks like

A new person can ask what the project is and receive a clear current map. An
agent can trace that map to exact code and decision history. A maintainer can
correct intent before implementation, resume work after a lost session, and
see what changed, why, and whether it was actually delivered.

The project remains understandable as it grows instead of accumulating another
unsearchable pile of code, chats, and specifications.
