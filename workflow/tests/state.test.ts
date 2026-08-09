import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { buildInstallPlan } from "../src/planner.js";
import { addLeafRepository } from "../src/repository-registry.js";
import {
  CAPABILITIES,
  collectWorkflowState,
  resolveCapabilities,
  sortSignals,
  type StateCollector,
  type StateSignal,
} from "../src/state.js";
import { STATE_COLLECTORS } from "../src/state-collectors.js";
import { parseWorkSpec, serializeWorkSpec } from "../src/work-spec.js";
import { beginIntakeCase, intakeContext, updateIntakeCheckpoint } from "../src/intake.js";
import {
  approveWork,
  beginWork,
  claimWorkIssue,
  createWorkIssue,
  dropWorkIssue,
  reviewWorkBundleFile,
  updateWorkCheckpoint,
} from "../src/work.js";
import { assessResumability } from "../src/resumability.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function collector(id: string, signals: StateSignal[]): StateCollector {
  return {
    id,
    profiles: ["knowledge", "leaf"],
    collect: async () => signals,
  };
}

function initializeGit(root: string): void {
  execFileSync("git", ["init", "--initial-branch=main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "wfctl@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "wfctl"], { cwd: root });
}

function commitAll(root: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-m", message], { cwd: root });
}

async function installKnowledge(): Promise<{ root: string; knowledge: string; leaf: string }> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-state-"));
  const knowledge = join(root, "knowledge-repo");
  const leaf = join(root, "leaf-repo");
  await mkdir(knowledge);
  await mkdir(leaf);
  initializeGit(knowledge);
  initializeGit(leaf);
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
  commitAll(leaf, "initialize workflow");
  return { root, knowledge, leaf };
}

test("derives capability availability from signals instead of scenario branches", () => {
  const signals: StateSignal[] = [
    {
      id: "sources.none",
      domain: "sources",
      level: "attention",
      summary: "none",
      blocks: ["reconstruct-baseline"],
    },
    { id: "corpus.populated", domain: "corpus", level: "ok", summary: "populated" },
  ];
  const capabilities = resolveCapabilities(
    [
      { id: "reconstruct-baseline", label: "baseline", profiles: ["knowledge"] },
      {
        id: "reconstruct-audit",
        label: "audit",
        profiles: ["knowledge"],
        requires: ["corpus.populated"],
      },
      { id: "close-work", label: "close", profiles: ["knowledge"], requires: ["work.active"] },
      { id: "implement-work", label: "implement", profiles: ["leaf"] },
    ],
    signals,
    "knowledge",
  );

  assert.deepEqual(capabilities.map((entry) => entry.id), [
    "reconstruct-baseline",
    "reconstruct-audit",
    "close-work",
  ]);
  assert.deepEqual(capabilities[0], {
    id: "reconstruct-baseline",
    label: "baseline",
    available: false,
    blockedBy: ["sources.none"],
    missing: [],
  });
  assert.equal(capabilities[1]?.available, true);
  assert.deepEqual(capabilities[2], {
    id: "close-work",
    label: "close",
    available: false,
    blockedBy: [],
    missing: ["work.active"],
  });
});

test("orders signals by urgency, then domain, then identity", () => {
  const ordered = sortSignals([
    { id: "work.active", domain: "work", level: "attention", summary: "b" },
    { id: "corpus.populated", domain: "corpus", level: "ok", summary: "c" },
    { id: "sources.unbound", domain: "sources", level: "blocked", summary: "a" },
    { id: "install.version-drift", domain: "install", level: "attention", summary: "d" },
  ]);
  assert.deepEqual(ordered.map((signal) => signal.id), [
    "sources.unbound",
    "install.version-drift",
    "work.active",
    "corpus.populated",
  ]);
});

test("degrades one failing collector instead of failing the whole report", async () => {
  const { knowledge } = await installKnowledge();
  const report = await collectWorkflowState(knowledge, {
    collectors: [
      collector("good", [{ id: "corpus.empty", domain: "corpus", level: "info", summary: "x" }]),
      {
        id: "broken",
        profiles: ["knowledge"],
        collect: async () => {
          throw new Error("registry is unreadable");
        },
      },
    ],
  });

  assert.deepEqual(report.signals.map((signal) => signal.id), ["corpus.empty"]);
  assert.deepEqual(report.degraded, [
    { collector: "broken", reason: "registry is unreadable" },
  ]);
});

