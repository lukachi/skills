---
name: setup-workflow-environment
description: Install, update, repair, or explain the shared project workflow environment in a clean or initialized knowledge repository or leaf source repository. Use when a maintainer asks to bootstrap wfctl, connect a repository to project knowledge, update workflow rules or skills, preserve existing AGENTS.md or CLAUDE.md instructions, or diagnose a broken workflow installation.
---

# Setup Workflow Environment

Install through deterministic `wfctl` operations while preserving all unowned consumer content.

## Command ownership

Run `wfctl init`, `wfctl upgrade`, and `wfctl check` yourself when terminal
access permits. Ask the maintainer for repository kind, paths, skill targets,
scope, and conflict decisions, not routine command execution. Provide a manual
command only when bootstrapping without `wfctl`, missing authority, or tool
access prevents execution; state that blocker explicitly.

## Procedure

1. Confirm that Bun and `wfctl` are available. If `wfctl` is missing, stop and
   tell the maintainer how to install or link the canonical Bun package.
2. Confirm `qmd --version` reports at least `2.5.3`. If it is missing or old,
   ask for installation authority and run
   `bun install -g @tobilu/qmd@2.5.3`. QMD is the supported knowledge
   retrieval engine; do not substitute a custom indexer.
3. Require the `graphify` CLI before leaf initialization so every source
   checkout is ready for code analysis. Do not require it for a knowledge
   repository that is not inspecting source. For any later code task, the
   installed `analyze-with-graphify` gate also requires the official native
   session skill. Knowledge retrieval and raw intake use QMD, not Graphify.
4. Identify whether the target is a `knowledge` or `leaf` repository.
5. For a leaf repository, obtain the local knowledge-repository path. Do not guess it.
6. Inspect existing `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, `.agents/skills`, and `.claude/skills`, including symlink targets.
7. Run `wfctl init <knowledge|leaf> --target <path>` with `--knowledge <path>`
   for a leaf. Use the default project skill scope unless the maintainer chooses
   user scope or no skill installation. The dependency preflight must pass
   before the command writes files. A successful leaf initialization must also
   run `graphify update .` from the exact target checkout; do not accept a
   checkout whose local graph was never built. Preserve the existing root
   `.gitignore` while ensuring it excludes `graphify-out/`.
8. Review the preview before confirming. For each conflict, preserve the
   existing content, accept the offered per-file backup and replacement, or
   stop. Never invent a blanket overwrite.
9. Let `wfctl` update managed instruction and guide blocks. If their markers
   are malformed or duplicated, stop and repair them with the maintainer rather
   than replacing the whole file. Use `wfctl init <kind>
   --print-instructions agents|guide` to obtain the exact managed text.
10. Confirm that `PROJECT_WORKFLOW.md` preserves pre-existing text outside the
   managed block.
11. Confirm the installed skills include the version-matched official `qmd`
    skill from `qmd skills path qmd` for every selected agent. New skills are
    not active in the current session automatically; tell the maintainer to
    restart the agent session before knowledge-dependent work.
12. For a knowledge profile, confirm that `.qmd/index.yml` defines separate
    `knowledge`, `changes`, `intake`, and `raw` collections. `wfctl init`
    builds `.workflow/current/knowledge-graph.json` and runs `qmd update`, so
    explicit relationship navigation and BM25 retrieval must be ready
    immediately. Treat
    `qmd-models` and `qmd-embeddings` warnings as optional semantic setup, not
    as lexical-index success. Ask before `qmd pull` or `qmd embed`; the current
    model set is roughly 2 GB.
13. Run `wfctl check --target <path>` and report every failure and warning. For
    a leaf, confirm `graphify-graph` passes and refers to this checkout, not a
    sibling repository or another worktree, and confirm `graphify-ignore`
    passes.
14. For a knowledge profile, run `wfctl knowledge validate` and
    `wfctl knowledge build`; do not create a raw intake case unless intake
    processing was requested.
15. Point the maintainer to `PROJECT_WORKFLOW.md`; it defines their review
    responsibilities for both profiles.

Use `wfctl upgrade` for an existing installation. Read [the installation contract](references/install-contract.md) when handling unusual files or symlinks.

## Safety

- Preserve text outside `wfctl` markers.
- Never replace an existing file or directory with a symlink.
- Treat local edits to owned generated files as conflicts.
- Do not claim Codex consumes `.claude/rules`; Codex receives the routing contract through `AGENTS.md`.
- Let the pinned `skills` CLI install both workflow skills and QMD's
  version-matched native skill for the selected agent targets and scope. Do not
  hand-copy skills around it.
