# wfctl

`wfctl` gives a project durable memory that coding agents can actually use.

It connects product intent, source code, decisions, active work, and project
history without pretending that code, old notes, or generated indexes are
automatically true.

## Why use it?

Agents are useful at implementing a task, but a long-lived project needs more:

- important decisions must survive chat compaction and team changes;
- an agent must understand the product before changing its implementation;
- work across several repositories must still describe one coherent project;
- current behavior, future intent, and historical ideas must not be flattened
  into the same document;
- “done” must be supported by evidence, not by the agent's confidence.

`wfctl` turns those needs into an installed workflow for Codex and Claude Code.
The workflow teaches the agent how to investigate, discuss, record, verify, and
curate work while leaving product authority with the maintainer.

## What you get

- A living work record that survives interruptions and evolves from discussion
  through implementation and verification.
- A shared knowledge repository with separate product, engineering, and
  decision-history views.
- Source-first reconstruction for projects that already contain working code.
- Safe intake for raw notes, ideas, research, and legacy specifications.
- Graphify-first source navigation, QMD retrieval, Git-pinned evidence, and
  deterministic validation.
- One workflow across a single repository, a monorepo, or many independent
  repositories and worktrees.

## The project model

A project has two kinds of repositories:

```text
knowledge repository
├── curated project knowledge
├── decisions and active work
└── raw and reconstruction intake

leaf repositories
└── source code and implementation evidence
```

There is one knowledge repository and any number of leaf repositories. A leaf
may be a normal checkout or a Git worktree.

## Start in five minutes

Install `wfctl`, then initialize the knowledge repository:

```sh
cd /path/to/project-knowledge
wfctl init knowledge
```

Connect each source repository:

```sh
cd /path/to/source-repository
wfctl init leaf --knowledge /path/to/project-knowledge
```

Restart Codex or Claude Code so it loads the installed skills. After that, use
plain language:

> Help me understand this project and what it can do today.

> Implement account recovery.

> Process the new raw material.

The agent owns routine `wfctl`, Graphify, QMD, and validation commands. You own
product intent, corrections, approvals, and completion decisions.

## Read next

1. [Why this workflow exists](IDEA.md)
2. [Install it in a project](docs/01-installation.md)
3. [Work with it day to day](docs/02-daily-work.md)
4. [Use the knowledge repository](docs/03-knowledge-repository.md)
5. [Read project knowledge](docs/04-reading-project-knowledge.md)
6. [Adopt an existing project](docs/05-existing-project.md)
7. [Process raw material](docs/06-raw-material.md)
8. [Review, correct, and recover](docs/07-maintainer-control.md)

Workflow authors can continue with the
[engine contract](spec/ENGINE.md),
[knowledge contract](spec/KNOWLEDGE.md), and
[verification guide](spec/VERIFICATION.md).

## Current scope

The current implementation targets Codex and Claude Code. `wfctl` runs on
Node.js, Bun, or Deno; QMD and Graphify remain external tools with their own
native skills.
