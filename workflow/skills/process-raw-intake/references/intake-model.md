# Continuous raw intake model

`raw/` is a permanent append-only intake surface, not a one-time migration
folder. Maintainers may keep adding ideas, conversations, research, exports,
and historical artifacts throughout the project.

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

- `confirmed`: established by the proper current authority;
- `rejected`: disproved, superseded, abandoned, or irrelevant after
  verification;
- `unresolved`: evidence and maintainer authority are still insufficient.

An unresolved candidate may exist after an individual file review, but it is
never promoted into current knowledge. Keep the case active or close it as
`partial` or `abandoned`; a case with unresolved candidates cannot close as
`completed`.

## Two audits

The first pass retrieves related material, then reads every frozen file and
extracts atomic claims. The second pass asks:

1. Does every Git-frozen source have a justified final review status?
2. Does every candidate appear in the case record?
3. Was each confirmed candidate checked against the correct authority?
4. Are contradicting candidates preserved and resolved explicitly?
5. Did any knowledge concept accidentally cite or copy raw material?
6. Did summarization erase a condition, exception, alternative, or chronology?

The Git ledger proves corpus identity and file accounting. It does not prove
that the agent understood every sentence. The explicit full-file review,
omission audit, source verification, and maintainer adjudication are the
semantic safeguards. The workflow must state this limitation honestly.

## QMD collection policy

The project-local `.qmd/index.yml` defines four collections:

- `knowledge`: included in unscoped queries;
- `changes`: excluded unless explicitly requested;
- `intake`: excluded unless explicitly requested;
- `raw`: excluded unless explicitly requested.

This prevents a normal project-knowledge query from blending current truth with
untrusted input. Run QMD from the knowledge repository root so it selects the
project-local index. Use `qmd update` after file changes and `qmd embed` when
semantic retrieval needs refreshed vectors. Never cite the QMD database,
ranking, snippet, raw file, or intake case as authority.
