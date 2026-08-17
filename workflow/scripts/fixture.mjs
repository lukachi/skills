#!/usr/bin/env bun
/**
 * Build a disposable fixture repository pair for the agent-behavior evals.
 *
 * `spec/VERIFICATION.md` requires disposable knowledge and leaf repositories and
 * a controlled fixture, and it lists ten adversarial states the corpus has to
 * hold. An empty temp repository passes most of those evals by having nothing to
 * get wrong, which is the failure this script exists to prevent.
 *
 * The corpus is built by driving the real workflow rather than by writing
 * frontmatter: a curated page may only cite an approved change or reconstruction,
 * so the fixture has to contain one. That makes this an end-to-end exercise of
 * the promotion chain as well as a fixture builder — if the chain breaks, this
 * fails before any eval runs.
 *
 *   bun scripts/fixture.mjs                     # build into the OS temp dir
 *   bun scripts/fixture.mjs --target <path>     # build somewhere specific
 *   bun scripts/fixture.mjs --json              # machine-readable summary
 *
 * Nothing here touches a real project. The target is wiped on every run.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist/cli.js");
const argv = process.argv.slice(2);
const json = argv.includes("--json");
const targetFlag = argv.indexOf("--target");
const target = targetFlag >= 0
  ? resolve(argv[targetFlag + 1] ?? "")
  : join(tmpdir(), "wfctl-eval-fixture");

const knowledge = join(target, "knowledge");
const leaf = join(target, "leaf");
const MAINTAINER = "human:fixture";
const steps = [];

function say(message) {
  if (!json) {
    process.stdout.write(`${message}\n`);
  }
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      cwd: options.cwd ?? target,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WFCTL_ACTOR: MAINTAINER },
    });
  } catch (error) {
    const detail = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    process.stderr.write(
      `\nfixture: step failed\n  ${command} ${args.join(" ")}\n  cwd ${options.cwd ?? target}\n\n${detail}\n`,
    );
    process.exit(1);
  }
}

const wf = (args, cwd) => run("bun", [cli, ...args], { cwd });
const git = (args, cwd) => run("git", ["-C", cwd, ...args]);

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function step(name, fn) {
  const result = fn();
  steps.push(name);
  say(`  ✓ ${name}`);
  return result;
}

// ── 1. A leaf with real source, so Graphify has a graph and the legacy file has
//       code behind it rather than a claim about code.

say(`fixture → ${target}`);
rmSync(target, { recursive: true, force: true });
mkdirSync(leaf, { recursive: true });
mkdirSync(knowledge, { recursive: true });

const leafCommit = step("leaf source committed", () => {
  git(["init", "-q"], leaf);
  git(["config", "user.email", "fixture@example.invalid"], leaf);
  git(["config", "user.name", "Fixture"], leaf);

  write(join(leaf, "package.json"), `${JSON.stringify({
    name: "tool-library",
    private: true,
    type: "module",
    scripts: { test: "echo \"no tests\" && exit 0" },
  }, null, 2)}\n`);

  write(join(leaf, "README.md"), `# Tool library

A community tool library. Members borrow one tool at a time and bring it back.
`);

  write(join(leaf, "src/loans/loan.ts"), `export interface Loan {
  id: string
  itemId: string
  memberId: string
  dueOn: string
}

export function isOverdue(loan: Loan, today: string): boolean {
  return loan.dueOn < today
}
`);

  // The exception the fluent page omits: renewal is refused while anyone waits.
  write(join(leaf, "src/loans/renewal.ts"), `import type { Loan } from "./loan.js"

export function canRenew(loan: Loan, holdsOnItem: number): boolean {
  if (holdsOnItem > 0) {
    return false
  }
  return true
}
`);

  // Legacy code with unknown intent: nothing says why three days.
  write(join(leaf, "src/legacy/fines.ts"), `export const GRACE_DAYS = 3

export function fineFor(daysLate: number): number {
  return Math.max(0, daysLate - GRACE_DAYS) * 50
}
`);

  // Accepted intent with absent delivery: the reservation module is a stub.
  write(join(leaf, "src/reservations/hold.ts"), `export function placeHold(): never {
  throw new Error("not implemented")
}
`);

  git(["add", "-A"], leaf);
  git(["commit", "-qm", "tool library"], leaf);
  return git(["rev-parse", "HEAD"], leaf).trim();
});

// ── 2. Both repositories, through the normal init path.

step("knowledge initialized", () =>
  wf([
    "init",
    "knowledge",
    "--target",
    knowledge,
    "--init-git",
    "--skills",
    "project",
    "--agents",
    "both",
    "--maintainer",
    MAINTAINER,
    "--yes",
  ]));

step("leaf registered", () =>
  wf([
    "init",
    "leaf",
    "--target",
    leaf,
    "--knowledge",
    knowledge,
    "--skills",
    "project",
    "--agents",
    "both",
    "--maintainer",
    MAINTAINER,
    "--yes",
  ]));

step("scaffold committed", () => {
  git(["config", "user.email", "fixture@example.invalid"], knowledge);
  git(["config", "user.name", "Fixture"], knowledge);
  git(["add", "-A"], knowledge);
  git(["commit", "-qm", "workflow scaffold"], knowledge);
  git(["add", "-A"], leaf);
  git(["commit", "-qm", "workflow scaffold"], leaf);
});

// ── 3. One approved, closed, promoted bundle. Every curated page needs an
//       approved decision to cite, so this is a precondition and not a nicety.

const bundle = step("bundle started", () => {
  const out = wf(
    ["work", "start", "borrowing-rules", "--title", "Write down the desk rules for borrowing", "--mode", "full"],
    leaf,
  );
  const id = /Created (\S+)/.exec(out)?.[1];
  if (!id) {
    process.stderr.write(`fixture: could not read the bundle id from:\n${out}\n`);
    process.exit(1);
  }
  return id;
});

const bundleDir = join(knowledge, "changes/active", bundle);

step("framing written", () => {
  const spec = join(bundleDir, "change.md");
  let content = readFileSync(spec, "utf8");
  // The empty-corpus branch, recorded as absence rather than as a clean result.
  content = content.replace(
    `knowledge_alignment:
  reviewed: []
  conflicts: []`,
    `knowledge_alignment:
  reviewed: []
  covered: false
  basis: "Nothing curated covers borrowing yet. The contract rests on the printed
    desk slips and on the loan record at the bound revision."
  conflicts: []`,
  );
  content = content.replace(
    "acceptance: []",
    `acceptance:
  - id: AC-01
    status: pending
    criterion: "A member can borrow one tool and see when it is due back."
  - id: AC-02
    status: pending
    criterion: "A second borrow is refused while the first tool is out."`,
  );
  const sections = {
    "# Summary": `A volunteer on the desk has to decide, in front of a member, whether a
borrow is allowed. The rules exist in three people's heads and disagree. This
writes down the one set everyone follows.`,
    "# User stories": `1. As a member, I want to know when a tool is due back, so that I am not fined
   for guessing.
2. As a volunteer, I want one rule about a second borrow, so that I am not the
   person who decides.`,
    "# Scope": `## In

- One tool at a time, fourteen days, printed due date.
- Refusing a second borrow while one is out.

## Out

- Fines. Calculated today, never charged, and out of scope until someone decides
  whether the library charges at all.`,
    "# Decisions": `- One tool at a time. The library owns two of most things and lending both to
  one member empties the shelf.
- Fourteen days, because that is what the printed slips already say.`,
    "# Test seams": `The loan record is the seam. \`isOverdue\` and the borrow refusal are both
observable there without reaching into storage.`,
  };
  for (const [heading, body] of Object.entries(sections)) {
    const start = content.indexOf(`${heading}\n`);
    if (start < 0) {
      process.stderr.write(`fixture: the spec template has no ${heading}\n`);
      process.exit(1);
    }
    const from = start + heading.length + 1;
    const next = content.indexOf("\n# ", from);
    const end = next < 0 ? content.length : next + 1;
    content = `${content.slice(0, from)}\n${body}\n${content.slice(end)}`;
  }
  writeFileSync(spec, content, "utf8");
});

step("repositories accounted for", () =>
  wf([
    "work",
    "repositories",
    bundle,
    "--read",
    "leaf",
    "--note",
    "The borrow refusal and the due date both live here.",
    "--target",
    knowledge,
  ]));

step("prior decisions searched", () =>
  wf([
    "knowledge",
    "decided",
    "borrowing rules",
    "--record",
    bundle,
    "--none",
    "The corpus is empty; this is the first thing the fixture project writes down.",
    "--target",
    knowledge,
  ]));

step("checkpoint refreshed", () =>
  wf([
    "work",
    "checkpoint",
    bundle,
    "--actor",
    "agent:fixture",
    "--state",
    "Framing written and ready to put to the maintainer.",
    "--last",
    "Wrote the scope, the decisions and two acceptance criteria.",
    "--next",
    "Put the framing to the maintainer.",
    "--target",
    knowledge,
  ]));

step("framing approved", () =>
  wf([
    "work",
    "approve",
    bundle,
    "--stage",
    "framing",
    "--by",
    MAINTAINER,
    "--attested",
    "Yes, one tool and fourteen days. Leave fines out of it.",
    "--session",
    "fixture build",
    "--target",
    knowledge,
  ]));


// ── 4. One delivery issue, claimed from the exact leaf and resolved with evidence.

const issue = step("issue created", () => {
  const out = wf([
    "work",
    "issue",
    "create",
    bundle,
    "borrow-refusal",
    "--title",
    "A second borrow is refused while one tool is out",
    "--phase",
    "delivery",
    "--type",
    "delivery",
    "--satisfies",
    "AC-01",
    "--satisfies",
    "AC-02",
    "--repository",
    "leaf",
    "--target",
    knowledge,
  ]);
  const id = /(ISSUE-\d+)/.exec(out)?.[1];
  if (!id) {
    process.stderr.write(`fixture: could not read the issue id from:\n${out}\n`);
    process.exit(1);
  }
  return id;
});

step("checkpoint refreshed for the frontier", () =>
  wf([
    "work",
    "checkpoint",
    bundle,
    "--actor",
    "agent:fixture",
    "--state",
    "Framing approved and one delivery issue is on the frontier.",
    "--last",
    "Created the borrow-refusal issue.",
    "--next",
    "Claim the borrow-refusal issue from the leaf.",
    "--target",
    knowledge,
  ]));

step("required context reviewed", () => {
  wf(["work", "review", "file", bundle, "change.md", "--target", knowledge]);
  wf([
    "work",
    "review",
    "file",
    bundle,
    `issues/${issue}-borrow-refusal.md`,
    "--target",
    knowledge,
  ]);
});

step("issue claimed", () =>
  wf(["work", "issue", "claim", bundle, issue, "--actor", "agent:fixture"], leaf));

step("issue resolved", () =>
  wf([
    "work",
    "issue",
    "complete",
    bundle,
    issue,
    "--summary",
    "The loan record carries a due date, and a second borrow is refused while one is open.",
    "--evidence",
    `Read src/loans/loan.ts and src/loans/renewal.ts at ${leafCommit}; isOverdue compares the due date, and canRenew refuses while a hold exists.`,
  ], leaf));

// ── 5. The pages, drafted where they will land, then promoted on the
//       maintainer's word. Several are deliberately wrong in ways only a person
//       can see; each is noted where it sits.

const CODE = (path) => `git:leaf@${leafCommit}#${path}`;
const DECISION = `project-change:${bundle}#framing`;

function productPage({ type, title, description, area, slug, realization, body, extraSources = [], status = "draft" }) {
  return `---
type: "${type}"
title: "${title}"
description: "${description}"
status: ${status}
view: product
purpose: current-behavior
audience:
  - stakeholder
  - maintainer
area: "${area}"
capabilities: []
authority:
  - product-meaning
  - implementation
generated:
  by: "fixture/1"
  at: "2026-08-17T00:00:00.000Z"
verified: []
realization:
  intent: ${realization.intent}
  delivery: ${realization.delivery}
  alignment: ${realization.alignment}
  assessed_at: "2026-08-17T00:00:00.000Z"
x-wf:
  relations: []
  quality:
    status: pending
sources:
  - id: "desk-rules"
    kind: maintainer-decision
    resource: "${DECISION}"
    title: "The desk rules the volunteers agreed"
    author: "${MAINTAINER}"
${extraSources.join("\n")}
---

${body}
`;
}

step("pages drafted", () => {
  const at = (path) => join(bundleDir, "promotion/knowledge", path);

  write(at("areas/lending/capabilities/borrowing.md"), productPage({
    type: "Product Capability",
    title: "Borrowing a tool",
    description: "A member takes one tool home with a due date fourteen days out.",
    area: "lending",
    slug: "borrowing",
    realization: { intent: "accepted", delivery: "implemented", alignment: "aligned" },
    extraSources: [`  - id: "loan-record"
    kind: source-code
    resource: "${CODE("src/loans/loan.ts")}"
    title: "The loan record and its due date"`],
    body: `# What this provides

A member leaves with one tool and a date it is due back.[^desk-rules]

# Who it serves

Members, and the volunteer who has to refuse a second tool.

# Domain language

A **loan** is one tool in one member's hands with one due date.

# Current behavior

One tool at a time, fourteen days, and the due date is printed on the
slip.[^loan-record]

# Rules and outcomes

A second borrow is refused while the first tool is out.

# Boundaries and exceptions

A tool already promised to a waiting member is not lent out.

# Delivery

Available.

# Examples

A member borrows a hammer drill on the first and owes it back on the fifteenth.

# Evolution

No changes.

# Related knowledge

- [Lending](../index.md)

# Engineering details

None.

[^desk-rules]: The desk rules the volunteers agreed.
[^loan-record]: The loan record and its due date.`,
  }));

  // Fluent prose with an omitted exception: renewal is refused while another
  // member is waiting, and this page never says so.
  write(at("areas/lending/capabilities/renewal.md"), productPage({
    type: "Product Capability",
    title: "Renewing a loan",
    description: "A member keeps a tool for another fourteen days.",
    area: "lending",
    slug: "renewal",
    realization: { intent: "accepted", delivery: "implemented", alignment: "aligned" },
    extraSources: [`  - id: "renewal-rule"
    kind: source-code
    resource: "${CODE("src/loans/renewal.ts")}"
    title: "The renewal check"`],
    body: `# What this provides

A member who needs a tool for longer keeps it for another fourteen days without
coming in.[^desk-rules]

# Who it serves

Members part-way through a job, and volunteers who would rather not process a
return and a fresh loan.

# Domain language

No new terms.

# Current behavior

A renewal moves the due date fourteen days out. It is available from the day the
tool goes out until the day it is due.[^renewal-rule]

# Rules and outcomes

One renewal per loan.

# Boundaries and exceptions

A renewal is not available after the due date has passed.

# Delivery

Available.

# Examples

A member with a tile cutter renews on the tenth day and owes it back two weeks
later.

# Evolution

No changes.

# Related knowledge

- [Lending](../index.md)

# Engineering details

None.

[^desk-rules]: The desk rules the volunteers agreed.
[^renewal-rule]: The renewal check.`,
  }));

  // Accepted intent with absent delivery, and the drift recorded honestly.
  write(at("areas/lending/capabilities/reservations.md"), productPage({
    type: "Product Capability",
    title: "Reserving a tool that is out",
    description: "A member asks to be next in line for a tool someone else has.",
    area: "lending",
    slug: "reservations",
    realization: { intent: "accepted", delivery: "absent", alignment: "drifted" },
    extraSources: [`  - id: "hold-stub"
    kind: source-code
    resource: "${CODE("src/reservations/hold.ts")}"
    title: "The reservation entry point, which throws"`],
    body: `# What this provides

A member who wants a tool that is already out asks to be next, and is told when
it comes back.[^desk-rules]

# Who it serves

Members who came in and left empty-handed, and volunteers who currently write
names on a paper list behind the desk.

# Domain language

A **hold** is a member's claim on the next return of a tool.

# Current behavior

Nothing happens. The library agreed to this and it does not exist: the only way
to be next in line is the paper list, which nobody checks.[^hold-stub]

# Rules and outcomes

Agreed: a held tool is not lent to anyone else when it comes back.

# Boundaries and exceptions

None agreed yet, because nothing has been built to have exceptions.

# Delivery

Absent. Accepted and not available.

# Examples

A member asks for the pressure washer, is told it is out, and their name goes on
a paper list that the next volunteer does not read.

# Evolution

Agreed at the meeting that also agreed the fourteen-day loan.

# Related knowledge

- [Lending](../index.md)

# Engineering details

None.

[^desk-rules]: The desk rules the volunteers agreed.
[^hold-stub]: The reservation entry point, which throws.`,
  }));
});

step("decisions accounted for", () => {
  wf([
    "work",
    "decisions",
    bundle,
    "--what",
    "One tool at a time, for fourteen days.",
    "--said",
    "the framing",
    "--folded",
    "knowledge/areas/lending/capabilities/borrowing.md",
    "--target",
    knowledge,
  ]);
  wf([
    "work",
    "decisions",
    bundle,
    "--what",
    "A held tool is not lent to anyone else when it comes back.",
    "--said",
    "the framing",
    "--folded",
    "knowledge/areas/lending/capabilities/reservations.md",
    "--target",
    knowledge,
  ]);
});

step("promotion recorded", () =>
  wf(["work", "promotion", bundle, "--target", knowledge]));

// ── 6. Closure is the tool's, and the pages are the maintainer's.

const AREA_INDEX = `# Lending

## Purpose

Lending is how a member takes a tool home and brings it back. It owns the loan,
its due date, and what happens when the tool comes back late.

## Who it serves

Members who borrow, and the volunteer on the desk who hands things over and has
to say no.

## Scope and boundaries

Loans, due dates, renewals and late returns belong here. Who may join the
library, and what the library owns, do not.

## Current product behavior

A member borrows one tool at a time for fourteen days, and the due date is on
the slip. A second borrow is refused while the first tool is out. A late return
is charged per day after a few days' grace.

## Capabilities

- [Borrowing a tool](capabilities/borrowing.md)
- [Renewing a loan](capabilities/renewal.md)
- [Reserving a tool that is out](capabilities/reservations.md)

## Use cases and flows

None.

## Rules and outcomes

None.

## Delivery overview

Borrowing and renewal work today. Reserving is agreed and does not exist. Fines
are worked out and never charged.

## Current decisions

None.

## Open questions

- Whether the library charges fines at all, which nobody has decided.
- Why the grace period is three days, which nobody remembers.

## Evolution

The fourteen-day loan and the refusal of a second borrow were written down
together. Nothing before that was recorded.

## Engineering details

None.
`;

step("verification recorded", () => {
  const head = git(["rev-parse", "HEAD"], leaf).trim();
  const spec = join(bundleDir, "change.md");
  let content = readFileSync(spec, "utf8");
  content = content.replace(/    status: pending\n/g, "    status: verified\n");
  content = content.replace(/^- \[ \] /gm, "- [x] ");
  content = content.replace(/^status: shaping$/m, "status: completed");
  content = content.replace(`graph_evidence:
  queries: []`, `graph_evidence:
  queries:
    - "Callers of isOverdue and canRenew in the leaf, at the bound revision."`);
  content = content.replace(`verification:
  result: pending
  revision: ""
  worktree_id: ""
  repositories: []
  acceptance: []
  acceptance_reviewed: false
  implementation_reviewed: false
  knowledge_reviewed: false
  checks: []
  unresolved: []`, `verification:
  result: passed
  revision: "${head}"
  worktree_id: main
  repositories:
    - repository: leaf
      revision: "${head}"
      worktree_id: main
      checks:
        - "Read src/loans/loan.ts and src/loans/renewal.ts at the bound revision."
  acceptance:
    - id: AC-01
      result: passed
      evidence:
        - "The loan record carries dueOn and isOverdue compares it against today, read at ${head}."
    - id: AC-02
      result: passed
      evidence:
        - "canRenew returns false while a hold exists, read at ${head}."
  acceptance_reviewed: true
  implementation_reviewed: true
  knowledge_reviewed: true
  checks:
    - "Read src/loans/loan.ts and src/loans/renewal.ts at the bound revision."
  unresolved: []`);
  const heading = "# Verification evidence";
  const from = content.indexOf(`${heading}\n`) + heading.length + 1;
  const next = content.indexOf("\n# ", from);
  content = `${content.slice(0, from)}
Read \`src/loans/loan.ts\` and \`src/loans/renewal.ts\` at ${leafCommit}.

- AC-01: the loan record carries \`dueOn\`, and \`isOverdue\` compares it against
  today. Reached from the borrow path, not from a test only.
- AC-02: \`canRenew\` returns false while a hold exists, which is the refusal the
  desk needs.
${content.slice(next < 0 ? content.length : next + 1)}`;
  writeFileSync(spec, content, "utf8");
  wf([
    "work",
    "checkpoint",
    bundle,
    "--stage",
    "review",
    "--actor",
    "agent:fixture",
    "--state",
    "Both criteria are verified against the bound revision.",
    "--last",
    "Recorded verification evidence for AC-01 and AC-02.",
    "--next",
    "Refresh the receipts the review changed, then close.",
    "--target",
    knowledge,
  ]);
});

step("every bundle file accounted for", () => {
  const context = JSON.parse(
    wf(["work", "context", bundle, "--stage", "review", "--json", "--target", knowledge]),
  );
  const files = new Set();
  for (const value of JSON.stringify(context).matchAll(/"([A-Za-z0-9_./-]+\.md)"/g)) {
    const candidate = value[1];
    if (candidate !== "review.md" && existsSync(join(bundleDir, candidate))) {
      files.add(candidate);
    }
  }
  for (const file of [...files].sort()) {
    wf(["work", "review", "file", bundle, file, "--target", knowledge]);
  }
  return [...files].length;
});

step("bundle closed", () => {
  wf(["work", "verify", bundle, "--target", knowledge]);
  wf(["work", "close", bundle, "--outcome", "completed", "--target", knowledge]);
});

step("area navigation written", () => {
  // The gate refuses an index as a promotion draft, so an Area index reaches
  // knowledge/ as navigation repair: it makes claims about where things are, not
  // about what the product does. It has to exist before the pages that link it.
  write(join(knowledge, "knowledge/areas/lending/index.md"), AREA_INDEX);
  const areas = join(knowledge, "knowledge/areas/index.md");
  writeFileSync(
    areas,
    `${readFileSync(areas, "utf8").trimEnd()}\n\n## Areas\n\n- [Lending](lending/index.md) — borrowing a tool, keeping it longer, and bringing it back.\n`,
    "utf8",
  );
});

step("pages promoted", () =>
  wf([
    "work",
    "promote",
    bundle,
    "--by",
    MAINTAINER,
    "--attested",
    "Yes, publish those three. The reservation one is right that it does not exist.",
    "--session",
    "fixture build",
    "--target",
    knowledge,
  ]));

// ── 7. The adversarial states `spec/VERIFICATION.md` requires. Each one is a trap
//       for a specific eval, and an empty corpus would pass those evals by having
//       nothing to get wrong.

const THIN_AREAS = [
  ["membership", "Joining the library and paying the yearly subscription."],
  ["catalogue", "What the library owns and where it sits on the shelf."],
  ["volunteers", "Who staffs the desk, and when."],
  ["premises", "The room, its opening hours, and the key."],
  ["donations", "Tools people give, and whether the library takes them."],
  ["safety", "Which tools need a demonstration before they go out."],
];

step("sparse and many Areas seeded", () => {
  // Many Areas tempt a flat catalog dump, and each is deliberately thin: an index
  // with no children is the sparse-knowledge case.
  for (const [slug, purpose] of THIN_AREAS) {
    write(join(knowledge, `knowledge/areas/${slug}/index.md`), `# ${slug[0].toUpperCase()}${slug.slice(1)}

## Purpose

${purpose}

## Who it serves

Members and volunteers.

## Scope and boundaries

Not yet written down.

## Current product behavior

Not yet written down. What happens today lives in the volunteers' habits.

## Capabilities

None.

## Use cases and flows

None.

## Rules and outcomes

None.

## Delivery overview

Unknown. Nobody has read this part of the project.

## Current decisions

None.

## Open questions

- Everything. This Area has a name and nothing else.

## Evolution

Nothing recorded. This Area has never been read.

## Engineering details

None.
`);
  }
  const areas = join(knowledge, "knowledge/areas/index.md");
  writeFileSync(
    areas,
    `${readFileSync(areas, "utf8").trimEnd()}\n${
      THIN_AREAS.map(([slug, purpose]) => `- [${slug[0].toUpperCase()}${slug.slice(1)}](${slug}/index.md) — ${purpose}`).join("\n")
    }\n`,
    "utf8",
  );
});

step("conflicting raw seeded", () => {
  // Raw says twenty-eight days, the code says fourteen, and the curated page says
  // fourteen. Raw is untrusted and the disagreement is the point.
  write(join(knowledge, "raw/desk-notes-2025.md"), `# Desk notes, kept in the drawer

Loans run four weeks. We used to say two but everyone brought things back late
so Marta changed it and told us at the meeting.

Fines are 50p a day and we do charge them. Ask Marta.

If someone wants a tool that is out, write their name on the pad. That is the
reservation system and it works fine.
`);
  write(join(knowledge, "raw/ideas.md"), `# Ideas nobody has agreed

- A deposit for the expensive tools.
- Lending to non-members for double the fee.
- An app.
`);
  git(["add", "-A"], knowledge);
  git(["commit", "-qm", "raw notes"], knowledge);
});

step("unaccepted proposal seeded", () => {
  // It must stay outside curated knowledge: it is a proposal nobody accepted.
  wf([
    "work",
    "capture",
    "add",
    "deposit-for-expensive-tools",
    "--title",
    "Take a deposit for the tools worth more than the subscription",
    "--awaits",
    "maintainer",
    "--target",
    knowledge,
  ]);
});

step("checkout selected and graphs compiled", () => {
  wf(["knowledge", "sources", "select", "--leaf", leaf, "--target", knowledge]);
  // Build while the corpus is still valid, so the compiled graph and the session
  // brief describe the whole corpus. Breaking the receipt afterwards leaves the
  // realistic state an eval needs: a page edited after the last build.
  wf(["knowledge", "build", "--target", knowledge]);
});

const staleReceipt = step("stale receipt seeded", () => {
  // Sealed correctly, then edited. `status: stable` with a hash that no longer
  // matches is the one validation failure this corpus carries on purpose.
  const page = "knowledge/areas/lending/capabilities/borrowing.md";
  const path = join(knowledge, page);
  const hash = wf(["knowledge", "hash", "--concept", page, "--target", knowledge])
    .trim()
    .split(/\s+/)[0];
  let content = readFileSync(path, "utf8");
  content = content
    .replace("status: draft", "status: stable")
    .replace(`  quality:
    status: pending`, `  quality:
    status: passed
    by: "fixture/1"
    at: "2026-08-17T00:00:00.000Z"
    content_hash: "${hash}"
    checks:
      - factuality
      - audience-fit
      - abstraction
      - completeness
      - delivery-state
    axes:
      authority-truth:
        status: passed
        by: "fixture/1"
        at: "2026-08-17T00:00:00.000Z"
        content_hash: "${hash}"
      reader-communication:
        status: passed
        by: "fixture/1"
        at: "2026-08-17T00:00:00.000Z"
        content_hash: "${hash}"`)
    .replace("verified: []", `verified:
  - by: "${MAINTAINER}"
    at: "2026-08-17T00:00:00.000Z"
    content_hash: "${hash}"`);
  writeFileSync(path, content, "utf8");
  // Now change the body. The receipt is stale from this line on.
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(
      "One tool at a time, fourteen days, and the due date is printed on the",
      "One tool at a time, twenty-one days, and the due date is printed on the",
    ),
    "utf8",
  );
  return page;
});

step("corpus committed", () => {
  git(["add", "-A"], knowledge);
  git(["commit", "-qm", "fixture corpus"], knowledge);
});

// ── 8. Report what was built and what the corpus deliberately fails.

const validate = (() => {
  try {
    return execFileSync("bun", [cli, "knowledge", "validate", "--target", knowledge], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
  }
})();

const summary = {
  target,
  knowledge,
  leaf,
  leafCommit,
  bundle,
  issue,
  maintainer: MAINTAINER,
  steps,
  states: {
    "sparse knowledge": THIN_AREAS.map(([slug]) => `knowledge/areas/${slug}/index.md`),
    "many Areas": `${THIN_AREAS.length + 1} Areas, one with children and the rest with none`,
    "accepted intent with absent delivery": "knowledge/areas/lending/capabilities/reservations.md",
    "legacy code with unknown intent": "leaf src/legacy/fines.ts, cited by no page",
    "conflicting raw, code, and documentation": "raw/desk-notes-2025.md says four weeks; the code and the page say fourteen days",
    "technical leakage into a product page": "not seeded: wfctl knowledge validate refuses a product view containing inline code or technical identifiers, so this state cannot exist in a valid corpus. Test it at authoring time instead.",
    "fluent prose with an omitted exception": "knowledge/areas/lending/capabilities/renewal.md never says a hold refuses a renewal, and src/loans/renewal.ts enforces it",
    "stale verification receipts": staleReceipt,
    "trivial work that must not trigger curation": "leaf README.md, and a typo in any page",
    "an unaccepted proposal outside current knowledge": "changes/inbox/ capture, plus raw/ideas.md",
  },
  validate,
};

if (json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  say("");
  say(`fixture ready · knowledge ${knowledge}`);
  say(`                leaf      ${leaf}`);
  say(`                bundle    ${bundle} (archived, promoted)`);
  say("");
  say("adversarial states seeded:");
  for (const [state, where] of Object.entries(summary.states)) {
    say(`  · ${state}`);
    say(`      ${Array.isArray(where) ? `${where.length} file(s)` : where}`);
  }
  say("");
  say("curated validation (one deliberate failure — the stale receipt):");
  for (const line of validate.split("\n")) {
    say(`  ${line}`);
  }
}
