# Verification status and criteria

This document describes what validation of the optional workflow must establish.

- Ordinary work can proceed without a flow, bundle, unit, namespace, startup brief, write guard, or stop guard.
- Bundle creation requires explicit agreement, creates one tracked editable Markdown document, and refuses a duplicate. A bundle may have no units.
- Unit creation requires an existing current-format bundle and explicit agreement. It writes one editable Markdown contract in that bundle and refuses a duplicate.
- Flow checkpoint and handoff require explicit namespace and thread identities. Checkpoints replace a small ignored note; two agent namespaces do not select or overwrite one another.
- Fresh installation copies no executable runtime scripts and adds no mandatory host hooks. An explicit update removes recognized wfctl-owned hooks and retired installed runtime files.
- The skill, command help, README, and active specs all describe optional use and do not route ordinary work through the retired commands.
- Tidying guidance covers `changes/` except `changes/archive/`, allows semantic bundle and unit cleanup, and brings meaning-changing decisions to the user.

The retired guard and work-sequence suites have been removed. The remaining tests have not been run for this redesign. The committed `dist/cli.js` must match source before the package is handed to another repository; the global executable is outside this package build.
