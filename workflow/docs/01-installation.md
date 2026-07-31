# 01 — Install the workflow

## Use this when

Use this guide when starting a new project or adding `wfctl` to an existing
project for the first time.

## Problem

The knowledge repository and source repositories have different
responsibilities. If they receive the wrong profile—or only a folder
structure—the agent will not know where to investigate, record, or implement
work.

## Outcome

You will have:

- one initialized knowledge repository;
- every source repository connected as a leaf;
- project-local skills for the selected agent conventions;
- QMD retrieval in knowledge and Graphify navigation in each leaf;
- visible `PROJECT_WORKFLOW.md` instructions in every repository.

## 1. Prepare the tools

The current source installation uses Bun:

```sh
git clone https://github.com/lukachi/skills.git
cd skills/workflow
bun install
bun run build
bun link
wfctl --help
```

You also need:

- Git;
- Node.js 20 or newer, or Bun 1.3 or newer;
- QMD 2.5.3 or newer;
- Graphify and its native agent skill before initializing a leaf.

`wfctl init` runs dependency checks before writing workflow files. If a
dependency is missing, follow the displayed setup instructions and repeat the
command. QMD semantic models are optional; lexical search works without the
roughly 2 GB model download.

For a manual Graphify setup, install the CLI and its official native skill for
every agent platform you use:

```sh
uv tool install graphifyy
graphify install --platform <agent>
```

Run `graphify install --help` to see the platform names supported by your
installed version. Restart the coding agent after skill installation. `wfctl`
will not install this external user-level tool without your approval; a failed
leaf preflight prints these recovery steps and writes nothing.

### Optional: let the setup agent install the workflow

From the cloned source, you may install only the setup skill first:

```sh
bunx skills add /absolute/path/to/skills/workflow \
  --skill setup-workflow-environment
```

Choose the agent conventions you use when prompted. Then restart the agent,
open it in the intended repository, and ask it to initialize the workflow. The
setup agent previews and operates the same `wfctl init` process; it does not
bypass dependency or conflict checks.

## 2. Initialize knowledge

Create or enter the repository that will own shared project knowledge:

```sh
cd /path/to/project-knowledge
wfctl init knowledge
```

The interactive installer:

1. previews every file change;
2. checks Git and QMD;
3. asks whether skills should be project-local, user-level, or skipped;
4. asks which supported agent conventions to install;
5. preserves existing instructions outside managed blocks;
6. builds the initial knowledge indexes.

The default project scope creates independent copies under `.agents/skills`
and/or `.claude/skills` in this repository and records them in
`skills-lock.json`. User scope installs into the corresponding user-level
stores; `none` skips skills. The installer selects the knowledge or leaf
profile from `wfctl` itself and never downloads mutable third-party prompts.
The next guide explains the exact profiles, provenance, and upgrade behavior.

If the directory is not a Git repository, interactive setup can initialize it.
Review and commit the installed baseline before reconstructing an existing
project.

## 3. Connect every leaf

Run leaf initialization from the exact source checkout the agent should use:

```sh
cd /path/to/source-repository
wfctl init leaf --knowledge /path/to/project-knowledge
```

The knowledge path may be absolute or relative. A portable relative path is
usually better when repositories are stable siblings:

```sh
wfctl init leaf --knowledge ../project-knowledge
```

Repeat this for every repository that contributes to the project. Normal Git
checkouts and worktrees are both supported. Adding a worktree records it as an
available checkout; it does not silently replace the checkout already selected
for reconstruction.

## 4. Restart and verify

Restart your coding agent so the new session discovers the installed skills.
Then ask inside each repository:

> Check whether the workflow in this repository is healthy.

The agent runs diagnostics and explains only failures or actions that matter.

## If files already exist

`wfctl` owns only its generated files and marked instruction blocks. It
previews conflicts, preserves unrelated text, and requires an explicit choice
and backup before replacing a conflicting owned file. Structural or symlink
conflicts stop installation instead of guessing.

## Next

Continue with
[02 — Understand the installed skills](02-skills-and-provenance.md).
