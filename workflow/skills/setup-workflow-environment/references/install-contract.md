# Installation contract

## Instruction files

- Create `AGENTS.md` when absent.
- Update only the block between `<!-- wfctl:begin -->` and `<!-- wfctl:end -->`.
- When `CLAUDE.md` is absent, link it to `AGENTS.md`.
- When `CLAUDE.md` is a regular file, preserve it and maintain a separate marked block.
- Treat malformed, duplicated, broken, or externally targeted managed symlinks as conflicts.

## Skills

- Install canonical skills under `.agents/skills`.
- Install `setup-workflow-environment` and `analyze-with-graphify` for both profiles.
- Install `curate-project-knowledge` only for the knowledge profile.
- Install alignment, work management, and verification skills only for the leaf profile.
- Link `.claude/skills` to `../.agents/skills` when the Claude directory is absent.
- When `.claude/skills` already exists as a directory, add only missing per-skill links.

## Rules

- Install readable copies under `.workflow/rules`.
- Mirror namespaced rule files under `.claude/rules`.
- Route Codex to `.workflow/rules` through the managed `AGENTS.md` block.

## Maintainer guide

- Install `PROJECT_WORKFLOW.md` as a managed, visible root document for both
  profiles, using a managed block that preserves text outside the markers.
- Render profile-specific content and the configured knowledge path.
- Treat malformed or duplicated managed markers as a conflict.
- Use `wfctl render guide` for a maintainer-controlled merge or alternate
  destination.

## Ownership

`.workflow/state.json` records the hash of every installed owned file. Update an owned file only when the on-disk hash still matches the prior installed hash. Equal content is safe to adopt. Any other pre-existing content is a conflict.
