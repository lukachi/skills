# The command surface

Generated from the CLI's own usage at build time. You are not expected to
memorise this — each command prints what comes next. Reach for it when you
need exact flags.

```
  brief [--json]               the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint "<anything worth not looking up again>"   [--about <unit>]
  checkpoint [--summary ...] [--handoff ...] [--last ...] [--next ...] [--todo ...]
                               a body writes a note; the flags update the index.
                               Either alone. What you do not name is left as it was.
  notes                        everything written down for this flow

  kit                          what this work is equipped with
  kit survey                   the skills, strategies and personalities it could pick up
  kit adopt <id>... --attested "<what they said>"

  learned "<the one line>" --detail "<what happened, and what to do>"
          --attested "<what they said>"
                               one problem, solved, kept past this work
  learned list                 what earlier work already found out

  finding "<what you found>" [--about <unit>] [--artifact <path>]
                               something this work should settle, kept with this work
  finding list | resolve <id> --how "<what you did>" | release <id>

  artifact add <path> --what "<what it is>" [--supersedes <path>]
  artifact list                what this work produced, and what still stands

  work start --title ... --weight <significant|lightweight>
             --attested "<what the maintainer said>" [--from <where it came from>]
  work adopt <bundle> --attested "<what they said>"
             [--weight <significant|lightweight>] [--title ...] [--from <where>]
  work list                    every bundle, and whether anything can reach it
  work step                    where this work is, and what moves it on
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id> --evidence "<what proves it>" [--remainder "<what is left>"]
  work issue drop <id> --reason "<why it left the route>"
  work park --reason ... --attested "<their words>"
  work release --attested "<their words>"
  work verify --brief <personality> [--at <revision>]
                               the brief to hand the reviewing agent
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
               [--bundle <record>] [--settles <event-id>]
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]
                               for what is OUTSIDE this work's fence. Inside it,
                               use finding — it stays with the work that found it.

  repo add <owner/name> --path <dir> [--worktree <id>] [--checkout <name>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories
  reconstruct status
  reconstruct scope --repository <owner/name> [--revision <sha>] [--raw all|selected|none] [--in <path>]...
  reconstruct read <path> [--at <owner/name>]   record a read, or print the file at the pinned revision
  reconstruct exclude <path> --reason "<why>"
  reconstruct contradiction --subject ... --side ... --side ...
  reconstruct resolve <id> --resolution "<what they decided>"
  reconstruct subject <trajectory-id>
  reconstruct probe --question ... --page <path> --asker <agent> [--passed]
  reconstruct stage            advance when this stage's gate passes
  reconstruct abandon --reason "<why>"
  reconstruct close

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
                    [--settles <event-id>]   a delivery names the intent it settles
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> --covered <path> [--covered <path>]...

  flow close [<flow-id>]       flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  debts                        what is accepted and not delivered, across every subject
  decided "<subject>"          what has already been settled about it, and where
  knowledge validate [--page <path>]
  knowledge hash <path>

  doctor                       verify this installation and what it depends on

  guards [status]              which runtime guards are on
  guards on|off <stop|write|bash>

  hook write --target <path>   used by the pre-write guard, not by hand
```
