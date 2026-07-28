
## Leaf repository practice

The curated project knowledge for this repository is at
`{{KNOWLEDGE_PATH}}`.

At the start of significant work, the agent first creates a shaping record so
the discussion cannot disappear after compaction. It then performs Graphify
code analysis and QMD-assisted current-knowledge alignment before presenting
the framing packet. QMD runs from the configured knowledge root and searches
only its `knowledge` collection by default. At the end, review the verification
and knowledge delta before accepting completion.

The agent typically runs:

```sh
wfctl work start <slug> \
  --title "<outcome>" \
  --mode full

wfctl work status <work-id>
wfctl work verify <work-id>
wfctl work close <work-id> --outcome completed
```

The canonical change/spec/progress file remains under `changes/active/` in the
knowledge repository. This leaf stores only a pointer in `.workflow/current/`.

`wfctl work status` reports two intentionally different paths:

- `Code root`: the exact leaf checkout or linked worktree where implementation
  may be read and modified.
- `Spec`: the exact central change file where specification and progress are
  maintained.

The agent must never infer another checkout from repository name, branch, Git
common directory, or spec location. A worktree mismatch blocks verification
and close.

During discussion, every material change to requirements, constraints,
alternatives, decisions, scope, risk, questions, or next action is written to
the same spec before work continues. On resume, the agent reads that full file
rather than relying on remembered chat.
