---
name: split-project-change
description: Break an approved specification into tracer-bullet issues, each declaring the issues that block it, published into the same central bundle. Use when the maintainer asks for the execution breakdown, or when delivery spans several fresh agent sessions.
---

# Split Project Change

Break the work into **issues** — tracer-bullet vertical slices, each declaring the
issues that **block** it.

## 1. Gather context

Run `wfctl work context <id> --stage shape` and `wfctl work status <id>`. Read
`change.md` completely, and confirm the framing is approved, the mode is `full` or
`slice`, and stable acceptance ids exist.

## 2. Explore the source

Where the breakdown depends on implementation facts you have not checked, invoke
`analyze-with-graphify` in the exact relevant code roots before proposing
anything. Issue titles and bodies use the project's own domain language, and
respect the decisions curated knowledge already carries.

Look for opportunities to **prefactor** the code to make the implementation
easier: make the change easy, then make the easy change.

## 3. Draft vertical slices

Break the work into **tracer bullet** issues.

- Each slice cuts a narrow but COMPLETE path through every layer it needs —
  vertical, never a horizontal slice of one layer.
- A completed slice is demonstrable or verifiable on its own.
- Each slice is sized to fit in a single fresh context window.
- Prefactoring goes first, as its own issue.

Give each issue its **blocking edges** — the issues that must complete before it
can start. An issue with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A wide refactor is one
mechanical change — rename a column, retype a shared symbol — whose **blast
radius** fans across the whole codebase, so a single edit breaks thousands of call
sites at once and no vertical slice can land green. Sequence it as
**expand–contract** instead. First expand: add the new form beside the old so
nothing breaks. Then migrate the call sites in batches sized by blast radius — per
package, per directory — each batch its own issue blocked by the expand, keeping
checks green batch to batch because the old form still exists. Finally contract:
delete the old form once no caller remains, in an issue blocked by every migrate
batch. Where even the batches cannot stay green alone, keep the sequence and let
them share an integration branch that all block a final integrate-and-verify
issue; green is promised only there.

## 4. Quiz the maintainer

A breakdown is a graph, so draw it rather than describing it — a dependency tree
through `show-project-work`, with each node named by what it delivers. For each
issue show:

- **Title** — a short descriptive name.
- **Blocked by** — which other issues must complete first, by name.
- **What it delivers** — the end-to-end behaviour this issue makes work.

Then ask them, as one numbered round with your own answer on each rather than
three turns:

- Does the granularity feel right — too coarse, too fine?
- Are the blocking edges correct: does each issue depend only on issues that
  genuinely gate it?
- Should any issues be merged, or split further?

Iterate until they approve the breakdown. Publish only the approved graph.

## 5. Publish into the bundle

Create issues in dependency order so blocker ids already exist:

```sh
wfctl work issue create <change-id> <slug> \
  --title "<title>" \
  --phase delivery \
  --type delivery \
  --satisfies AC-01 \
  --repository <repository-id> \
  --blocked-by ISSUE-001
```

Repeat the options as needed. Each issue's body carries:

- **Outcome** — the end-to-end behaviour this issue makes work, from the
  perspective of the person the product serves, rather than a layer-by-layer
  implementation list.
- **Acceptance contribution** — how it contributes to the acceptance ids it
  satisfies.
- **Constraints and boundaries** — the relevant curated knowledge, approved
  decisions, repository scope, and explicit exclusions, linked rather than copied
  from the parent.

Keep specific file paths and code snippets out of an issue; they go stale fast.
One exception: where a prototype produced a schema, state machine, or type shape
that encodes a decision more precisely than prose can, inline the decision-rich
part and say it came from a prototype.

Then run `wfctl work issue list <change-id>` and confirm every acceptance id is
covered, the graph is acyclic, and the frontier matches the intended concurrency.
Refresh the parent checkpoint last, with the first executable frontier action.

Work the **frontier**: any issue whose blockers are all complete. For a purely
linear chain that means top to bottom.

## Bad splits

- One issue per technical layer.
- One giant issue that silently relies on conversation memory.
- Blockers used as ordering preferences rather than genuine gates.
- Acceptance text duplicated from the parent and allowed to drift.
- Source paths or snippets treated as permanent requirements.
- A leaf-local checklist competing with the central bundle.

## Then

Do not implement here. Hand a frontier issue to `implement-work-item` in a fresh
context.
