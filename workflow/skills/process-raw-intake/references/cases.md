# Intake cases, one branch at a time

The named shapes an intake run takes. Read the one that matches; the rest do
not apply to this run.

- **Routine idea dump:** inventory only unseen or changed blobs, propose a
  small thematic case, and leave unrelated raw material untouched.
- **Initial historical dump:** map topics with QMD, sample enough to propose
  bounded batches, then process one accepted batch at a time. Never claim to
  understand the whole archive from retrieval alone.
- **Reconstruction snapshot:** use the exact raw baseline and only the
  maintainer-approved `all` or `selected` scope recorded by the parent. Start
  each case with `--reconstruction <parent-case-id>` so approval time, paths,
  and baseline are checked before the case exists. Process bounded cases until
  the approved scope contains zero unseen, changed, active, blocked, or
  unresolved blobs. Raw committed later belongs to the next intake generation.
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

## A legacy case, at intake schema v3

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
