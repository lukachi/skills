# Continuous raw intake model

`raw/` is a permanent, append-oriented intake surface, not a one-time migration
folder. Maintainers may keep adding ideas, conversations, research, exports,
and historical artifacts throughout the project. A changed path becomes a new
Git blob and new input without rewriting an earlier frozen case.

## Why Git coverage and retrieval are separate

Search answers "what looks related?" It cannot prove that every source file was
considered. Each intake case therefore freezes explicit `raw/` pathspecs at a
full Git commit and records every tree entry with its blob ID, type, and mode.
This is a corpus identity and file-coverage guarantee, not a semantic one.

QMD is a rebuildable retrieval cache over the working tree. The case gate
requires the selected working files to still match the frozen baseline so QMD
cannot silently search different content. BM25, embeddings, hybrid search, and
reranking remain navigation aids.

`wfctl knowledge raw inventory` compares the current Git tree with source
identities already frozen in active and archived cases. Its unit of identity is
`path + blob ID`, not the path alone. It reports:

- `unseen`: this exact path/blob has never entered a case;
- `changed`: the path was seen, but the current blob is new;
- `active`: the exact blob belongs to an active case;
- `reviewed`: a completed case fully reviewed the blob and found candidates;
- `no-relevant-claims`: a completed case fully reviewed it and found none;
- `blocked`: review requires maintainer input or the source is unreadable;
- `unresolved`: it appeared only in a partial or abandoned archived case.

Uncommitted raw paths are reported separately because no stable blob identity
exists yet. The inventory is deterministic file accounting, not a Markdown
indexer or semantic classifier.

The agent renders those counts as a short intake frontier: current generation,
active themes, blockers, maintainer decisions, next recommended batch, and the
remaining completion condition. This frontier is derived presentation, never
another source of state and never a semantic guess about unseen files.

## Source review statuses

- `pending`: full-file review has not finished.
- `reviewed`: the complete file was considered and every relevant candidate ID
  was recorded.
- `no-relevant-claims`: the complete file was considered and yielded no
  project-knowledge candidate.
- `needs-maintainer`: review found a question that cannot be resolved without
  current human authority.
- `unreadable`: the file could not be inspected safely or completely.

`wfctl knowledge case check` fails for `pending`, `needs-maintainer`,
`unreadable`, unknown statuses, missing candidate linkage, missing notes,
baseline drift, or a source list that differs from the Git tree. Close such a
case as `partial` or keep it active; do not manufacture completion.

Candidate dispositions are separate:

- `confirmed`: established by the proper authority; this may confirm that a
  proposal or former state existed without making it current product truth;
- `rejected`: disproved, superseded, abandoned, or irrelevant after
  verification;
- `deferred`: reviewed and intentionally retained as proposed work rather than
  promoted as current truth;
- `unresolved`: evidence and maintainer authority are still insufficient.

An unresolved candidate may exist after an individual file review, but it is
never promoted into current knowledge. Keep the case active or close it as
`partial` or `abandoned`; a case with unresolved candidates cannot close as
`completed`.

## Atomic claim dimensions

Classify claims, not files. A single old specification may contain a still
accepted requirement, a superseded design, an unimplemented plan, an accurate
historical observation, and a new idea. Its path, title, date, or apparent
document type cannot safely flatten those statements into one status.

Every candidate records independent dimensions:

| Dimension | Question |
| --- | --- |
| `claim_class` | Which authority can establish or reject this claim? |
| `semantic_role` | Is this an idea, requirement, decision, design, plan, status, observation, or outcome? |
| `disposition` | Has the claim been confirmed, rejected, deferred, or left unresolved? |
| `intent_state` | Is the product intent accepted, proposed, superseded, rejected, unknown, or not applicable? |
| `delivery_state` | Is delivery absent, partial, implemented, verified, retired, unknown, or not applicable? |
| `alignment` | Do accepted intent and observed delivery align, drift, remain unknown, or not apply? |
| `temporal` | When was it captured, asserted, and effective? |
| `relations` | What does it supersede, contradict, refine, implement, or derive from? |
| `routing` | Which durable lane and files preserve the adjudicated result? |

