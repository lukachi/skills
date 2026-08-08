# Agent-behavior evals

Automated tests prove deterministic contracts. They cannot prove that a coding
agent picks the right skill, reads what it claims to read, or writes useful
stakeholder knowledge. That is what these corpora are for, and
[`spec/VERIFICATION.md`](../spec/VERIFICATION.md) is the procedure that uses
them.

## What is here

| Suite | Question it answers |
| --- | --- |
| `knowledge-routing/` | Does a knowledge-repository request reach the right mode, and stay out of expensive ones? |
| `knowledge-views/` | Does discovery and explanation stay progressive, read-only, and audience-correct? |
| `work-lifecycle/` | Does significant work route into one central bundle, claim exact checkouts, and refuse dishonest completion? |
| `session-recovery/` | Does a clean session recover the bound work, discoveries, and frontier without chat memory? |
| `maintainer-reports/` | Does a message to the maintainer lead with what changed, ask one answerable question, and leave the audit trail in the record? |
| `results/` | Recorded runs. Empty means agent behavior is unverified for this release. |

Each suite has:

- `trigger-evals.json` — which skills a prompt must and must not activate;
- `behavior-evals.json` — what the answer must contain and must never do.

Both are hidden assertions. Never paste them into the session being tested.

## Running a suite

The corpora are executed against a real agent, not by this repository — no
harness can be honest about routing while also supplying the routing. The
workflow therefore separates two jobs:

1. **Execution** is manual or handled by your own agent harness. Follow
   `spec/VERIFICATION.md` and run every prompt at least three times per agent
   and version.
2. **Scoring is deterministic.** Record what happened into
   `evals/results/<date>-<agent>-<model>.json` and run:

   ```sh
   bun run test:evals              # validate corpora, score whatever is recorded
   bun run test:evals -- --require-runs   # additionally fail when coverage is missing
   ```

`--require-runs` is the release gate: it fails when any eval lacks the required
repetitions or when any recorded run failed. Without it the runner still fails
on a malformed corpus or a failed run, but reports missing coverage as an
explicit warning instead of a pass.

## Result file schema

```json
{
  "recorded_at": "2026-08-01T12:00:00.000Z",
  "workflow_version": "0.8.0",
  "agent": "claude-code",
  "agent_version": "2.0.0",
  "model": "claude-opus-5",
  "runs": [
    {
      "suite": "knowledge-routing",
      "kind": "trigger",
      "eval": "current-product-is-read-only",
      "repetition": 1,
      "triggered_skills": ["explore-project-knowledge"],
      "files_read": ["knowledge/index.md"],
      "files_changed": [],
      "validator_output": "",
      "tokens": 18240,
      "seconds": 37,
      "notes": ""
    },
    {
      "suite": "knowledge-routing",
      "kind": "behavior",
      "eval": "router-hides-mechanics",
      "repetition": 1,
      "satisfied": ["answers through the least expensive read-only path"],
      "violated": [],
      "files_changed": [],
      "tokens": 20110,
      "seconds": 44,
      "notes": ""
    }
  ]
}
```

Scoring rules the runner applies:

- a `trigger` run passes when every `should_trigger` skill appears in
  `triggered_skills` and no `should_not_trigger` skill does;
- a `behavior` run passes when `violated` is empty and every `required` item
  appears in `satisfied`;
- `files_changed` must be empty for any eval whose `forbidden` list contains a
  read-only expectation — a read-only failure is never a judgment call.

A recorded run is evidence that a review happened, not proof that the reviewer
was right. That limit is the same one the workflow states everywhere else.
