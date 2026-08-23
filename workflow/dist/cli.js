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
var FLOW_SCHEMA_VERSION, WORK_WEIGHTS, WORK_STEPS, RECALL_ROUTES;
var init_types = __esm({
  "src/core/types.ts"() {
    "use strict";
    FLOW_SCHEMA_VERSION = 1;
    WORK_WEIGHTS = ["significant", "lightweight"];
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
var recall_exports = {};
__export(recall_exports, {
  RECALL_ITEMS: () => RECALL_ITEMS,
  STEP_REQUIREMENTS: () => STEP_REQUIREMENTS,
  emptyCounters: () => emptyCounters,
  emptyRecall: () => emptyRecall,
  findItem: () => findItem,
  isAnswered: () => isAnswered,
  isSatisfied: () => isSatisfied,
  itemsForGroup: () => itemsForGroup,
  recordAnswer: () => recordAnswer,
  recordRoute: () => recordRoute,
  recordWritten: () => recordWritten,
  renderCounterLine: () => renderCounterLine,
  shortfallFor: () => shortfallFor
});
function emptyCounters() {
  return RECALL_ROUTES.reduce((counters, route) => {
    counters[route] = 0;
    return counters;
  }, {});
}
function emptyRecall() {
  return { answers: [], counters: emptyCounters(), covered: [], written: [] };
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
function recordWritten(state, path) {
  return { ...state, written: [.../* @__PURE__ */ new Set([...state.written ?? [], path])].sort() };
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
var steps_exports = {};
__export(steps_exports, {
  WORK_STEP_DEFINITIONS: () => WORK_STEP_DEFINITIONS,
  definitionFor: () => definitionFor,
  deriveBlocker: () => deriveBlocker,
  nextStep: () => nextStep,
  renderStep: () => renderStep
});
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
  if (flow.step === "opened" && flow.weight) {
    const following = nextStep("opened");
    if (following) {
      const next = definitionFor(following);
      return { step: following, awaits: "agent", summary: next.demands, remedy: next.command };
    }
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
        command: 'wfctl work start --title "<what this is>" --weight <significant|lightweight>'
      },
      {
        step: "aligned",
        demands: "What the project already says about this subject. If nothing is written yet, record that nothing covers it \u2014 an empty corpus passes a conflict check silently, and that reads exactly like a check that found nothing wrong.",
        command: "wfctl work step aligned"
      },
      {
        step: "framed",
        demands: "What the work is: the outcome, the boundary, and the acceptance criteria. This is the cheapest moment to change the scope and the last one where it is free.",
        command: "wfctl work step framed"
      },
      {
        step: "split",
        demands: "The units of delivery, sized by scope and coherence. Not by what fits in a session \u2014 that framing made agents stop halfway through a context that was still wide open.",
        command: 'wfctl work issue create --title "<what it delivers>"',
        optionalWhen: (flow) => flow.weight === "lightweight"
      },
      {
        step: "implement",
        demands: "One slice at a time, in the checkout the claim binds.",
        command: "wfctl work issue claim <id> --repository <owner/name>"
      },
      {
        step: "verified",
        demands: "An adversarial review, run by a separate agent, whose every attack is an executable test. You cannot run it yourself: the agent that wrote the tests can write the review that approves them.",
        command: "wfctl work verify --review <artifact>"
      },
      {
        step: "closed",
        demands: "Nothing from anybody. Every part of 'is this done' is already answered by the checks, and asking the maintainer to confirm arithmetic is not a decision.",
        command: "wfctl work close --outcome <completed|partial|abandoned>"
      },
      {
        step: "promoted",
        demands: "What the project now says about itself. This one is the maintainer's, and it is the second and last thing they are asked.",
        command: 'wfctl work promote --subject "<product subject>" --summary "<what it now does>"'
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
function assertReviewed(flow, step) {
  if (step !== "verified" && step !== "closed" && step !== "promoted") return;
  if (flow.review) return;
  throw new GateRefusal(
    "No review is on record for this work.",
    "wfctl work verify --review <artifact from a separate agent>",
    "The agent that wrote the tests can write the review that approves them, so the review is produced elsewhere and this checks what came back."
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
      wayfind: "work/wayfind",
      scope: "reconstruct/scope",
      crawl: "reconstruct/crawl",
      assemble: "reconstruct/assemble",
      adjudicate: "reconstruct/adjudicate",
      probe: "reconstruct/probe",
      sources: "reconstruct/sources"
    };
  }
});

// src/core/flow.ts
var flow_exports = {};
__export(flow_exports, {
  FlowOpenError: () => FlowOpenError,
  clearCurrent: () => clearCurrent,
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
  const open = (await listFlows(root)).find((flow2) => !flow2.closedAt);
  if (open) {
    throw new FlowOpenError(
      `Flow ${open.id} is open; work outside it is out of scope. A finding found while working belongs in the capture inbox.`,
      `wfctl capture "<what you found>"   (or: wfctl flow close ${open.id})`
    );
  }
  const now = options.now ?? /* @__PURE__ */ new Date();
  let id = createFlowId(options.kind, options.title, now);
  for (let suffix = 2; await readFlow(root, id); suffix += 1) {
    id = `${createFlowId(options.kind, options.title, now)}-${suffix}`;
  }
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
    throw new FlowOpenError(`No flow named ${id}.`, "wfctl brief");
  }
  const closed = { ...flow, closedAt: (/* @__PURE__ */ new Date()).toISOString() };
  delete closed.checkpoint;
  await writeFlow(root, closed);
  const current = await currentFlowId(root);
  if (current === id) await setCurrent(root, void 0);
  return closed;
}
async function clearCurrent(root) {
  await setCurrent(root, void 0);
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
import { realpathSync } from "node:fs";
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname, relative, resolve as resolve3, sep } from "node:path";
function promotionDirectory(knowledgeRoot, bundleId) {
  return resolve3(knowledgeRoot, "changes", "active", bundleId, "promotion");
}
async function createPromotionDraft(knowledgeRoot, bundleId, page) {
  const normalized = page.replace(/^\/+/, "");
  if (!normalized.trim() || normalized === "." || normalized === "..") {
    throw new GateRefusal(
      "A promotion draft needs the page it will become.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "An empty name resolved to the promotion directory itself and replaced it with a file, after which no draft could be created in that record at all."
    );
  }
  if (!normalized.endsWith(".md")) {
    throw new GateRefusal(
      "A curated page is Markdown.",
      `wfctl work promotion draft "${normalized}.md"`
    );
  }
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
function canonical(path) {
  let current = resolve3(path);
  const trailing = [];
  for (let depth = 0; depth < 64; depth += 1) {
    try {
      return [realpathSync.native(current), ...trailing].join(sep);
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolve3(path);
      trailing.unshift(current.slice(parent.length + 1));
      current = parent;
    }
  }
  return resolve3(path);
}
function assertWriteAllowed(options) {
  const target = canonical(options.target);
  const knowledge = canonical(options.knowledgeRoot);
  const rel = relative(knowledge, target);
  if (rel.startsWith("..") || rel === "") return;
  const segments = rel.split(sep);
  if (segments[0] === "knowledge") {
    throw new GateRefusal(
      "A curated page cannot be written directly into knowledge/.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "Pages enter curated knowledge through promotion, which is the maintainer's decision. Drafts live in the bundle until then."
    );
  }
  if (segments[0] === "changes" && (segments[1] === "promotion" || segments[1] === "archive")) {
    throw new GateRefusal(
      `${segments[1]} is written by the tool, not by hand.`,
      "wfctl work close --outcome <completed|partial|abandoned>",
      "A record that appears here without passing the flow is promotable without ever having been reviewed."
    );
  }
  if (segments[0] === ".workflow" || segments[0] === "trajectories") {
    throw new GateRefusal(
      `${segments[0]} is the tool's own state.`,
      "wfctl brief",
      "Editing it by hand is how a fence stops holding."
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
      "wfctl work verify --review <artifact naming its reviewer>",
      "The implementing agent cannot review its own work: the agent that wrote the tests can write the review that approves them."
    );
  }
  if (review.attacks.length === 0 && review.findings.length === 0) {
    throw new GateRefusal(
      "The review is empty: no findings and no recorded attacks.",
      "wfctl work verify --review <artifact carrying its attacks>",
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
  const broke = review.attacks.filter((attack) => attack.broke);
  if (broke.length > 0) {
    throw new GateRefusal(
      `${broke.length} attack(s) broke the work.`,
      "Fix what they broke, then run the review again.",
      broke.map((attack) => `  [${attack.lens}] ${attack.target}
    ${attack.output}`).join("\n")
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
      "Record the reason in the artifact's finding, then verify again.",
      "A finding may be accepted, never silently."
    );
  }
  if (flow.framingDigest && flow.framingDigest !== review.framingDigest) {
    throw new GateRefusal(
      "The acceptance criteria have changed since the framing was approved.",
      "wfctl work close --outcome partial   (the framing they approved no longer matches)",
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
      "wfctl work promotion list"
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
  throw new GateRefusal(`No record named ${bundleId}.`, "wfctl work promotion list");
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
import { createHash } from "node:crypto";
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
  const normalized = subject.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 8);
  return slug ? `${slug}-${digest}` : digest;
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
  trajectory.events = [
    ...trajectory.events,
    { ...event, at: event.at ?? (/* @__PURE__ */ new Date()).toISOString() }
  ];
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

// src/core/install.ts
var install_exports = {};
__export(install_exports, {
  FLOWS_DIR: () => FLOWS_DIR,
  GUARD_NAMES: () => GUARD_NAMES,
  HOOK_SETTINGS: () => HOOK_SETTINGS,
  INSTALL_SCHEMA_VERSION: () => INSTALL_SCHEMA_VERSION,
  KNOWLEDGE_DIRECTORIES: () => KNOWLEDGE_DIRECTORIES,
  MANAGED_BEGIN: () => MANAGED_BEGIN,
  MANAGED_END: () => MANAGED_END,
  RUNTIME_DIR: () => RUNTIME_DIR,
  SKILL_DIRS: () => SKILL_DIRS,
  applyInstall: () => applyInstall,
  assertProfileSupported: () => assertProfileSupported,
  guardStatus: () => guardStatus,
  installHooks: () => installHooks,
  installManagedBlock: () => installManagedBlock,
  planInstall: () => planInstall,
  readInstallState: () => readInstallState,
  renderGuards: () => renderGuards,
  setGuard: () => setGuard
});
import { createHash as createHash2 } from "node:crypto";
import { chmod, mkdir as mkdir6, readFile as readFile5, readdir as readdir4, stat as stat2, writeFile as writeFile5 } from "node:fs/promises";
import { dirname as dirname4, join as join3, relative as relative2, resolve as resolve7 } from "node:path";
function hash(content) {
  return createHash2("sha256").update(content).digest("hex");
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
  const installable = [];
  for (const file of await collect(resolve7(options.distribution, "templates/runtime"))) {
    installable.push({ path: join3(RUNTIME_DIR, file.path), content: file.content });
  }
  for (const file of await collect(resolve7(options.distribution, "templates/skill/wfctl"))) {
    for (const directory of SKILL_DIRS) {
      installable.push({ path: join3(directory, file.path), content: file.content });
    }
  }
  for (const file of installable) {
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
    const skillDir = SKILL_DIRS.find((directory) => operation.path.startsWith(`${directory}/`));
    const source = runtime ? resolve7(options.distribution, "templates/runtime", relative2(RUNTIME_DIR, operation.path)) : resolve7(
      options.distribution,
      "templates/skill/wfctl",
      relative2(skillDir ?? "", operation.path)
    );
    const content = await readFile5(source, "utf8");
    await mkdir6(dirname4(absolute), { recursive: true });
    await writeFile5(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 493);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }
  await mkdir6(resolve7(plan.target, ".workflow"), { recursive: true });
  await writeFile5(
    resolve7(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}
`,
    "utf8"
  );
  await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);
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
  if (Array.isArray(settings) || typeof settings !== "object" || settings === null) {
    throw new GateRefusal(
      `${path} is not a JSON object, so its hooks cannot be merged.`,
      "Repair the file, then run init again.",
      "Merging into an array would have written the hooks onto a property that JSON.stringify discards, leaving the install reporting success with no hooks at all."
    );
  }
  const existingHooks = settings.hooks;
  if (existingHooks !== void 0 && (typeof existingHooks !== "object" || existingHooks === null || Array.isArray(existingHooks))) {
    throw new GateRefusal(
      `${path} has a "hooks" value that is not an object.`,
      "Repair the file, then run init again."
    );
  }
  const ourCommands = new Set(
    Object.values(HOOK_SETTINGS.hooks).flat().flatMap((entry) => entry.hooks).map((hook) => hook.command)
  );
  const isOurs = (entry) => {
    const hooks2 = entry?.hooks;
    if (!Array.isArray(hooks2) || hooks2.length === 0) return false;
    return hooks2.every((hook) => typeof hook?.command === "string" && ourCommands.has(hook.command));
  };
  const hooks = { ...existingHooks ?? {} };
  for (const [event, entries] of Object.entries(HOOK_SETTINGS.hooks)) {
    const current = hooks[event];
    const theirs = (Array.isArray(current) ? current : []).filter((entry) => !isOurs(entry));
    hooks[event] = [...theirs, ...entries];
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
    const begins = existing.split(MANAGED_BEGIN).length - 1;
    const ends = existing.split(MANAGED_END).length - 1;
    if (begins !== ends || begins > 1 || begins === 1 && end < begin) {
      throw new GateRefusal(
        `${name} has an unbalanced wfctl marker block.`,
        `Repair the markers in ${name} so one ${MANAGED_BEGIN} is followed by one ${MANAGED_END}, then run init again.`,
        `Found ${begins} begin marker(s) and ${ends} end marker(s). Writing past that would move the boundary and take your own text with it.`
      );
    }
    if (begin >= 0 && end > begin) {
      const next = existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile5(path, next, "utf8");
      continue;
    }
    await writeFile5(path, `${existing.trimEnd()}

${block}`, "utf8");
  }
}
async function readSettings(target) {
  const raw = await readIfPresent(resolve7(target, ".claude/settings.json"));
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GateRefusal(
      `${resolve7(target, ".claude/settings.json")} is not valid JSON.`,
      "Repair the file, then try again."
    );
  }
  if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
    throw new GateRefusal(
      `${resolve7(target, ".claude/settings.json")} is not a JSON object.`,
      "Repair the file, then try again."
    );
  }
  return parsed;
}
async function guardStatus(target) {
  const settings = await readSettings(target);
  const hooks = settings.hooks ?? {};
  return GUARD_NAMES.map((guard) => {
    const { event, matcher, describes } = GUARD_EVENTS[guard];
    const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
    const installed = entries.some(
      (entry) => entry.matcher === matcher && (entry.hooks ?? []).some((hook) => (hook.command ?? "").includes(scriptFor(guard)))
    );
    return { guard, installed, describes };
  });
}
function scriptFor(guard) {
  return guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard}.mjs`;
}
async function setGuard(target, guard, enabled) {
  const path = resolve7(target, ".claude/settings.json");
  const settings = await readSettings(target);
  const hooks = { ...settings.hooks ?? {} };
  const { event, matcher } = GUARD_EVENTS[guard];
  const script = scriptFor(guard);
  const entries = Array.isArray(hooks[event]) ? [...hooks[event]] : [];
  const isThisGuard = (entry) => (entry?.hooks ?? []).some(
    (hook) => (hook.command ?? "").includes(script)
  );
  const others = entries.filter((entry) => !isThisGuard(entry));
  if (!enabled) {
    hooks[event] = others;
    settings.hooks = hooks;
    await mkdir6(dirname4(path), { recursive: true });
    await writeFile5(path, `${JSON.stringify(settings, null, 2)}
`, "utf8");
    return `${guard} guard off. Restart the session for it to take effect.`;
  }
  const ours = HOOK_SETTINGS.hooks[event]?.find(
    (entry) => isThisGuard(entry)
  );
  if (!ours) {
    throw new GateRefusal(`No installed definition for the ${guard} guard.`, "wfctl init knowledge");
  }
  hooks[event] = [...others, ours];
  settings.hooks = hooks;
  await mkdir6(dirname4(path), { recursive: true });
  await writeFile5(path, `${JSON.stringify(settings, null, 2)}
`, "utf8");
  return `${guard} guard on. Restart the session for it to take effect.`;
}
function renderGuards(status) {
  return [
    ...status.map(
      (entry) => `${entry.installed ? "on " : "off"}  ${entry.guard.padEnd(6)}  ${entry.describes}`
    ),
    "",
    "wfctl guards on <stop|write|bash>   \xB7   wfctl guards off <stop|write|bash>",
    "",
    "Turning one off is a decision worth recording. The stop guard is the only",
    "mechanism that catches a turn ending on work nobody is waiting for."
  ].join("\n");
}
var MANAGED_BEGIN, MANAGED_END, HOOK_SETTINGS, INSTALL_SCHEMA_VERSION, RUNTIME_DIR, SKILL_DIRS, FLOWS_DIR, KNOWLEDGE_DIRECTORIES, GUARD_NAMES, GUARD_EVENTS;
var init_install = __esm({
  "src/core/install.ts"() {
    "use strict";
    init_gates();
    MANAGED_BEGIN = "<!-- wfctl:begin -->";
    MANAGED_END = "<!-- wfctl:end -->";
    HOOK_SETTINGS = {
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
    INSTALL_SCHEMA_VERSION = 1;
    RUNTIME_DIR = ".workflow/runtime";
    SKILL_DIRS = [".claude/skills/wfctl", ".agents/skills/wfctl"];
    FLOWS_DIR = ".workflow/flows";
    KNOWLEDGE_DIRECTORIES = [
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
      RUNTIME_DIR,
      FLOWS_DIR
    ];
    GUARD_NAMES = ["stop", "write", "bash"];
    GUARD_EVENTS = {
      stop: {
        event: "Stop",
        matcher: "*",
        describes: "re-enters a turn that ends while work still awaits the agent"
      },
      write: {
        event: "PreToolUse",
        matcher: "Edit|Write|MultiEdit",
        describes: "delivers the unit's scope on the first write, and refuses writes by hand"
      },
      bash: {
        event: "PreToolUse",
        matcher: "Bash",
        describes: "reports a background command that has gone silent"
      }
    };
  }
});

// src/core/leaves.ts
var leaves_exports = {};
__export(leaves_exports, {
  GRAPH_PATH: () => GRAPH_PATH,
  assertInsideClaim: () => assertInsideClaim,
  assertTraversable: () => assertTraversable,
  graphSetup: () => graphSetup,
  inspectLeaf: () => inspectLeaf,
  inspectLeaves: () => inspectLeaves,
  renderLeaves: () => renderLeaves
});
import { stat as stat3 } from "node:fs/promises";
import { resolve as resolve8, sep as sep2 } from "node:path";
async function inspectLeaf(entry, now = /* @__PURE__ */ new Date()) {
  const base = {
    repository: entry.repository,
    worktreeId: entry.worktreeId,
    path: entry.path,
    graph: "unreachable"
  };
  const reachable = await stat3(entry.path).then(
    (found) => found.isDirectory(),
    () => false
  );
  if (!reachable) return base;
  const graph = await stat3(resolve8(entry.path, GRAPH_PATH)).catch(() => void 0);
  if (!graph) return { ...base, graph: "missing" };
  const ageDays = Math.floor((now.getTime() - graph.mtimeMs) / 864e5);
  return { ...base, graph: ageDays > STALE_AFTER_DAYS ? "stale" : "ready", ageDays };
}
async function inspectLeaves(entries, now = /* @__PURE__ */ new Date()) {
  return Promise.all(entries.map((entry) => inspectLeaf(entry, now)));
}
function graphSetup(path) {
  return [
    `No graph in ${path}.`,
    "",
    "Nothing is installed into a source repository, but its structure has to be",
    "readable before anything here can traverse it. In that checkout:",
    "",
    "  uv tool install graphifyy      # once per machine, if the CLI is absent",
    "  graphify build                 # in the leaf, produces graphify-out/",
    "",
    "The maintainer runs the install; the build is yours. Rebuild it when the",
    "source has moved \u2014 a stale graph answers confidently about code that is gone."
  ].join("\n");
}
function assertTraversable(leaves) {
  const blocked = leaves.filter((leaf) => leaf.graph === "missing" || leaf.graph === "unreachable");
  if (blocked.length === 0) return;
  const missing = blocked.filter((leaf) => leaf.graph === "missing");
  const gone = blocked.filter((leaf) => leaf.graph === "unreachable");
  const detail = [
    ...missing.map((leaf) => graphSetup(leaf.path)),
    ...gone.map(
      (leaf) => `${leaf.repository} is registered at ${leaf.path}, which is not there. Re-register it, or remove it: wfctl repo remove ${leaf.repository} --worktree ${leaf.worktreeId}`
    )
  ].join("\n\n");
  throw new GateRefusal(
    `${blocked.length} registered repositor${blocked.length === 1 ? "y has" : "ies have"} no graph to traverse.`,
    missing[0] ? `graphify build   (in ${missing[0].path})` : "wfctl repo list",
    detail
  );
}
function renderLeaves(leaves) {
  if (leaves.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]"
    ].join("\n");
  }
  const rows = leaves.map((leaf) => {
    const age = leaf.graph === "ready" || leaf.graph === "stale" ? `${leaf.ageDays}d` : "";
    return `${leaf.graph.padEnd(11)} ${age.padEnd(5)} ${leaf.repository}  ${leaf.worktreeId.padEnd(10)}  ${leaf.path}`;
  });
  const needing = leaves.filter((leaf) => leaf.graph === "missing" || leaf.graph === "stale");
  return [
    ...rows,
    ...needing.length > 0 ? [
      "",
      `${needing.length} need a graph built before it can be traversed:`,
      ...needing.map((leaf) => `  graphify build   (in ${leaf.path})`)
    ] : []
  ].join("\n");
}
function assertInsideClaim(options) {
  const target = resolve8(options.target);
  const containing = options.leaves.find((leaf) => {
    const base = resolve8(leaf.path);
    return target === base || target.startsWith(`${base}${sep2}`);
  });
  if (!containing) {
    throw new GateRefusal(
      `${options.target} is not inside any registered repository.`,
      "wfctl repo add <owner/name> --path <dir> [--worktree <id>]",
      options.leaves.length === 0 ? "Nothing is registered, so there is nowhere this write could legitimately land." : `Registered:
${options.leaves.map((leaf) => `  ${leaf.repository}  ${leaf.worktreeId}  ${leaf.path}`).join("\n")}`
    );
  }
  if (!options.claim) return;
  if (containing.repository !== options.claim.repository || containing.worktreeId !== options.claim.worktreeId) {
    throw new GateRefusal(
      `This unit is claimed from ${options.claim.repository} (${options.claim.worktreeId}), and that path is in ${containing.repository} (${containing.worktreeId}).`,
      `wfctl work issue claim <id> --repository ${containing.repository} --worktree ${containing.worktreeId}`,
      "A worktree is an exact workspace, not an alias for its repository. Code written into a sibling checkout looks entirely correct there and belongs to different work."
    );
  }
}
var GRAPH_PATH, STALE_AFTER_DAYS;
var init_leaves = __esm({
  "src/core/leaves.ts"() {
    "use strict";
    init_gates();
    GRAPH_PATH = "graphify-out/graph.json";
    STALE_AFTER_DAYS = 30;
  }
});

// src/core/write-hook.ts
var write_hook_exports = {};
__export(write_hook_exports, {
  decideWrite: () => decideWrite
});
import { relative as relative3, resolve as resolve9 } from "node:path";
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
  const claimed = flow.issues.find((issue) => issue.status === "claimed")?.claim;
  try {
    assertInsideClaim({
      target,
      leaves: input.leaves ?? [],
      ...claimed ? { claim: { repository: claimed.repository, worktreeId: claimed.worktreeId } } : {}
    });
  } catch (error) {
    if (error instanceof GateRefusal) return { refusal: error };
    throw error;
  }
  const normalized = normalize(knowledgeRoot, target);
  const first = input.writtenThisUnit.length === 0;
  const covered = flow.recall.covered.some(
    (entry) => normalize(knowledgeRoot, entry) === normalized
  );
  if (!first && covered) return {};
  if (first && (flow.recall.counters.graphify ?? 0) === 0) {
    try {
      assertTraversable(input.leaves ?? []);
    } catch (error) {
      if (error instanceof GateRefusal) return { refusal: error };
      throw error;
    }
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
  const absolute = resolve9(root, path);
  return relative3(root, absolute) || absolute;
}
var init_write_hook = __esm({
  "src/core/write-hook.ts"() {
    "use strict";
    init_leaves();
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
import { dirname as dirname5, resolve as resolve10 } from "node:path";
async function readRegistry(root) {
  try {
    const raw = await readFile6(resolve10(root, REGISTRY_PATH), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.repositories ?? [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeRegistry(root, repositories) {
  const path = resolve10(root, REGISTRY_PATH);
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
  advanceStage: () => advanceStage,
  assertAdjudicated: () => assertAdjudicated,
  assertClosable: () => assertClosable,
  assertCrawlComplete: () => assertCrawlComplete,
  assertProbed: () => assertProbed,
  assertTrajectoriesExist: () => assertTrajectoriesExist,
  casePath: () => casePath,
  closeCase: () => closeCase,
  currentCase: () => currentCase,
  hasBaseline: () => hasBaseline,
  markExcluded: () => markExcluded,
  markRead: () => markRead,
  nextStage: () => nextStage,
  rawInventory: () => rawInventory,
  readCase: () => readCase,
  recordContradiction: () => recordContradiction,
  recordProbe: () => recordProbe,
  recordScope: () => recordScope,
  remaining: () => remaining,
  renderOutcome: () => renderOutcome,
  renderStatus: () => renderStatus,
  resolveContradiction: () => resolveContradiction,
  setCurrentCase: () => setCurrentCase,
  writeCase: () => writeCase
});
import { mkdir as mkdir8, readFile as readFile7, readdir as readdir5, stat as stat4, writeFile as writeFile7 } from "node:fs/promises";
import { dirname as dirname6, join as join4, resolve as resolve11 } from "node:path";
function casePath(root, id) {
  return resolve11(root, RECONSTRUCTION_DIR, id, "case.json");
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
  const knowledge = resolve11(root, "knowledge");
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
  const raw = resolve11(root, RAW_DIR);
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
    "wfctl reconstruct subject <trajectory-id>   (append the events first with wfctl trajectory append)",
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
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent>',
      "Asking yourself what you might have missed returns what you already know."
    );
  }
  const failed = record.probes.filter((probe) => probe.passed !== true);
  if (failed.length > 0) {
    throw new GateRefusal(
      `${failed.length} probe(s) did not pass.`,
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <agent> --passed   (after repairing the page)',
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
function assertClosable(record, actor) {
  if (record.stage !== "promote") {
    throw new GateRefusal(
      `This case is at ${record.stage}; closing needs it at promote.`,
      "wfctl reconstruct stage",
      "Each stage's gate runs on the way past it. Closing early runs none of them."
    );
  }
  assertCrawlComplete(record);
  assertTrajectoriesExist(record);
  assertAdjudicated(record);
  assertProbed(record, actor);
}
async function closeCase(root, id) {
  const from = resolve11(root, RECONSTRUCTION_DIR, id);
  const present = await stat4(from).then(
    (entry) => entry.isDirectory(),
    () => false
  );
  if (!present) {
    throw new GateRefusal(`No active reconstruction named ${id}.`, "wfctl reconstruct status");
  }
  const to = resolve11(root, RECONSTRUCTION_ARCHIVE, id);
  await mkdir8(resolve11(root, RECONSTRUCTION_ARCHIVE), { recursive: true });
  const { rename: rename2, rm: rm2 } = await import("node:fs/promises");
  await rename2(from, to);
  await rm2(resolve11(root, RECONSTRUCTION_DIR, "current"), { force: true });
  return to;
}
async function setCurrentCase(root, id) {
  const path = resolve11(root, CURRENT_POINTER2);
  await mkdir8(dirname6(path), { recursive: true });
  await writeFile7(path, `${id}
`, "utf8");
}
async function currentCase(root) {
  try {
    const id = (await readFile7(resolve11(root, CURRENT_POINTER2), "utf8")).trim();
    return id ? readCase(root, id) : void 0;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function recordScope(root, record, options) {
  if (record.stage !== "scope") {
    throw new GateRefusal(
      `The scope was settled when this case entered ${record.stage}.`,
      "wfctl reconstruct status",
      "Widening it now would move the boundary the coverage gate measures against."
    );
  }
  if (options.repositories.length === 0) {
    throw new GateRefusal(
      "A scope with no repositories reads nothing.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>"
    );
  }
  const raw = options.rawScope === "all" ? record.rawPaths.map((path) => `${RAW_DIR}/${path}`) : [];
  const inScope = [.../* @__PURE__ */ new Set([...options.inScope, ...raw])].sort();
  const next = {
    ...record,
    stage: "crawl",
    repositories: options.repositories,
    rawScope: options.rawScope,
    coverage: { ...record.coverage, inScope }
  };
  await writeCase(root, next);
  return next;
}
async function markRead(root, record, path) {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope.`,
      "wfctl reconstruct scope --repository <owner/name> --revision <sha> --in <every path, including the ones already listed>",
      "Reading outside the agreed scope is how a bounded pass becomes an unbounded one."
    );
  }
  const next = {
    ...record,
    coverage: {
      ...record.coverage,
      read: [.../* @__PURE__ */ new Set([...record.coverage.read, path])].sort()
    }
  };
  await writeCase(root, next);
  return next;
}
async function markExcluded(root, record, path, reason) {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope, so excluding it counts nothing.`,
      "wfctl reconstruct status",
      "Coverage counted exclusions of paths that were never in scope, which made the remaining figure smaller than the work left."
    );
  }
  if (!reason.trim()) {
    throw new GateRefusal(
      "An exclusion needs its reason.",
      'wfctl reconstruct exclude <path> --reason "<why this cannot inform the baseline>"',
      "An unexplained exclusion is indistinguishable from a file nobody got to."
    );
  }
  const next = {
    ...record,
    coverage: {
      ...record.coverage,
      excluded: [
        ...record.coverage.excluded.filter((entry) => entry.path !== path),
        { path, reason: reason.trim() }
      ]
    }
  };
  await writeCase(root, next);
  return next;
}
async function recordContradiction(root, record, options) {
  if (options.sides.length < 2) {
    throw new GateRefusal(
      "A contradiction needs at least two sides.",
      'wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"'
    );
  }
  const id = `C${String(record.contradictions.length + 1).padStart(3, "0")}`;
  const next = {
    ...record,
    contradictions: [...record.contradictions, { id, subject: options.subject, sides: options.sides }]
  };
  await writeCase(root, next);
  return next;
}
async function resolveContradiction(root, record, id, resolution) {
  const found = record.contradictions.find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    throw new GateRefusal(`No contradiction named ${id}.`, "wfctl reconstruct status");
  }
  if (!resolution.trim()) {
    throw new GateRefusal(
      "A resolution records what they decided.",
      `wfctl reconstruct resolve ${id} --resolution "<what they decided>"`
    );
  }
  const next = {
    ...record,
    contradictions: record.contradictions.map(
      (entry) => entry === found ? { ...entry, resolution: resolution.trim() } : entry
    )
  };
  await writeCase(root, next);
  return next;
}
async function recordProbe(root, record, probe, actor) {
  if (!probe.question.trim()) {
    throw new GateRefusal(
      "A probe needs its question.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --asker <agent id>'
    );
  }
  if (!probe.asker.trim() || probe.asker === actor) {
    throw new GateRefusal(
      "A probe needs an asker who did not write the pages.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent>',
      "Asking yourself what you might have missed returns what you already know."
    );
  }
  if (probe.pages.length === 0) {
    throw new GateRefusal(
      "A probe names the pages that must answer it.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <agent>'
    );
  }
  const next = { ...record, probes: [...record.probes, probe] };
  await writeCase(root, next);
  return next;
}
async function advanceStage(root, record, actor) {
  switch (record.stage) {
    case "crawl":
      assertCrawlComplete(record);
      break;
    case "assemble":
      assertTrajectoriesExist(record);
      break;
    case "adjudicate":
      assertAdjudicated(record);
      break;
    case "probe":
      assertProbed(record, actor);
      break;
    default:
      break;
  }
  const following = nextStage(record.stage);
  if (!following) {
    throw new GateRefusal("This case is at its last stage.", `wfctl reconstruct close ${record.id}`);
  }
  const next = { ...record, stage: following };
  await writeCase(root, next);
  return { record: next, stage: following };
}
function renderStatus(record) {
  const left = remaining(record.coverage);
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  return [
    `${record.id}  \xB7  stage ${record.stage}  \xB7  ${STAGE_PRESENCE[record.stage]} present`,
    record.hadBaseline ? "re-checking an existing baseline" : "first baseline; curated knowledge was empty",
    "",
    `coverage: ${record.coverage.read.length} read, ${record.coverage.excluded.length} excluded, ${left.length} left`,
    `subjects:  ${record.trajectories.length}`,
    `open contradictions: ${open.length}`,
    `probes: ${record.probes.filter((probe) => probe.passed === true).length}/${record.probes.length} passed`
  ].join("\n");
}
var RECONSTRUCTION_DIR, RECONSTRUCTION_ARCHIVE, RAW_DIR, STAGES, STAGE_PRESENCE, CURRENT_POINTER2;
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
    CURRENT_POINTER2 = "reconstruction/active/current";
  }
});

// src/core/doctor.ts
var doctor_exports = {};
__export(doctor_exports, {
  exitCodeFor: () => exitCodeFor,
  renderReport: () => renderReport,
  runDoctor: () => runDoctor
});
import { spawnSync } from "node:child_process";
import { access, readFile as readFile8, readdir as readdir6, stat as stat5 } from "node:fs/promises";
import { resolve as resolve12 } from "node:path";
async function exists(path) {
  return access(path).then(
    () => true,
    () => false
  );
}
async function runDoctor(targetInput, options = {}) {
  const target = resolve12(targetInput);
  const runner = options.runner ?? run;
  const checks = [];
  const state = await readInstallState(target);
  if (!state) {
    checks.push({
      name: "installation",
      status: "fail",
      message: "This is not an initialized knowledge repository",
      remedy: "wfctl init knowledge"
    });
    return { target, checks };
  }
  checks.push({
    name: "installation",
    status: "pass",
    message: `wfctl ${state.installedVersion}, ${Object.keys(state.files).length} owned file(s)`
  });
  if (options.distribution) {
    const plan = await planInstall({
      target,
      distribution: options.distribution,
      version: state.installedVersion
    });
    const pending = plan.operations.filter((operation) => operation.kind === "write");
    if (plan.edited.length > 0) {
      checks.push({
        name: "installation-edited",
        status: "warn",
        message: `${plan.edited.length} owned file(s) edited since install: ${plan.edited.join(", ")}`,
        remedy: "Keep them, or delete them and run: wfctl init knowledge"
      });
    }
    if (pending.length > 0) {
      checks.push({
        name: "installation-pending",
        status: "warn",
        message: `${pending.length} file(s) would be written by a reinstall`,
        remedy: "wfctl init knowledge"
      });
    }
  }
  const missing = [];
  for (const path of Object.keys(state.files)) {
    if (!await exists(resolve12(target, path))) missing.push(path);
  }
  checks.push({
    name: "installed-files",
    status: missing.length > 0 ? "fail" : "pass",
    message: missing.length > 0 ? `${missing.length} missing: ${missing.join(", ")}` : "All present",
    ...missing.length > 0 ? { remedy: "wfctl init knowledge" } : {}
  });
  const git = runner("git", ["rev-parse", "--is-inside-work-tree"], { cwd: target });
  checks.push({
    name: "git",
    status: git.status === 0 ? "pass" : "warn",
    message: git.status === 0 ? "Git repository" : "Not a Git repository; knowledge has no history and cannot be shared",
    ...git.status === 0 ? {} : { remedy: "git init" }
  });
  const absentDirs = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const found = await stat5(resolve12(target, directory)).then(
      (entry) => entry.isDirectory(),
      () => false
    );
    if (!found) absentDirs.push(directory);
  }
  checks.push({
    name: "knowledge-layout",
    status: absentDirs.length > 0 ? "fail" : "pass",
    message: absentDirs.length > 0 ? `Missing: ${absentDirs.join(", ")}` : "Complete",
    ...absentDirs.length > 0 ? { remedy: "wfctl init knowledge" } : {}
  });
  for (const directory of SKILL_DIRS) {
    const skill = resolve12(target, directory, "SKILL.md");
    const present = await exists(skill);
    const frontmatter = present ? (await readFile8(skill, "utf8")).startsWith("---\nname: wfctl") : false;
    checks.push({
      name: `skill:${directory.split("/")[0]}`,
      status: present && frontmatter ? "pass" : "fail",
      message: present ? frontmatter ? "Installed" : "Present but its frontmatter is not wfctl's" : "Missing \u2014 the agent has no entry point",
      ...present && frontmatter ? {} : { remedy: "wfctl init knowledge" }
    });
  }
  const block = await readFile8(resolve12(target, "AGENTS.md"), "utf8").catch(() => "");
  checks.push({
    name: "managed-block",
    status: block.includes("wfctl:begin") ? "pass" : "fail",
    message: block.includes("wfctl:begin") ? "Present in AGENTS.md" : "Absent \u2014 nothing points the agent at the skill",
    ...block.includes("wfctl:begin") ? {} : { remedy: "wfctl init knowledge" }
  });
  for (const guard of await guardStatus(target)) {
    const script = await exists(
      resolve12(target, RUNTIME_DIR, guard.guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard.guard}.mjs`)
    );
    checks.push({
      name: `guard:${guard.guard}`,
      status: guard.installed && script ? "pass" : guard.installed ? "fail" : "warn",
      message: !script ? "Armed in settings, but its script is missing" : guard.installed ? guard.describes : `Off \u2014 ${guard.describes}`,
      ...guard.installed && script ? {} : { remedy: `wfctl guards on ${guard.guard}` }
    });
  }
  const onPath = runner("wfctl", ["--help"], { cwd: target });
  checks.push({
    name: "wfctl-on-path",
    status: onPath.status === 0 && onPath.stdout.includes("project workflow") ? "pass" : "fail",
    message: onPath.status === 0 && onPath.stdout.includes("project workflow") ? "The guards can reach it" : "Not on PATH \u2014 every guard will fail open and report nothing",
    remedy: "Put wfctl on PATH (bun link, or npm i -g wfctl)"
  });
  const registry = await readRegistry(target);
  if (registry.length === 0) {
    checks.push({
      name: "repositories",
      status: "warn",
      message: "None registered; no source code can be read or written",
      remedy: "wfctl repo add <owner/name> --path <dir>"
    });
  } else {
    for (const leaf of await inspectLeaves(registry)) {
      const status = leaf.graph === "ready" ? "pass" : leaf.graph === "unreachable" ? "fail" : "warn";
      checks.push({
        name: `leaf:${leaf.repository}/${leaf.worktreeId}`,
        status,
        message: leaf.graph === "ready" ? `Graph ${leaf.ageDays}d old` : leaf.graph === "stale" ? `Graph ${leaf.ageDays}d old; it answers confidently about code that may be gone` : leaf.graph === "missing" ? "No graph; nothing here can traverse it" : `${leaf.path} is not there`,
        ...leaf.graph === "unreachable" ? { remedy: `wfctl repo remove ${leaf.repository} --worktree ${leaf.worktreeId}` } : leaf.graph === "ready" ? {} : { remedy: `graphify build   (in ${leaf.path})` }
      });
    }
    const graphify = runner("graphify", ["--version"]);
    checks.push({
      name: "graphify",
      status: graphify.status === 0 ? "pass" : "warn",
      message: graphify.status === 0 ? graphify.stdout.trim() || "Available" : "Not installed",
      ...graphify.status === 0 ? {} : { remedy: "uv tool install graphifyy" }
    });
  }
  const qmd = runner("qmd", ["status"], { cwd: target });
  if (qmd.status !== 0) {
    checks.push({
      name: "qmd",
      status: "warn",
      message: "Not available; curated knowledge can only be searched by reading it",
      remedy: "Install QMD, then: qmd index"
    });
  } else {
    checks.push({ name: "qmd", status: "pass", message: "Index opens" });
    const pending = /pending|not embedded|needs embedding/i.test(qmd.stdout);
    checks.push({
      name: "qmd-embeddings",
      status: pending ? "warn" : "pass",
      message: pending ? "Documents await embedding; semantic retrieval will silently fall back to lexical" : "Ready",
      ...pending ? { remedy: "qmd embed" } : {}
    });
  }
  const inbox = await readdir6(resolve12(target, "changes/inbox")).catch(() => []);
  const captures = inbox.filter((entry) => entry.endsWith(".md"));
  checks.push({
    name: "capture-inbox",
    status: captures.length > 0 ? "warn" : "pass",
    message: captures.length > 0 ? `${captures.length} unresolved capture(s); a queue nobody opens is the same as no queue` : "Empty",
    ...captures.length > 0 ? { remedy: "Route or discard each one" } : {}
  });
  const queued = await readdir6(resolve12(target, "changes/promotion")).catch(() => []);
  if (queued.length > 0) {
    checks.push({
      name: "promotion-queue",
      status: "warn",
      message: `${queued.length} record(s) waiting on the maintainer`,
      remedy: "wfctl work promotion list"
    });
  }
  return { target, checks };
}
function renderReport(report) {
  const symbol = { pass: "ok  ", warn: "warn", fail: "FAIL" };
  const lines = report.checks.map((check) => {
    const head = `${symbol[check.status]}  ${check.name.padEnd(28)} ${check.message}`;
    return check.status === "pass" || !check.remedy ? head : `${head}
      \u2192 ${check.remedy}`;
  });
  const failed = report.checks.filter((check) => check.status === "fail").length;
  const warned = report.checks.filter((check) => check.status === "warn").length;
  return [
    ...lines,
    "",
    failed > 0 ? `${failed} failing, ${warned} degraded.` : warned > 0 ? `Healthy, ${warned} degraded.` : "Healthy."
  ].join("\n");
}
function exitCodeFor(report) {
  return report.checks.some((check) => check.status === "fail") ? 1 : 0;
}
var run;
var init_doctor = __esm({
  "src/core/doctor.ts"() {
    "use strict";
    init_install();
    init_install();
    init_leaves();
    init_registry();
    run = (command, args, options) => {
      const result = spawnSync(command, args, {
        cwd: options?.cwd,
        encoding: "utf8",
        timeout: 2e4
      });
      return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    };
  }
});

// src/core/cli.ts
import { existsSync, realpathSync as realpathSync2 } from "node:fs";
import { dirname as dirname7, resolve as resolve13 } from "node:path";
import { fileURLToPath } from "node:url";

// src/core/commands.ts
import { mkdir as mkdir5, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname3, resolve as resolve6 } from "node:path";

// src/core/checkpoint.ts
init_gates();
init_steps();
var CheckpointError = class extends GateRefusal {
};
function buildCheckpoint(input, now = /* @__PURE__ */ new Date()) {
  const fields = [
    ["summary", "--summary", input.summary],
    ["a handoff body", "--handoff", input.handoff],
    ["the last completed action", "--last", input.lastAction],
    ["the exact next action", "--next", input.nextAction]
  ];
  for (const [label, option, value] of fields) {
    if (!value || value.trim().length === 0) {
      throw new CheckpointError(
        `A checkpoint needs ${label}; an empty one recalls nothing.`,
        `wfctl checkpoint --summary "<one line>" --handoff "<the body>" --last "<...>" --next "<...>"`,
        `${option} was empty or absent.`
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
    assertReviewed(flow, to);
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
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  const claimed = flow.issues.filter((issue) => issue.status === "claimed");
  if (claimed.length > 0) {
    return refused(
      new GateRefusal(
        `${claimed.length} unit(s) are still claimed.`,
        `wfctl work issue complete ${claimed[0]?.id}`,
        claimed.map((issue) => `  ${issue.id}  ${issue.title}`).join("\n")
      )
    );
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
    await writeFlow(context.root, {
      ...flow,
      step: "verified",
      review: {
        reviewer: review.reviewer,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        attacks: review.attacks.length,
        findings: review.findings.length
      }
    });
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
  try {
    assertNotParked(flow);
    assertReached(flow, "closed");
    assertRecall(flow, flow.step);
    assertReviewed(flow, "closed");
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
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
    await clearCurrent(context.root);
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
init_install();
init_promotion_queue();
init_types();
var USAGE = `wfctl \u2014 project workflow

  brief [--json]               the state of this repository, and what awaits whom
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
  reconstruct status
  reconstruct scope --repository <owner/name> --revision <sha> [--raw all|selected|none] [--in <path>]...
  reconstruct read <path> | exclude <path> --reason "<why>"
  reconstruct contradiction --subject ... --side ... --side ...
  reconstruct resolve <id> --resolution "<what they decided>"
  reconstruct subject <trajectory-id>
  reconstruct probe --question ... --page <path> --asker <agent> [--passed]
  reconstruct stage            advance when this stage's gate passes
  reconstruct close

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  doctor                       verify this installation and what it depends on

  guards [status]              which runtime guards are on
  guards on|off <stop|write|bash>

  hook write --target <path>   used by the pre-write guard, not by hand
`;
function ok_(stdout) {
  return { stdout, exitCode: 0 };
}
function compose_(parts) {
  return parts.filter((part) => Boolean(part && part.trim())).join("\n\n");
}
function flag(argv, name) {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return void 0;
  const value = argv[index + 1];
  if (value === void 0 || value.startsWith("--")) {
    throw new GateRefusal(
      `--${name} was given without a value.`,
      `--${name} "<value>"`,
      value === void 0 ? void 0 : `The next argument was ${value}, which is another flag.`
    );
  }
  return value;
}
function flags(argv, name) {
  const values = [];
  argv.forEach((entry, index) => {
    if (entry !== `--${name}`) return;
    const value = argv[index + 1];
    if (value === void 0 || value.startsWith("--")) {
      throw new GateRefusal(`--${name} was given without a value.`, `--${name} "<value>"`);
    }
    values.push(value);
  });
  return values;
}
function oneOf(value, allowed, name, fallback) {
  if (value === void 0) {
    if (fallback !== void 0) return fallback;
    throw new GateRefusal(`--${name} is required.`, `--${name} <${allowed.join("|")}>`);
  }
  if (!allowed.includes(value)) {
    throw new GateRefusal(
      `${value} is not a valid ${name}.`,
      `--${name} <${allowed.join("|")}>`
    );
  }
  return value;
}
async function run2(argv, context) {
  const [group, ...rest] = argv;
  try {
    switch (group) {
      case void 0:
      case "help":
      case "--help":
        return { stdout: USAGE, exitCode: 0 };
      case "brief": {
        if (rest.includes("--json")) {
          const { listFlows: listFlows2, currentFlowId: currentFlowId2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
          const { deriveBlocker: deriveBlocker2 } = await Promise.resolve().then(() => (init_steps(), steps_exports));
          const flows = (await listFlows2(context.root)).filter((flow) => !flow.closedAt);
          const current = await currentFlowId2(context.root);
          return ok_(
            JSON.stringify(
              {
                current,
                signals: flows.flatMap((flow) => {
                  const blocker = deriveBlocker2(flow);
                  return blocker ? [{ id: flow.id, awaits: blocker.awaits, summary: blocker.summary, remedy: blocker.remedy }] : [];
                })
              },
              null,
              2
            )
          );
        }
        return await brief(context);
      }
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
            route: oneOf(flag(args, "route"), RECALL_ROUTES, "route"),
            source: flag(args, "source") ?? ""
          });
        }
        if (action === "route") {
          return await recallRoute(context, {
            route: oneOf(args[0], RECALL_ROUTES, "route"),
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
            ...flag(args, "weight") ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") } : {}
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
          return {
            stdout: [
              "wfctl work issue <create|list|note|claim|complete>",
              "",
              '  create --title "<what it delivers>" [--satisfies AC-01]...',
              "  list",
              '  note <id> --note "<what you learned>"',
              "  claim <id> --repository <owner/name> [--worktree <id>]",
              "  complete <id>"
            ].join("\n"),
            exitCode: 1
          };
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
        if (action === "promotion" && args[0] === void 0) {
          return {
            stdout: [
              "wfctl work promotion <draft|list>",
              "",
              '  draft "<area>/<page>.md"   create the page where it belongs',
              "  list                       records waiting on the maintainer"
            ].join("\n"),
            exitCode: 1
          };
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
          const { writeFlow: writeFlow2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
          const { recordWritten: recordWritten2 } = await Promise.resolve().then(() => (init_recall(), recall_exports));
          const { readRegistry: readRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
          const { inspectLeaves: inspectLeaves2 } = await Promise.resolve().then(() => (init_leaves(), leaves_exports));
          const flow = await currentFlow2(context.root);
          const target = flag(args, "target") ?? "";
          const decision = decideWrite2({
            flow,
            knowledgeRoot: context.root,
            target,
            leaves: await inspectLeaves2(await readRegistry2(context.root)),
            writtenThisUnit: flow?.recall.written ?? [],
            ...flow ? {
              guidance: await loadGuidance2({ root: context.assets }, "work/implement") ?? ""
            } : {}
          });
          if (decision.refusal) return { stdout: decision.refusal.render(), exitCode: 2 };
          if (flow) {
            await writeFlow2(context.root, {
              ...flow,
              recall: recordWritten2(flow.recall, target)
            });
          }
          return { stdout: decision.message ?? "", exitCode: 0 };
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "repo": {
        const { addRepository: addRepository2, readRegistry: readRegistry2, removeRepository: removeRepository2, renderRegistry: renderRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
        const { graphSetup: graphSetup2, inspectLeaf: inspectLeaf2, inspectLeaves: inspectLeaves2, renderLeaves: renderLeaves2 } = await Promise.resolve().then(() => (init_leaves(), leaves_exports));
        const [action, ...args] = rest;
        if (action === "add") {
          const repository = args[0] ?? "";
          const path = flag(args, "path") ?? "";
          const worktreeId = flag(args, "worktree") ?? "main";
          const entry = {
            repository,
            checkout: flag(args, "checkout") ?? worktreeId,
            path,
            worktreeId
          };
          const entries = await addRepository2(context.root, entry);
          const state = await inspectLeaf2(entry);
          return ok_(
            compose_([
              renderRegistry2(entries),
              state.graph === "missing" ? graphSetup2(state.path) : void 0,
              state.graph === "unreachable" ? `${state.path} is not there.` : void 0,
              state.graph === "stale" ? `Its graph is ${state.ageDays} days old. Rebuild before relying on it: graphify build (in ${state.path})` : void 0
            ])
          );
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
          return ok_(renderLeaves2(await inspectLeaves2(await readRegistry2(context.root))));
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "trajectory": {
        const { appendEvent: appendEvent2, listTrajectories: listTrajectories2, readTrajectory: readTrajectory2, renderTrajectory: renderTrajectory2, subjectId: subjectId2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
        const [action, ...args] = rest;
        if (action === "append") {
          const trajectory = await appendEvent2(context.root, flag(args, "subject") ?? "", {
            summary: flag(args, "summary") ?? "",
            axis: oneOf(flag(args, "axis"), ["intent", "delivery", "vision"], "axis"),
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
          const open = await reconstruct.currentCase(context.root);
          if (open) {
            throw new GateRefusal(
              `Reconstruction ${open.id} is already open at stage ${open.stage}.`,
              `wfctl reconstruct close`,
              "Opening another would overwrite it in place, losing its coverage, contradictions and probes."
            );
          }
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
          const { loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
          const scopeGuidance = await loadGuidance2({ root: context.assets }, "reconstruct/scope");
          await reconstruct.setCurrentCase(context.root, id);
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
              scopeGuidance ?? ""
            ].join("\n")
          );
        }
        const record = await reconstruct.currentCase(context.root);
        if (!record) {
          throw new GateRefusal(
            "No reconstruction is open.",
            "wfctl reconstruct start"
          );
        }
        if (action === "status") return ok_(reconstruct.renderStatus(record));
        if (action === "scope") {
          const next = await reconstruct.recordScope(context.root, record, {
            repositories: flags(args, "repository").map((repository) => ({
              repository,
              checkout: repository,
              path: "",
              worktreeId: flag(args, "worktree") ?? "main",
              revision: flag(args, "revision") ?? "",
              dirty: args.includes("--dirty")
            })),
            rawScope: oneOf(flag(args, "raw"), ["all", "selected", "none"], "raw", "none"),
            inScope: flags(args, "in")
          });
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "read") {
          const next = await reconstruct.markRead(context.root, record, args[0] ?? "");
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "exclude") {
          const next = await reconstruct.markExcluded(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "reason") ?? ""
          );
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "contradiction") {
          const next = await reconstruct.recordContradiction(context.root, record, {
            subject: flag(args, "subject") ?? "",
            sides: flags(args, "side")
          });
          return ok_(`recorded; ${next.contradictions.length} to adjudicate after the crawl.`);
        }
        if (action === "resolve") {
          const next = await reconstruct.resolveContradiction(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "resolution") ?? ""
          );
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "probe") {
          const next = await reconstruct.recordProbe(context.root, record, {
            question: flag(args, "question") ?? "",
            pages: flags(args, "page"),
            asker: flag(args, "asker") ?? context.actor,
            ...flag(args, "answer") ? { answer: flag(args, "answer") } : {},
            passed: args.includes("--passed")
          }, context.actor);
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "subject") {
          const next = {
            ...record,
            trajectories: [.../* @__PURE__ */ new Set([...record.trajectories, args[0] ?? ""])].filter(Boolean)
          };
          await reconstruct.writeCase(context.root, next);
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "stage") {
          const { loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
          const advanced = await reconstruct.advanceStage(context.root, record, context.actor);
          const slice = await loadGuidance2(
            { root: context.assets },
            `reconstruct/${advanced.stage}`
          ).catch(() => void 0);
          return ok_(
            compose_([
              slice,
              reconstruct.renderStatus(advanced.record),
              reconstruct.STAGE_PRESENCE[advanced.stage] === "maintainer" ? "This stage needs the maintainer. Put it to them in product language." : "This stage runs unattended. Do not interrupt it with questions."
            ])
          );
        }
        if (action === "close") {
          reconstruct.assertClosable(record, context.actor);
          const outcome = reconstruct.renderOutcome(record);
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${outcome}
archived at:
${archived}`);
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "doctor": {
        const { exitCodeFor: exitCodeFor2, renderReport: renderReport2, runDoctor: runDoctor2 } = await Promise.resolve().then(() => (init_doctor(), doctor_exports));
        const report = await runDoctor2(context.root, {
          distribution: resolve13(context.assets, "..", "..")
        });
        return { stdout: renderReport2(report), exitCode: exitCodeFor2(report) };
      }
      case "guards": {
        const { GUARD_NAMES: GUARD_NAMES2, guardStatus: guardStatus2, renderGuards: renderGuards2, setGuard: setGuard2 } = await Promise.resolve().then(() => (init_install(), install_exports));
        const [action, ...args] = rest;
        if (action === "on" || action === "off") {
          const guard = oneOf(args[0], GUARD_NAMES2, "guard");
          return ok_(await setGuard2(context.root, guard, action === "on"));
        }
        if (action === void 0 || action === "status") {
          return ok_(renderGuards2(await guardStatus2(context.root)));
        }
        return { stdout: "wfctl guards [status] | on <guard> | off <guard>", exitCode: 1 };
      }
      case "capture": {
        const awaits = rest.includes("--awaits");
        const text = rest.filter((entry) => entry !== "--awaits")[0] ?? "";
        return await capture(context, {
          text,
          ...awaits ? { awaits: "maintainer" } : {}
        });
      }
      case "flow":
        if (rest[0] === "close") return await flowClose(context);
        return { stdout: USAGE, exitCode: 1 };
      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve13(flag(rest, "target") ?? process.cwd());
        const distribution = resolve13(context.assets, "..", "..");
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
        lines.push(
          "",
          "Guidance is not installed \u2014 it ships with wfctl and is read from there,",
          "so upgrading wfctl upgrades it. There is nothing here to refresh.",
          "",
          "Restart the agent session so the new instructions load."
        );
        return { stdout: lines.join("\n"), exitCode: 0 };
      }
      default:
        return { stdout: USAGE, exitCode: 1 };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    const detail = error instanceof Error ? error.message : String(error);
    return {
      stdout: new GateRefusal(
        "That could not be completed.",
        "Check the file or state this command reads; if it was edited by hand, repair it.",
        detail
      ).render(),
      exitCode: 2
    };
  }
}
function findGuidance(start) {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve13(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname7(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve13(start, "templates", "guidance");
}
var invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync2(entry) === realpathSync2(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const context = {
    root: process.cwd(),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown"
  };
  const result = await run2(process.argv.slice(2), context);
  process.stdout.write(`${result.stdout}
`);
  process.exit(result.exitCode);
}
export {
  findGuidance,
  run2 as run
};
