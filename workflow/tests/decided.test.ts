import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findDecisions, recordDecided, renderDecisions } from "../src/decided.js";
import { framingIssues, parseWorkSpec } from "../src/work-spec.js";

test("an answer recorded only in a bundle is found, and says it never reached a page", async () => {
  const root = await corpus();
  const result = await findDecisions(root, "equipment effects hardcoded and authorable");

  assert.equal(result.decisions.length > 0, true);
  const top = result.decisions[0]!;
  assert.match(top.what, /authorable/);
  assert.equal(top.home, "capture");
  assert.equal(top.onAPage, false);

  // The distinction is the whole point: a page is what the corpus teaches, an
  // archive is what it forgot to, and a packet citing one must say which.
  const rendered = renderDecisions(result);
  assert.match(rendered, /recorded only in changes\/archive\/captures/);
});

test("work already delivered answers the question too, and is reported as delivered", async () => {
  const root = await corpus();
  const result = await findDecisions(root, "a party short rest heals nobody");
  const top = result.decisions[0]!;

  assert.match(top.what, /party rest asks nobody anything/);
  assert.equal(top.home, "delivered");
  assert.match(renderDecisions(result), /already delivered, recorded in/);
});

test("a promoted page outranks the same answer read out of an archive", async () => {
  const root = await corpus();
  const result = await findDecisions(root, "licence lives separately from the catalog");

  assert.equal(result.decisions[0]?.home, "page");
  assert.equal(result.decisions[0]?.onAPage, true);
});

test("an empty result is an answer only once it says why", async () => {
  const root = await corpus();
  await bundle(root, "2026-08-10-unrelated");

  await assert.rejects(
    recordDecided({ target: root, id: "2026-08-10-unrelated", subject: "photosynthesis" }),
    /empty result is only an answer once it says so/,
  );

  const { path } = await recordDecided({
    target: root,
    id: "2026-08-10-unrelated",
    subject: "photosynthesis",
    none: "Nothing in this project has ever touched plant biology.",
  });
  const decided = decidedOf(await readFile(path, "utf8"));
  assert.equal(decided.checked, "photosynthesis");
  assert.deepEqual(decided.found, []);
  assert.match(String(decided.none), /plant biology/);
});

test("framing is refused until someone looked, and the lookup writes its own receipt", async () => {
  const root = await corpus();
  const path = await bundle(root, "2026-08-10-equipment-rework");

  const before = parseWorkSpec(await readFile(path, "utf8"));
  assert.equal(
    framingIssues(before).some((issue) => /knowledge_alignment\.decided must record/.test(issue)),
    true,
    "a framing settles what the work is; it may not settle it without looking",
  );

  await recordDecided({
    target: root,
    id: "2026-08-10-equipment-rework",
    subject: "equipment effects hardcoded and authorable",
  });

  const after = parseWorkSpec(await readFile(path, "utf8"));
  assert.deepEqual(
    framingIssues(after).filter((issue) => /decided/.test(issue)),
    [],
  );
  // Written by the command that ran the search, so a recorded check is one that
  // happened. A hand-written field would be the single place this record could
  // claim work nobody did.
  const decided = decidedOf(await readFile(path, "utf8"));
  assert.equal(Array.isArray(decided.found) && decided.found.length > 0, true);
});

function decidedOf(content: string): Record<string, unknown> {
  const alignment = parseWorkSpec(content).metadata.knowledge_alignment as Record<string, unknown>;
  return alignment.decided as Record<string, unknown>;
}

async function bundle(root: string, id: string): Promise<string> {
  const path = join(root, "changes/active", id, "change.md");
  await mkdir(join(root, "changes/active", id), { recursive: true });
  await writeFile(
    path,
    `---\nworkflow_version: 5\nid: "${id}"\ntitle: "Something"\n`
      + "knowledge_alignment:\n  reviewed: []\n  conflicts: []\n"
      + "repositories: []\n---\n\n# Summary\n\nSomething.\n",
    "utf8",
  );
  return path;
}

/** The four homes an answer lands in, one example each. */
async function corpus(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-decided-"));

  await mkdir(join(root, "knowledge/decisions"), { recursive: true });
  await writeFile(
    join(root, "knowledge/decisions/licence-lives-separately.md"),
    "---\ntitle: The licence lives separately from the catalog and the content\n"
      + "updated_at: 2026-08-05T00:00:00Z\n---\n\n# Decision\n\nIt lives separately.\n",
    "utf8",
  );

  await mkdir(join(root, "changes/archive/captures"), { recursive: true });
  await writeFile(
    join(root, "changes/archive/captures/2026-08-03-equip-logic.md"),
    "---\ntitle: \"Must-have: equipment effects on a character are hardcoded and are to be "
      + "reworked into authorable logic\"\nstatus: routed\ncreated_at: 2026-08-03T21:20:45Z\n"
      + "resolution:\n  reason: The direction the maintainer attested on 2026-08-05.\n"
      + "---\n\n# Summary\n\nHe called it a must-have.\n",
    "utf8",
  );

  const fight = join(root, "changes/archive/2026-08-06-what-a-fight-can-do");
  await mkdir(join(fight, "issues"), { recursive: true });
  await writeFile(
    join(fight, "change.md"),
    "---\nworkflow_version: 5\nid: \"2026-08-06-what-a-fight-can-do\"\ntitle: \"A fight\"\n"
      + "updated_at: 2026-08-09T00:00:00Z\nknowledge_promotion:\n  decisions:\n"
      + "    - what: An effect belongs to the thing that bears it.\n"
      + "      said: map.md#ISSUE-001\n      disposition: promoted\n---\n\n# Summary\n\nA fight.\n",
    "utf8",
  );
  await writeFile(
    join(fight, "issues/ISSUE-002-a-short-rest-spends-a-reserve.md"),
    "---\nworkflow_version: 3\nkind: work-issue\nid: ISSUE-002\n"
      + "title: A short rest spends a reserve the player chooses from\nstatus: completed\n"
      + "resolution:\n  summary: \"A short rest spends a reserve whose size the player chooses. "
      + "Two consequences are the maintainer's to settle: a party rest asks nobody anything, so "
      + "a party short rest now heals nobody.\"\n  completed_at: 2026-08-09T09:16:09Z\n"
      + "---\n\n# Issue\n\nThe reserve.\n",
    "utf8",
  );
  return root;
}