test("reports a missing installation instead of throwing at session start", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-state-bare-"));
  const report = await collectWorkflowState(root);

  assert.equal(report.profile, undefined);
  assert.deepEqual(report.signals.map((signal) => signal.id), ["install.absent"]);
  assert.deepEqual(report.capabilities, []);
  assert.equal(
    report.signals[0]?.blocks?.includes("reconstruct-baseline"),
    true,
    "an absent installation must block every capability",
  );
});

test("runs only the collectors that apply to the installed profile", async () => {
  const { knowledge } = await installKnowledge();
  const leafOnly: StateCollector = {
    id: "leaf-only",
    profiles: ["leaf"],
    collect: async () => [{ id: "work.active", domain: "work", level: "info", summary: "x" }],
  };
  const report = await collectWorkflowState(knowledge, { collectors: [leafOnly] });

  assert.deepEqual(report.signals, []);
  assert.equal(report.profile, "knowledge");
});

test("blocks reconstruction on a fresh knowledge repository with no sources", async () => {
  const { knowledge } = await installKnowledge();
  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const ids = report.signals.map((signal) => signal.id);

  assert.equal(ids.includes("sources.none"), true);
  assert.equal(
    ids.includes("corpus.not-compiled"),
    true,
    "a fresh clone has no compiled graph until an agent builds one",
  );
  assert.equal(ids.includes("raw.empty"), true);
  assert.deepEqual(report.degraded, []);

  const baseline = report.capabilities.find((entry) => entry.id === "reconstruct-baseline");
  assert.deepEqual(baseline?.blockedBy, ["sources.none"]);
  const audit = report.capabilities.find((entry) => entry.id === "reconstruct-audit");
  assert.deepEqual(audit?.missing, ["corpus.populated"]);
  const intake = report.capabilities.find((entry) => entry.id === "process-raw-intake");
  assert.deepEqual(intake?.blockedBy, ["raw.empty"]);
  const change = report.capabilities.find((entry) => entry.id === "start-change");
  assert.equal(change?.available, true);
});

test("reports a registered but unselected repository as the reconstruction blocker", async () => {
  const { knowledge, leaf } = await installKnowledge();
  await addLeafRepository(knowledge, leaf);

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const unselected = report.signals.find((signal) => signal.id === "sources.unselected");

  assert.equal(unselected?.subject !== undefined, true);
  assert.equal(unselected?.facts?.candidates, 1);
  assert.equal(
    unselected?.awaits,
    "agent",
    "one candidate checkout is the agent's to announce and select",
  );
  const baseline = report.capabilities.find((entry) => entry.id === "reconstruct-baseline");
  assert.deepEqual(baseline?.blockedBy, ["sources.unselected"]);
});

test("holds bundle closure until approvals and verification are recorded", async () => {
  const { knowledge, leaf } = await installKnowledge();
  await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const active = report.signals.find((signal) => signal.id === "work.active");
  const approvals = report.signals.find((signal) => signal.id === "work.approvals-outstanding");

  assert.equal(active?.facts?.title, "Account recovery");
  // Only the stage the maintainer can answer today. Completion approves work
  // that has been done and verified, and this bundle is still being shaped.
  assert.equal(approvals?.facts?.stages, "framing");
  assert.equal(approvals?.awaits, "maintainer");

  const close = report.capabilities.find((entry) => entry.id === "close-work");
  assert.deepEqual(close?.blockedBy, [
    "work.approvals-outstanding",
    "work.verification-pending",
  ]);
  assert.deepEqual(close?.missing, []);
});

test("a bundle held for the maintainer is not reported as work awaiting the agent", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });

  // The stop guard re-enters the agent for every signal that awaits it. While
  // the framing is unapproved there is nothing the agent can do and nothing to
  // verify, so labelling either as agent-side re-entered the agent on every
  // turn for as long as the maintainer took to answer.
  const held = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const active = held.signals.find((signal) => signal.id === "work.active");
  const verification = held.signals.find((signal) => signal.id === "work.verification-pending");
  assert.equal(active?.awaits, "maintainer");
  assert.match(String(active?.summary), /held for you/);
  assert.equal(verification?.awaits, "maintainer");

  await prepareFraming(started.specPath);

  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "attested",
    attested: "yes, that framing is right",
    session: "this session",
  });

  const released = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    released.signals.find((signal) => signal.id === "work.active")?.awaits,
    "agent",
  );
  assert.equal(
    released.signals.find((signal) => signal.id === "work.verification-pending")?.awaits,
    "agent",
  );
});

