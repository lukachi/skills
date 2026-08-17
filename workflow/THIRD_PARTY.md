# Third-party provenance

Four upstream sources are adapted here, each pinned and each with a
machine-readable manifest under `vendor/`. All four are MIT for the material
used. The rule is the same for every one of them: **adapt the text, never
paraphrase it.** A paraphrase keeps what a gate can check and drops what only a
person can judge, and this file exists because that happened once already.

| Upstream | Vendored at | What it governs here |
| --- | --- | --- |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | `vendor/mattpocock/` | The delivery flow: wayfinding, specification, tickets, TDD, review, grilling, domain modeling, prototyping |
| [`humanlayer/skills`](https://github.com/humanlayer/skills) | `vendor/humanlayer/` | The formats an agent draws with instead of describing |
| [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) | `vendor/ayghri/` | The structure of the maintainer-review rule |
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | `vendor/juliusbrussee/` | When a register switches itself off, and that a style never grows its own output |

## Matt Pocock skills

The leaf project-work flow directly reuses and modifies selected skills from
Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills). This lineage is
part of the public design, not an implementation detail.

`wfctl` does not install the original suite beside its own suite. It integrates
the derived behavior into one set of local skills so agents have one router,
one central change bundle, one issue graph, and one completion gate. Consumer
installation never fetches mutable upstream prompts.

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

| Upstream source | Local skill | Retained behavior | Main `wfctl` modifications |
| --- | --- | --- | --- |
| `wayfinder` | `shape-project-direction` | Destination named first; plan don't do; refer by name; map as index; HITL/AFK ticket types with grilling as the default; fog of war and the fog-or-ticket test; out of scope never graduates; chart and work modes; one ticket per session | Map and issues live in `changes/active/<id>`; claim, block, complete and frontier become `wfctl work` commands; bound-repository accounting and knowledge alignment gate the map's finish |
| `to-spec` | `specify-project-change` | Synthesize, do not interview; seams sketched and confirmed with the maintainer; problem and solution from the actor's perspective; extensive user stories; implementation and testing decisions; prototype-snippet exception | Spec is `change.md`; stable acceptance IDs derived from the user stories; framing rendered by `wfctl work ask` and recorded by `wfctl work approve`; resolved-map collapse |
| `to-tickets` | `split-project-change` | Tracer-bullet vertical slices and their rules; prefactor first; blocking edges and the frontier; expand–migrate–contract for wide refactors sized by blast radius; quiz the maintainer on granularity and edges | Issues created by `wfctl work issue create` inside the bundle; acceptance coverage, repository scope and cycle validation are gate-checked |
| `implement`, `tdd` | `implement-work-item` | Pre-agreed seams; red before green; one slice at a time; refactoring outside the loop; what a good test is; the three anti-patterns; `tests.md` and `mocking.md` verbatim | Exact leaf/worktree claim; Graphify-first inspection; hash-bound checkpoints and discovery ledger; evidence-backed resolution; no automatic commit |
| `code-review` | `verify-project-work` | Pin the fixed point; two axes as parallel subagents with their briefs; the Fowler smell baseline with repository override; side-by-side reporting without reranking | Fixed point comes from the first delivery claim's revision; the spec source is `change.md`; bundle accounting, acceptance matrix, drafted pages, closure and the promotion gate follow |
| `grilling` | `grill-project-decisions` | Interview relentlessly until shared understanding; design tree; rounds and the frontier; the whole frontier asked in one numbered round with recommendations; facts are the agent's job and decisions the maintainer's; do not act before their confirmation | Facts looked up through `wfctl knowledge decided`, QMD and Graphify first; each round persisted to the decision ledger and checkpoint; their confirmation is what the framing gate waits for |
| `grill-me`, `grill-with-docs` | `grill-me` | User-invoked entry point that calls grilling and domain modeling together | The two upstream entry points collapse into one, because this workflow always maintains the domain model while grilling |
| `domain-modeling` | `model-project-domain` | Active discipline; challenge the glossary; sharpen fuzzy terms; stress-test with scenarios; cross-reference with code; record terms as they resolve; the three tests before a decision earns its own page | The working glossary is the bundle's `Domain language` section; the promoted glossary is a Domain Concept page; an ADR is a decision page |
| `prototype` | `prototype-project-decision` | Throwaway code that answers a question; the logic and UI branches; the six shared rules; keep the prototype as a primary source; `logic.md` and `ui.md` verbatim | The answer lands in the Wayfinder issue resolution or the bundle's decision ledger; the throwaway branch is linked as a bundle artifact |
| `wait-what` | `wait-what` | User-invoked re-pitch, with context, in Simplified Technical English, in the project's own language | The language comes from curated knowledge; the reader test in `maintainer-review` is named |
| `research` | `research-project-context` | Background subagent; primary sources only, every claim followed to its owner | Findings land in the owning record or a pending capture; an external source authorizes an external fact only |

