# 06 — Adopt an existing project

## Use this when

Use this guide when `wfctl` joins a project that already has source code,
history, documentation, or raw notes but no trusted curated baseline.

## Problem

No single existing source tells the whole project story:

- code shows what is implemented now, not necessarily what was intended;
- Git history shows change, but commit order does not establish product truth;
- documentation may be stale;
- raw notes may contain valuable history, abandoned plans, or new ideas;
- one repository may expose only one part of a cross-project capability.

Building knowledge from only one of these inputs creates false certainty.

## Outcome

You receive a reviewed baseline that separates:

- accepted product intent;
- observed implementation and delivery;
- alignment or drift between them;
- durable history and superseded states;
- proposals that are not current truth;
- unknowns that still need maintainer authority.

## Before reconstruction

1. Initialize and commit the knowledge repository.
2. Initialize every source repository as a leaf.
3. Restart the agent session.
4. Open the agent in the knowledge repository.

Then ask:

> Reconstruct the project knowledge baseline from the connected source
> repositories.

Do not ask it to infer the project from raw notes alone.

## Which checkouts are analyzed

The project registry may know several normal checkouts or worktrees for one
repository. Reconstruction uses one explicit checkout per registered
repository.

The agent:

- keeps an existing valid selection;
- announces and selects the only available candidate when there is one;
- asks one project-language question when several candidates are valid;
- never scans every worktree merely because it exists;
- never silently changes the saved selection when a new worktree appears.

You choose only when the correct checkout is genuinely ambiguous. The agent
operates the registry commands.

## What the agent does

For each selected repository, the agent:

1. requires a clean checkout and pins its exact Git revision;
2. inventories every tracked tree entry, including Graphify-unsupported files;
3. refreshes Graphify and accounts for every structural community;
4. records entrypoints, runtime surfaces, and component boundaries;
5. reads relevant source, tests, contracts, configuration, data, and
   documentation from pinned blobs;
6. builds a repository dossier with explicit coverage and gaps.

It then reconciles all repository dossiers into project-wide capabilities,
flows, contracts, and Areas. Repository names, roles, and count are discovered
from the real project, not predefined by the workflow.

Optional raw material, existing documentation, active changes, and Git history
join as separate candidate inputs. They do not override source or maintainer
authority automatically.

## What “complete” means

The gate proves complete accounting of the selected revisions:

- every tracked file has a reviewed disposition;
- every Graphify community and runtime surface is explained;
- inspected text has gap-free reading receipts;
- every confirmed implementation claim points to inspected pinned evidence;
- cross-repository observations are reconciled;
- unresolved claims remain visible.

It does not prove perfect semantic understanding. Review the proposed product
map, corrections, and unknowns before approving promotion into curated
knowledge.

## During review

The agent shows a reconstruction frontier: repositories, coverage, active
themes, blockers, decisions needed, and the remaining completion condition.

Correct product intent where code cannot establish it. If the evidence remains
insufficient, keep the claim unresolved or close the reconstruction as partial.

## Result

After approval and validation, `knowledge/` becomes the current human and agent
entry point. Reconstruction records remain an audit trail; they are not the
normal reading surface.

## Next

Continue with [07 — Process raw material](07-raw-material.md).
