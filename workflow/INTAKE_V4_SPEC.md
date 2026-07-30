# Intake v4: Adjudicated Claim Ledger

## Outcome

Turn continuous untrusted `raw/` input and source-first reconstruction findings
into one explicit, queryable claim model without treating retrieval, raw prose,
generated indexes, or implementation as universal truth.

## Contract

1. Every reviewed source is still frozen by Git path and blob identity and read
   completely.
2. Every material statement becomes an atomic candidate claim.
3. Every candidate records independent dimensions:
   - semantic role;
   - authority class;
   - epistemic disposition;
   - intent state;
   - delivery state;
   - intent/delivery alignment;
   - temporal scope;
   - explicit claim relations;
   - an explicit routing lane and destinations.
4. Current truth, history, proposed change, rejected material, and unresolved
   material are not flattened into one surface.
5. Supersession and contradiction are claim relations. Capture or file order
   never decides truth.
6. A completed intake case requires independent evidence or explicit human
   authority, complete routing, reciprocal relation integrity, and a
   candidate-covering omission-probe audit.
7. `wfctl knowledge build` compiles:
   - the existing deterministic graph of curated Markdown;
   - a disposable deterministic claim ledger and relation graph from intake
     and reconstruction cases, including their lifecycle, review, promotion,
     evidence-kind, and adjudication state.
8. The claim ledger is navigation and audit state, never authority.
9. Existing intake v3 cases are upgraded only through an explicit migration
   command. Conservative defaults remain blocked until an agent reviews and
   signs the migration. Legacy destinations are retained only as migration
   context; the CLI never infers that they are still current and refuses a
   one-step migrate-and-review operation.

## Routing

| Lane | Meaning | Allowed destination |
| --- | --- | --- |
| `current-knowledge` | Confirmed current product or implementation truth | Curated non-index concepts under `knowledge/` |
| `history` | Confirmed former state or durable chronology | Curated decision/history/evolution concepts under `knowledge/` |
| `change` | Reviewed proposal or plan not yet accepted as current truth | `changes/inbox/` or `changes/active/` |
| `case-only` | Rejected, unresolved, or non-durable material | No destination |

`proposed` intent cannot route to current knowledge. `unresolved` cannot leave
the case. A current-knowledge route cannot carry rejected or superseded intent.

## Omission probes

After routing, the agent writes diagnostic questions that can be answered only
from the routed durable outputs, not from `raw/` or the intake case. Every
non-rejected candidate must be covered by at least one probe. A probe records
its expected candidate IDs, answer, inspected output paths, and result.

- `passed` requires a non-empty answer and durable output references.
- A passed multi-candidate probe must inspect a declared routed output for
  every expected candidate.
- `failed` blocks completion and creates repair work.
- `waived` requires an explicit human decision and remains visible.

The gate checks that probes exist and cover candidates. The agent performs the
semantic comparison; the maintainer adjudicates any waiver.

## Deliverables

- [x] Intake case schema v4 and deterministic validation
- [x] Explicit v3-to-v4 migration with review gate
- [x] CLI migration and omission-probe operations
- [x] Shared derived claim ledger and relation graph
- [x] Knowledge build and doctor integration
- [x] Reconstruction claim normalization in the derived ledger
- [x] Updated raw-intake, curation, reconstruction, and routing instructions
- [x] Updated templates and maintainer documentation
- [x] Unit, CLI/runtime, migration, relation, routing, and omission tests
- [x] Full format/type/unit/integration/package verification

## Progress

- [x] Audited the existing intake, reconstruction, curation, knowledge graph,
  CLI, doctor, and test architecture through Graphify and direct source review.
- [x] Verified the pre-change typecheck and 41-test baseline.
- [x] Implementation complete.
- [x] Verification complete: 44 unit tests plus real QMD, Graphify,
  reconstruction, Node, Bun, Deno, and packed-package integration checks.
