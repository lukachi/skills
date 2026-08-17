---
name: verify-project-work
description: Review a change along two independent axes — does the code follow this project's standards, and does it implement what the framing asked for — then close it and put its curated pages to the maintainer. Use when claiming work complete, before promoting what it established into knowledge, or when auditing an implementation against the framing that was approved.
---

# Verify Project Work

A green build proves the build is green. Completion is a claim about what the
product now does, and it holds only because someone looked.

The tool refuses an incomplete accounting on its own: a stale receipt, an open
issue, an unapproved framing, a dirty checkout, an unaccounted decision. It cannot
tell reading from recording, a check that proves something from one that merely
passes, or a criterion nobody exercised from one that failed. Those are yours.

Read [the completion gate](references/completion-gate.md) when a refusal names a
requirement you have not met, or when deciding what a partial closure must say.

## 1. Read what the review stage names

`wfctl work context <id> --stage review` lists what must be accounted for, and
`wfctl work review file` records each one at its current hash.

A receipt proves accounting. Comprehension has no receipt, which is why reading is
the step and recording is the residue. Read each file to its end: a long issue tail
is where deferred work gets written down, and it is the part a skim reaches last.
Mark a supporting artifact `irrelevant` only when you can say what makes it
irrelevant to this result.

A receipt binds to the bytes it was taken over, so any file the review itself edits
comes back as changed-after-review and needs reading again. Expect that of
`change.md` in particular: the review is what changes it.

## 2. Pin the fixed point

The diff under review runs from the revision this work started at to the current
`HEAD` of each bound code root. Take the start from the bundle: the claim on the
first delivery issue records the revision it was claimed at.

Capture the diff command once, per repository: `git diff <fixed-point>...HEAD`
(three-dot, so the comparison is against the merge-base), plus `git log
<fixed-point>..HEAD --oneline`. Confirm the ref resolves and the diff is non-empty
before dispatching anything — a bad ref should fail here, not inside two
subagents.

## 3. Run both axes in parallel

Two independent axes, each in its own subagent so neither pollutes the other's
context:

- **Standards** — does the code conform to this project's documented standards?
- **Spec** — does the code faithfully implement what `change.md` asked for?

Send a single message with two Agent calls, both `general-purpose`.

**Standards subagent** — give it the diff commands and commit list, the standards
sources you found (whatever the repository documents about how code should be
written, plus what `wfctl work repositories <id>` reports it declares about
itself), and [the smell baseline](references/smell-baseline.md) by path. Its brief:

> Report, per file or hunk where relevant: (a) every place the diff violates a
> documented standard — cite the standard, file and rule; and (b) any baseline
> smell you spot — name it and quote the hunk. Distinguish hard violations from
> judgement calls: a documented-standard breach can be hard, a baseline smell is
> always a judgement call, and a documented project standard overrides the
> baseline. Skip anything tooling enforces. Under 400 words.

**Spec subagent** — give it the diff commands and commit list, and the contents of
`change.md`. Its brief:

> Report: (a) requirements the specification asked for that are missing or
> partial; (b) behaviour in the diff that was not asked for; (c) requirements that
> look implemented but where the implementation looks wrong. Quote the
> specification line for each finding. Under 400 words.

Present the two reports under `## Standards` and `## Spec`, verbatim or lightly
cleaned. **Do not merge or rerank the findings.** End with one line: total findings
per axis, and the worst issue _within each axis_. Do not pick a single winner
across axes — that is the reranking the separation exists to prevent.

### Why two axes

A change can pass one and fail the other. Code that follows every standard and
implements the wrong thing passes Standards and fails Spec. Code that does exactly
what was asked and breaks the project's conventions passes Spec and fails
Standards. Reporting them separately stops one axis from masking the other.

## 4. Look where a passing suite hides things

Invoke `analyze-with-graphify`, then open the real diff and the production path in
every bound code root: source, callers, boundaries, state, errors, consumers.

