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
- Two decisions are the maintainer's. What the work is, before it starts: render
  it with `wfctl work ask <id>` and record it with `wfctl work approve <id>
  --stage framing`. What the project says about itself afterwards: render the
  pages with `--stage promotion` and write them with `wfctl work promote <id>`.
  Closure is neither. `maintainer-review` owns how every message to them is
  written — read it rather than restating it from memory.
- When the answer is a structure — a flow, a layout, a sequence, or a change to
  one — draw it with `show-project-work` rather than describing it. Shortening a
  description loses the substance; replacing it with the shape keeps all of it.
- Approving a framing settles what the work is, never that it begins. When the
  maintainer approves and says starting is premature — including approving only
  to clear their queue — record both: `wfctl work approve ... --park "<why>"`.
  A parked bundle refuses every delivery claim, and only `wfctl work release
  --attested "<their words>"` starts it. Never infer a release from an answer to
  a different question, and never from the reconstruction or blocker that held
  it having since cleared: the condition ending is not the same as being told to
  go.
- Close finished work yourself. The gates check whether the criteria are met, the
  receipts carry evidence and the revisions are pinned, and asking the maintainer
  to confirm arithmetic is not a decision. One night this cost seven hours and
  fifty-four minutes. Closure returns to them in exactly one case, and the tool
  names it: delivery no longer matches the framing they approved.
- Draft the curated pages before closing, under the bundle's `promotion/`
  directory, at the path each will occupy inside `knowledge/`. Then run `wfctl
  work promotion <id>`, or `--none "<why>"` when this work changes nothing the
  project says about itself. A closed bundle holding pages waits in the promotion
  queue rather than archiving.
- Record what they answered where they answered it: `--attested "<their answer,
  word for word>" --session "<where they said it>"`. A hand-written
  `maintainer_review` receipt fails verification, and a second terminal records
  nothing the attestation does not.
- Run `wfctl knowledge decided "<subject>"` before putting any question to the
  maintainer, whatever route you are on. It reads the four places an answer lands
  and reports the date and their own words. On a bundle, `--record <id>` writes
  the result into the framing, which the framing gate requires.
- Preserve uncertainty and report missing evidence instead of guessing.
- Execute required `wfctl` commands yourself when tool access permits. Do not
  delegate routine CLI operation, spec editing, or record maintenance to the
  maintainer; ask them for decisions, approval, or missing authority.
- Treat the maintainer's natural-language request as the user interface.
  Outside bootstrap or explicit troubleshooting, never require them to know a
  subcommand, record ID, generated path, QMD query, Graphify invocation, or
  structured-file schema. Resolve those mechanics yourself.
- End a turn only when you are waiting on the maintainer. Ending one hands
  control to them, so the test is not whether you announced anything: a turn
  that closes with "the work continues" or "the rest can wait" parks just as
  completely as one that names a next step and abandons it. If you are not
  waiting on them, take the next action you can take alone, in the same turn.
  A written report is progress and never the finish line; completion is the
  terminal status of the required records. This holds while executing accepted
  work and not while shaping or specifying, where asking is the work. When
  several materially different choices remain, present their human meaning,
  evidence, and recommendation; after the maintainer chooses, execute the
  corresponding commands yourself.
- Settle a direction by interviewing them, through `grill-project-decisions`,
  and reach a shared understanding before anything is written into a contract.
  Everything above pulls toward acting alone, and that pull is correct on
  accepted work and wrong here: a specification composed from two answers and
  an inference has settled the rest by guessing, and the guesses are invisible
  once they are prose. Map the open decisions as a tree and ask the whole
  frontier of them in one numbered round, each with your recommended answer,
  rather than one question per turn — a round they can answer in one sitting is
  what a relentless interview looks like from their side. Facts are yours to
  find: `wfctl knowledge decided`, then curated knowledge, then the source, then
  a subagent. Decisions are theirs. Their word that you understand each other is
  what releases the writing, and `grill-me` is how they ask for this themselves.
- Finishing a unit is not finishing. Completing an issue releases its claim, so
  the bundle is left holding ready issues nobody has claimed — the shape every
  long run passes through between units, and the moment a turn is most likely to
  end on "next I will do X" and then not. The next unit is available work, and
  available work is yours.
- Say why you are stopping, in the record, in the same turn. Prose is not state:
  an explanation that lives only in a message goes with the session. Two answers
  end a turn and they are different answers. The maintainer is what the work is
  missing — record a blocker: `wfctl work checkpoint <id> --status blocked
  --blocker "<what you need from them>"`, which moves it to their queue. Or
  nothing is missing except this session, because the context is spent or the
  next unit will not fit in what is left — record `--handoff "<why this session
  stops here>"`, which tells the next session and asks them nothing. A handoff is
  cleared by the next checkpoint, so it explains one stop rather than every stop
  after it. Using a blocker for the second costs them a turn on a question that
  was never theirs.
- Before ending a turn, run `wfctl resumable`. It answers, from the repository
  rather than from your memory of it, whether stopping now would lose anything:
  a checkpoint describing a record that has since changed, an open record that
  never had one, or work on disk no checkpoint describes and no commit preserves.
  A non-zero exit is not a report to pass on — refresh the checkpoint or commit,
  then end. The maintainer should never have to ask you to wrap up.
- For significant multi-turn work, create the central bundle early. After every
  material maintainer turn or agent investigation cycle, preserve
  consequential new understanding in the owning record's broad `Discovery
  ledger`, update the affected semantic state, and refresh its structured
  checkpoint last. The preservation trigger is consequence of information
  loss, not a fixed category of findings. Small jobs noticed along the way go in
  the checkpoint's own list — `--todo-add`, cleared with `--todo-drop` — which is
  neither a blocker nor the next action, survives a checkpoint that says nothing
  about it, and reaches the next session through the brief. Anything you intend
  to "come back to" and leave only in prose is lost with the context holding it.
- Run `wfctl brief --json` before anything else in a session, unless a session
  brief was already delivered as context, in which case use that one — after
  checking it arrived whole. A brief grows with the number of open records and
  is delivered truncated once it passes what a session accepts, as a preview and
  a path to the rest. Read that path before using it. The preview is the first
  bytes rather than the important ones, and a session opened on it starts from a
  fraction of the state while reading exactly like a complete one. It is the
  authoritative current state of this repository: signals are observed facts and
  capabilities are derived from them. Do not rediscover that state by scanning
  records, and do not read the list back to the maintainer. Every open record
  carries a `*.resume` signal holding where its work stopped and the next action
  it named; that is the resume state, so read it rather than reconstructing one.
  Compose one short orientation from it — what exists, what is in progress, what waits on them —
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
  reason; never duplicate active progress there. The brief names every pending
  capture, so an unresolved one is not unknown to you — a queue that grows
  without anyone opening it is the same as no queue. A capture only the
  maintainer can settle is created with `--awaits maintainer` and presented to
  them as one decision at a time, not listed as a backlog.
- After `wfctl upgrade`, commit the files it names in a commit of their own
  before continuing. They are tracked project files, and folding them into the
  next unrelated commit hides what the upgrade changed. The new agent block and
  rules reach a session only at its start, so say plainly that a restart is
  needed rather than acting as if the new instructions are already loaded.
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
