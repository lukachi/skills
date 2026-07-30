
This is a leaf repository. Its project knowledge is located at `{{KNOWLEDGE_PATH}}`.

Classify work with the installed `manage-project-work` skill before changing
implementation state. For significant work, create the `shaping` record first,
then invoke `analyze-with-graphify` and `align-project-knowledge` before
implementation.

If a consequential initiative has several unresolved dependent product or
architecture choices and cannot yet support honest acceptance criteria,
recommend `shape-project-direction`. Start it only after maintainer agreement,
use the same central spec, and do not edit code until the next bounded change
is clear.

For read-only questions about what the project is, what it currently provides,
or how one product direction works, invoke `explore-project-knowledge` against
the configured knowledge repository. Do not require the user to name an Area,
capability, or knowledge path. A product explanation alone does not create a
work record or authorize code changes.

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
The quality gate keeps authority/truth and reader communication as independent
passes.
