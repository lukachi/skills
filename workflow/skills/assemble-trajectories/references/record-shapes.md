# Record shapes

The fields a trajectory record carries, and how each pointer is resolved. Every
one of them exists because a prototype needed it.

`wfctl knowledge trajectory check --build` reports every structural failure by
name — a cause claiming a reason with no evidence, a subject pasted from the source
tree, a missing `at`, a missing `now.pinned`, a gap marked accepted, a debt named
for closure with no work, a trajectory naming its own vision, two current visions
on one subject, a cycle. Read what it says rather than working from memory. This
file is the shape to write in the first place.

[The design record](../../TRAJECTORIES.md) carries why each field is here, the two
prototypes that produced them, and the risks still open. It is non-normative and
reading it is not part of an assembly.

## Observation

```yaml
observation:
  id: obs-<slug>
  at: <ISO-8601>              # when the source said it
  read_at: <ISO-8601>         # when this agent read it
  source:
    kind: raw | source-code | version-control | external | maintainer
    resource: <pinned pointer>
  says: <one sentence>
```

`at` and `read_at` are separate because the equipment slice needed both: a design
document asserted things on 2026-07-11 and was read on 2026-08-03. Collapsing them
makes every observation look as old as the reading.

## Finding

```yaml
finding:
  id: fin-<slug>
  situation: <one sentence, past tense>
  period:
    from: <ISO-8601>
    to: <ISO-8601> | null     # null = still true at the last comparison
  observations: [obs-<slug>, ...]
  cause:
    kind: decision | compromise | drift | defect | external | not-found | unknown
    evidence: [<pinned pointer>, ...]   # required unless kind is not-found | unknown
    note: <one sentence>
  scope_limits: [<sentence>, ...]       # what this finding does NOT establish
```

`scope_limits` is a field rather than prose because it is the thing that gets lost.
The equipment candidate carried three; the page written from it dropped all three
and had to be repaired the next day. A field can be checked for survival; a
paragraph cannot.

Observations and findings live inside the file of the trajectory that owns them.
There is no standalone finding: attaching material to a subject means nesting it
under that subject, which is also what "attach it under a subject that does carry
product intent" means for material that carries none.

## Resolving a pointer

Every `resource` and every `cause.evidence` entry is resolved:

| Form | Resolution |
| --- | --- |
| `raw/…`, `changes/…`, any repo-relative path | Must exist. A trailing `#anchor` or `:line` is stripped first |
| `git:<owner>/<repo>@<40-hex>#<path>` | Resolved against a connected checkout of that repository; a shorter commit or a missing `#path` is malformed |
| `intake-case:<id>`, `project-reconstruction:<id>` | The case directory must exist, active or archived |
| Anything else with a scheme | Warned as unresolvable by this build |

A pinned pointer whose repository has no connected checkout is reported as
unverified rather than passed. The first real run of this pipeline produced a typo
in a source path and an earlier build accepted it, which made every other
guarantee here worth less than it looked.

## Trajectory

```yaml
trajectory:
  id: traj-<slug>
  area: <area>
  subject: <name in product language>   # never a path, symbol, or module name
  conceived:
    at: <ISO-8601>
    from: [obs-<slug>, ...]
    statement: <one sentence>
  findings: [fin-<slug>, ...]
  now:
    pinned: <revision>
    read_at: <ISO-8601>
    state: <one sentence>
  edges:
    - kind: part-of | depends-on | succeeds | conflicts
      target: traj-<slug>
      primary: true | false             # part-of only; exactly one true per trajectory
  vision: <decision id> | null
  gaps: [...]
```

A subject that declares `realization.intent: not-applicable` in the curated corpus,
or whose material carries no product intent, produces observations and findings but
never a trajectory. It is evidence under one.

## Vision

A decision record, not a field. Immutable successors, acyclic supersession, one
current record per subject.

```yaml
kind: vision
id: vision-<slug>                # derived from the trajectory, never asked for
trajectory: traj-<slug>
declared_by: human:<id>          # from configuration; nobody retypes their own name
at: <ISO-8601>
method: attested | interactive | token
attested: <the maintainer's own answer, verbatim — attested only>
session: <where they said it>
supersedes: vision-<slug> | ""
receipt: <sha256>
---
<the statement, in the body, because prose belongs where a person reads it>
```

**A vision names its trajectory; a trajectory never names its vision.** One
direction means the two cannot drift apart — the same reason a gap is derived
rather than stored. A trajectory that names a vision is an error.

## Gap

Derived on read, never authored.

```yaml
gap:
  kind: delivery-debt | direction-debt | hole
  statement: <one sentence>
  status: open | to-close | deferred
  work: <changes/ path> | null          # present only when status is to-close
```

`accept` is absent from `status` on purpose: a gap that is right as it stands is a
vision that was wrong, and recording it as an accepted gap loses the difference
between deciding and giving up. Accepting edits the vision and the gap disappears.
