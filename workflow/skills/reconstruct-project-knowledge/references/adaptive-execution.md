# Adaptive execution plan

Read this before choosing between one session and bounded fan-out, before
creating or dispatching a workstream packet, and before reviewing an
escalation. It expands the `Plan adaptive execution` step in the skill.
[The routing contract](agent-routing.md) owns workload/profile selection.

The default strategy is one orchestrator with bounded workers, not a free-form
swarm. Decide the execution only after inspecting the complete frozen frontier:

- choose `single-agent` when the work is small, tightly sequential, depends on
  one shared context, or the current host has no safe subagent facility;
- choose `orchestrator-workers` when there are genuinely independent read-heavy
  repository, raw, structural, or review axes, or the corpus cannot fit one
  context without material loss;
- never use agent count as a goal. Record a proportional `max_parallel`, total
  workstream cap, retry cap, and reason in `case.md` before dispatch.

Use platform-native subagents when available. Keep durable routing host-neutral:
classify each packet as `exploration`, `analysis`, `synthesis`, or `review` and
request `fast`, `balanced`, or `deep` according to
[the routing contract](references/agent-routing.md). Let the host map that
profile to a concrete model and reasoning effort. Record the effective choice
when known or the explicit `host-auto` / `profile-default` fallback. Do not
hard-code an agent product, model name, worktree feature, or topology as a
workflow requirement. A normal checkout is as valid as a worktree; every
worker receives the exact already-bound source root at dispatch time.

Partition research by independently reviewable semantic outcome, not by
alphabetical file range. Suitable first-wave units include:

- one cohesive repository/community and its entrypoints, runtime surfaces,
  tests, and boundaries;
- an unusual executable surface such as migrations, generators, background
  jobs, protocols, plugins, or operations;
- one bounded raw-intake or historical question after raw scope approval;
- a structural coverage scout whose output is a map, not a product conclusion.

After fan-in, create narrower units for discovered cross-repository flows,
contracts, Areas, capabilities, contradictions, negative claims, or unexplained
coverage. One repository's worker never defines the whole-project meaning.

For every research worker, create and register a unique durable packet with `wfctl
knowledge reconstruct workstream create`, then claim it for the concrete host
run with `wfctl knowledge reconstruct workstream claim`. The CLI uses
[the workstream template](assets/reconstruction-workstream.md), updates the
parent list under a case lock, and records the reported host and run ID. The
dispatch prompt must include:

```sh
wfctl knowledge reconstruct workstream create <case-id> <workstream-id> \
  --title "<bounded outcome>" --objective "<semantic question>" \
  --role <role> --workload <exploration|analysis|synthesis|review> \
  --profile <fast|balanced|deep> --routing-reason "<why sufficient>" \
  --wave <number> [--repository/--file/--community/--surface/--raw-case ...]
wfctl knowledge reconstruct workstream claim <case-id> <workstream-id> \
  --by <worker> --host <agent-host> --run-id <actual-session-id-or-unavailable:reason> \
  --model <model-or-host-auto> --effort <effort-or-profile-default>
```

- exact knowledge root, case root, bound source root, repository identity, and
  pinned commit;
- the exact files, communities, surfaces, raw cases, or questions it owns;
- the parent case, relevant dossier and frontier slice, and only explicit
  prerequisite workstreams to read fully;
- the objective, non-goals, required tools, evidence contract, output schema,
  stop conditions, and effort boundary;
- explicit permission to explore all connected evidence with safe read-only
  tools, while updating only its own packet;
- the requirement to record material cross-slice exploration in
  `explored_context` and turn final source evidence into attributed receipt IDs
  with `wfctl knowledge reconstruct read` or approved raw reads with `wfctl
  knowledge case read`.

Workers must not edit the parent case, repository dossiers, intake cases,
other workstreams, coverage JSON directly, curated knowledge, or leaf source.
Shared coverage and raw-read commands serialize their receipt updates, but
only the orchestrator assigns final `files`, `community`, `surface`, and
dossier dispositions. A worker summary is
an untrusted research packet until the orchestrator checks its receipts and
marks `review.status: accepted`. A dispatched packet that becomes unnecessary
remains referenced as `status: cancelled` with an accepted review explaining
why; never delete it or leave it unreferenced to hide work.

Qualify every leaf coverage item in packet frontmatter as
`<repository>#<exact-path-or-id>`. The close gate resolves files, communities,
and surfaces against the frozen ledgers and resolves raw case IDs against the
parent reconstruction. An unqualified, out-of-scope, or merely guessed item
does not satisfy assignment accounting. The assigned slice is an ownership
contract, not a search wall: follow relevant callers, callees, contracts, and
cross-repository links, then record every material expansion and why it was
needed. `result.evidence_refs` accepts only receipt IDs produced for that
worker by a pinned read; prose paths and invented references are rejected.

Every escalation answers one concrete attempt. Material `explored_context`,
`result.authority_questions`, contradictions, negative claims, unexplained
results, and review rework require their matching current-attempt response. A
`new-workstream` target must still be planned, belong to a later wave, and name
the originating packet as a dependency. Every review remains in
`review_history`; accepting a retry never erases the review that returned it.

Version 2 workstreams created by an earlier workflow remain valid under their
original lifecycle and may be resumed without invented routing metadata. Apply
adaptive escalation only to new version 3 packets.

Run bounded waves:

1. **Map:** reconcile the Git inventory, Graphify structure, runtime surfaces,
   current knowledge, and approved optional-input frontier.
2. **Breadth:** dispatch independent repository, structural, and raw workstreams.
3. **Fan-in:** review every packet, update owning dossiers and coverage, record
   cross-project discoveries, and expose gaps without smoothing conflicts.
4. **Depth:** dispatch only the cross-repository, historical, contradiction, or
   omission work now justified by evidence.
5. **Synthesis:** one orchestrator constructs whole-project candidates and
   records a claim-to-evidence and contradiction audit.
6. **Independent review:** a fresh read-only critic checks coverage omissions,
   unsupported claims, hidden conflicts, invalid negative claims, and unjustified
   `structural-only` or `irrelevant` states. Reopen bounded workstreams for real
   gaps; do not ask the critic to rewrite its own target. This final whole-case
   critic returns a read-only verdict; the orchestrator attributes and records
   it in `orchestration.independent_review`, not as a normal workstream, so the
   critic remains outside the worker set it audits. Route an agent or
   separate-session critic as `review` / `deep` and record its routing reason,
   effective host, run ID, model, and reasoning effort.

Use per-resource write barriers during fan-out: never overlap worker and
orchestrator Markdown edits to the same intake case or packet. The orchestrator
may validate a submitted packet while unrelated workers remain read-only, but
must wait for every wave packet to be accepted, returned, blocked, or
review-cancelled before final shared dossier, parent-case, candidate, or curated
knowledge synthesis. CLI receipt mutations are locked; normal Markdown edits
are not.

If the host cannot supply a fresh critic, stop before completed close and ask
the maintainer for review or continue in a fresh session. Record actual
execution; never claim a worker or independent review that did not occur.
