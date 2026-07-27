---
name: setup-workflow-environment
description: Install, update, repair, or explain the shared project workflow environment in a knowledge repository or leaf source repository. Use when a maintainer asks to bootstrap wfctl, connect a repository to project knowledge, update workflow rules or skills, preserve existing AGENTS.md or CLAUDE.md instructions, or diagnose a broken workflow installation.
---

# Setup Workflow Environment

Install through deterministic `wfctl` operations while preserving all unowned consumer content.

## Procedure

1. Identify whether the target is a `knowledge` or `leaf` repository.
2. For a leaf repository, obtain the local knowledge-repository path. Do not guess it.
3. Inspect existing `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, `.agents/skills`, and `.claude/skills`, including symlink targets.
4. Run `wfctl plan <profile> --target <path> --json` with `--knowledge <path>` for a leaf.
5. Review every reported conflict. Never use a destructive replacement to make the plan pass.
6. If instruction files require a semantic merge, use `wfctl render agents` and insert the rendered managed block in the appropriate location.
7. Run `wfctl apply` only after the plan is conflict-free.
8. Run `wfctl doctor --target <path>` and report any remaining failure.

Use `wfctl sync` for an existing installation. Read [the installation contract](references/install-contract.md) when handling unusual files or symlinks.

## Safety

- Preserve text outside `wfctl` markers.
- Never replace an existing file or directory with a symlink.
- Treat local edits to owned generated files as conflicts.
- Do not claim Codex consumes `.claude/rules`; Codex receives the routing contract through `AGENTS.md`.
- Keep `.agents/skills` canonical. Use `.claude/skills` as a symlink or a set of per-skill links when that directory already exists.
