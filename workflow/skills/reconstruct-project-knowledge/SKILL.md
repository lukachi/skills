---
name: reconstruct-project-knowledge
description: Run or resume an explicit, bounded baseline reconstruction or whole-project audit across one or more registered leaf repositories, Git history, current curated knowledge, and optional documentation, change records, or raw candidates. Use when the maintainer asks to establish or rebuild an untrustworthy project baseline, accepts that recommendation after a knowledge gap is reported, requests a source-wide alignment audit, must decide whether all, selected themes, or none of a frozen raw snapshot belongs to an active reconstruction, or asks a fresh or compacted knowledge-repository session to continue an active reconstruction. Do not trigger merely because someone asks what the project does or how one capability works. This is an expensive knowledge-repository operation with complete source accounting, not the per-task leaf workflow.
---

# Reconstruct Project Knowledge

Build a reviewed current baseline without pretending that any one source
contains the whole project. Source code establishes observed implementation;
the maintainer establishes intended meaning; Git establishes only the history
it actually retains; raw material supplies candidates, never evidence.

Read [the reconstruction model](references/reconstruction-model.md) before the
first baseline or any multi-repository audit.
Read [the adaptive agent-routing contract](references/agent-routing.md) before
planning workers, choosing their compute profiles, or reviewing an escalation.

## Command and interaction ownership

Accept requests such as “reconstruct this project,” “build the baseline,” or
“audit current knowledge” without requiring CLI vocabulary. Own all source
registry, reconstruction, Graphify, QMD, case-file, validation, and close
operations. Never ask the maintainer to run a command, copy a case ID, edit a
dossier, or locate a generated binding. Ask only for a missing path, product
authority, review, or a source choice that cannot be resolved safely.

## Show the reconstruction frontier

At start, resume, after each repository pass, and before maintainer review,
present one compact frontier derived from the case and CLI coverage ledgers:

- exact case mode and frozen repository revisions;
- each repository's remaining files, Graphify communities, and runtime
  surfaces by review state;
- optional raw, documentation, and change-record lane status;
- cross-repository flows or contracts still awaiting reconciliation;
- unresolved candidate claims and exact maintainer decisions needed;
- the next highest-leverage action and the completion blockers.

Do not replace the CLI ledgers with prose or hide a long pending set behind a
percentage. The frontier tells the human where the investigation stands; the
complete JSON accounting remains the machine source.

## Choose the operation

- Use `mode: baseline` when curated knowledge does not yet provide a
  trustworthy map. A completed baseline must promote validated concepts.
- Use `mode: audit` when a usable baseline already exists and the question is
  whether code, intent, and knowledge still align. An audit may finish with no
  promotion when it proves that no durable truth changed.
- Use `process-raw-intake` instead when the bounded subject is only new or
  changed raw material.
- Use the leaf significant-work workflow for a proposed implementation change.
  Reconstruction never edits product source.

## Start and bind exact checkouts

1. Work from the initialized knowledge repository.
2. Run `wfctl knowledge sources list` yourself. Treat its model literally:
   - durable project scope may contain any repository names, roles, and count;
   - each repository may have any number of known local worktrees;
   - exactly one may be explicitly marked `ACTIVE` for default reconstruction.
3. Require every source checkout to be an initialized leaf pointing back to
   this knowledge root. `wfctl init leaf --knowledge <root>` registers the
   repository and adds the exact worktree, but deliberately does not activate
   it. When the maintainer supplies another initialized checkout, use `wfctl
   knowledge sources add --leaf <path>` yourself to add or refresh it.
4. Resolve one clean checkout per repository without exposing registry
   mechanics:
   - use an available existing `ACTIVE` checkout;
   - when no active selection exists and exactly one known checkout is
     available, announce that checkout and run `wfctl knowledge sources select
     --leaf <path>` yourself;
   - when several known checkouts are available and none is active, show
     repository, path, branch, and commit, recommend one, ask one focused
     question, then execute the selection yourself;
   - when the active checkout is unavailable, never replace it silently; show
     the available alternatives and ask before switching;
   - when no known checkout is available, state which repository is missing
     and ask for its path. Invoke `setup-workflow-environment` if it is not yet
     initialized.
   If the maintainer explicitly names worktrees for a one-off audit, validate
   them and use repeated `--leaf` overrides without changing saved active
   selections.
