# Project Workflow

This is the maintainer-facing operating guide installed by `wfctl`.

- Profile: `{{PROFILE}}`
- Project knowledge: `{{KNOWLEDGE_PATH}}`

The workflow is a collaboration protocol. The agent inventories and verifies
evidence, maintains records, and presents bounded decisions. The maintainer
supplies product intent, resolves authority conflicts, and approves material
commitments.

## What the maintainer operates

Routine CLI use belongs to the agent. It runs `wfctl work ...` and
`wfctl knowledge ...`, edits structured records, and reports failures. You
review framing, missing authority, material decisions, completion, and current
knowledge claims.

Manual commands remain available for bootstrap, automation, diagnostics, or
recovery. `wfctl init` installs or repairs; `wfctl upgrade` previews and applies
workflow releases; `wfctl check` diagnoses an installation.

## Trust boundary

| Surface | Purpose | Trust |
| --- | --- | --- |
| `raw/` | Continuous append-only dumps and captures | Untrusted clue source; never evidence |
| `intake/` | Git-frozen raw review cases | Operational audit trail; never cited by knowledge |
| `changes/active/` | One proposal/spec/progress record per significant task | Current execution agreement |
| `changes/archive/` | Closed change records with reviews and receipts | Historical record qualified by outcome and reviews |
| `changes/inbox/` | Lightweight handoffs awaiting triage | Non-authoritative input to the normal change or curation flow |
| `knowledge/` | Curated OKF concepts | Default current project knowledge |
| source repositories | Executable implementation | Implementation authority at an exact revision |

Raw text can tell the agent what to investigate. It cannot support a claim,
even when several raw files agree. A trusted derivative must cite the
maintainer decision, pinned code, runtime receipt, reviewed archived change, or
primary external source that independently established the claim.

## Two inputs, one promotion gate

Raw dumps and ongoing work stay separate until verification:

1. A bounded `raw/` scope is frozen to exact Git blobs in `intake/`.
   QMD helps locate relationships; the agent then reads every frozen file and
   extracts candidate claims.
2. Significant ongoing work produces a living record under `changes/active/`
   and fresh implementation receipts.
3. Both lanes verify each claim against its proper authority.
4. The maintainer adjudicates intent, normative decisions, and unresolved
   conflicts.
5. Only then does the agent update `knowledge/` and run the strict validator.

Unresolved raw candidates remain in intake. `knowledge/uncertainties/` is only
for live questions supported by trusted current evidence.

## Graphify boundary

Graphify is mandatory for source-code navigation and relationship analysis.
The routing skill checks that the official native `graphify` skill is active,
invokes any more specific Graphify skills, and stops code work if they are
missing. The agent then directly inspects the actual source and checks at the
bound Git revision; Graphify output itself is not authority.

Graphify is not the analyzer for Markdown, raw intake, or OKF concepts. QMD
provides BM25, semantic, and hybrid retrieval for those surfaces; direct file
reading, Git coverage, provenance, and validation remain authoritative.

## QMD retrieval boundary

`wfctl` installs a project-local `.qmd/index.yml` in the knowledge repository.
Its collections are intentionally separated:

- `knowledge` is the only default search surface;
- `changes`, `intake`, and `raw` require explicit collection selection.

The QMD index is disposable. Search rank and snippets help navigation but prove
neither corpus coverage nor truth. The agent runs QMD from the knowledge root,
updates the index after content changes, and reads selected files directly.

## OKF and the stricter workflow profile

`knowledge/` follows
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
OKF is a portable Markdown format, not an approval workflow. This project adds
a stricter profile:

- explicit `status`, `generated`, provenance, and current verification;
- explicit authority classes so deterministic validation can distinguish
  normative, implementation, historical, and external claims;
- claim-level source IDs joined to Markdown footnotes;
- pinned repository revision and path for code sources;
- human verification for intent and normative decisions;
- explicit supersession or deprecation reason;
- reciprocal acyclic decision lineages with one stable current record;
- no raw path, source, link, or footnote in current knowledge.

`stable` is lifecycle, not automatic truth. A material edit updates
`generated.at` and invalidates older verification.

## Choose the work route

Use the full workflow when work may change observable behavior, domain meaning,
interfaces, schemas, protocols, data or control flow, persistent state,
security, reliability, operations, architecture, ownership, or coordination
across components or repositories.

Use the lightweight path only when behavior and contracts clearly remain
unchanged. Size is not the classifier. When ambiguous, the agent explains the
impact, recommends a route, and asks you. A compact handoff change record may
preserve useful lightweight findings without imposing the full gate.

Accepted lightweight handoffs go to `changes/inbox/` through
`wfctl work handoff`. They retain exact source/worktree metadata but remain
non-authoritative until triaged.

## Review gates

1. **Routing** — only when significance is ambiguous.
2. **Framing** — outcome, scope, exclusions, acceptance criteria, and new
   decisions before significant implementation. Clear existing instructions
   can satisfy this; material re-scoping reopens it.
3. **Authority** — whenever evidence cannot establish current intent,
   chronology, or which source governs.
4. **Knowledge** — material claims about vision, product meaning, architecture,
   ownership, contracts, policy, decisions, supersession, or accepted risk.
5. **Completion** — acceptance results, directly inspected implementation,
   fresh checks, deviations, risks, and the knowledge delta or no-update reason.

An approval is explicit. Silence and continued conversation are not approval.
The agent records a stable `human:<reviewer-id>` and timestamp; you do not edit
YAML manually.

## Review packet

Each request should contain:

1. **Decision** — the exact claim, framing, or outcome.
2. **Evidence** — pinned sources and fresh verification.
3. **Conflicts** — contrary evidence, gaps, deviations, or risk.
4. **Recommendation** — the agent's preferred answer and reasoning.
5. **Requested response** — approve, correct, or defer.

Deferral is valid. The agent preserves uncertainty instead of guessing.

## Significant-work loop

1. Classify the task.
2. Immediately create and bind a `shaping` record with `wfctl work start`.
3. Use `wfctl work status` to distinguish the exact implementation `Code root`
   from the central `Spec` path.
4. Record the current request, constraints, open questions, and next action.
5. Analyze source code through Graphify and direct inspection.
6. Align with current `knowledge/`.
7. Resolve blocking authority questions and obtain framing approval.
8. Set the record active. Implement only in the bound code root while updating
   the same change file after every material maintainer turn.
9. Reconcile every criterion against the actual implementation.
10. With normal maintainer authorization, preserve the implementation
    in the bound Git commit; `wfctl` never commits automatically.
11. Run final checks against that clean commit and record its revision and
    worktree identity.
12. Promote durable verified truth into `knowledge/`, or record why no current
    knowledge changed.
13. Run `wfctl knowledge validate --target <Knowledge root>` for promoted
    concepts.
14. Obtain completion approval, run `wfctl work verify`, and archive the honest
    outcome with `wfctl work close`.

A material turn changes a requirement, constraint, alternative, decision,
scope, evidence, risk, question, or next action. The agent updates mutable
current sections and appends a proposed/approved/rejected/deferred/superseded
ledger entry before continuing. After interruption or compaction, it runs
`wfctl work status`, reads the entire spec, and resumes from its recorded state
instead of chat memory.

Partial or abandoned outcomes are valid historical records. They must never be
relabeled as completed. A completed close also requires a clean bound checkout,
so the archived revision actually contains the verified implementation; the
workflow never commits automatically.

## Routine health

```sh
wfctl check --target .
wfctl upgrade --target . --dry-run
```

Generated assets with local edits become explicit conflicts and are never
silently overwritten.
