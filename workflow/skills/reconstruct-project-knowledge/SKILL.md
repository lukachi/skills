---
name: reconstruct-project-knowledge
description: Build or audit a trustworthy project-knowledge baseline from one or more existing leaf source repositories, Git history, current curated knowledge, and optional documentation, change records, or raw candidates. Use when wfctl joins an established or legacy project; when knowledge is missing, partial, stale, or based mainly on old notes; when the maintainer asks what the whole project actually does; when several repositories must be mapped into Areas, capabilities, flows, ownership, contracts, implementation, and decision history; or when current product intent must be separated from observed delivery and drift. This is a bounded knowledge-repository operation, not the per-task leaf workflow.
---

# Reconstruct Project Knowledge

Build a reviewed current baseline without pretending that any one source
contains the whole project. Source code establishes observed implementation;
the maintainer establishes intended meaning; Git establishes only the history
it actually retains; raw material supplies candidates, never evidence.

Read [the reconstruction model](references/reconstruction-model.md) before the
first baseline or any multi-repository audit.

## Command and interaction ownership

Accept requests such as “reconstruct this project,” “build the baseline,” or
“audit current knowledge” without requiring CLI vocabulary. Own all source
registry, reconstruction, Graphify, QMD, case-file, validation, and close
operations. Never ask the maintainer to run a command, copy a case ID, edit a
dossier, or locate a generated binding. Ask only for a missing path, product
authority, review, or a source choice that cannot be resolved safely.

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
   selection is missing or unavailable:

   ```sh
   wfctl knowledge reconstruct start <slug> \
     --title "<bounded baseline or audit>" \
     --mode baseline
   ```

   Repeated `--leaf` is an explicit checkout override and may name a known
   alternative worktree without changing the stored default selection. A baseline
   override must still include every registered repository. An `audit` may
   deliberately select a subset, but its title and scope must say so.
7. Run `wfctl knowledge reconstruct check <case-id>` and read the complete
   `case.md` plus every generated repository dossier.
8. Treat `.workflow/current/reconstruction/<case-id>.json` as the local
   checkout binding. Never copy its absolute paths into the durable case,
   dossiers, or curated knowledge.
9. Stop if the binding, worktree identity, commit, clean state, or Graphify
   graph drifts. Restart or explicitly re-scope; never guess which checkout to
   inspect.

The CLI updates and validates Graphify in each exact checkout before creating
the case. The durable case stores repository identity, branch, commit,
checkout label, and worktree ID, but not a machine-local path.

## Analyze every repository

For each dossier:

1. Invoke `analyze-with-graphify`, which must load the official native
   `graphify` skill in the current session.
2. Query the graph for repository purpose, entrypoints, major communities,
   boundaries, integrations, data/state/control flow, persistence, contracts,
   invariants, failures, tests, and runtime surfaces.
3. Record every material Graphify query in `graphify_queries`.
4. Open the actual source and tests reached through the graph at the pinned
   commit. Use text search only as supplementary exact-token coverage.
5. Complete every dossier coverage dimension. Use `not-relevant` only with an
   explanation; never convert a missing graph edge into proof of absence.
6. Inspect Git history for meaningful evolution. Record `not-available` when
   the clone is shallow or history is insufficient. Do not invent chronology
   or rationale from commit order.
7. Add atomic candidates to the parent case and link each dossier to those
   candidate IDs through its structured `candidate_ids` field.

Do not edit source code from the knowledge repository. If analysis discovers a
needed change, identify the owning leaf and open normal significant work there.

## Reconcile the source lanes

1. Use QMD against `knowledge` to read the current project map, if any.
2. Review optional inputs explicitly:
   - `raw`: process relevant material through bounded raw-intake cases first
     and record every completed case ID;
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
5. Classify each candidate with three independent axes:
   - `intent_state`: what the project currently intends;
   - `delivery_state`: what implementation currently delivers;
   - `alignment`: whether those two are known to agree.
6. Keep `proposed` intent outside current knowledge. Mark it `deferred` or
   `rejected`, or run a normal decision/change workflow when the maintainer
   wants to adopt it.
7. Ask the maintainer to adjudicate product meaning, rationale, ownership,
   accepted architecture, and ambiguous chronology. Present claim, evidence,
   conflicts, recommendation, and requested decision.

## Maintain the record during discussion

The reconstruction case is the session's durable working memory. After every
material maintainer turn, update candidate state, decisions, contradictions,
promotion map, and next action before continuing. Do not wait until the end.

After compaction or interruption:

1. run `wfctl knowledge reconstruct check <case-id>`;
2. read the entire case and all dossiers;
3. confirm the exact bound checkouts;
4. resume from recorded unresolved candidates and next actions, not chat
   memory.

## Promote and close

1. Invoke `curate-project-knowledge`.
2. Create the smallest coherent project map: vision and repository ownership,
   then Areas and only the capabilities, flows, rules, implementation,
   decisions, and uncertainties supported now.
3. Keep product-facing meaning separate from technical realization. Product
   concepts declare reviewed intent, delivery, and alignment state.
4. Give implementation claims pinned source-code evidence. Give reconstructed
   history pinned version-control evidence. Give normative claims an explicit
   maintainer decision recorded by candidate ID in this case.
5. Put every confirmed candidate in `promoted_to`, reconcile it with
   `promotion.concepts`, and leave no unresolved candidate. Link every
   candidate from at least one dossier `candidate_ids` list or one
   supplemental input `candidate_ids` list.
6. Draft the concepts, record the complete promotion map and maintainer
   approval, then compute a fresh content hash for each stable concept:

   ```sh
   wfctl knowledge hash --concept knowledge/.../<concept>.md
   wfctl knowledge validate
   wfctl knowledge build
   qmd update
   wfctl knowledge reconstruct check <case-id>
   ```

   Knowledge validation may use a completion-ready active reconstruction
   receipt while `promotion.validation` is still pending. Set it to `passed`
   only after validation actually succeeds, then rerun the reconstruction
   check.
7. Present the maintainer a baseline review packet: current intended product,
   observed implementation, alignment and drift, reconstructed evolution with
   confidence limits, unknowns, and the human reading path.
8. Record explicit `maintainer_review` approval, then close:

   ```sh
   wfctl knowledge reconstruct close <case-id> --outcome completed
   ```

Use `partial` or `abandoned` honestly when the baseline cannot be completed.
Never relax evidence or silently convert uncertainty into current truth.
