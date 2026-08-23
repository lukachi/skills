#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/types.ts
var FLOW_SCHEMA_VERSION, WORK_STEPS, RECALL_ROUTES;
var init_types = __esm({
  "src/core/types.ts"() {
    "use strict";
    FLOW_SCHEMA_VERSION = 1;
    WORK_STEPS = [
      "opened",
      "aligned",
      "framed",
      "split",
      "implement",
      "verified",
      "closed",
      "promoted"
    ];
    RECALL_ROUTES = ["qmd", "graphify", "grep", "read", "maintainer"];
  }
});

// src/core/recall.ts
function emptyCounters() {
  return RECALL_ROUTES.reduce((counters, route) => {
    counters[route] = 0;
    return counters;
  }, {});
}
function emptyRecall() {
  return { answers: [], counters: emptyCounters(), covered: [] };
}
function itemsForGroup(group) {
  return RECALL_ITEMS.filter((item) => item.group === group);
}
function findItem(id) {
  return RECALL_ITEMS.find((item) => item.id.toUpperCase() === id.toUpperCase());
}
function isAnswered(state, itemId) {
  return state.answers.some(
    (answer) => answer.item.toUpperCase() === itemId.toUpperCase() && answer.answer.trim().length > 0 && answer.source.trim().length > 0
  );
}
function shortfallFor(step, state) {
  const requirement = STEP_REQUIREMENTS[step];
  if (!requirement) {
    return { missingItems: [], missingFloor: [] };
  }
  const missingItems = requirement.groups.flatMap((group) => itemsForGroup(group)).filter((item) => !isAnswered(state, item.id));
  const missingFloor = Object.entries(requirement.floor).map(([route, required]) => ({
    route,
    required: required ?? 0,
    actual: state.counters[route] ?? 0
  })).filter((entry) => entry.actual < entry.required);
  return { missingItems, missingFloor };
}
function isSatisfied(shortfall) {
  return shortfall.missingItems.length === 0 && shortfall.missingFloor.length === 0;
}
function renderCounterLine(step, state) {
  const requirement = STEP_REQUIREMENTS[step];
  const required = requirement ? requirement.groups.flatMap((group) => itemsForGroup(group)) : [];
  const answered = required.filter((item) => isAnswered(state, item.id)).length;
  const counters = RECALL_ROUTES.map((route) => `${route} ${state.counters[route] ?? 0}`).join(
    " \xB7 "
  );
  const lines = [`recall: ${answered}/${required.length} required answered \xB7 ${counters}`];
  const shortfall = shortfallFor(step, state);
  if (shortfall.missingItems.length > 0) {
    const missing = shortfall.missingItems.map((item) => `${item.id} ${item.question}`).join("\n         ");
    lines.push(`missing: ${missing}`);
  }
  for (const entry of shortfall.missingFloor) {
    lines.push(
      `floor:   ${entry.route} used ${entry.actual}, this step requires ${entry.required}`
    );
  }
  return lines.join("\n");
}
function recordAnswer(state, answer) {
  const answers = state.answers.filter(
    (existing) => existing.item.toUpperCase() !== answer.item.toUpperCase()
  );
  answers.push(answer);
  const counters = { ...state.counters };
  counters[answer.route] = (counters[answer.route] ?? 0) + 1;
  return { ...state, answers, counters };
}
function recordRoute(state, route, covered = []) {
  const counters = { ...state.counters };
  counters[route] = (counters[route] ?? 0) + 1;
  const merged = /* @__PURE__ */ new Set([...state.covered, ...covered]);
  return { ...state, counters, covered: [...merged].sort() };
}
var RECALL_ITEMS, STEP_REQUIREMENTS;
var init_recall = __esm({
  "src/core/recall.ts"() {
    "use strict";
    init_types();
    RECALL_ITEMS = [
      { id: "A1", group: "A", question: "Has the maintainer already answered this?" },
      { id: "A2", group: "A", question: "Is there a current decision record on this subject? A superseded one?" },
      { id: "A3", group: "A", question: "Was this proposed and rejected before?" },
      { id: "A4", group: "A", question: "Does a recorded non-goal forbid it?" },
      { id: "B5", group: "B", question: "What is the canonical term for this subject, and its aliases?" },
      { id: "B6", group: "B", question: "Which discouraged names would hide it from a search?" },
      { id: "B7", group: "B", question: "Am I searching with those terms, or with my own paraphrase?" },
      { id: "C8", group: "C", question: "Which Area owns this responsibility?" },
      { id: "C9", group: "C", question: "Which repository owns the code?" },
      { id: "C10", group: "C", question: "Does a capability already cover it?" },
      { id: "D11", group: "D", question: "Does an implementation already exist? (graph traversal, not grep)" },
      { id: "D12", group: "D", question: "What calls it, and what depends on it \u2014 the blast radius?" },
      { id: "D13", group: "D", question: "Is there an existing pattern for this that I should match?" },
      { id: "E14", group: "E", question: "Does curated knowledge already say something that contradicts this?" },
      { id: "E15", group: "E", question: "Is any page for this subject marked drifted?" },
      { id: "E16", group: "E", question: "Is there an open uncertainty record on it?" },
      { id: "F17", group: "F", question: "Is another flow or bundle touching this subject?" },
      { id: "F18", group: "F", question: "Is there an inbox capture about it?" },
      { id: "F19", group: "F", question: "Is a debt scheduled against it?" },
      { id: "G20", group: "G", question: "Is what I read production code, or a fixture, mock, demo, or test?" },
      { id: "G21", group: "G", question: "Is this claim implementation authority, or a clue from a note?" },
      { id: "G22", group: "G", question: "At which exact revision did I observe it?" },
      { id: "H23", group: "H", question: "If I found nothing, how many independent routes did I try?" },
      { id: "H24", group: "H", question: "Am I recording not-found, or asserting it does not exist?" }
    ];
    STEP_REQUIREMENTS = {
      aligned: { groups: ["E"], floor: { qmd: 1 } },
      framed: { groups: ["A", "B", "C", "E"], floor: { qmd: 1 } },
      implement: { groups: ["D"], floor: { graphify: 1 } },
      verified: { groups: ["G"], floor: {} },
      promoted: { groups: ["E", "H"], floor: {} }
    };
  }
});

// src/core/steps.ts
function definitionFor(step) {
  const found = WORK_STEP_DEFINITIONS.find((definition) => definition.step === step);
  if (!found) throw new Error(`Unknown step ${step}`);
  return found;
}
function nextStep(step) {
  const index = WORK_STEPS.indexOf(step);
  return index >= 0 ? WORK_STEPS[index + 1] : void 0;
}
function deriveBlocker(flow) {
  if (flow.closedAt) return void 0;
  if (flow.parked) {
    return {
      step: flow.step,
      awaits: "maintainer",
      summary: `Parked: ${flow.parked.reason}`,
      remedy: `wfctl work release ${flow.id}`
    };
  }
  const definition = definitionFor(flow.step);
  const shortfall = shortfallFor(flow.step, flow.recall);
  if (!isSatisfied(shortfall)) {
    return {
      step: flow.step,
      awaits: "agent",
      summary: `Recall incomplete for ${flow.step}.`,
      remedy: "wfctl recall answer <item> --answer ... --route ... --source ..."
    };
  }
  const awaitsMaintainer = flow.step === "framed" || flow.step === "promoted";
  return {
    step: flow.step,
    awaits: awaitsMaintainer ? "maintainer" : "agent",
    summary: definition.demands,
    remedy: definition.command
  };
}
function renderStep(flow) {
  const definition = definitionFor(flow.step);
  const lines = [
    `flow ${flow.id}  \xB7  step ${flow.step}`,
    "",
    definition.demands,
    "",
    `next: ${definition.command}`,
    "",
    renderCounterLine(flow.step, flow.recall)
  ];
  return lines.join("\n");
}
var WORK_STEP_DEFINITIONS;
var init_steps = __esm({
  "src/core/steps.ts"() {
    "use strict";
    init_recall();
    init_types();
    WORK_STEP_DEFINITIONS = [
      {
        step: "opened",
        demands: "Whether this work is significant or lightweight. Significant work changes behaviour, meaning, contracts, data, or operations; lightweight work is local and preserves both behaviour and contracts. Put the distinction to the maintainer in your own words \u2014 do not read this out, and do not decide it yourself.",
        command: "wfctl work start --weight <significant|lightweight>"
      },
      {
        step: "aligned",
        demands: "What the project already says about this subject. If nothing is written yet, record that nothing covers it \u2014 an empty corpus passes a conflict check silently, and that reads exactly like a check that found nothing wrong.",
        command: "wfctl work align"
      },
      {
        step: "framed",
        demands: "What the work is: the outcome, the boundary, and the acceptance criteria. This is the cheapest moment to change the scope and the last one where it is free.",
        command: "wfctl work frame --approve"
      },
      {
        step: "split",
        demands: "The units of delivery, sized by scope and coherence. Not by what fits in a session \u2014 that framing made agents stop halfway through a context that was still wide open.",
        command: "wfctl work issue create",
        optionalWhen: (flow) => flow.weight === "lightweight"
      },
      {
        step: "implement",
        demands: "One slice at a time, in the checkout the claim binds.",
        command: "wfctl work issue claim <id>"
      },
      {
        step: "verified",
        demands: "An adversarial review, run by a separate agent, whose every attack is an executable test. You cannot run it yourself: the agent that wrote the tests can write the review that approves them.",
        command: "wfctl work verify"
      },
      {
        step: "closed",
        demands: "Nothing from anybody. Every part of 'is this done' is already answered by the checks, and asking the maintainer to confirm arithmetic is not a decision.",
        command: "wfctl work close"
      },
      {
        step: "promoted",
        demands: "What the project now says about itself. This one is the maintainer's, and it is the second and last thing they are asked.",
        command: "wfctl work promote"
      }
    ];
  }
});

