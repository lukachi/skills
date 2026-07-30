---
name: process-raw-intake
description: Inventory and process continuous untrusted raw intake through Git blob identity, bounded review cases, QMD-assisted discovery, complete source reading, atomic claim classification, temporal and supersession analysis, authoritative verification, durable routing, omission probes, and maintainer adjudication. Use after the maintainer explicitly asks to process new or changed raw material, accepts a proposed intake batch, or an approved reconstruction scope requires its frozen raw generation to converge. Handle ideas, chat exports, research, specs, historical files, chronology, and conflicts without treating raw text as truth. Do not start merely because raw files exist.
---

# Process Raw Intake

Turn continuous raw dumps into reviewed candidate claims. Do not promote text
because it sounds plausible, is newer, or agrees with another raw file.

## Trust boundary

- `raw/` is untrusted, append-oriented input. It may contain lies, stale plans,
  abandoned intent, generated guesses, and contradictions. A frozen Git blob
  is immutable case input even if the same raw path later receives a new blob.
- `intake/cases/active/` holds Git-frozen review ledgers. These may locate
  `raw/`, but remain operational records rather than evidence.
- `knowledge/` may receive only claims independently verified against the
  applicable authority and reviewed when required.

Never add a raw path, raw hash, raw footnote, or raw file link to an OKF
concept. Raw material can tell you what to investigate; it cannot prove the
answer.

Read [the intake model](references/intake-model.md) before the first intake
pass.

## Command and interaction ownership

Accept “process raw,” a topic, or a newly added dump as sufficient user input.
Run inventory, Git inspection, QMD retrieval, case creation and marking,
verification, promotion, and close commands yourself. Maintain the case files
yourself. Do not ask the maintainer for raw pathspecs, case IDs, commands, or
YAML edits. Propose human-readable thematic batches and ask only for batch
approval, authority, chronology, or product meaning that evidence cannot
establish.

## Show the intake frontier

At the start of every run and after every completed or blocked batch, present a
compact human-readable frontier:

- inventory generation or frozen reconstruction baseline;
- counts for unseen, changed, active, reviewed, blocked, and unresolved blobs;
- active case themes and their blockers;
- the next recommended bounded batch and why it has priority;
- the exact maintainer decisions currently needed;
- what must become zero before the requested intake scope is complete.

Build this from `wfctl knowledge raw inventory`, active cases, and direct
inspection. Do not infer the contents of unseen files from their names. The
frontier is a navigation summary, not a second ledger; never persist competing
counts by hand.

## Handle common intake cases

- **Routine idea dump:** inventory only unseen or changed blobs, propose a
  small thematic case, and leave unrelated raw material untouched.
- **Initial historical dump:** map topics with QMD, sample enough to propose
  bounded batches, then process one accepted batch at a time. Never claim to
  understand the whole archive from retrieval alone.
- **Reconstruction snapshot:** use the exact raw baseline recorded by the
  parent reconstruction. Process bounded cases against that commit until its
  inventory contains zero unseen, changed, active, blocked, or unresolved
  blobs. Raw committed later belongs to the next intake generation.
- **A file changed at the same path:** treat its new Git blob as new input.
  Preserve the earlier case and compare versions only when chronology matters.
- **Topic-focused request:** retrieve broadly enough to find aliases and
  contradictions, but freeze only the accepted files that answer the bounded
  question.
- **Conflicting chronology or intent:** preserve each atomic candidate and ask
  the maintainer with an adjudication packet. Do not select the newest prose by
  default.
- **Unreadable, binary, or unsupported input:** mark it `unreadable`, report
  what tool or human input is missing, and keep the case partial.
- **No useful claims:** read the entire frozen file, mark
  `no-relevant-claims`, and record why so it is not rediscovered as unfinished.
- **Mixed verified and unresolved findings:** promote only independently
  confirmed candidates; close the case as `partial` when unresolved material
  remains.

## Inventory and propose bounded work

1. Work from the knowledge repository root. Read `.workflow/config.json` and
   verify that `.qmd/index.yml` exists.
2. Inspect the current session skill catalog and require the official native
   `qmd` skill. Invoke it before retrieval. If the skill is absent, stop and
   invoke `setup-workflow-environment` to repair or reinstall the selected
   skills, then ask only for the unavoidable agent-session restart.
