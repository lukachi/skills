# Knowledge authority

Route product discovery and ordinary explanation to
`explore-project-knowledge`. It is a read-only path through curated knowledge:
do not create, repair, promote, or verify concepts merely because someone asked
what the project does. Report a discovered gap and wait for a separate repair,
audit, reconstruction, or curation request.

The repository has five separate surfaces:

- `raw/`: continuous untrusted input; never evidence and never current truth.
- `intake/`: Git-frozen reconciliation state; never cited from knowledge.
- `reconstruction/`: bounded source-first baselines and audits with reviewed
  repository dossiers; not a default truth surface.
- `changes/`: active proposals and archived historical change records.
- `knowledge/`: curated OKF v0.2 current project knowledge.

Use this repository for current-knowledge explanation, decision-history
tracing, raw processing, contradiction reconciliation, knowledge audits,
navigation maintenance, verified promotion, and inbox/case triage. Leaf source
repositories may be inspected for evidence but never edited from here.

Natural-language maintainer requests are the user interface. The agent owns
routine `wfctl knowledge`, `wfctl work`, QMD, Graphify, case-file, and registry
operations. Never require the maintainer to know command syntax, case IDs, or
generated paths. Ask only for product authority, approval, or a genuinely
ambiguous source/worktree choice, then execute the resulting operation.

Use `operate-project-knowledge` as the default router for these common
knowledge-repository requests. It must delegate raw intake to
`process-raw-intake`, semantic promotion to `curate-project-knowledge`, and
whole-project source baselines to `reconstruct-project-knowledge`.
Code-backed verification always delegates to `analyze-with-graphify` in the
exact leaf.

Ordinary explanation, history tracing, ownership questions, and structural
diagnosis are automatic read-only modes. Raw processing, baseline
reconstruction, broad direction shaping, durable external research, and
semantic curation are deliberate modes: start them only when explicitly
requested or after the maintainer accepts a recommendation. The agent selects
and executes the mode; the maintainer never needs its skill or command name.

Use `shape-project-direction` when a consequential initiative has several
dependent product or architecture decisions and normal task planning would
guess. It maintains a Wayfinder map and question issues inside the same
canonical bundle later used by `manage-project-work`; never create a parallel
strategy source or implement the destination from the knowledge checkout.

Use `research-project-context` for a material external evidence gap. Prefer
primary sources and keep the synthesis in the owning active record or a
pending non-authoritative capture until normal authority and curation gates
pass. Resolve a capture only after its real destinations exist.

Use `process-raw-intake` for raw intake and
`curate-project-knowledge` for promotion. Never copy, link, footnote, or cite a
raw path from `knowledge/`.

Treat `curate-project-knowledge` as the promotion orchestrator, not a universal
writer. Invoke `curate-product-knowledge` for stakeholder-facing current
behavior and `curate-engineering-knowledge` for implementation and
architecture. Invoke `verify-knowledge-quality` after every material concept
edit and before stable status. A passed quality receipt must bind the current
content hash; it records review but creates no authority.

Classify raw and reconstruction statements atomically. Keep semantic role,
epistemic disposition, intent, delivery, alignment, temporal scope, explicit
claim relations, and routing independent. File age and capture order never
decide current truth. Proposed work routes to `changes/`; rejected or
unresolved raw material remains case-only.

Treat `raw/` as permanent, append-oriented intake. A changed path becomes a new
Git blob and therefore new input; never rewrite the frozen identity in an
earlier case. Run
`wfctl knowledge raw inventory` to distinguish exact Git blobs that are unseen,
changed, active, reviewed, blocked, or unresolved. Let QMD and direct reading
help the agent propose bounded thematic cases; do not require the maintainer to
choose raw paths blindly.

Use the project-local QMD index for retrieval. Unscoped queries may search only
the `knowledge` collection; select `changes`, `intake`, `reconstruction`, or
`raw` explicitly.
QMD output is navigation, not evidence or coverage.

Use `reconstruct-project-knowledge` when the workflow joins an existing
project, current knowledge is missing or stale, or several leaf repositories
must be reconciled. Run `wfctl knowledge sources list` first. Leaf
initialization registers durable repository identity and adds its exact
worktree to ignored local state without activating it. Let
`reconstruct-project-knowledge` resolve the active reconstruction worktree:
use an available active selection, announce and select the sole available
candidate when no prior selection exists, and ask the maintainer only when
multiple valid candidates or replacement of a prior selection requires a real
choice. The agent executes `wfctl knowledge sources select`; never ask the
maintainer to do so. A
baseline `wfctl knowledge reconstruct start` includes all registered
repositories' active worktrees by default and fails if any selection is
missing or unavailable. Keep local absolute checkout paths only in the ignored
runtime binding. Source
code proves observed implementation, not intended meaning or correctness.
Record optional raw, documentation, and change inputs explicitly without
assuming any of them exist. When reconstruction finds raw, inventory and map
it only far enough to recommend all, selected themes, or exclusion. Ask the
maintainer for that project boundary, record it through `reconstruct
raw-scope`, and never invent a `human:*` actor. Start reconstruction-owned
intake only afterward with `case start --reconstruction <case-id>`; do not
reuse an unrelated or pre-approval case. An empty frozen snapshot may be
recorded unavailable automatically.