// src/core/gates.ts
function assertReached(flow, step) {
  const required = PRECONDITION[step];
  if (!required) return;
  const order = ["opened", "aligned", "framed", "split", "implement", "verified", "closed", "promoted"];
  if (order.indexOf(flow.step) < order.indexOf(required)) {
    const definition = definitionFor(required);
    throw new GateRefusal(
      `This flow is at ${flow.step}; ${step} needs ${required} recorded first.`,
      definition.command,
      definition.demands
    );
  }
}
function assertRecall(flow, step) {
  const shortfall = shortfallFor(step, flow.recall);
  if (isSatisfied(shortfall)) return;
  throw new GateRefusal(
    `Recall is incomplete for ${step}.`,
    'wfctl recall answer <item> --answer "<what you found>" --route <qmd|graphify|grep|read|maintainer> --source "<where>"',
    `${renderCounterLine(step, flow.recall)}

wfctl guide recall \u2014 why this checklist exists`
  );
}
function assertNotParked(flow) {
  if (!flow.parked) return;
  throw new GateRefusal(
    `Flow ${flow.id} is parked: ${flow.parked.reason}`,
    `wfctl work release ${flow.id}`,
    "Approving a framing settles what the work is, never that it begins. The condition that held it ending is not the same as being told to go."
  );
}
var GateRefusal, PRECONDITION;
var init_gates = __esm({
  "src/core/gates.ts"() {
    "use strict";
    init_recall();
    init_steps();
    GateRefusal = class extends Error {
      constructor(message, remedy, detail) {
        super(message);
        this.remedy = remedy;
        this.detail = detail;
        this.name = "GateRefusal";
      }
      remedy;
      detail;
      render() {
        return [this.message, this.detail, `remedy: ${this.remedy}`].filter((part) => Boolean(part)).join("\n");
      }
    };
    PRECONDITION = {
      aligned: "opened",
      framed: "aligned",
      split: "framed",
      implement: "framed",
      verified: "implement",
      closed: "verified",
      promoted: "closed"
    };
  }
});

