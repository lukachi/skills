---
name: specify-project-change
description: Turn the current conversation, or a resolved Wayfinder map, into the one central specification and get its framing approved. Use when the maintainer asks to write or refresh the spec, when a direction map is ready to become delivery work, or before splitting approved work into issues.
---

# Specify Project Change

This skill takes the conversation you have already had and the source you have
already read, and produces the specification. Synthesize what you know — the
interview is not this step.

Where the interview never happened, it is still owed: call
`grill-project-decisions` and finish it before writing, because a specification
written over unasked questions settles them by guessing.

## Bind and read

1. Resolve the active change. With no bundle yet, invoke `manage-project-work` to
   classify and start one.
2. Run `wfctl work context <id> --stage shape`, or `--stage review` for a resolved
   Wayfinder map so every map issue and artifact is enumerated.
3. Read every required file completely, including what sits below long tables and
   headings. Record each with `wfctl work review file <id> <path>` only after the
   whole file is read.
4. Run `wfctl work status <id>`. `Spec` is the only editable specification; every
   `Code root` is an exact evidence workspace, never a path inferred from a
   repository name.

## Process

### 1. Understand the current state

Explore the source through `analyze-with-graphify`, then the actual code. Use the
project's own domain language throughout — `model-project-domain` owns keeping it
sharp — and respect the decisions curated knowledge already carries. Invoke
`align-project-knowledge` before settling any product or architecture meaning, and
run `wfctl knowledge decided "<subject>" --record <id>`: their answer is usually
in a bundle rather than on a page, and the framing gate holds until this has run.

Work spanning more than one repository is shaped here, at the centre, because only
the centre sees them all at once. What the centre cannot see is what each
repository declares about itself — the instructions its maintainer wrote in its own
agent file, and the skills installed only there. One opens with a plan file to read
first; another calls its navigation rule binding.

```sh
wfctl work repositories <id>
wfctl work repositories <id> --read <repository> --note "<what its rules require of this work>"
wfctl work repositories <id> --untouched <repository> --reason "<why this work does not reach it>"
```

Framing approval refuses until every bound repository is one or the other. Saying
nothing is not a third option, and neither is a note that only says the file was
opened.

### 2. Sketch the seams

Write down the **seams** the behaviour will be tested at. Prefer existing seams to
new ones, and use the highest seam that can prove the behaviour. The fewer seams
across the codebase the better — the ideal number is one.

Check with the maintainer that these seams match their expectations before writing
them into the spec.

### 3. Write the specification

Update `change.md`. It carries:

- **Summary** — the problem and the intended outcome, both from the perspective of
  the person the product serves.
- **User stories** — a long numbered list, in the form _As a `<actor>`, I want
  `<capability>`, so that `<benefit>`_. Extensive enough to cover every aspect of
  the change: this is the part of the spec a person can read and judge, and the
  part acceptance criteria are derived from rather than a substitute for.
- **Scope** — what is in, and the explicit exclusions.
- **Decisions** — the approved product and engineering choices with enough
  rationale to guide implementation: the modules and interfaces that change,
  clarifications the maintainer gave, architectural choices, schema changes,
  contracts, specific interactions.
- **Acceptance criteria** — stable `AC-01`, `AC-02`, … entries in frontmatter, each
  an observable outcome traceable to a user story. Preserve an id when wording
  improves without changing meaning; retire or supersede changed meaning
  explicitly.
- **Test seams** — the seams from step 2 and what behaviour each proves,
  including what makes a good test here and the prior art the tests follow.
- **Uncertainty** — unresolved authority and facts, left unresolved rather than
  guessed away.
- The current ledger and the structured checkpoint, refreshed last so its hash
  binds the finished draft rather than an earlier one.

Keep volatile source paths and large code snippets out of the contract; they go
stale fast and exact source evidence belongs in verification. One exception: where
a prototype produced a schema, state machine, or type shape that encodes a decision
more precisely than prose can, inline the decision-rich part and say it came from a
prototype.

### 4. Put the framing to the maintainer

Render the packet; do not compose it:

```sh
wfctl work ask <id>
```

It carries what gets done, what deliberately does not, what will make it finished,
and in what order — from the record, so it cannot print an identifier it never
reads. The maintainer reads that packet, never `change.md`: a specification is
written for the next agent, and handing them a long record to review is how a
framing decision turns into an afternoon of reading.

Where the render reads wrong, repair the record it read. A packet edited by hand is
composed again, and composed is what put file paths and criterion ids in front of
them.

Record their answer where they gave it:

```sh
wfctl work approve <id> --stage framing --by human:<maintainer-id> \
  --attested "<their answer, word for word>" --session "<where they said it>"
```

A typed confirmation and a `--token` matching `WFCTL_APPROVAL_TOKEN` remain
available and are theirs to ask for; do not send them to a second terminal by
default. A hand-written `maintainer_review.framing` receipt fails verification.
Approving rewrites `change.md`, so re-read it, refresh its review receipt, and
refresh the checkpoint afterwards.

## Collapse a resolved map

For Wayfinder, read every resolved issue in full and carry its accepted conclusions
into `change.md`. The map is an index: each issue owns the detailed answer, so
synthesis means reading them rather than expanding the map's one-line gists into
guesses. Keep deferred questions visible, clear all legitimate fog, review every
current bundle file, then:

```sh
wfctl work map finish <id> --mode full|slice
```

The map remains as lineage.

## Then

After approval, invoke `split-project-change` when the work needs several fresh
sessions. A small bounded change may remain entirely in `change.md`.
