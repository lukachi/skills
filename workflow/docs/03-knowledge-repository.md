# 03 — Use the knowledge repository

## Use this when

Open an agent in the knowledge repository when the job concerns shared project
understanding, product direction, cross-repository behavior, history, or
knowledge quality.

## Problem

One leaf sees only its own implementation. Project-wide questions may span
several repositories, product intent, old decisions, and unimplemented ideas.
Answering them from one checkout produces a partial picture.

## Outcome

The repository gives you a directly readable project-wide map and gives the
agent the same durable context for investigation and work. Product meaning and
engineering realization remain linked, while source implementation stays in
its owning leaves.

## What to ask

You can use ordinary project language:

| You want | Ask |
| --- | --- |
| Discover the project | “I am new here. What is this project for and what can it do today?” |
| Understand current behavior | “Explain how account recovery works today.” |
| Follow history | “How did the recovery policy change, and why?” |
| Inspect implementation | “Show how recovery is implemented across the project.” |
| Process new input | “Process the new raw material.” |
| Build an existing-project baseline | “Reconstruct project knowledge from the connected source repositories.” |
| Shape direction | “Help me shape the future account-security direction.” |
| Resolve a contradiction | “Reconcile the conflicting claims about session ownership.” |
| Audit quality | “Find stale, missing, duplicated, or contradictory knowledge.” |
| Improve navigation | “Organize the economy Area for a newcomer.” |
| Review pending work | “Triage the knowledge inbox and active cases.” |

You do not need to know a skill name, file path, case ID, or CLI command.

## Read-only questions

Discovery, explanation, history, and implementation questions are read-only by
default. The agent:

1. begins with curated knowledge;
2. uses QMD to find candidates and explicit links to navigate relationships;
3. reads the actual Markdown before answering;
4. uses Graphify and pinned source when implementation must be verified;
5. states gaps instead of silently starting reconstruction or curation.

If knowledge is sparse, it answers with what is known first and offers the
appropriate deliberate operation.

## Deliberate operations

Raw processing, baseline reconstruction, durable external research, semantic
curation, and broad direction shaping can be expensive or change durable
records. The agent starts them only when you request them explicitly or accept
its recommendation.

During these operations, the agent shows a human-readable frontier: what has
been covered, what remains, what is blocked, and which decision it needs from
you. Internal ledgers remain available for audit but are not your normal
interface.

## The repository boundary

The knowledge agent may inspect any connected leaf to verify a claim. It must
not implement product code from the knowledge repository.

If the desired outcome requires source changes, open or continue the task in
the owning leaf. The work record stays central while implementation stays in
the exact bound checkout.

Project-only product or architecture discussions may remain in knowledge with
no code root. A later implementation phase binds only the leaves that actually
need changes.

## Result

You receive either:

- a clear answer with its current confidence and delivery state;
- a bounded proposal for deeper investigation;
- a review packet that isolates decisions only you can make; or
- an explicit statement that available evidence is insufficient.

## Next

Continue with
[04 — Read project knowledge](04-reading-project-knowledge.md).
