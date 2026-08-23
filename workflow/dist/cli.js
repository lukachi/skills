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

// src/core/write-hook.ts
var write_hook_exports = {};
__export(write_hook_exports, {
  decideWrite: () => decideWrite
});
import { relative as relative3, resolve as resolve6 } from "node:path";
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
  const absolute = resolve6(root, path);
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

// src/core/cli.ts
import { existsSync } from "node:fs";
import { dirname as dirname3, resolve as resolve7 } from "node:path";

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

// src/core/cli.ts
init_gates();
init_recall();

// src/core/install.ts
init_gates();
import { createHash } from "node:crypto";
import { chmod, mkdir as mkdir3, readFile as readFile3, readdir as readdir2, stat, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname2, join as join2, relative as relative2, resolve as resolve4 } from "node:path";
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
    return await readFile3(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function collect(root, prefix = "") {
  const entries = await readdir2(join2(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? join2(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collect(root, rel));
      continue;
    }
    files.push({ path: rel, content: await readFile3(join2(root, rel), "utf8") });
  }
  return files;
}
async function readInstallState(target) {
  const raw = await readIfPresent(resolve4(target, ".workflow/state.json"));
  return raw ? JSON.parse(raw) : void 0;
}
async function planInstall(options) {
  const state = await readInstallState(options.target);
  const operations = [];
  const edited = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve4(options.target, directory);
    const present = await stat(path).then(
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
    for (const file of await collect(resolve4(options.distribution, bundle.source))) {
      guidance.push({ path: join2(bundle.prefix, file.path), content: file.content });
    }
  }
  for (const file of guidance) {
    const rel = file.path;
    const current = await readIfPresent(resolve4(options.target, rel));
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
    const absolute = resolve4(plan.target, operation.path);
    if (operation.kind === "create-directory") {
      await mkdir3(absolute, { recursive: true });
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
    const source = resolve4(
      options.distribution,
      runtime ? "templates/runtime" : "templates/guidance",
      relative2(runtime ? RUNTIME_DIR : GUIDANCE_DIR, operation.path)
    );
    const content = await readFile3(source, "utf8");
    await mkdir3(dirname2(absolute), { recursive: true });
    await writeFile3(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 493);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }
  await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);
  await mkdir3(resolve4(plan.target, ".workflow"), { recursive: true });
  await writeFile3(
    resolve4(plan.target, ".workflow/state.json"),
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
  const path = resolve4(target, ".claude/settings.json");
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
  await mkdir3(dirname2(path), { recursive: true });
  await writeFile3(path, `${JSON.stringify(settings, null, 2)}
`, "utf8");
}
async function installManagedBlock(target, distribution) {
  const body = (await readFile3(resolve4(distribution, "templates/agents/managed.md"), "utf8")).trim();
  const block = `${MANAGED_BEGIN}
${body}
${MANAGED_END}
`;
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve4(target, name);
    const existing = await readIfPresent(path);
    if (existing === void 0) {
      await writeFile3(path, block, "utf8");
      continue;
    }
    const begin = existing.indexOf(MANAGED_BEGIN);
    const end = existing.indexOf(MANAGED_END);
    if (begin >= 0 && end > begin) {
      const next = existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile3(path, next, "utf8");
      continue;
    }
    await writeFile3(path, `${existing.trimEnd()}

${block}`, "utf8");
  }
}

// src/core/promotion-queue.ts
init_gates();
import { mkdir as mkdir4, readdir as readdir3, rename, stat as stat2 } from "node:fs/promises";
import { join as join3, resolve as resolve5 } from "node:path";
var QUEUE = "changes/promotion";
async function isDirectory(path) {
  return stat2(path).then(
    (entry) => entry.isDirectory(),
    () => false
  );
}
async function listQueue(knowledgeRoot) {
  const path = resolve5(knowledgeRoot, QUEUE);
  if (!await isDirectory(path)) return [];
  const entries = await readdir3(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

// src/core/cli.ts
init_types();
var USAGE = `wfctl \u2014 project workflow

  brief                        the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
  work step <step>             record that this step is reached
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> [--covered <path>...]

  flow close                   flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  hook write --target <path>   used by the pre-write guard, not by hand
`;
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
      case "flow":
        if (rest[0] === "close") return await flowClose(context);
        return { stdout: USAGE, exitCode: 1 };
      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve7(flag(rest, "target") ?? process.cwd());
        const distribution = resolve7(context.assets, "..", "..");
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
    const candidate = resolve7(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname3(current);
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
