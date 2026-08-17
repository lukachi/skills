# Third-party provenance

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
