
## Knowledge repository practice

The knowledge repository supports two different operations.

### What to ask the knowledge agent

Use an agent here for shared project understanding, not leaf implementation.
Typical requests include:

- help me understand what this project is and what it can do today;
- show me its main product directions and where I could explore next;
- explain the current state of an Area, capability, flow, or decision;
- trace how a decision evolved and why;
- inventory and process new `raw/` material;
- reconstruct or audit the project map from existing leaf repositories;
- shape a broad uncertain product or architecture direction before planning;
- research a material external fact or standard from primary sources;
- reconcile contradictory historical claims;
- audit stale, missing, duplicated, or weakly sourced knowledge;
- improve Area indexes and human navigation without inventing truth;
- curate verified results from completed changes;
- triage pending captures in `changes/inbox/` and active intake cases.

The agent may inspect multiple leaf repositories through Graphify to verify
implementation claims, but it never edits their source code from this
repository. If the outcome requires implementation, continue from the owning
leaf repository.

### First visit and product exploration

You do not need to know the project's Areas, capability names, file layout, or
implementation before asking a useful question. Start naturally:

> I am new to this project. Help me understand what it is for and what it can
> do today.

The agent reads the curated product knowledge and gives you a compact map:
purpose, intended audience, major product directions, current delivery,
important unknowns, and a few useful next branches. Choose one of the names it
shows:

> Tell me more about the economy.

Then narrow again only if useful:

> How does player trading work today?

This path is read-only. Asking a question does not edit knowledge or start a
change. If the agent finds missing, stale, or contradictory knowledge, it
reports the limitation and offers a separate audit, reconstruction, or repair
step.

The agent automatically selects read-only navigation. It starts raw processing,
reconstruction, durable research, direction shaping, or semantic curation only
when you explicitly ask for that outcome or accept its recommendation.

Significant product or architecture discussion starts a project-only central
bundle here with `wfctl work start`. It has no code root, so the agent cannot
accidentally implement in the knowledge checkout. Multi-repository work also
starts here when one bundle must bind several explicit leaf worktrees.

If the initiative is too broad to define honest acceptance criteria, the agent
first uses Wayfinder in that same bundle. `map.md` keeps the destination, fog,
resolved-route pointers, and out-of-scope boundaries; precise questions become
claimable issues. It asks one question at a time and does not write source code.
Once the route is clear, the agent reads every resolution, synthesizes the
normal specification, and only then continues through delivery.

### Source-first project reconstruction

Use reconstruction when an existing project has no trustworthy baseline, when
current knowledge may be stale, or when several source repositories must be
mapped together. Raw files are optional and never the starting assumption.

Ask:

> Reconstruct the project knowledge baseline.

The agent owns all commands, source-registry maintenance, worktree selection,
case files, retrieval, and validation.

1. Initialize every source checkout as a leaf pointing to this knowledge root,
   and commit workflow bootstrap so each checkout is clean. Initialization
   registers repository identity and adds that exact worktree to ignored local
   state. It never changes the active reconstruction selection.
2. The agent inspects every registered repository and known local worktree. It
   uses an available prior selection. If no prior selection exists and only
   one worktree is available, it announces and selects it. If several are
   valid, it shows their branch and purpose, recommends one, and asks you one
   project-level question. You answer the choice; the agent performs it.
3. Only after every repository has one available active worktree, the agent
   starts the baseline. Its scope is every registered repository. Repository
   names, roles, and count are project-defined; the workflow has no built-in
   frontend/backend/client/API topology.
4. The CLI refreshes Graphify, pins each commit and worktree identity, writes
   repository dossiers, freezes every tracked Git entry and Graphify
   community into a coverage ledger, and keeps absolute paths only in ignored
   local state.
5. The agent accounts for every tracked file, including formats Graphify does
   not understand. It traces purpose, Areas/capabilities, entrypoints,
   boundaries, contracts, flows, invariants, failures, tests, and Git evolution
   through Graphify, then reads the pinned source and test bodies in bounded
   ranges. Exact read receipts prevent a header or search snippet from being
   reported as full inspection.
6. Optional docs, change records, and raw are reconciled as separate source
   lanes. Before reconstruction-owned raw intake starts, the agent inventories
   the frozen raw snapshot, recommends all, selected themes, or exclusion, and
   records your explicit choice. You approve the human boundary; the agent
   owns paths and commands. Absence is recorded automatically only when the
   frozen raw snapshot is actually empty.
7. Repository dossiers keep traceable partial observations. The parent case
   reconciles them into one candidate per whole-project capability, flow, or
   contract before promotion.
8. Each candidate separates intended product state, observed delivery, and
   alignment. Proposed ideas stay outside current knowledge.
9. You adjudicate only intent, rationale, ownership, chronology, or authority
   that evidence cannot establish.
10. The agent promotes the smallest coherent human map, validates and builds
    knowledge, obtains your baseline review, then closes the reconstruction.

During the run it shows a reconstruction frontier derived from the complete
ledgers: pinned repositories, outstanding files/communities/surfaces,
optional-input status and approved raw scope, cross-repository reconciliation,
unresolved claims, human decisions, and next action.

