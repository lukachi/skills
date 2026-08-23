# Writing the product page

Write the product view of verified project truth. It must be understandable to a
client or a product manager without source code, API, architecture, or
repository knowledge.

The structural failures are refused mechanically — code in a product body, a
missing section, an engineering section that summarizes instead of linking, a
realization state its authority cannot support. See
[the product writing contract](../references/product-writing-contract.md) for the
abstraction test, which is the part no check can make, and
[the template](../assets/product-concept.md) for a new page.

## Establish authority first

1. Identify the primary Area.
2. Read its index, the product pages, the current decisions and the linked
   engineering pages in full.
3. Separate accepted intent and product meaning, currently observed delivery,
   alignment or drift between them, and what is planned, rejected, superseded or
   unknown.
4. Intent, product meaning, rules, normative ownership and product decisions
   require explicit maintainer authority.
5. A delivery claim requires pinned source and a fresh check. Traverse the graph
   in the exact leaf before inspecting source and tests directly.

## Then write it

1. State the current answer first. Then what the product provides, who it
   serves, observable behaviour, rules, outcomes, boundaries, exceptions,
   delivery state, examples, and meaningful evolution.
2. Use the vocabulary a domain expert or client would use, and explain a
   necessary domain term on first use. For a domain concept, record the
   canonical term, a concise definition, the contextual boundary, the accepted
   aliases, and the names to avoid. While a term is still being argued, keep the
   proposed version in the work record rather than silently changing current
   vocabulary.
3. Use present tense only for behaviour the declared delivery state supports.
   Say plainly when a capability is absent, partial, retired, unknown, or
   accepted but not yet available.
4. Preserve material exceptions and conditions. Plain language may simplify the
   wording and never the meaning — **an exception dropped to make a sentence
   read well is the failure this whole view exists to prevent.**
5. Attribute every material claim to an authoritative source, and keep
   machine-local paths out of the page.

## Area indexes

An Area index is the primary stakeholder page for that Area: product-first and
bounded. Summarize rather than flatten every child page; link capabilities, use
cases, rules, current decisions and evolution; show delivery honestly; keep
engineering details as links with short non-technical labels.

An index is navigation rather than a claim about the product, so it reaches
curated knowledge on its own.
[The knowledge model](../references/knowledge-model.md) carries the four routes
and which gate each answers to.