5. The durable registry
   stores repository identity but never a local path; ignored runtime state
   stores known worktrees and explicit active selections. Selecting one affects
   only default reconstruction. Normal leaf work may start from any registered
   worktree and binds its own exact code root in the work spec.
6. Start only after selection is explicit. A baseline with no `--leaf` includes
   every registered repository's active worktree and fails closed if any
   selection is missing or unavailable. The knowledge repository must already
   have an initial Git commit so optional inputs can be frozen:

   ```sh
   wfctl knowledge reconstruct start <slug> \
     --title "<bounded baseline or audit>" \
     --mode baseline
   ```

   Repeated `--leaf` is an explicit checkout override and may name a known
   alternative worktree without changing the stored default selection. A baseline
   override must still include every registered repository. An `audit` may
   deliberately select a subset, but its title and scope must say so.
7. Resolve raw scope before starting any reconstruction-linked intake. The CLI
   records `unavailable` automatically only when the frozen snapshot and
   working tree contain no raw files. Otherwise inventory the pinned snapshot,
   use QMD only far enough to describe its themes, and recommend one
   maintainer-facing choice:
   - `all`: every raw blob in the reconstruction-start snapshot;
   - `selected`: named themes mapped by the agent to explicit paths;
   - `excluded`: raw will not participate in this reconstruction.

   Raw being unreviewed, contradictory, obsolete, or unable to prove current
   behavior is never by itself a reason to recommend `excluded`; those are
   normal raw properties. Judge scope by possible relevance to the declared
   reconstruction objective and by information-loss risk. Material that may
   preserve intended behavior, abandoned alternatives, decision history, or
   unrealized product ideas normally belongs in `all` or a bounded `selected`
   scope even though every claim still requires reconciliation. Recommend
   `excluded` only when the mapped snapshot is outside the declared objective
   or the maintainer confirms that it should not inform this reconstruction.
   If relevance cannot yet be established safely, present a neutral choice or
   recommend a bounded selected review; do not convert uncertainty into
   exclusion.

   Ask one focused question. Do not require the maintainer to know pathspecs.
   Record the answer yourself:

   ```sh
   wfctl knowledge reconstruct raw-scope <case-id> \
     --mode selected \
     --path raw/<approved-path> \
     --by human:<maintainer-id> \
     --note "<what was included or excluded and why>"
   ```

   Use repeated `--path` for selected scope. `all` and `excluded` take no
   paths. Never invent `human:*` approval. Never start a linked intake case
   before this decision. If `reconstruct check` reports a legacy v3 case,
   record its scope through this command before continuing. Once linked intake
   starts, the scope is immutable; a materially revised choice requires a new
   reconstruction case.
8. Run `wfctl knowledge reconstruct check <case-id>` and read the complete
   `case.md` plus every generated repository dossier. Run `wfctl knowledge
   reconstruct coverage <case-id>` for the complete machine-owned coverage
   summary; do not manually edit `*.coverage.json`.
   On a fresh session, after compaction, or whenever the active case ID is not
   already established, begin instead with:

   ```sh
   wfctl knowledge reconstruct context --json
   ```

   Omit the ID deliberately. The CLI selects only when exactly one active
   reconstruction exists. With several, use the human titles it returns to
   identify the owner and ask the maintainer if ambiguity remains; never choose
   from dates or directory order. Read every returned `case-full-read`,
   `repository-dossier-full-read`, and local binding file completely. Treat the
   JSON coverage frontier as the complete machine enumeration; do not replace
   it with a truncated terminal list or a partial direct read of the coverage
   file.
