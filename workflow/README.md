# wfctl

`wfctl` is a project collaboration and knowledge workflow that keeps
maintainers and coding agents aligned from product intent to verified delivery.

It gives both people and agents a durable, navigable project model without
pretending that code, old notes, or generated indexes are automatically true.

## Why use it?

A long-lived project becomes hard to steer when product meaning and engineering
reality drift apart:

- a maintainer should not have to reconstruct the product from source code,
  chats, and disconnected specifications;
- an agent must understand the product before changing its implementation;
- product intent and delivered behavior must remain comparable;
- important decisions must survive chat compaction and team changes;
- work across several repositories must still describe one coherent project;
- “done” must be supported by evidence, not by the agent's confidence.

`wfctl` turns those needs into an installed, vendor-neutral agent workflow.
It creates two linked, first-class roads through the same project:

- the **maintainer/product road** explains purpose, capabilities, behavior,
  rules, delivery, and evolution in human language;
- the **engineering road** explains architecture, ownership, source
  realization, contracts, operations, and verification.

Both maintainers and agents may follow either road. Neither is a derivative of
the other, and shared Areas, changes, and decision history keep them aligned.

## What you get

- A human-readable project road that lets maintainers, product people, and new
  team members recover the current project without reverse-engineering code.
- A linked engineering road that lets agents and engineers trace product
  meaning to exact implementation and evidence.
- A living work record that survives interruptions and evolves from discussion
  through implementation and verification.
- Source-first reconstruction for projects that already contain working code.
- Safe intake for raw notes, ideas, research, and legacy specifications.
- Graphify-first source navigation, QMD retrieval, and Git-pinned evidence.
- Mechanical checks that reject broken knowledge links, invalid decision
  history, stale review receipts, incomplete work records, and unaccounted raw
  intake or source reconstruction scope.
- One workflow across a single repository, a monorepo, or many independent
  repositories and worktrees.

## How the pieces work together

| Place | What belongs there |
| --- | --- |
| Knowledge repository | Shared product and engineering knowledge, work records, decision history, and unreviewed intake |
| Leaf repository | Source code, tests, implementation, and verification evidence |

Work moves between them in two ways:

- **Ongoing change:** shared context and maintainer intent → living work record
  → implementation and verification in a leaf → maintainer review → updated
  curated knowledge and decision history.
- **Existing project or raw material:** raw material and selected leaves →
  intake or reconstruction → evidence checks and maintainer review → curated
  knowledge.

There is one knowledge repository and any number of leaf repositories. A leaf
may be a normal checkout or a Git worktree. Raw material and reconstruction
results remain evidence, not project truth, until they are reviewed and curated.

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

Restart your coding agent. The repository you open determines its role:

- **Knowledge repository:** “Help me understand this project” or “Process the
  new raw material.” It may inspect leaves for evidence, but never implements
  source changes.
- **Leaf repository:** “Implement account recovery.” It writes code only in
  that exact checkout while using the central knowledge and work record.

The agent owns routine `wfctl`, Graphify, QMD, and validation commands. You own
product intent, corrections, approvals, and completion decisions. The shared
knowledge remains directly readable without an agent.

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

`wfctl` distributes instructions and skills through `AGENTS.md`/`.agents` and
`CLAUDE.md`/`.claude`; any compatible agent can use the workflow. It runs on
Node.js, Bun, or Deno; QMD and Graphify remain external tools with native skills.
