# wfctl

`wfctl` is an optional tool for durable project records and agent recovery. The user and agent work normally; a task does not have to become a workflow object.

## Records

- **Bundle:** an agreed delivery scope, stored as `changes/active/<bundle-id>/change.md`.
- **Unit:** an agreed task contract inside a bundle, stored as `changes/active/<bundle-id>/units/<unit-id>.md`. A bundle may have no units.
- **Flow:** a short agent checkpoint and handoff under an explicitly selected namespace. It is local and Git ignored.

Bundle and unit Markdown is the source of truth. The CLI creates documents explicitly, then people and agents can edit them as documents. It does not generate Markdown from flow JSON or make a flow a precondition for work.

```sh
wfctl bundle list
wfctl bundle create --id delivery-one --title "Delivery one" --scope "Agreed delivery" --agreed "User agreement"
wfctl unit create --bundle delivery-one --id task-one --title "Task one" --outcome "Expected result" --boundary "Task limits" --agreed "User agreement"
wfctl flow checkpoint --namespace agent-one --id current-thread --instruction "Current request" --last "Completed action" --next "Next action" --link changes/active/delivery-one/change.md
wfctl flow handoff --namespace agent-one --id current-thread
```

The agent may offer to record meaningful work at a natural pause. Declining leaves the ordinary work alone. No significant/lightweight classification, automatic bundle or unit creation, startup brief, write guard, or stop guard is part of the current work path.

## Installation

`wfctl init knowledge` installs the agent skill, a small instruction block, and the local ignore rule for recovery notes. It does not install project-local runtime scripts or mandatory host hooks. An explicit update replaces installed wfctl files and removes retired wfctl runtime scripts and hooks. Editing this source tree does not change an installed CLI.

## Documentation

- [Active work contract](spec/OPTIONAL_WORK.md)
- [Engine](spec/ENGINE.md), [records](spec/WORK.md), and [CLI](spec/CLI.md) contracts
- [Development](spec/DEVELOPMENT.md) and [verification status](spec/VERIFICATION.md)
- [Installed agent skill](templates/skill/wfctl/SKILL.md)
- [Tidying guide](templates/skill/wfctl/references/tidying.md)

Promotion, review, and knowledge curation are separate design areas and are not defined by the optional work records.
