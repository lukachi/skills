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
import { beginIntakeCase, intakeContext, updateIntakeCheckpoint } from "../src/intake.js";
import { approveWork, beginWork } from "../src/work.js";

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
  assert.equal(approvals?.facts?.stages, "framing,completion");
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