test("tests the checkpoint against its record, not against the clock", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });
  const record = join(knowledge, "changes/active", started.id, "change.md");

  const fresh = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    fresh.signals.some((signal) => signal.id.endsWith("stale-checkpoint")),
    false,
    JSON.stringify(fresh.signals.map((signal) => signal.id)),
  );

  // Backdate the checkpoint far past any age threshold while leaving it an
  // accurate description of the record. Age is not the question. The basis
  // digest deliberately excludes updated_at, so this must not read as drift.
  const backdated = (await readFile(record, "utf8")).replace(
    /\n(\s+)updated_at: [^\n]*\n(\s+)basis_sha256:/,
    "\n$1updated_at: 2020-01-01T00:00:00.000Z\n$2basis_sha256:",
  );
  assert.match(backdated, /updated_at: 2020-01-01T00:00:00\.000Z/, "backdating must apply");
  await writeFile(record, backdated, "utf8");

  const old = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    old.signals.some((signal) => signal.id === "work.stale-checkpoint"),
    false,
    "an old checkpoint that still matches its record is resumable",
  );

  // Move the record without touching the checkpoint. Same minute, now stale.
  await writeFile(
    record,
    `${backdated}\n\n## Later\n\nA paragraph the checkpoint never saw.\n`,
    "utf8",
  );
  const drifted = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const stale = drifted.signals.find((signal) => signal.id === "work.stale-checkpoint");
  assert.equal(stale?.subject, started.id);
  assert.equal(stale?.awaits, "agent");
  assert.equal(stale?.level, "attention");
});

test("the brief and the record's own command agree about one checkpoint", async () => {
  const { knowledge } = await installKnowledge();
  await mkdir(join(knowledge, "raw"), { recursive: true });
  await writeFile(join(knowledge, "raw/notes.md"), "# Notes\n\nA candidate.\n", "utf8");
  commitAll(knowledge, "add intake fixture");
  const started = await beginIntakeCase({
    target: knowledge,
    slug: "brief-agreement",
    title: "Brief agreement",
    paths: ["raw/notes.md"],
    distributionRoot,
  });
  await updateIntakeCheckpoint({
    target: knowledge,
    id: started.id,
    status: "active",
    stage: "source-review",
    actor: "workflow-agent/test",
    currentState: "The first source is awaiting complete review.",
    lastCompleted: "Froze the case at its baseline.",
    nextAction: "Read raw/notes.md completely from the frozen blob.",
  });

  // Intake parses case.md with its own parser and the brief uses the shared
  // one. They disagreed about whether the blank line after the closing `---`
  // belongs to the body, so the same bytes hashed to two values and a
  // just-stamped checkpoint read as stale from the brief and current from the
  // case — permanently, and with awaits: agent on a signal no refresh clears.
  assert.equal((await intakeContext(knowledge, started.id)).checkpoint?.valid, true);
  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    report.signals.some((signal) => signal.id.endsWith("checkpoint")),
    false,
    JSON.stringify(report.signals.filter((signal) => signal.id.endsWith("checkpoint"))),
  );
});

test("names the capabilities whose delivery drifted from accepted intent", async () => {
  const { knowledge } = await installKnowledge();
  await mkdir(join(knowledge, ".workflow/current"), { recursive: true });
  await writeFile(
    join(knowledge, ".workflow/current/knowledge-graph.json"),
    JSON.stringify({
      generatedAt: "2026-08-04T00:00:00.000Z",
      nodes: [
        {
          kind: "concept",
          path: "knowledge/areas/world/capabilities/rest.md",
          title: "Resting",
          realization: { intent: "accepted", delivery: "partial", alignment: "drifted" },
        },
        {
          kind: "concept",
          path: "knowledge/areas/world/capabilities/party.md",
          title: "Party",
          realization: { intent: "accepted", delivery: "verified", alignment: "aligned" },
        },
      ],
      edges: [],
    }),
    "utf8",
  );

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const drift = report.signals.find((signal) => signal.id === "corpus.intent-delivery-drift");

  assert.equal(drift?.facts?.capabilities, 1);
  assert.equal(drift?.facts?.named, "Resting");
  // A count is what made this debt invisible; a name is what makes it work.
  // Nobody owes an action this minute, so the signal claims no audience.
  assert.equal(drift?.awaits, undefined);
});

