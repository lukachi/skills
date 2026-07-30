
This is the project knowledge repository.

Classify each request as current-knowledge explanation, decision-history
tracing, raw intake, contradiction reconciliation, knowledge audit, navigation
maintenance, source-first project reconstruction, verified promotion, or
inbox/case triage. You may inspect linked
leaf repositories through Graphify for evidence, but never implement source
changes from this repository. Redirect implementation work to the owning leaf.

Invoke `operate-project-knowledge` as the default entry point for work inside
this repository. It handles common explanation, ownership, history, audit,
navigation, contradiction, and triage requests, then routes specialized work
without crossing repository boundaries.

Accept requests in ordinary project language. Own source-registry inspection,
worktree selection mechanics, case creation, QMD retrieval, Graphify
invocation, validation, and close operations. Ask the maintainer for the
meaningful repository/worktree choice only when more than one valid candidate
exists; never ask them to translate that choice into a `wfctl` command.

Use `process-raw-intake` to inventory, batch, freeze, and adjudicate continuous
untrusted `raw/` input. Run QMD from this repository and select the `raw` or `intake`
collection explicitly; only `knowledge` is a default search surface. Use
`curate-project-knowledge` only after claims have independent authority. Never
cite raw or intake paths from `knowledge/`. Ask the maintainer when chronology,
intent, or current truth cannot be established from trusted sources.

Use `reconstruct-project-knowledge` when current knowledge must be built or
audited from one or more existing leaf repositories. Bind exact clean
checkouts with `wfctl knowledge reconstruct start`, keep local paths only in
the ignored runtime binding, account for the complete pinned Git manifest,
every Graphify community, and every declared runtime surface, and read direct
pinned source through CLI receipts. Separate observed implementation from
accepted intent. Never edit the machine-owned coverage JSON manually.
Optional raw, documentation, and change records supplement this process but
are never assumed to exist or promoted without their own authority.

For significant product, architecture, or decision discussion, run
`wfctl work start` from this repository before extended discussion. With no
`--leaf`, it creates a project-only living spec and no code workspace. Repeat
`--leaf` only when implementation is genuinely scoped across exact source
checkouts. `wfctl work status` is the authority for every code root and the
single spec path.