9. Treat `.workflow/current/reconstruction/<case-id>.json` as the local
   checkout binding. Never copy its absolute paths into the durable case,
   dossiers, or curated knowledge.
10. Stop if the binding, worktree identity, commit, clean state, or Graphify
   graph drifts. Restart or explicitly re-scope; never guess which checkout to
   inspect.

The CLI updates and validates Graphify in each exact checkout before creating
the case. It also freezes every tracked Git tree entry and every derived
Graphify community into a durable coverage ledger. The durable case stores
repository identity, branch, commit, checkout label, and worktree ID, but not
a machine-local path.

## Plan adaptive execution before analysis

The default strategy is one orchestrator with bounded workers, not a free-form
swarm. Decide the execution only after inspecting the complete frozen frontier:

- choose `single-agent` when the work is small, tightly sequential, depends on
  one shared context, or the current host has no safe subagent facility;
- choose `orchestrator-workers` when there are genuinely independent read-heavy
  repository, raw, structural, or review axes, or the corpus cannot fit one
  context without material loss;
- never use agent count as a goal. Record a proportional `max_parallel`, total
  workstream cap, retry cap, and reason in `case.md` before dispatch.

Use platform-native subagents when available. Keep durable routing host-neutral:
classify each packet as `exploration`, `analysis`, `synthesis`, or `review` and
request `fast`, `balanced`, or `deep` according to
[the routing contract](references/agent-routing.md). Let the host map that
profile to a concrete model and reasoning effort. Record the effective choice
when known or the explicit `host-auto` / `profile-default` fallback. Do not
hard-code an agent product, model name, worktree feature, or topology as a
workflow requirement. A normal checkout is as valid as a worktree; every
worker receives the exact already-bound source root at dispatch time.

Partition research by independently reviewable semantic outcome, not by
alphabetical file range. Suitable first-wave units include:

- one cohesive repository/community and its entrypoints, runtime surfaces,
  tests, and boundaries;
- an unusual executable surface such as migrations, generators, background
  jobs, protocols, plugins, or operations;
- one bounded raw-intake or historical question after raw scope approval;
- a structural coverage scout whose output is a map, not a product conclusion.

After fan-in, create narrower units for discovered cross-repository flows,
contracts, Areas, capabilities, contradictions, negative claims, or unexplained
coverage. One repository's worker never defines the whole-project meaning.

For every research worker, create and register a unique durable packet with `wfctl
knowledge reconstruct workstream create`, then claim it for the concrete host
run with `wfctl knowledge reconstruct workstream claim`. The CLI uses
[the workstream template](assets/reconstruction-workstream.md), updates the
parent list under a case lock, and records the reported host and run ID. The
dispatch prompt must include:

```sh
wfctl knowledge reconstruct workstream create <case-id> <workstream-id> \
  --title "<bounded outcome>" --objective "<semantic question>" \
  --role <role> --workload <exploration|analysis|synthesis|review> \
  --profile <fast|balanced|deep> --routing-reason "<why sufficient>" \
  --wave <number> [--repository/--file/--community/--surface/--raw-case ...]
wfctl knowledge reconstruct workstream claim <case-id> <workstream-id> \
  --by <worker> --host <agent-host> --run-id <actual-session-id-or-unavailable:reason> \
  --model <model-or-host-auto> --effort <effort-or-profile-default>
```

- exact knowledge root, case root, bound source root, repository identity, and
  pinned commit;
- the exact files, communities, surfaces, raw cases, or questions it owns;
- the parent case, relevant dossier and frontier slice, and only explicit
  prerequisite workstreams to read fully;
- the objective, non-goals, required tools, evidence contract, output schema,
  stop conditions, and effort boundary;
- explicit permission to explore all connected evidence with safe read-only
  tools, while updating only its own packet;
- the requirement to record material cross-slice exploration in
  `explored_context` and turn final source evidence into attributed receipt IDs
  with `wfctl knowledge reconstruct read` or approved raw reads with `wfctl
  knowledge case read`.

