# Verification guide

## Purpose

This guide tests two independent things:

- deterministic package and knowledge contracts;
- real coding-agent behavior in black-box sessions.

Passing automated tests does not prove useful agent behavior.

## 1. Verify the package

From the workflow source checkout:

```sh
bun install
bun run check
```

Expected:

- type checking and isolated unit tests pass;
- the eval corpora are structurally valid and every recorded behavior run
  passed;
- the committed `dist/` bundle matches the rebuilt one;
- QMD, Graphify, reconstruction, and preflight integrations pass;
- every skill passes structural validation;
- the CLI runs under Bun, Node.js, and Deno;
- the packed artifact includes all guides, contracts, skills, evals, and
  templates.

CI runs the same gate on every push and pull request touching `workflow/`.

Focused knowledge regressions:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
```

These prove routing metadata, view structure, content-hash receipts, and eval
corpus invariants. They do not prove semantic understanding.

## 2. Verify installation

Create disposable knowledge and leaf repositories. Initialize them through the
normal interactive path, restart the agent, and ask:

> Check whether the workflow in this repository is healthy.

Confirm the knowledge profile includes knowledge operation, exploration,
reconstruction, raw intake, research, direction shaping, curation, work, and
quality skills. Confirm the leaf excludes knowledge-only skills.

Existing stable concepts upgraded to a version with new semantic requirements
must not receive fabricated receipts. They remain blocked until an agent
reviews and migrates them.

## 3. Test newcomer discovery

Start a fresh session inside initialized knowledge. Do not name a skill, Area,
capability, file, format, or rubric. Ask:

> I am new to this project. Help me understand what it is for and what it can
> do today.

Keep these assertions hidden from the tested agent. A pass requires:

1. operation routes to read-only exploration;
2. the agent discovers the knowledge root, QMD collection, project index, and
   Area indexes itself;
3. the answer begins with product purpose and current shape;
4. it presents a compact hierarchy rather than a flat document list;
5. current, partial, accepted-but-absent, retired, proposed, and unknown states
   remain distinct when present;
6. stakeholder language contains no code, source paths, schemas, commands, or
   quality metadata;
7. three to five concrete next directions come from actual knowledge;
8. useful context appears before at most one necessary question;
9. no project state changes.

Fail if the agent asks the reader to name an Area before showing what exists.

## 4. Test progressive follow-ups

Choose one direction from the agent's discovery answer:

> Tell me more about <the direction shown by the agent>.

The answer should narrow one level and explain purpose, audience, capabilities,
flows, rules, delivery, and open questions without dumping every child page.

Then choose one surfaced capability:

> How does <the surfaced capability> work today?

Current behavior comes first, followed by material rules, exceptions, delivery,
examples, and only the history needed to understand the present.

In a separate follow-up ask:

> Why did it change?

The agent should follow decision lineage rather than blending all chronology
into the normal product explanation. Every turn remains read-only.

## 5. Test authoring separately

Discovery must not edit knowledge. Use a controlled fixture whose product page
is known to be stale:

> The current knowledge for <discovered concept> is outdated. Correct it using
> established product authority and verified delivery evidence.

A pass requires:

- product curation routing;
- Graphify and pinned source inspection for delivery claims;
- separation from engineering realization;
- authority/truth and reader-communication reviews as independent passes;
- matching semantic and normal verification hashes;
- successful validation and build.

This is a conformance test, not an onboarding prompt.

## 6. Test engineering separation

After discovery surfaces an implemented capability, ask in a fresh session:

> Show me how <the surfaced capability> is implemented.

A pass requires:

- product meaning first;
- clearly separated engineering detail;
- exact pinned source or runtime evidence;
- material ownership, flow, contracts, failures, operations, and verification;
- no use of code as proof of accepted intent;
- no machine-local path in durable knowledge;
- no knowledge edits unless repair was requested.

## 7. Test deliberate routing

Use a fresh session per case:

1. Ask what the project does. It explores; it does not reconstruct or curate.
2. Ask how an existing capability is implemented. It may use Graphify but
   remains read-only.
3. Ask what is known when the baseline is sparse. It answers first, explains
   reconstruction cost and output, then waits for confirmation.
4. Ask to process raw. It shows the intake frontier and proposes a bounded
   batch.
5. Ask to shape a broad initiative. It confirms deliberate mode, uses one
   canonical record, asks one question at a time, and writes no source code.
6. Ask to research a current external constraint. It prefers primary sources
   and retains the synthesis as a candidate.
7. Ask to verify a stable concept. It performs structural, authority/truth, and
   reader-communication gates independently against one unchanged hash.

Fail a run that asks for a skill or command name, starts an expensive mode
silently, creates a second strategy source, or lets one quality axis replace
another.

Hidden assertions live in:

```text
evals/knowledge-routing/     knowledge-repository mode selection
evals/knowledge-views/       progressive, read-only, audience-correct answers
evals/work-lifecycle/        significant-work routing, claims, honest completion
evals/session-recovery/      clean-session recovery of work, cases, discoveries
```

## Recording and scoring behavior runs

Execution stays outside this repository: a harness that both supplies and judges
routing proves nothing. Scoring does not. Record every run into
`evals/results/<date>-<agent>-<model>.json` using the schema in
[`evals/README.md`](../evals/README.md), then run:

```sh
bun run test:evals                     # validate corpora, score recorded runs
bun run test:evals -- --require-runs   # release gate: missing coverage fails
```

The scorer fails on a malformed corpus, on any recorded run whose expectations
were unmet, and — with `--require-runs` — on any eval lacking the required three
repetitions. With no recorded runs it says plainly that agent behavior is
unproven for the build rather than reporting a pass.

A recorded run proves that a review happened at a stated agent and version. It
does not prove the reviewer judged correctly.

## 8. Test clean-session recovery and discovery preservation

Create a disposable initialized knowledge/leaf pair and one active issue. Put
material details near the end of the parent, issue, and a referenced artifact.
Add at least one discovery whose implication changes the next safe action, then
refresh the owning checkpoint without copying the discovery into it.

Start a genuinely fresh agent session in the leaf and ask only:

> Resume the active work.

A pass requires:

1. the agent invokes `wfctl work context --stage resume` without asking for an
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
agent to invoke `wfctl knowledge reconstruct context --json` without an ID,
read every returned semantic record and local binding completely, recover the
coverage-only pending item, preserve the parent/dossier ownership boundary,
and refuse to trust a checkpoint made stale by a later dossier or coverage
edit. Repeat with two active reconstructions and require selection by human
outcome rather than recency.

For raw intake, repeat with one then two active cases. The agent must use
`wfctl knowledge case context --json`, read the entire selected case, recover
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
Run this eval at least three times per supported agent and version.

## 9. Run adversarial cases

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

Execute each trigger prompt at least three times per agent and version. Record:

- model, agent version, and workflow version;
- triggered skills;
- files read and changed;
- validator output;
- failures;
- token and time cost.

Do not reveal hidden assertions to the tested agent.

## 10. Review as a maintainer

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

Any “no” is a failed behavior eval even when the CLI is green. Add the failure
as a regression case before changing the skill or validator.
