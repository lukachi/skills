# Reconstruction orchestration

Apply this rule only inside an initialized knowledge repository while running
or resuming `reconstruct-project-knowledge`.

- Keep one orchestrator as the sole writer of the parent reconstruction case,
  repository dossiers, final coverage dispositions, candidate synthesis, and
  curated `knowledge/` documents.
- Use platform-native subagents only when the frozen frontier contains
  genuinely independent, read-heavy research units or would pollute one
  context window. Do not spawn workers merely because subagents exist.
- Route compute independently from semantic ownership. Classify every worker
  packet as `exploration`, `analysis`, `synthesis`, or `review`, then request
  the minimum sufficient host-neutral profile: `fast`, `balanced`, or `deep`.
  Analysis cannot use `fast`; synthesis and adversarial review require `deep`.
  Let the host select the concrete model when appropriate and record either its
  known model/effort or `host-auto` / `profile-default` honestly. Preserve an
  append-only execution entry for every claim so retry provenance is not lost.
- Escalate from observable evidence and review signals, never self-confidence.
  Contradictions, insufficient evidence, negative claims, cross-boundary scope,
  review rework, and maintainer-only authority require a durable response. A
  response may select a stronger profile, create a narrower workstream, request
  maintainer review, retain explicit uncertainty, or justify a same-profile
  correction. A `new-workstream` response references an already registered
  still-planned packet in a later wave that depends on the origin; a
  `maintainer-review` response is recorded by `human:<maintainer-id>`. Bind
  every response to the attempt it answers and preserve review history. Do not
  accept a packet while a current-attempt response is absent.
- Partition by semantic outcome: a cohesive repository/community slice, an
  entrypoint or runtime surface, a cross-repository flow or contract, a bounded
  raw-history question, or an adversarial coverage review. Alphabetical file
  ranges may distribute complete reading, but must never define the semantic
  conclusion.
- Before dispatch, create one unique durable `workstreams/*.md` packet per
  research worker from the supplied template. Give the worker the exact knowledge root,
  case root, source root, repository identity, pinned commit, coverage slice,
  prerequisite full reads, objective, non-goals, output contract, stop
  conditions, and effort boundary.
- Qualify packet coverage slices as `<repository>#<exact-path-or-id>` and bind
  raw slices to parent-linked intake case IDs. The completion gate rejects
  unqualified or out-of-frontier assignments.
- A worker must read its complete packet, parent case, relevant dossier and
  frontier slice, and explicit dependency packets before analysis. It may use
  any safe read-only navigation and follow adjacent evidence outside the
  assigned slice. Record material scope expansion in `explored_context`; scope
  defines responsibility, not visibility. Before relying on source as final
  evidence, create attributed pinned receipts through `wfctl knowledge
  reconstruct read` or approved raw reads through `wfctl knowledge case read`.
  It may update only its own packet and must not edit another worker's packet,
  the parent case, dossiers, coverage JSON directly, curated knowledge, or
  product source.
- Treat worker output as an untrusted evidence packet. The orchestrator checks
  its exact receipts, rejects overclaims, merges accepted findings into the
  owning dossier or parent case, and then updates final coverage states.
- A finding that one lane is unreliable narrows that lane and widens no other.
  Reject any packet or plan that answers a degraded source by making a different
  source authoritative for intent; that is the ranked-source error with a new
  winner. Keep reading the degraded lane for terminology, chronology, and leads,
  and where no lane establishes intended meaning, carry `intent: unknown` to
  maintainer adjudication instead of assembling intent from what remains.
- Preserve every dispatched packet. If evidence makes one unnecessary, keep it
  referenced as `cancelled` and record an accepted orchestrator review; never
  delete or unreference it to manufacture a clean frontier.
- A claimed packet whose worker never submitted — the normal outcome when a
  session ends while it is running — cannot be re-claimed or reviewed, by
  design: resuming abandoned work would inherit conclusions nobody checked.
  Cancel it with a note naming what was attempted and what is unknown, then plan
  a fresh packet for the remaining scope. Before ending a session deliberately,
  bring every claimed packet to `submitted` or cancel it; leaving one claimed
  strands the scope behind a state no later session can move.
- Run fan-out in bounded waves. Start broad, fan in, compare results with the
  complete deterministic frontier, and create later workers only for concrete
  gaps, contradictions, cross-repository links, or high-risk negative claims.
- Use a per-resource write barrier during a wave: never let a worker and the
  orchestrator mutate the same intake case or packet concurrently. Accepted
  packets from completed workers may be reviewed while unrelated workers keep
  reading. Final dossier, parent-case, candidate, and curated-knowledge
  synthesis waits until every workstream in the wave reaches a terminal review
  state. Runtime locks protect receipt commands; they do not make arbitrary
  Markdown edits concurrent-safe.
- Never let one repository worker define a whole-project capability. Trace a
  discovered Area, capability, flow, or contract across every relevant
  dossier before synthesis.
- After synthesis, use a fresh read-only critic when the host supports it. The
  critic checks omissions, claim-to-evidence soundness, contradictions,
  unjustified `structural-only` or `irrelevant` states, negative claims, and
  hidden scope drift. It does not rewrite the answer it reviews. The
  orchestrator attributes the verdict under the parent case's
  `independent_review`; this final assurance role is not a normal workstream and
  must remain outside the worker set. Route agent or separate-session assurance
  as `review` / `deep` and record its host, run, model, and reasoning effort.
  Record maintainer assurance as human authority without invented model
  provenance; an actor label alone is not evidence of independence.
- If subagents are unavailable, the orchestrator follows the same wide-to-
  narrow waves serially and records `single-agent` with an honest reason. Do
  not pretend fan-out occurred.
- Bound concurrency, total workstreams, and retries before dispatch. Stop and
  ask the maintainer after repeated identical failure, unavailable authority,
  or a blocked source; do not create workers endlessly.
- Receipt commands use ignored runtime locks and distinct worker actors so
  concurrent reads cannot silently overwrite each other. Workers never bypass
  those commands by editing shared case or coverage state directly.

The Git manifest and coverage ledgers prove accounting, not semantic truth.
Graphify guides navigation, workstreams preserve isolated findings, the
orchestrator reconciles them, and maintainer review remains the authority gate.
Legacy version 2 packets may finish under their original contract; never invent
adaptive-routing history while resuming them.
