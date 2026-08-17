# Where observations come from

The material is not lying in the shape this needs, and pretending otherwise wastes
the first hour of a run. In a corpus assembled under the previous model:

- Case bodies are templates. The substance lives in the frontmatter.
- A candidate's `reason` is prose containing several observations at once. Split
  it, and attribute each statement to the source it came from rather than to the
  candidate.
- `sources[].candidate_ids` maps candidates back to the raw paths they were drawn
  from. That mapping is how a candidate becomes citable observations.
- No entry carries its own date. Derive `at` from what the material asserts, else
  the commit date of the pinned revision, else the page's `generated.at` — and
  treat the last as a last resort, because it dates the reading and not the
  material.

Re-read a cited source when the prose is ambiguous about what it actually said.
That is not new reading; it is checking a quotation.
