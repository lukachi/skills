# Verification guide

## Purpose

This guide tests two independent things:

- deterministic package and knowledge contracts;
- real Codex and Claude Code behavior in black-box sessions.

Passing automated tests does not prove useful agent behavior.

## 1. Verify the package

From the workflow source checkout:

```sh
bun install
bun run check
```

Expected:

- type checking and isolated unit tests pass;
- QMD, Graphify, reconstruction, and preflight integrations pass;
- every skill passes structural validation;
- the CLI runs under Bun, Node.js, and Deno;
- the packed artifact includes all guides, contracts, skills, evals, and
  templates.

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
evals/knowledge-routing/
evals/knowledge-views/
```

## 8. Run adversarial cases

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

## 9. Review as a maintainer

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
