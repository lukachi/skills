import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { contentHash, inspectPage, stripSeal, validateCurated } from "../src/core/curated.js";
import { findDecisions, renderDecisions } from "../src/core/decided.js";
import { GateRefusal } from "../src/core/gates.js";
import { withLock } from "../src/core/lock.js";

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "wfctl-curated-"));
}

const page = (extra = "") =>
  `---\nview: product\npurpose: what billing does\naudience: stakeholders\n${extra}---\n\n# Billing\n\nRefunds cover part of an order.\n`;

/* ------------------------------------------------------------ validation */

test("a page must declare which road it is on, and for whom", () => {
  const issues = inspectPage("p.md", "# Billing\n\nSomething.\n");
  const problems = issues.map((issue) => issue.problem);
  assert.ok(problems.some((problem) => problem.includes("view")));
  assert.ok(problems.some((problem) => problem.includes("purpose")));
  assert.ok(problems.some((problem) => problem.includes("audience")));
});

test("a curated page may never cite raw material", () => {
  for (const path of ["reconstruction/raw/notes.md", "intake/cases/active/x", "raw/dump.md"]) {
    const issues = inspectPage("p.md", page().replace("Refunds", `See ${path}. Refunds`));
    assert.ok(
      issues.some((issue) => issue.problem.includes("carries no authority")),
      `${path} was allowed into a curated page`,
    );
  }
});

test("a product page carrying implementation is refused", () => {
  const code = inspectPage("p.md", `${page()}\n\`\`\`ts\nconst x = 1;\n\`\`\`\n`);
  assert.ok(code.some((issue) => issue.problem.includes("code block")));

  const path = inspectPage("p.md", `${page()}\nSee src/billing/refund.ts for the rule.\n`);
  assert.ok(path.some((issue) => issue.problem.includes("source path")));

  // The same content on the engineering road is exactly where it belongs.
  const engineering = inspectPage(
    "p.md",
    page().replace("view: product", "view: engineering") + "\nSee src/billing/refund.ts.\n",
  );
  assert.equal(engineering.length, 0);
});

test("a stable page needs a seal that still matches its content", () => {
  const unsealed = inspectPage("p.md", page("status: stable\n"));
  assert.ok(unsealed.some((issue) => issue.problem.includes("no sealed content hash")));

  const body = page("status: stable\ncontent_hash: 0000\n");
  const stale = inspectPage("p.md", body);
  assert.ok(stale.some((issue) => issue.problem.includes("changed after its review")));

  const honest = page("status: stable\n");
  const sealed = honest.replace(
    "status: stable\n",
    `status: stable\ncontent_hash: ${contentHash(stripSeal(honest))}\n`,
  );
  assert.deepEqual(inspectPage("p.md", sealed), []);
});

test("the hash ignores the seal line, so a draft's seal survives promotion", () => {
  const draft = page();
  const hash = contentHash(stripSeal(draft));
  const promoted = draft.replace("---\n\n#", `content_hash: ${hash}\n---\n\n#`);
  assert.equal(contentHash(stripSeal(promoted)), hash);
});

test("validation walks the whole corpus", async () => {
  const target = await root();
  await mkdir(resolve(target, "knowledge/areas/billing"), { recursive: true });
  await writeFile(resolve(target, "knowledge/areas/billing/index.md"), page(), "utf8");
  await writeFile(resolve(target, "knowledge/broken.md"), "# No frontmatter\n", "utf8");

  const issues = await validateCurated(target);
  assert.ok(issues.every((issue) => issue.path !== "areas/billing/index.md"));
  assert.ok(issues.some((issue) => issue.path === "broken.md"));
});

/* --------------------------------------------------------------- decided */

test("decided finds an answer in a work record, not only on a page", async () => {
  const target = await root();
  await mkdir(resolve(target, "changes/archive/2026-01-01-refunds"), { recursive: true });
  await writeFile(
    resolve(target, "changes/archive/2026-01-01-refunds/change.md"),
    "# Refunds\n\nOn 2026-01-04 the maintainer settled that partial refunds are out of scope for v1.\n",
    "utf8",
  );

  const found = await findDecisions(target, "partial refunds scope");
  assert.equal(found.length, 1);
  assert.match(found[0]?.said ?? "", /partial refunds are out of scope/);
  assert.equal(found[0]?.where, "a closed record");
  assert.equal(found[0]?.at, "2026-01-04");
});

test("a declared direction is reported as the maintainer's own", async () => {
  const target = await root();
  const { appendEvent } = await import("../src/core/trajectory.js");
  await appendEvent(target, "Refund handling", {
    summary: "refunds become self-serve",
    axis: "vision",
    claims: [],
  });

  const found = await findDecisions(target, "refund handling");
  assert.ok(found.some((decision) => decision.where === "a declared direction"));
});

test("finding nothing is itself an answer worth reporting", async () => {
  const target = await root();
  const rendered = renderDecisions("something nobody discussed", await findDecisions(target, "something nobody discussed"));
  assert.match(rendered, /Nothing recorded/);
  assert.match(rendered, /question worth their turn/);
});

/* ------------------------------------------------------------------ lock */

test("concurrent writers do not lose each other's work", async () => {
  const target = await root();
  const path = resolve(target, "counter.json");
  await writeFile(path, JSON.stringify({ items: [] }), "utf8");

  const { readFile } = await import("node:fs/promises");
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      withLock(path, async () => {
        const current = JSON.parse(await readFile(path, "utf8"));
        // A deliberate gap: without the lock this is where the other writer's
        // read lands, and one of the two updates disappears.
        await new Promise((wake) => setTimeout(wake, 3));
        current.items.push(index);
        await writeFile(path, JSON.stringify(current), "utf8");
      }),
    ),
  );

  const final = JSON.parse(await readFile(path, "utf8"));
  assert.equal(final.items.length, 12, "a concurrent write was lost");
});

test("a lock whose holder is gone does not wedge the repository", async () => {
  const target = await root();
  const path = resolve(target, "record.json");
  await mkdir(`${path}.lock`, { recursive: true });
  await writeFile(`${path}.lock/holder.json`, JSON.stringify({ pid: 999_999, at: Date.now() }), "utf8");

  let ran = false;
  await withLock(path, async () => {
    ran = true;
  });
  assert.ok(ran, "a dead holder's lock was never reclaimed");
});

test("a live holder is waited for, then refused with a reason", { timeout: 15_000 }, async () => {
  const target = await root();
  const path = resolve(target, "held.json");
  await mkdir(`${path}.lock`, { recursive: true });
  await writeFile(
    `${path}.lock/holder.json`,
    JSON.stringify({ pid: process.pid, at: Date.now() }),
    "utf8",
  );

  await assert.rejects(
    () => withLock(path, async () => undefined),
    (error: unknown) => {
      assert.ok(error instanceof GateRefusal);
      assert.match(error.render(), /being written by another session/);
      return true;
    },
  );
});
