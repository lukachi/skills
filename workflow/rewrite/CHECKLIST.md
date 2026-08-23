# Rewrite checklist

Every line is a decision taken in the design conversation. Implementation is
verified against this file, not against memory.

## A. Fundamentals

- [x] A1 wfctl is a watcher and a director: it observes state and emits the next instruction.
- [x] A2 No instruction depends on the model deciding to load it. Zero model-decided branches in the instruction path.
- [x] A3 Skills are removed as a delivery mechanism. Content ships as a versioned asset bundle the CLI reads; `wfctl upgrade` refreshes it.
- [x] A4 Content is re-cut from role to state: the CLI prints only the slice that applies now.
- [x] A5 Conversational content is dropped, not relocated.
- [x] A6 Installation is knowledge-repository only. No leaf profile, no leaf install.
- [x] A7 The agent is bootstrapped in the knowledge repo and writes into leaf paths as an orchestrator.
- [x] A8 Hooks fire session-wide and resolve the leaf binding from the edit's target path.

## B. flow_id

- [x] B1 `flow_id` is a fence, not an identity. It groups the settled workload.
- [x] B2 A flow may contain several change bundles, one bundle, or one reconstruction.
- [x] B3 While a flow is open, work outside it is out of scope.
- [x] B4 Checkpoint, handoff, bindings, receipts, counters all bind to the flow.
- [x] B5 Recovery is: read the id, read its record, resume. Never conversation memory.
- [x] B6 On completion the checkpoint flushes and the id clears. The next round opens a new one.

## C. Checkpoint / brief / handoff

- [x] C1 One word, one thing: `wfctl checkpoint` writes the flow's working state.
- [x] C2 The **brief** is its index rendering, emitted by the SessionStart hook.
- [x] C3 The **handoff** is its full body — the detailed recall.
- [x] C4 The brief prints the bound flow's handoff in full, every other flow as one line, so truncation cannot hide what matters.
- [x] C5 Pointing at the handoff is not enough; the next command refuses until it is receipted.
- [x] C6 Blockers are derived from the flow's position in its step sequence, never stored.
- [x] C7 The checkpoint recalls working state and nothing else.
- [x] C8 Checkpoints are frequent. There is no session-management exit.

## D. Cases

- [x] D1 Two cases only: `work` (changes) and `reconstruction`.
- [x] D2 Intake is absorbed into reconstruction.
- [x] D3 Raw material lives at `reconstruction/raw/`, owned by that module.
- [ ] D4 `knowledge/` may never cite it; the validator's path ban moves to the new location.  _(not yet: reconstruction deferred)_
- [x] D5 No routing or classification step. The maintainer starts a case explicitly.
- [x] D6 Two independent state machines.
- [x] D7 Significant vs lightweight survives inside `work start` as a recorded answer, not an inference.

## E. How the CLI talks

- [x] E1 The CLI names what must be settled and explains what it means.
- [x] E2 The agent puts the question to the maintainer in its own words, in product language.
- [x] E3 The CLI is never a script relayed to the maintainer.
- [x] E4 Commands refuse on the missing answer, never on the phrasing.
- [x] E5 Every refusal names the exact command that clears it.
- [x] E6 The CLI helps; it does not schedule.

## F. Recall

- [x] F1 The 24-item checklist exists, in eight groups (A precedent, B language, C ownership, D prior art, E state of truth, F work in flight, G evidence quality, H absence).
- [x] F2 An item is answered only with an answer, the route that produced it, and its source.
- [x] F3 Which items are required is decided by flow state, by the tool.
- [x] F4 Counters per flow: QMD queries, Graphify traversals, greps, whole-file reads, items answered.
- [x] F5 Counters are evidence, never the gate.
- [x] F6 Minimum tool floor per step: align ≥1 QMD; anything touching code ≥1 Graphify; absence claim ≥3 routes.
- [x] F7 The counter line is printed unprompted at every gate, with the missing items named.
- [x] F8 Queries use the project's vocabulary — canonical terms and aliases — not the agent's paraphrase.
- [x] F9 Between gates there are no checks. That is the room for real work.

## G. Attestation

- [x] G1 Attestation is dropped almost everywhere; it only moved responsibility off the agent.
- [x] G2 It survives for a declared direction and for a decision that overrides evidence.
- [x] G3 Everywhere else, the decision is recorded, not the wording.

## H. Issues

- [x] H1 Sized by scope and coherence. Never "for one agent session".
- [x] H2 Pocock's "one slice at a time" is kept; "one ticket per session" is dropped.
- [x] H3 Blocking edges, frontier computation and cycle validation are removed.
- [x] H4 Issues carry a status and the agent's own notes.
- [x] H5 The CLI retrieves them well: filter, read, mark, annotate.
- [x] H6 Claims bind repository and worktree, never branch and commit.
- [x] H7 Not stopping between units belongs to the Stop guard, never to issue selection.

## I. Implementation

