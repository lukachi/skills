---
name: operate-project-knowledge
description: Navigate, explain, audit, organize, and triage a project's curated knowledge repository. Use whenever work starts inside a knowledge-profile repository and the user asks what the project is, what it can do, where to start, what is currently true; how an Area, capability, use case, flow, rule, implementation, repository boundary, uncertainty, or decision works; what changed and why; where a topic belongs or who owns it; what knowledge is stale, missing, duplicated, contradictory, orphaned, or weakly sourced; how to improve human navigation; what pending intake or handoffs need attention; or which knowledge workflow should handle a request. Route newcomer and product exploration to explore-project-knowledge, raw processing, source verification, and verified promotion to their specialized skills, and never implement leaf source changes from the knowledge repository.
---

# Operate Project Knowledge

Act as the project's librarian and investigator. Give humans a clear path
through current truth, expose uncertainty honestly, and route mutations through
the correct evidence and review gates.

## Interaction contract

Treat ordinary maintainer language as the complete user interface. Run every
required `wfctl knowledge`, `wfctl work`, QMD, Graphify, Git-inspection, and
record-maintenance operation yourself when tools permit. Do not ask the
maintainer to choose subcommands, copy IDs, locate generated files, edit YAML,
or reproduce a command shown in this skill.

Ask only for product intent, authority, approval, missing repository paths, or
a materially ambiguous choice. Present such a choice in project terms with
evidence and a recommendation, then execute the internal operation after the
answer. If tools or authority block execution, report the exact blocker and
offer a manual command only as a recovery path.

## Establish the working surface

1. Confirm `.workflow/config.json` declares the `knowledge` profile. If the
   repository is a leaf, use the leaf workflow instead.
2. Start at `knowledge/index.md`, then open the relevant
   `knowledge/areas/<area>/index.md`. Use root collections only for genuinely
   cross-Area material.
3. Inspect the current session skill catalog, require and invoke the official
   native `qmd` skill, then run `qmd status`. If the skill is absent, stop and
   invoke `setup-workflow-environment` to repair or reinstall the selected
   skills, then ask only for the unavoidable agent-session restart. If QMD is
   unavailable or older than `2.5.3`, invoke the setup skill, request install
   authority, and perform the installation yourself.
4. Use `qmd search ... -c knowledge` for exact discovery or a structured
   `qmd query` with authored `intent:`, `lex:`, `vec:`, and optional `hyde:`
   fields for broader retrieval.
5. Run `wfctl knowledge build`. Stop treating the corpus as healthy if strict
   validation, knowledge-graph compilation, or claim-ledger compilation fails.
   Use the generated
   `.workflow/current/knowledge-graph.json` to expand from QMD candidates
   through explicit backlinks, typed relationships, Area ownership, and
   decision lineage. Use `.workflow/current/claim-ledger.json` only to trace
   explicit intake/reconstruction claim lineage. Never edit or treat either
   generated file as evidence.
6. Read every selected document directly. QMD ranks possible destinations; it
   neither proves a claim nor establishes complete coverage.
7. Check lifecycle, `generated`, `verification`, provenance, decision lineage,
   and linked concepts before presenting a claim as current.

## Route common requests

