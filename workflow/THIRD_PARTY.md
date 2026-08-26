# Third-party provenance

One upstream source is adapted here, pinned, with a machine-readable manifest
under `vendor/`. It is MIT for the material used. This file said "four" and
listed one, which is the kind of drift an attribution record cannot afford. The rule is the same for every one of them: **adapt the text, never
paraphrase it.** A paraphrase keeps what a gate can check and drops what only a
person can judge, and this file exists because that happened once already.

| Upstream | Vendored at | What it governs here |
| --- | --- | --- |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | `vendor/mattpocock/` | The delivery flow: wayfinding, specification, units, TDD, review, grilling, domain modeling, prototyping, research |

## Matt Pocock skills

The leaf project-work flow directly reuses and modifies selected skills from
Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills). This lineage is
part of the public design, not an implementation detail.

`wfctl` does not install the original suite beside its own. It integrates the
derived behavior into one installed skill and the guidance the CLI prints at its
own call sites, so agents have one router, one central change bundle and one
completion gate. Consumer installation never fetches mutable upstream prompts.

**Where the text lives changed in 0.9.0.** Twelve local skills under `skills/`
became one skill at `templates/skill/wfctl/` plus guidance under
`templates/guidance/`. Every path in this file and in the manifest still named
the old tree; the text had moved rather than gone, and the four verbatim files
are intact. The paths below are the current ones, checked by a test.

The reviewed upstream source is pinned to revision
`9c9f36ccd3995266cd675468af71639c8dde1ec5`, reviewed 2026-08-17. The
machine-readable mapping lives in
[`vendor/mattpocock/upstream.json`](vendor/mattpocock/upstream.json).

## Method

Each local skill **adapts** the upstream text rather than paraphrasing it. It
keeps the upstream structure, section names, leading words, and behavioural
instructions, and edits only what this workflow changes: the issue tracker becomes
the central change bundle, tracker operations become `wfctl` commands, and the
review gates are named where upstream names a tracker label.

The previous pin, `2ab958093e83e0ec752e6c1c5932da465bf23e0c`, was recorded as
derived but was in practice a paraphrase. The artifacts and state machines were
carried over and the conversational instructions were dropped — relentless
interviewing, the shared-understanding bound, grilling as the default ticket type,
referring to work by name rather than by id, and the maintainer's own entry point.
This revision restores them from the upstream text.

## Direct derivations

Local paths are repository-relative and are asserted to exist by
`tests/rewrite-regression.test.ts`.

| Upstream source | Where it lives now | Retained behavior | Main `wfctl` modifications |
| --- | --- | --- | --- |
| `wayfinder` | `templates/guidance/work/wayfind.md` | Destination named first; wayfinding is finding the way, not charging at the destination; fog of war; out of scope never graduates | The map is the bundle's `change.md`; claim and complete are `wfctl work issue claim` and `wfctl work issue complete`; printed by the CLI at the step that needs it rather than opened as a skill. **Dropped:** HITL/AFK ticket types, chart and work modes, one ticket per session — they went with the tracker they described |
| `to-spec` | `templates/guidance/work/framed.md` | Synthesize, do not interview; problem and solution from the actor's perspective; extensive user stories; implementation decisions without voting | Spec is `change.md`; stable acceptance IDs derived from the user stories; the framing is approved by the maintainer's own words, recorded by `wfctl work step framed`. **Dropped:** the `work ask` and `work approve` commands, which no longer exist |
| `to-tickets` | `templates/guidance/work/split.md`, `references/issue-design-contract.md` | Tracer-bullet vertical slices and their rules; a completed slice is demonstrable on its own; expand–migrate–contract for wide refactors | Units created by `wfctl work issue create` inside the bundle; acceptance coverage and repository scope gate-checked. **Dropped:** blocking edges and the frontier — removed deliberately, because a resolved map can be worked in an order no dependency graph would predict |
| `implement`, `tdd` | `templates/guidance/work/implement.md`, `references/tests.md`, `references/mocking.md` | Pre-agreed seams; one slice at a time; refactoring outside the loop; what a good test is; the three anti-patterns; **`tests.md` and `mocking.md` verbatim** | The exact leaf and worktree are claimed before any edit; no automatic commit |
| `code-review` | `templates/guidance/verify/adversarial.md`, `templates/skill/wfctl/references/verification.md`, `references/smell-baseline.md` | Pin the fixed point; two axes as separate agents with their briefs; **the Fowler smell baseline verbatim**, with repository override; report both without reranking | Fixed point comes from the first delivery claim's revision; the spec source is `change.md`; every attack is an executable test returned in a checked artifact; nobody authorises the review — it is the second half of implementing |
| `grilling`, `grill-me`, `grill-with-docs` | `templates/guidance/decide/interview.md`, `templates/skill/wfctl/references/deciding.md` | Interview relentlessly until shared understanding; design tree; rounds and the frontier; the whole frontier asked in one numbered round with recommendations; facts are the agent's job and decisions the maintainer's | Facts looked up through the recall routes before anything is asked; their confirmation is what the framing gate waits for. The three upstream entry points collapse into one, because the workflow always maintains the domain model while grilling |
| `domain-modeling` | `templates/guidance/decide/domain-language.md` | Active discipline; challenge the glossary; sharpen fuzzy terms; stress-test with scenarios; record terms as they resolve | The working glossary is the bundle's domain language; a promoted term is a curated page, and a decision is a decision page serving both roads |
| `prototype` | `templates/guidance/decide/prototype.md`, `references/logic.md`, `references/ui.md` | Throwaway code that answers a question; the logic and UI branches; the six shared rules; keep the prototype as a primary source; **`logic.md` and `ui.md` verbatim** | The answer lands in the bundle rather than a ticket resolution; the prototype is registered with `wfctl artifact add` |
| `research` | `templates/guidance/decide/research.md`, `references/research-contract.md` | Primary sources only, every claim followed to the source that owns it; findings written with their citations | Findings land in the owning record or a capture; an external source authorizes an external fact only |

