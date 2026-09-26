# CLI contract

The current command surface is optional. `wfctl --help` is the concise runtime reference.

## Durable records

```text
wfctl bundle create --id <id> --title <title> --scope <delivery> --agreed <agreement>
wfctl bundle list
wfctl bundle show --id <id>
wfctl unit create --bundle <bundle> --id <id> --title <title> --outcome <result> --boundary <limits> --agreed <agreement>
wfctl unit list --bundle <bundle>
wfctl unit show --bundle <bundle> --id <id>
```

Creation requires an explicit agreement field and refuses an existing directory or file. IDs are safe lowercase path segments. Bundle and unit files are Markdown, not generated views of a flow record. Listing and showing are read-only. Normal document edits record later progress and agreed contract changes.

## Agent recovery

```text
wfctl flow checkpoint --namespace <agent> --id <thread> --instruction <request> --last <done> --next <action> [--link <path>]... [--blocker <text>] [--checkout <path>] [--revision <sha>]
wfctl flow handoff --namespace <agent> --id <thread>
wfctl flow list --namespace <agent>
```

The namespace and thread are always explicit. A checkpoint replaces one ignored local note. Handoff reads that note. Neither command creates a bundle or unit.

## Installation and guidance

`wfctl init knowledge [--target <dir>]` installs the optional skill and local ignore rule without runtime scripts or mandatory hooks. `wfctl guide tidy` reads the semantic tidying guide. Other explicit knowledge, repository lookup, and reconstruction commands remain separate from ordinary work.

The old `work`, `brief`, `checkpoint`, `capture`, `recall`, `guards`, and `hook` routes are retired. There is no `--weight` route for new records. Promotion and review commands from the earlier work sequence are not carried forward as policy by this contract.
