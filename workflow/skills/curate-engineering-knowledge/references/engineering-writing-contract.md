# Engineering writing contract

The validator already refuses a missing required section, an engineering view
without the engineer or operator audience, an engineering view claiming product
authority instead of linking it, runtime evidence with no pinned source, and a path
whose lane disagrees with the view. This is what it cannot check.

## Reader contract

Write for engineers and operators who already understand the product concept or can
follow its link. Let them answer:

1. What technical responsibility does this surface own?
2. Where and how is it implemented at the pinned revision?
3. How do data and control move through it?
4. Which contracts, invariants, and ownership boundaries apply?
5. How does it fail and how is it operated?
6. What evidence verifies the claims?

## Separation rules

- Link product meaning; do not restate it as technical prose. A document that
  explains the product again in technical words has two owners for one meaning, and
  they drift.
- Never infer accepted intent, correctness, or rationale from code alone. Code
  proves what runs.
- Keep implementation detail here only where it helps someone understand, change,
  operate, or verify the system. Detail past that point is maintenance nobody
  asked for.
- State uncertainty and drift explicitly rather than describing the code as if it
  were the plan.
- Separate current implementation from historical implementation and from rejected
  alternatives.

Use `Not applicable` with a reason when a section genuinely does not apply.

## Method basis

[C4](https://c4model.com/introduction) uses explicit abstraction levels for
different audiences. [arc42](https://docs.arc42.org/section-1/) separates
stakeholder goals from hierarchical technical building blocks.
[Spec Kit](https://github.github.com/spec-kit/reference/agentic-sdd.html) separates
product what and why from implementation how.
[ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
preserve rationale and supersession apart from current implementation.
