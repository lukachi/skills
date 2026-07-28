---
name: process-raw-intake
description: Inventory and process continuous untrusted raw intake through Git blob identity, bounded review cases, QMD-assisted discovery, complete source reading, authoritative verification, and maintainer adjudication. Use whenever raw/ receives ideas, thoughts, chat exports, research, specs, handoffs, historical files, or changed source versions; when proposing what raw material to review next; when every in-scope raw file must be accounted for; or when chronology, intent, and conflicting claims must be resolved without treating raw text as truth.
---

# Process Raw Intake

Turn continuous raw dumps into reviewed candidate claims. Do not promote text
because it sounds plausible, is newer, or agrees with another raw file.

## Trust boundary

- `raw/` is untrusted, immutable input. It may contain lies, stale plans,
  abandoned intent, generated guesses, and contradictions.
- `intake/cases/active/` holds Git-frozen review ledgers. These may locate
  `raw/`, but remain operational records rather than evidence.
- `knowledge/` may receive only claims independently verified against the
  applicable authority and reviewed when required.

Never add a raw path, raw hash, raw footnote, or raw file link to an OKF
concept. Raw material can tell you what to investigate; it cannot prove the
answer.

Read [the intake model](references/intake-model.md) before the first intake
pass.

## Handle common intake cases

- **Routine idea dump:** inventory only unseen or changed blobs, propose a
  small thematic case, and leave unrelated raw material untouched.
- **Initial historical dump:** map topics with QMD, sample enough to propose
  bounded batches, then process one accepted batch at a time. Never claim to
  understand the whole archive from retrieval alone.
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
   ask to run `wfctl upgrade` or reinstall the selected skills, then restart
   the agent session.
3. Run `qmd status`, or the QMD MCP `status` tool when it is exposed in the
   current session. If QMD is unavailable or older than `2.5.3`, stop and ask
   to install it with `bun install -g @tobilu/qmd@2.5.3`. Do not replace it
   with a new indexer.
4. Run `wfctl knowledge raw inventory`. It compares committed `raw/` blobs with
   active and archived cases. It does not interpret Markdown.
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
5. Add every candidate as a structured `candidate_claims` entry in the case.
   Preserve conditions, exceptions, negative results, alternatives, and
   chronology rather than flattening them into one summary.

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

For implementation claims, invoke `analyze-with-graphify` in each bound source
repository. Use Graphify to navigate relationships, then inspect the actual
source and checks. Do not build or query a Graphify graph for raw Markdown.

When chronology, intent, or authority remains ambiguous, show the maintainer a
compact packet containing the candidate, supporting and conflicting
observations, the missing fact, and a recommendation. Record their explicit
answer or keep the candidate unresolved outside `knowledge/`.

## Promotion

1. Group only confirmed candidates into the smallest coherent concepts.
2. Invoke `curate-project-knowledge` to author or update those concepts.
3. Require claim-level authoritative sources and explicit trust metadata.
4. For applied promotion, run `wfctl knowledge validate` and record `passed`
   under `promotion.validation`. For `not-needed`, record `not-needed`.
5. Perform a second omission audit against every frozen source and candidate,
   then record `omission_audit.result`.
6. Run `wfctl knowledge case check <case-id>`.
7. Close the honest result with
   `wfctl knowledge case close <case-id> --outcome completed|partial|abandoned`.
   Completed close fails if the Git scope changed, a frozen source is missing,
   a review is pending or blocked, candidate linkage is incomplete, or
   promotion validation fails. The archived case remains an operational audit
   trail, not a source for current knowledge.
8. Run `wfctl knowledge raw inventory` again. A later change to the same raw
   path has a different blob ID and returns as `changed`; never mutate the
   earlier case or mark a path permanently processed.

Do not promote unresolved candidates into `knowledge/uncertainties/`.
Uncertainties in current knowledge are questions supported by trusted current
evidence, not a storage area for unverified raw claims.