You do not need to remember a reconstruction case ID between sessions. The
agent asks the workflow for the active context. One active case resumes
automatically; several are shown by human title so you can choose the intended
outcome. The case and repository dossiers preserve consequential discoveries,
while a checked checkpoint records where work stopped and the next safe
action. If any owned record changed afterward, the checkpoint is reported as
stale and the agent rebuilds the frontier from the complete records.

The agent's reconstruction gate fails on worktree or commit drift, dirty
source, an unaccounted file or Graphify community, unexplained runtime
surfaces, incomplete source reads or dossiers, unresolved raw input or claims,
weak promotion, missing coverage audits, or absent maintainer approval. This
guarantees explicit accounting, not infallible understanding; your baseline
review remains required. The agent reports the actual issue, not the
underlying command for you to operate.

### Continuous raw intake

`raw/` remains available for ideas, notes, chat exports, research, historical
artifacts, and other low-friction captures throughout the project. Work in
bounded topics rather than asking an agent to summarize the entire dump.

1. The agent inventories raw input. Git identifies exact `path + blob ID`
   sources; QMD helps it map unseen and changed material.
2. The agent proposes coherent batches with topic and file counts. You review
   the proposed batch, not a blind list of paths.
3. Commit accepted raw captures so they have a stable identity.
4. The agent creates a bounded case. It records every matching Git tree entry
   and blob ID; you do not choose pathspec syntax or manage the case ID.
5. The agent runs QMD from this repository, explicitly searches the `raw`
   collection, and follows related terminology and contradictions.
6. The agent then reads every frozen source in full, records every result, and
   maintains atomic candidate claims in the case. Each claim separately records
   semantic role, authority, intent, delivery, alignment, time, relations, and
   routing. Retrieval snippets do not count as complete review.
7. Implementation candidates are checked in exact source repositories through
   Graphify followed by direct source and test inspection.
8. You answer only unresolved intent, chronology, or authority questions.
9. Confirmed current truth routes to `knowledge/`, durable former truth routes
   to history, proposals route to `changes/`, and rejected or unresolved
   material stays case-only. A newer file never wins automatically.
10. The agent asks omission-probe questions against the routed outputs without
    consulting raw. Missing conditions or chronology become repair work.
11. The case gate must pass before the agent claims complete accounting. It
    fails on Git drift, missing sources, pending reviews, incomplete claim
    linkage or routing, broken claim lineage, or failed/missing probes.
12. Confirmed knowledge claims pass through `curate-project-knowledge`;
    unresolved raw claims stay outside current knowledge.

After each completed or blocked batch the agent shows the raw frontier: input generation, accounting
counts, active themes, blockers, decisions needed, next recommended batch, and
the remaining completion condition.

Raw-intake cases use the same resume contract: one active case is discovered
without asking you for its ID, the entire case is reread, consequential review
discoveries remain in its operational ledger, and a stale checkpoint cannot be
silently trusted. These records are working memory and audit trail; they do not
become curated truth by existing.

### Current knowledge maintenance

Your main road is `knowledge/index.md` → `knowledge/areas/<area>/index.md`.
Each Area index is a stakeholder page: purpose, audience, current product
behavior, capabilities, flows, rules, delivery, decisions, evolution, and open
questions. It links engineering details but does not explain code.

Within an Area, `capabilities/`, `use-cases/`, `concepts/`, `rules/`,
`implementation/`, and `decisions/` are sibling collections. Start with the
Area index and product capability, follow rules or use cases for conditions,
then open `implementation/` only when you need engineering realization and
`decisions/` when you need rationale. Genuinely cross-Area flows live under
`product/flows/`; system-wide engineering knowledge uses `architecture/` and
`repositories/`.

Product concepts declare `view: product` and are written for product managers,
clients, domain experts, and maintainers. They explain outcomes, observable
behavior, rules, exceptions, delivery, examples, and meaningful evolution.
They contain no code, identifiers, endpoints, schemas, source paths, or
implementation walkthroughs. Their Engineering details section contains links
only.

Canonical domain terms are defined in their owning Area concepts, including
context, accepted aliases, and names to avoid. Proposed terms stay in the
active change record until approved.

Engineering concepts declare `view: engineering` and are written for engineers
and operators. They explain implementation, ownership, flow, contracts,
failure behavior, operations, and verification at exact source revisions.
They link product meaning rather than deriving it from code.

The agent uses QMD only against the `knowledge` collection, reads selected
concepts directly, updates the smallest coherent Area, uses claim-level
authoritative sources, preserves immutable decision records, and invokes the
semantic quality gate. A stable concept requires a current quality receipt and
normal verification bound to the same content hash. The semantic gate has
independent authority/truth and reader-communication passes; deterministic
validation is a separate structural gate. The agent then runs
`wfctl knowledge validate`, builds the graphs, and refreshes QMD. Current
decisions live at one stable path; predecessors remain deprecated with
reciprocal links. Area Evolution sections explain what changed and why, while
Area `log.md` files carry local chronology.

Standalone decision records are reserved for choices that are hard to reverse,
surprising without context, or resolve a real tradeoff. Routine choices stay
in the owning concept, change ledger, or Area evolution.

Ask for a review packet rather than reading the entire corpus. Focus on product
intent, meaning, normative architecture, ownership, contracts, decisions,
accepted risk, and contradictions that evidence alone cannot resolve.
