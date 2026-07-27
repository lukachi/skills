---
name: setup-workflow-environment
description: Install, update, repair, or explain the shared project workflow environment in a clean or initialized knowledge repository or leaf source repository. Use when a maintainer asks to bootstrap wfctl, connect a repository to project knowledge, update workflow rules or skills, preserve existing AGENTS.md or CLAUDE.md instructions, or diagnose a broken workflow installation.
---

# Setup Workflow Environment

Install through deterministic `wfctl` operations while preserving all unowned consumer content.

## Procedure

1. Confirm that `wfctl` is available. If it is missing, stop and tell the maintainer how to install or link the canonical Bun package.
2. Identify whether the target is a `knowledge` or `leaf` repository.
3. For a leaf repository, obtain the local knowledge-repository path. Do not guess it.
4. Inspect existing `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, `.agents/skills`, and `.claude/skills`, including symlink targets.
5. Run `wfctl plan <profile> --target <path> --json` with `--knowledge <path>` for a leaf.
6. Review every reported conflict. Never use a destructive replacement to make the plan pass.
7. If instruction files require a semantic merge, use `wfctl render agents` and insert the rendered managed block in the appropriate location.
8. Confirm that `PROJECT_WORKFLOW.md` preserves any pre-existing text outside
   the managed block. Use `wfctl render guide` when the markers require a
   maintainer-controlled semantic merge.
9. Run `wfctl apply` only after the plan is conflict-free.
10. Run `wfctl doctor --target <path>` and report any remaining failure.
11. Point the maintainer to `PROJECT_WORKFLOW.md`; it defines their review
    responsibilities for both profiles.

Use `wfctl sync` for an existing installation. Read [the installation contract](references/install-contract.md) when handling unusual files or symlinks.

## Safety

- Preserve text outside `wfctl` markers.
- Never replace an existing file or directory with a symlink.
- Treat local edits to owned generated files as conflicts.
- Do not claim Codex consumes `.claude/rules`; Codex receives the routing contract through `AGENTS.md`.
- Keep `.agents/skills` canonical. Use `.claude/skills` as a symlink or a set of per-skill links when that directory already exists.
