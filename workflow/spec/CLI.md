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
wfctl work promotion draft "<area>/<page>.md"
wfctl work promotion list
```

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

## Reconstruction

Not yet rebuilt. The reconstruction case is the next pass; its previous surface
is described in [RECONSTRUCTION.md](RECONSTRUCTION.md), which documents the
implementation this rewrite replaced rather than what ships today.