Workers must not edit the parent case, repository dossiers, intake cases,
other workstreams, coverage JSON directly, curated knowledge, or leaf source.
Shared coverage and raw-read commands serialize their receipt updates, but
only the orchestrator assigns final `files`, `community`, `surface`, and
dossier dispositions. A worker summary is
an untrusted research packet until the orchestrator checks its receipts and
marks `review.status: accepted`. A dispatched packet that becomes unnecessary
remains referenced as `status: cancelled` with an accepted review explaining
why; never delete it or leave it unreferenced to hide work.

Qualify every leaf coverage item in packet frontmatter as
`<repository>#<exact-path-or-id>`. The close gate resolves files, communities,
and surfaces against the frozen ledgers and resolves raw case IDs against the
parent reconstruction. An unqualified, out-of-scope, or merely guessed item
does not satisfy assignment accounting. The assigned slice is an ownership
contract, not a search wall: follow relevant callers, callees, contracts, and
cross-repository links, then record every material expansion and why it was
needed. `result.evidence_refs` accepts only receipt IDs produced for that
worker by a pinned read; prose paths and invented references are rejected.

Every escalation answers one concrete attempt. Material `explored_context`,
`result.authority_questions`, contradictions, negative claims, unexplained
results, and review rework require their matching current-attempt response. A
`new-workstream` target must still be planned, belong to a later wave, and name
the originating packet as a dependency. Every review remains in
`review_history`; accepting a retry never erases the review that returned it.

Version 2 workstreams created by an earlier workflow remain valid under their
original lifecycle and may be resumed without invented routing metadata. Apply
adaptive escalation only to new version 3 packets.

Run bounded waves:

1. **Map:** reconcile the Git inventory, Graphify structure, runtime surfaces,
   current knowledge, and approved optional-input frontier.
2. **Breadth:** dispatch independent repository, structural, and raw workstreams.
3. **Fan-in:** review every packet, update owning dossiers and coverage, record
   cross-project discoveries, and expose gaps without smoothing conflicts.
4. **Depth:** dispatch only the cross-repository, historical, contradiction, or
   omission work now justified by evidence.
5. **Synthesis:** one orchestrator constructs whole-project candidates and
   records a claim-to-evidence and contradiction audit.
6. **Independent review:** a fresh read-only critic checks coverage omissions,
   unsupported claims, hidden conflicts, invalid negative claims, and unjustified
   `structural-only` or `irrelevant` states. Reopen bounded workstreams for real
   gaps; do not ask the critic to rewrite its own target. This final whole-case
   critic returns a read-only verdict; the orchestrator attributes and records
   it in `orchestration.independent_review`, not as a normal workstream, so the
   critic remains outside the worker set it audits. Route an agent or
   separate-session critic as `review` / `deep` and record its routing reason,
   effective host, run ID, model, and reasoning effort.

Use per-resource write barriers during fan-out: never overlap worker and
orchestrator Markdown edits to the same intake case or packet. The orchestrator
may validate a submitted packet while unrelated workers remain read-only, but
must wait for every wave packet to be accepted, returned, blocked, or
review-cancelled before final shared dossier, parent-case, candidate, or curated
knowledge synthesis. CLI receipt mutations are locked; normal Markdown edits
are not.

If the host cannot supply a fresh critic, stop before completed close and ask
the maintainer for review or continue in a fresh session. Record actual
execution; never claim a worker or independent review that did not occur.

## Analyze every repository

For each dossier, either the orchestrator works serially or it reviews and
integrates accepted worker packets. In both modes:

1. Invoke `analyze-with-graphify`, which must load the official native
   `graphify` skill in the current session.
2. Run `wfctl knowledge reconstruct coverage <case-id> --repository
   <repository-id>`. Treat its Git manifest as the enumeration authority:
   every tracked file is present even when Graphify cannot parse it. When the
   human view truncates a long outstanding list, rerun with `--json`; it
   returns every pending or blocked file, community, and surface.
