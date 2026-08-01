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

Read [the adaptive execution plan](references/adaptive-execution.md) before
dispatching anything, and [the routing contract](references/agent-routing.md)
before choosing a worker profile.

- Inspect the complete frozen frontier first. Choose `single-agent` for small,
  tightly sequential, or shared-context work, or when the host has no safe
  subagent facility; choose `orchestrator-workers` only for genuinely
  independent read-heavy axes. Agent count is never a goal.
- Record `max_parallel`, the total workstream cap, the retry cap, and the
  reason in `case.md` before dispatch.
- Partition by independently reviewable semantic outcome, never by alphabetical
  file range. One repository's worker never defines whole-project meaning.
- Register every research worker as a durable packet, give it exact roots and
  pinned identities, and treat its result as untrusted until you check its
  receipts.
- Run bounded waves: map, breadth, fan-in, evidence-driven depth, synthesis,
  and a fresh independent review that is not one of the workers it audits.
- Record what actually happened. Never claim a worker, profile, or independent
  review that did not occur.

## Analyze every repository

Read [the repository analysis procedure](references/repository-analysis.md)
before the first repository pass and whenever a disposition must be recorded.

- Invoke `analyze-with-graphify`, then treat the CLI coverage ledger's Git
  manifest as the enumeration authority; use `--json` when the human view
  truncates.
- Every tracked file needs a category and a final status. Product-bearing text
  cannot finish as `structural-only`, and `irrelevant` needs a scoped reason.
- Every Graphify community and every discovered entrypoint or runtime surface
  needs a reviewed disposition and a note. Auto-discovered candidates are a
  review queue, never evidence.
- Only `wfctl knowledge reconstruct read` creates the pinned blob-and-line
  receipt that a fully inspected file or a confirmed source-code claim requires.
- Record consequential findings in the owning dossier as `DISC-NNN` immediately,
  with Observation, Evidence, Implication, Scope, and Disposition.
- Rerun `coverage` before leaving a repository and refresh the frontier before
  switching. Never edit `*.coverage.json` by hand, and never edit source from
  the knowledge repository.

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