- [x] I1 The write hook fires on the first write of an issue.
- [x] I2 Afterwards it fires only when a file is touched that no traversal or query has covered.
- [x] I3 Editing inside known ground is silent.
- [x] I4 It delivers the issue's scope, its seams, what is out of bounds, and the counters.

## J. Verification

- [x] J1 The fixed point predates the work: the framing at its approved digest, and the source at the first claim's revision.
- [x] J2 Nothing is re-derived at verification time; moved criteria are themselves a finding.
- [x] J3 The review is delegated to a subagent. The implementing agent cannot run it.
- [x] J4 The reviewer receives the diff, the framing, and the repository — never the implementation's reasoning.
- [x] J5 Prompts are inverted: produce the failure, do not confirm the success.
- [x] J6 Every attack is an executable test. The subagent writes it, runs it, and returns source, output and verdict.
- [x] J7 Tests and review are ephemeral. Nothing is added to the suite.
- [x] J8 "Looks correct" is not an allowed answer; a failed attack must state what was tried.
- [x] J9 Zero findings and zero recorded attacks blocks, as an empty review.
- [x] J10 The stub check: replace the new code with a no-op — any test still passing was testing itself.
- [x] J11 Lenses: intent, correctness, contract, failure paths, state & data, delivery reality, test integrity.
- [x] J12 The diff is also read backwards: from each changed file to what the framing said about it.
- [x] J13 An unresolved finding blocks closure; a finding may be accepted with a recorded reason, never silently.

## K. Closure and promotion

- [x] K1 Closure asks nobody.
- [x] K2 Completion returns to the maintainer only when delivery no longer matches the approved framing.
- [x] K3 Promotion is the maintainer's decision.
- [x] K4 The agent never types a promotion path. `work promotion draft <page>` creates the file and prints it.
- [x] K5 The write hook refuses a curated page created outside the bundle's `promotion/`.
- [x] K6 A partial outcome keeps its drafted pages promotable.

## L. Findings during work

- [x] L1 Findings go to the capture inbox, not to a new bundle.
- [x] L2 `work start` refuses while a flow is open.
- [x] L3 The write hook refuses a bundle directory created by hand.
- [x] L4 Bundles are opened only at flow start, with the maintainer.

## M. Sequencing

- [x] M1 Shared layer and the changes flow first; reconstruction later.
- [x] M2 The shared layer must not harden around change-only assumptions.

## N. Known defects to fix in the rewrite

- [x] N1 Receipts cannot be refreshed on a closed bundle (DISC-001).
- [x] N2 Branch movement deadlocks claim, checkpoint and rebind (DISC-004, 006, 007) — removed by H6.
- [x] N3 A partial close drops drafted pages into the archive (DISC-003).
- [x] N4 Parked flows still appear in the resume selector (DISC-005).
- [x] N5 A rebind destroys the record's start commit and accounting (DISC-007).
- [x] N6 Refusals name neither what changed nor the move that clears it (E5).


## Migration record

Nineteen skills were re-cut into `templates/guidance/` and removed. Six are
staged in `rewrite/staged/` because the states their content belongs to do not
exist yet.

| Skill | Fate |
| --- | --- |
| align-project-knowledge | `work/aligned.md` |
| analyze-with-graphify | `recall/structure.md` |
| curate-engineering-knowledge | `curate/engineering.md` |
| curate-product-knowledge | `curate/product.md` |
| grill-project-decisions | `decide/interview.md` |
| implement-work-item | `work/implement.md` + verbatim references |
| manage-project-work | `work/opened.md`, `work/discoveries.md` |
| model-project-domain | `decide/domain-language.md` |
| prototype-project-decision | `decide/prototype.md` + verbatim references |
| research-project-context | `decide/research.md` + verbatim reference |
| shape-project-direction | `work/wayfind.md` |
| specify-project-change | `work/framed.md` |
| split-project-change | `work/split.md` |
| verify-knowledge-quality | `curate/quality.md` |
| verify-project-work | `work/verified.md`, `work/closed.md` |
| show-project-work | deleted; upstream format catalogue kept as `references/drawing.md` |
| explore-project-knowledge | deleted — presentation only, no gate |
| grill-me | deleted — the interview it invoked is now `decide/interview.md` |
| wait-what | deleted — register only, no gate |

Upstream verbatim material is preserved: `tests.md`, `mocking.md`, `logic.md`,
`ui.md`, `smell-baseline.md`, and the drawing catalogue.

Three things changed in the re-cut rather than being carried across: issue
blocking edges are gone, "sized for one session" is gone from both splitting and
wayfinding, and attestation is gone from framing approval.

## Status

`[x]` implemented and tested · `[~]` partial · `[ ]` not yet.

Core modules: `src/core/{types,flow,recall,steps,checkpoint,gates,guidance,paths,verify,write-hook,commands}.ts`.
Guidance bundle: `templates/guidance/`.
Tests: `tests/core-*.test.ts` — 53 passing. The binary is `src/core/cli.ts`.
