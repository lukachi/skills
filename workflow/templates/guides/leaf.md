
## Leaf repository practice

The curated project knowledge for this repository is at
`{{KNOWLEDGE_PATH}}`.

At the start of significant work, the agent first creates a central bundle so
the discussion cannot disappear after compaction. It then performs Graphify
code analysis and QMD-assisted current-knowledge alignment before presenting
the framing packet. QMD runs from the configured knowledge root and searches
only its `knowledge` collection by default. At the end, review the verification
and knowledge delta before accepting completion.

Describe the desired change in ordinary language. The agent owns creation,
status checks, verification, and archival of the work record; you never need
its ID or commands. It asks you only for ambiguous routing, framing, product
authority, commit authorization, and completion decisions.

You may also ask read-only product questions here:

> I am new to this project. What is it for and what can it do today?

The agent reads the configured knowledge repository and progressively explains
the product without creating a work record or changing this checkout.

The canonical bundle remains under `changes/active/<change-id>/` in the
knowledge repository. `change.md` holds the parent contract, optional `map.md`
holds Wayfinder lineage, and `issues/` holds bounded progress. This leaf stores
only ignored binding and claim pointers in `.workflow/current/`.

`wfctl work status` reports intentionally different paths:

- `Code roots`: one or more exact leaf checkouts or linked worktrees where
  their respective implementation may be read and modified.
- `Spec`: the parent `change.md`; stage-specific `wfctl work context` lists
  every additional map, issue, blocker, or artifact the agent must read.

The agent must never infer another checkout from repository name, branch, Git
common directory, or spec location. A worktree or branch mismatch blocks
verification and close until an explicit `wfctl work rebind`.

During discussion, every material change to requirements, constraints,
alternatives, decisions, scope, risk, questions, or next action is written to
the bundle before work continues. On resume, the agent reads every file listed
by the current context rather than relying on remembered chat.

When the completed change updates durable knowledge, review two separate
results when both changed: the stakeholder-facing product behavior and the
engineering realization. The product view should be understandable without
code; the engineering view should pin the actual implementation. A semantic
quality receipt with independent authority/truth and reader-communication
passes, plus strict structural validation, must pass before either is called
stable.
