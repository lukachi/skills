# Verification

You write the criteria, the tests and the code, then report that your tests pass
your criteria. Every term in that sentence has the same author. That is why this
one is delegated.

## Delegate it

A **different agent** produces the review. It receives the diff, the framing as
approved, and the repository — and **not** your reasoning, because an agent
shown its own justification accepts it.

wfctl does not spawn the reviewer. What it checks is what comes back.

**Do not compose the reviewer's brief yourself.** The tool prints it, including
the exact shape it must return:

```sh
wfctl work verify --brief <personality> --at <fixed point>
```

A **personality** is who reviews — `adversary`, `standards`, `spec`,
`complexity` — its stance and its concrete protocol. A **lens** is the question
one finding answers, and a reviewer uses several of them; the brief lists them
and each attack and finding is tagged with one.

These were two vocabularies for one idea. `--brief` took a lens and generated
four lines, while the real briefs sat unread in the kit.

It was not printed by anything until 2026-08-26, so briefs were written from
memory — and the stub pass, the highest-yield check on this page, reached the
reviewer only if the implementing agent happened to remember it.

## Pin the fixed point first

The diff runs from the revision this work started at to the current `HEAD` of
each bound code root. Take the start from the record — the claim on the first
delivery unit carries it.

```sh
git diff <fixed-point>...HEAD    # three-dot, so it compares against the merge-base
git log <fixed-point>..HEAD --oneline
```

Confirm the ref resolves and the diff is non-empty before dispatching anything:
a bad ref should fail here, not inside two subagents.

## Two axes, never merged

- **Standards** — does the code conform to what this project documents?
- **Spec** — does it implement what the framing asked?

Run them in separate contexts and report both verbatim. Do not merge or rerank,
and do not pick a winner across axes. A change can follow every standard and
implement the wrong thing, or do exactly what was asked and break every
convention; reporting them together lets one mask the other.

## Every attack is an executable test

Prose findings are settled by whoever writes more confidently. A test that runs
is settled by running it. The reviewer writes it, runs it, and returns the
source, the output and the verdict.

"Looks correct" is not an allowed answer. A review with no findings and no
recorded attacks is refused as empty — silence and success must not look the
same.

Tests and review are **ephemeral**. Nothing is added to the suite.

## The checks that need no judgement

1. **Stub the implementation** to a constant and run the tests again. Anything
   still passing was testing itself. Highest yield on this page.
2. **Invert each meaningful condition** in the diff. If no test fails, that
   branch is untested whatever the coverage says.
3. Does any assertion check a mock's call rather than an observable outcome?
4. Does any test build its expected value with the same path it is testing?

## Read the diff backwards too

Forwards — from each criterion, look for its delivery — finds missing work.
Backwards — from each changed file, ask what the framing said about it — finds
work nobody asked for, and nothing else catches that.

## The artifact

```sh
wfctl work verify --review <path>
```

```json
{
  "reviewer": "agent:<who reviewed, and not you>",
  "fixedPoint": "<revision the diff started at>",
  "framingDigest": "<the digest the framing was approved at>",
  "attacks": [
    {
      "lens": "correctness",
      "target": "what this attack tried to break",
      "test": "the test source, verbatim",
      "output": "what running it produced",
      "broke": false
    }
  ],
  "findings": [
    {
      "lens": "intent",
      "summary": "one sentence",
      "failure": "inputs or state → wrong output",
      "status": "accepted",
      "acceptedBecause": "required when accepted"
    }
  ],
  "stubPass": {
    "ran": true,
    "note": "what was stubbed, and what went red"
  },
  "stubSurvivors": [
    {
      "test": "which test survived, and what stubbing it proved",
      "status": "open",
      "acceptedBecause": "required when accepted"
    }
  ]
}
```

`stubPass` is required and is refused when absent. An empty `stubSurvivors` used
to mean both "I stubbed and everything went red" and "I never stubbed", and the
tool could not tell them apart — so the reviewer says. `"ran": false` is allowed
and carries the reason, for a change with nothing stubbable in it.

A **stub survivor** is a test that still passes with the implementation replaced
by a constant. It asserts nothing, and it is the highest-yield check on this
page — it needs no judgment and it catches most fake green.

It is answered the same way a finding is: **repair it, or accept it with a
reason.** Accepting is for a test this work does not own — one belonging to a
repository outside the fence, or to a suite this change did not author. Say why
it is not repaired here; the reason is read by whoever meets it next.

Nobody authorises this. Verification runs on your own initiative as soon as the
units are delivered — it is the second half of implementing, not a gate the
maintainer opens. The review is delegated because you cannot review your own
work, not because someone else has to permit it.

`lens` is one of `intent`, `correctness`, `contract`, `failure-paths`,
`state-and-data`, `delivery-reality`, `test-integrity`, `complexity` —
hyphenated exactly.

It is refused when: the reviewer is you; there are no attacks and no findings;
an attack carries no test, no output, or no target; **any attack has `broke:
true`**; the stub pass is unreported or unaccounted for; a stub survivor or a
finding is still `open`; either is `accepted` with no reason; or the framing digest has moved since approval — the one case that
goes back to the maintainer.

**Closure does not need this to pass.** `--outcome completed` does, because that
is the outcome claiming the work is done. `partial` and `abandoned` say the
opposite, so they close without a review on record and say so where it is read.
Promotion still asks for one: what the project says about itself is never
published on unreviewed work.
