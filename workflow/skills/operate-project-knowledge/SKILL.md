---
name: operate-project-knowledge
description: Navigate, explain, audit, organize, and triage a project's curated knowledge repository. Use whenever work starts inside a knowledge-profile repository and the user asks what is currently true; how an Area, capability, use case, flow, rule, implementation, repository boundary, uncertainty, or decision works; what changed and why; where a topic belongs or who owns it; what knowledge is stale, missing, duplicated, contradictory, orphaned, or weakly sourced; how to improve human navigation; what pending intake or handoffs need attention; or which knowledge workflow should handle a request. Route raw processing, source verification, and verified promotion to their specialized skills, and never implement leaf source changes from the knowledge repository.
---

# Operate Project Knowledge

Act as the project's librarian and investigator. Give humans a clear path
through current truth, expose uncertainty honestly, and route mutations through
the correct evidence and review gates.

## Establish the working surface

1. Confirm `.workflow/config.json` declares the `knowledge` profile. If the
   repository is a leaf, use the leaf workflow instead.
2. Start at `knowledge/index.md`, then open the relevant
   `knowledge/areas/<area>/index.md`. Use root collections only for genuinely
   cross-Area material.
3. Run `qmd status`. Use `qmd search ... -c knowledge` for exact discovery or
   `qmd query ... -c knowledge --json` for broader retrieval. If QMD is
   unavailable, stop and ask to install it with
   `bun install -g @tobilu/qmd`.
4. Read every selected document directly. QMD ranks possible destinations; it
   neither proves a claim nor establishes complete coverage.
5. Check lifecycle, `generated`, `verification`, provenance, decision lineage,
   and linked concepts before presenting a claim as current.

## Route common requests

| User need | Required handling |
| --- | --- |
| Explain current behavior or onboard a newcomer | Follow the Area index into capabilities, use cases, rules, and only then technical realization. Separate current truth, rationale, and open questions. Cite stable knowledge paths. |
| Find where a topic belongs or who owns it | Identify the primary Area, owning repositories, affected capabilities, and genuinely cross-Area links. Report ambiguity instead of inventing an owner. |
| Trace what changed and why | Start from the stable current decision, follow `supersedes` links through every predecessor, then read the Area `Evolution` section and local `log.md`. Explain each transition, rationale, consequences, and unresolved questions. |
| Compare intended behavior with implementation | Invoke `analyze-with-graphify` in each exact leaf checkout, then inspect source, tests, and runtime evidence. Do not edit leaf code from this repository. |
| Audit knowledge health | Check missing or stale verification, weak provenance, conflicting current claims, broken links, incomplete decision lineage, duplicate concepts, orphan documents, missing Area maps, misplaced cross-Area material, and implementation claims that may have drifted. Return a prioritized repair list with evidence. |
| Improve navigation or structure | Repair indexes, names, summaries, and links without changing semantic claims. If the repair changes current truth, invoke `curate-project-knowledge`. |
| Reconcile contradictory claims | Build a compact adjudication packet: question, each candidate claim, supporting and conflicting authoritative observations, missing facts, recommendation, and the exact maintainer decision needed. Keep unresolved claims out of `knowledge/`. |
| Review new or changed raw material | Invoke `process-raw-intake`. Never search raw as part of an ordinary current-truth answer and never cite raw from knowledge. |
| Triage `changes/inbox/` or intake cases | Classify each item as promote, verify, defer, reject, or blocked. Name the owner and next evidence or decision needed; do not silently promote it. |
| Promote a completed change or confirmed candidate | Invoke `curate-project-knowledge`, update the smallest coherent concepts and decision lineage, validate, and refresh QMD. |
| Discuss a new product or architecture direction | Explore alternatives, but do not publish the discussion as stable knowledge. Continue significant work through the owning leaf workflow. If no owner exists, preserve it in raw or as unresolved until a project-level work mode exists. |
| Implement or fix source code | Identify the owning leaf repository and redirect the task there. Never write product code from the knowledge repository. |

## Answer current-knowledge questions

1. Bound the question by Area, capability, flow, decision lineage, repository,
   or explicit cross-Area concern.
2. Follow links outward only when they materially affect the answer. Do not
   flatten the entire corpus into one summary.
3. Prefer product meaning and current behavior first. Add implementation
   detail and history only when requested or needed to avoid a misleading
   answer.
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
- Treat `changes/` and `intake/` as operational records, not current truth.
- Treat `raw/` as untrusted input, never evidence.
- Treat QMD and Graphify as navigation tools, never independent authorities.
- Keep one stable path for current truth and preserve changed decisions through
  explicit lineage rather than versioned copies of whole Areas.
- Never let an explanation, audit, or navigation cleanup silently become a
  semantic promotion.
