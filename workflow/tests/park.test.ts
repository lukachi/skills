import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { buildInstallPlan } from "../src/planner.js";
import { parkWork, readPark, releaseWork } from "../src/park.js";
import { collectWorkflowState } from "../src/state.js";
import { STATE_COLLECTORS } from "../src/state-collectors.js";
import {
  approveWork,
  beginWork,
  claimWorkIssue,
  completeWorkIssue,
  createWorkIssue,
  reopenWorkIssue,
  reviewWorkBundleFile,
  updateWorkCheckpoint,
} from "../src/work.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("an approved framing does not start a parked bundle", async () => {
  const { knowledge, leaf } = await installed();
  const started = await beginWork({
    target: leaf,
    slug: "licence-and-rename",
    title: "Carry the licence statement",
    mode: "full",
  });
  // Exactly what the maintainer did: approve to settle what the work is, and
  // say in the same breath that starting is premature.
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:nzafat",
    method: "attested",
    attested: "одобряю, чтобы оно не мешалось, но начинать рано",
  });
  await parkWork({
    target: knowledge,
    id: started.id,
    by: "human:nzafat",
    reason: "The reconstruction finishes first.",
    attested: "начинать рано",
  });
  // Parking edits the record, so its checkpoint goes stale exactly as approval
  // makes it stale. The agent refreshes it and then meets the park itself.
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    currentState: "Framing approved and the work held.",
    lastCompleted: "Recorded the park.",
    nextAction: "Wait for the release.",
  });
  const change = parseWorkSpec(
    await readFile(join(knowledge, "changes/active", started.id, "change.md"), "utf8"),
  );
  const repository = String(
    ((change.metadata.repositories as Array<Record<string, unknown>>)[0]!).repository,
  );
  const issue = await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "licence-in-every-readme",
    title: "Carry the statement into every README",
    phase: "delivery",
    type: "delivery",
    repositories: [repository],
  });

  await assert.rejects(
    () =>
      claimWorkIssue({
        target: leaf,
        id: started.id,
        issueId: issue.id,
        actor: "agent:test-session",
      }),
    /is parked and cannot be worked/,
  );
});

test("a release takes the maintainer's own words, never an inference", async () => {
  const { knowledge, leaf } = await installed();
  const started = await beginWork({
    target: leaf,
    slug: "licence-and-rename",
    title: "Carry the licence statement",
    mode: "full",
  });
  await parkWork({
    target: knowledge,
    id: started.id,
    by: "human:nzafat",
    reason: "The reconstruction finishes first.",
  });

  await assert.rejects(
    () =>
      releaseWork({ target: knowledge, id: started.id, by: "human:nzafat", attested: "   " }),
    /requires the maintainer's own words/,
  );

  const released = await releaseWork({
    target: knowledge,
    id: started.id,
    by: "human:nzafat",
    attested: "да, начинай",
  });
  assert.equal(released.parked, false);

  const document = parseWorkSpec(
    await readFile(join(knowledge, "changes/active", started.id, "change.md"), "utf8"),
  );
  assert.equal(readPark(document.metadata), undefined);
  // The park survives as history: a reader must be able to see that starting was
  // once withheld, by whom, and why.
  const release = document.metadata.released as Record<string, unknown>;
  assert.equal(release.attested, "да, начинай");
  assert.match(String(release.was_parked_because), /reconstruction finishes first/);
});

test("a parked bundle asks nothing of the agent, so no guard drives it", async () => {
  const { knowledge, leaf } = await installed();
  const started = await beginWork({
    target: leaf,
    slug: "licence-and-rename",
    title: "Carry the licence statement",
    mode: "full",
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:nzafat",
    method: "attested",
    attested: "одобряю",
  });
  await parkWork({
    target: knowledge,
    id: started.id,
    by: "human:nzafat",
    reason: "The reconstruction finishes first.",
  });

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const agentSide = report.signals.filter((signal) =>
    signal.awaits === "agent" && signal.subject === started.id
  );
  // The stop guard re-enters on every agent-side signal. While a bundle is
  // parked there is no next action inside it, and reporting one pushed a parked
  // bundle into three source repositories one re-entry at a time.
  // Refreshing a checkpoint the park itself invalidated is bookkeeping and is
  // allowed to arm one re-entry; nothing that would advance the work may.
  assert.deepEqual(
    agentSide.map((signal) => signal.id).filter((id) => id !== "work.stale-checkpoint"),
    [],
  );
  const active = report.signals.find((signal) =>
    signal.id === "work.active" && signal.subject === started.id
  );
  assert.match(String(active?.summary), /parked and does not start/);
});