3. Run `qmd status`, or the QMD MCP `status` tool when it is exposed in the
   current session. If QMD is unavailable or older than `2.5.3`, invoke the
   setup skill, request install authority, and perform the installation
   yourself. Do not replace it with a new indexer.
4. Run `wfctl knowledge raw inventory`. It compares committed `raw/` blobs with
   active and archived cases. It does not interpret Markdown. When a parent
   reconstruction supplies a frozen raw baseline, pass `--baseline
   <full-commit>` on every inventory and case-start command for that run.
5. Report uncommitted paths and ask the maintainer for normal authorization to
   preserve them in Git. Intake cannot freeze untracked or dirty files.
6. Run `qmd update` and, when semantic retrieval is needed, ask for model
   download/compute authority before `qmd pull` or `qmd embed -c raw`.
   Use QMD to build a thematic map of `unseen` and `changed` blobs.
7. Propose small review batches with topic, file count, why the files belong
   together, and known uncertainty. The maintainer should not have to know raw
   paths in advance. Do not freeze all of `raw/` merely because the user asked
   to "process raw".
8. After the maintainer accepts a batch, freeze its exact paths:

   ```sh
   wfctl knowledge case start <slug> \
     --title "<bounded question>" \
     --path raw/<path> \
     --baseline HEAD
   ```

   Repeat `--path` as needed. The generated
   [case](assets/intake-case.md) records every Git tree entry and its exact blob
   ID. Do not edit generated source identity fields.

## Retrieve and read

1. Search raw explicitly with `qmd search ... -c raw` for exact terms and a
   structured `qmd query` with authored `intent:`, `lex:`, `vec:`, and
   optional `hyde:` fields for hybrid discovery. Raw is excluded from
   default queries intentionally. With QMD MCP, pass `collections: ["raw"]`;
   do not rely on an unscoped query.
2. Use returned QMD document IDs or URIs with `qmd get` to inspect relevant
   ranges and follow aliases, terminology, and contradictions.
3. Then read every file listed under case `sources` completely, in bounded
   chunks when necessary. Search hits and snippets do not establish coverage.
4. For each file, run:

   ```sh
   wfctl knowledge case mark <case-id> raw/<path> \
     --status reviewed \
     --candidate <candidate-id> \
     --note "<what the complete file contributed>"
   ```

   Use `no-relevant-claims` only after complete review. Use
   `needs-maintainer` or `unreadable` when honest completion is blocked.
5. Add every material statement as an atomic `candidate_claims` entry. Never
   classify a whole file as “old,” “current,” “true,” or “a spec.” One file can
   contain several claims with different roles and states.
6. For every candidate, record:
   - `claim_class`: which authority can establish it;
   - `semantic_role`: idea, requirement, decision, design, plan, status,
     observation, or outcome;
   - `disposition`: confirmed, rejected, deferred, or unresolved;
   - independent `intent_state`, `delivery_state`, and `alignment`;
   - `temporal.captured_at`, plus asserted/effective bounds when known;
   - explicit `relations` to claims it supersedes, contradicts, refines,
     implements, or derives from;
   - a `routing` lane and destinations.
7. Preserve conditions, exceptions, negative results, alternatives, and
   chronology rather than flattening them into one summary. Capture order and
   file modification time do not decide truth. Give rejected, deferred, or
   unresolved candidates a concrete `reason`.

If `case check` reports intake schema v3, run `wfctl knowledge case migrate
<case-id>`. Review every conservative `unknown` field against the full frozen
source, use `migration_source` only as a record of the former authority and
destinations rather than proof they remain current, correct and reroute the
claim, then run:

```sh
wfctl knowledge case migrate <case-id> --review \
  --note "<what was checked and corrected>"
```

Never sign migration review merely because the YAML parses.

## Claim adjudication

For each candidate, identify its authority class:

- product intent or domain meaning: explicit current maintainer decision;
- implementation reality: directly inspected source and tests at exact
  repository revision, plus runtime evidence when needed;
- architectural rationale, ownership, or policy: maintainer-reviewed decision
  that current code does not contradict;
- historical implementation: Git or review history plus a reviewed archived
  change;
- external fact: the primary external source.

Classify epistemic truth separately from product time:

- a raw idea can be a confirmed observation that a proposal exists while its
  `intent_state` remains `proposed`;
- current code can be confirmed implementation while product intent remains
  unknown;
