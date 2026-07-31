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
`2ab958093e83e0ec752e6c1c5932da465bf23e0c`. The machine-readable mapping lives
in [`vendor/mattpocock/upstream.json`](vendor/mattpocock/upstream.json).

## Direct derivations

| Upstream source | Local skill | Retained behavior | Main `wfctl` modifications |
| --- | --- | --- | --- |
| `wayfinder` | `shape-project-direction` | Destination-first map, decision issues, named resolutions, fog, frontier, and deliberate invocation | Central knowledge bundle; local Markdown issue graph; full-read receipts; explicit transition into specification; source implementation forbidden during Wayfinder |
| `to-spec` | `specify-project-change` | Synthesize earned context instead of restarting the interview; define product outcome, exclusions, technical and testing decisions | Canonical `change.md`; stable acceptance IDs; Graphify and knowledge alignment; maintainer framing review; resolved-map synthesis |
| `to-tickets` | `split-project-change` | Tracer-bullet issues, explicit blockers, complete descriptions, and user-reviewed granularity | Bundle-local issue graph; acceptance coverage; exact repository scope; cycle validation; no competing leaf or external tracker |
| `implement` and `tdd` | `implement-work-item` | Implement from an approved spec or ticket, use behavior-first test cycles, run focused and broad checks, then review | Exact leaf/worktree claim; Graphify-first inspection; hash-bound checkpoints; evidence-backed issue resolution; no automatic commit |
| `code-review` | `verify-project-work` | Separate contract/spec and engineering/standards review axes | Every bundle file accounted at a current hash; stable acceptance matrix; exact revision receipts; knowledge promotion; maintainer completion gate |

## Embedded influences

The review also incorporated selected practices from `domain-modeling`,
`grilling`, `grill-with-docs`, `research`, `prototype`, and `handoff`. Those
practices are embedded as bounded issue types, conversation rules, curation
steps, pending captures, or active checkpoints. In particular, upstream
`handoff` behavior is split locally: unowned material becomes a capture, while
resumable active state remains with its owning change or issue. These are not
copied or installed as standalone skills and do not create a second tracker.

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
[the installed-skills guide](docs/02-skills-and-provenance.md) for consumer
paths and update behavior.