`captured_at` records intake time, not truth time. `asserted_at` records when
the source made the statement if known. `valid_from` and `valid_to` describe
the established effective interval. Unknown time stays empty; it is never
invented from file order or Git modification time.

Local relation references use a candidate ID from the same case. Cross-case
references use `intake:<case-id>#<candidate-id>` or
`reconstruction:<case-id>#<candidate-id>`. `supersedes` /
`superseded_by` and `contradicts` are reciprocal. Supersession must be acyclic.

## Routing lanes

- `current-knowledge`: confirmed current truth with accepted or
  not-applicable intent. Ideas, plans, proposed intent, rejected intent, and
  superseded intent cannot use this lane.
- `history`: confirmed former truth or durable chronology. Preserve it in
  Area decisions/evolution or another honest history concept.
- `change`: reviewed proposed work. Create a durable handoff or active change;
  do not present it as current knowledge.
- `case-only`: rejected or unresolved material. It remains discoverable in the
  operational case but produces no authoritative derivative.

Repeated rejected proposals do not become true through repetition. They may
reveal a durable negative boundary worth asking the maintainer to adopt. The
accepted boundary can then follow normal decision and curation rules; each
rejected proposal remains case-only.

Every current/history candidate carries independent authority receipts and
explicit `routing.destinations`. `promotion.concepts` must equal the union of
knowledge destinations. Change destinations must exist before completion.
This prevents confirmed current/history claims from being silently dropped
and prevents outputs from appearing without a reviewed candidate.

## Schema migration

Version 3 cases do not contain enough structure to distinguish semantic role,
intent, delivery, chronology, or routing. `wfctl knowledge case migrate`
converts their shape conservatively, sets ambiguous fields to `unknown`, and
marks migration `needs-review`. The agent must reread the frozen sources,
correct every field, and sign a review note. Migration never infers that an old
confirmed claim is current merely because it once had `promoted_to`. It keeps
the old authority and destinations under candidate `migration_source`, but
routes the candidate to `case-only` until the separate review pass classifies
and routes it honestly. The CLI refuses migration and review in one operation.

## Two audits and diagnostic probes

The first pass retrieves related material, then reads every frozen file and
extracts atomic claims. The second pass asks:

1. Does every Git-frozen source have a justified final review status?
2. Does every candidate appear in the case record?
3. Was each confirmed candidate checked against the correct authority?
4. Are contradicting candidates preserved and resolved explicitly?
5. Did any knowledge concept accidentally cite or copy raw material?
6. Did summarization erase a condition, exception, alternative, or chronology?

After routing, create omission probes from the candidate ledger. Each probe
asks a diagnostic question, lists the candidate IDs the durable outputs must
recover, and is answered by querying and reading only those `knowledge/` or
`changes/` outputs. This is a semantic test of the compiled result:

- every non-rejected candidate must be covered;
- `passed` requires an answer and inspected output paths;
- a multi-candidate passed probe must inspect at least one declared output for
  every expected candidate;
- `failed` blocks completion and should create repair work;
- `waived` requires an explicit human decision and rationale.

The probe is not proof that every possible question works. It is a targeted
omission detector that makes silent summarization loss observable.

The Git ledger proves corpus identity and file accounting. It does not prove
that the agent understood every sentence. The explicit full-file review,
omission probes, source verification, and maintainer adjudication are the
semantic safeguards.

`wfctl knowledge build` also compiles
`.workflow/current/claim-ledger.json` from intake and reconstruction cases.
The artifact contains normalized claims and explicit relation edges. It is
ignored, reproducible navigation and audit state, including case lifecycle,
review/promotion state, evidence kinds, and candidate adjudication—not
evidence, ranking, or an inferred source of truth.

## QMD collection policy

The project-local `.qmd/index.yml` defines five collections:

- `knowledge`: included in unscoped queries;
- `changes`: excluded unless explicitly requested;
- `intake`: excluded unless explicitly requested;
- `reconstruction`: excluded unless explicitly requested;
- `raw`: excluded unless explicitly requested.

This prevents a normal project-knowledge query from blending current truth with
untrusted input. Run QMD from the knowledge repository root so it selects the
project-local index. Use `qmd update` after file changes and `qmd embed` when
semantic retrieval needs refreshed vectors. Never cite the QMD database,
ranking, snippet, raw file, or intake case as authority.