3. Query the graph for repository purpose, entrypoints, every listed
   community, boundaries, integrations, data/state/control flow, persistence,
   contracts, invariants, failures, tests, and runtime surfaces. A Graphify
   community is a technical cluster, not automatically an Area or capability.
4. Record every material Graphify query in `graphify_queries`. Workers record
   proposed dispositions in their own packet; the orchestrator alone applies
   each reviewed community disposition through the CLI:

   ```sh
   wfctl knowledge reconstruct community <case-id> <community-id> \
     --repository <repository-id> \
     --status inspected \
     --query "<material Graphify query>" \
     --note "<product mapping, technical role, or explicit no-mapping result>"
   ```

   `structural-only` and `irrelevant` require an explanation. `pending` and
   `blocked` prevent completed close.
5. Explore actual source, tests, contracts, configuration, product data, and
   repository documentation with Graphify and any safe read-only tools. This
   exploration is deliberately unrestricted by packet boundaries. Before using
   a source file in a final claim or marking it fully inspected, create bounded
   reads from the pinned commit. Use the exact packet owner as `--by` so the
   receipt can satisfy that workstream's evidence contract:

   ```sh
   wfctl knowledge reconstruct read <case-id> <path> \
     --repository <repository-id> \
     --start <first-line> --end <last-line> \
     --by workflow-agent/<workstream-id>
   ```

   Cite the returned receipt ID in `result.evidence_refs`. Continue until the
   command reports `complete` whenever the file itself is claimed as fully
   inspected. This command records the exact blob and line ranges; a Graphify
   result, search snippet, editor open, or dossier statement does not create a
   read receipt. Read every material condition, branch, exception, and test body
   rather than only headers.
6. After reviewing worker evidence, classify or disposition remaining manifest
   entries in explicit batches:

   ```sh
   wfctl knowledge reconstruct files <case-id> \
     --repository <repository-id> \
     --path "<exact path, directory, or glob>" \
     --category generated \
     --status structural-only \
     --reason "<why byte-level semantic reading is not required>"
   ```

   Every file needs a category and final status. Textual product-bearing
   categories (`source`, `test`, `contract`, `configuration`, `product-data`,
   and `documentation`) cannot finish as `structural-only`. `irrelevant`
   remains available only with a scoped reason. Never bulk-disposition an
   unfamiliar directory merely to clear the gate.
7. Record every discovered entrypoint, runtime surface, and boundary:

   ```sh
   wfctl knowledge reconstruct surface <case-id> <stable-surface-id> \
     --repository <repository-id> \
     --kind entrypoint \
     --description "<externally meaningful surface>" \
     --path <manifest-path> \
     --status inspected \
     --note "<what direct inspection established>"

   wfctl knowledge reconstruct surfaces <case-id> \
     --repository <repository-id> \
     --status reviewed \
     --note "<whole-repository surface omission audit>"
   ```

   Coverage starts with conservative `auto-*` candidates derived from tracked
   paths. Inspect each one and either replace/confirm it with the real surface
   record or mark it `irrelevant` with a specific reason. Auto-discovery is a
   review queue, never evidence that the surface exists semantically.

   An empty surface list is valid only after an explicit reviewed or
   `not-relevant` explanation. Do not leave a surface only in dossier prose.
8. Complete every dossier coverage dimension. Use `not-relevant` only with an
   explanation; never convert a missing graph edge into proof of absence.
9. Inspect Git history for meaningful evolution. Record `not-available` when
   the clone is shallow or history is insufficient. Do not invent chronology
   or rationale from commit order.
10. Add atomic candidates to the parent case and link each dossier or
   structured surface to those
   candidate IDs through its structured `candidate_ids` field.

While inspecting a repository, immediately add a dossier `DISC-NNN` entry
whenever losing the information could change a later conclusion, omit a
condition, repeat material investigation, or send the next agent down the
wrong path. Record the observation, exact evidence boundary, implication,
scope, and disposition through the required `Observation`, `Evidence`,
`Implication`, `Scope`, and `Disposition` fields. Move or restate it in the
parent case when it changes cross-repository reconciliation. Do not wait for a
checkpoint and do not use the ledger as a diary of ordinary commands.

