# The command surface

Generated from the CLI's own usage. You are not expected to memorise this — each
command prints what comes next. Reach for it when you need exact flags.

```
  brief [--json]               the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
             --attested "<what the maintainer said>" [--from <where it came from>]
  work adopt <bundle> --attested "<what they said>"
             [--weight <significant|lightweight>] [--title ...] [--from <where>]
  work list                    every bundle, and whether anything can reach it
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id>
  work park --reason ... | work release --attested "<their words>"
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]

  repo add <owner/name> --path <dir> [--worktree <id>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories
  reconstruct status
  reconstruct scope --repository <owner/name> --revision <sha> [--raw all|selected|none] [--in <path>]...
  reconstruct read <path> | exclude <path> --reason "<why>"
  reconstruct contradiction --subject ... --side ... --side ...
  reconstruct resolve <id> --resolution "<what they decided>"
  reconstruct subject <trajectory-id>
  reconstruct probe --question ... --page <path> --asker <agent> [--passed]
  reconstruct stage            advance when this stage's gate passes
  reconstruct close

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  guards [status]              which runtime guards are on
  guards on|off <stop|write|bash>

  hook write --target <path>   used by the pre-write guard, not by hand

```

## Two you will reach for often

```sh
wfctl decided "<subject>"          # what has already been settled, and where
wfctl knowledge validate           # structural checks over curated pages
wfctl knowledge hash <page>        # the hash both semantic reviews bind to
wfctl debts                        # accepted and not delivered, across every subject
```

## When something is not working

```sh
wfctl doctor
```

Run it when a command behaves in a way the guidance does not explain — a guard
that never fires, retrieval that returns nothing, a traversal that cannot find
a graph. It names what is broken and the command that clears it.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | done |
| 1 | the command was incomplete or not understood |
| 2 | refused — the output names the remedy |

## Two that are not for you

`wfctl hook write` is called by the pre-write guard, not by hand.

`wfctl init knowledge` is the maintainer's. There is no leaf installation: the
agent is bootstrapped in the knowledge repository and edits leaf code from
there, so a source repository is *registered* rather than installed into.

## Guidance, on demand

```sh
wfctl guide            # the topics
wfctl guide <topic>    # one of them
```

Twenty topics, each also delivered automatically when its state is reached. The
guidance ships inside wfctl rather than being copied into the project, so
upgrading the tool upgrades it.
