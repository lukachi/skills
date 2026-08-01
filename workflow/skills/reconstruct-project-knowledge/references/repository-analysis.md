# Repository analysis procedure

Read this before the first repository pass in a case and whenever a
coverage, community, surface, or receipt disposition must be recorded. It
expands the `Analyze every repository` step in the skill.

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
