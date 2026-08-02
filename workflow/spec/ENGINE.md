# Workflow engine contract

## Status

This document is normative for workflow ownership, installation, work routing,
and safety. More specific contracts own their domains:

- [KNOWLEDGE.md](KNOWLEDGE.md) — trust, curation, intake, and retrieval;
- [WORK.md](WORK.md) — change bundles, Wayfinder, issues, and review accounting;
- [RECONSTRUCTION.md](RECONSTRUCTION.md) — source-first completeness;
- [CLI.md](CLI.md) — command behavior and operator surface;
- [VERIFICATION.md](VERIFICATION.md) — package and agent-behavior evaluation.

## Destination

Ship a deterministic `wfctl` package that keeps maintainers and coding agents
working from one shared project model, from intent through verified delivery,
across:

- one project knowledge repository;
- any number of leaf source repositories;
- normal Git checkouts and worktrees;
- project-only, single-repository, and multi-repository work.

## Canonical ownership

- The `workflow/` source directory owns the CLI, rules, skills, templates, and
  contracts.
- Package releases distribute immutable canonical assets. Consumers may pin an
  exact `wfctl` version.
- Installed consumer files are managed through `.workflow/state.json`.
- Existing `AGENTS.md`, `CLAUDE.md`, and maintainer content outside marked
  blocks is preserved.
- Consumer repositories never become an independent source for workflow
  templates.

## Repository profiles

The knowledge profile owns shared project understanding and central work
records. It installs knowledge operation, exploration, reconstruction, raw
intake, project research, direction shaping, curation, work management, and
verification skills. It also installs the work-item execution skill, because
project-only and Wayfinder issues are legitimately claimed from knowledge; that
skill still never authorizes source edits from this repository.

The leaf profile owns source implementation. It installs Graphify-first
analysis, knowledge alignment, exploration, direction shaping, curation,
project work, and verification skills, but not knowledge-only operations.

Both profiles receive:

- a managed `PROJECT_WORKFLOW.md`;
- workflow routing rules;
- the setup skill;
- the workflow Graphify routing skill;
- QMD's version-matched official skill;
- agent-native independent skill copies.

`wfctl` must not create cross-agent skill symlinks.

## Maintainer-agent partnership

The workflow serves both participants directly:

- the maintainer/product road lets people recover purpose, behavior, delivery,
  decisions, and evolution without reconstructing them from source code;
- the engineering road lets people and agents trace that meaning to
  architecture, ownership, exact source realization, operations, and evidence.

Both are first-class views of the same Areas, capabilities, changes, and
decision lineages. Neither may be generated from, reduced to, or silently
redefined by the other. Decision history connects both roads instead of
becoming a third flat view.

The normal maintainer CLI surface is:

- `wfctl init knowledge`;
- `wfctl init leaf`;
- `wfctl upgrade` when the maintainer chooses to run it directly;
- `wfctl work approve` for framing and completion decisions, which the agent
  may prepare and explain but cannot satisfy on its own;
- `wfctl brief` when a maintainer wants the repository state without an agent.

Every session begins with `wfctl brief`. The engine must be able to state what
exists, what is in progress, and what waits on the maintainer without the agent
inferring it from scattered records, and must state it as observed signals and
derived capabilities rather than as recognized scenarios. Orientation is
read-only: the brief never starts a deliberate operation, and a reported
capability is a permission, not an instruction.

After initialization, installed agents own routine `wfctl`, QMD, Graphify,
validation, registry, case, and work-record operations. Users express desired
outcomes in project language and are asked only for:

- product authority;
- corrections and scope choices;
- approvals;
- genuinely missing paths or checkout choices;
- permission for external state changes.

CLI details remain available for automation, recovery, and workflow
development. Curated Markdown remains a direct human interface even when no
agent is present.

## Work routing

### Significant work

Work is significant when it may change behavior, product meaning, contracts,
data or control flow, persistent state, security, operations, architecture, or
coordination.

It must pass through:

1. one early central change bundle with stable parent acceptance and progress;
2. exact project-only or source-checkout bindings;
3. Graphify-first source analysis when code is involved;
4. alignment with curated project knowledge;
5. explicit maintainer framing approval;
6. implementation in bound leaves only;
7. evidence-based semantic and structural verification;
8. knowledge promotion or an explicit no-update reason;
9. explicit completion review and honest archival.

Fixtures, mocks, demonstrations, and fakes must be identified during
verification and cannot establish production delivery unless they are the
explicit accepted scope.

The agent updates the owning semantic record after every material discussion
or investigation turn. Consequential new understanding passes an
information-loss test and enters the owner's broad discovery ledger with its
basis, implication, scope, and disposition. The agent then refreshes the
structured checkpoint last. After compaction, interruption, or a clean-session
start, it discovers an unambiguous binding, reads the checkpoint and complete
owning records, verifies workflow status and exact claims, and resumes without
conversation memory.

