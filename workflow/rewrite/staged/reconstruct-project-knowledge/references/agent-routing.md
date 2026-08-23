# Adaptive agent routing

Use this contract when planning, dispatching, escalating, reviewing, or resuming
reconstruction workers and final assurance. It controls cognitive effort; a
workstream role still controls semantic responsibility.

## Selection order

1. Keep deterministic inventory, hashing, coverage accounting, and schema
   validation in `wfctl`. Do not spend an agent on mechanical work.
2. Decide whether the remaining question is independently delegable. Keep
   tightly coupled or shared-context work with the orchestrator.
3. Classify a delegated question by workload and choose the minimum profile
   that can satisfy its quality gates.
4. Let the current host map the abstract profile to an available model and
   reasoning effort. Never persist provider-specific model names as workflow
   requirements.
5. Escalate from observable evidence or review signals. Do not use an agent's
   self-confidence as the quality gate.

## Workloads and minimum profiles

| Workload | Meaning | Minimum profile |
| --- | --- | --- |
| `exploration` | Bounded navigation, structural mapping, or evidence collection without a whole-project conclusion | `fast` |
| `analysis` | Interpret one repository, community, runtime surface, or bounded historical question | `balanced` |
| `synthesis` | Reconcile multiple sources, repositories, contracts, or product meanings | `deep` |
| `review` | Adversarially challenge omissions, contradictions, negative claims, or semantic overreach | `deep` |

`fast`, `balanced`, and `deep` are host-neutral capability requests. They do
not name a model family, provider, token budget, or price tier. A host may route
them automatically. When it cannot, choose the closest available model and
effort. Record the concrete choice when known; otherwise record `host-auto` and
`profile-default` honestly.

## Initial routing

Prefer `fast` only when all of these are true:

- the question is narrow and repeatable;
- success is externally checkable through receipts, inventory, or a bounded
  output contract;
- the worker does not decide product intent, cross-repository meaning, or a
  negative project-wide claim.

Use `balanced` for bounded semantic interpretation with clear evidence and one
primary responsibility slice. Use `deep` immediately for ambiguity, multiple
source lanes, cross-repository synthesis, contradictions, intent recovery,
high-risk negative claims, or independent semantic review. Do not start weak
when no reliable quality gate can detect a weak answer.

Create the packet with its routing decision:

```sh
wfctl knowledge reconstruct workstream create <case-id> <workstream-id> \
  --title "<bounded outcome>" \
  --objective "<semantic question>" \
  --role <semantic-role> \
  --workload <exploration|analysis|synthesis|review> \
  --profile <fast|balanced|deep> \
  --routing-reason "<why this is sufficient>" \
  --wave <number>
```

When claiming, pass the host's effective selection if it is visible:

```sh
wfctl knowledge reconstruct workstream claim <case-id> <workstream-id> \
  --by <worker> --host <agent-host> --run-id <run-id> \
  --model <model-or-host-auto> --effort <effort-or-profile-default>
```

Each claim appends its profile and effective host selection to durable execution
history. A retry never erases which worker, model, and effort produced the
earlier result.

## Quality-driven escalation

Treat routing as a cascade, not a one-time guess. Record a response when any of
these signals affects the result:

- `contradiction`: evidence sources disagree;
- `insufficient-evidence`: a material conclusion remains unexplained;
- `negative-claim`: the packet claims that something does not exist or happen;
- `cross-boundary-scope`: the question materially expands beyond its assigned
  repository, community, surface, or raw case;
- `review-rework`: an independent reviewer returns the packet;
- `maintainer-authority`: product intent or another authority boundary needs a
  maintainer decision.

Available responses are:

- `stronger-profile`: rerun at a strictly higher profile;
- `new-workstream`: create and reference a separately reviewable evidence
  question with `--target-workstream`;
- `maintainer-review`: record the authority response the evidence cannot
  provide; only `human:<maintainer-id>` may record this action;
- `retained-uncertainty`: preserve the unresolved result and prevent overclaim;
- `same-profile`: correct bounded execution or formatting without pretending a
  stronger model is necessary.

For a stronger-profile response, return submitted work as `rework` first, then
record the escalation before a new claim:

```sh
wfctl knowledge reconstruct workstream escalate <case-id> <workstream-id> \
  --by <orchestrator> --trigger <trigger> --action stronger-profile \
  --to-profile <balanced|deep> --reason "<observable reason>"
```

For other responses, omit `--to-profile`. Supply `--target-workstream` only for
`new-workstream`, after creating that still-planned packet in a later wave with
the originating packet as an explicit dependency. Escalations are bound to the
attempt they answer; an old or pre-claim event cannot clear a later result.
Contradictions, unexplained results, negative claims, material explored scope,
maintainer-authority questions, and repeated attempts cannot be accepted until
the matching current-attempt escalation exists.

## Review boundary

Worker output remains a hypothesis at every profile. A stronger model does not
replace pinned evidence, complete coverage accounting, orchestrator fan-in, an
independent critic, or maintainer authority. Review the actual receipts and
scope before accepting the packet.

The final whole-reconstruction critic is an assurance role, not another normal
research packet. The critic returns a read-only verdict; the orchestrator
attributes and records it directly in the parent case's
`orchestration.independent_review` block so it remains outside the worker set it
audits. Agent or separate-session assurance must request `review` / `deep` and
record the routing reason plus effective host, run ID, model, and reasoning
effort. A maintainer assurance records human authority instead and does not
invent model provenance.

Do not build or claim a learned model router from these labels alone. Preserve
requested profile, effective host selection, escalation history, and review
outcome first. Only evaluate learned routing after real accepted and rejected
workstreams provide a representative quality dataset.

Existing version 2 packets retain their original lifecycle contract so an
active reconstruction is not stranded by an upgrade. Do not fabricate routing
history for them. New packets use version 3; if adaptive rerouting is needed for
legacy work, start a new version 3 packet with an explicit relationship.
Likewise, orchestration version 2 keeps its original final-assurance fields;
new cases use orchestration version 3 and the explicit review/deep provenance.

## Closing a workstream

Submit each finished packet with `wfctl knowledge reconstruct workstream
submit` and have a different actor run `wfctl knowledge reconstruct
workstream review`. Before acceptance, respond to contradictions,
insufficient evidence, negative claims, or review rework with `wfctl
knowledge reconstruct workstream escalate`; choose a stronger profile, a
narrower follow-up workstream, maintainer review, retained uncertainty, or
an explicitly justified same-profile correction. Mark orchestration complete
only after every workstream
is accepted or has
a review-approved `cancelled` disposition, blocked work is either resolved
or represented by an honest partial outcome, the
orchestrator's synthesis audit passes, and a distinct fresh actor records
the independent review. Record `assurance` as `independent-agent`,
`separate-session`, or `maintainer`, plus the actual host run ID when
applicable. `wfctl knowledge reconstruct check` rejects missing,
unfinished, unreviewed, unreferenced, or path-leaking workstreams.
