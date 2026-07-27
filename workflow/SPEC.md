# Workflow Engine v1

## Destination

Ship a deterministic `wfctl` package that bootstraps and maintains a shared project workflow for Codex and Claude, with a central knowledge repository and any number of leaf repositories.

## Source of truth

- This directory is the canonical source for the CLI, rules, skills, and templates.
- Installed consumer files are generated copies or symlinks owned through `.workflow/state.json`.
- Existing consumer instructions are preserved. `wfctl` only edits its marked block in `AGENTS.md` or `CLAUDE.md`.
- Package releases, not mutable remote downloads, distribute canonical assets. A consumer can pin the exact `wfctl` version.

## Knowledge model

- `raw/` is immutable evidence and may contain contradictory or incomplete records. It is not current truth.
- `changes/active/` contains the one canonical spec/progress file for each active significant task.
- `changes/archive/` preserves closed specs.
- `knowledge/` is the curated OKF v0.2 bundle and the current project knowledge surface.
- Unknown chronology or truth must remain explicit until a maintainer resolves it.
- Decisions evolve through explicit supersession links; history is not silently rewritten.

## Work routing

- Significant work uses the full gate: Graphify analysis, knowledge alignment, living spec, implementation, evidence-based verification, then flush.
- Clearly lightweight work may bypass the full gate.
- Ambiguous work requires a maintainer decision.
- Bypassed work should be offered a compact handoff record so useful information is not lost.

## CLI surface

- `wfctl plan <profile>`: inspect the exact filesystem operations without mutation.
- `wfctl apply <profile>`: apply a conflict-free plan.
- `wfctl init <profile>`: one-command alias for apply.
- `wfctl sync`: update owned assets using the installed profile.
- `wfctl bootstrap plan|install`: safely install the user-level setup skill for Codex, Claude, or both.
- `wfctl render agents`: print the managed instruction block for manual insertion.
- `wfctl doctor`: diagnose installation, Graphify, Git, and knowledge linkage.
- `wfctl work begin`: create a central living spec and a leaf pointer.
- `wfctl work verify`: validate the structural completion gate without claiming semantic correctness.
- `wfctl work flush`: archive the spec and write a provenance-rich raw record.

## Safety contract

- Never overwrite an unowned file.
- Never replace an existing file or directory with a symlink.
- Abort apply when any conflict exists.
- Update an owned file only when its current hash matches the last installed hash.
- Install only profile-relevant project skills; keep the setup and Graphify skills common.
- Never overwrite a different user-level bootstrap skill.
- Keep deterministic data on stdout; diagnostics and interactive UI belong on stderr.
- Support non-interactive and JSON output for agents and CI.

## Verification criteria

- [x] A clean knowledge target plans, applies, and passes doctor.
- [x] A clean leaf target links to knowledge, plans, applies, and passes doctor.
- [x] Existing `AGENTS.md` and `CLAUDE.md` content survives apply and sync.
- [x] Existing `.claude/skills` directories survive and receive only namespaced links.
- [x] Locally modified owned files cause conflicts instead of being overwritten.
- [x] Work begin produces one canonical central spec.
- [x] Completed flush requires recorded verification and emits Git/worktree metadata.
- [x] Partial or abandoned work can flush without a false completion claim.
- [x] Built CLI runs under Node, Bun, and Deno.
- [x] Knowledge and leaf profiles receive only their relevant skills.
- [x] The user-level setup skill installs safely for Codex and Claude.

## Progress

- [x] Research OKF v0.2, living-spec workflows, and cross-runtime CLI frameworks.
- [x] Select Cliffy with bundled npm distribution.
- [x] Define the raw / changes / curated knowledge boundary.
- [x] Implement the filesystem planner and safe applier.
- [x] Implement CLI commands.
- [x] Complete and validate rules, skills, and templates.
- [x] Add automated tests and runtime smoke checks.
- [x] Dry-run against the named DnD repositories.

## Out of scope for v1

- Hosted registry or automatic GitHub self-update.
- A full-screen Ink interface.
- Automatic semantic reconciliation of contradictory legacy raw material.
- Automatic proof that implementation behavior is correct; agents and maintainers provide semantic evidence, while the CLI enforces structural gates.
