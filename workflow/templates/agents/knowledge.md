
This is the project knowledge repository.

Classify each request as current-knowledge explanation, decision-history
tracing, raw intake, contradiction reconciliation, knowledge audit, navigation
maintenance, source-first project reconstruction, direction shaping, external
research, verified promotion, pending-capture triage, or case triage. You may inspect linked
leaf repositories through Graphify for evidence, but never implement source
changes from this repository. Redirect implementation work to the owning leaf.

That sentence is guidance and stops nothing by itself: one `cd` into a bound
checkout makes you the leaf agent, and the workflow is designed to allow exactly
that once a bundle is released. So the real test is never where you are typing.
It is whether the maintainer has said to begin — in words, about this work. A
truthful answer to some other question is not that: a bundle approved so it would
stop cluttering a queue was read as a bundle cleared to run, and six commits
landed in three source repositories whose revisions the knowledge base still
cites as what the source shows now. Before touching any source checkout, check
that the bundle is not parked and that a release carries their words.

Invoke `operate-project-knowledge` as the default entry point for work inside
this repository. It handles common explanation, ownership, history, audit,
navigation, contradiction, and triage requests, then routes specialized work
without crossing repository boundaries.

Select read-only explanation and diagnosis automatically. Start raw
processing, whole-project reconstruction, durable external research, semantic
curation, or broad direction shaping only when the maintainer explicitly asks
for that outcome or accepts a recommendation. Never require a skill name.

When a person asks what the project is, what it can do, where to start, what
works today, or asks a natural follow-up about one product direction, invoke
`explore-project-knowledge`. Give them a useful product map before asking them
to choose an Area or capability. Reveal detail gradually and do not modify
knowledge merely to answer a question.

Accept requests in ordinary project language. Own source-registry inspection,
worktree selection mechanics, case creation, QMD retrieval, Graphify
invocation, validation, and close operations. Ask the maintainer for the
meaningful repository/worktree choice only when more than one valid candidate
exists; never ask them to translate that choice into a `wfctl` command.

Use `process-raw-intake` to inventory, batch, freeze, and adjudicate continuous
untrusted `raw/` input. Run QMD from this repository and select the `raw` or `intake`
collection explicitly; only `knowledge` is a default search surface. Use
`curate-project-knowledge` only after claims have independent authority. Never
cite raw or intake paths from `knowledge/`. Ask the maintainer when chronology,
intent, or current truth cannot be established from trusted sources.
Classify atomic claims by semantic role, epistemic disposition, intent,
delivery, alignment, temporal scope, explicit relations, and routing. Run
durable-output omission probes and rebuild the deterministic claim ledger
before calling intake complete.

During promotion, `curate-project-knowledge` is the orchestrator. Route
stakeholder-facing Areas, capabilities, use cases, flows, domain concepts,
product rules, delivery, and evolution to `curate-product-knowledge`. Route
implementation, architecture, repositories, contracts, data/control flow,
runtime, and operations to `curate-engineering-knowledge`. Invoke
`verify-knowledge-quality` before any materially changed concept becomes
stable. It must run independent authority/truth and reader-communication
passes against one unchanged content hash. Never let code define accepted
product intent or let product pages contain implementation walkthroughs.

Two different operations read several source repositories from here, and
confusing them costs days. A reconstruction establishes what the project *is*:
it accounts for every file at a pinned revision, writes nothing to source, and
ends in curated knowledge. Delivery shaping decides what the project *should
do next*: it reads only what the change touches, ends in one approved
specification and issues claimed in the leaves, and is the right operation for
work that came out of debts, captures or a maintainer's request. The test is
what the session is meant to leave behind — a page or a bundle — not how many
repositories it opens. Do not run a reconstruction because delivery spans three
repositories, and do not shape delivery from a corpus nobody has read.

Use `reconstruct-project-knowledge` when current knowledge must be built or
audited from one or more existing leaf repositories. Bind exact clean
checkouts with `wfctl knowledge reconstruct start`, keep local paths only in
the ignored runtime binding, account for the complete pinned Git manifest,
every Graphify community, and every declared runtime surface, and read direct
pinned source through CLI receipts. Separate observed implementation from
accepted intent. Never edit the machine-owned coverage JSON manually.
Optional raw, documentation, and change records supplement this process but
are never assumed to exist or promoted without their own authority. Before
reconstruction-owned raw intake, inventory the frozen snapshot, recommend all,
selected themes, or exclusion, and ask the maintainer for that boundary. Record
the exact human decision yourself; never invent approval or require pathspec
syntax. Bind every resulting intake case to the parent reconstruction so the
CLI rejects pre-approval, path, or baseline drift.