| User need | Required handling |
| --- | --- |
| Discover the project, onboard a newcomer, or explain current product behavior | Invoke `explore-project-knowledge`. It owns progressive product discovery and focused stakeholder explanations without modifying project state. |
| Explain how behavior is implemented | Start from the product concept, then follow its engineering links into implementation, architecture, repositories, contracts, and verification. Keep the two answers distinct. |
| Find where a topic belongs or who owns it | Identify the primary Area, owning repositories, affected capabilities, and genuinely cross-Area links. Report ambiguity instead of inventing an owner. |
| Trace what changed and why | Start from the stable current decision, follow `supersedes` links through every predecessor, then read the Area `Evolution` section and local `log.md`. Explain each transition, rationale, consequences, and unresolved questions. |
| Compare intended behavior with implementation | Invoke `analyze-with-graphify` in each exact leaf checkout, then inspect source, tests, and runtime evidence. Do not edit leaf code from this repository. |
| Build knowledge for an existing project or audit the whole baseline | Invoke `reconstruct-project-knowledge`. It owns registry inspection, source selection, case lifecycle, and promotion. Ask the maintainer only when repository identity or competing worktrees create a real choice; do not improvise a baseline from search snippets or raw notes. |
| Audit knowledge health | Run `wfctl knowledge build`; inspect its broken-link, relation, lineage, and reachability failures, then check stale verification, weak provenance, conflicting current claims, duplicate concepts, missing Area maps, misplaced cross-Area material, and implementation claims that may have drifted. Return a prioritized repair list with evidence. |
| Improve navigation or structure | Repair indexes, names, summaries, and links without changing semantic claims. If the repair changes current truth, invoke `curate-project-knowledge`, which routes product and engineering authoring separately. |
| Reconcile contradictory claims | Build a compact adjudication packet: question, each candidate claim, supporting and conflicting authoritative observations, missing facts, recommendation, and the exact maintainer decision needed. Keep unresolved claims out of `knowledge/`. |
| Review new or changed raw material | Invoke `process-raw-intake`. Never search raw as part of an ordinary current-truth answer and never cite raw from knowledge. |
| Triage `changes/inbox/` or intake cases | Classify each atomic claim by semantic role, intent, delivery, time, relations, and routing. Name the owner and next evidence or decision needed; do not silently promote it. |
| Promote a completed change or confirmed candidate | Invoke `curate-project-knowledge`. It routes product content to `curate-product-knowledge`, technical content to `curate-engineering-knowledge`, and all changed concepts to `verify-knowledge-quality` before validation. |
| Discuss a new product or architecture direction | Invoke `manage-project-work` and start a project-only living spec here before extended discussion. It has no code root. Record every material turn, obtain review, and promote only the final approved direction. Bind leaves only if implementation work becomes part of the scope. |
| Implement or fix source code | Identify the owning leaf repository and redirect the task there. Never write product code from the knowledge repository. |

## Answer current-knowledge questions

For broad product discovery, Area exploration, and focused stakeholder
questions, invoke `explore-project-knowledge` rather than requiring the reader
to know the taxonomy or document path. For other questions:

1. Bound the question by Area, capability, flow, decision lineage, repository,
   or explicit cross-Area concern.
2. Follow links outward only when they materially affect the answer. Do not
   flatten the entire corpus into one summary.
3. Prefer the stakeholder-facing product view first. Do not blend source,
   architecture, API, schema, or repository detail into it. Add a separately
   labeled engineering answer and history only when requested or needed to
   avoid a misleading delivery claim.
4. State:
   - the current answer;
   - the concepts and authoritative sources reviewed;
   - conflicts, stale evidence, and unknowns;
   - the next useful action, if any.
5. Ask the maintainer only when intent, authority, ownership, or chronology
   cannot be established from trusted evidence.

## Audit without manufacturing truth

For repository-wide audits, inventory indexes and metadata first, then inspect
high-risk samples by Area. Do not claim full semantic coverage from search
results alone. Distinguish:

- structural defects that can be proven from files and validation;
- suspected semantic drift that needs source verification;
- product ambiguity that only the maintainer can resolve.

Do not edit merely because an audit found a problem unless the user requested
repair. For navigation-only repair, preserve every claim. For semantic repair,
invoke `curate-project-knowledge`.

## Preserve trust boundaries

- Treat `knowledge/` as curated current truth, not automatic truth. Evidence,
  lifecycle, and verification still govern every claim.
- Treat `changes/`, `intake/`, and `reconstruction/` as qualified operational
  records, not the default current-truth surface.
- Treat `raw/` as untrusted input, never evidence.
- Treat QMD, both compiled graphs, and Graphify as navigation/audit tools,
  never independent authorities.
- Keep one stable path for current truth and preserve changed decisions through
  explicit lineage rather than versioned copies of whole Areas.
- Never let an explanation, audit, or navigation cleanup silently become a
  semantic promotion.