Before leaving a repository, rerun `coverage`. Explain every Graphify-unindexed
text file and every `unclassified`, `pending`, or `blocked` entry. A confirmed
`source-code` candidate must cite a path whose full pinned read is complete.
The ledger guarantees accounting and delivery of bytes to the agent; it does
not prove correct semantic understanding, so the dossier and maintainer review
remain mandatory.

Refresh the reconstruction frontier before switching repositories and after
every wave. A new worker or clean session must not mistake one submitted packet
or local dossier completion for whole-project completion.

Do not edit source code from the knowledge repository. If analysis discovers a
needed change, identify the owning leaf and open normal significant work there.

## Reconcile the source lanes

1. Use QMD against `knowledge` to read the current project map, if any.
2. Review optional inputs explicitly:
   - `raw`: follow only the approved `all` or `selected` scope. Start every
     reconstruction-owned case with `wfctl knowledge case start ...
     --reconstruction <case-id>` so the CLI rejects intake before approval,
     scope escape, or baseline drift. Record every completed child case ID.
     When marked `reviewed`, the approved frozen scope must contain no
     `unseen`, `changed`, `active`, `blocked`, or `unresolved` blob and no
     uncommitted change to a selected baseline path. New raw added after that
     snapshot belongs to a later case. `excluded` raw starts no child cases;
   - `documentation`: treat prose as a claim until its authority is known;
   - `change_records`: qualify each claim by outcome, verification, and review.
3. Never cite a raw or intake path as evidence. Raw agreement does not make a
   claim true.
4. For multiple leaves, reconstruct each capability or flow once across all
   relevant dossiers. Trace cross-repository contracts and flows in both
   directions, then reconcile every relevant repository's observations into
   atomic whole-project candidates. Repository roles are discovered from
   evidence, never assumed from names or a built-in topology. Never promote one
   leaf's partial view as the whole capability. Record unowned behavior,
   mismatched schemas, and incomplete implementations.
5. Classify each candidate with the shared adjudicated-claim model:
   - `claim_class` and `semantic_role`;
   - `intent_state`: what the project currently intends;
   - `delivery_state`: what implementation currently delivers;
   - `alignment`: whether those two are known to agree.
   - `temporal`: capture, assertion, and effective time when established;
   - `relations`: explicit supersession, contradiction, refinement,
     implementation, and derivation links;
   - `routing`: current knowledge, history, change, or case-only.
   Use cross-case references such as
   `intake:<case-id>#<candidate-id>` when a reconstruction candidate resolves,
   refines, or supersedes a raw-intake candidate. Capture order is not truth.
6. Keep `proposed` intent outside current knowledge. Mark it `deferred` or
   `rejected`, or run a normal decision/change workflow when the maintainer
   wants to adopt it.
7. Ask the maintainer to adjudicate product meaning, rationale, ownership,
   accepted architecture, and ambiguous chronology. Present claim, evidence,
   conflicts, recommendation, and requested decision.

## Maintain the record during discussion

The reconstruction case and repository dossiers are the session's durable
working memory, and accepted workstream packets preserve isolated worker
findings. Stable `knowledge/` pages are not scratchpads. After every
material maintainer turn, update candidate state, decisions, contradictions,
promotion map, and affected discovery entries before continuing. Refresh the
checkpoint after those semantic and coverage updates, after each repository
pass, before compaction, and before ending a session:

```sh
wfctl knowledge reconstruct checkpoint <case-id> \
  --actor workflow-agent/1 \
  --stage repository-analysis \
  --state "<concise current frontier>" \
  --last "<last material result>" \
  --next "<one executable next action>"
```

Use `--status blocked --blocker "..."` when continuation needs missing
authority or an unavailable source. The checkpoint is a resumable pointer,
not the evidence, decision history, or discovery ledger. Its basis hash covers
the case, every dossier, and every coverage ledger; any later edit makes it
stale until refreshed.

