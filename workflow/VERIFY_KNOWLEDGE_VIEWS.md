# Verify the Knowledge Views Workflow

This guide verifies deterministic enforcement and real agent behavior.
Automated tests prove the package contract. Black-box sessions test whether an
agent can guide a person who does not already know the project.

## 1. Verify the package

From the workflow source checkout:

```sh
bun install
bun run check
```

Expected result:

- type checking passes;
- unit tests run in isolated sequential Bun processes and pass;
- integration tests pass;
- all skills pass structural validation;
- the bundled CLI runs under Bun, Node, and Deno;
- package smoke tests include every skill, eval corpus, and guide.

Focused regression tests:

```sh
bun test tests/knowledge.test.ts
bun test tests/knowledge-skills.test.ts
```

They prove that installation routing, skill metadata, product and engineering
view contracts, two-axis content-hash quality receipts, and eval-corpus
invariants are enforced. They do not prove semantic understanding.

## 2. Verify installation

The ordinary manual path is intentionally short. Enter a repository and run:

```sh
wfctl upgrade
```

`--target` is optional and exists for agents and automation operating from
another directory. A maintainer may instead ask the agent:

> Upgrade the workflow in this repository.

For a disposable first installation, initialize one knowledge repository and
one leaf repository using the normal interactive setup. Confirm the selected
agent targets contain:

```text
operate-project-knowledge        # knowledge profile only
explore-project-knowledge        # both profiles
curate-project-knowledge
curate-product-knowledge
curate-engineering-knowledge
verify-knowledge-quality
shape-project-direction          # both profiles
research-project-context         # knowledge profile only
```

Restart Codex or Claude after installation. Then ask the agent:

> Check whether the workflow in this repository is healthy.

The agent owns `wfctl check`, validation, builds, QMD, and Graphify commands.
Direct commands and `--target` remain recovery and automation surfaces, not
required user knowledge.

Workflow 0.6 adds a required `Domain language` product section and two
content-hash-bound semantic axes. Existing stable concepts do not receive
fabricated receipts during upgrade; the agent must review and migrate them
before strict validation can pass.

## 3. Test newcomer discovery

Start a fresh Codex or Claude session inside an initialized knowledge
repository. Do not name a skill, Area, capability, file, format, or expected
rubric. Ask only:

> I am new to this project. Help me understand what it is for and what it can
> do today.

Keep the assertions hidden from the tested agent. A pass requires:

1. `operate-project-knowledge` routes to `explore-project-knowledge`.
2. The agent discovers the knowledge root, QMD collection, project index, and
   relevant Area indexes itself.
3. The answer begins with product purpose and current shape, not repository or
   file navigation.
4. It presents a compact hierarchy rather than a flat list of every document.
5. It distinguishes current or verified, partial, accepted but absent, retired,
   and unknown behavior when those states exist, without presenting proposals
   as part of current truth.
6. It uses stakeholder language and exposes no code, source paths, schemas,
   workflow commands, or quality metadata.
7. It offers three to five concrete next directions derived from the actual
   knowledge it found.
8. It gives a useful overview before asking at most one necessary question.
9. It makes no project-state changes.

Fail the eval if the agent asks the reader to name an Area or capability before
showing what exists.

## 4. Test progressive follow-ups

Choose one direction that the discovery answer actually surfaced. Do not use a
name chosen in advance:

> Tell me more about <the direction shown by the agent>.

The response should narrow one level and explain purpose, audience,
capabilities, flows, rules, delivery, and open questions without dumping every
child document.

Then choose one capability or flow surfaced by that answer:

> How does <the surfaced capability or flow> work today?

A pass requires current behavior first, followed by material rules,
exceptions, delivery, examples, and only the evolution needed to understand
the present. The agent must remain read-only throughout both turns.

Run a separate follow-up:

> Why did it change?

This should return to `operate-project-knowledge` for decision lineage rather
than blending all history into the normal product explanation.

## 5. Test authoring conformance separately

Discovery and explanation must not edit knowledge. Test writing only after a
real concept has been discovered and the fixture establishes that its document
is stale:

> The current knowledge for <discovered concept> is outdated. Correct it using
> the established product authority and verified delivery evidence.