This contract applies to central change bundles, raw-intake cases, and
reconstruction cases. Reconstruction uses repository dossiers for local
discoveries and the parent case for cross-repository meaning. Its checkpoint
basis includes the parent case, every dossier, and every coverage ledger;
coverage remains accounting, not semantic truth. Curated `knowledge/` concepts
never receive an operational discovery ledger.

Reconstruction raw scope is separately human-owned. The agent may inventory,
map, and recommend, but only an explicit maintainer decision may authorize all
or selected raw input or exclude it. Child intake records bind that approved
scope deterministically; a checkpoint cannot supply or replace approval.

### Lightweight work

Clearly local mechanical work that preserves behavior and contracts may bypass
the full gate. If impact is ambiguous, the agent explains the risk and asks the
maintainer to choose. Useful unowned findings may enter `changes/inbox/` as a
pending, non-authoritative capture. Active work instead refreshes its owning
structured checkpoint.

### Broad uncertain work

A consequential initiative with unresolved dependent choices enters Wayfinder
only after explicit user intent or confirmation. It uses a map and question
issues in the same canonical bundle as later execution and captures:

- destination and affected Areas;
- domain language;
- decision frontier;
- uncertainty and tradeoffs;
- non-goals;
- the next bounded change.

The agent asks one evidence-backed question at a time, resolves at most one
non-research issue per session, and records each material answer before
continuing. A clear map is synthesized into the ordinary specification before
delivery issues or code work. It must not create a parallel strategy source.

### External research

External research uses current primary sources where possible. Its synthesis is
a candidate in the owning active record or inbox until normal project authority
and curation gates accept it. External sources cannot establish project intent,
architecture choice, or implementation state.

## Worktree and repository safety

- A work record binds exact repository identity, revision, branch, checkout,
  and worktree identity.
- Local absolute paths live only in ignored runtime bindings.
- Durable records retain portable repository and revision metadata.
- A checkout mismatch stops work until an explicit rebind is reviewed.
- A completed outcome requires a clean bound checkout whose commit contains the
  verified implementation.
- Multi-repository work keeps one central record and one final receipt per
  repository.
- `wfctl` never commits product or knowledge changes automatically.

## Installation safety

`wfctl` must:

- preview mutations and request confirmation in interactive use;
- complete dependency preflight before workflow or skill writes;
- preserve unowned files and text;
- require a per-file decision and backup before replacing a conflicting owned
  file;
- stop on structural, symlink, marker, or path-type conflicts;
- update an owned file only when its current hash matches installed state;
- support non-interactive and JSON output for agents and CI;
- default skills to project scope while allowing explicit user scope or none;
- remove only obsolete project skills still attributable to this package;
- keep generated caches and machine-local bindings out of Git;
- exclude only its own installed files from the source graph;
- watch every background shell command for silence.

The last rule is not cosmetic. `.agents/` and `.claude/` are the agent's
configuration directories, owned by the project, and a project may keep its own
skills, rules, and instructions there — in one real case, engineering documents
describing service layout and contracts, written long before the workflow
arrived. Excluding those directories wholesale hid that material from every
graph-first traversal the workflow itself prescribes. wfctl therefore lists the
exact skill directories it installed. Ownership is an identity wfctl records,
never a path pattern, in the graph scope and in reconstruction coverage alike.

Knowledge initialization may offer interactive `git init`; automation must use
an explicit opt-in. Leaf initialization requires an existing Git repository.

## Silence in background work

A background shell command has no deadline and no stall detection. One that
stops making progress is simply never heard from again, and the loss is measured
in hours because nothing is wrong enough to report.

Installation therefore places a `PreToolUse` watch on every shell command.
Foreground commands are not exempt: the host promotes one to the background once
it runs long enough, so the watch has to be in place before that, not after.
Duration is never the test: a talkative hour-long build is healthy and a silent
loop is not. After a threshold of no output the watch reports and exits, which
is what reaches a working agent — a finished background task is the only channel
that does.

Three properties are load-bearing:

- **It reports, it does not decide.** The child keeps running untouched. Doing
  nothing is therefore the safe default, which matters because an agent asked
  "is this stuck?" tends to agree that it is.
- **The report carries the evidence, not a verdict.** Consumed CPU time against
  elapsed time distinguishes waiting from working; the report states it, warns
  against restarting on the report alone, and forbids checking liveness by
  matching a process name — a name pattern matches the checking shell too.
- **The watch can be re-armed** onto a running process. A one-shot report would
  leave anything judged healthy unwatched for the rest of its life.