For reconstruction and raw intake, the active case is the session-memory
owner; curated `knowledge/` pages are not scratchpads. On a fresh session or
after compaction, run `wfctl knowledge reconstruct context --json` or `wfctl
knowledge case context --json` without an ID. Auto-select only one active case;
with several, identify the intended outcome from human titles and ask the
maintainer if ambiguity remains. Read every returned case and dossier in full,
plus the complete reconstruction coverage frontier and local binding.

Persist consequential discoveries immediately in the owning case or dossier
using `DISC-NNN` with Observation, Evidence, Implication, Scope, and
Disposition. Repository-local discoveries stay in their dossier;
cross-repository discoveries belong in the parent case. Never put this working
ledger in curated knowledge. Refresh the owning checkpoint after semantic and
coverage changes, after material maintainer turns, before compaction, and
before stopping. A stale checkpoint is a hint only; rebuild the frontier from
the complete durable records before continuing.

Use `shape-project-direction` for an explicitly selected broad initiative whose
dependent decisions are not yet bounded enough for implementation planning.
Keep one Wayfinder map and its question issues in the same central bundle later
used for delivery. Resolve one issue per session, interviewing through
`grill-project-decisions` rather than asking one question per turn, then
synthesize the resolved map with `specify-project-change`. Do not edit source.

Use `research-project-context` for an explicit material external evidence gap.
Prefer primary sources and retain the synthesis as a candidate until normal
project authority and curation gates pass.

What a reconstruction reads becomes subjects the maintainer can set a direction
against, through `assemble-trajectories`. Publish every subject it produced with
`wfctl knowledge trajectory promote`, including the ones they have not answered
for: a subject with no declared direction still gets a page carrying what the
source shows at the pin. Holding it back would make curated knowledge a
derivative of their decision queue, where a subject read in full does not appear
to exist until they answer and nothing says so. The brief names any subject no
page carries. The single product question is
`wfctl knowledge trajectory ask`, and their answer is recorded by you with
`trajectory declare --attested`, never by handing them a command; promoting again
with `--force` afterwards adds where the subject is going to the page that
already says what it does. What every
subject still owes against its declared direction is `wfctl knowledge trajectory
debts`, and the brief opens that gate itself once every subject has a direction —
you never decide it is time. Put it to them with `trajectory debts --ask`, never
as a count and never as forty-eight questions. Every debt then lands in one of
three states or it will be forgotten: scheduled into a bundle through `wfctl work
start` plus `trajectory schedule`, deliberately deferred with their reason through
`trajectory defer`, or still open because they want something else first. No command marks
a debt done — it ends when the subject is read again at a new revision and the
gap is no longer derivable, so landing work ends in a re-read and not in a
status change.

Treat `changes/inbox/` as a pending queue, not durable truth or active work.
Run `wfctl work capture list`, read each selected capture completely, create
and verify its real owners, then resolve it as routed or discarded. Leave it
pending when required authority or destination is still missing.

For significant product, architecture, or decision discussion, run
`wfctl work start` from this repository before extended discussion. With no
`--leaf`, it creates a project-only bundle and no code workspace. Repeat
`--leaf` only when implementation is genuinely scoped across exact source
checkouts.

Work that reaches more than one source repository is shaped from here, because
only here are all of them visible at once. What is not visible from here is what
each repository declares about itself — the instructions its maintainer wrote in
its own agent file, outside the block this workflow manages, and the skills
installed only in that checkout. They are specific and binding, and a session
that never entered the checkout has no way to learn they exist. Run `wfctl work
repositories <id>`, read every one, and account for each bound repository with
`--read <repository> --note "<what its rules require of this work>"` or
`--untouched <repository> --reason "<why the work does not reach it>"`. Framing
approval and `wfctl work map finish` refuse until each is one or the other,
because afterwards the direction is already chosen and filling the field changes
nothing but whether a gate opens.

`wfctl work status` is the authority for every code root and bundle;
`wfctl work context` enumerates the exact files and checkpoints required for
each stage. On an unspecified resume, invoke `wfctl work context --stage
resume` without an ID; auto-select only one active record, otherwise ask the
maintainer which human outcome to resume. After material discussion or
investigation, preserve consequential new understanding in the owning
`Discovery ledger`, update semantic state, and refresh the owning checkpoint
last.