test("keeps every shipped capability reachable from a collector or a requirement", () => {
  const declared = new Set(CAPABILITIES.map((capability) => capability.id));
  const referenced = new Set<string>();
  for (const source of [
    ...CAPABILITIES.flatMap((capability) => capability.requires ?? []),
  ]) {
    referenced.add(source);
  }

  assert.equal(
    STATE_COLLECTORS.length > 0,
    true,
    "the default registry must not be empty",
  );
  for (const required of referenced) {
    assert.equal(
      declared.has(required),
      false,
      `${required} must be a signal id, not a capability id`,
    );
  }
});

test("the brief carries where the work stopped, not only what is outstanding", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    currentState: "Three of seven services read; the fourth contradicts the design note.",
    lastCompleted: "Read the trading service at the pin.",
    nextAction: "Read the quests service and settle the contradiction before writing anything.",
  });

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const resume = report.signals.find((signal) => signal.id === "work.resume");
  // A fresh session receives the brief and nothing else. Without these two
  // fields it learns what is outstanding and never learns where work stopped.
  assert.equal(resume?.subject, started.id);
  assert.match(String(resume?.facts?.state), /contradicts the design note/);
  assert.match(String(resume?.facts?.next), /settle the contradiction/);
});

test("a session is unsafe to stop while work sits outside every checkpoint", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "active",
    currentState: "Shaped.",
    lastCompleted: "Wrote the framing.",
    nextAction: "Put the framing to the maintainer.",
  });
  execFileSync("git", ["add", "-A"], { cwd: knowledge });
  execFileSync("git", ["commit", "-qm", "record the framing"], { cwd: knowledge });

  const clean = await assessResumability(knowledge);
  assert.equal(clean.safe, true, JSON.stringify(clean.entries));

  // Work on disk that no checkpoint describes is the one loss a basis digest
  // cannot see: it compares a checkpoint to its own record, and this is neither.
  await writeFile(join(knowledge, "trajectories-probe.md"), "# probe\n", "utf8");
  const dirty = await assessResumability(knowledge);
  assert.equal(dirty.safe, false);
  assert.deepEqual(dirty.uncommitted, ["trajectories-probe.md"]);
  assert.equal(
    dirty.entries.some((entry) => entry.risks.includes("uncommitted")),
    true,
  );
});

test("completion approval is not demanded of a bundle that has not been done", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "account-recovery",
    title: "Account recovery",
    mode: "full",
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "attested",
    attested: "yes",
  });

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  // Nothing is left for the maintainer to answer, so nothing sits in their
  // queue. Closure still requires the approval, and the capability still says so.
  assert.equal(
    report.signals.some((signal) => signal.id === "work.approvals-outstanding"),
    false,
    JSON.stringify(report.signals.map((signal) => signal.id)),
  );
  const later = report.signals.find((signal) => signal.id === "work.approvals-later");
  assert.equal(later?.facts?.stages, "completion");
  // Neither party owes an action on a future approval, so it claims neither and
  // the stop guard is not armed by a fact.
  assert.equal(later?.awaits, undefined);
  const close = report.capabilities.find((entry) => entry.id === "close-work");
  assert.equal(close?.available, false);
});

test("a corpus with no engineering page says so once repositories are registered", async () => {
  const { knowledge, leaf } = await installKnowledge();
  await addLeafRepository(knowledge, leaf);
  await writeKnowledgeGraph(knowledge, [
    { id: "combat.capabilities.combat", path: "knowledge/areas/combat/combat.md", view: "product" },
    { id: "world.capabilities.money", path: "knowledge/areas/world/money.md", view: "product" },
  ]);

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const empty = report.signals.find((signal) => signal.id === "corpus.engineering-road-empty");

  // Both roads validate per file, so a road with no files on it passed every
  // check there was: the corpus was valid, the graph matched it, and the count
  // said populated. Only the maintainer noticed, by looking.
  assert.equal(empty !== undefined, true, JSON.stringify(report.signals.map((s) => s.id)));
  assert.equal(empty?.facts?.repositories, 1);
  assert.equal(empty?.facts?.productPages, 2);
  assert.equal(empty?.facts?.engineeringPages, 0);
  // Writing that road is an undertaking, not a step before ending a turn.
  assert.equal(empty?.awaits, undefined, "it is a fact, and must not arm the stop guard");
});

