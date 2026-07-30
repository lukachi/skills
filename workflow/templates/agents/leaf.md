
This is a leaf repository. Its project knowledge is located at `{{KNOWLEDGE_PATH}}`.

Classify work with the installed `manage-project-work` skill before changing
implementation state. For significant work, create the `shaping` record first,
then invoke `analyze-with-graphify` and `align-project-knowledge` before
implementation.

Run QMD from the configured knowledge repository for knowledge retrieval. Do
not query `raw/` or `intake/` to fill gaps in current project truth.

After `wfctl work start`, run `wfctl work status <id>` before any code edit,
after changing directories, after resuming, and before verification or close.
Use only the reported `Code roots` for their respective code operations and
the reported `Spec` only for spec/progress updates. A worktree is a distinct
code root; never infer another checkout from repository name, branch, or spec
location. A branch/worktree mismatch requires explicit `wfctl work rebind`
before any code edit.

Keep one canonical change/spec/progress file in the knowledge repository,
update it after every material maintainer turn,
verify with `verify-project-work`, promote durable truth to curated knowledge,
then archive the exact change record.

During promotion, keep linked product and engineering views separate. Invoke
`curate-product-knowledge` for stakeholder-facing behavior,
`curate-engineering-knowledge` for technical realization, and
`verify-knowledge-quality` before a materially changed concept becomes stable.
