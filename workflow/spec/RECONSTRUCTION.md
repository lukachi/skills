# Reconstruction contract

## Status

Normative for the `reconstruction` case: what it is, its stages, its gates, and
the trajectories it produces. The engine contract owns instruction delivery and
installation; the knowledge contract owns trust boundaries and curation.

## What it is, and what it is not

Reconstruction is the expensive write that builds curated knowledge when none
exists, or repairs it when it has drifted.

It is **not** "tell me what this project does." That is read-only, answered from
curated knowledge, and needs no case, no flow and no gate — what it needs is
retrieval and the graph, because an agent left to itself greps a few files and
guesses the rest.

There is no mode to choose. Whether this pass is a first baseline or a re-check
of an existing one follows from whether curated knowledge holds pages, which the
tool observes. A ten-year-old codebase with an empty corpus is a first baseline.

## Registration is a separate operation

Repositories are registered by their own command, run after installation and
again whenever a checkout or worktree appears. A project keeps several so
different work can run at once, and they arrive over time — an installation that
captured them once would be wrong within the week.

Nothing is written into a leaf. There is no leaf installation; the knowledge
repository records where each checkout is, and reconstruction picks from that
registry rather than asking for paths.

## Pinning

The revision each repository was read at is recorded, and so is whether its tree
was dirty. Neither refuses the work.

A recorded revision earns its place because a later re-read at a new one is what
makes a gap die — the workflow prescribes re-reading rather than accepting a
claim that the work was done. A claim read against uncommitted work is not
wrong, only less reproducible, and that belongs on the page rather than in a
refusal that stops the pass.

## Stages

| Stage | Who is present | What happens |
| --- | --- | --- |
| `scope` | maintainer | one decision: which repositories, how much raw, what is out |
| `crawl` | nobody | reads everything in scope; contradictions recorded, never asked |
| `assemble` | nobody | readings become trajectories |
| `adjudicate` | maintainer | one batched round of what evidence could not settle |
| `write` | nobody | pages drafted from resolved trajectories |
| `probe` | nobody | a different agent asks what the pages cannot answer |
| `promote` | maintainer | what the project now says about itself |

The maintainer appears three times and never during the long part. Interrupting
an unattended crawl with adjudication questions is what made the previous flow
unusable at length; worse, it asks them to adjudicate before the material that
would inform the answer has been read.

`scope` is one act, not four asks. The agent inventories the registry, the raw
material and the existing corpus first, then puts a single question. It may
inventory and recommend; it may not decide how much raw material counts.

## Gates

- **crawl** — every file in scope is read or excluded with a reason. An
  unexplained exclusion is indistinguishable from a file nobody got to.
- **assemble** — at least one trajectory exists. Nothing routes into curated
  knowledge before one does: a claim about current truth made while reading is
  made before the material that contradicts it has been read.
- **adjudicate** — no contradiction is left unresolved.
- **probe** — probes exist, none was asked by the agent that wrote the pages,
  and all of them pass.

Reading outside the agreed scope is refused. That is how a bounded pass becomes
an unbounded one.

## Coverage, and what proves reading

Coverage is plain accounting: what was in scope, what is read, what is excluded,
what remains. It is kept because unread should be a number rather than a
judgement.

Line-range reading receipts are **not** kept. The agent asserted that a file was
inspected and nothing observed it, so coverage, completion, and the weight
behind every claim inherited the overstatement. Retrieval establishes that bytes
were fetched and nothing about whether anyone read them.

What replaces them is the **omission probe**: a question answerable only from
the written pages, without reopening the source. It tests the output rather than
the process, which is the only thing that catches skimming — and it is asked by
a different agent, because asking yourself what you might have missed returns
what you already know.

## Claims

Raw material is chaotic: old decisions beside new ones, ideas that went nowhere
beside ideas that shipped, the story of the development mixed through all of it.

A claim is one statement, dated, attributed to the source that made it.
Atomising survives from the previous model because statements cannot be ordered
into a line until they have been separated from each other.

Routing lanes do not survive. The trajectory decides where anything goes, and
deciding it twice is how a claim reached curated knowledge before the line it
belonged to existed.

## Trajectories

A trajectory is one product subject as a line: how it was conceived, what
changed and why, and what the source shows now at a named revision.

It is the only layer the maintainer is shown — they decide about subjects, not
about findings.

Three axes. `intent` is what the project stated, recovered. `delivery` is what
the source gives now. `vision` is what the subject should become, and only the
maintainer declares one; a direction invented for them is worse than an absent
one. The gap between axes is derived, never stored: a stored gap is a
subtraction that was true once, and a gap accepted as correct is a vision that
was wrong.

**Both cases write here.** A closed change appends what it delivered, because a
closed change is an event on a subject's line. Without that, the line is built
only by reconstruction, goes stale the moment work lands, and the next
reconstruction rediscovers what the change already knew.

## Sources that are not well-formed

Source condition is a property of this project's artifacts, not of the artifact
class. Demotion is never promotion; a degraded source is still a source;
coverage is measured rather than inferred; and `unknown` is a result rather than
a gap to fill with the least-bad remaining source.

Absence from the graph, from retrieval, from text search, or from one repository
never proves absence from the project.

## Closure

A pass that changed nothing still writes. "Checked at this revision, nothing
moved" is what stops the next pass redoing the work; closing empty throws away
the only thing the pass produced.

Reconstruction never edits product source, so a gap it finds outlives the case
that found it and becomes work through the changes flow — never through direct
promotion.
