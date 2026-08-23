# How this tool works

You do not need to know the sequence. Each command prints what the current state
demands and the command that records it; the next command refuses until that
exists. Follow what you are handed.

## The shape

Two cases run, and the maintainer starts one explicitly: **work** (a change) and
**reconstruction** (recording what the project already is). There is no
classifier and nothing infers which you are in.

A **flow** fences the workload you agreed on. While one is open, work outside it
is out of scope — a finding met along the way is captured, never opened as a
second record.

## The three things worth understanding

**Checkpoint** is one act with two renderings. `wfctl checkpoint` writes where
the work stands; the brief is its index, the handoff is its body. It is what a
fresh session resumes from, so anything left only in a message is lost with the
session. Checkpoint often — not because a session is about to end, but because
that is what recovery reads.

**Recall** is the checklist a step requires before it will advance. An item
counts as answered only with an answer, the route that found it, and its source.
The counters printed at every gate show the shape of the work: many text
searches and no structural traversal means the code was searched by string and
never by structure.

**A refusal names its remedy.** Read the remedy line and run it. Do not edit a
record by hand to get past a refusal — that is how a receipt ends up meaning
nothing.

## Where the detail lives

Each state prints its own guidance when you reach it. `wfctl guide <topic>`
brings one back on demand:

| Topic | What it covers |
| --- | --- |
| `wfctl` | this page |
| `recall` | the checklist, and why an agent needs one |
| `structure` | searching by graph before by string |
| `interview` | settling a direction by asking, in numbered rounds |
| `domain-language` | sharpening terms while you design |
| `prototype` | throwaway code that answers a question |
| `research` | external facts, and what they can and cannot authorize |
| `adversarial` | how a review tries to break the work |
| `curate-product` | writing the stakeholder page |
| `curate-engineering` | writing the technical page |
| `quality` | the two-axis gate before a page becomes stable |
| `discoveries` | what to preserve, and where |
| `wayfind` | charting a route that is not visible yet |
| `routing` | which road a claim takes into curated knowledge |
| `scope` | settling what a reconstruction reads |
| `crawl` | reading everything in scope without asking questions |
| `assemble` | turning what was read into a subject's line |
| `adjudicate` | the one round of what evidence could not settle |
| `probe` | asking whether the pages can answer without the source |
| `sources` | reading material that is not well-formed |

## The runtime guards

Three things fire without a command being run: the session brief when a session
opens, the write guard on the first write of a unit, and the turn guard when a
turn ends while work still awaits you.

`wfctl guards` shows which are on. They can be turned off — `wfctl guards off
<stop|write|bash>` — and that is the maintainer's call rather than yours. The
turn guard in particular is the only thing that catches a turn ending on work
nobody is waiting for.

## What is the maintainer's

Two decisions, and only two. What the work is, before it starts. What the
project says about itself, afterwards.

Closing is neither: the checks have already answered it. It returns to them in
exactly one case, and the tool names it — delivery no longer matches the framing
they approved.
