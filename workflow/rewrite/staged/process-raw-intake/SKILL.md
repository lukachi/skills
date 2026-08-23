---
name: process-raw-intake
description: Start or resume continuous untrusted raw intake through Git blob identity, bounded review cases, QMD-assisted discovery, complete source reading, atomic claim classification, temporal and supersession analysis, authoritative verification, durable routing, omission probes, and maintainer adjudication. Use after the maintainer explicitly asks to process new or changed raw material, accepts a proposed intake batch, an approved reconstruction scope requires its frozen raw generation to converge, or a fresh or compacted knowledge-repository session must continue an active intake case. Handle ideas, chat exports, research, specs, historical files, chronology, and conflicts without treating raw text as truth. Do not start merely because raw files exist.
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

Read [the intake model](references/intake-model.md) before the first intake pass,
and [the case that matches this run](references/cases.md) to see its shape: a
routine idea dump, an initial historical archive, a reconstruction snapshot, a
file changed at the same path, a topic-focused request, conflicting chronology,
unreadable input, a file with no useful claims, a mixed result, or a legacy case
at intake schema v3.

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
inspection. Read a file before saying what it holds; a name is a hint. The
frontier is a navigation summary, not a second ledger; never persist competing
counts by hand.

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

   For a reconstruction-owned batch, replace `HEAD` with its exact frozen
   baseline and add `--reconstruction <parent-case-id>`. Refuse to create the
   case if the parent raw scope is undecided or excluded. The maintainer
   approves themes and boundaries; the agent translates that decision into
   exact paths and operates the command.

On a fresh session, after compaction, or when the active case ID is not already
established, first run `wfctl knowledge case context --json` without an ID.
Auto-resume only the single active case. If several cases exist, use their
human titles to determine the owner and ask the maintainer when still
ambiguous; never guess from timestamps. Read the returned case file completely
through its last line before reviewing another raw source.

## Retrieve and read

1. Search raw explicitly with `qmd search ... -c raw` for exact terms and a
   structured `qmd query` with authored `intent:`, `lex:`, `vec:`, and
   optional `hyde:` fields for hybrid discovery. Raw is excluded from
   default queries intentionally. With QMD MCP, pass `collections: ["raw"]`;
   do not rely on an unscoped query.
2. Use returned QMD document IDs or URIs with `qmd get` to inspect relevant
   ranges and follow aliases, terminology, and contradictions.
3. Then read every file listed under case `sources` completely through the
   frozen-blob receipt command. Use successive bounded ranges until it reports
   `complete`; search hits, snippets, and ordinary filesystem reads do not
   establish coverage:

   ```sh
   wfctl knowledge case read <case-id> raw/<path> \
     --start <first-line> \
     --end <last-line> \
     --by workflow-agent/<reader-id>
   ```

   Omit the range on the first call to receive the first bounded chunk. The CLI
   reports the total line count and serializes concurrent receipt updates.
4. Only after the read command reports complete, record the semantic result:

   ```sh
   wfctl knowledge case mark <case-id> raw/<path> \
     --status reviewed \
     --candidate <candidate-id> \
     --note "<what the complete file contributed>"
   ```

   Use `no-relevant-claims` only after complete review. Use
   `needs-maintainer` or `unreadable` when honest completion is blocked. For a
   binary or unsupported blob, do not invent a text review; pass
   `--non-text-reason "<explicit disposition>"` to `case mark`.
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

Immediately add a case `DISC-NNN` entry when losing a review result could
change later adjudication, omit a condition or alternative, cause repeated
investigation, or route a candidate differently. Record `Observation`, exact
`Evidence` boundary, `Implication`, `Scope`, and `Disposition`. A raw path may
identify the trigger but is never authoritative evidence. This is operational
working memory, not an extra candidate list or a diary of every command.

After material source review, maintainer discussion, adjudication, routing, or
omission probing, update the semantic case first and refresh the checkpoint
last:

```sh
wfctl knowledge case checkpoint <case-id> \
  --actor workflow-agent/1 \
  --stage source-review \
  --state "<concise current frontier>" \
  --last "<last material result>" \
  --next "<one executable next action>"
```

Use `--status blocked --blocker "..."` for a genuine blocker. Before
compaction or stopping, always refresh it. If `case context` reports a stale
checkpoint, read the complete case, rebuild the frontier from the frozen
source ledger and candidates, then refresh the checkpoint; do not trust its
old next action as authority.

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
compact packet containing the candidate, the missing fact, and a recommendation.
It is maintainer-facing, so `maintainer-review` governs it. Record their explicit
answer or keep the candidate unresolved outside `knowledge/`. Where the
disagreement is about order or sequence, draw it with `show-project-work`: two
chronologies compared in prose are two things nobody can hold at once.

Re-establish the subject first, and rebuild it
from the material rather than from the candidate row: re-read the frozen sources
that mention it — every one, not only the source the candidate cites — and check
the current implementation where one exists. Then gather every candidate about
that same subject into one packet. A claim recorded atomically keeps only what
separates it from its neighbors, so a packet built directly from one asks about
a difference with no thing attached to it. Withdraw any question the material
turns out to answer, and record that it was answered.

## Promotion

1. Route each candidate before authoring output:
   - `current-knowledge`: confirmed accepted current truth;
   - `history`: confirmed former truth or durable chronology;
   - `change`: a reviewed proposal or plan with an active work owner;
   - `capture`: useful pending material that has no active or curated owner;
   - `case-only`: rejected or unresolved material.
   A rejection normally stays case-only. If the same boundary keeps returning,
   do not promote the rejected proposals. Ask whether the maintainer intends a
   durable non-goal or negative product rule. Only the explicitly accepted
   boundary may enter current knowledge through the normal decision threshold
   and curation gate.
2. Create every declared destination. Route an owned proposal to an active
   `change`; route useful but still unowned material to `capture`. Neither is a
   knowledge concept. If an intake case already has enough authority and scope
   to start significant work, start or update that change directly. Otherwise
   run from the knowledge root:

   ```sh
   wfctl work capture add <slug> --title "<proposal or finding>"
   ```

   Fill the pending capture with the reviewed proposal, its claim IDs,
   conditions, lineage, and next decision. It is still not truth. During later
   inbox triage, create the real curated or active destination first and then
   close the capture with `wfctl work capture resolve`; discard it explicitly
   when no material route survives.
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
11. Refresh the intake frontier and state the next recommended batch, blocker, or
    honest completion condition. It is maintainer-facing, so `maintainer-review`
    governs it.

For a reconstruction snapshot, repeat bounded cases until the frozen-baseline
inventory reports only `reviewed` or `no-relevant-claims` entries. Do not widen
the current reconstruction to raw blobs added after its recorded baseline.

Do not promote unresolved candidates into `knowledge/uncertainties/`.
Uncertainties in current knowledge are questions supported by trusted current
evidence, not a storage area for unverified raw claims.