Hunt what a green suite conceals — a disabled path, a placeholder, a mock standing
in for the thing, a fixture doing the work, temporary compatibility code, an
unhandled branch, work quietly deferred. `evidence-first` says what each of those
proves and what it does not; here the point is that a review which never went
looking will not find one.

Take each acceptance criterion and find three things: the production behaviour
that delivers it, the evidence that it does, and the path a person using or
operating the product reaches it by. An expected value read off the implementation
confirms the implementation to itself.

Refactoring belongs here rather than in the implementation loop. Run the focused
behaviour checks and the broader test, build, type, lint, and runtime checks.

Ask before you commit. Closure requires a clean checkout whose recorded commit
contains the reviewed implementation, and the gate cannot see whether anyone agreed
to the commit that made it clean.

For project-only work, verify decisions, knowledge, and links, and let code
evidence stay absent rather than invented.

## 5. Write what the project now knows

Decide whether verified durable truth changed, and write the pages while the
understanding is fresh. Route product behaviour and engineering realization through
their separate curation skills and run the two-axis quality gate — but write each
page under the bundle's `promotion/` directory, at the exact path it will occupy
inside `knowledge/`. Nothing enters the corpus here.

A concept promoted from a bundle in a project with no reconstructed baseline has the
same shape as one established by whole-project reading and a far narrower footing:
it came from whatever this task happened to touch. Say so in its
`maintainer-decision` source — name the bundle, state that no reconstruction has
covered this subject — so a later baseline re-derives it instead of trusting it.
Draft it anyway.

Account for every answer the maintainer gave with `wfctl work decisions <id>`. A
resolved Wayfinder map is the checklist that accounting is held against.

```sh
wfctl work promotion <id>                  # from what is on disk
wfctl work promotion <id> --none "<why>"   # nothing the project says changed
```

## 6. Close it yourself

Closure asks whether the work matches the framing that was approved, and every part
of that answer is in the record already: verified criteria, passed receipts, pinned
revisions, terminal issues. Do not put it to the maintainer. One night spent
waiting on that question cost seven hours and fifty-four minutes and two of four
approved bundles.

Finish in this order, because each step invalidates the one before it. Every
semantic edit to `change.md` first. Then `wfctl work checkpoint <id> --stage
review`, before the final hash receipt — a checkpoint edit changes the file's hash,
so a receipt taken ahead of it is stale on arrival. Then re-read `change.md` and
everything else the review changed, and refresh those receipts. Then:

```sh
wfctl work verify <id>
wfctl work close <id> --outcome completed|partial|abandoned
```

Use the honest outcome. `partial` and `abandoned` are results, and a `completed`
that had to be argued for is the one worth doubting.

One refusal here is a real question rather than an errand: delivery no longer
matches the approved framing, because the acceptance criteria were reworded since
they agreed to them, or work left the route as a dropped issue. Render it with
`wfctl work ask <id> --stage completion` and record their answer with `wfctl work
approve <id> --stage completion --attested "<what they said>"`.

## 7. Then ask the one question that is theirs

A closed bundle holding pages waits in the promotion queue rather than the archive,
and the pages wait with it.

```sh
wfctl work ask <id> --stage promotion
```

That packet is the pages themselves, in full, saying of each whether it replaces
something the project already claims. It is the decision that compounds: a
completion receipt is read by an auditor once, and a page is read first by every
session that touches this part of the project.

The render is only as honest as what it reads. A page that says nothing is shown as
empty, and a draft still carrying its template's words is shown as written. Repair
the page rather than the packet.

Their word writes it:

```sh
wfctl work promote <id> --by human:<maintainer-id> --attested "<what they said>" \
  --session "<where they said it>"
```

That copies every page into `knowledge/`, validates them, and archives the bundle.
If validation refuses, nothing is written and the bundle stays in the queue — so
fix the page and ask again rather than leaving the corpus half-taught.
