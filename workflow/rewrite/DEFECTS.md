# What six test agents found

Five reports in; one outstanding. Every defect below was reproduced against the
built binary in a disposable fixture.

## The four that make the design not work

**1. `close` skips the entire gate chain, in both cases.**
`work close` never calls `assertReached` or `assertRecall`; `reconstruct close`
checks only that the directory exists. A flow at `opened` with zero recall, no
framing, no units and no review closes as `completed`. A reconstruction that
read nothing, with an open contradiction and no trajectory, archives as a
completed pass. Every gate this rewrite exists for is optional if you skip
straight to closing.

**2. The review gate gates nothing.** `verify()` validates the artifact and
discards the result — nothing is written to the flow — so `work step verified`
has no review precondition at all. Adversarial verification is decorative.

**3. The `wfctl` bin never runs.** The main-module guard compares
`import.meta.url` against `argv[1]`'s basename; invoked as `wfctl` that is
`wfctl` vs `cli.js`, so the body is skipped and the process exits 0 in silence.
Every npm/bun install produces this. Consequently the SessionStart hook prints
nothing and the write guard permits every write — **the entire hook layer is
inert**, which is the half of the design a command cannot reach.

**4. Refusals name commands that do not exist.** At least nine: `work align`,
`work frame --approve`, `work verify --attack`, `work finding accept`,
`work approve --stage completion`, `work status`, `flow list`,
`reconstruct status` for contradiction ids, and the assemble refusal that names
`trajectory append` when only `reconstruct subject` clears it. `brief` — the
surface called authoritative — prints one of them. An agent following only what
the tool prints dead-ends at the framing gate.

## Guards that do not guard

- **The write hook's "silent on known ground" is dead code.** It gates on
  `writtenThisUnit`, populated from a `--written` flag nothing ever passes. Every
  edit re-emits the full implement page; the "outside what any traversal covered"
  branch is unreachable.
- **The Stop guard parses `brief --json`**, a flag that does not exist. It gets
  prose, `JSON.parse` throws, the guard falls silent. Its remediation text names
  `work checkpoint` and `resumable`, neither of which exists.
- **`knowledge/` is reachable three ways**: a case variant (`Knowledge/`), a
  symlink, and the absolute path through the unresolved root.
  `changes/promotion/` and `changes/archive/` are unguarded entirely, so a
  bundle fabricated by hand appears in `promotion list` and is promotable
  without ever passing a flow.
- **The flow fence falls to `rm .workflow/flows/current`.** `openFlow` consults
  the pointer, never `listFlows` — and `brief` then prints both open flows.
- **`flow close` bypasses the claimed-unit refusal** that `work close` enforces,
  stranding a bundle no flow can close.
- **A parked flow can be closed**; `close` never calls `assertNotParked`.
- **`work close` leaves the current pointer**, so a closed, archived flow keeps
  accepting units, captures, steps and checkpoints.
- **The probe and review independence checks fall to `WFCTL_ACTOR=`.** Documented
  as weak, but a self-asked probe also wedges a case permanently: nothing can
  remove it.
- **`reconstruct start` has no fence.** It overwrites an open case in place,
  discarding coverage, contradictions and probes, and re-observes the baseline —
  so a pass begun on an empty corpus reports "re-checking an existing baseline".

## Unvalidated input

- `--route`, `--axis`, `--weight` and the promote target all accept any string.
  `--route qmd2` satisfies the gate and touches no floor; attacker strings become
  persisted object keys; `--axis` defaults to `delivery`, so an intent recorded
  without the flag counts as delivered and the gap silently vanishes.
- **An attack whose own output says the work broke is accepted.** `Attack.broke`
  is never inspected. A finding marked blocking passes too.
- **Tampered or malformed state produces raw stack traces**, not refusals — only
  `GateRefusal` is caught in `run()`. This includes the review artifact, which is
  untrusted input produced by an external agent.
- **`flag()` consumes the next flag as a value**: `work start --title --weight
  significant` stores the title as `--weight`.
- **`capture` refuses any finding beginning with `--`** — and capture is the only
  sanctioned outlet for a finding while a flow is open.
- **`promotion draft` with no argument creates a file named `promotion`**, after
  which no draft can ever be created in that bundle and close archives it
  silently.

## Identity and concurrency

- **`subjectId` strips everything outside `[a-z0-9]`**, so any subject with no
  ASCII alphanumerics becomes `""` and all of them merge into one hidden
  `trajectories/.json`. Truncation at 60 characters collides too, attributing one
  subject's delivery to another.
- **Flow ids collide**: two same-day titles that slug identically overwrite,
  losing units, checkpoint and history, and the second flow adopts the first's
  bundle.
- **No locking.** Six concurrent `issue create` calls all report success; three
  units survive, with reused ids, so a claim points at different work.
- **`work promote` always promotes `queued[0]`**, whatever record the maintainer
  was describing.
- **`--raw all` does nothing observable**; every path must be listed with `--in`.
- **Scope pins are self-asserted.** Git is never invoked: an unregistered
  repository, an invented revision and `../../../../etc/passwd` are all accepted.

## What held

Zero crashes on the happy paths across ~120 invocations; refusal wording is
good. The recall answer and source legs, the second-flow refusal on the honest
path, the claimed-unit refusal in `work close`, self-review, empty review, an
attack with empty output, the subject requirement on promote, the park fence
against claims, `release` without attestation, path traversal in the two places
it is checked, duplicate registration, the adjudicate gate, the crawl coverage
gate, and the absence of any stored gap field.

Installation passes in full: maintainer content preserved, edited files reported
rather than clobbered, a second run writing nothing, leaf refused.

## The shape of it

The gates that fire are well built. What is missing is that the terminal
commands do not run them, the delivery layer that was supposed to be
unconditional does not run at all, and a large fraction of the remedies point at
commands that were never implemented. Every one of those is the same failure:
**the design was verified at module level and never end to end.**