test("parking refuses to be silent about why", async () => {
  const { knowledge, leaf } = await installed();
  const started = await beginWork({
    target: leaf,
    slug: "licence-and-rename",
    title: "Carry the licence statement",
    mode: "full",
  });
  await assert.rejects(
    () => parkWork({ target: knowledge, id: started.id, by: "human:nzafat", reason: "  " }),
    /requires a reason/,
  );
});

async function installed(): Promise<{ knowledge: string; leaf: string }> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-park-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "leaf-repo");
  for (const path of [knowledge, leaf]) {
    await mkdir(path);
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: path });
    execFileSync("git", ["config", "user.email", "wfctl@example.com"], { cwd: path });
    execFileSync("git", ["config", "user.name", "wfctl"], { cwd: path });
  }
  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  await applyInstallPlan(await buildInstallPlan({
    target: leaf,
    profile: "leaf",
    knowledge,
    distributionRoot,
  }));
  await mkdir(join(leaf, "graphify-out"));
  await writeFile(join(leaf, "graphify-out/graph.json"), "{}\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: leaf });
  execFileSync("git", ["commit", "-m", "initialize workflow"], { cwd: leaf });
  return { knowledge, leaf };
}

test("a completion whose result was undone can be withdrawn, and says so", async () => {
  const { knowledge, leaf } = await installed();
  const started = await beginWork({
    target: leaf,
    slug: "licence-and-rename",
    title: "Carry the licence statement",
    mode: "full",
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:nzafat",
    method: "attested",
    attested: "одобряю",
  });
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    currentState: "Framing approved.",
    lastCompleted: "Recorded the approval.",
    nextAction: "Cut the route.",
  });
  const change = parseWorkSpec(
    await readFile(join(knowledge, "changes/active", started.id, "change.md"), "utf8"),
  );
  const repository = String(
    ((change.metadata.repositories as Array<Record<string, unknown>>)[0]!).repository,
  );
  const issue = await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "licence-in-every-readme",
    title: "Carry the statement into every README",
    phase: "delivery",
    type: "delivery",
    repositories: [repository],
  });
  await reviewWorkBundleFile(leaf, started.id, "change.md", "reviewed", "read in full");
  await reviewWorkBundleFile(
    leaf,
    started.id,
    `issues/${issue.id}-licence-in-every-readme.md`,
    "reviewed",
    "read in full",
  );
  await claimWorkIssue({
    target: leaf,
    id: started.id,
    issueId: issue.id,
    actor: "agent:test-session",
  });
  await completeWorkIssue({
    target: leaf,
    id: started.id,
    issueId: issue.id,
    summary: "The statement is in every README.",
    evidence: ["README.md at the working revision"],
  });

  await assert.rejects(
    () => reopenWorkIssue(leaf, started.id, issue.id, "  "),
    /requires a reason/,
  );
  // The commits were reverted out of every source tree. Leaving the issue
  // completed makes a bundle with no finished work read as finished.
  const reopened = await reopenWorkIssue(
    leaf,
    started.id,
    issue.id,
    "Every commit it produced was reverted; the result exists nowhere.",
  );
  assert.equal(reopened.status, "ready");

  const document = parseWorkSpec(
    await readFile(
      join(knowledge, "changes/active", started.id, "issues", `${issue.id}-licence-in-every-readme.md`),
      "utf8",
    ),
  );
  assert.equal(document.metadata.resolution, null);
  const reopenedRecord = document.metadata.reopened as Record<string, unknown>;
  assert.match(String(reopenedRecord.reason), /reverted/);
  // The completion is kept, not erased: someone has to see that this evidence
  // was accepted and then withdrawn.
  const withdrawn = reopenedRecord.withdrawn_resolution as Record<string, unknown>;
  assert.match(String(withdrawn.summary), /in every README/);
});

/**
 * Fill what a framing must rest on before anyone may approve it: what curated
 * knowledge says, and what each bound repository declares about itself. These
 * tests are about the park, and would otherwise all fail at that gate.
 */
async function prepareFraming(specPath: string): Promise<void> {
  const document = parseWorkSpec(await readFile(specPath, "utf8"));
  document.metadata.knowledge_alignment = {
    reviewed: ["knowledge/index.md"],
    conflicts: [],
  };
  for (const entry of Array.isArray(document.metadata.repositories) ? document.metadata.repositories : []) {
    if (entry && typeof entry === "object") {
      (entry as Record<string, unknown>).accounted = {
        status: "read",
        note: "Its own rules were read for this work.",
        at: "2026-08-06T00:00:00.000Z",
      };
    }
  }
  await writeFile(specPath, serializeWorkSpec(document), "utf8");
}
