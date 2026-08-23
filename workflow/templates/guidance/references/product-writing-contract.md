# Product writing contract

The validator already refuses fenced code, inline code, technical identifiers, a
missing required section, an `Engineering details` section that is not links only,
a product view without the stakeholder audience, and a realization state that its
authority does not support. It names the file and the field. This is what it cannot
check.

## Reader contract

Write for a product manager, client, maintainer, or domain expert who wants to
understand what the product does without learning how the software is built. The
reader should be able to answer:

1. What does this provide and why does it matter?
2. Who uses or depends on it?
3. Which domain terms does it own, and what do they mean here?
4. What happens now in observable product terms?
5. Which rules, outcomes, boundaries, and exceptions apply?
6. Is it available, partial, absent, retired, or uncertain?
7. What changed materially and where can the rationale be found?

This is neither end-user help nor a PRD. It is the stakeholder view of current,
verified product knowledge. Proposed behavior stays in active change records.

## Language rules

- Lead with the current answer.
- Prefer short concrete sentences and active voice.
- Use domain language and define a necessary term on first use.
- Reuse canonical Area terminology. Record aliases and discourage an overloaded
  name rather than silently switching vocabulary.
- Describe outcomes, choices, state changes, and visible consequences.
- Preserve conditions, exceptions, and non-goals.
- Replace an internal identifier with the human name for the thing.
- Name the product actor or capability rather than saying "the system".
- Pair every present-tense delivery claim with its evidence and an explicit
  realization state. Planned behavior is not current behavior.

Use `Not applicable` with a short reason rather than deleting a section whose
absence could hide an unexamined concern.

## Abstraction test

This is the part no check can make. Fail the product view when any of these are
true:

- a stakeholder needs engineering knowledge to understand the main answer;
- replacing an implementation would require rewriting the product explanation even
  though the behavior did not change;
- technical nouns outnumber product or domain nouns;
- an important exception disappeared during simplification;
- the text implies delivery that the realization state or the evidence does not
  support;
- history overwhelms the current answer;
- a raw candidate or an agent inference appears as authority.

The second one is the sharpest, and the only one a fluent page still fails
regularly: a page that reads well and describes the implementation's shape rather
than the product's behaviour passes every other test here.

## Method basis

The contract combines established boundaries rather than inventing a prose style:
[Diátaxis](https://diataxis.fr/) separates documentation by reader need;
[Spec Kit](https://github.github.com/spec-kit/reference/agentic-sdd.html) keeps the
what and why apart from the how;
[GOV.UK Content Design](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/plan-manage-content/understand-content-design/)
starts from user need and plain language;
[W3C clear content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
requires understandable language and structure;
[BDD](https://cucumber.io/docs/bdd/) and
[Domain Storytelling](https://domainstorytelling.org/) use concrete examples to
align business and technical meaning.
