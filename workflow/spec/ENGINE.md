# Workflow engine contract

## Status

This document is normative for workflow ownership, installation, instruction
delivery, and safety. More specific contracts own their domains:

- [WORK.md](WORK.md) — the changes flow, its steps, gates and records;
- [KNOWLEDGE.md](KNOWLEDGE.md) — trust, curation and retrieval;
- [RECONSTRUCTION.md](RECONSTRUCTION.md) — the reconstruction case;
- [CLI.md](CLI.md) — the command surface;
- [VERIFICATION.md](VERIFICATION.md) — how this package is evaluated.

## Destination

Ship a deterministic `wfctl` that keeps maintainers and coding agents working
from one shared project model, from intent through verified delivery, across one
project knowledge repository and any number of leaf source repositories.

## Instructions do not depend on the agent choosing to load them

This is the engine's central commitment and everything else follows from it.

A skill is an instruction wrapped in a branch the model evaluates: *if I
classify this situation as X, this text exists.* That branch made every gate in
the previous implementation deterministic about **refusing** and probabilistic
about **explaining how to satisfy the refusal**.

Measurement in this repository settled it. Across four sessions and 3481
transcript entries, skills were invoked three times and no session read the
rules directory as instructed; the maintainer's own stress testing put the
proportion of skill, rule and guide content that was skimmed rather than read at
seventy per cent or more. Moving the text somewhere better-loaded does not fix
this — placement is not compliance, and the instructions already sitting in the
loaded agent block were ignored just as often.

So there are no skills. The same content is cut by the **state it applies to**
rather than by the role performing it, and the tool delivers the slice when that
state is true. Nothing is compacted to achieve this; the volume was never the
problem. What changes is when the text arrives, and that it arrives again the
next time the same state is true.

Five surfaces deliver, and none of them is a model decision:

| Fires when | Mechanism | Decided by |
| --- | --- | --- |
| A session opens | SessionStart hook → brief | host |
| A command runs | its own output | tool |
| State is violated | the refusal text | tool |
| Code is about to change | PreToolUse on Edit/Write | host |
| A turn ends with work outstanding | Stop guard | host |

Every refusal names the command that clears it. A refusal that does not costs
the agent a turn and teaches it nothing — the previous implementation's worst
messages named the one command that destroyed a record's accounting and not the
one that cost nothing.

## Two cases, entered explicitly

Only two things run: **work** and **reconstruction**. Each owns a directory, a
step sequence and an honest closure.

There is no classifier. The maintainer starts one explicitly, and the two are
independent state machines. Routing was the largest single source of the agent
entering the wrong machine, and the decision was never one evidence could make.

Significant versus lightweight survives inside `work start` as a recorded answer
rather than an inference: the CLI names what the distinction means, the agent
puts it to the maintainer in its own words, and the command refuses until it has
an answer.

## The flow is a fence

One `flow_id` scopes the workload the maintainer and agent settled on — several
change bundles, one bundle, or one reconstruction. While it is open, work
outside it is out of scope, which is what stops an agent opening its fourth
record of the afternoon because it noticed something. A finding met during work
goes to the capture inbox.

Checkpoint, handoff, bindings, receipts and retrieval counters bind to the flow,
so the workload survives compaction, a cleared context and a new session.
Recovery is: read the id, read its record, resume — never conversation memory.
On completion the checkpoint flushes and the id clears.

## Checkpoint is one act with two renderings

`wfctl checkpoint` writes the flow's working state. The **brief** is its index
rendering, emitted by the session-start hook; the **handoff** is its full body.

The brief prints the bound flow's handoff in full and every other flow as one
line. That asymmetry is deliberate: a brief that grew with the number of open
records was truncated by the host, and a truncated brief reads exactly like a
complete one while carrying a fraction of the state.

**Blockers are derived, never stored.** Where a flow stands in its step sequence
*is* the blocker. A stored one is a sentence that was true once and stays in the
record after it stops being true.

## Retrieval is counted, and answers are what gate

An agent has no feeling-of-knowing. A person searching their memory senses that
an answer exists and has not surfaced yet; an agent experiences only the
plausible answer it already has. Nothing seems absent, which is why the first
search that returns something ends the search, and why text search wins over
structural traversal without any decision being made.

The engine therefore keeps a checklist of what must be asked before a decision,
and counts the routes used. Which items a step requires is the tool's decision,
not the agent's. An item counts as answered only with an answer, the route that
produced it, and its source — an answer with no source is a guess with a
sentence around it.