On a healthy run the watch must be invisible. It preserves the exit code, keeps
stdout and stderr separate, delivers the final line, passes stdin through, and
leaves no file behind. A wrapper that quietly alters a successful command is
worse than no wrapper, because every later result is measured through it.

Silence is the only trigger. A CPU stall was tried as a second one and dropped:
I/O-bound work consumes almost no CPU while progressing perfectly well, so it
fired on healthy commands. Consumed CPU remains in the report, where it
distinguishes a waiting process from a working one. A signal that costs the
agent a turn has to earn it.

The watch never inspects what the command does. A command that keeps printing
while doing the wrong thing is a different failure, answered by verifying the
data a job writes rather than by observing the process.

## Continuity in accepted work

An agent executing accepted work stops for reasons that are not reasons: it
narrates the next action and yields, mistakes a finished plan item for the
finish line, or raises a question the specification already answered. The rule
corpus explains at length how to ask the maintainer and nowhere states when not
to, so an unowned pause is the cheapest move available and wins by default.

The engine therefore carries one norm against stopping, scoped to accepted work
and explicitly excluded from shaping, where a high question count is the point.
Its three lines are: quote the accepted material before asking, treat completion
as the issue's terminal status rather than a written summary, and record a
contradicting discovery instead of halting for it. Adjudication is a recorded
claim awaiting authority; questions accumulate to the frontier or review
boundary instead of interrupting a wave.

This is a norm, not a gate. Whether a stop is warranted is a judgment about
reversibility and blast radius, and no deterministic check can make it — a tool
that tried would either block legitimate escalation or wave through a one-way
door. What the engine can do is remove the asymmetry that made stopping free.

Where a norm lives decides whether it is read. The managed agent block is
loaded by the host every session; the rules directory is loaded only because
that block tells the agent to open it, and measurement says it does not. Across
four sessions and 3481 transcript entries in one knowledge repository, skills
were invoked three times and no session ever read the rules directory as
instructed. Standing behavior therefore belongs in the managed block, with the
rules holding the full text and the reasoning. The session brief is not an
alternative: it reports observed state, and a norm placed there would make a
state report normative to buy delivery it has no business buying.

Placement is not compliance. The Graphify instructions sit in the same loaded
block and are ignored just as often. A norm changes the odds; only a mechanism
that re-enters the turn changes the outcome.

Installation therefore places a `Stop` watch beside the shell one. When a turn
ends while the state reports work awaiting the agent, the watch blocks that
ending once: it quotes the text the turn ended with, lists the outstanding
work, and hands the judgment back. It never decides whether the work is
finished. That distinction is the whole safety argument — a guard that keeps
answering "not finished" forces turns the model cannot satisfy and runs a
session to its token cap.

The mechanism is not persuasion. Inside the forced turn the announced action is
the cheapest available move, so the failure corrects itself without the agent
having to obey anything.

Anything awaiting the agent arms it, whatever its level. Filtering the quieter
signals out was tried and reversed: a re-entered turn is a small, bounded cost
and the failure it catches is not, so trading recall for quiet is the wrong
direction. A signal awaiting the maintainer never arms it — that is a question
for them, and forcing a turn on it would only make the agent answer itself.

Re-entry continues while the repository moves. A single re-entry was the first
bound and it was too weak: an agent re-entered once, did real work, stopped
again, and that second stop passed unconditionally, so the run parked itself for
the night with the frontier still full. Whether the last turn moved anything is
observable without judging it — the collected signals either changed or they did
not — so the guard keeps returning while each turn changes them and releases on
the first turn that does not.

Three bounds keep that from becoming its own failure. A turn spent waiting on a
background task passes, because the host re-invokes the agent when the task
finishes. A repeated answer releases even while the state moves, which is what a
genuinely stuck agent looks like when something else is writing underneath it.
A hard ceiling ends the turn regardless: state can move for reasons unrelated to
the turn, and a live run against a stub whose counter advanced on every read had
a blocked agent restating the same refusal thirteen times before the ceiling
stopped it. Progress comparison needs durable memory, so a repository that
cannot store it degrades to the weaker single re-entry rather than risking a
turn that cannot end. An unreadable state, a missing CLI, or malformed input
ends the turn rather than trapping the session.

One failure stays uncovered and should not be claimed otherwise: when a turn
produces no text after a tool result, the host fires no `Stop` event at all.

## Non-goals

The engine does not:

- infer product intent from implementation;
- perform automatic semantic reconciliation;
- prove implementation correctness without semantic review;
- replace QMD or Graphify with custom retrieval or source-indexing systems;
- auto-discover sibling repositories;
- persist machine-local leaf paths in tracked state;
- treat successful structural validation as proof of truth;
- force significant-work ceremony onto clearly lightweight changes.
