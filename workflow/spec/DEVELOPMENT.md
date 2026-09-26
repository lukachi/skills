# Development guide

This is the current source guide for `wfctl`.

## Ownership

- `src/core/voluntary-records.ts` creates and reads authoritative bundle and unit Markdown.
- `src/core/recovery-notes.ts` handles ignored, namespaced checkpoint and handoff notes.
- `src/core/cli.ts` and `flags.ts` expose explicit commands and retire the old work routes.
- `src/core/install.ts` installs the optional skill and removes only recognized older wfctl hooks on explicit init.
- `templates/skill/wfctl/SKILL.md` tells agents when to offer a record; `references/tidying.md` guides user-invoked tidying.
- `spec/ENGINE.md`, `WORK.md`, and `CLI.md` own the current behavior.

## Change discipline

Keep CLI help, command reference, installed skill, README, and active specs in agreement when behavior changes. Do not encode mandatory workflow steps in agent instructions or host hooks.

`dist/cli.js` is a committed build artifact. Editing source does not update it or any globally installed CLI. Build the local package before handing it to another repository. The retired guard and work-sequence suites have been removed; the remaining tests have not been run for this redesign. The global binary has not been replaced.

Promotion, review, and knowledge curation require their own decisions.
