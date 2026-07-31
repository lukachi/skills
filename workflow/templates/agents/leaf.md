
This is a leaf repository. Its project knowledge is located at `{{KNOWLEDGE_PATH}}`.

Classify work with the installed `manage-project-work` skill before changing
implementation state. For significant work, create the central bundle first,
then invoke `analyze-with-graphify` and `align-project-knowledge` before
implementation.

If a consequential initiative has several unresolved dependent product or
architecture choices and cannot yet support honest acceptance criteria,
recommend `shape-project-direction`. Start its Wayfinder map only after
maintainer agreement, and do not edit code until the map has been synthesized
into a reviewed bounded specification.

For read-only questions about what the project is, what it currently provides,
or how one product direction works, invoke `explore-project-knowledge` against
the configured knowledge repository. Do not require the user to name an Area,
capability, or knowledge path. A product explanation alone does not create a
work record or authorize code changes.

Run QMD from the configured knowledge repository for knowledge retrieval. Do
not query `raw/` or `intake/` to fill gaps in current project truth.

After `wfctl work start`, run `wfctl work status <id>` and the stage-specific
`wfctl work context <id>` before any code edit,
after changing directories, after resuming, and before verification or close.
Use only the reported `Code roots` for their respective code operations and
the reported `Spec` only for record updates. Refresh the owning change or issue
checkpoint after every material edit. A worktree is a distinct
code root; never infer another checkout from repository name, branch, or spec
location. A branch/worktree mismatch requires explicit `wfctl work rebind`
before any code edit.

Keep one canonical change bundle in the knowledge repository. `change.md` owns
the parent contract, optional `map.md` owns Wayfinder lineage, and `issues/`
owns bounded progress. Update it after every material maintainer turn, claim
one frontier issue from the exact leaf before implementation, then refresh that
record's checkpoint last. Verify the whole bundle with `verify-project-work`,
promote durable truth separately, then archive the directory intact.

During promotion, keep linked product and engineering views separate. Invoke
`curate-product-knowledge` for stakeholder-facing behavior,
`curate-engineering-knowledge` for technical realization, and
`verify-knowledge-quality` before a materially changed concept becomes stable.
The quality gate keeps authority/truth and reader communication as independent
passes.
