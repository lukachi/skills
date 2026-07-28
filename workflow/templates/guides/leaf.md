
## Leaf repository practice

The curated project knowledge for this repository is at
`{{KNOWLEDGE_PATH}}`.

At the start of significant work, the agent first creates a shaping record so
the discussion cannot disappear after compaction. It then performs Graphify
code analysis and QMD-assisted current-knowledge alignment before presenting
the framing packet. QMD runs from the configured knowledge root and searches
only its `knowledge` collection by default. At the end, review the verification
and knowledge delta before accepting completion.

Describe the desired change in ordinary language. The agent owns creation,
status checks, verification, and archival of the work record; you never need
its ID or commands. It asks you only for ambiguous routing, framing, product
authority, commit authorization, and completion decisions.

The canonical change/spec/progress file remains under `changes/active/` in the
knowledge repository. This leaf stores only a pointer in `.workflow/current/`.

`wfctl work status` reports intentionally different paths:

- `Code roots`: one or more exact leaf checkouts or linked worktrees where
  their respective implementation may be read and modified.
- `Spec`: the exact central change file where specification and progress are
  maintained.

The agent must never infer another checkout from repository name, branch, Git
common directory, or spec location. A worktree or branch mismatch blocks
verification and close until an explicit `wfctl work rebind`.

During discussion, every material change to requirements, constraints,
alternatives, decisions, scope, risk, questions, or next action is written to
the same spec before work continues. On resume, the agent reads that full file
rather than relying on remembered chat.
