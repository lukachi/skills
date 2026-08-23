# CLI reference

## Audience

Workflow authors and automation. In ordinary use the maintainer types two
commands — `wfctl init knowledge` and nothing else — and the agent runs the
rest. Every command prints what the current state demands and the command that
records it, so the surface below is documentation rather than something anyone
needs to memorise.

## Orientation

```sh
wfctl brief                 # the state of this repository, and what awaits whom
wfctl handoff [<flow>]      # the full recall body for a flow
```

`brief` is emitted by the session-start hook. It prints the bound flow's handoff
in full and every other open flow as one line.

## Checkpoint

```sh
wfctl checkpoint --summary "<one line>" --handoff "<the body>" \
                 --last "<last completed action>" --next "<exact next action>" \
                 [--todo "<small job>"]...
```

One act, two renderings: the brief is the index, the handoff is the body. A
checkpoint missing any of its four fields is refused — an empty one recalls
nothing.

## Work

```sh
wfctl work start --title "<what this is>" --weight <significant|lightweight>
wfctl work step <opened|aligned|framed|split|implement|verified|closed|promoted>

wfctl work issue create --title "<what it delivers>" [--satisfies AC-01]...
wfctl work issue list
wfctl work issue note <id> --note "<what you learned>"
wfctl work issue claim <id> --repository <owner/name> [--worktree <id>]
wfctl work issue complete <id>

wfctl work park --reason "<why starting now is premature>"
wfctl work release --attested "<their own words>"

wfctl work verify --review <artifact>
wfctl work close --outcome <completed|partial|abandoned>
wfctl work promotion draft "<area>/<page>.md"
wfctl work promotion list

wfctl capture "<what you found>" [--awaits]
```

A claim records repository and worktree identity and **never** branch or commit.
Every recorded binding deadlock in the previous implementation came from pinning
a revision that then moved under the record.

Units carry a status and the agent's own notes. There are no blocking edges and
no frontier: where order genuinely matters, it goes in the notes.

`work verify` reads a review artifact produced by a **different** agent. wfctl
does not spawn it — what the tool checks is that the reviewer was not the acting
agent and that every attack carries a test that was actually run.

`work close` refuses while a unit is claimed. A record holding drafted pages
waits in the promotion queue whatever its outcome; one with nothing to say
archives directly.

`capture` is the only place a finding met during work can go. Opening a second
flow is refused while one is open, and so is creating a record directory by
hand.

`work start` refuses while a flow is open, and refuses without a weight. `work
step` refuses when the current step's recall is short, or when its precondition
step has not been recorded.

## Recall

```sh
wfctl recall list
wfctl recall answer <item> --answer "<what you found>" \
                    --route <qmd|graphify|grep|read|maintainer> --source "<where>"
wfctl recall route <route> [--covered <path>]...
```

An answer with no source is refused. `recall route` records that a retrieval
route was used and what it covered, which is also what tells the write guard
which files are known ground.

## Flow

```sh
wfctl flow close            # flush the checkpoint and drop the fence
```

## Installation

```sh
wfctl init knowledge [--target <dir>]
```

There is one profile. `wfctl init leaf` is refused with what replaced it: the
agent is bootstrapped in the knowledge repository and edits leaf code from
there.

Installation writes the guidance bundle, the runtime guards, the hook settings
and the managed agent block. Settings entries wfctl did not write are preserved,
as is everything outside the managed markers. A file the maintainer edited is
reported rather than replaced.

## Hooks

```sh
wfctl hook write --target <path>    # used by the pre-write guard, not by hand
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | done |
| 1 | the command was not understood |
| 2 | refused — the output names the remedy |

## Repositories

```sh
wfctl repo add <owner/name> --path <dir> [--worktree <id>] [--checkout <name>]
wfctl repo list
wfctl repo remove <owner/name> [--worktree <id>]
```

Its own operation, run after installation and again whenever a checkout appears.

## Reconstruction

```sh
wfctl reconstruct start
wfctl reconstruct status
wfctl reconstruct scope --repository <owner/name> --revision <sha> \
                        [--raw all|selected|none] [--in <path>]...
wfctl reconstruct read <path>
wfctl reconstruct exclude <path> --reason "<why>"
wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"
wfctl reconstruct resolve <id> --resolution "<what they decided>"
wfctl reconstruct subject <trajectory-id>
wfctl reconstruct probe --question "<...>" --page <path> --asker <agent> [--passed]
wfctl reconstruct stage
wfctl reconstruct close
```

`stage` advances when the current stage's gate passes, and prints the guidance
for the stage it entered.

## Trajectories

```sh
wfctl trajectory append --subject "<product subject>" --summary "<what happened>" \
                        --axis <intent|delivery|vision> [--change <id>]
wfctl trajectory list
wfctl trajectory show <subject>
```
