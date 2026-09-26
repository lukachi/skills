---
name: wfctl
description: Use wfctl when the user wants to record an agreed delivery, define a task inside it, keep an agent recovery note, or tidy the changes area. Ordinary project work does not require wfctl.
---

# wfctl

Work with the user normally. Do not start a bundle, unit, or flow merely because a task began, a session opened, a file changed, or work seems important. No wfctl command is a precondition for editing code or answering a request.

## Offer a durable record when useful

At a natural pause, you may offer to record a concrete delivery or task. Say what would be recorded and which existing bundle it belongs to. Read existing scope before suggesting a new record. If the user declines or does not answer, continue the ordinary work without creating a substitute record.

A **bundle** is an agreed delivery scope. It can contain one feature, several features, or a milestone, and its scope can change through agreement. A **unit** is an agreed contract for a specific task inside one bundle. A bundle may have no units. Do not make a new unit for every step, bug, file, or session.

Bundle and unit Markdown is the project record. Edit it directly to preserve agreed decisions, meaningful progress, outcomes, and evidence. Keep useful supporting work in tracked files beside the relevant record when its meaning warrants retention. The CLI creates and locates records; it does not replace human judgment about their content.

New units have `Status: planned` below the heading. Change it to `in progress` when work begins and `done` when the agreed outcome is reached. Update the document's progress, plan, specification, and useful completion evidence as needed; the status is a readable summary, not a command gate.

```sh
wfctl bundle list
wfctl bundle show --id <bundle-id>
wfctl bundle create --id <bundle-id> --title "<title>" --scope "<delivery>" --agreed "<agreement>"
wfctl unit list --bundle <bundle-id>
wfctl unit create --bundle <bundle-id> --id <unit-id> --title "<title>" --outcome "<result>" --boundary "<limits>" --agreed "<agreement>"
```

## Agent recovery

A **flow** is a short local checkpoint and handoff for one agent thread. It is ignored by Git and is not the delivery record. The maintainer, user, orchestrator, or management selects the agent namespace explicitly. Do not infer it from the directory, session, newest record, or bundle. An agent can work without one.

When a namespace has been selected, name the recovery thread explicitly. Replace its note with the current instruction, last completed action, next action, and links needed to resume. Keep durable facts in the bundle or unit, not in an accumulating thought dump.

```sh
wfctl flow checkpoint --namespace <agent> --id <thread> --instruction "<request>" --last "<done>" --next "<action>" --link <path>
wfctl flow handoff --namespace <agent> --id <thread>
wfctl flow list --namespace <agent>
```

## Tidying

When the user asks to tidy the `changes/` area, read [the tidying guide](references/tidying.md). It covers everything under `changes/` except `changes/archive/`. Tidying is a semantic, user-guided activity, not a command sequence. It may include merging or cleaning bundles and units.

The old mandatory work steps, weight classification, startup brief, write guard, and stop guard are retired. Do not invoke them for ordinary work. Promotion and review policy are being redesigned separately; do not infer their future behavior from old gates.