test("one engineering page is enough to stop reporting the road as empty", async () => {
  const { knowledge, leaf } = await installKnowledge();
  await addLeafRepository(knowledge, leaf);
  await writeKnowledgeGraph(knowledge, [
    { id: "combat.capabilities.combat", path: "knowledge/areas/combat/combat.md", view: "product" },
    {
      id: "architecture.service-boundaries",
      path: "knowledge/architecture/service-boundaries.md",
      view: "engineering",
    },
  ]);

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    report.signals.some((signal) => signal.id === "corpus.engineering-road-empty"),
    false,
  );
});

async function writeKnowledgeGraph(
  knowledge: string,
  concepts: Array<{ id: string; path: string; view: string }>,
): Promise<void> {
  const path = join(knowledge, ".workflow/current/knowledge-graph.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      generatedAt: "2026-08-06T00:00:00.000Z",
      nodes: concepts.map((concept) => ({
        ...concept,
        kind: "concept",
        title: concept.id,
      })),
      edges: [],
    }),
    "utf8",
  );
}

/** Fill what a framing must rest on, so these tests reach what they are about. */
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

test("the brief opens with what the agent can act on, not with the worst level", async () => {
  const ordered = sortSignals([
    { id: "work.blocked", domain: "work", level: "blocked", summary: "b", awaits: "maintainer" },
    { id: "raw.present", domain: "raw", level: "info", summary: "r" },
    { id: "work.active", domain: "work", level: "attention", summary: "a", awaits: "agent" },
    { id: "trajectory.debts-unscheduled", domain: "trajectory", level: "attention", summary: "d", awaits: "maintainer" },
    { id: "corpus.not-compiled", domain: "corpus", level: "blocked", summary: "c", awaits: "agent" },
  ]);

  // A brief is delivered truncated once it outgrows a session, as a preview of
  // its first bytes. Level answers how bad a thing is; a session opens on what
  // it may do about it, and severity still decides inside each group.
  assert.deepEqual(ordered.map((signal) => signal.id), [
    "corpus.not-compiled",
    "work.active",
    "work.blocked",
    "trajectory.debts-unscheduled",
    "raw.present",
  ]);
});

test("a truncated brief cannot bury the one thing the agent owns", async () => {
  const { knowledge, leaf } = await installKnowledge();
  // Five records nobody but the maintainer can move, and one the agent can.
  for (const slug of ["one", "two", "three", "four", "five"]) {
    const started = await beginWork({
      target: leaf,
      slug,
      title: `Held ${slug}`,
      mode: "full",
      distributionRoot,
    });
    const document = parseWorkSpec(await readFile(started.specPath, "utf8"));
    const checkpoint = document.metadata.checkpoint as Record<string, unknown>;
    checkpoint.blockers = ["Waiting on the maintainer."];
    await writeFile(started.specPath, serializeWorkSpec(document), "utf8");
  }
  const mine = await beginWork({
    target: leaf,
    slug: "mine",
    title: "The one in play",
    mode: "full",
    distributionRoot,
  });
  await prepareFraming(mine.specPath);
  await approveWork({
    target: leaf,
    id: mine.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
  });

  const report = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const first = report.signals.find((signal) => signal.subject !== undefined);
  assert.equal(
    first?.subject,
    mine.id,
    `the first record-bearing signal must be the one the agent owns: ${
      JSON.stringify(report.signals.slice(0, 3).map((s) => [s.id, s.subject, s.awaits]))
    }`,
  );
  assert.equal(first?.awaits, "agent");
});

test("verification is the agent's only once the route is finished", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "still-building",
    title: "Still building",
    mode: "full",
    distributionRoot,
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
  });
  const change = parseWorkSpec(await readFile(started.specPath, "utf8"));
  const bound = (change.metadata.repositories as Array<Record<string, unknown>>)[0];
  await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "one-slice",
    title: "One slice",
    phase: "delivery",
    type: "task",
    repositories: [String(bound?.repository ?? "")],
    distributionRoot,
  });

  // An open issue means the work is not done, so there is nothing to verify and
  // nobody owes an action. Claiming the agent here armed the stop guard on a
  // bundle whose agent was waiting for a person to look at a page: nine
  // re-entries in one turn, each finding real side work that moved the state
  // fingerprint and so defeated the guard's own release.
  const building = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const pending = building.signals.find((signal) =>
    signal.id === "work.verification-pending" && signal.subject === started.id
  );
  assert.equal(pending !== undefined, true);
  assert.equal(pending?.awaits, undefined, "nothing is verifiable while a slice is open");
  assert.deepEqual(pending?.blocks, ["close-work"], "closure still requires it");

  await dropWorkIssue(leaf, started.id, "ISSUE-001", "Folded into the change itself.");

  const finished = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    finished.signals.find((signal) =>
      signal.id === "work.verification-pending" && signal.subject === started.id
    )?.awaits,
    "agent",
    "with nothing open, verifying is exactly what the agent does next",
  );
});

