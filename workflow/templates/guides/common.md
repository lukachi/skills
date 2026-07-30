# Project Workflow

This is the maintainer-facing operating guide installed by `wfctl`.

- Profile: `{{PROFILE}}`
- Project knowledge: `{{KNOWLEDGE_PATH}}`

The workflow is a project partnership system. It keeps the maintainer and agent
inside one shared project model from product intent to verified delivery. The
maintainer can recover and navigate that model directly; the agent uses the
same model to investigate, implement, verify, and maintain continuity.

It provides two linked, first-class roads:

- the **maintainer/product road** explains purpose, capabilities, behavior,
  rules, delivery, and evolution in human language;
- the **engineering road** explains architecture, ownership, source
  realization, contracts, operations, and verification.

Neither road is derived from the other. Shared Areas, changes, and decision
history keep them aligned. The agent inventories and verifies evidence,
maintains records, and presents bounded decisions. The maintainer supplies
product intent, resolves authority conflicts, and approves material
commitments.

## What the maintainer operates

Your normal interface is conversation. Describe the outcome in project
language; the agent chooses and runs `wfctl`, QMD, Graphify, Git inspection,
and record-maintenance operations. You do not need command syntax, record IDs,
generated paths, or structured-file schemas.

The normal optional manual CLI entry points are `wfctl init knowledge`, `wfctl
init leaf`, and `wfctl upgrade` from the repository being upgraded; the setup
agent can run them too. `--target` and other commands remain available for
agents, automation, diagnostics, recovery, and workflow contributors. You
review framing, missing authority, material choices, completion, and current
knowledge claims.

After initialization, ask in ordinary language: “help me understand this
project,” “process raw,” “reconstruct the baseline,” “explain this Area,”
“shape this broad direction,” “research this external constraint,” “implement
this change,” or “check the workflow.” The installed skills translate those
requests into the complete internal procedure. You do not need to invoke a
skill by name.

## Trust boundary

| Surface | Purpose | Trust |
| --- | --- | --- |
| `raw/` | Continuous append-only dumps and captures | Untrusted clue source; never evidence |
| `intake/` | Git-frozen raw review cases | Operational audit trail; never cited by knowledge |
| `reconstruction/` | Source-first project baselines and audits | Qualified review records; opt-in, not default truth |
| `changes/active/` | One proposal/spec/progress record per significant task | Current execution agreement |
| `changes/archive/` | Closed change records with reviews and receipts | Historical record qualified by outcome and reviews |
| `changes/inbox/` | Lightweight handoffs awaiting triage | Non-authoritative input to the normal change or curation flow |
| `knowledge/` | Curated OKF concepts | Default current project knowledge |
| source repositories | Executable implementation | Implementation authority at an exact revision |

Raw text can tell the agent what to investigate. It cannot support a claim,
even when several raw files agree. A trusted derivative must cite the
maintainer decision, pinned code, runtime receipt, reviewed archived change, or
primary external source that independently established the claim.

## Multiple inputs, one promotion gate

Raw dumps, source reconstruction, and ongoing work stay separate until
verification:

1. A bounded `raw/` scope is frozen to exact Git blobs in `intake/`.
   QMD helps locate relationships; the agent then reads every frozen file and
   extracts candidate claims.
2. A bounded reconstruction binds exact clean leaf revisions, uses Graphify
   plus direct source, creates repository dossiers, and separates observed
   implementation from accepted intent.
3. Significant ongoing work produces a living record under `changes/active/`
   and fresh implementation receipts.
4. Every lane verifies each claim against its proper authority.
5. The maintainer adjudicates intent, normative decisions, and unresolved
   conflicts.
6. Only then does the agent update `knowledge/` and run the strict validator.

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

## Compiled knowledge and claim graphs

`wfctl knowledge build` validates `knowledge/` and compiles only authored
Markdown links, typed `x-wf.relations`, Area ownership, and decision lineage
into `.workflow/current/knowledge-graph.json`. The ignored file is a
rebuildable navigation artifact: it adds no inferred truth and is never edited
or cited as authority.

The same build writes `.workflow/current/claim-ledger.json` from intake and
reconstruction cases. It contains atomic claim states and only explicit
supersession, contradiction, refinement, implementation, and derivation
relations. It helps trace adjudication and chronology, but never decides truth
or compensates for a relation the agent failed to record.

QMD discovers candidate documents by meaning. The compiled graph expands those
candidates through explicit reviewed relationships. The claim ledger traces
operational lineage. Graphify handles source code. In every case, the agent
reads the selected source documents directly.

