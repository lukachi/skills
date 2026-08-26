# Verification guide

## Purpose

This guide tests two independent things:

- deterministic package and knowledge contracts;
- real coding-agent behavior in black-box sessions.

Passing automated tests does not prove useful agent behavior.

## 0. Verify the built binary, invoked as a program

Run `tests/binary-e2e.test.ts`. It exists because every module-level test passed
while the shipped binary was broken in six ways at once — the bin's main-module
guard, the hook wiring, and the terminal commands' gates. A test that calls a
function directly never runs the program.

The properties it holds:

- the bin runs when invoked under the name npm installs it as;
- `work close` and `reconstruct close` run every gate their step machine runs;
- a step that needs a review refuses without one on record;
- every command named by a refusal exists in the dispatch;
- tampered state and a malformed review artifact refuse rather than crash;
- an attack whose output says the work broke is not accepted;
- the flow fence survives deletion of the current pointer;
- `knowledge/`, the promotion queue and the archive are unreachable by hand,
  including by case variant, symlink and absolute path;
- the write guard goes quiet on ground it has already covered;
- `brief --json` is what the stop guard reads;
- installation preserves a maintainer hook that shares our matcher, refuses an
  unbalanced marker block, and records what it wrote before anything can refuse.

## 1. Verify the package

From the workflow source checkout:

```sh
bun install
bun run check
```

Expected:

- type checking and isolated unit tests pass;
- unit and end-to-end tests pass, including the regression suite written
  against defects found by adversarial review and by reading real sessions;
- the committed `dist/` bundle matches the rebuilt one;
- QMD and Graphify integrations pass;
- every guidance slice referenced by a state exists, and no state references one that does not;
- the CLI runs under Bun, Node.js, and Deno;
- the packed artifact includes the guidance bundle, contracts, and templates.

CI runs the same gate on every push and pull request touching `workflow/`.

Focused knowledge regressions:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
```

These prove routing metadata, view structure, content-hash receipts, and gate
corpus invariants. They do not prove semantic understanding.

## 2. Verify installation

A fresh `wfctl init knowledge` must produce the guidance bundle, the runtime
guards, the three hooks and the managed agent block — and must install no
skills. Run it twice: the second run rewrites nothing. Edit one installed file
and run it again: the file is reported and left alone.

Create disposable knowledge and leaf repositories. Initialize them through the
normal interactive path, restart the agent, and ask:

> Check whether the workflow in this repository is healthy.

Confirm the knowledge profile includes knowledge operation, exploration,
reconstruction, raw intake, research, direction shaping, curation, work, and
quality skills. Confirm the leaf excludes knowledge-only skills.

Existing stable concepts upgraded to a version with new semantic requirements
must not receive fabricated receipts. They remain blocked until an agent
reviews and migrates them.

## 3. Test clean-session recovery

Create a disposable initialized knowledge/leaf pair and one active issue. Put
material details near the end of the parent, issue, and a referenced artifact.
Add at least one discovery whose implication changes the next safe action, then
refresh the owning checkpoint without copying the discovery into it.

Start a genuinely fresh agent session in the leaf and ask only:

> Resume the active work.

A pass requires:

1. the agent invokes `wfctl brief` without asking for an
   ID;
2. exactly one binding is selected automatically;
3. every reported file is read completely, including bottom canaries and every
   discovery entry;
4. the agent identifies the exact existing claim and code root before acting;
5. the recovered current state, discovery implications, blockers, and next
   action agree with the complete semantic records rather than chat history;
6. any new consequential observation is written to the owning discovery
   ledger before the checkpoint is refreshed;
7. active state is not copied into `changes/inbox/`.

Repeat with two active bindings. The agent must inspect their human outcomes
and ask which one to resume; choosing by recency, branch, or filename fails.
Repeat with a stale checkpoint or mismatched checkout. The agent must stop and
reconcile instead of guessing.

Repeat the same black-box test from a disposable knowledge repository with one
active reconstruction. Put distinct bottom canaries and consequential
discoveries in the parent case and each repository dossier, and leave a known
pending item only in the complete coverage JSON. A pass requires the fresh
agent to invoke `wfctl reconstruct status` without an ID,
read every returned semantic record and local binding completely, recover the
coverage-only pending item, preserve the parent/dossier ownership boundary,
and refuse to trust a checkpoint made stale by a later dossier or coverage
edit. Repeat with two active reconstructions and require selection by human
outcome rather than recency.

For raw intake, repeat with one then two active cases. The agent must use
`wfctl brief --json`, read the entire selected case, recover
its pending frozen sources and discovery implications, and refresh the
checkpoint only after updating the semantic case.

For reconstruction raw scope, provide a frozen snapshot with two themes. A
fresh agent must summarize and recommend `all`, selected themes, or exclusion,
then wait for the maintainer. Starting a parent-bound intake before approval,
linking a generic or pre-approval case, selecting a blob outside approved
paths, using another baseline, inventing a `human:*` actor, or changing scope
after child creation must fail. An empty snapshot may become `unavailable`
without a question; later raw must remain a new generation.

Inspect the raw tool trace, not only the final answer. A command invocation or
hash receipt proves accounting, not comprehension; bottom canaries and
questions whose answers require the omitted paragraphs expose partial reads.
Run this at least three times per supported agent and version.

## 4. Run adversarial cases

At minimum, cover:

- sparse knowledge;
- many Areas that tempt a flat catalog dump;
- accepted intent with absent delivery;
- legacy code with unknown intent;
- conflicting raw, code, and documentation;
- technical leakage into a product page;
- fluent prose with an omitted exception;
- stale verification receipts;
- trivial work that must not trigger curation;
- an unaccepted proposal that must remain outside current knowledge.

## 4a. Score the sessions that already happened

A machine-checkable corpus of these cases was tried and removed. Ninety-four of
its criteria were prose judgments — "preserves the exceptions rather than
smoothing them away" — that no script can check and only a model could, and a
harness that both supplies the prompt and judges the answer proves nothing. It
sat at zero recorded runs and warned on every build, which is worse than absent:
a warning nobody can clear teaches you to skip warnings.

What replaced it reads the sessions that happen anyway:

```sh
bun run score <session.jsonl | directory>
```

It reports commands the agent invented, flags it put on the wrong command, steps
that took more than two attempts, writes that a command should have made, turns
that ended with work done since the last checkpoint, and whether each turn the
guard forced produced anything.

Every finding is a claim about the tool rather than about the agent. A step that
took five attempts means the tool made that step hard, and each one found so far
has been a defect in the tool: a command that did not exist where the agent
looked for it, a flag accepted by the wrong command, a step whose own gate
invalidated the checkpoint it had just demanded.

Record for each scored session: model, agent version, workflow version, the
findings, and what changed as a result.

## 5. Review as a maintainer

For discovery:

- Can a newcomer explain project purpose and current capabilities?
- Are delivery and uncertainty visible?
- Do suggested directions help form the next question?
- Was the operation read-only?

For product explanation:

- Are behavior, rules, exceptions, and delivery understandable?
- Are current, absent, retired, proposed, and unknown states distinct?
- Is meaningful evolution available without a flat event dump?

For engineering:

- Can an engineer locate ownership and exact realization?
- Are flow, contracts, failures, operations, and verification covered?
- Does engineering link product meaning instead of redefining it?

Any “no” is a failure even when the CLI is green. Add it as a regression test
before changing the tool.
