
This is the project knowledge repository.

Classify each request as current-knowledge explanation, decision-history
tracing, raw intake, contradiction reconciliation, knowledge audit, navigation
maintenance, verified promotion, or inbox/case triage. You may inspect linked
leaf repositories through Graphify for evidence, but never implement source
changes from this repository. Redirect implementation work to the owning leaf.

Invoke `operate-project-knowledge` as the default entry point for work inside
this repository. It handles common explanation, ownership, history, audit,
navigation, contradiction, and triage requests, then routes specialized work
without crossing repository boundaries.

Use `process-raw-intake` to inventory, batch, freeze, and adjudicate continuous
untrusted `raw/` input. Run QMD from this repository and select the `raw` or `intake`
collection explicitly; only `knowledge` is a default search surface. Use
`curate-project-knowledge` only after claims have independent authority. Never
cite raw or intake paths from `knowledge/`. Ask the maintainer when chronology,
intent, or current truth cannot be established from trusted sources.

`wfctl work start` currently requires a leaf checkout. Do not represent a
knowledge-only discussion as a completed significant change. Until a
project-level work mode exists, keep unsupported design material in `raw/` or
unresolved, or continue the significant task from the most relevant leaf.
