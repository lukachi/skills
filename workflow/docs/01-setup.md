# 01 — Set up the workflow

## Use this when

You are putting `wfctl` on a project for the first time, adding another source
repository later, or updating an installation you already have.

## What you decide

Installation asks you four things and decides nothing important on its own:

| Question | Your options | Sensible default |
| --- | --- | --- |
| Where do skills go? | this repository, your user profile, or nowhere | this repository |
| Which agent conventions? | `.agents`, `.claude`, or both | both |
| Initialize Git here? | only offered for a new knowledge directory | your call |
| Replace a conflicting file? | per file, with a backup | keep yours |

Everything else — dependency checks, file layout, index building — runs without
asking.

## Get the tools

```sh
git clone https://github.com/lukachi/skills.git
cd skills/workflow && bun install && bun run build && bun link
wfctl --help
```

You also need Git, Node.js 20+ or Bun 1.3+, and QMD 2.5.3+:

```sh
bun install -g @tobilu/qmd@2.5.3
```

Each source repository additionally needs Graphify and its native agent skill:

```sh
uv tool install graphifyy
graphify install --platform <agent>     # repeat per agent platform you use
```

Run `graphify install --help` for the platform names your version supports, and
restart the agent afterwards. `wfctl` will not install user-level tools for you.
If a dependency is missing, initialization prints the exact recovery steps and
writes nothing.

## Your first day on a project

```text
1. create and initialize the knowledge repository
2. commit that baseline
3. connect every source repository as a leaf
4. restart the agent
5. if the project already has code, build a baseline    → 02-knowledge-repository.md
6. start working                                        → 03-leaf-repository.md
```

### 1–2. The knowledge repository

One project has exactly one. It holds shared understanding, work records, and
history — never source code.

```sh
cd /path/to/project-knowledge
wfctl init knowledge
```

The installer previews every file it will touch, checks Git and QMD, asks the
four questions above, and builds the initial indexes. If the directory is not a
Git repository yet, interactive setup offers to initialize it. Commit the result
before you go further, so later work has a clean starting point.

### 3. Each source repository

Run this from the exact checkout the agent should use:

```sh
cd /path/to/source-repository
wfctl init leaf --knowledge ../project-knowledge
```

A relative path is usually better between stable siblings. Repeat for every
repository that contributes to the project — one project can have many.

Normal checkouts and Git worktrees are both fine. Adding a worktree registers it
as available; it does not silently become the checkout used for reconstruction.

### 4. Restart and check

New skills are not active in a running session. After restarting, ask in each
repository:

> Check whether the workflow in this repository is healthy.

You will get failures and warnings, not a wall of green. A knowledge repository
with registered leaves warns when Graphify is missing, because building a
baseline from there needs it.

## Every session opens with the state

From then on, an agent starting in either repository reads the current state
before it does anything else, and tells you where things stand: what exists,
what is in progress, what is waiting on you, and which operations are possible
right now. On a fresh knowledge repository that is short — nothing is connected,
so it offers you the ways to begin.

You can see the same thing without an agent:

```sh
wfctl brief
```

It only reads. It starts nothing, and a capability it reports as available is a
possibility, not a plan.

## What got installed

Both repository kinds receive a managed block in `AGENTS.md` and `CLAUDE.md`,
rules under `.workflow/rules/`, a `PROJECT_WORKFLOW.md` you can read directly,
and a set of skills.

The two profiles differ in what they can do:

| Profile | Gets | Deliberately lacks |
| --- | --- | --- |
| knowledge | knowledge operations, exploration, reconstruction, raw intake, research, direction shaping, curation, work management, verification | nothing — but it never writes source code |
| leaf | work management, direction shaping, specification, execution, alignment, exploration, curation, verification | knowledge-only operations: reconstruction, raw intake, durable research |

Skills are copied per agent convention, never symlinked across them. Project
scope keeps them inside the repository and records them in `skills-lock.json`;
user scope installs into `${CODEX_HOME:-~/.codex}` or
`${CLAUDE_CONFIG_DIR:-~/.claude}`.

The leaf delivery flow is derived from Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills), integrated as one
workflow rather than installed beside it. The exact mapping and modifications
live in [Third-party provenance](../THIRD_PARTY.md).

The editable source is always `workflow/skills/` in the `wfctl` project.
Installed copies are generated: customizing them does not survive an upgrade.

## If files already exist

`wfctl` owns only its generated files and the text between its markers. It
previews conflicts, keeps everything else, and asks per file before replacing
something it owns — with a backup. Structural or symlink conflicts stop the
installation instead of guessing.

## Updating

From the repository being updated:

```sh
wfctl upgrade
```

Or ask the agent to preview and apply it. The recorded profile, scope, and
agent conventions are reused. Restart the session afterwards.

An upgrade never fetches upstream prompts and never rewrites your own text.
Existing concepts that a new version holds to a stricter standard stay blocked
until someone reviews them — they do not get backdated receipts.

## Next

[02 — Work in the knowledge repository](02-knowledge-repository.md), or jump to
[03 — Work in a source repository](03-leaf-repository.md) if the project already
has a trustworthy baseline.
