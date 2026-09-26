# wfctl engine contract

## Scope

This contract governs the optional change-record and agent-recovery commands. [WORK.md](WORK.md) owns bundle and unit meaning; [CLI.md](CLI.md) owns the command surface. Promotion, review, and knowledge curation are deferred.

## Ordinary work

An agent may answer, investigate, edit, and finish a user request without invoking `wfctl`. No flow, bundle, unit, namespace, recall receipt, claim, review, or hook is a prerequisite. The CLI does not classify work as significant or lightweight. It does not inject a session brief or remind agents to create records.

Agent guidance may offer a specific record at a natural pause. Only an explicit request or accepted offer authorizes a bundle or unit. The CLI requires agreement text on creation, but human judgment establishes whether an agreement actually occurred.

## Record authority

`changes/active/<bundle-id>/change.md` and its `units/<unit-id>.md` files are authoritative, editable project documents. The CLI creates them but does not regenerate them from JSON. It refuses duplicate creation. Subsequent semantic edits are made directly and reconciled through normal Git collaboration. The CLI does not claim a distributed lock over source or Markdown edits.

`.workflow/flows/<namespace>/<thread>.md` is an ignored local recovery note. Every flow command names both the manually selected namespace and the thread. No current pointer, newest-record inference, or bundle binding selects them. One update replaces the note rather than appending prior checkpoints. A local file lock and atomic replacement protect that single write.

## Installation

`wfctl init knowledge` installs the optional skill, its current command and tidying references, a short managed instruction block, and a Git ignore rule for recovery notes. It does not copy executable runtime scripts or add startup, write, or stop hooks. On an explicit update it removes recognized wfctl-owned hooks and retired installed files. Unrelated project hooks and files are untouched.

The former work, brief, checkpoint, capture, recall, guard, and hook commands are absent from the CLI. No project migration or global CLI cutover is part of this source change.