- accepted intent can be absent or partial in delivery and therefore drifted;
- superseded intent and retired implementation belong to history rather than
  current truth.

For implementation claims, invoke `analyze-with-graphify` in each bound source
repository. Use Graphify to navigate relationships, then inspect the actual
source and checks. Do not build or query a Graphify graph for raw Markdown.

When chronology, intent, or authority remains ambiguous, show the maintainer a
compact packet containing the candidate, supporting and conflicting
observations, the missing fact, and a recommendation. Record their explicit
answer or keep the candidate unresolved outside `knowledge/`.

## Promotion

1. Route each candidate before authoring output:
   - `current-knowledge`: confirmed accepted current truth;
   - `history`: confirmed former truth or durable chronology;
   - `change`: a reviewed proposal or plan that is not current truth;
   - `case-only`: rejected or unresolved material.
   A rejection normally stays case-only. If the same boundary keeps returning,
   do not promote the rejected proposals. Ask whether the maintainer intends a
   durable non-goal or negative product rule. Only the explicitly accepted
   boundary may enter current knowledge through the normal decision threshold
   and curation gate.
2. Create every declared destination. A proposed idea normally becomes a
   `changes/inbox/` handoff or an active change, not a knowledge concept. For
   lightweight retained input, run from the knowledge root:

   ```sh
   wfctl work handoff <slug> --title "<proposal or finding>"
   ```

   Fill the created handoff with the reviewed proposal, its claim IDs,
   conditions, lineage, and next decision. Start project-only significant work
   with `wfctl work start` when shaping must continue.
3. Group current/history candidates into the smallest coherent concepts and
   invoke `curate-project-knowledge`. It routes product and engineering views
   to their specialized skills and invokes `verify-knowledge-quality`. Every
   knowledge-routed candidate must declare independent `evidence`, required
   `maintainer_decision`, and every destination under `routing.destinations`.
4. Require claim-level authoritative sources and explicit trust metadata.
5. Require the union of current/history destinations to equal
   `promotion.concepts`. `not-needed` is invalid while any candidate routes to
   knowledge. Compute stable concept content hashes, run
   `wfctl knowledge validate`, and record `passed` only after it succeeds.
6. Perform a second omission audit against every frozen source and candidate.
   Generate diagnostic questions that should recover routed facts from
   `knowledge/` or `changes/` without consulting `raw/` or the case. Run the
   relevant scoped QMD query, read the returned durable files, compare the
   answer with the expected candidates, and record each result:

   ```sh
   wfctl knowledge case probe <case-id> <probe-id> \
     --question "<diagnostic question>" \
     --candidate <candidate-id> \
     --status passed \
     --answer "<answer found in durable outputs>" \
     --output <knowledge-or-change-path>
   ```

   Cover every non-rejected candidate. A failed probe creates repair work and
   blocks completion. When one probe covers several candidates, inspect at
   least one declared routed output for each candidate. Use `waived` only with
   explicit human actor and rationale.
7. Record non-empty audit notes and `omission_audit.result: passed`, then run
   `wfctl knowledge case check <case-id>`.
8. Run `wfctl knowledge build`. It refreshes both the curated Markdown graph
   and the disposable cross-case claim ledger. Resolve missing, non-reciprocal,
   or cyclic claim relations rather than deleting them to satisfy the gate.
9. Close the honest result with
   `wfctl knowledge case close <case-id> --outcome completed|partial|abandoned`.
   Completed close fails if the Git scope changed, a frozen source is missing,
   a review is pending or blocked, candidate linkage is incomplete, or
   promotion validation fails. The archived case remains an operational audit
   trail, not a source for current knowledge.
10. Run `wfctl knowledge raw inventory` again. A later change to the same raw
    path has a different blob ID and returns as `changed`; never mutate the
    earlier case or mark a path permanently processed.
11. Refresh the human-readable intake frontier and state the next recommended
    batch, blocker, or honest completion condition.

For a reconstruction snapshot, repeat bounded cases until the frozen-baseline
inventory reports only `reviewed` or `no-relevant-claims` entries. Do not widen
the current reconstruction to raw blobs added after its recorded baseline.

Do not promote unresolved candidates into `knowledge/uncertainties/`.
Uncertainties in current knowledge are questions supported by trusted current
evidence, not a storage area for unverified raw claims.
