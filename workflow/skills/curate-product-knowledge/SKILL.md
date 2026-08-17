---
name: curate-product-knowledge
description: Author or materially update stakeholder-facing current product knowledge after its claims have independent authority. Use when an approved change, reviewed reconstruction, confirmed intake candidate, source audit, or explicit maintainer decision is ready to create or correct an Area, capability, use case, product flow, domain concept, product rule, vision statement, delivery summary, or evolution summary. Do not use for ordinary explanation, discovery, brainstorming, review-only requests, or unverified raw ideas. Separate accepted intent from observed delivery and keep implementation details in linked engineering documents.
---

# Curate Product Knowledge

Write the product view of verified project truth. Make it understandable to a
client or product manager without requiring source code, API, architecture, or
repository knowledge.

`wfctl knowledge validate` refuses the structural failures — code in a product
body, a missing section, an `Engineering details` section that summarizes instead
of linking, a realization state its authority cannot support. Read
[the product writing contract](references/product-writing-contract.md) for the
abstraction test, which is the part no check can make. Use
[the product concept template](assets/product-concept.md) for a new concept.

## Establish authority

1. Work from the knowledge root and identify the primary Area.
2. Read the relevant Area index, the product concepts, the current decisions, and
   the linked engineering concepts in full.
3. Separate accepted intent and product meaning, currently observed delivery,
   alignment or drift between them, and what is planned, rejected, superseded, or
   unknown.
4. Require explicit maintainer authority for intent, product meaning, rules,
   normative ownership, and product decisions.
5. Require pinned source and fresh checks for a delivery claim. Invoke
   `analyze-with-graphify` in every relevant exact leaf before inspecting source
   and tests directly.

## Author the product view

1. State the current answer first. Then what the product provides, who it serves,
   observable behavior, rules, outcomes, boundaries, exceptions, delivery state,
   examples, and meaningful evolution.
2. Use the vocabulary a domain expert or client would use, and explain a necessary
   domain term on first use. For a `Domain Concept`, record the canonical term, a
   concise definition, the contextual boundary, the accepted aliases, and the names
   to avoid. While a term is still being argued, keep the proposed version in the
   active change record rather than silently changing current vocabulary.
3. Use present tense only for behavior the declared delivery state supports. Say
   plainly when a capability is absent, partial, retired, unknown, or accepted but
   not yet available.
4. Preserve material exceptions and conditions. Plain language may simplify the
   wording and never the meaning — an exception dropped to make a sentence read
   well is the failure this whole view exists to prevent.
5. Attribute every material claim to an authoritative source, and keep
   machine-local paths out of the document.

## Area indexes

Treat `knowledge/areas/<area>/index.md` as the primary stakeholder page for an
Area, and keep it product-first and bounded:

- summarize rather than flatten every child document;
- link capabilities, use cases, rules, current decisions, and evolution;
- show delivery honestly;
- keep `Engineering details` as links with short nontechnical labels.

An index is navigation rather than a claim about the product, so it reaches
`knowledge/` on its own: the promotion gate refuses one as a draft.
[The knowledge model](../curate-project-knowledge/references/knowledge-model.md)
carries the four routes and which gate each one answers to.

## Verify before stable

1. Invoke `verify-knowledge-quality` once the substantive body is complete, and
   resolve every failed or uncertain rubric item.
2. Run `wfctl knowledge hash --concept <path>` and bind both the quality receipt
   and the verification event to that one hash.
3. Use `status: stable` only after the receipt is current, the authority
   requirements pass, and normative claims carry human verification.
4. Run `wfctl knowledge validate`, `wfctl knowledge build`, and `qmd update`. Do
   not report completion while any gate fails.