## QMD retrieval boundary

`wfctl` installs a project-local `.qmd/index.yml` in the knowledge repository.
Its collections are intentionally separated:

- `knowledge` is the only default search surface;
- `changes`, `intake`, `reconstruction`, and `raw` require explicit collection
  selection.

The QMD index is disposable. Search rank and snippets help navigation but prove
neither corpus coverage nor truth. The agent runs QMD from the knowledge root,
updates the index after content changes, and reads selected files directly.
The official native `qmd` skill must be active in the current agent session;
installation on disk requires a session restart before it counts.

`wfctl check` distinguishes two readiness levels:

- BM25 lexical readiness is required and depends on a healthy project-local
  index refreshed by `qmd update`;
- semantic/hybrid readiness depends on local models and current embeddings.

Missing models or embeddings are warnings while BM25 remains healthy. Model
download and embedding work happen only when semantic retrieval is needed.

## OKF and the stricter workflow profile

`knowledge/` follows
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
OKF is a portable Markdown format, not an approval workflow. This project adds
a stricter profile:

- explicit `status`, `generated`, provenance, and current verification;
- explicit `view`, `purpose`, and `audience` so product and engineering
  knowledge cannot silently collapse into one document;
- explicit authority classes so deterministic validation can distinguish
  normative, implementation, historical, and external claims;
- explicit intent, delivery, and alignment state for product-bearing concepts;
- claim-level source IDs joined to Markdown footnotes;
- pinned repository revision and path for code sources;
- human verification for intent and normative decisions;
- explicit supersession or deprecation reason;
- reciprocal acyclic decision lineages with one stable current record;
- a semantic quality receipt with independent authority/truth and
  reader-communication axes bound to the current content hash;
- stakeholder sections and a no-code boundary for product documents;
- technical coverage and linked product meaning for engineering documents;
- no raw path, source, link, or footnote in current knowledge.

`stable` is lifecycle, not automatic truth. A material edit updates
`generated.at` and changes the deterministic knowledge content hash. Older
verification and quality receipts no longer match. The agent runs the semantic
quality reviews and records fresh axis plus verification receipts only after computing
`wfctl knowledge hash --concept <path>`.

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
`wfctl work handoff`. Leaf handoffs retain exact source/worktree metadata;
knowledge handoffs retain project-only intake/reconstruction proposals and
their claim references. Both remain non-authoritative until triaged.

Read-only explanation, history, ownership, and health questions run
automatically. Raw processing, whole-project reconstruction, durable external
research, semantic curation, and broad direction shaping are deliberate:
unless you already requested the outcome, the agent explains the gap and asks
one focused confirmation before starting.

For a consequential initiative whose dependent decisions are still unclear,
the agent uses direction shaping before implementation planning. It records
the destination, domain language, decision frontier, uncertainty, tradeoffs,
and next bounded change in the same living spec used later. It never creates a
parallel strategy source.

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
When several decisions are needed, the agent asks one at a time and updates
the living record before continuing.

## Significant-work loop

1. Classify the task.
2. Immediately create and bind a `shaping` record with `wfctl work start`.
3. Use `wfctl work status` to distinguish every exact implementation `Code
   root` from the central `Spec` path. Project-only work has no code root.
4. Record the current request, constraints, open questions, and next action.
5. Analyze source code through Graphify and direct inspection in every bound
   repository; skip this only when the record has no code scope.
6. Align with current `knowledge/`.
7. Resolve blocking authority questions and obtain framing approval.
8. Set the record active. Implement only in the bound code root while updating
   the same change file after every material maintainer turn.
9. Reconcile every criterion against the actual implementation.
10. With normal maintainer authorization, preserve the implementation
    in the bound Git commit; `wfctl` never commits automatically.
11. Run final checks against every clean commit and record one revision and
    worktree receipt per repository.
12. Promote durable verified truth into `knowledge/`, or record why no current
    knowledge changed.
13. Obtain completion approval, mark the record completion-ready, and compute
    current content hashes for promoted stable concepts.
14. Run `wfctl knowledge validate --target <Knowledge root>` for promoted
    concepts.
15. Run `wfctl knowledge build --target <Knowledge root>` to prove links,
    authored relationships, and stable-concept reachability.
16. Run `wfctl work verify`, and archive the honest
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

Ask the agent to “check the workflow environment” or “upgrade the workflow.”
It runs diagnostics or previews the upgrade, explains conflicts in human
terms, and requests only the decisions needed. Generated assets with local
edits become explicit conflicts and are never silently overwritten.