// src/core/guidance.ts
var guidance_exports = {};
__export(guidance_exports, {
  GUIDE_TOPICS: () => GUIDE_TOPICS,
  compose: () => compose,
  loadGuidance: () => loadGuidance
});
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
async function loadGuidance(source, key) {
  const path = resolve(source.root, `${key}.md`);
  try {
    const text = await readFile(path, "utf8");
    return text.trim().length > 0 ? text.trim() : void 0;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function compose(parts) {
  return parts.filter((part) => Boolean(part && part.trim())).join("\n\n");
}
var GUIDE_TOPICS;
var init_guidance = __esm({
  "src/core/guidance.ts"() {
    "use strict";
    GUIDE_TOPICS = {
      wfctl: "guide/wfctl",
      recall: "recall/checklist",
      structure: "recall/structure",
      interview: "decide/interview",
      "domain-language": "decide/domain-language",
      prototype: "decide/prototype",
      research: "decide/research",
      adversarial: "verify/adversarial",
      "curate-product": "curate/product",
      "curate-engineering": "curate/engineering",
      quality: "curate/quality",
      routing: "curate/routing",
      discoveries: "work/discoveries",
      wayfind: "work/wayfind"
    };
  }
});

// src/core/flow.ts
var flow_exports = {};
__export(flow_exports, {
  FlowOpenError: () => FlowOpenError,
  closeFlow: () => closeFlow,
  createFlowId: () => createFlowId,
  currentFlow: () => currentFlow,
  currentFlowId: () => currentFlowId,
  flowDirectory: () => flowDirectory,
  flowPath: () => flowPath,
  listFlows: () => listFlows,
  openFlow: () => openFlow,
  readFlow: () => readFlow,
  writeFlow: () => writeFlow
});
import { mkdir, readFile as readFile2, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve as resolve2 } from "node:path";
function flowDirectory(root) {
  return resolve2(root, FLOW_DIR);
}
function flowPath(root, id) {
  return join(flowDirectory(root), `${id}.json`);
}
function createFlowId(kind, title, now) {
  const date = now.toISOString().slice(0, 10);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${date}-${kind}-${slug || "untitled"}`;
}
async function readFlow(root, id) {
  try {
    const raw = await readFile2(flowPath(root, id), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeFlow(root, flow) {
  await mkdir(flowDirectory(root), { recursive: true });
  const next = { ...flow, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await writeFile(flowPath(root, flow.id), `${JSON.stringify(next, null, 2)}
`, "utf8");
}
async function currentFlowId(root) {
  try {
    const raw = await readFile2(resolve2(root, CURRENT_POINTER), "utf8");
    const id = raw.trim();
    return id.length > 0 ? id : void 0;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function currentFlow(root) {
  const id = await currentFlowId(root);
  return id ? readFlow(root, id) : void 0;
}
async function setCurrent(root, id) {
  await mkdir(flowDirectory(root), { recursive: true });
  const path = resolve2(root, CURRENT_POINTER);
  if (id === void 0) {
    await rm(path, { force: true });
    return;
  }
  await writeFile(path, `${id}
`, "utf8");
}
async function openFlow(root, options) {
  const open = await currentFlow(root);
  if (open && !open.closedAt) {
    throw new FlowOpenError(
      `Flow ${open.id} is open; work outside it is out of scope. A finding found while working belongs in the capture inbox.`,
      `wfctl capture "<what you found>"   (or: wfctl flow close ${open.id})`
    );
  }
  const now = options.now ?? /* @__PURE__ */ new Date();
  const id = createFlowId(options.kind, options.title, now);
  const flow = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id,
    kind: options.kind,
    title: options.title,
    step: "opened",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    members: [],
    repositories: [],
    issues: [],
    recall: emptyRecall(),
    ...options.weight ? { weight: options.weight } : {}
  };
  await writeFlow(root, flow);
  await setCurrent(root, id);
  return flow;
}
async function closeFlow(root, id) {
  const flow = await readFlow(root, id);
  if (!flow) {
    throw new FlowOpenError(`No flow named ${id}.`, "wfctl flow list");
  }
  const closed = { ...flow, closedAt: (/* @__PURE__ */ new Date()).toISOString() };
  delete closed.checkpoint;
  await writeFlow(root, closed);
  const current = await currentFlowId(root);
  if (current === id) await setCurrent(root, void 0);
  return closed;
}
async function listFlows(root) {
  let entries;
  try {
    entries = await readdir(flowDirectory(root));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const flows = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const flow = await readFlow(root, entry.slice(0, -".json".length));
    if (flow) flows.push(flow);
  }
  return flows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
var FLOW_DIR, CURRENT_POINTER, FlowOpenError;
var init_flow = __esm({
  "src/core/flow.ts"() {
    "use strict";
    init_recall();
    init_types();
    FLOW_DIR = ".workflow/flows";
    CURRENT_POINTER = ".workflow/flows/current";
    FlowOpenError = class extends Error {
      constructor(message, remedy) {
        super(message);
        this.remedy = remedy;
        this.name = "FlowOpenError";
      }
      remedy;
    };
  }
});

// src/core/paths.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname, relative, resolve as resolve3, sep } from "node:path";
function promotionDirectory(knowledgeRoot, bundleId) {
  return resolve3(knowledgeRoot, "changes", "active", bundleId, "promotion");
}
async function createPromotionDraft(knowledgeRoot, bundleId, page) {
  const normalized = page.replace(/^\/+/, "");
  if (normalized.split(/[\\/]/).includes("..")) {
    throw new GateRefusal(
      "A promotion page path may not climb out of the bundle.",
      'wfctl work promotion draft "<area>/<page>.md"'
    );
  }
  const path = resolve3(promotionDirectory(knowledgeRoot, bundleId), normalized);
  await mkdir2(dirname(path), { recursive: true });
  await writeFile2(path, "", { flag: "wx" }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  return path;
}
function assertWriteAllowed(options) {
  const target = resolve3(options.target);
  const knowledge = resolve3(options.knowledgeRoot);
  const rel = relative(knowledge, target);
  if (rel.startsWith("..")) return;
  const segments = rel.split(sep);
  if (segments[0] === "knowledge") {
    throw new GateRefusal(
      "A curated page cannot be written directly into knowledge/.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "Pages enter curated knowledge through promotion, which is the maintainer's decision. Drafts live in the bundle until then."
    );
  }
  if (segments[0] === "changes" && segments[1] === "active") {
    const bundle = segments[2];
    if (!bundle) return;
    if (options.bundleId && bundle !== options.bundleId) {
      throw new GateRefusal(
        `This flow does not own bundle ${bundle}.`,
        'wfctl capture "<what you found>"',
        "A finding met during work belongs in the capture inbox, not in a new bundle."
      );
    }
    if (!options.bundleId) {
      throw new GateRefusal(
        "No flow is open, so no bundle may be created.",
        'wfctl work start --title "<what this is>"',
        "Bundles are opened at flow start, with the maintainer \u2014 never by hand in the middle of other work."
      );
    }
  }
}
var init_paths = __esm({
  "src/core/paths.ts"() {
    "use strict";
    init_gates();
  }
});

// src/core/verify.ts
var verify_exports = {};
__export(verify_exports, {
  LENS_QUESTIONS: () => LENS_QUESTIONS,
  VERIFY_LENSES: () => VERIFY_LENSES,
  assertReviewUsable: () => assertReviewUsable,
  renderReviewerBrief: () => renderReviewerBrief
});
function assertReviewUsable(flow, review) {
  if (review.reviewer.trim().length === 0) {
    throw new GateRefusal(
      "The review records no reviewer.",
      "wfctl work verify --reviewer <agent id>",
      "The implementing agent cannot review its own work: the agent that wrote the tests can write the review that approves them."
    );
  }
  if (review.attacks.length === 0 && review.findings.length === 0) {
    throw new GateRefusal(
      "The review is empty: no findings and no recorded attacks.",
      "wfctl work verify --attack <file>",
      'A reviewer that broke nothing must still say what it tried. "Looks correct" is not an allowed answer.'
    );
  }
  if (review.stubSurvivors.length > 0) {
    throw new GateRefusal(
      `${review.stubSurvivors.length} test(s) still pass with the implementation stubbed.`,
      "Fix the tests, then re-run the review.",
      `Those tests assert nothing:
  ${review.stubSurvivors.join("\n  ")}`
    );
  }
  const open = review.findings.filter((finding) => finding.status === "open");
  if (open.length > 0) {
    throw new GateRefusal(
      `${open.length} finding(s) are unresolved.`,
      "Resolve them, or accept each with a recorded reason.",
      open.map((finding) => `  [${finding.lens}] ${finding.summary}`).join("\n")
    );
  }
  const silent = review.findings.filter(
    (finding) => finding.status === "accepted" && !finding.acceptedBecause?.trim()
  );
  if (silent.length > 0) {
    throw new GateRefusal(
      `${silent.length} finding(s) were accepted without a reason.`,
      'wfctl work finding accept <id> --because "<why this is acceptable>"',
      "A finding may be accepted, never silently."
    );
  }
  if (flow.framingDigest && flow.framingDigest !== review.framingDigest) {
    throw new GateRefusal(
      "The acceptance criteria have changed since the framing was approved.",
      `wfctl work approve ${flow.id} --stage completion`,
      "This is the one case where closure returns to the maintainer: delivery no longer matches the framing they agreed to."
    );
  }
}
function renderReviewerBrief(lens, fixedPoint) {
  return [
    `You are reviewing work at the fixed point ${fixedPoint}.`,
    "",
    `Lens: ${lens} \u2014 ${LENS_QUESTIONS[lens]}`,
    "",
    "Your goal is to break this work, not to confirm it.",
    "",
    "Every attack must be an executable test. Write it, run it, and return the",
    "source, its output, and whether it broke the work. If you could not break",
    "it, say exactly what you tried and why it held.",
    "",
    "Also read the diff backwards: for each changed file, ask what the framing",
    "said about it. That direction finds work nobody asked for.",
    "",
    "You will not be given the implementer's reasoning. Do not ask for it."
  ].join("\n");
}
var VERIFY_LENSES, LENS_QUESTIONS;
var init_verify = __esm({
  "src/core/verify.ts"() {
    "use strict";
    init_gates();
    VERIFY_LENSES = [
      "intent",
      "correctness",
      "contract",
      "failure-paths",
      "state-and-data",
      "delivery-reality",
      "test-integrity"
    ];
    LENS_QUESTIONS = {
      intent: "Does the diff do what the framing asked, and only that?",
      correctness: "Which input makes this produce the wrong answer?",
      contract: "What existing caller breaks? What shape changed?",
      "failure-paths": "What happens on error, empty, concurrent, retried, partial?",
      "state-and-data": "What happens to data written by the previous version?",
      "delivery-reality": "Is the only caller a test, fixture, demo, or mock?",
      "test-integrity": "Would these tests catch a broken implementation?"
    };
  }
});

// src/core/review-artifact.ts
var review_artifact_exports = {};
__export(review_artifact_exports, {
  readReviewArtifact: () => readReviewArtifact
});
import { readFile as readFile3 } from "node:fs/promises";
function fail(message, remedy, detail) {
  throw new GateRefusal(message, remedy, detail);
}
async function readReviewArtifact(path, actor) {
  const raw = await readFile3(path, "utf8").catch(() => {
    fail(`No review artifact at ${path}.`, "wfctl work verify --review <path to the returned artifact>");
  });
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(
      `The review artifact at ${path} is not valid JSON.`,
      "Have the reviewer return the artifact verbatim rather than summarizing it."
    );
  }
  if (!parsed.reviewer?.trim()) {
    fail("The review names no reviewer.", "Have the reviewer record its own identity.");
  }
  if (parsed.reviewer.trim() === actor) {
    fail(
      "The review was produced by the agent under review.",
      "Delegate the review to a separate agent and pass back its artifact.",
      "The agent that wrote the tests can write the review that approves them."
    );
  }
  for (const [index, attack] of (parsed.attacks ?? []).entries()) {
    if (!VERIFY_LENSES.includes(attack.lens)) {
      fail(
        `Attack ${index + 1} declares an unknown lens ${String(attack.lens)}.`,
        `Use one of: ${VERIFY_LENSES.join(", ")}`
      );
    }
    if (!attack.test?.trim()) {
      fail(
        `Attack ${index + 1} carries no test.`,
        "Every attack is an executable test, written and run.",
        "A prose finding is settled by whoever writes more confidently. A test is settled by running it."
      );
    }
    if (!attack.output?.trim()) {
      fail(
        `Attack ${index + 1} carries a test that was never run.`,
        "Run each attack and return its output."
      );
    }
    if (!attack.target?.trim()) {
      fail(`Attack ${index + 1} does not say what it tried to break.`, "Record the target of each attack.");
    }
  }
  return {
    fixedPoint: parsed.fixedPoint ?? "",
    framingDigest: parsed.framingDigest ?? "",
    reviewer: parsed.reviewer.trim(),
    attacks: parsed.attacks ?? [],
    findings: parsed.findings ?? [],
    stubSurvivors: parsed.stubSurvivors ?? []
  };
}
var init_review_artifact = __esm({
  "src/core/review-artifact.ts"() {
    "use strict";
    init_gates();
    init_verify();
  }
});

// src/core/promotion-queue.ts
var promotion_queue_exports = {};
__export(promotion_queue_exports, {
  ACTIVE: () => ACTIVE,
  ARCHIVE: () => ARCHIVE,
  QUEUE: () => QUEUE,
  assertCorrectable: () => assertCorrectable,
  closeBundle: () => closeBundle,
  destinationFor: () => destinationFor,
  hasDraftedPages: () => hasDraftedPages,
  listQueue: () => listQueue,
  promote: () => promote,
  queuePath: () => queuePath
});
import { mkdir as mkdir3, readdir as readdir2, rename, stat } from "node:fs/promises";
import { join as join2, resolve as resolve4 } from "node:path";
function destinationFor(outcome, hasDrafts) {
  return hasDrafts ? QUEUE : ARCHIVE;
}
async function isDirectory(path) {
  return stat(path).then(
    (entry) => entry.isDirectory(),
    () => false
  );
}
async function hasDraftedPages(knowledgeRoot, bundleId) {
  const promotion = resolve4(knowledgeRoot, ACTIVE, bundleId, "promotion");
  if (!await isDirectory(promotion)) return false;
  const entries = await readdir2(promotion, { recursive: true, withFileTypes: true });
  return entries.some((entry) => entry.isFile() && entry.name.endsWith(".md"));
}
async function closeBundle(options) {
  const from = resolve4(options.knowledgeRoot, ACTIVE, options.bundleId);
  if (!await isDirectory(from)) {
    throw new GateRefusal(
      `No active record named ${options.bundleId}.`,
      "wfctl work status"
    );
  }
  const drafts = await hasDraftedPages(options.knowledgeRoot, options.bundleId);
  const destination = destinationFor(options.outcome, drafts);
  const to = resolve4(options.knowledgeRoot, destination, options.bundleId);
  await mkdir3(resolve4(options.knowledgeRoot, destination), { recursive: true });
  await rename(from, to);
  return { from, to, outcome: options.outcome, waitingOnPromotion: destination === QUEUE };
}
async function assertCorrectable(knowledgeRoot, bundleId) {
  const queued = resolve4(knowledgeRoot, QUEUE, bundleId);
  if (await isDirectory(queued)) return queued;
  const active = resolve4(knowledgeRoot, ACTIVE, bundleId);
  if (await isDirectory(active)) return active;
  const archived = resolve4(knowledgeRoot, ARCHIVE, bundleId);
  if (await isDirectory(archived)) {
    throw new GateRefusal(
      `${bundleId} is archived; its pages are already in curated knowledge.`,
      "Correct the curated page through a new flow.",
      "An archived record is history. Editing it would change what the project says it decided, without anything recording that it changed."
    );
  }
  throw new GateRefusal(`No record named ${bundleId}.`, "wfctl work status");
}
async function listQueue(knowledgeRoot) {
  const path = resolve4(knowledgeRoot, QUEUE);
  if (!await isDirectory(path)) return [];
  const entries = await readdir2(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
async function promote(options) {
  const queued = resolve4(options.knowledgeRoot, QUEUE, options.bundleId);
  if (!await isDirectory(queued)) {
    throw new GateRefusal(
      `${options.bundleId} is not waiting in the promotion queue.`,
      "wfctl work promotion list"
    );
  }
  const archived = resolve4(options.knowledgeRoot, ARCHIVE, options.bundleId);
  await mkdir3(resolve4(options.knowledgeRoot, ARCHIVE), { recursive: true });
  await rename(queued, archived);
  return { archived };
}
function queuePath(knowledgeRoot, bundleId) {
  return join2(resolve4(knowledgeRoot, QUEUE), bundleId);
}
var ACTIVE, QUEUE, ARCHIVE;
var init_promotion_queue = __esm({
  "src/core/promotion-queue.ts"() {
    "use strict";
    init_gates();
    ACTIVE = "changes/active";
    QUEUE = "changes/promotion";
    ARCHIVE = "changes/archive";
  }
});

// src/core/trajectory.ts
var trajectory_exports = {};
__export(trajectory_exports, {
  AXES: () => AXES,
  TRAJECTORY_DIR: () => TRAJECTORY_DIR,
  appendEvent: () => appendEvent,
  deriveGap: () => deriveGap,
  listTrajectories: () => listTrajectories,
  readTrajectory: () => readTrajectory,
  renderTrajectory: () => renderTrajectory,
  subjectId: () => subjectId,
  trajectoryPath: () => trajectoryPath,
  writeTrajectory: () => writeTrajectory
});
import { mkdir as mkdir4, readFile as readFile4, readdir as readdir3, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname2, resolve as resolve5 } from "node:path";
function trajectoryPath(root, id) {
  return resolve5(root, TRAJECTORY_DIR, `${id}.json`);
}
async function readTrajectory(root, id) {
  try {
    return JSON.parse(await readFile4(trajectoryPath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeTrajectory(root, trajectory) {
  const path = trajectoryPath(root, trajectory.id);
  await mkdir4(dirname2(path), { recursive: true });
  await writeFile3(
    path,
    `${JSON.stringify({ ...trajectory, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`,
    "utf8"
  );
}
async function listTrajectories(root) {
  let entries;
  try {
    entries = await readdir3(resolve5(root, TRAJECTORY_DIR));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const trajectory = await readTrajectory(root, entry.slice(0, -".json".length));
    if (trajectory) found.push(trajectory);
  }
  return found.sort((left, right) => left.subject.localeCompare(right.subject));
}
function subjectId(subject) {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
async function appendEvent(root, subject, event) {
  if (!subject.trim()) {
    throw new GateRefusal(
      "An event needs the subject whose line it belongs to.",
      'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>"'
    );
  }
  if (!event.summary.trim()) {
    throw new GateRefusal(
      "An event needs its summary, in product language.",
      'wfctl trajectory append --subject "<...>" --summary "<what happened>"'
    );
  }
  const id = subjectId(subject);
  const existing = await readTrajectory(root, id);
  const trajectory = existing ?? {
    id,
    subject: subject.trim(),
    events: [],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  trajectory.events = [...trajectory.events, event];
  await writeTrajectory(root, trajectory);
  return trajectory;
}
function deriveGap(trajectory) {
  const summaries = (axis) => trajectory.events.filter((event) => event.axis === axis).map((event) => event.summary);
  const delivered = new Set(summaries("delivery"));
  return {
    subject: trajectory.subject,
    delivery: summaries("intent").filter((summary) => !delivered.has(summary)),
    direction: summaries("vision").filter((summary) => !delivered.has(summary))
  };
}
function renderTrajectory(trajectory) {
  const lines = [`${trajectory.subject}  (${trajectory.id})`, ""];
  for (const event of trajectory.events) {
    const when = event.at ? `${event.at}  ` : "";
    const from = event.change ? `  \u2190 ${event.change}` : "";
    lines.push(`  ${event.axis.padEnd(8)} ${when}${event.summary}${from}`);
  }
  const gap = deriveGap(trajectory);
  if (gap.delivery.length > 0) {
    lines.push("", "  not delivered:");
    for (const item of gap.delivery) lines.push(`    ${item}`);
  }
  if (gap.direction.length > 0) {
    lines.push("", "  direction not reached:");
    for (const item of gap.direction) lines.push(`    ${item}`);
  }
  return lines.join("\n");
}
var TRAJECTORY_DIR, AXES;
var init_trajectory = __esm({
  "src/core/trajectory.ts"() {
    "use strict";
    init_gates();
    TRAJECTORY_DIR = "trajectories";
    AXES = ["intent", "delivery", "vision"];
  }
});

// src/core/write-hook.ts
var write_hook_exports = {};
__export(write_hook_exports, {
  decideWrite: () => decideWrite
});
import { relative as relative3, resolve as resolve8 } from "node:path";
function decideWrite(input) {
  const { flow, knowledgeRoot, target } = input;
  try {
    assertWriteAllowed({
      knowledgeRoot,
      target,
      ...flow ? { bundleId: flow.members[0] ?? flow.id } : {}
    });
  } catch (error) {
    if (error instanceof GateRefusal) return { refusal: error };
    throw error;
  }
  if (!flow) return {};
  const normalized = normalize(knowledgeRoot, target);
  const first = input.writtenThisUnit.length === 0;
  const covered = flow.recall.covered.some(
    (entry) => normalize(knowledgeRoot, entry) === normalized
  );
  if (!first && covered) return {};
  if (first && (flow.recall.counters.graphify ?? 0) === 0) {
    return {
      refusal: new GateRefusal(
        "No structural traversal has been made for this unit.",
        "wfctl recall route graphify --covered <files>",
        `${renderCounterLine(flow.step, flow.recall)}

wfctl guide structure \u2014 searching by graph before by string`
      )
    };
  }
  const reason = first ? "first write of this unit" : "this file is outside what any traversal or query has covered";
  return {
    message: [`[wfctl] ${reason}`, input.guidance, renderCounterLine(flow.step, flow.recall)].filter((part) => Boolean(part)).join("\n\n")
  };
}
function normalize(root, path) {
  const absolute = resolve8(root, path);
  return relative3(root, absolute) || absolute;
}
var init_write_hook = __esm({
  "src/core/write-hook.ts"() {
    "use strict";
    init_paths();
    init_recall();
    init_gates();
  }
});

// src/core/registry.ts
var registry_exports = {};
__export(registry_exports, {
  REGISTRY_PATH: () => REGISTRY_PATH,
  addRepository: () => addRepository,
  readRegistry: () => readRegistry,
  removeRepository: () => removeRepository,
  renderRegistry: () => renderRegistry,
  writeRegistry: () => writeRegistry
});
import { mkdir as mkdir7, readFile as readFile6, writeFile as writeFile6 } from "node:fs/promises";
import { dirname as dirname5, resolve as resolve9 } from "node:path";
async function readRegistry(root) {
  try {
    const raw = await readFile6(resolve9(root, REGISTRY_PATH), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.repositories ?? [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeRegistry(root, repositories) {
  const path = resolve9(root, REGISTRY_PATH);
  await mkdir7(dirname5(path), { recursive: true });
  await writeFile6(path, `${JSON.stringify({ repositories }, null, 2)}
`, "utf8");
}
async function addRepository(root, entry) {
  for (const [field, value] of Object.entries(entry)) {
    if (!String(value).trim()) {
      throw new GateRefusal(
        `A registered repository needs its ${field}.`,
        "wfctl repo add <owner/name> --path <dir> [--checkout <name>] [--worktree <id>]"
      );
    }
  }
  const existing = await readRegistry(root);
  const duplicate = existing.find(
    (candidate) => candidate.repository === entry.repository && candidate.worktreeId === entry.worktreeId
  );
  if (duplicate) {
    throw new GateRefusal(
      `${entry.repository} worktree ${entry.worktreeId} is already registered at ${duplicate.path}.`,
      `wfctl repo remove ${entry.repository} --worktree ${entry.worktreeId}`,
      "Two checkouts of one repository are distinct only by worktree identity. Registering the same one twice makes the second silently shadow the first."
    );
  }
  const next = [...existing, entry].sort(
    (left, right) => left.repository.localeCompare(right.repository) || left.worktreeId.localeCompare(right.worktreeId)
  );
  await writeRegistry(root, next);
  return next;
}
async function removeRepository(root, repository, worktreeId) {
  const existing = await readRegistry(root);
  const next = existing.filter(
    (entry) => entry.repository !== repository || worktreeId !== void 0 && entry.worktreeId !== worktreeId
  );
  if (next.length === existing.length) {
    throw new GateRefusal(`${repository} is not registered.`, "wfctl repo list");
  }
  await writeRegistry(root, next);
  return next;
}
function renderRegistry(repositories) {
  if (repositories.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]"
    ].join("\n");
  }
  return repositories.map((entry) => `${entry.repository}  ${entry.worktreeId.padEnd(12)}  ${entry.path}`).join("\n");
}
var REGISTRY_PATH;
var init_registry = __esm({
  "src/core/registry.ts"() {
    "use strict";
    init_gates();
    REGISTRY_PATH = ".workflow/repositories.json";
  }
});

// src/core/reconstruct.ts
var reconstruct_exports = {};
__export(reconstruct_exports, {
  RAW_DIR: () => RAW_DIR,
  RECONSTRUCTION_ARCHIVE: () => RECONSTRUCTION_ARCHIVE,
  RECONSTRUCTION_DIR: () => RECONSTRUCTION_DIR,
  STAGES: () => STAGES,
  STAGE_PRESENCE: () => STAGE_PRESENCE,
  assertAdjudicated: () => assertAdjudicated,
  assertCrawlComplete: () => assertCrawlComplete,
  assertProbed: () => assertProbed,
  assertTrajectoriesExist: () => assertTrajectoriesExist,
  casePath: () => casePath,
  closeCase: () => closeCase,
  hasBaseline: () => hasBaseline,
  nextStage: () => nextStage,
  rawInventory: () => rawInventory,
  readCase: () => readCase,
  remaining: () => remaining,
  renderOutcome: () => renderOutcome,
  writeCase: () => writeCase
});
import { mkdir as mkdir8, readFile as readFile7, readdir as readdir5, stat as stat3, writeFile as writeFile7 } from "node:fs/promises";
import { dirname as dirname6, join as join4, resolve as resolve10 } from "node:path";
function casePath(root, id) {
  return resolve10(root, RECONSTRUCTION_DIR, id, "case.json");
}
async function readCase(root, id) {
  try {
    return JSON.parse(await readFile7(casePath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeCase(root, record) {
  const path = casePath(root, record.id);
  await mkdir8(dirname6(path), { recursive: true });
  await writeFile7(path, `${JSON.stringify(record, null, 2)}
`, "utf8");
}
async function hasBaseline(root) {
  const knowledge = resolve10(root, "knowledge");
  try {
    const entries = await readdir5(knowledge, { recursive: true, withFileTypes: true });
    return entries.some((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) return false;
      const parent = entry.parentPath ?? knowledge;
      return !(parent === knowledge && entry.name === "index.md");
    });
  } catch {
    return false;
  }
}
async function rawInventory(root) {
  const raw = resolve10(root, RAW_DIR);
  try {
    const entries = await readdir5(raw, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join4(entry.parentPath ?? raw, entry.name).slice(raw.length + 1)).sort();
  } catch {
    return [];
  }
}
function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  return index >= 0 ? STAGES[index + 1] : void 0;
}
function remaining(coverage) {
  const done = /* @__PURE__ */ new Set([...coverage.read, ...coverage.excluded.map((entry) => entry.path)]);
  return coverage.inScope.filter((path) => !done.has(path));
}
function assertCrawlComplete(record) {
  const left = remaining(record.coverage);
  if (left.length === 0) return;
  throw new GateRefusal(
    `${left.length} file(s) in scope are neither read nor excluded.`,
    'wfctl reconstruct read <path>   (or: wfctl reconstruct exclude <path> --reason "<why>")',
    left.slice(0, 10).join("\n  ")
  );
}
function assertTrajectoriesExist(record) {
  if (record.trajectories.length > 0) return;
  throw new GateRefusal(
    "No trajectory has been assembled, so nothing can be written yet.",
    'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>" --axis <intent|delivery|vision>',
    "A claim about current truth made while reading is made before the material that contradicts it has been read."
  );
}
function assertAdjudicated(record) {
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  if (open.length === 0) return;
  throw new GateRefusal(
    `${open.length} contradiction(s) are unresolved.`,
    'wfctl reconstruct resolve <id> --resolution "<what they decided>"',
    open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")
  );
}
function assertProbed(record, actor) {
  if (record.probes.length === 0) {
    throw new GateRefusal(
      "No omission probe has been run.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --page <path>',
      "A probe asks whether the written pages can answer without reopening the source. It is what catches material that was fetched and never read."
    );
  }
  const mine = record.probes.filter((probe) => probe.asker === actor);
  if (mine.length > 0) {
    throw new GateRefusal(
      "The probes were asked by the agent that wrote the pages.",
      "Delegate the probe round to a separate agent.",
      "Asking yourself what you might have missed returns what you already know."
    );
  }
  const failed = record.probes.filter((probe) => probe.passed !== true);
  if (failed.length > 0) {
    throw new GateRefusal(
      `${failed.length} probe(s) did not pass.`,
      "Repair the pages, then run the probe round again.",
      failed.map((probe) => `  ${probe.question}`).join("\n")
    );
  }
}
function renderOutcome(record) {
  if (record.trajectories.length > 0) {
    return `${record.trajectories.length} subject(s) recorded.`;
  }
  const revisions = record.repositories.map((entry) => `${entry.repository}@${entry.revision}${entry.dirty ? " (dirty)" : ""}`).join(", ");
  return `Nothing moved. Checked at ${revisions}.`;
}
async function closeCase(root, id) {
  const from = resolve10(root, RECONSTRUCTION_DIR, id);
  const present = await stat3(from).then(
    (entry) => entry.isDirectory(),
    () => false
  );
  if (!present) {
    throw new GateRefusal(`No active reconstruction named ${id}.`, "wfctl reconstruct status");
  }
  const to = resolve10(root, RECONSTRUCTION_ARCHIVE, id);
  await mkdir8(resolve10(root, RECONSTRUCTION_ARCHIVE), { recursive: true });
  const { rename: rename2 } = await import("node:fs/promises");
  await rename2(from, to);
  return to;
}
var RECONSTRUCTION_DIR, RECONSTRUCTION_ARCHIVE, RAW_DIR, STAGES, STAGE_PRESENCE;
var init_reconstruct = __esm({
  "src/core/reconstruct.ts"() {
    "use strict";
    init_gates();
    RECONSTRUCTION_DIR = "reconstruction/active";
    RECONSTRUCTION_ARCHIVE = "reconstruction/archive";
    RAW_DIR = "reconstruction/raw";
    STAGES = [
      "scope",
      "crawl",
      "assemble",
      "adjudicate",
      "write",
      "probe",
      "promote"
    ];
    STAGE_PRESENCE = {
      scope: "maintainer",
      crawl: "nobody",
      assemble: "nobody",
      adjudicate: "maintainer",
      write: "nobody",
      probe: "nobody",
      promote: "maintainer"
    };
  }
});

// src/core/cli.ts
import { existsSync } from "node:fs";
import { dirname as dirname7, resolve as resolve11 } from "node:path";

// src/core/commands.ts
import { mkdir as mkdir5, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname3, resolve as resolve6 } from "node:path";

// src/core/checkpoint.ts
init_steps();
var CheckpointError = class extends Error {
  constructor(message, remedy) {
    super(message);
    this.remedy = remedy;
    this.name = "CheckpointError";
  }
  remedy;
};
function buildCheckpoint(input, now = /* @__PURE__ */ new Date()) {
  for (const [field, value] of Object.entries({
    summary: input.summary,
    handoff: input.handoff,
    lastAction: input.lastAction,
    nextAction: input.nextAction
  })) {
    if (!value || value.trim().length === 0) {
      throw new CheckpointError(
        `A checkpoint needs ${field}; an empty one recalls nothing.`,
        `wfctl checkpoint --${field.toLowerCase()} "<...>"`
      );
    }
  }
  return {
    summary: input.summary.trim(),
    handoff: input.handoff.trim(),
    lastAction: input.lastAction.trim(),
    nextAction: input.nextAction.trim(),
    actor: input.actor,
    updatedAt: now.toISOString(),
    todo: input.todo ?? []
  };
}
function renderBrief(flows, currentId) {
  const open = flows.filter((flow) => !flow.closedAt);
  if (open.length === 0) {
    return [
      "No flow is open.",
      "",
      "Start one explicitly when the maintainer asks for work:",
      '  wfctl work start --title "<what this is>"',
      '  wfctl reconstruct start --title "<what this is>"'
    ].join("\n");
  }
  const lines = [];
  const current = open.find((flow) => flow.id === currentId);
  if (current) {
    lines.push(`flow ${current.id}  \xB7  ${current.kind}  \xB7  step ${current.step}`);
    lines.push(current.title);
    lines.push("");
    if (current.checkpoint) {
      lines.push(current.checkpoint.handoff);
      lines.push("");
      lines.push(`last: ${current.checkpoint.lastAction}`);
      lines.push(`next: ${current.checkpoint.nextAction}`);
      if (current.checkpoint.todo.length > 0) {
        lines.push("todo:");
        for (const item of current.checkpoint.todo) lines.push(`  - ${item}`);
      }
    } else {
      lines.push("No checkpoint yet. Write one before this session does anything material.");
    }
    const blocker = deriveBlocker(current);
    if (blocker) {
      lines.push("");
      lines.push(`awaits ${blocker.awaits}: ${blocker.summary}`);
      lines.push(`remedy: ${blocker.remedy}`);
    }
  }
  const others = open.filter((flow) => flow.id !== currentId);
  if (others.length > 0) {
    lines.push("");
    lines.push("other open flows:");
    for (const flow of others) {
      const summary = flow.checkpoint?.summary ?? "no checkpoint";
      lines.push(`  ${flow.id}  \xB7  ${flow.step}  \xB7  ${summary}`);
    }
  }
  return lines.join("\n");
}
function renderHandoff(flow) {
  if (!flow.checkpoint) {
    return `Flow ${flow.id} has no checkpoint.`;
  }
  return [
    `flow ${flow.id}  \xB7  step ${flow.step}`,
    "",
    flow.checkpoint.handoff,
    "",
    `last: ${flow.checkpoint.lastAction}`,
    `next: ${flow.checkpoint.nextAction}`,
    `actor: ${flow.checkpoint.actor}   updated: ${flow.checkpoint.updatedAt}`
  ].join("\n");
}

// src/core/commands.ts
init_gates();
init_guidance();
init_flow();
init_paths();
init_recall();
init_steps();
function ok(stdout) {
  return { stdout, exitCode: 0 };
}
function refused(error) {
  return { stdout: error.render(), exitCode: 2 };
}
async function guidanceFor(context, key) {
  return loadGuidance({ root: context.assets }, key);
}
async function brief(context) {
  const flows = await listFlows(context.root);
  const current = await currentFlow(context.root);
  return ok(
    compose([
      renderBrief(flows, current?.id),
      await guidanceFor(context, "session/start")
    ])
  );
}
async function handoff(context, id) {
  const flow = id ? await readFlow(context.root, id) : await currentFlow(context.root);
  if (!flow) {
    return refused(
      new GateRefusal("No flow is open.", 'wfctl work start --title "<what this is>"')
    );
  }
  return ok(renderHandoff(flow));
}
async function checkpoint(context, input) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const next = {
    ...flow,
    checkpoint: buildCheckpoint({
      summary: input.summary,
      handoff: input.handoff,
      lastAction: input.last,
      nextAction: input.next,
      actor: context.actor,
      ...input.todo ? { todo: input.todo } : {}
    })
  };
  await writeFlow(context.root, next);
  return ok(`checkpoint written for ${flow.id}`);
}
async function workStart(context, options) {
  try {
    if (!options.weight) {
      const definition = definitionFor("opened");
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        'wfctl work start --title "<...>" --weight <significant|lightweight>',
        definition.demands
      );
    }
    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title,
      weight: options.weight
    });
    await mkdir5(resolve6(context.root, "changes/active", flow.id), { recursive: true });
    await writeFlow(context.root, { ...flow, members: [flow.id] });
    return ok(
      compose([
        `flow ${flow.id} opened`,
        await guidanceFor(context, "work/aligned"),
        renderStep({ ...flow, step: "aligned" })
      ])
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    if (error instanceof Error && "remedy" in error) {
      return refused(new GateRefusal(error.message, String(error.remedy)));
    }
    throw error;
  }
}
async function advance(context, to) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  try {
    assertNotParked(flow);
    assertReached(flow, to);
    assertRecall(flow, flow.step);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  const advanced = { ...flow, step: to };
  await writeFlow(context.root, advanced);
  const following = nextStep(to) ?? to;
  return ok(
    compose([
      `flow ${flow.id} is now at ${to}`,
      await guidanceFor(context, `work/${to}`),
      renderStep(advanced),
      following !== to ? `then: ${definitionFor(following).command}` : void 0
    ])
  );
}
async function recallAnswer(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const item = findItem(options.item);
  if (!item) {
    return refused(
      new GateRefusal(`No recall item named ${options.item}.`, "wfctl recall list")
    );
  }
  if (!options.source.trim()) {
    return refused(
      new GateRefusal(
        "An answer needs the source it came from.",
        'wfctl recall answer <item> ... --source "<where you found it>"',
        "An answer with no source is a guess with a sentence around it."
      )
    );
  }
  const next = {
    ...flow,
    recall: recordAnswer(flow.recall, {
      item: item.id,
      answer: options.answer,
      route: options.route,
      source: options.source,
      at: (/* @__PURE__ */ new Date()).toISOString()
    })
  };
  await writeFlow(context.root, next);
  return ok(renderCounterLine(next.step, next.recall));
}
async function recallRoute(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const next = {
    ...flow,
    recall: recordRoute(flow.recall, options.route, options.covered ?? [])
  };
  await writeFlow(context.root, next);
  return ok(renderCounterLine(next.step, next.recall));
}
async function promotionDraft(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const bundle = flow.members[0] ?? flow.id;
  const path = await createPromotionDraft(options.knowledgeRoot, bundle, options.page);
  return ok(
    compose([await guidanceFor(context, "work/promotion-path"), `draft created at:
${path}`])
  );
}
async function flowClose(context) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl flow list"));
  }
  const closed = await closeFlow(context.root, flow.id);
  return ok(`flow ${closed.id} closed; the fence is down and the checkpoint is flushed.`);
}
async function issueCreate(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  if (!options.title.trim()) {
    return refused(
      new GateRefusal("A unit needs a title.", 'wfctl work issue create --title "<what it delivers>"')
    );
  }
  const id = `U${String(flow.issues.length + 1).padStart(3, "0")}`;
  const issue = {
    id,
    title: options.title.trim(),
    status: "open",
    notes: [],
    acceptance: options.acceptance
  };
  await writeFlow(context.root, { ...flow, issues: [...flow.issues, issue] });
  return ok(`${id}  ${issue.title}`);
}
async function issueList(context) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  if (flow.issues.length === 0) {
    return ok("no units yet.");
  }
  const lines = flow.issues.map((issue) => {
    const notes = issue.notes.length > 0 ? `
      ${issue.notes.join("\n      ")}` : "";
    const claim = issue.claim ? `  [${issue.claim.repository}/${issue.claim.worktreeId}]` : "";
    return `${issue.id}  ${issue.status.padEnd(8)}  ${issue.title}${claim}${notes}`;
  });
  return ok(lines.join("\n"));
}
async function withIssue(context, id, change) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  const found = flow.issues.find((issue) => issue.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    return refused(new GateRefusal(`No unit named ${id}.`, "wfctl work issue list"));
  }
  const issues = flow.issues.map((issue) => issue === found ? change(found) : issue);
  await writeFlow(context.root, { ...flow, issues });
  const next = issues.find((issue) => issue.id === found.id);
  return ok(`${next?.id}  ${next?.status}  ${next?.title}`);
}
async function issueNote(context, options) {
  if (!options.note.trim()) {
    return refused(new GateRefusal("An empty note records nothing.", 'wfctl work issue note <id> --note "<...>"'));
  }
  return withIssue(context, options.id, (issue) => ({
    ...issue,
    notes: [...issue.notes, options.note.trim()]
  }));
}
async function issueClaim(context, options) {
  const flow = await currentFlow(context.root);
  if (flow) {
    try {
      assertNotParked(flow);
    } catch (error) {
      if (error instanceof GateRefusal) return refused(error);
      throw error;
    }
  }
  return withIssue(context, options.id, (issue) => ({
    ...issue,
    status: "claimed",
    claim: {
      repository: options.repository,
      checkout: options.checkout,
      worktreeId: options.worktreeId
    }
  }));
}
async function issueComplete(context, id) {
  const result = await withIssue(context, id, (issue) => {
    const next = { ...issue, status: "done" };
    delete next.claim;
    return next;
  });
  if (result.exitCode !== 0) return result;
  const flow = await currentFlow(context.root);
  const remaining2 = (flow?.issues ?? []).filter((issue) => issue.status === "open");
  return ok(
    compose([
      result.stdout,
      remaining2.length > 0 ? `${remaining2.length} unit(s) still open:
  ${remaining2.map((issue) => `${issue.id}  ${issue.title}`).join("\n  ")}

Finishing a unit is not finishing. The next unit is available work, and available work is yours.` : "every unit is terminal."
    ])
  );
}
async function capture(context, options) {
  if (!options.text.trim()) {
    return refused(new GateRefusal("A capture needs its finding.", 'wfctl capture "<what you found>"'));
  }
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const path = resolve6(context.root, "changes/inbox", `${stamp}.md`);
  await mkdir5(dirname3(path), { recursive: true });
  await writeFile4(
    path,
    [
      "---",
      `captured_at: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `awaits: ${options.awaits ?? "nobody"}`,
      "status: pending",
      "---",
      "",
      options.text.trim(),
      ""
    ].join("\n"),
    "utf8"
  );
  return ok(compose([await guidanceFor(context, "work/capture"), `captured at:
${path}`]));
}
async function verify(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  try {
    const { readReviewArtifact: readReviewArtifact2 } = await Promise.resolve().then(() => (init_review_artifact(), review_artifact_exports));
    const { assertReviewUsable: assertReviewUsable2 } = await Promise.resolve().then(() => (init_verify(), verify_exports));
    const review = await readReviewArtifact2(options.review, context.actor);
    assertReviewUsable2(flow, review);
    return ok(
      compose([
        `review accepted from ${review.reviewer}: ${review.attacks.length} attack(s), ${review.findings.length} finding(s)`,
        await guidanceFor(context, "work/closed")
      ])
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
async function park(context, reason) {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  if (!reason.trim()) {
    return refused(
      new GateRefusal(
        "Parking needs their reason.",
        'wfctl work park --reason "<why starting now is premature>"'
      )
    );
  }
  await writeFlow(context.root, {
    ...flow,
    parked: { at: (/* @__PURE__ */ new Date()).toISOString(), reason: reason.trim() }
  });
  return ok(
    `${flow.id} is parked: ${reason.trim()}

Approving a framing settles what the work is, never that it begins. Only their own word starts it \u2014 never an answer to a different question, and never the condition that held it having cleared.`
  );
}
async function release(context, attested) {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  if (!flow.parked) return ok(`${flow.id} is not parked.`);
  if (!attested.trim()) {
    return refused(
      new GateRefusal(
        "A release carries their own words.",
        'wfctl work release --attested "<what they said>"',
        "This is one of the two places wording is recorded, because a release inferred from anything else is a start nobody agreed to."
      )
    );
  }
  const next = { ...flow };
  delete next.parked;
  await writeFlow(context.root, next);
  return ok(`${flow.id} released: "${attested.trim()}"`);
}
async function close(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  const open = flow.issues.filter((issue) => issue.status === "claimed");
  if (open.length > 0) {
    return refused(
      new GateRefusal(
        `${open.length} unit(s) are still claimed.`,
        `wfctl work issue complete ${open[0]?.id}`,
        open.map((issue) => `  ${issue.id}  ${issue.title}`).join("\n")
      )
    );
  }
  try {
    const { closeBundle: closeBundle2 } = await Promise.resolve().then(() => (init_promotion_queue(), promotion_queue_exports));
    const bundle = flow.members[0] ?? flow.id;
    const result = await closeBundle2({
      knowledgeRoot: context.root,
      bundleId: bundle,
      outcome: options.outcome
    });
    await writeFlow(context.root, { ...flow, step: "closed", closedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return ok(
      result.waitingOnPromotion ? `${bundle} closed as ${options.outcome} and waits in the promotion queue.

Its pages are what the maintainer is asked about. Nothing else is.` : `${bundle} closed as ${options.outcome} and archived; it had nothing to say about itself.`
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
async function promote2(context, options) {
  const { listQueue: listQueue2, promote: movePages } = await Promise.resolve().then(() => (init_promotion_queue(), promotion_queue_exports));
  const { appendEvent: appendEvent2, renderTrajectory: renderTrajectory2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
  const queued = await listQueue2(context.root);
  const bundle = queued[0];
  if (!bundle) {
    return refused(
      new GateRefusal("Nothing is waiting to be promoted.", "wfctl work promotion list")
    );
  }
  if (!options.subject.trim()) {
    return refused(
      new GateRefusal(
        "Promotion needs the product subject this work belongs to.",
        'wfctl work promote --subject "<the product subject>" --summary "<what it now does>"',
        "The pages say what is true now. The subject's line says how it got there, and a promotion that writes only pages leaves that line to be rediscovered by the next reconstruction."
      )
    );
  }
  try {
    const trajectory = await appendEvent2(context.root, options.subject, {
      summary: options.summary.trim() || options.subject.trim(),
      axis: "delivery",
      claims: [],
      change: bundle,
      at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const result = await movePages({ knowledgeRoot: context.root, bundleId: bundle });
    return ok(
      compose([
        `${bundle} promoted and archived at:
${result.archived}`,
        renderTrajectory2(trajectory)
      ])
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}

// src/core/cli.ts
init_gates();
init_recall();

// src/core/install.ts
init_gates();
import { createHash } from "node:crypto";
import { chmod, mkdir as mkdir6, readFile as readFile5, readdir as readdir4, stat as stat2, writeFile as writeFile5 } from "node:fs/promises";
import { dirname as dirname4, join as join3, relative as relative2, resolve as resolve7 } from "node:path";
var MANAGED_BEGIN = "<!-- wfctl:begin -->";
var MANAGED_END = "<!-- wfctl:end -->";
var HOOK_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: "*",
        hooks: [{ type: "command", command: "wfctl brief" }]
      }
    ],
    PreToolUse: [
      {
        matcher: "Edit|Write|MultiEdit",
        hooks: [
          {
            type: "command",
            command: '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-write.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-write.mjs" || true'
          }
        ]
      },
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-background-bash.mjs" || true'
          }
        ]
      }
    ],
    Stop: [
      {
        matcher: "*",
        hooks: [
          {
            type: "command",
            command: '[ -f "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" ] && node "$CLAUDE_PROJECT_DIR/.workflow/runtime/guard-stop.mjs" || true'
          }
        ]
      }
    ]
  }
};
var INSTALL_SCHEMA_VERSION = 1;
var GUIDANCE_DIR = ".workflow/guidance";
var RUNTIME_DIR = ".workflow/runtime";
var FLOWS_DIR = ".workflow/flows";
var KNOWLEDGE_DIRECTORIES = [
  "knowledge",
  "changes/active",
  "changes/promotion",
  "changes/archive",
  "changes/archive/captures",
  "changes/inbox",
  "reconstruction/raw",
  "reconstruction/active",
  "reconstruction/archive",
  "trajectories",
  GUIDANCE_DIR,
  RUNTIME_DIR,
  FLOWS_DIR
];
function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}
async function readIfPresent(path) {
  try {
    return await readFile5(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function collect(root, prefix = "") {
  const entries = await readdir4(join3(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? join3(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collect(root, rel));
      continue;
    }
    files.push({ path: rel, content: await readFile5(join3(root, rel), "utf8") });
  }
  return files;
}
async function readInstallState(target) {
  const raw = await readIfPresent(resolve7(target, ".workflow/state.json"));
  return raw ? JSON.parse(raw) : void 0;
}
async function planInstall(options) {
  const state = await readInstallState(options.target);
  const operations = [];
  const edited = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve7(options.target, directory);
    const present = await stat2(path).then(
      (entry) => entry.isDirectory(),
      () => false
    );
    if (!present) operations.push({ kind: "create-directory", path: directory });
  }
  const bundles = [
    { source: "templates/guidance", prefix: GUIDANCE_DIR },
    { source: "templates/runtime", prefix: RUNTIME_DIR }
  ];
  const guidance = [];
  for (const bundle of bundles) {
    for (const file of await collect(resolve7(options.distribution, bundle.source))) {
      guidance.push({ path: join3(bundle.prefix, file.path), content: file.content });
    }
  }
  for (const file of guidance) {
    const rel = file.path;
    const current = await readIfPresent(resolve7(options.target, rel));
    const recorded = state?.files[rel]?.sha256;
    const next = hash(file.content);
    if (current === void 0) {
      operations.push({ kind: "write", path: rel });
      continue;
    }
    if (hash(current) === next) {
      operations.push({ kind: "skip-unchanged", path: rel });
      continue;
    }
    if (recorded && hash(current) !== recorded) {
      edited.push(rel);
      operations.push({
        kind: "conflict",
        path: rel,
        reason: "edited since it was installed; it will not be replaced silently"
      });
      continue;
    }
    operations.push({ kind: "write", path: rel });
  }
  return { target: options.target, operations, edited };
}
async function applyInstall(plan, options) {
  const result = { written: [], created: [], skipped: [], conflicts: [] };
  const state = await readInstallState(plan.target) ?? {
    schemaVersion: INSTALL_SCHEMA_VERSION,
    installedVersion: options.version,
    files: {}
  };
  state.installedVersion = options.version;
  for (const operation of plan.operations) {
    const absolute = resolve7(plan.target, operation.path);
    if (operation.kind === "create-directory") {
      await mkdir6(absolute, { recursive: true });
      result.created.push(operation.path);
      continue;
    }
    if (operation.kind === "skip-unchanged") {
      result.skipped.push(operation.path);
      continue;
    }
    if (operation.kind === "conflict") {
      result.conflicts.push(operation.path);
      continue;
    }
    const runtime = operation.path.startsWith(`${RUNTIME_DIR}/`);
    const source = resolve7(
      options.distribution,
      runtime ? "templates/runtime" : "templates/guidance",
      relative2(runtime ? RUNTIME_DIR : GUIDANCE_DIR, operation.path)
    );
    const content = await readFile5(source, "utf8");
    await mkdir6(dirname4(absolute), { recursive: true });
    await writeFile5(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 493);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }
  await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);
  await mkdir6(resolve7(plan.target, ".workflow"), { recursive: true });
  await writeFile5(
    resolve7(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}
`,
    "utf8"
  );
  return result;
}
function assertProfileSupported(profile) {
  if (profile === "knowledge") return;
  if (profile === "leaf") {
    throw new GateRefusal(
      "There is no leaf installation any more.",
      "wfctl init knowledge   (run in the knowledge repository)",
      "The agent is bootstrapped in the knowledge repository and edits leaf code from there. Register the repository instead of installing into it."
    );
  }
  throw new GateRefusal(`Unknown profile ${profile}.`, "wfctl init knowledge");
}
async function installHooks(target) {
  const path = resolve7(target, ".claude/settings.json");
  const existing = await readIfPresent(path);
  let settings = {};
  if (existing) {
    try {
      settings = JSON.parse(existing);
    } catch {
      throw new GateRefusal(
        `${path} is not valid JSON, so its hooks cannot be merged.`,
        "Repair the file, then run init again."
      );
    }
  }
  const hooks = settings.hooks ?? {};
  for (const [event, entries] of Object.entries(HOOK_SETTINGS.hooks)) {
    const ours = entries;
    const theirs = (hooks[event] ?? []).filter(
      (entry) => !ours.some((entry_) => entry_.matcher === entry.matcher)
    );
    hooks[event] = [...theirs, ...ours];
  }
  settings.hooks = hooks;
  await mkdir6(dirname4(path), { recursive: true });
  await writeFile5(path, `${JSON.stringify(settings, null, 2)}
`, "utf8");
}
async function installManagedBlock(target, distribution) {
  const body = (await readFile5(resolve7(distribution, "templates/agents/managed.md"), "utf8")).trim();
  const block = `${MANAGED_BEGIN}
${body}
${MANAGED_END}
`;
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve7(target, name);
    const existing = await readIfPresent(path);
    if (existing === void 0) {
      await writeFile5(path, block, "utf8");
      continue;
    }
    const begin = existing.indexOf(MANAGED_BEGIN);
    const end = existing.indexOf(MANAGED_END);
    if (begin >= 0 && end > begin) {
      const next = existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile5(path, next, "utf8");
      continue;
    }
    await writeFile5(path, `${existing.trimEnd()}

${block}`, "utf8");
  }
}

// src/core/cli.ts
init_promotion_queue();
init_types();
var USAGE = `wfctl \u2014 project workflow

  brief                        the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id>
  work park --reason ... | work release --attested "<their words>"
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]

  repo add <owner/name> --path <dir> [--worktree <id>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  hook write --target <path>   used by the pre-write guard, not by hand
`;
function ok_(stdout) {
  return { stdout, exitCode: 0 };
}
function flag(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : void 0;
}
function flags(argv, name) {
  const values = [];
  argv.forEach((entry, index) => {
    if (entry === `--${name}` && argv[index + 1]) values.push(argv[index + 1]);
  });
  return values;
}
async function run(argv, context) {
  const [group, ...rest] = argv;
  try {
    switch (group) {
      case void 0:
      case "help":
      case "--help":
        return { stdout: USAGE, exitCode: 0 };
      case "brief":
        return await brief(context);
      case "handoff":
        return await handoff(context, rest[0]);
      case "checkpoint":
        return await checkpoint(context, {
          summary: flag(rest, "summary") ?? "",
          handoff: flag(rest, "handoff") ?? "",
          last: flag(rest, "last") ?? "",
          next: flag(rest, "next") ?? "",
          todo: flags(rest, "todo")
        });
      case "recall": {
        const [action, ...args] = rest;
        if (action === "list") {
          return {
            stdout: RECALL_ITEMS.map((item) => `${item.id}  ${item.question}`).join("\n"),
            exitCode: 0
          };
        }
        if (action === "answer") {
          return await recallAnswer(context, {
            item: args[0] ?? "",
            answer: flag(args, "answer") ?? "",
            route: flag(args, "route") ?? "read",
            source: flag(args, "source") ?? ""
          });
        }
        if (action === "route") {
          return await recallRoute(context, {
            route: args[0] ?? "read",
            covered: flags(args, "covered")
          });
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "work": {
        const [action, ...args] = rest;
        if (action === "start") {
          return await workStart(context, {
            title: flag(args, "title") ?? "",
            ...flag(args, "weight") ? { weight: flag(args, "weight") } : {}
          });
        }
        if (action === "step") {
          const step = args[0];
          if (!step || !WORK_STEPS.includes(step)) {
            return {
              stdout: `Unknown step. One of: ${WORK_STEPS.join(", ")}`,
              exitCode: 1
            };
          }
          return await advance(context, step);
        }
        if (action === "issue") {
          const [sub, ...rest_] = args;
          if (sub === "create") {
            return await issueCreate(context, {
              title: flag(rest_, "title") ?? "",
              acceptance: flags(rest_, "satisfies")
            });
          }
          if (sub === "list") return await issueList(context);
          if (sub === "note") {
            return await issueNote(context, {
              id: rest_[0] ?? "",
              note: flag(rest_, "note") ?? ""
            });
          }
          if (sub === "claim") {
            return await issueClaim(context, {
              id: rest_[0] ?? "",
              repository: flag(rest_, "repository") ?? "",
              checkout: flag(rest_, "checkout") ?? "",
              worktreeId: flag(rest_, "worktree") ?? "main"
            });
          }
          if (sub === "complete") return await issueComplete(context, rest_[0] ?? "");
          return { stdout: USAGE, exitCode: 1 };
        }
        if (action === "verify") {
          return await verify(context, { review: flag(args, "review") ?? "" });
        }
        if (action === "park") return await park(context, flag(args, "reason") ?? "");
        if (action === "release") return await release(context, flag(args, "attested") ?? "");
        if (action === "close") {
          const outcome = flag(args, "outcome") ?? "completed";
          if (!["completed", "partial", "abandoned"].includes(outcome)) {
            return { stdout: "outcome must be completed, partial or abandoned", exitCode: 1 };
          }
          return await close(context, { outcome });
        }
        if (action === "promote") {
          return await promote2(context, {
            subject: flag(args, "subject") ?? "",
            summary: flag(args, "summary") ?? ""
          });
        }
        if (action === "promotion" && args[0] === "draft") {
          return await promotionDraft(context, {
            knowledgeRoot: context.root,
            page: args[1] ?? ""
          });
        }
        if (action === "promotion" && args[0] === "list") {
          const queued = await listQueue(context.root);
          return {
            stdout: queued.length ? `waiting on the maintainer:
  ${queued.join("\n  ")}` : "nothing is waiting to be promoted.",
            exitCode: 0
          };
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "guide": {
        const { GUIDE_TOPICS: GUIDE_TOPICS2, loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
        const topic = rest[0];
        if (!topic) {
          return {
            stdout: `topics: ${Object.keys(GUIDE_TOPICS2).sort().join(", ")}`,
            exitCode: 0
          };
        }
        const key = GUIDE_TOPICS2[topic];
        if (!key) {
          return {
            stdout: `No guide named ${topic}.
topics: ${Object.keys(GUIDE_TOPICS2).sort().join(", ")}`,
            exitCode: 1
          };
        }
        const text = await loadGuidance2({ root: context.assets }, key);
        return { stdout: text ?? `The ${topic} guide is missing from this installation.`, exitCode: text ? 0 : 2 };
      }
      case "hook": {
        const [action, ...args] = rest;
        if (action === "write") {
          const { currentFlow: currentFlow2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
          const { decideWrite: decideWrite2 } = await Promise.resolve().then(() => (init_write_hook(), write_hook_exports));
          const { loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
          const flow = await currentFlow2(context.root);
          const decision = decideWrite2({
            flow,
            knowledgeRoot: context.root,
            target: flag(args, "target") ?? "",
            writtenThisUnit: flags(args, "written"),
            ...flow ? {
              guidance: await loadGuidance2({ root: context.assets }, "work/implement") ?? ""
            } : {}
          });
          if (decision.refusal) return { stdout: decision.refusal.render(), exitCode: 2 };
          return { stdout: decision.message ?? "", exitCode: 0 };
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "repo": {
        const { addRepository: addRepository2, readRegistry: readRegistry2, removeRepository: removeRepository2, renderRegistry: renderRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
        const [action, ...args] = rest;
        if (action === "add") {
          const repository = args[0] ?? "";
          const path = flag(args, "path") ?? "";
          const worktreeId = flag(args, "worktree") ?? "main";
          const entries = await addRepository2(context.root, {
            repository,
            checkout: flag(args, "checkout") ?? worktreeId,
            path,
            worktreeId
          });
          return ok_(renderRegistry2(entries));
        }
        if (action === "remove") {
          const entries = await removeRepository2(
            context.root,
            args[0] ?? "",
            flag(args, "worktree")
          );
          return ok_(renderRegistry2(entries));
        }
        if (action === "list" || action === void 0) {
          return ok_(renderRegistry2(await readRegistry2(context.root)));
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "trajectory": {
        const { appendEvent: appendEvent2, listTrajectories: listTrajectories2, readTrajectory: readTrajectory2, renderTrajectory: renderTrajectory2, subjectId: subjectId2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
        const [action, ...args] = rest;
        if (action === "append") {
          const trajectory = await appendEvent2(context.root, flag(args, "subject") ?? "", {
            summary: flag(args, "summary") ?? "",
            axis: flag(args, "axis") ?? "delivery",
            claims: flags(args, "claim"),
            ...flag(args, "at") ? { at: flag(args, "at") } : {},
            ...flag(args, "change") ? { change: flag(args, "change") } : {}
          });
          return ok_(renderTrajectory2(trajectory));
        }
        if (action === "show") {
          const trajectory = await readTrajectory2(context.root, subjectId2(args[0] ?? ""));
          if (!trajectory) {
            return { stdout: `No trajectory for ${args[0]}.`, exitCode: 1 };
          }
          return ok_(renderTrajectory2(trajectory));
        }
        const all = await listTrajectories2(context.root);
        return ok_(
          all.length === 0 ? "no trajectories yet." : all.map((entry) => `${entry.id}  ${entry.events.length} event(s)  ${entry.subject}`).join("\n")
        );
      }
      case "reconstruct": {
        const reconstruct = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
        const { readRegistry: readRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
        const [action, ...args] = rest;
        if (action === "start") {
          const repositories = await readRegistry2(context.root);
          if (repositories.length === 0) {
            throw new GateRefusal(
              "No repositories are registered, so there is nothing to read.",
              "wfctl repo add <owner/name> --path <dir>"
            );
          }
          const raw = await reconstruct.rawInventory(context.root);
          const baseline = await reconstruct.hasBaseline(context.root);
          const id = `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}-reconstruct`;
          await reconstruct.writeCase(context.root, {
            id,
            stage: "scope",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            repositories: [],
            rawPaths: raw,
            coverage: { inScope: [], read: [], excluded: [] },
            claims: [],
            contradictions: [],
            trajectories: [],
            probes: [],
            hadBaseline: baseline
          });
          return ok_(
            [
              `reconstruction ${id} opened`,
              baseline ? "Curated knowledge already holds pages, so this is a re-check of an existing baseline." : "Curated knowledge is empty, so this is a first baseline.",
              "",
              "registered:",
              ...repositories.map((entry) => `  ${entry.repository}  ${entry.worktreeId}  ${entry.path}`),
              "",
              raw.length > 0 ? `raw material: ${raw.length} file(s) under reconstruction/raw/` : "raw material: none",
              "",
              "Put one scope decision to the maintainer: which repositories, how much of",
              "the raw material, and what is deliberately out. One question, not four."
            ].join("\n")
          );
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "capture":
        return await capture(context, {
          text: rest.filter((entry) => !entry.startsWith("--"))[0] ?? "",
          ...rest.includes("--awaits") ? { awaits: "maintainer" } : {}
        });
      case "flow":
        if (rest[0] === "close") return await flowClose(context);
        return { stdout: USAGE, exitCode: 1 };
      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve11(flag(rest, "target") ?? process.cwd());
        const distribution = resolve11(context.assets, "..", "..");
        const plan = await planInstall({
          target,
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.9.0"
        });
        const result = await applyInstall(plan, {
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.9.0"
        });
        const lines = [
          `installed into ${target}`,
          `  ${result.created.length} directories, ${result.written.length} files written, ${result.skipped.length} unchanged`
        ];
        if (result.conflicts.length) {
          lines.push(`  ${result.conflicts.length} left alone because they were edited:`);
          for (const path of result.conflicts) lines.push(`    ${path}`);
        }
        lines.push("", "Restart the agent session so the new instructions load.");
        return { stdout: lines.join("\n"), exitCode: 0 };
      }
      default:
        return { stdout: USAGE, exitCode: 1 };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    throw error;
  }
}
function findGuidance(start) {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve11(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname7(current);
    if (parent === current) break;
    current = parent;
  }
  throw new GateRefusal(
    "The guidance bundle is missing from this installation.",
    "Reinstall wfctl.",
    `Looked upward from ${start} for templates/guidance.`
  );
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  const context = {
    root: process.cwd(),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown"
  };
  const result = await run(process.argv.slice(2), context);
  process.stdout.write(`${result.stdout}
`);
  process.exit(result.exitCode);
}
export {
  findGuidance,
  run
};
