# 02 — Understand the installed skills

## Use this when

Read this after installation, or whenever you need to know which behavior comes
from `wfctl`, which behavior was adapted from another project, and where the
agent actually discovers it.

## Problem

A skill can be copied into several agent-specific directories, renamed, and
combined with project rules. Without a visible lineage it becomes unclear
whether two workflows are competing, which copy should be edited, or what an
upgrade will replace.

## Outcome

You will understand the one installed workflow, its upstream lineage, the
knowledge and leaf profiles, and the boundary between source assets and
consumer copies.

## One integrated workflow

The leaf delivery flow directly reuses and modifies selected skills from Matt
Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills). It does not hide
that lineage, and it does not install the original suite beside a second
`wfctl` suite.

Instead, `wfctl` distributes local derived skills. They retain useful upstream
interaction patterns while sharing one central knowledge bundle, one issue
graph, and one completion gate:

| Upstream behavior | Installed `wfctl` skill | Main integration change |
| --- | --- | --- |
| Wayfinder | `shape-project-direction` | Stores the map and question issues in the central change bundle and forbids a jump into product code |
| To Spec | `specify-project-change` | Writes the canonical `change.md`, stable acceptance IDs, knowledge alignment, and maintainer framing review |
| To Tickets | `split-project-change` | Writes dependency-aware tracer-bullet issues into the same bundle with acceptance and repository coverage |
| Implement and TDD | `implement-work-item` | Adds exact leaf/worktree claims, Graphify-first inspection, hash-bound checkpoints, and evidence-backed resolution |
| Code Review | `verify-project-work` | Adds full bundle accounting, contract and engineering axes, exact revision receipts, and knowledge promotion |

Grilling, domain-modeling, research, prototype, and upstream handoff practices
are embedded where they serve those flows; they are not silently installed as
a second tracker or router. Upstream handoff behavior is deliberately split
between pending captures for unowned material and checkpoints for active work.
The complete source mapping and modification notes live in
[Third-party provenance](../THIRD_PARTY.md).

## What `wfctl init` installs

`wfctl init knowledge` and `wfctl init leaf` select different skill profiles
from the installed `wfctl` package. The bundled `skills` CLI copies the selected
directories; it does not create cross-agent symlinks or fetch mutable prompts
from upstream.

Both profiles receive setup, Graphify routing, project-work, alignment,
curation, and verification skills. Knowledge additionally receives durable
knowledge operation, raw intake, reconstruction, and project research skills.
The official version-matched QMD skill is installed separately from the local
QMD installation.

The interactive scope controls placement:

| Scope | Destination | Use it when |
| --- | --- | --- |
| `project` (default) | `<repo>/.agents/skills/<name>` and/or `<repo>/.claude/skills/<name>`, plus `skills-lock.json` | The workflow should travel with and remain isolated to this repository |
| `user` | `${CODEX_HOME:-~/.codex}/skills/<name>` and/or `${CLAUDE_CONFIG_DIR:-~/.claude}/skills/<name>` | You intentionally want the selected profile available to every local project using that convention |
| `none` | No skill directories | You want only generated rules, guides, and workflow files |

The current installer writes the `.agents`-compatible and `.claude`-compatible
conventions independently. Any agent that discovers one of those conventions
can use the corresponding copy. Restart the agent after installation so it
reloads skill metadata and repository instructions.

## Which copy is authoritative

The canonical editable source is always `workflow/skills/` in the `wfctl`
project. Installed skill directories are generated consumer copies. Do not
customize those copies and expect the changes to survive an upgrade.

After updating `wfctl`, run this inside each initialized repository:

```sh
wfctl upgrade
```

The command reuses the recorded profile, scope, and agent conventions. It
previews changes, refreshes owned skill copies, removes obsolete workflow-owned
skills, and preserves unrelated content. It never fetches the current Matt
Pocock repository during consumer installation.

## How to invoke the flow

Normally, describe the desired outcome. `manage-project-work` classifies the
request and routes significant work. Deliberate modes can also be named when
you want them explicitly:

- “Use Wayfinder to make this direction specifiable.”
- “Turn our discussion into the project specification.”
- “Split the approved change into executable issues.”
- “Implement the next ready issue.”

The exact slash-command syntax depends on the agent host. Skill names and plain
language remain the portable interface.

## Next

Continue with [03 — Work day to day](03-daily-work.md).
