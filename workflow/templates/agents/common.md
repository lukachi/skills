## Project workflow

This block is managed by `wfctl`. Read `.workflow/config.json` and all files under `.workflow/rules/` before project work. Use `PROJECT_WORKFLOW.md` as the maintainer-facing contract for review gates.

- Invoke `analyze-with-graphify` before inspecting, searching, planning,
  changing, debugging, reviewing, or verifying source code, even when the
  maintainer does not mention Graphify.
- Require that skill to confirm and invoke the official native `graphify` skill
  exposed in the current session before project analysis continues.
- Treat Graphify as the primary source-code navigation tool; text search is
  supplementary and direct source inspection is authoritative.
- Do not use Graphify as the primary analyzer for Markdown intake or curated
  knowledge.
- Use QMD from the knowledge repository for Markdown retrieval. Treat its
  index, ranking, and snippets as navigation only; verify by direct reading and
  authoritative sources.
- Present bounded review packets and require explicit maintainer decisions at the gates defined by the workflow.
- Record framing and completion approvals with `wfctl work approve`, never by
  editing `maintainer_review`. The maintainer confirms in their own terminal;
  a hand-written approval receipt fails verification.
- Ask one material question at a time, include a recommendation, and update
  the durable record before continuing.
- Preserve uncertainty and report missing evidence instead of guessing.
- Execute required `wfctl` commands yourself when tool access permits. Do not
  delegate routine CLI operation, spec editing, or record maintenance to the
  maintainer; ask them for decisions, approval, or missing authority.
- Treat the maintainer's natural-language request as the user interface.
  Outside bootstrap or explicit troubleshooting, never require them to know a
  subcommand, record ID, generated path, QMD query, Graphify invocation, or
  structured-file schema. Resolve those mechanics yourself.
- When internal state offers one safe valid continuation, announce it and
  continue. When several materially different choices remain, present their
  human meaning, evidence, and recommendation; after the maintainer chooses,
  execute the corresponding commands yourself.
- For significant multi-turn work, create the central bundle early. After every
  material maintainer turn or agent investigation cycle, preserve
  consequential new understanding in the owning record's broad `Discovery
  ledger`, update the affected semantic state, and refresh its structured
  checkpoint last. The preservation trigger is consequence of information
  loss, not a fixed category of findings.
- Run `wfctl brief --json` before anything else in a session, unless a session
  brief was already delivered as context, in which case use that one. It is the
  authoritative current state of this repository: signals are observed facts and
  capabilities are derived from them. Do not rediscover that state by scanning
  records, and do not read the list back to the maintainer. Compose one short
  orientation from it — what exists, what is in progress, what waits on them —
  and offer the operations reported available. For a blocked capability, name
  what would unblock it instead of starting it. The brief never starts work; a
  signal with `awaits: maintainer` is a question for them, not a task for you.
- On resume, compaction, or a clean-session start, run `wfctl work context
  --stage resume` without an ID. Auto-select only when exactly one active record
  is bound to the current checkout. If several exist, inspect `wfctl work
  status` and ask the maintainer which human outcome to resume; never guess.
  Read every required file and discovery entry completely, then recover from
  the bundle, current checkpoint, and exact claim rather than conversation
  memory.
- Use `changes/inbox/` only for pending captures that have no active or curated
  owner. Resolve each capture to existing destinations or discard it with a
  reason; never duplicate active progress there.
- Do not create a competing leaf-local spec or issue tracker. Claim one central
  frontier issue from the exact bound checkout before implementation. Before
  completion, account for every bundle file at its current hash; a receipt
  proves accounting, not comprehension.
- Treat the maintainer/product and engineering roads as linked, first-class
  views of the same project, never one blended document and never one derived
  from the other. Product pages explain current behavior to stakeholders;
  engineering pages explain implementation to engineers and operators.
  Decision lineage connects both roads rather than forming a third flat view.
- Route broad project discovery, newcomer onboarding, Area exploration, and
  focused product-understanding questions to `explore-project-knowledge`.
  Exploration is read-only: answer progressively from curated knowledge
  without requiring the user to know Areas, capability names, or file paths.
- Route product authoring to `curate-product-knowledge`, technical authoring to
  `curate-engineering-knowledge`, and every material knowledge edit through
  `verify-knowledge-quality` before it becomes stable. Keep authority/truth
  and reader communication as separate semantic passes.
