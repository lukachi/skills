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

Before any raw intake belongs to reconstruction, the agent shows what exists
in the frozen raw snapshot and recommends one choice: review all of it, review
selected themes, or exclude it from this baseline. You approve the boundary in
project language; the agent records your decision and translates selected
themes into exact paths. If no raw exists, the CLI records that automatically.
An intake case created before approval, outside the approved paths, or at a
different Git baseline cannot satisfy reconstruction.

The agent must not recommend exclusion merely because raw is old, speculative,
contradictory, or unverified. Those materials may be the only surviving record
of intent or history. Exclusion means the material is outside this
reconstruction's agreed purpose, not that it is insufficiently trustworthy.

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

## How large reconstructions are parallelized

You do not decide how to split a codebase or operate subagents. After freezing
the exact source set, the main agent chooses between one session and bounded
fan-out.

Fan-out is used only for independent research outcomes: a coherent repository
area, runtime surface, bounded raw-history question, cross-repository flow, or
fresh omission review. It is not used to assign arbitrary alphabetical file
ranges and does not allow several agents to rewrite the shared project story.

The main agent remains the orchestrator. It gives each worker exact source and
case roots, a pinned commit, a precise responsibility slice, relevant required
context, and one durable work packet. The slice does not prevent exploration:
workers may follow any relevant read-only code or documentation and record why
they crossed it. They cannot modify product code or publish curated knowledge.
The orchestrator verifies stable source-read receipt IDs, reconciles overlaps
and contradictions, and only then updates shared dossiers and project
candidates.

The first wave maps independent repository and raw surfaces. Likely entrypoints
and runtime surfaces are proposed automatically from tracked paths, but remain
questions until an agent inspects or rejects them. Later waves are
created only for concrete gaps or cross-repository connections found during
fan-in. A separate fresh review challenges omissions and unsupported claims
before you review the baseline. The record states whether that review came from
an independent agent, a separate session, or you; a different actor label alone
does not count. If the current agent host has no subagents,
the same stages run serially and the record says so honestly.

## During review

The agent shows a reconstruction frontier: repositories, coverage, approved
raw scope, active themes, blockers, decisions needed, and the remaining
completion condition.

The parent case retains cross-project discoveries; each repository dossier
retains consequential local discoveries; accepted worker packets retain their
isolated findings. A checkpoint records only the current frontier and next safe
action. On a new session, one active reconstruction is discovered automatically
and every case, dossier, workstream, and machine frontier is reread. If any
owned record changed after the checkpoint, it is marked stale and the agent
rebuilds the frontier before continuing. With several active reconstructions,
you choose by human title rather than remembering an ID.

Correct product intent where code cannot establish it. If the evidence remains
insufficient, keep the claim unresolved or close the reconstruction as partial.

## Result

After approval and validation, `knowledge/` becomes the current human and agent
entry point. Reconstruction records remain an audit trail; they are not the
normal reading surface.

## Next

Continue with [07 — Process raw material](07-raw-material.md).