Now a pass requires product authoring through `curate-product-knowledge`,
Graphify plus pinned source inspection when delivery must be checked,
separation from engineering realization, `verify-knowledge-quality`, matching
quality and normal verification hashes, and successful knowledge validation
and build.

This is a controlled conformance test, not a normal onboarding prompt.

## 6. Test engineering separation

After discovery has surfaced a real implemented capability, ask in another
fresh session:

> Show me how <the surfaced capability> is implemented.

A pass requires:

- product meaning is established first;
- engineering knowledge is clearly separated;
- every implementation claim is pinned to exact source or runtime evidence;
- ownership, data/control flow, contracts, failures, operations, and
  verification are covered when material;
- code never becomes proof of accepted product intent;
- no machine-local worktree path enters durable knowledge;
- no knowledge file changes unless the user also requested repair.

## 7. Test routing and deliberate modes

Use a fresh session for each case and speak naturally:

1. Ask what the project does. It must explore, not reconstruct or curate.
2. Ask how one existing capability is implemented. It may use Graphify but
   must remain read-only.
3. Ask what is known when the baseline is sparse. It must answer first, explain
   reconstruction cost and output, then wait for one confirmation.
4. Ask to process raw. It must show the intake frontier and propose a bounded
   batch.
5. Ask to shape a broad initiative with dependent choices. It must use one
   canonical spec, ask one question at a time, and write no source code.
6. Ask to research a current external constraint. It must prefer primary
   sources and retain the synthesis as a candidate.
7. Ask to verify a stable concept. It must run structural validation,
   authority/truth review, and reader-communication review separately against
   one unchanged hash.

The hidden assertions live in:

```text
evals/knowledge-routing/trigger-evals.json
evals/knowledge-routing/behavior-evals.json
```

Fail any run that asks the maintainer for a skill or command name, starts an
expensive mode silently, creates a second strategy/spec source, or lets one
quality axis stand in for the other.

## 8. Run adversarial cases

Use fresh sessions and one case at a time:

1. **Empty or sparse knowledge:** discovery must present the limited known map,
   state what cannot be established, and offer reconstruction without starting
   it silently.
2. **Many Areas:** discovery must group and prioritize rather than flatten the
   full catalog.
3. **Accepted but absent:** the answer must preserve accepted intent while
   saying the capability is unavailable.
4. **Legacy unknown intent:** code may establish engineering reality but not
   intended product behavior.
5. **Conflicting raw and code:** raw remains a clue; code proves delivery only;
   stable product truth blocks pending authority.
6. **Technical leak:** an endpoint, class name, or source path in a product
   draft must fail deterministic and semantic review.
7. **Omitted exception:** fluent but incomplete prose may pass structural
   checks, but semantic quality review must fail.
8. **Stale receipt:** editing reviewed content must invalidate quality and
   verification hashes.
9. **Near miss:** button color, a local null fix, or a question answered by
   curated knowledge must not trigger curation.
10. **Proposal only:** an unaccepted idea remains in a change record, not
    current product knowledge.

The canonical prompts and hidden assertions live in:

```text
evals/knowledge-views/trigger-evals.json
evals/knowledge-views/behavior-evals.json
```

Run discovery, Area exploration, focused explanation, and conformance as
separate eval classes. Execute each trigger prompt at least three times per
agent and version. Record model, agent version, workflow version, triggered
skills, files read, files changed, validator output, failures, and token/time
cost. Do not reveal the expected assertions to the tested agent.

## 9. Review like a maintainer

For discovery, ask:

- Did I receive a useful map without knowing the taxonomy?
- Can I tell what the project is for and what works today?
- Are uncertainty and delivery limits visible?
- Do the suggested next directions help me form my next question?
- Did the agent avoid changing project state?

For a focused product explanation, ask:

- Can I explain the behavior, rules, exceptions, and delivery?
- Can I distinguish current, accepted-but-absent, retired, and unknown
  behavior without confusing proposals with current truth?
- Can I follow meaningful evolution without reading a flat event dump?

Then request engineering detail:

- Can an engineer locate ownership and exact implementation?
- Are flow, contracts, failures, operations, and verification covered?
- Does the technical view link product meaning instead of redefining it?

Any “no” is a failed eval even when the CLI passes. Add the failure as a
regression case before changing the skill or validator.
