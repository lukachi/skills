# Knowledge model

What `wfctl knowledge validate` cannot check. It already enforces the view for a
path, the purpose for a view, the required sections, the authority class a view
demands, the source-resource formats, the realization enums, the quality checks
and axes, reciprocal decision lineage, and reachability — and it names the file
and the field when it refuses. Nothing here restates that. Run it and read what
it says.

## The four routes, and why only three ask the maintainer

Four things write into `knowledge/`, and they gate differently:

| Route | Writes | Maintainer gate |
| --- | --- | --- |
| A change bundle | drafts under `promotion/`, copied on their word | before the write, `wfctl work promote` |
| A reconstruction case | directly, closure waits on it | at closure, `maintainer_review` approved |
| A trajectory | directly, as a page carrying no accepted intent | at `trajectory declare`, for the direction |
| An intake case | directly, closure waits on it | none |

The rule behind the column: **a route needs a maintainer gate exactly when it can
become a cited authority.** A bundle becomes `project-change:<id>#<section>`, a
reconstruction becomes `project-reconstruction:<case>#<candidate>`, a declared
direction becomes `trajectory-vision:<id>`. An intake case becomes nothing — no
source kind names it, and curated knowledge may not reference an `intake/` path at
all.

So an intake case cannot be the authority for anything it promotes. Its candidates
acquire authority elsewhere first: product meaning from an approved change or
reconstruction, implementation from pinned code, history from version control plus
an archived change, an external fact from its primary source. Routing a candidate
before authoring is forced by that, not by tidiness. Asking an intake case for its
own approval would ask the maintainer the same question twice.

## Trust, in one place

`raw/` is untrusted input and never evidence. `intake/` and `reconstruction/` are
operational records. `changes/active/` is a living agreement; `changes/archive/` is
qualified history. `knowledge/` is the default reading surface. Source
repositories are implementation authority at an exact revision.

QMD retrieves and never proves. Compiled graphs are disposable navigation.
Graphify navigates code and is not authority. Every selected source is read
directly.

## What each view is for

The choice of view is a judgement about the reader, and the path only records it.

- **Product** answers what the product provides, who it serves, how it behaves
  now, which rules and exceptions apply, and whether it is available.
- **Engineering** answers how that behaviour is realized and verified.
- **Decision** answers what was chosen and why, and what it replaced.
- **Reference** carries primary external context.
- **Uncertainty** carries a live question that trusted current evidence supports.

Proposed or rejected ideas take no current-knowledge view.

**A standalone decision earns its own page only when all three hold:** the choice
is hard to reverse, it is surprising without context, and it resolves a real
tradeoff. Otherwise it belongs in the owning concept, the change ledger, or the
Area's evolution. A repeated rejection may reveal a durable non-goal, but only an
explicit maintainer decision promotes that negative rule; the rejected proposal
stays where it was.

**Code proves observed delivery, never accepted intent and never correctness.**

## Where an artifact belongs

`wfctl init` creates the directory shape, and it is the source of truth for what
exists. What it cannot decide:

- Do not nest implementation or decisions under a capability because they support
  it. Link them.
- Subdivide a typed collection only when its own size requires it.
- Use a root collection only for honest project-wide ownership. When one Area is
  primary, store the artifact there and link it from the others.
- A bounded context is a proven technical model and language boundary. It is not
  another word for Area.
- Canonical domain language belongs with the owning Area concept rather than a
  global glossary. Record the preferred term, its definition, its contextual
  boundary, accepted aliases, and the names to avoid. Proposed terminology stays
  in the active change record until product authority accepts it.

## Relations the validator does not know about

`x-wf.relations` carries the edges a person authored, and nothing checks which
kind you chose. Use `supports`, `governed-by`, `implemented-by`, `depends-on`,
`affects`, `conflicts-with`, or `related-to`. Add only material relations, give
each a meaningful context, and repeat the target as an ordinary Markdown link so
a reader can follow it.

## What the receipt is worth

The material hash excludes `verified` and `x-wf.quality`, so both receipts bind
the authored content without referring to themselves. Any other material edit
changes the hash and invalidates both.

A quality receipt records that a review happened against one exact revision. It
creates no authority and does not make an incorrect review true.

Authority is claim-specific. Repetition, recency, search rank, and an agent's
confidence create none of it.

## Current truth and its lineage

Keep current meaning at one stable path. A changed decision creates a successor
and deprecates its predecessor through reciprocal lineage; do not version whole
Areas.

The product Area index leads with current behaviour. Its evolution section says
what changed, why, and what it affected. A full decision record keeps the context,
the choice, the rationale, the alternatives, the consequences, the transition, the
open questions, and the lineage. An Area log carries local chronology so hundreds
of decisions never flatten into one file.