For reconstruction or raw intake, the active case is the working-memory owner;
stable `knowledge/` pages are never session scratchpads. On a fresh session or
after compaction, run `wfctl knowledge reconstruct context --json` or `wfctl
knowledge case context --json` without an ID. Auto-select only when exactly one
active case exists. With several, identify the human outcome by title and ask
the maintainer if ambiguity remains; never guess from timestamps or directory
order. Read every returned semantic record completely. For reconstruction,
consume the complete JSON coverage frontier and exact local binding as well.

Persist consequential discoveries immediately in the owning case or
repository dossier using `DISC-NNN` plus Observation, Evidence, Implication,
Scope, and Disposition. Use the repository dossier for local findings and the
parent reconstruction case for cross-repository meaning. Do not add this
operational ledger to curated concepts. After semantic and coverage updates,
refresh the owning case checkpoint last; do so after material maintainer turns,
repository passes, before compaction, and before stopping. A stale checkpoint
is only a hint: rebuild the frontier from the full case, dossiers, and machine
ledgers before continuing.

Reconstruction uses the complete pinned Git tree as its enumeration authority.
After start, operate the CLI-owned coverage ledger through `wfctl knowledge
reconstruct coverage|read|files|community|surface|surfaces`; never edit its
JSON manually. Account for every tracked file, including Graphify-unindexed
formats, every Graphify community, and every discovered entrypoint/runtime
surface. Only `wfctl ... reconstruct read` creates the exact blob-and-line
receipt required by an inspected text file and source-code evidence. Pending,
blocked, unclassified, unexplained structural-only or irrelevant entries, and
incomplete reads block completed reconstruction. Technical communities are
not product Areas by default; map or explicitly explain them.

If reconstruction marks raw as reviewed, every blob in its approved `all` or
`selected` frozen scope must reach a completed parent-bound intake disposition
with no unseen, changed, active, blocked, or unresolved entry. Excluded raw
starts no child cases. Later raw is a new intake generation, not a reason to
rewrite or invalidate the frozen receipt.

Use `wfctl knowledge build` to validate and compile explicit Markdown links,
typed `x-wf.relations`, Area ownership, and decision lineage into
`.workflow/current/knowledge-graph.json`. The graph is disposable navigation,
not evidence. Never edit it. Every typed target must also be a human-visible
Markdown link, and every stable concept must remain reachable from
`knowledge/index.md`.

The same build compiles `.workflow/current/claim-ledger.json` from intake and
reconstruction cases. Use it to trace only explicit candidate lineage. Missing
reciprocal relations and supersession cycles must be resolved before
completion. The claim ledger is disposable and never establishes truth.

For code claims, invoke `analyze-with-graphify` in the exact source checkout,
then inspect the actual source and checks. Graphify output is navigation, not
authority.

Authority is claim-specific: maintainers own intent and normative decisions;
pinned source and runtime checks own implementation reality; primary sources
own external facts. Agent-written documents do not authorize themselves.

Keep unresolved raw candidates in intake cases. Use current knowledge
uncertainties only for live questions established by trusted evidence.

Use `knowledge/index.md` as the human entry point and
`knowledge/areas/<area>/index.md` as the primary map for each durable product or
functional Area. Organize detail by capabilities, concepts, rules, use cases,
implementation, decisions, and local evolution. Keep product meaning readable
without requiring implementation detail.

Treat those typed Area folders as sibling collections. Link implementation and
decisions from capabilities and use cases instead of nesting them underneath.
Use `product/flows/`, root `architecture/`, or root `decisions/` only when no
single Area is the honest primary owner.

Keep current truth at one stable path. Preserve changed decisions as immutable
records with reciprocal, acyclic `supersedes` and `superseded_by` links, one
stable current record per lineage, and a meaningful Evolution summary in the
Area index.

Create standalone decision records only for choices that are hard to reverse,
surprising without context, or resolve a real tradeoff. Keep routine local
choices in the owning concept, change ledger, or Area evolution. A rejected
candidate remains case-only unless the maintainer explicitly turns the
underlying boundary into a durable current non-goal or negative rule.

Keep canonical domain language with its owning Area concept. During discussion
store term candidates, definitions, aliases, conflicts, and names to avoid in
the active change record; promote only accepted terminology.

Every concept must satisfy the strict workflow profile: explicit lifecycle and
generation metadata, claim-level authoritative sources, a verification event
whose content hash matches stable content, human verification for normative claims, explicit
`x-wf.relations`, valid human-visible links, explicit decision lineage, and no
raw references.

Product-bearing concepts also declare independent intent, delivery, and
alignment state. Proposed ideas remain outside curated current knowledge.

Every concept declares `view`, `purpose`, and `audience`. Product documents
must include the stakeholder audience, use the standard product sections, and
contain no code, identifiers, endpoints, schemas, paths, or technical sections.
Their Engineering details section is link-only. Engineering documents must
include an engineer or operator audience, use the standard technical sections,
and link product meaning instead of claiming it from code.

Run `wfctl knowledge validate` and `wfctl knowledge build` after promotion. A
failed validation or build blocks a completed knowledge update.
