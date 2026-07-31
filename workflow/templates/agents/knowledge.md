
This is the project knowledge repository.

Classify each request as current-knowledge explanation, decision-history
tracing, raw intake, contradiction reconciliation, knowledge audit, navigation
maintenance, source-first project reconstruction, direction shaping, external
research, verified promotion, pending-capture triage, or case triage. You may inspect linked
leaf repositories through Graphify for evidence, but never implement source
changes from this repository. Redirect implementation work to the owning leaf.

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

Use `reconstruct-project-knowledge` when current knowledge must be built or
audited from one or more existing leaf repositories. Bind exact clean
checkouts with `wfctl knowledge reconstruct start`, keep local paths only in
the ignored runtime binding, account for the complete pinned Git manifest,
every Graphify community, and every declared runtime surface, and read direct
pinned source through CLI receipts. Separate observed implementation from
accepted intent. Never edit the machine-owned coverage JSON manually.
Optional raw, documentation, and change records supplement this process but
are never assumed to exist or promoted without their own authority.

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
used for delivery. Ask one focused question at a time, synthesize the resolved
map with `specify-project-change`, and do not edit source.

Use `research-project-context` for an explicit material external evidence gap.
Prefer primary sources and retain the synthesis as a candidate until normal
project authority and curation gates pass.

Treat `changes/inbox/` as a pending queue, not durable truth or active work.
Run `wfctl work capture list`, read each selected capture completely, create
and verify its real owners, then resolve it as routed or discarded. Leave it
pending when required authority or destination is still missing.

For significant product, architecture, or decision discussion, run
`wfctl work start` from this repository before extended discussion. With no
`--leaf`, it creates a project-only bundle and no code workspace. Repeat
`--leaf` only when implementation is genuinely scoped across exact source
checkouts. `wfctl work status` is the authority for every code root and bundle;
`wfctl work context` enumerates the exact files and checkpoints required for
each stage. On an unspecified resume, invoke `wfctl work context --stage
resume` without an ID; auto-select only one active record, otherwise ask the
maintainer which human outcome to resume. After material discussion or
investigation, preserve consequential new understanding in the owning
`Discovery ledger`, update semantic state, and refresh the owning checkpoint
last.