Counters are evidence, never the gate. A bare count is satisfied by one empty
query; what they catch is the complete absence of a tool, which is the real
failure. A minimum route floor sits beside them for the same reason.

**Between gates nothing is checked.** That is the room for research, judgement
and being wrong. Gates exist only where a guess becomes something the project
will later cite.

## Verification is delegated and adversarial

The agent writes the criteria, the tests and the code, then reports that its
tests pass its criteria. Every term has the same author.

A review is therefore produced by a different agent, which receives the diff,
the framing at its approved digest, and the repository — never the
implementation's reasoning, because an agent shown its own justification accepts
it. Every attack is an executable test, written and run, returned with its
source and output. Tests and review are ephemeral.

wfctl does not spawn the reviewer. Spawning would tie this tool to one host's
agent API, and what matters is not who started the review but that its claims
are backed by tests somebody can run again. The tool validates the returned
artifact instead.

## Nothing is sized for a session

Units are sized by scope and coherence. "Sized for one agent session" taught
agents to stop halfway through a context that was still wide open, and they did.
Continuity comes from frequent checkpoints, not from stopping early, and the
handoff reason "context is spent" is removed because it encoded the same fear as
a legitimate exit.

A turn ends when the maintainer is needed, and otherwise does not.

## The CLI helps; it does not schedule

Issue order is not managed. Blocking edges, frontier computation and cycle
validation are removed: a map that came out of grilling can be worked
efficiently in an order no dependency graph would predict, and enforcing one
restrains the agent for no gain. Units carry a status and the agent's own notes,
and the tool retrieves them well.

Not stopping between units belongs to the Stop guard, never to issue selection.

## The agent never types a predictable path

Where a path follows from state, the tool creates it and prints it. Promotion
drafts belong inside their record and were repeatedly written elsewhere — not
from disagreement, but because a path assembled from memory is assembled wrong
and nothing refused it.

## Installation

One profile. The agent is bootstrapped in the knowledge repository and edits
leaf code from there as an orchestrator, so a leaf never needed an installation
of its own — and measurement said it never used one. Asking for a leaf install
is refused with what replaced it.

What is installed is the guidance bundle, the runtime guards, the hook settings
and one managed agent block. `wfctl` must:

- preview mutations and request confirmation in interactive use;
- preserve unowned files and text, including everything outside the managed
  block and every settings entry it did not write;
- update an owned file only when its current hash matches installed state, and
  report rather than replace one the maintainer edited;
- keep generated caches and machine-local bindings out of Git;
- exclude only its own installed files from the source graph. Ownership is an
  identity wfctl records, never a path pattern — excluding `.claude` and
  `.agents` wholesale once hid a project's own engineering documents from every
  traversal this workflow prescribes;
- watch every background shell command for silence.

## Silence in background work

A background shell command has no deadline and no stall detection. One that
stops making progress is never heard from again, and the loss is measured in
hours because nothing is wrong enough to report.

A `PreToolUse` watch therefore reports after a threshold of no output. Duration
is never the test: a talkative hour-long build is healthy and a silent loop is
not. It reports rather than decides, the report carries evidence rather than a
verdict, and it can be re-armed onto a running process. On a healthy run it is
invisible.

## Continuity at the turn boundary

An agent executing accepted work stops for reasons that are not reasons: it
narrates the next action and yields, closes on "the work continues by itself"
while nothing continues, or mistakes a finished unit for the finish line.

The engine carries one norm against stopping, scoped to accepted work and
explicitly excluded from shaping, where a high question count is the point. It
is a norm and not a gate: whether a stop is warranted is a judgement about
reversibility and blast radius, and a check that tried to make it would either
block legitimate escalation or wave through a one-way door.

What can be mechanised is the asymmetry that made stopping free. The Stop guard
blocks a turn that ends while state reports work awaiting the agent, quotes what
the turn ended with, and hands the judgement back. It never decides whether the
work is finished — a guard that keeps answering "not finished" forces turns the
model cannot satisfy and runs a session to its token cap. Re-entry continues
while the repository moves and releases on the first turn that does not, under a
hard ceiling.

One failure stays uncovered and should not be claimed otherwise: when a turn
produces no text after a tool result, the host fires no Stop event at all.

## Non-goals

The engine does not:

- infer product intent from implementation;
- classify which case a request belongs to;
- schedule work, order units, or compute a frontier;
- prove implementation correctness without semantic review;
- replace QMD or Graphify with its own retrieval or source indexing;
- spawn agents;
- treat successful structural validation as proof of truth;
- minimise token consumption. Lower use may be an outcome, never at the expense
  of coverage or trustworthy project knowledge.