test("a frontier nobody has claimed is a backlog, and does not arm the stop guard", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "three-of-these",
    title: "Three of these",
    mode: "full",
    distributionRoot,
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
  });

  // Approved and cut into nothing yet: building the frontier is the next action
  // and it is the agent's, so a turn that ends here ends mid-task.
  const empty = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    empty.signals.find((signal) => signal.id === "work.active")?.awaits,
    "agent",
  );

  const change = parseWorkSpec(await readFile(started.specPath, "utf8"));
  const bound = (change.metadata.repositories as Array<Record<string, unknown>>)[0];
  const repository = String(bound?.repository ?? "");
  await createWorkIssue({
    target: leaf,
    id: started.id,
    slug: "the-largest-one",
    title: "The largest one",
    phase: "delivery",
    type: "task",
    repositories: [repository],
    distributionRoot,
  });

  // A ready issue is available work, not work in hand. An agent that finished a
  // unit, checkpointed it and found stopping safe owes this bundle nothing, and
  // saying otherwise made three open bundles into a standing obligation: the
  // agent argued against starting the largest task on a spent context, was
  // returned to the turn, and started it anyway.
  const queued = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  const idle = queued.signals.find((signal) => signal.id === "work.active");
  assert.equal(idle?.awaits, undefined, "a queue nobody is holding may be left where it is");
  assert.match(String(idle?.summary), /nothing in it is claimed/);
  assert.equal(idle?.level, "attention", "it still reaches the brief; it just owes nobody");

  // Approving and cutting the frontier both edited the record, so the claim gate
  // refuses until the checkpoint describes what is there now.
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test",
    status: "active",
    currentState: "The framing is approved and the frontier holds one delivery task.",
    lastCompleted: "Cut the largest remaining task out of the approved scope.",
    nextAction: "Claim it and change the record shape behind it.",
  });

  for (const path of ["change.md", "issues/ISSUE-001-the-largest-one.md"]) {
    await reviewWorkBundleFile(leaf, started.id, path, "reviewed", "Read before claiming.");
  }

  await claimWorkIssue({
    target: leaf,
    id: started.id,
    issueId: "ISSUE-001",
    actor: "agent:test",
  });

  // Claimed is the state the guard exists for: something is in the agent's
  // hands, and ending the turn parks it.
  const inHand = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  assert.equal(
    inHand.signals.find((signal) => signal.id === "work.active")?.awaits,
    "agent",
  );
});

test("a checkpoint blocker takes the bundle off the agent", async () => {
  const { knowledge, leaf } = await installKnowledge();
  const started = await beginWork({
    target: leaf,
    slug: "waiting-on-a-person",
    title: "Waiting on a person",
    mode: "full",
    distributionRoot,
  });
  await prepareFraming(started.specPath);
  await approveWork({
    target: leaf,
    id: started.id,
    stage: "framing",
    by: "human:test-maintainer",
    method: "interactive",
  });
  assert.equal(
    (await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS })).signals
      .find((signal) => signal.id === "work.verification-pending")?.awaits,
    "agent",
  );

  // The release the guard's message now names. An agent blocked on a person
  // wrote what it needed in nine consecutive messages; prose is not state, and
  // this is the line that changes what the repository reports.
  await updateWorkCheckpoint({
    target: leaf,
    id: started.id,
    actor: "agent:test-session",
    status: "blocked",
    currentState: "The page is built and needs a person to look at it.",
    nextAction: "Nothing until he looks.",
    blockers: ["He has to open the page before anything can be verified."],
  });

  const held = await collectWorkflowState(knowledge, { collectors: STATE_COLLECTORS });
  for (const signal of held.signals.filter((entry) => entry.subject === started.id)) {
    assert.notEqual(
      signal.awaits,
      "agent",
      `${signal.id} still claims the agent while the record names a blocker`,
    );
  }
});