After compaction or interruption:

1. run `wfctl knowledge reconstruct context --json` without an ID unless the
   active owner is already unambiguous;
2. read the entire case, every dossier, and local binding returned by the
   command, including their final lines and every discovery entry;
3. use the returned complete coverage frontier for exact pending communities,
   files, read ranges, and surfaces;
4. read every returned `reconstruction-workstream-full-read` packet completely;
5. if the checkpoint is stale, treat its next action as a hint only, rebuild
   the frontier from the full records, and refresh it before continuing;
6. confirm the exact bound checkouts and resume from durable candidates,
   discoveries, coverage, and maintainer decisions rather than chat memory.

Then render the current reconstruction frontier before continuing analysis.

## Promote and close

1. Invoke `curate-project-knowledge`.
2. Create the smallest coherent project map: vision and repository ownership,
   then Areas and only the capabilities, flows, rules, implementation,
   decisions, and uncertainties supported now.
3. Route stakeholder-facing concepts through `curate-product-knowledge` and
   technical realization through `curate-engineering-knowledge`. Product
   concepts declare reviewed intent, delivery, and alignment state; engineering
   concepts link that meaning rather than deriving it from code.
4. Give implementation claims pinned source-code evidence. Give reconstructed
   history pinned version-control evidence. Give normative claims an explicit
   maintainer decision recorded by candidate ID in this case.
5. Put every confirmed current/history candidate in
   `routing.destinations`, reconcile those knowledge destinations with
   `promotion.concepts`, and leave no unresolved candidate. Proposed work
   routes to `changes/`; rejected material stays case-only. Link every
   candidate from at least one dossier, structured surface, or supplemental
   input. `promoted_to` remains accepted only for legacy reconstruction v3
   records; do not author it in new cases.
6. Draft the concepts, invoke `verify-knowledge-quality` for every material
   document, record the complete promotion map and maintainer approval, then
   compute a fresh content hash for each stable concept:

   ```sh
   wfctl knowledge hash --concept knowledge/.../<concept>.md
   wfctl knowledge validate
   wfctl knowledge build
   qmd update
   wfctl knowledge reconstruct check <case-id>
   ```

   The build also refreshes the disposable cross-case claim ledger and rejects
   missing, non-reciprocal, or cyclic explicit claim relations. Knowledge
   validation may use a completion-ready active reconstruction
   receipt while `promotion.validation` is still pending. Set it to `passed`
   only after validation actually succeeds, then rerun the reconstruction
   check.
7. Submit each finished packet with `wfctl knowledge reconstruct workstream
   submit` and have a different actor run `wfctl knowledge reconstruct
   workstream review`. Before acceptance, respond to contradictions,
   insufficient evidence, negative claims, or review rework with `wfctl
   knowledge reconstruct workstream escalate`; choose a stronger profile, a
   narrower follow-up workstream, maintainer review, retained uncertainty, or
   an explicitly justified same-profile correction. Mark orchestration complete
   only after every workstream
   is accepted or has
   a review-approved `cancelled` disposition, blocked work is either resolved
   or represented by an honest partial outcome, the
   orchestrator's synthesis audit passes, and a distinct fresh actor records
   the independent review. Record `assurance` as `independent-agent`,
   `separate-session`, or `maintainer`, plus the actual host run ID when
   applicable. `wfctl knowledge reconstruct check` rejects missing,
   unfinished, unreviewed, unreferenced, or path-leaking workstreams.
8. Present the maintainer a baseline review packet: current intended product,
   observed implementation, alignment and drift, reconstructed evolution with
   confidence limits, unknowns, and the human reading path.
   Include the final frontier and require every requested completion blocker
   to be zero or explicitly represented by an honest partial outcome.
9. Record explicit `maintainer_review` approval, then close:

   ```sh
   wfctl knowledge reconstruct close <case-id> --outcome completed
   ```

Use `partial` or `abandoned` honestly when the baseline cannot be completed.
Never relax evidence or silently convert uncertainty into current truth.