## HumanLayer `show-me`

Pinned to `3c2629142c5d437428269b1b722b08c0b87f574d`, reviewed 2026-08-17.
Manifest: [`vendor/humanlayer/upstream.json`](vendor/humanlayer/upstream.json).

| Upstream source | Local skill | Retained behavior | Main `wfctl` modifications |
| --- | --- | --- | --- |
| `show-me` | `show-project-work` | Every format and its worked example, verbatim: pseudocode, call tree, component tree, shallow file tree, Mermaid, the four diff shapes, the whole block, one focused HTML file. Place the visual next to the short text it supports; keep only what answers the current question; use one, use several, not all | The HTML artifact is written under the bundle's `artifacts/` and linked from the record that raised the question; a packet rendered by `wfctl work ask` is never replaced by a visual; a diff takes its fixed point from the first delivery claim's revision |

The examples are kept exactly as upstream wrote them. An example rewritten into
this project's own nouns stops demonstrating a format and starts demonstrating
this project, which is the failure that produced the corpus this replaces.

The reasoning is upstream's own, in
[Why Software Factories Fail](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/wsff.md#program-design):
a call-stack tree, a file-tree diff and a signature sketch each settle a decision
that would otherwise be made implicitly during review, at the most expensive
possible time to change your mind. This workflow's framing gate exists for the
same reason.

## `i-have-adhd` — the shape of the review rule

Pinned to `2ed064090711586e0c97a2fbbf15465fe8f1808b`, reviewed 2026-08-17.
Manifest: [`vendor/ayghri/upstream.json`](vendor/ayghri/upstream.json).

The structure was taken whole and the rules are this project's own. What
transfers: a model of the reader stated first and the rules derived from it;
numbered rules each carrying a Bad and a Good; a named list of overrides instead
of an implied one; a persistence clause; and a mechanical pre-send check.

`.claude/rules/maintainer-review.md` had the same material as prose — rationale
without examples, judgement without a checklist, and no statement that it still
applies on the fortieth turn. Under the pressure of a fresh finding, the
judgement lost.

Dropped: time estimates, because a gate has no human clock; and restating state
every turn, because `wfctl brief` and the checkpoint already carry it durably and
a second copy is a second thing to keep true.

## `caveman` — auto-clarity and the anti-inflation rule

Pinned to `766dce6b1394ebb56a3090748d5a0240a5aefb36`, reviewed 2026-08-17.
Manifest: [`vendor/juliusbrussee/upstream.json`](vendor/juliusbrussee/upstream.json).
Only `skills/` was read; the engine, proxy and related runtime are BSL-1.1 and
nothing under those paths is derived from or referenced.

Two mechanisms transfer. **Auto-clarity**: named conditions under which the
compressed form suspends itself — a security consequence, an irreversible action,
a sequence whose order could be misread, an ambiguity compression created, and a
maintainer who asked to clarify or repeated a question. **The anti-inflation
rule**: a style is a substitution and never an addition, and a shortening that
costs the reader more than it saves is not a shortening.

Not taken: the compression itself. Upstream's axis is tokens; this workflow's is
comprehension, and upstream already excludes anything persisted outside the
conversation — which here is every record. No intensity levels are carried, so
there is one register switch and `wait-what` holds it.

## Embedded influences

Upstream `handoff` behavior is split locally: unowned material becomes a capture,
while resumable session state becomes the checkpoint's handoff field.

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

The canonical modified sources live under `workflow/skills/`. The published
`wfctl` package contains those sources, this provenance record, the pinned
mapping, and the upstream license. During `wfctl init` or `wfctl upgrade`, the
pinned `skills` CLI copies only the profile-selected local skills plus QMD's
version-matched native skill.

This file is the single human-readable attribution and modification record.
The upstream license is retained once at
[`vendor/mattpocock/LICENSE`](vendor/mattpocock/LICENSE); exact machine-readable
lineage remains in the pinned manifest. See
[the setup guide](docs/01-setup.md) for consumer paths and update behavior.
