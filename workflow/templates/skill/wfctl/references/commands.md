# The command surface

Generated from the CLI usage text. All record creation is voluntary.

```
  --version
  bundle create --id <id> --title <title> --scope <delivery> --agreed <agreement>
  bundle list | show --id <id>
  unit create --bundle <bundle> --id <id> --title <title>
              --outcome <result> --boundary <limits> --agreed <agreement>
  unit list --bundle <bundle> | show --bundle <bundle> --id <id>

  flow checkpoint --namespace <agent> --id <thread>
                  --instruction <current-request> --last <done> --next <action>
                  [--link <path>]... [--blocker <text>]
                  [--checkout <path>] [--revision <sha>]
  flow handoff --namespace <agent> --id <thread>
  flow list --namespace <agent>

  init knowledge [--target <dir>]
  doctor
  guide [<topic>]
  knowledge validate [--page <path>]
  knowledge hash <path>
  repo add|list|remove ...
  reconstruct ...
  trajectory ...
  decided <subject>

Ordinary work requires no wfctl command. Bundle and unit creation require an
explicit agreement. Flow notes are local, short, and selected by namespace.
```
