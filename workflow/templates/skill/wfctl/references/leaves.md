# Reading a source repository

Code lives in leaf repositories this one knows about. You edit them from here,
as an orchestrator — there is no second session to open and nothing installed
into them.

But a leaf has to be *readable by the tools you are told to use*, and that is not
automatic.

## Where each tool runs

| Tool | Runs from | Establishes |
| --- | --- | --- |
| The structure graph | inside the leaf | what calls what, what depends on what |
| Retrieval over documents | the knowledge repository | which pages and records mention a subject |
| Text search | either | exact tokens, literals, generated artifacts |
| Reading the source | inside the leaf, at a named revision | **implementation authority** |

Retrieval and the graph locate. Neither establishes anything: open what they
returned and read it. The source at the recorded revision, not the graph, is
what a claim about the implementation rests on.

## The graph lives in the leaf, and somebody has to build it

```sh
uv tool install graphifyy      # once per machine, if the CLI is absent
graphify build                 # in the leaf checkout, produces graphify-out/
```

The install is the maintainer's; the build is yours. `wfctl repo list` shows
every registered checkout and whether its graph is `ready`, `stale`, `missing`
or `unreachable`, with the age when there is one.

You will also be told at the moment it matters: when a gate requires a traversal
and the leaf has no graph, the refusal says so rather than telling you to
traverse something that is not there.

Rebuild when the source has moved. A stale graph answers confidently about code
that is gone, and nothing about it looks wrong.

## You write only where the claim says

Two refusals stand between an edit and the wrong checkout.

A target in **no registered repository** is refused outright. There is nowhere
it could legitimately land, and the remedy is to register that repository or to
be somewhere else.

A target in the **wrong registered repository** is refused while a unit is
claimed from another. A worktree is an exact workspace, not an alias for its
repository — several checkouts of one repository exist precisely so different
work can run at once, and code written into a sibling looks entirely correct
there while belonging to different work.

This is what the registry is for. Deriving a checkout from a repository name, a
branch, a sibling path, or where a record lives is how the code ended up in the
wrong tree often enough to invent the mechanism.

## Scope comes from the tree, not from you

A reconstruction's scope is what the repository contained at the pinned
revision. `--in` narrows that; it never adds to it, so a path outside the
repository cannot enter scope at all.

That is what makes coverage mean something. Measured against a list you supplied
it answers "did you read what you chose to read", which cannot fail — a baseline
could be, and was, declared complete by scoping one file.

```sh
wfctl reconstruct read <owner/name>:<path> --at <owner/name>
```

reads a file at the pinned revision without a checkout, and prints the citation
another reader can resolve on a machine that never had that branch. That is the
difference between a citation and an assertion.

## Order

1. Traverse outward from what you are touching — callers, dependents, anything
   already doing something similar.
2. Open the actual source at the locations it returned.
3. Only then use text search, for exact tokens and things the graph does not
   represent.

Searching by string finds the name you guessed. Searching by structure finds
what you did not know to guess. Duplicating something that already exists and
contradicting an architecture you never read look identical from inside the
edit.

## Honesty about what the graph said

- Distinguish extracted edges from inferred or ambiguous ones.
- A missing result is not proof that code does not exist.
- Say when the graph is stale, and rebuild before relying on it.
- Never cite the generated graph as evidence in curated knowledge. Cite pinned
  source locations and the checks you actually ran.

## Not for prose

Markdown, curated knowledge, specifications and raw material use retrieval plus
direct reading, not the source graph. Use the graph when the work crosses into a
source repository.

## Registering

```sh
wfctl repo add <owner/name> --path <dir> [--worktree <id>]
```

Its own operation, and repeatable: a project keeps several checkouts and
worktrees so different work can run at once, and they appear over time. Two
checkouts of one repository are distinct only by worktree identity.
