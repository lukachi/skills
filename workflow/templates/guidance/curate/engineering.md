# Writing the engineering page

Write the technical realization of current project truth without duplicating or
silently redefining product meaning.

The structural failures are refused mechanically, including an engineering view
that claims product authority rather than linking it. See
[the engineering writing contract](../references/engineering-writing-contract.md)
for the separation rules it cannot check, and
[the template](../assets/engineering-concept.md) for a new page.

## Establish the implementation

1. Identify the owning Area, its product pages, the repository, and the exact
   clean source revision.
2. Traverse the graph for navigation and relationship coverage.
3. Directly inspect source, tests, contracts, configuration and runtime evidence
   at the pinned revision.
4. Distinguish implemented behaviour, architectural rationale, ownership,
   contract, policy, history and external claims, and apply the authority each
   class requires.
5. Code is implementation authority only. Link accepted product meaning; never
   derive it from code.

## Then write it

1. Name exact code surfaces only where they help maintenance or verification,
   and pin a material claim to its repository, commit, path and optional symbol.
   Detail beyond that goes stale faster than anyone updates it.
2. Record partial, absent, accidental, retired, unknown or drifted delivery
   honestly. **Do not repair intent by rewriting it to match the code** — that
   erases the only record of what the project meant, which is the thing that
   made the gap visible.
3. Keep the product explanation in the product page and describe only the
   technical consequence here.