## Withdrawn

`wait-what` (`skills/productivity/wait-what/SKILL.md`) was dropped in the 0.9.0
rewrite and not replaced. It was a user-invoked re-pitch in Simplified Technical
English; nothing in the current tree carries it. This file and the manifest both
listed it as though it still shipped.

## Embedded influences

Upstream `handoff` behavior is split three ways locally: unowned material becomes
a capture, material this work should settle becomes a finding, and resumable
session state becomes the checkpoint's handoff field.

Upstream `writing-for-agents` is the reference these skills are written against —
information hierarchy, completion criteria, leading words, and the negation,
duplication, sprawl and no-op failure modes. It is not installed; it governs how
the installed skills are authored.

## External tool integrations

QMD and Graphify are external tools that `wfctl` coordinates; they are not
derived sources and are not bundled into the `wfctl` package.

| Tool | Role in the workflow | Installation and truth boundary |
| --- | --- | --- |
| [QMD](https://github.com/tobi/qmd) | Local lexical and semantic retrieval over Markdown knowledge | Installed separately under its upstream license. `wfctl` configures project collections and asks the installed QMD version for its official native skill, which the pinned `skills` CLI copies into the selected agent scope. Search results and rebuildable indexes help discovery; they do not establish project truth. |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Source-code graph, structural navigation, communities, and relationship queries for leaf repositories | Installed separately under its upstream license together with its official native skill. `wfctl` checks the integration and refreshes checkout-local graph output, but does not package Graphify. Generated graphs guide inspection; they never replace pinned source evidence or maintainer review. |

Their names here document operational dependencies and ownership boundaries;
they do not imply that their source code is incorporated into `wfctl`.

## Distribution boundary

The canonical modified sources live under `templates/skill/wfctl/` and
`templates/guidance/`. The published `wfctl` package contains those sources, this
provenance record, the pinned mapping, and the upstream license. `wfctl init`
copies the skill into the repository; the guidance is not copied, because the CLI
prints it from the package at the call site that needs it.

There is one profile. An earlier version had several and installed twenty-four
skills; both are gone, and so is the `upgrade` command — a reinstall is the upgrade.

This file is the single human-readable attribution and modification record.
The upstream license is retained once at
[`vendor/mattpocock/LICENSE`](vendor/mattpocock/LICENSE); exact machine-readable
lineage remains in the pinned manifest at
[`vendor/mattpocock/upstream.json`](vendor/mattpocock/upstream.json), whose paths
are checked by the test suite.
