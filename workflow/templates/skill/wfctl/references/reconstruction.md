# Reconstruction

The expensive write that builds curated knowledge when none exists, or repairs
it when it has drifted.

It is **not** "tell me what this project does" — that is read-only, answered
from curated knowledge, and needs no case at all.

There is no mode to choose. Whether this is a first baseline or a re-check
follows from whether the corpus holds pages, which the tool observes. A
ten-year-old codebase with an empty corpus is a first baseline.

## Register the repositories first

```sh
wfctl repo add <owner/name> --path <dir> [--worktree <id>]
wfctl repo list
```

Its own operation, run after installation and again whenever a checkout or
worktree appears. Nothing is written into the leaf.

## The stages

The maintainer is present at three and absent from the long one.

| Stage | Who | What |
| --- | --- | --- |
| `scope` | maintainer | one decision: which repositories, how much raw, what is out |
| `crawl` | nobody | reads everything in scope |
| `assemble` | nobody | readings become trajectories |
| `adjudicate` | maintainer | one round of what evidence could not settle |
| `write` | nobody | pages drafted |
| `probe` | nobody | a different agent asks what the pages cannot answer |
| `promote` | maintainer | what the project now says about itself |

```sh
wfctl reconstruct stage    # advances when this stage's gate passes
```

## Scope is one act

Inventory the registry, the raw material and the existing corpus first, then put
a **single** question. Asking separately for the repositories, then the
checkout, then the raw, then the exclusions makes them answer procedure instead
of scope, four times.

You may inventory and recommend. You may not decide how much raw material counts
— an agent that decides that has quietly chosen how much of the project's own
history to believe.

## The crawl records contradictions; it does not ask about them

When the code says one thing and a note says another, write both sides down and
keep going. Asking now interrupts an unattended pass with a question they cannot
answer well anyway: they would be adjudicating before the rest has been read.

```sh
wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"
```

Every file in scope ends read or excluded with a reason. An unexplained
exclusion is indistinguishable from a file nobody got to.

## Nothing is written before a line exists

A claim about current truth made while reading is made before the material that
contradicts it has been read. Separate statements as you go — one statement,
dated, attributed — then assemble them into subjects.

## Sources that are not well-formed

Real projects are not well-formed: documentation references deleted paths,
specifications were rewritten without supersession, scratch files became the
only written intent.

- **Demotion is never promotion.** Finding one lane unreliable narrows what it
  establishes; it never widens another.
- **A degraded source is still a source.** It carries terminology, chronology
  and leads, and shows what was once believed.
- **Coverage is measured, not inferred.** A document establishes what it covers
  and nothing past its edge. Unfinished is not unreliable.
- **`unknown` is a result.** A baseline where most capabilities carry unknown
  intent accurately describes a project whose intent was never written down, and
  is more useful than a plausible one. Manufacturing intent from the least-bad
  remaining source launders a guess into curated knowledge.

## Claiming absence

Absence from the graph, from retrieval, from text search, or from one repository
never proves absence from the project. Three independent routes that all found
nothing is evidence; one route that found nothing is a search that ended early.

## The probe round

A **different agent** asks whether the written pages can answer without
reopening the source. Asking yourself what you might have missed returns what
you already know.

```sh
wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent> [--passed]
```

## Giving up

```sh
wfctl reconstruct abandon --reason "<why this pass is not finishing>"
```

A case opened by mistake, or on the wrong repository, needs a way out that is
not hand-editing state. It archives with the reason rather than pretending the
pass completed.

## Closing

A pass that changed nothing still writes. "Checked at this revision, nothing
moved" is what stops the next pass redoing the work.

Reconstruction never edits product source, so a gap it finds outlives the case
and becomes work through the changes flow — never through direct promotion.
