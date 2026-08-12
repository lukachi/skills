
## Leaf repository practice

The curated project knowledge for this repository is at
`{{KNOWLEDGE_PATH}}`.

At the start of significant work, the agent first creates a central bundle so
the discussion cannot disappear after compaction. It then performs Graphify
code analysis and QMD-assisted current-knowledge alignment before presenting
the framing packet. QMD runs from the configured knowledge root and searches
only its `knowledge` collection by default. At the end, you are shown the pages
the work would write into project knowledge, in full, and nothing enters until
you say so.

Describe the desired change in ordinary language. The agent owns creation,
status checks, verification, closure, and archival of the work record; you never
need its ID or commands. It asks you only for ambiguous routing, framing,
product authority, commit authorization, and what the project now says about
itself.

You may also ask read-only product questions here:

> I am new to this project. What is it for and what can it do today?

The agent reads the configured knowledge repository and progressively explains
the product without creating a work record or changing this checkout.

The canonical bundle remains under `changes/active/<change-id>/` in the
knowledge repository. `change.md` holds the parent contract, optional `map.md`
holds Wayfinder lineage, and `issues/` holds bounded work. Each active owner has
one structured checkpoint. This leaf stores
only ignored binding and claim pointers in `.workflow/current/`.

`wfctl work status` reports intentionally different paths:

- `Code roots`: one or more exact leaf checkouts or linked worktrees where
  their respective implementation may be read and modified.
- `Spec`: the parent `change.md`; stage-specific `wfctl work context` lists
  every additional map, issue, blocker, or artifact the agent must read.

The agent must never infer another checkout from repository name, branch, Git
common directory, or spec location. A worktree or branch mismatch blocks
verification and close until an explicit `wfctl work rebind`.

During discussion or investigation, every material change and every newly
learned fact whose loss could cause repeated work, a different decision,
misunderstanding, or unsafe action is written to the owning bundle record. The
record's `Discovery ledger` accepts any consequential observation with its
basis, implication, scope, and destination; it is not restricted to named
categories. The checkpoint is refreshed last. On resume, the agent discovers
the one active binding when unambiguous, inspects its checkpoint, and reads
every file and discovery entry listed by the current context rather than
relying on remembered chat.

When the completed change updates durable knowledge, review two separate
results when both changed: the stakeholder-facing product behavior and the
engineering realization. The product view should be understandable without
code; the engineering view should pin the actual implementation. A semantic
quality receipt with independent authority/truth and reader-communication
passes, plus strict structural validation, must pass before either is called
stable.
