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
      remedy: 'wfctl work release --attested "<what they said>"'
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
  if (flow.step === "verified" && flow.review) {
    return {
      step: "closed",
      awaits: "agent",
      summary: "Draft the pages this work changes, then close. Closure asks nobody: the checks have already answered it.",
      remedy: 'wfctl work promotion draft "<area>/<page>.md"'
    };
  }
  if (flow.step === "closed") {
    return {
      step: "promoted",
      awaits: "maintainer",
      summary: definitionFor("promoted").demands,
      remedy: definitionFor("promoted").command
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
  const following = nextStep(flow.step);
  const shortfall = shortfallFor(flow.step, flow.recall);
  const checkpointStale = flow.step !== "opened" && (flow.checkpoint?.updatedAt ?? "") < (flow.steppedAt ?? "");
  const next = !isSatisfied(shortfall) ? 'wfctl recall answer <item> --answer "<what you found>" --route <route> --source "<where>"' : checkpointStale ? 'wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \\\n        --last "<last completed action>" --next "<the exact next action>"' : following ? definitionFor(following).command : "wfctl work close --outcome <completed|partial|abandoned>";
  return [
    `flow ${flow.id}  \xB7  step ${flow.step}`,
    "",
    definition.demands,
    "",
    `record it with: ${definition.command}`,
    `next: ${next}`,
    "",
    renderCounterLine(flow.step, flow.recall)
  ].join("\n");
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
        demands: "An adversarial review, run by a separate agent, whose every attack is an executable test. You cannot run it yourself: the agent that wrote the tests can write the review that approves them. Nobody authorises it \u2014 verification is the second half of implementing, not a milestone the maintainer grants, and asking spends a turn on an answer that is yes every time. Start it as soon as the units are delivered.",
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
    'wfctl work release --attested "<what they said>"',
    "Approving a framing settles what the work is, never that it begins. The condition that held it ending is not the same as being told to go."
  );
}
function assertCheckpointCurrent(flow, step) {
  if (step === "aligned") return;
  const checkpoint2 = flow.checkpoint;
  if (!checkpoint2) {
    throw new GateRefusal(
      `This flow has no checkpoint, and ${step} is not reachable without one.`,
      'wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \\\n    --last "<last completed action>" --next "<the exact next action>"',
      "The checkpoint is the only thing a session that is not this one recovers from. Work whose state lives in a conversation is lost with the conversation, and nothing reports that it was."
    );
  }
  if (checkpoint2.updatedAt < (flow.steppedAt ?? "")) {
    throw new GateRefusal(
      `The checkpoint predates this flow reaching ${flow.step}.`,
      'wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \\\n    --last "<last completed action>" --next "<the exact next action>"',
      `It was written at ${checkpoint2.updatedAt} and says the next action is "${checkpoint2.nextAction}". A session resuming here would act on that.`
    );
  }
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
        if (!remedy.trim()) {
          throw new Error(`A refusal must name the command that clears it: ${message}`);
        }
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

// src/core/checkpoint.ts
function meaningful(value) {
  return value.replace(INVISIBLE, "").replace(CONTROL, "").trim().length > 0;
}
function oneLine(value) {
  return value.replace(CONTROL, "").replace(/\s*\n+\s*/g, " ").trim();
}
function fenceBody(value) {
  return value.replace(CONTROL, "").split("\n").map((line) => line.trim().length === 0 ? "" : `  ${line}`).join("\n");
}
function buildCheckpoint(input, now = /* @__PURE__ */ new Date()) {
  const fields = [
    ["summary", "--summary", input.summary],
    ["a handoff body", "--handoff", input.handoff],
    ["the last completed action", "--last", input.lastAction],
    ["the exact next action", "--next", input.nextAction]
  ];
  for (const [label2, option, value] of fields) {
    if (!value || !meaningful(value)) {
      throw new CheckpointError(
        `A checkpoint needs ${label2}; an empty one recalls nothing.`,
        `wfctl checkpoint --summary "<one line>" --handoff "<the body>" --last "<...>" --next "<...>"`,
        `${option} was empty or absent.`
      );
    }
  }
  return {
    summary: oneLine(input.summary),
    handoff: input.handoff.replace(CONTROL, "").trim(),
    lastAction: oneLine(input.lastAction),
    nextAction: oneLine(input.nextAction),
    actor: oneLine(input.actor),
    updatedAt: now.toISOString(),
    todo: (input.todo ?? []).map(oneLine).filter((item) => item.length > 0)
  };
}
function renderBrief(flows, currentId, extras = {}) {
  const open = flows.filter((flow) => !flow.closedAt);
  const waiting = [];
  if (extras.reconstruction) {
    waiting.push(
      `reconstruction ${extras.reconstruction.id} \xB7 stage ${extras.reconstruction.stage}
  awaits agent: wfctl reconstruct status`
    );
  }
  for (const id of extras.queued ?? []) {
    waiting.push(
      `${id} waits in the promotion queue
  awaits maintainer: what the project now says about itself
  remedy: wfctl work promote --subject "<product subject>" --summary "<what it now does>"`
    );
  }
  if (extras.awaitingCaptures) {
    waiting.push(
      `${extras.awaitingCaptures} capture(s) await the maintainer
  remedy: put them one decision at a time, not as a backlog`
    );
  }
  for (const broken of extras.unreadable ?? []) {
    waiting.push(
      `${broken.id} cannot be read: ${broken.problem}
  awaits agent: repair .workflow/flows/${broken.id}.json
  remedy: open that file \u2014 a record left with merge-conflict markers is the usual cause`
    );
  }
  for (const id of extras.stranded ?? []) {
    waiting.push(
      `${id} has no flow, so nothing can reach it
  awaits maintainer: whether this work resumes at all
  remedy: wfctl work adopt ${id} --weight <significant|lightweight> --attested "<what they said>"`
    );
  }
  if (open.length === 0) {
    return [
      "No flow is open.",
      ...waiting.length > 0 ? ["", ...waiting] : [],
      "",
      "Nothing here holds session state, because state belongs to a flow. If you",
      "are resuming work, it is one of the bundles above; if you are starting it,",
      "open the fence first and checkpoint inside it.",
      "",
      "Start one explicitly when the maintainer asks for work, and record what",
      "they said \u2014 a bundle exists because they asked for it:",
      '  wfctl work start --title "<what this is>" --weight <significant|lightweight> \\',
      '    --attested "<what they said>"',
      "  wfctl reconstruct start"
    ].join("\n");
  }
  const lines = [];
  const current = open.find((flow) => flow.id === currentId);
  if (current) {
    lines.push(`flow ${current.id}  \xB7  ${current.kind}  \xB7  step ${current.step}`);
    lines.push(current.title);
    lines.push("");
    if (current.checkpoint) {
      lines.push(fenceBody(current.checkpoint.handoff));
      lines.push("");
      lines.push(`last: ${current.checkpoint.lastAction}`);
      lines.push(`next: ${current.checkpoint.nextAction}`);
      if (current.checkpoint.todo.length > 0) {
        lines.push("todo:");
        for (const item of current.checkpoint.todo) lines.push(`  - ${item}`);
      }
    } else {
      lines.push("No checkpoint yet. Write one before this session does anything material.");
      lines.push(
        '  wfctl checkpoint --summary "<one line>" --handoff "<what the next session needs>" \\'
      );
      lines.push('    --last "<last completed action>" --next "<the exact next action>"');
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
      lines.push(`    close it with: wfctl flow close ${flow.id}`);
    }
  }
  if (waiting.length > 0) {
    lines.push("");
    lines.push(...waiting);
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
    fenceBody(flow.checkpoint.handoff),
    "",
    `last: ${flow.checkpoint.lastAction}`,
    `next: ${flow.checkpoint.nextAction}`,
    `actor: ${flow.checkpoint.actor}   updated: ${flow.checkpoint.updatedAt}`
  ].join("\n");
}
var CheckpointError, CONTROL, INVISIBLE;
var init_checkpoint = __esm({
  "src/core/checkpoint.ts"() {
    "use strict";
    init_gates();
    init_steps();
    CheckpointError = class extends GateRefusal {
    };
    CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
    INVISIBLE = /[\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g;
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

// src/core/lock.ts
import { link, mkdir, readFile as readFile2, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve as resolve2 } from "node:path";
function lockPath(target) {
  return `${resolve2(target)}.lock`;
}
async function readHolderAt(path) {
  try {
    const parsed = JSON.parse(await readFile2(path, "utf8"));
    return typeof parsed?.token === "string" ? parsed : void 0;
  } catch {
    return void 0;
  }
}
async function readHolder(target) {
  return readHolderAt(lockPath(target));
}
function isAbandonedHolder(holder) {
  if (Date.now() - holder.at > STALE_AFTER_MS) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch {
    return true;
  }
}
async function take(target, token) {
  const path = lockPath(target);
  const temporary = `${path}.${process.pid}.${token}.tmp`;
  await writeFile(temporary, JSON.stringify({ pid: process.pid, token, at: Date.now() }), "utf8");
  try {
    await link(temporary, path);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  } finally {
    await rm(temporary, { force: true }).catch(() => void 0);
  }
}
async function reclaim(target, judged) {
  const path = lockPath(target);
  const now = await readHolder(target);
  if (judged && (!now || now.token !== judged.token)) return;
  if (!judged && now) return;
  const aside = `${path}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
  try {
    await rename(path, aside);
  } catch {
    return;
  }
  const taken = await readHolderAt(aside);
  if (taken && !isAbandonedHolder(taken)) {
    try {
      await rename(aside, path);
      return;
    } catch {
    }
  }
  await rm(aside, { force: true }).catch(() => void 0);
}
async function withLock(target, work) {
  const path = lockPath(target);
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + WAIT_MS;
  await mkdir(dirname(path), { recursive: true });
  for (; ; ) {
    if (await take(target, token)) break;
    const holder = await readHolder(target);
    if (!holder || isAbandonedHolder(holder)) {
      await reclaim(target, holder);
    }
    if (Date.now() > deadline) {
      throw new GateRefusal(
        `${target} is being written by another session.`,
        "Wait for it to finish, then try again.",
        "Two sessions writing one record lose each other's work without either being told."
      );
    }
    await new Promise((wake) => setTimeout(wake, RETRY_MS + Math.floor(Math.random() * RETRY_MS)));
  }
  try {
    return await work();
  } finally {
    const holder = await readHolder(target);
    if (holder?.token === token) {
      await rm(path, { force: true }).catch(() => void 0);
    }
  }
}
async function writeAtomic(path, body) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, body, "utf8");
  const { rename: rename3 } = await import("node:fs/promises");
  await rename3(temporary, path);
}
var STALE_AFTER_MS, RETRY_MS, WAIT_MS;
var init_lock = __esm({
  "src/core/lock.ts"() {
    "use strict";
    init_gates();
    STALE_AFTER_MS = 3e4;
    RETRY_MS = 10;
    WAIT_MS = 1e4;
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
  mutateFlow: () => mutateFlow,
  openFlow: () => openFlow,
  readFlow: () => readFlow,
  unreadableFlows: () => unreadableFlows
});
import { mkdir as mkdir2, readFile as readFile3, readdir, rm as rm2 } from "node:fs/promises";
import { join, resolve as resolve3 } from "node:path";
function flowDirectory(root) {
  return resolve3(root, FLOW_DIR);
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
    const raw = await readFile3(flowPath(root, id), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function createFlowRecord(root, flow) {
  await mkdir2(flowDirectory(root), { recursive: true });
  const path = flowPath(root, flow.id);
  await withLock(path, async () => {
    const next = { ...flow, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await writeAtomic(path, `${JSON.stringify(next, null, 2)}
`);
  });
}
async function mutateFlow(root, id, change) {
  const path = flowPath(root, id);
  return withLock(path, async () => {
    const current = await readFlow(root, id);
    if (!current) {
      throw new GateRefusal(`No flow named ${id}.`, "wfctl brief");
    }
    const next = { ...change(current), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await writeAtomic(path, `${JSON.stringify(next, null, 2)}
`);
    return next;
  });
}
function isFlowId(id) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !id.includes("..");
}
async function currentFlowId(root) {
  try {
    const raw = await readFile3(resolve3(root, CURRENT_POINTER), "utf8");
    const id = raw.trim();
    if (id.length > 0 && !isFlowId(id)) {
      throw new GateRefusal(
        `${CURRENT_POINTER} does not name a flow in this repository.`,
        "wfctl work list",
        `It reads ${JSON.stringify(id)}. A flow id names a record under ${FLOW_DIR}/ and never a path.`
      );
    }
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
  await mkdir2(flowDirectory(root), { recursive: true });
  const path = resolve3(root, CURRENT_POINTER);
  if (id === void 0) {
    await rm2(path, { force: true });
    return;
  }
  await writeAtomic(path, `${id}
`);
}
async function openFlow(root, options) {
  return withLock(resolve3(root, FLOW_DIR, "open"), () => openFlowLocked(root, options));
}
async function openFlowLocked(root, options) {
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
    attested: { words: options.attested, at: now.toISOString() },
    members: options.members ?? [],
    ...options.sources ? { sources: options.sources } : {},
    repositories: [],
    issues: [],
    recall: emptyRecall(),
    ...options.weight ? { weight: options.weight } : {}
  };
  await createFlowRecord(root, flow);
  await setCurrent(root, id);
  return flow;
}
async function closeFlow(root, id) {
  const flow = await readFlow(root, id);
  if (!flow) {
    throw new FlowOpenError(
      `No flow named ${id}.`,
      "wfctl brief",
      "The brief lists every open flow, including ones the pointer has lost."
    );
  }
  const closed = await mutateFlow(root, id, (current2) => {
    const next = { ...current2, closedAt: (/* @__PURE__ */ new Date()).toISOString() };
    delete next.checkpoint;
    return next;
  });
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
    const id = entry.slice(0, -".json".length);
    try {
      const flow = await readFlow(root, id);
      if (flow) flows.push(flow);
    } catch {
    }
  }
  return flows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
async function unreadableFlows(root) {
  let entries;
  try {
    entries = await readdir(flowDirectory(root));
  } catch {
    return [];
  }
  const broken = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const id = entry.slice(0, -".json".length);
    try {
      await readFlow(root, id);
    } catch (error) {
      broken.push({ id, problem: error.message });
    }
  }
  return broken;
}
var FLOW_DIR, CURRENT_POINTER, FlowOpenError;
var init_flow = __esm({
  "src/core/flow.ts"() {
    "use strict";
    init_gates();
    init_lock();
    init_recall();
    init_types();
    FLOW_DIR = ".workflow/flows";
    CURRENT_POINTER = ".workflow/flows/current";
    FlowOpenError = class extends GateRefusal {
    };
  }
});

// src/core/paths-resolve.ts
var paths_resolve_exports = {};
__export(paths_resolve_exports, {
  canonical: () => canonical,
  contains: () => contains,
  findRepositoryRoot: () => findRepositoryRoot
});
import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { dirname as dirname2, isAbsolute, resolve as resolve4, sep } from "node:path";
function settle(from, trailing) {
  let node = from;
  const rest = [...trailing];
  for (; ; ) {
    try {
      return [realpathSync.native(node), ...rest].join(sep);
    } catch {
      const parent = dirname2(node);
      if (parent === node) return [node, ...rest].join(sep);
      rest.unshift(node.slice(parent.length + 1));
      node = parent;
    }
  }
}
function canonical(path) {
  let current = resolve4(path);
  const trailing = [];
  for (let depth = 0; depth < MAX_LINKS; depth += 1) {
    try {
      if (lstatSync(current).isSymbolicLink()) {
        const target = readlinkSync(current);
        current = isAbsolute(target) ? target : resolve4(dirname2(current), target);
        continue;
      }
    } catch {
    }
    return settle(current, trailing);
  }
  return settle(current, trailing);
}
function contains(base, target) {
  const root = canonical(base);
  const path = canonical(target);
  return path === root || path.startsWith(`${root}${sep}`);
}
function findRepositoryRoot(from) {
  let current = canonical(from);
  for (let depth = 0; depth < 32; depth += 1) {
    if (exists(resolve4(current, ".workflow/state.json"))) return current;
    const parent = dirname2(current);
    if (parent === current) break;
    current = parent;
  }
  return canonical(from);
}
function exists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
var MAX_LINKS;
var init_paths_resolve = __esm({
  "src/core/paths-resolve.ts"() {
    "use strict";
    MAX_LINKS = 64;
  }
});

// src/core/paths.ts
import { mkdir as mkdir3, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname3, relative, resolve as resolve5, sep as sep2 } from "node:path";
function promotionDirectory(knowledgeRoot, bundleId) {
  return resolve5(knowledgeRoot, "changes", "active", bundleId, "promotion");
}
async function createPromotionDraft(knowledgeRoot, bundleId, page) {
  const withoutRoot = page.replace(/^\/+/, "").replace(/^knowledge\//, "");
  const normalized = withoutRoot;
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
  const path = resolve5(promotionDirectory(knowledgeRoot, bundleId), normalized);
  await mkdir3(dirname3(path), { recursive: true });
  await writeFile3(path, "", { flag: "wx" }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  return path;
}
function assertWriteAllowed(options) {
  const target = canonical(options.target);
  const knowledge = canonical(options.knowledgeRoot);
  const rel = relative(knowledge, target);
  if (rel.startsWith("..") || rel === "") return;
  const segments = rel.split(sep2);
  if (segments[0] === "knowledge") {
    throw new GateRefusal(
      "A curated page cannot be written directly into knowledge/.",
      'wfctl work promotion draft "<area>/<page>.md"',
      "Pages enter curated knowledge through promotion, which is the maintainer's decision. Drafts live in the bundle until then."
    );
  }
  if (segments[0] === "changes" && (segments[1] === "promotion" || segments[1] === "archive")) {
    const correctable = segments[1] === "promotion" && segments[3] === "promotion" && segments.length > 4;
    if (!correctable) {
      throw new GateRefusal(
        `${segments[1]} is written by the tool, not by hand.`,
        segments[1] === "promotion" ? 'Edit the drafted page under <record>/promotion/, or: wfctl work promotion draft "<area>/<page>.md"' : "wfctl work close --outcome <completed|partial|abandoned>",
        "A record that appears here without passing the flow is promotable without ever having been reviewed."
      );
    }
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
    init_paths_resolve();
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
  queuePath: () => queuePath,
  readOutcome: () => readOutcome
});
import { copyFile, mkdir as mkdir4, readdir as readdir2, rename as rename2, stat } from "node:fs/promises";
import { dirname as dirname4, join as join2, relative as relative2, resolve as resolve6 } from "node:path";
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
  const promotion = resolve6(knowledgeRoot, ACTIVE, bundleId, "promotion");
  if (!await isDirectory(promotion)) return false;
  const entries = await readdir2(promotion, { recursive: true, withFileTypes: true });
  return entries.some((entry) => entry.isFile() && entry.name.endsWith(".md"));
}
async function readOutcome(knowledgeRoot, bundleId) {
  const { readFile: readFile15 } = await import("node:fs/promises");
  const raw = await readFile15(
    resolve6(knowledgeRoot, QUEUE, bundleId, "outcome"),
    "utf8"
  ).catch(() => "completed");
  const outcome = raw.trim();
  return outcome === "partial" || outcome === "abandoned" ? outcome : "completed";
}
async function closeBundle(options) {
  const from = resolve6(options.knowledgeRoot, ACTIVE, options.bundleId);
  if (!await isDirectory(from)) {
    throw new GateRefusal(
      `No active record named ${options.bundleId}.`,
      "wfctl work promotion list"
    );
  }
  const drafts = await hasDraftedPages(options.knowledgeRoot, options.bundleId);
  const destination = destinationFor(options.outcome, drafts);
  const to = resolve6(options.knowledgeRoot, destination, options.bundleId);
  await mkdir4(resolve6(options.knowledgeRoot, destination), { recursive: true });
  await rename2(from, to);
  const { writeFile: writeFile10 } = await import("node:fs/promises");
  await writeFile10(resolve6(to, "outcome"), `${options.outcome}
`, "utf8");
  return { from, to, outcome: options.outcome, waitingOnPromotion: destination === QUEUE };
}
async function assertCorrectable(knowledgeRoot, bundleId) {
  const queued = resolve6(knowledgeRoot, QUEUE, bundleId);
  if (await isDirectory(queued)) return queued;
  const active = resolve6(knowledgeRoot, ACTIVE, bundleId);
  if (await isDirectory(active)) return active;
  const archived = resolve6(knowledgeRoot, ARCHIVE, bundleId);
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
  const path = resolve6(knowledgeRoot, QUEUE);
  if (!await isDirectory(path)) return [];
  const entries = await readdir2(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
async function promote(options) {
  const queued = resolve6(options.knowledgeRoot, QUEUE, options.bundleId);
  if (!await isDirectory(queued)) {
    throw new GateRefusal(
      `${options.bundleId} is not waiting in the promotion queue.`,
      "wfctl work promotion list"
    );
  }
  const drafts = resolve6(queued, "promotion");
  const entries = await readdir2(drafts, { recursive: true, withFileTypes: true }).catch(() => []);
  const pages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const from = join2(entry.parentPath ?? drafts, entry.name);
    const page = relative2(drafts, from);
    const to = resolve6(options.knowledgeRoot, "knowledge", page);
    await mkdir4(dirname4(to), { recursive: true });
    await copyFile(from, to);
    pages.push(page);
  }
  if (pages.length === 0) {
    throw new GateRefusal(
      `${options.bundleId} is in the queue with no drafted page.`,
      `wfctl work promotion draft "<area>/<page>.md"`,
      "A record waits here because it has something to say. One with nothing to say archives at closure instead."
    );
  }
  const archived = resolve6(options.knowledgeRoot, ARCHIVE, options.bundleId);
  await mkdir4(resolve6(options.knowledgeRoot, ARCHIVE), { recursive: true });
  await rename2(queued, archived);
  return { archived, pages };
}
function queuePath(knowledgeRoot, bundleId) {
  return join2(resolve6(knowledgeRoot, QUEUE), bundleId);
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

// src/core/git.ts
var git_exports = {};
__export(git_exports, {
  citation: () => citation,
  currentBranch: () => currentBranch,
  filesAt: () => filesAt,
  head: () => head,
  isRepository: () => isRepository,
  readAt: () => readAt,
  resolveRevision: () => resolveRevision
});
import { spawnSync } from "node:child_process";
function isRepository(path, run3 = runGit) {
  return run3(["rev-parse", "--is-inside-work-tree"], path).status === 0;
}
function head(path, run3 = runGit) {
  const revision = run3(["rev-parse", "HEAD"], path);
  if (revision.status !== 0) {
    throw new GateRefusal(
      `${path} is not a Git repository, or has no commits.`,
      `git -C ${path} init && git -C ${path} commit --allow-empty -m "initial"`,
      revision.stderr.trim()
    );
  }
  const status = run3(["status", "--porcelain"], path);
  return { revision: revision.stdout.trim(), dirty: status.stdout.trim().length > 0 };
}
function resolveRevision(path, revision, run3 = runGit) {
  const result = run3(["rev-parse", "--verify", `${revision}^{commit}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${revision} is not a commit in ${path}.`,
      `git -C ${path} log --oneline -5`,
      "A revision nobody can resolve cannot be read at, so nothing recorded against it can be checked later."
    );
  }
  return result.stdout.trim();
}
function filesAt(path, revision, run3 = runGit) {
  const result = run3(["ls-tree", "-r", "--name-only", revision], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `Cannot list ${path} at ${revision}.`,
      `git -C ${path} log --oneline -5`,
      result.stderr.trim()
    );
  }
  return result.stdout.split("\n").filter((line) => line.trim().length > 0).sort();
}
function readAt(path, revision, file, run3 = runGit) {
  const result = run3(["show", `${revision}:${file}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${file} is not in ${path} at ${revision}.`,
      `wfctl reconstruct status`,
      "It may have been added later, or removed before this revision."
    );
  }
  return result.stdout;
}
function citation(repository, revision, file) {
  return `${repository}@${revision.slice(0, 12)}:${file}`;
}
function currentBranch(path, run3 = runGit) {
  const result = run3(["rev-parse", "--abbrev-ref", "HEAD"], path);
  if (result.status !== 0) return "";
  const name = result.stdout.trim();
  return name === "HEAD" ? "" : name;
}
var runGit;
var init_git = __esm({
  "src/core/git.ts"() {
    "use strict";
    init_gates();
    runGit = (args, cwd) => {
      const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 3e4
      });
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    };
  }
});

// src/core/curated.ts
var curated_exports = {};
__export(curated_exports, {
  KNOWLEDGE_DIR: () => KNOWLEDGE_DIR,
  assertPromotable: () => assertPromotable,
  collectPages: () => collectPages,
  contentHash: () => contentHash,
  inspectLinks: () => inspectLinks,
  inspectPage: () => inspectPage,
  normalizePage: () => normalizePage,
  renderIssues: () => renderIssues,
  stripSeal: () => stripSeal,
  validateCurated: () => validateCurated
});
import { createHash } from "node:crypto";
import { readFile as readFile4, readdir as readdir3 } from "node:fs/promises";
import { join as join3, relative as relative3, resolve as resolve7 } from "node:path";
function contentHash(body) {
  return createHash("sha256").update(body.trim()).digest("hex");
}
function frontmatter(body) {
  const match = /^---\n([\s\S]*?)\n---/.exec(body);
  if (!match) return {};
  const fields = {};
  const lines = (match[1] ?? "").split("\n");
  for (const [index, raw] of lines.entries()) {
    const pair = /^([a-z_-]+):\s*(.*)$/.exec(raw);
    if (!pair?.[1]) continue;
    const inline = (pair[2] ?? "").replace(/^["']|["']$/g, "").trim();
    if (inline) {
      fields[pair[1]] = inline;
      continue;
    }
    const following = lines[index + 1] ?? "";
    fields[pair[1]] = /^\s+\S/.test(following) ? following.trim().replace(/^-\s*/, "") : "";
  }
  return fields;
}
function isMap(path) {
  const name = path.split("/").pop() ?? "";
  return name === "index.md" || name === "log.md";
}
function inspectPage(path, body) {
  const issues = [];
  const fields = frontmatter(body);
  if (!isMap(path)) {
    for (const required of ["view", "purpose", "audience"]) {
      if (!fields[required]) {
        issues.push({
          path,
          problem: `no ${required} declared`,
          remedy: `Add ${required}: to the frontmatter`
        });
      }
    }
  }
  const view = fields.view;
  if (view && !VIEWS.has(view)) {
    issues.push({
      path,
      problem: `view is ${view}; a page is on the product road, the engineering road, or is a decision serving both`,
      remedy: "Set view: product, view: engineering, or view: decision"
    });
  }
  const cited = UNTRUSTED.find((untrusted) => body.includes(untrusted));
  if (cited) {
    {
      issues.push({
        path,
        problem: `cites ${cited}, which carries no authority`,
        remedy: "Cite the evidence itself \u2014 a pinned source location, a promoted decision, or the maintainer's own answer"
      });
    }
  }
  if (view === "product") {
    if (/```[a-z]*\n/.test(body)) {
      issues.push({
        path,
        problem: "carries a code block",
        remedy: "Move it to the engineering page and link that"
      });
    }
    if (/\b(src|lib|packages)\/[\w./-]+\.[a-z]{2,4}\b/.test(body)) {
      issues.push({
        path,
        problem: "names a source path",
        remedy: "Move it to the engineering page and link that"
      });
    }
  }
  if (!/^#\s+\S/m.test(body.replace(/^---[\s\S]*?---/, ""))) {
    issues.push({ path, problem: "has no heading", remedy: "Give the page a title" });
  }
  const stable = fields.status === "stable";
  if (stable && !fields.content_hash) {
    issues.push({
      path,
      problem: "is stable with no sealed content hash",
      remedy: "Seal the review against this page's hash, or set status: draft"
    });
  }
  if (stable && fields.content_hash && fields.content_hash !== contentHash(stripSeal(body))) {
    issues.push({
      path,
      problem: "changed after its review was sealed",
      remedy: "Review it again and reseal, or set status: draft"
    });
  }
  return issues;
}
function stripSeal(body) {
  return body.replace(/^content_hash:.*\n/m, "");
}
async function collectPages(root) {
  const base = resolve7(root, KNOWLEDGE_DIR);
  try {
    const entries = await readdir3(base, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => relative3(base, join3(entry.parentPath ?? base, entry.name))).sort();
  } catch {
    return [];
  }
}
async function inspectLinks(root) {
  const pages = await collectPages(root);
  if (pages.length === 0) return [];
  const known = new Set(pages);
  const linkedTo = /* @__PURE__ */ new Set();
  const issues = [];
  for (const page of pages) {
    const body = await readFile4(resolve7(root, KNOWLEDGE_DIR, page), "utf8").catch(() => "");
    for (const match of body.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const href = match[1] ?? "";
      if (/^[a-z]+:\/\//.test(href)) continue;
      const target = relative3(
        resolve7(root, KNOWLEDGE_DIR),
        resolve7(root, KNOWLEDGE_DIR, page, "..", href)
      );
      if (!known.has(target)) {
        issues.push({
          path: page,
          problem: `links to ${href}, which is not a curated page`,
          remedy: "Repair the link, or write the page it expects"
        });
        continue;
      }
      linkedTo.add(target);
    }
  }
  for (const page of pages) {
    if (page === "index.md" || linkedTo.has(page)) continue;
    issues.push({
      path: page,
      problem: "nothing links to it",
      remedy: "Link it from its Area index, or from the page that owns the subject"
    });
  }
  return issues;
}
function normalizePage(root, page) {
  const base = resolve7(root, KNOWLEDGE_DIR);
  const absolute = resolve7(root, page);
  const inside = relative3(base, absolute);
  if (!inside.startsWith("..") && inside !== "") return inside;
  const fromRoot = relative3(base, resolve7(base, page));
  if (!fromRoot.startsWith("..") && fromRoot !== "") return fromRoot;
  throw new GateRefusal(
    `${page} is not a curated page.`,
    "wfctl knowledge validate",
    `Curated pages live under ${KNOWLEDGE_DIR}/. This path resolves outside it.`
  );
}
async function validateCurated(root, only) {
  const pages = only ? [normalizePage(root, only)] : await collectPages(root);
  const issues = [];
  for (const page of pages) {
    const body = await readFile4(resolve7(root, KNOWLEDGE_DIR, page), "utf8").catch(() => void 0);
    if (body === void 0) {
      issues.push({ path: page, problem: "cannot be read", remedy: "Check the path" });
      continue;
    }
    issues.push(...inspectPage(page, body));
  }
  if (!only) issues.push(...await inspectLinks(root));
  return issues;
}
function assertPromotable(issues) {
  if (issues.length === 0) return;
  throw new GateRefusal(
    `${issues.length} page problem(s) would enter curated knowledge.`,
    issues[0]?.remedy ?? "Repair the page, then promote again",
    issues.map((issue) => `  ${issue.path}: ${issue.problem}
    \u2192 ${issue.remedy}`).join("\n")
  );
}
function renderIssues(issues, pages = 1) {
  if (pages === 0) {
    return [
      "There are no curated pages.",
      "",
      "That is not a pass. An empty corpus satisfies every structural check, and",
      "reporting it as clean reads exactly like a corpus that was checked."
    ].join("\n");
  }
  if (issues.length === 0) return `${pages} page(s) pass structural validation.`;
  return [
    ...issues.map((issue) => `${issue.path}
  ${issue.problem}
  \u2192 ${issue.remedy}`),
    "",
    `${issues.length} problem(s). Structural validation cannot tell whether a page`,
    "is true or whether a reader can act on it \u2014 that is the semantic gate's job."
  ].join("\n");
}
var KNOWLEDGE_DIR, UNTRUSTED, VIEWS;
var init_curated = __esm({
  "src/core/curated.ts"() {
    "use strict";
    init_gates();
    KNOWLEDGE_DIR = "knowledge";
    UNTRUSTED = ["reconstruction/raw/", "reconstruction/active/", "intake/", "raw/"];
    VIEWS = /* @__PURE__ */ new Set(["product", "engineering", "decision"]);
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
  assertPagesWritten: () => assertPagesWritten,
  assertProbed: () => assertProbed,
  assertSomethingRead: () => assertSomethingRead,
  assertTrajectoriesExist: () => assertTrajectoriesExist,
  casePath: () => casePath,
  closeCase: () => closeCase,
  currentCase: () => currentCase,
  hasBaseline: () => hasBaseline,
  lastContradictionId: () => lastContradictionId,
  markExcluded: () => markExcluded,
  markRead: () => markRead,
  mutateCase: () => mutateCase,
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
import { mkdir as mkdir5, readFile as readFile5, readdir as readdir4, stat as stat2 } from "node:fs/promises";
import { dirname as dirname5, join as join4, resolve as resolve8 } from "node:path";
function casePath(root, id) {
  return resolve8(root, RECONSTRUCTION_DIR, id, "case.json");
}
async function readCase(root, id) {
  try {
    return JSON.parse(await readFile5(casePath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeCase(root, record) {
  const path = casePath(root, record.id);
  await mkdir5(dirname5(path), { recursive: true });
  await withLock(path, () => writeAtomic(path, `${JSON.stringify(record, null, 2)}
`));
}
async function mutateCase(root, id, change) {
  const path = casePath(root, id);
  return withLock(path, async () => {
    const current = await readCase(root, id);
    if (!current) {
      throw new GateRefusal(`No reconstruction named ${id}.`, "wfctl reconstruct status");
    }
    const next = change(current);
    await writeAtomic(path, `${JSON.stringify(next, null, 2)}
`);
    return next;
  });
}
async function hasBaseline(root) {
  const knowledge = resolve8(root, "knowledge");
  try {
    const entries = await readdir4(knowledge, { recursive: true, withFileTypes: true });
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
  const raw = resolve8(root, RAW_DIR);
  try {
    const entries = await readdir4(raw, { recursive: true, withFileTypes: true });
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
function assertSomethingRead(record) {
  if (record.coverage.read.length > 0) return;
  throw new GateRefusal(
    "Nothing in scope was read; every file was excluded.",
    "wfctl reconstruct read <path>",
    "A pass that excluded its whole scope has established nothing about the project, and closing it would record that it had."
  );
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
  if (record.abandoned) {
    return `Abandoned: ${record.abandoned.reason}`;
  }
  if (record.trajectories.length > 0) {
    return `${record.trajectories.length} subject(s) recorded.`;
  }
  const revisions = record.repositories.map((entry) => `${entry.repository}@${entry.revision}${entry.dirty ? " (dirty)" : ""}`).join(", ");
  return `Nothing moved. Checked at ${revisions}.`;
}
function assertClosable(record, actor) {
  if (record.abandoned) return;
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
  const from = resolve8(root, RECONSTRUCTION_DIR, id);
  const present = await stat2(from).then(
    (entry) => entry.isDirectory(),
    () => false
  );
  if (!present) {
    throw new GateRefusal(`No active reconstruction named ${id}.`, "wfctl reconstruct status");
  }
  const { rename: rename3, rm: rm3, stat: statPath } = await import("node:fs/promises");
  await mkdir5(resolve8(root, RECONSTRUCTION_ARCHIVE), { recursive: true });
  let to = resolve8(root, RECONSTRUCTION_ARCHIVE, id);
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const taken = await statPath(to).then(
      () => true,
      () => false
    );
    if (!taken) break;
    to = resolve8(root, RECONSTRUCTION_ARCHIVE, `${id}-${suffix}`);
  }
  await rename3(from, to);
  await rm3(resolve8(root, RECONSTRUCTION_DIR, "current"), { force: true });
  return to;
}
async function setCurrentCase(root, id) {
  const path = resolve8(root, CURRENT_POINTER2);
  await mkdir5(dirname5(path), { recursive: true });
  await writeAtomic(path, `${id}
`);
}
async function currentCase(root) {
  try {
    const id = (await readFile5(resolve8(root, CURRENT_POINTER2), "utf8")).trim();
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
  const allRaw = record.rawPaths.map((path) => `${RAW_DIR}/${path}`);
  let raw = [];
  if (options.rawScope === "all") {
    raw = allRaw;
  } else if (options.rawScope === "selected") {
    const chosen = options.inScope ?? [];
    if (chosen.length === 0) {
      throw new GateRefusal(
        "`--raw selected` names which raw material is in scope, and nothing named it.",
        'wfctl reconstruct scope --repository <owner/name> --raw selected --in "<path>"...',
        "Selecting nothing is `--raw none`, and saying so leaves a record that is true. A case that reports raw as selected while no raw path is in scope reads as coverage that was checked."
      );
    }
    raw = allRaw.filter(
      (path) => chosen.some((prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/+$/, "")}/`))
    );
  }
  const fromTree = options.repositories.flatMap((repository) => {
    const revision = resolveRevision(repository.path, repository.revision);
    return filesAt(repository.path, revision).map(
      (file) => `${repository.repository}:${file}`
    );
  });
  const narrowed = options.inScope.length > 0 ? fromTree.filter(
    (entry) => options.inScope.some(
      (want) => entry === want || entry.endsWith(`:${want}`) || entry.includes(`:${want}`)
    )
  ) : fromTree;
  if (options.inScope.length > 0 && narrowed.length === 0) {
    throw new GateRefusal(
      "Nothing in the pinned tree matches that scope.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>   (with no --in, for everything)",
      `Asked for: ${options.inScope.join(", ")}`
    );
  }
  const inScope = [.../* @__PURE__ */ new Set([...narrowed, ...raw])].sort();
  const excluded = (options.exclude ?? []).map((path) => {
    if (!inScope.includes(path)) {
      throw new GateRefusal(
        `${path} is not in the pinned tree, so excluding it counts nothing.`,
        "wfctl reconstruct scope --repository <owner/name>"
      );
    }
    return { path, reason: "excluded when the scope was settled" };
  });
  const next = {
    ...record,
    stage: "crawl",
    repositories: options.repositories,
    rawScope: options.rawScope,
    coverage: { ...record.coverage, inScope, excluded }
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
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      // A path cannot be both read and excluded; the later act wins.
      read: [.../* @__PURE__ */ new Set([...current.coverage.read, path])].sort(),
      excluded: current.coverage.excluded.filter((entry) => entry.path !== path)
    }
  }));
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
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      read: current.coverage.read.filter((entry) => entry !== path),
      excluded: [
        ...current.coverage.excluded.filter((entry) => entry.path !== path),
        { path, reason: reason.trim() }
      ]
    }
  }));
}
async function recordContradiction(root, record, options) {
  if (options.sides.length < 2) {
    throw new GateRefusal(
      "A contradiction needs at least two sides.",
      'wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"'
    );
  }
  let created = "";
  return mutateCase(root, record.id, (current) => {
    const id = `C${String(current.contradictions.length + 1).padStart(3, "0")}`;
    created = id;
    return {
      ...current,
      contradictions: [
        ...current.contradictions,
        { id, subject: options.subject, sides: options.sides }
      ]
    };
  }).then((next) => {
    lastContradictionId = created;
    return next;
  });
}
async function resolveContradiction(root, record, id, resolution) {
  const found = record.contradictions.find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    throw new GateRefusal(
      `No contradiction named ${id}.`,
      "wfctl reconstruct status",
      record.contradictions.length > 0 ? `Recorded:
${record.contradictions.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "None recorded."
    );
  }
  if (!resolution.trim()) {
    throw new GateRefusal(
      "A resolution records what they decided.",
      `wfctl reconstruct resolve ${id} --resolution "<what they decided>"`
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    contradictions: current.contradictions.map(
      (entry) => entry.id.toUpperCase() === id.toUpperCase() ? { ...entry, resolution: resolution.trim() } : entry
    )
  }));
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
  const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const curated = new Set(await collectPages2(root));
  for (const page of probe.pages) {
    const named = page.replace(/^knowledge\//, "");
    if (curated.has(named)) continue;
    throw new GateRefusal(
      `${page} is not a curated page.`,
      "wfctl knowledge validate",
      curated.size > 0 ? `Pages in the corpus:
${[...curated].map((entry) => `  ${entry}`).join("\n")}` : "The corpus is empty; the write stage has not produced anything yet."
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    probes: [...current.probes.filter((entry) => entry.question !== probe.question), probe]
  }));
}
async function assertPagesWritten(root, record) {
  const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const pages = await collectPages2(root);
  if (pages.length > 0) return;
  throw new GateRefusal(
    "No page has been written, so there is nothing to probe.",
    "Write the pages this pass established into knowledge/, then: wfctl reconstruct stage",
    `${record.trajectories.length} subject(s) were assembled. A pass that assembled lines and wrote nothing has established nothing anyone can read.`
  );
}
async function advanceStage(root, record, actor) {
  switch (record.stage) {
    case "scope":
      if (record.repositories.length === 0 || record.coverage.inScope.length === 0) {
        throw new GateRefusal(
          "The scope has not been settled, so there is nothing to read.",
          "wfctl reconstruct scope --repository <owner/name>",
          "A crawl over an empty scope satisfies its own gate without reading anything."
        );
      }
      break;
    case "crawl":
      assertCrawlComplete(record);
      assertSomethingRead(record);
      break;
    case "assemble":
      assertTrajectoriesExist(record);
      break;
    case "adjudicate":
      assertAdjudicated(record);
      break;
    case "write":
      await assertPagesWritten(root, record);
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
  const pinned = record.repositories.map((entry) => `${entry.repository}@${entry.revision.slice(0, 12)}${entry.dirty ? " (dirty)" : ""}`).join(", ");
  return [
    record.abandoned ? `${record.id}  \xB7  ABANDONED: ${record.abandoned.reason}` : `${record.id}  \xB7  stage ${record.stage}  \xB7  ${STAGE_PRESENCE[record.stage]} present`,
    // Provenance was recorded and never shown, so every pass closed without
    // naming the revision or the dirtiness it read at.
    ...pinned ? [`read at: ${pinned}`, `raw scope: ${record.rawScope ?? "none"}`] : [],
    record.hadBaseline ? "re-checking an existing baseline" : "first baseline; curated knowledge was empty",
    "",
    `coverage: ${record.coverage.read.length} read, ${record.coverage.excluded.length} excluded, ${left.length} left`,
    `subjects:  ${record.trajectories.length}`,
    open.length > 0 ? `open contradictions:
${open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "open contradictions: none",
    `probes: ${record.probes.filter((probe) => probe.passed === true).length}/${record.probes.length} passed`
  ].join("\n");
}
var RECONSTRUCTION_DIR, RECONSTRUCTION_ARCHIVE, RAW_DIR, STAGES, STAGE_PRESENCE, CURRENT_POINTER2, lastContradictionId;
var init_reconstruct = __esm({
  "src/core/reconstruct.ts"() {
    "use strict";
    init_gates();
    init_git();
    init_lock();
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
    lastContradictionId = "";
  }
});

// src/core/bundles.ts
var bundles_exports = {};
__export(bundles_exports, {
  ACTIVE_DIR: () => ACTIVE_DIR,
  bundleExists: () => bundleExists,
  bundleNames: () => bundleNames,
  joinBundlePath: () => join5,
  listBundles: () => listBundles,
  markSuperseded: () => markSuperseded,
  readSupersession: () => readSupersession,
  renderBundles: () => renderBundles,
  renderStranded: () => renderStranded,
  writeBundleFile: () => writeBundleFile
});
import { readFile as readFile6, readdir as readdir5, writeFile as writeFile5 } from "node:fs/promises";
import { join as join5, resolve as resolve9 } from "node:path";
async function readSupersession(root, bundle) {
  try {
    return JSON.parse(
      await readFile6(resolve9(root, ACTIVE_DIR, bundle, SUPERSEDED), "utf8")
    );
  } catch {
    return void 0;
  }
}
async function markSuperseded(root, bundle, into) {
  await writeAtomic(
    resolve9(root, ACTIVE_DIR, bundle, SUPERSEDED),
    `${JSON.stringify(into, null, 2)}
`
  );
}
async function listBundles(root) {
  let names;
  try {
    names = (await readdir5(resolve9(root, ACTIVE_DIR), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
  const flows = (await listFlows(root)).filter((flow) => !flow.closedAt);
  const held = /* @__PURE__ */ new Map();
  for (const flow of flows) {
    for (const member of flow.members) held.set(member, flow);
  }
  const states = [];
  for (const bundle of names) {
    const into = await readSupersession(root, bundle);
    if (into) {
      states.push({ state: "superseded", bundle, into });
      continue;
    }
    const holder = held.get(bundle);
    states.push(
      holder ? { state: "held", bundle, flow: holder.id } : { state: "stranded", bundle }
    );
  }
  return states;
}
function renderStranded(states) {
  const stranded = states.filter((entry) => entry.state === "stranded");
  if (stranded.length === 0) return void 0;
  return [
    `${stranded.length} bundle(s) in ${ACTIVE_DIR} have no flow, so nothing can reach them:`,
    ...stranded.map((entry) => `  ${entry.bundle}`),
    "",
    "Resuming one is the maintainer's decision, not a tidy-up. Put it to them in",
    "your own words \u2014 what the work was, where it stopped \u2014 and record their",
    "answer:",
    "",
    "  wfctl work adopt <bundle> --weight <significant|lightweight> \\",
    '    --attested "<what they said>"'
  ].join("\n");
}
function renderBundles(states) {
  if (states.length === 0) return `No bundles in ${ACTIVE_DIR}.`;
  const lines = states.map((entry) => {
    if (entry.state === "held") return `  held        ${entry.bundle}  (flow ${entry.flow})`;
    if (entry.state === "superseded") return `  superseded  ${entry.bundle}  -> ${entry.into.by}`;
    return `  stranded    ${entry.bundle}`;
  });
  const stranded = renderStranded(states);
  return [`${states.length} bundle(s):`, ...lines, ...stranded ? ["", stranded] : []].join("\n");
}
async function bundleExists(root, bundle) {
  try {
    await readdir5(resolve9(root, ACTIVE_DIR, bundle));
    return true;
  } catch {
    return false;
  }
}
async function bundleNames(root) {
  return (await listBundles(root)).map((entry) => entry.bundle);
}
async function writeBundleFile(root, bundle, name, body) {
  await writeFile5(resolve9(root, ACTIVE_DIR, bundle, name), body, "utf8");
}
var ACTIVE_DIR, SUPERSEDED;
var init_bundles = __esm({
  "src/core/bundles.ts"() {
    "use strict";
    init_flow();
    init_lock();
    ACTIVE_DIR = "changes/active";
    SUPERSEDED = "superseded.json";
  }
});

// src/core/registry.ts
var registry_exports = {};
__export(registry_exports, {
  REGISTRY_PATH: () => REGISTRY_PATH,
  addRepository: () => addRepository,
  label: () => label,
  readRegistry: () => readRegistry,
  removeRepository: () => removeRepository,
  renderRegistry: () => renderRegistry,
  writeRegistry: () => writeRegistry
});
import { mkdir as mkdir6, readFile as readFile7, writeFile as writeFile6 } from "node:fs/promises";
import { dirname as dirname6, resolve as resolve10 } from "node:path";
function label(entry) {
  return entry.checkout || entry.worktreeId;
}
async function readRegistry(root) {
  try {
    const raw = await readFile7(resolve10(root, REGISTRY_PATH), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.repositories ?? [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeRegistry(root, repositories) {
  const path = resolve10(root, REGISTRY_PATH);
  await mkdir6(dirname6(path), { recursive: true });
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
  return repositories.map((entry) => `${entry.repository}  ${label(entry).padEnd(14)}  ${entry.path}`).join("\n");
}
var REGISTRY_PATH;
var init_registry = __esm({
  "src/core/registry.ts"() {
    "use strict";
    init_gates();
    REGISTRY_PATH = ".workflow/repositories.json";
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
  const unknown = review.findings.filter(
    (finding) => finding.status !== "open" && finding.status !== "accepted"
  );
  if (unknown.length > 0) {
    throw new GateRefusal(
      `${unknown.length} finding(s) declare a status that is not open or accepted.`,
      "Set each to open, or to accepted with a reason.",
      unknown.map((finding) => `  [${finding.lens}] ${String(finding.status)}: ${finding.summary}`).join("\n")
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
import { readFile as readFile8 } from "node:fs/promises";
function fail(message, remedy, detail) {
  throw new GateRefusal(message, remedy, detail);
}
async function readReviewArtifact(path, actor) {
  const raw = await readFile8(path, "utf8").catch(() => {
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
import { createHash as createHash2 } from "node:crypto";
import { mkdir as mkdir7, readFile as readFile9, readdir as readdir6 } from "node:fs/promises";
import { dirname as dirname7, resolve as resolve11 } from "node:path";
function trajectoryPath(root, id) {
  return resolve11(root, TRAJECTORY_DIR, `${id}.json`);
}
async function readTrajectory(root, id) {
  try {
    return JSON.parse(await readFile9(trajectoryPath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeTrajectory(root, trajectory) {
  const path = trajectoryPath(root, trajectory.id);
  await mkdir7(dirname7(path), { recursive: true });
  await withLock(path, () => writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`));
}
async function listTrajectories(root) {
  let entries;
  try {
    entries = await readdir6(resolve11(root, TRAJECTORY_DIR));
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
  const digest = createHash2("sha256").update(normalized).digest("hex").slice(0, 8);
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
  return withLock(trajectoryPath(root, id), async () => appendLocked(root, id, subject, event));
}
async function appendLocked(root, id, subject, event) {
  const existing = await readTrajectory(root, id);
  const trajectory = existing ?? {
    id,
    subject: subject.trim(),
    events: [],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (event.settles && !trajectory.events.some((entry) => entry.id === event.settles)) {
    throw new GateRefusal(
      `${trajectory.subject} has no event ${event.settles}.`,
      `wfctl trajectory show "${trajectory.subject}"`,
      "A delivery settles an intent that was recorded; naming one that was not closes nothing and hides that it closed nothing."
    );
  }
  trajectory.events = [
    ...trajectory.events,
    {
      ...event,
      id: event.id || `E${String(trajectory.events.length + 1).padStart(3, "0")}`,
      at: event.at ?? (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  const path = trajectoryPath(root, trajectory.id);
  await mkdir7(dirname7(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`);
  return trajectory;
}
function deriveGap(trajectory) {
  const settled = new Set(
    trajectory.events.filter((event) => event.axis === "delivery" && event.settles).map((event) => event.settles)
  );
  const outstanding = (axis) => trajectory.events.filter((event) => event.axis === axis && !settled.has(event.id)).map((event) => event.summary);
  return {
    subject: trajectory.subject,
    delivery: outstanding("intent"),
    direction: outstanding("vision")
  };
}
function renderTrajectory(trajectory) {
  const lines = [`${trajectory.subject}  (${trajectory.id})`, ""];
  const settled = new Set(
    trajectory.events.filter((event) => event.settles).map((event) => event.settles)
  );
  for (const event of trajectory.events) {
    const when = event.at ? `${event.at.slice(0, 10)}  ` : "";
    const from = event.change ? `  \u2190 ${event.change}` : "";
    const mark = settled.has(event.id) ? " \u2713" : "";
    const closes = event.settles ? `  settles ${event.settles}` : "";
    lines.push(`  ${event.id}  ${event.axis.padEnd(8)} ${when}${event.summary}${from}${closes}${mark}`);
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
    init_lock();
    TRAJECTORY_DIR = "trajectories";
    AXES = ["intent", "delivery", "vision"];
  }
});

// src/core/commands.ts
var commands_exports = {};
__export(commands_exports, {
  advance: () => advance,
  brief: () => brief,
  briefExtras: () => briefExtras,
  capture: () => capture,
  checkpoint: () => checkpoint,
  close: () => close,
  flowClose: () => flowClose,
  handoff: () => handoff,
  issueClaim: () => issueClaim,
  issueComplete: () => issueComplete,
  issueCreate: () => issueCreate,
  issueDrop: () => issueDrop,
  issueList: () => issueList,
  issueNote: () => issueNote,
  park: () => park,
  promote: () => promote2,
  promotionDraft: () => promotionDraft,
  recallAnswer: () => recallAnswer,
  recallRoute: () => recallRoute,
  release: () => release,
  verify: () => verify,
  workAdopt: () => workAdopt,
  workList: () => workList,
  workStart: () => workStart
});
import { mkdir as mkdir8, readFile as readFile10, writeFile as writeFile8 } from "node:fs/promises";
import { resolve as resolve12 } from "node:path";
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
      renderBrief(flows, current?.id, await briefExtras(context)),
      await guidanceFor(context, "session/start")
    ])
  );
}
async function briefExtras(context) {
  const { listQueue: listQueue2 } = await Promise.resolve().then(() => (init_promotion_queue(), promotion_queue_exports));
  const { currentCase: currentCase2 } = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
  const { readdir: readdir10, readFile: read } = await import("node:fs/promises");
  const queued = await listQueue2(context.root).catch(() => []);
  const inbox = await readdir10(resolve12(context.root, "changes/inbox")).catch(() => []);
  let awaitingCaptures = 0;
  for (const entry of inbox) {
    if (!entry.endsWith(".md")) continue;
    const body = await read(resolve12(context.root, "changes/inbox", entry), "utf8").catch(() => "");
    if (/^awaits:\s*maintainer/m.test(body)) awaitingCaptures += 1;
  }
  const reconstruction = await currentCase2(context.root).catch(() => void 0);
  const { listBundles: listBundles2 } = await Promise.resolve().then(() => (init_bundles(), bundles_exports));
  const stranded = (await listBundles2(context.root).catch(() => [])).filter((entry) => entry.state === "stranded").map((entry) => entry.bundle);
  const { unreadableFlows: unreadableFlows2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
  const unreadable = await unreadableFlows2(context.root).catch(() => []);
  return {
    queued,
    awaitingCaptures,
    stranded,
    unreadable,
    ...reconstruction ? { reconstruction: { id: reconstruction.id, stage: reconstruction.stage } } : {}
  };
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
  await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    checkpoint: buildCheckpoint({
      summary: input.summary,
      handoff: input.handoff,
      lastAction: input.last,
      nextAction: input.next,
      actor: context.actor,
      /**
       * Carried unless this call names its own.
       *
       * `todo` was replaced wholesale, so the second checkpoint of a session
       * deleted the jobs the first had recorded — and checkpointing often is
       * the thing this workflow asks for most. Doing it correctly was what
       * lost them.
       */
      todo: input.todo && input.todo.length > 0 ? input.todo : current.checkpoint?.todo ?? []
    })
  }));
  return ok(`checkpoint written for ${flow.id}`);
}
function assertAttested(words, command) {
  const said = words.trim();
  if (said) return said;
  throw new GateRefusal(
    "A bundle exists because the maintainer asked for it, and nothing here says they did.",
    command,
    'Put the work to them in your own words \u2014 what it is, and whether it changes behaviour, meaning, contracts, data or operations \u2014 then record their answer verbatim.\n\nIf you cannot quote them, this is not a bundle:\n  wfctl capture "<what you found>"'
  );
}
async function workStart(context, options) {
  try {
    const { currentCase: currentCase2 } = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
    const open = await currentCase2(context.root).catch(() => void 0);
    if (open && !open.abandoned) {
      throw new GateRefusal(
        `Reconstruction ${open.id} is open at stage ${open.stage}; work outside it is out of scope.`,
        `wfctl reconstruct abandon --reason "<why this pass is not finishing>"`
      );
    }
    if (!options.weight) {
      const definition = definitionFor("opened");
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        'wfctl work start --title "<...>" --weight <significant|lightweight>',
        definition.demands
      );
    }
    const attested = assertAttested(
      options.attested,
      'wfctl work start --title "<...>" --weight <significant|lightweight> --attested "<what they said>"'
    );
    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title,
      weight: options.weight,
      attested,
      ...options.from ? {
        sources: [
          { from: options.from, attested, at: (/* @__PURE__ */ new Date()).toISOString() }
        ]
      } : {}
    });
    await mkdir8(resolve12(context.root, "changes/active", flow.id), { recursive: true });
    await mutateFlow(context.root, flow.id, (current) => ({ ...current, members: [flow.id] }));
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
    assertCheckpointCurrent(flow, to);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  const moved = flow.step !== to;
  const advanced = await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    step: to,
    ...moved ? { steppedAt: (/* @__PURE__ */ new Date()).toISOString() } : {}
  }));
  const following = nextStep(to) ?? to;
  const owed = (advanced.checkpoint?.updatedAt ?? "") < (advanced.steppedAt ?? "");
  return ok(
    compose([
      `flow ${flow.id} is now at ${to}`,
      await guidanceFor(context, `work/${to}`),
      renderStep(advanced),
      following !== to && !owed ? `then: ${definitionFor(following).command}` : void 0
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
  const next = await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    recall: recordAnswer(current.recall, {
      item: item.id,
      answer: options.answer,
      route: options.route,
      source: options.source,
      at: (/* @__PURE__ */ new Date()).toISOString()
    })
  }));
  return ok(renderCounterLine(next.step, next.recall));
}
async function recallRoute(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const covered = (options.covered ?? []).filter((path) => path.trim().length > 0);
  if (covered.length === 0) {
    return refused(
      new GateRefusal(
        `A ${options.route} route records what it covered, and nothing named it.`,
        `wfctl recall route ${options.route} --covered "<path>" [--covered "<path>"...]`,
        "Raising a counter without saying what it traversed satisfies the floor with one empty query, which is the reading this checklist exists to distinguish from the real thing."
      )
    );
  }
  const next = await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    recall: recordRoute(current.recall, options.route, covered)
  }));
  return ok(renderCounterLine(next.step, next.recall));
}
async function promotionDraft(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  try {
    assertNotParked(flow);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  const bundle = flow.members[0] ?? flow.id;
  const path = await createPromotionDraft(options.knowledgeRoot, bundle, options.page);
  return ok(
    compose([await guidanceFor(context, "work/promotion-path"), `draft created at:
${path}`])
  );
}
async function flowClose(context, id) {
  const flow = id ? await readFlow(context.root, id) : await currentFlow(context.root);
  if (!flow) {
    const open = (await listFlows(context.root)).filter((entry) => !entry.closedAt);
    return refused(
      new GateRefusal(
        id ? `No flow named ${id}.` : "No flow is open.",
        open.length > 0 ? `wfctl flow close ${open[0]?.id}` : "wfctl brief",
        open.length > 0 ? `Open:
${open.map((entry) => `  ${entry.id}`).join("\n")}` : void 0
      )
    );
  }
  if (flow.parked) {
    return refused(
      new GateRefusal(
        `${flow.id} is parked: ${flow.parked.reason}`,
        `wfctl work release --attested "<what they said>"`,
        "The maintainer held this work. Dropping the fence would discard that without telling them."
      )
    );
  }
  if (flow.step !== "opened" && !flow.closedAt) {
    return refused(
      new GateRefusal(
        `${flow.id} reached ${flow.step}; dropping the fence would discard that.`,
        "wfctl work close --outcome <completed|partial|abandoned>",
        "`flow close` is for a flow that never started. Work that moved is closed with its outcome, which is what the archive and the promotion queue read."
      )
    );
  }
  const unfinished = flow.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "dropped"
  );
  if (unfinished.length > 0) {
    return refused(
      new GateRefusal(
        `${unfinished.length} unit(s) are not terminal.`,
        `wfctl work issue complete ${unfinished[0]?.id}`,
        `${unfinished.map((issue) => `  ${issue.id}  ${issue.status}  ${issue.title}`).join("\n")}

Drop one deliberately if it left the route; closing over it reports undelivered work as delivered.`
      )
    );
  }
  const closed = await closeFlow(context.root, flow.id);
  return ok(`flow ${closed.id} closed; the fence is down and the checkpoint is flushed.`);
}
async function workAdopt(context, options) {
  try {
    const { bundleExists: bundleExists2, listBundles: listBundles2, markSuperseded: markSuperseded2, readSupersession: readSupersession2 } = await Promise.resolve().then(() => (init_bundles(), bundles_exports));
    const bundle = options.bundle.trim();
    if (!bundle) {
      throw new GateRefusal(
        "Adoption needs the bundle it is assembling from.",
        'wfctl work adopt <bundle> --weight <significant|lightweight> --attested "<what they said>"'
      );
    }
    if (bundle.includes("/") || bundle.includes("..")) {
      throw new GateRefusal(
        "A bundle is named, not pathed.",
        "wfctl work list",
        `Give the name as it appears under changes/active, not ${bundle}.`
      );
    }
    if (!await bundleExists2(context.root, bundle)) {
      const known = (await listBundles2(context.root)).map((entry) => entry.bundle);
      throw new GateRefusal(
        `There is no bundle named ${bundle}.`,
        "wfctl work list",
        known.length ? `Under changes/active:
${known.map((n) => `  ${n}`).join("\n")}` : void 0
      );
    }
    const already = await readSupersession2(context.root, bundle);
    if (already) {
      throw new GateRefusal(
        `${bundle} was already absorbed into ${already.by}.`,
        `wfctl work adopt ${already.by} --weight <significant|lightweight> --attested "<what they said>"`,
        "Absorbing it twice would give one body of work two live records, which is the state adoption exists to end."
      );
    }
    const attested = assertAttested(
      options.attested,
      `wfctl work adopt ${bundle} --weight <significant|lightweight> --attested "<what they said>"`
    );
    const at = (/* @__PURE__ */ new Date()).toISOString();
    const source = { from: options.from ?? `changes/active/${bundle}`, bundle, attested, at };
    const open = await currentFlow(context.root);
    if (open) {
      const canonical4 = open.members[0];
      if (!canonical4) {
        throw new GateRefusal(
          `Flow ${open.id} carries no bundle to absorb into.`,
          "wfctl brief"
        );
      }
      if (open.members.includes(bundle)) {
        throw new GateRefusal(
          `${bundle} is already part of flow ${open.id}.`,
          "wfctl work list"
        );
      }
      await markSuperseded2(context.root, bundle, { by: canonical4, at, attested });
      const updated = await mutateFlow(context.root, open.id, (flow2) => ({
        ...flow2,
        members: [...flow2.members, bundle],
        sources: [...flow2.sources ?? [], source]
      }));
      return ok(
        compose([
          [
            `${bundle} absorbed into ${canonical4}.`,
            "It stays in changes/active, marked superseded \u2014 the duplicate is the",
            "evidence of whatever produced it, and deleting it would take that with it.",
            "",
            `Flow ${updated.id} now spans ${updated.members.length} bundle(s).`
          ].join("\n"),
          renderStep(updated)
        ])
      );
    }
    const { currentCase: currentCase2 } = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
    const openCase = await currentCase2(context.root).catch(() => void 0);
    if (openCase && !openCase.abandoned) {
      throw new GateRefusal(
        `Reconstruction ${openCase.id} is open at stage ${openCase.stage}; work outside it is out of scope.`,
        `wfctl reconstruct abandon --reason "<why this pass is not finishing>"`
      );
    }
    if (!options.weight) {
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        `wfctl work adopt ${bundle} --weight <significant|lightweight> --attested "<what they said>"`,
        definitionFor("opened").demands
      );
    }
    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title ?? bundle,
      weight: options.weight,
      attested,
      members: [bundle],
      sources: [source]
    });
    return ok(
      compose([
        `flow ${flow.id} opened around ${bundle}`,
        [
          "Nothing about where it stopped is carried over. Every gate is walked here,",
          "because a step recorded elsewhere is a check this tool never ran \u2014 and a",
          "flow that reports checks nobody ran is the green gate the review exists to",
          "stop."
        ].join("\n"),
        adoptedCheckpointDemand(bundle),
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
function unsettledNotice(trajectory, settled) {
  const closed = new Set(
    trajectory.events.filter((event) => event.axis === "delivery" && event.settles).map((event) => event.settles)
  );
  const open = trajectory.events.filter(
    (event) => event.axis === "intent" && !closed.has(event.id)
  );
  if (open.length === 0) return void 0;
  return [
    settled ? `${open.length} intent(s) on this subject are still outstanding:` : `This delivery settled nothing. ${open.length} intent(s) on this subject remain outstanding:`,
    ...open.map((event) => `  ${event.id}  ${event.summary}`),
    "",
    "A debt closes when a delivery names the intent it settles, and nothing else",
    "closes it. If one of these is what you just delivered, say so:",
    "",
    `  wfctl trajectory append --subject "${trajectory.subject}" \\`,
    `    --summary "<what the source does now>" --axis delivery --settles <id>`
  ].join("\n");
}
function adoptedCheckpointDemand(bundle) {
  return [
    "Read what is in that record, then write the checkpoint. It is the only",
    "thing a fresh session recovers from, and this flow has none \u2014 everything",
    `known about this work is in changes/active/${bundle}/ and nothing points a`,
    "later session at it.",
    "",
    '  wfctl checkpoint --summary "<what this work is, in one line>" \\',
    '    --handoff "<the substance: what was found, what it rests on, what is open>" \\',
    '    --last "<the last thing actually completed>" \\',
    '    --next "<the exact next action>"'
  ].join("\n");
}
async function workList(context) {
  const { listBundles: listBundles2, renderBundles: renderBundles2 } = await Promise.resolve().then(() => (init_bundles(), bundles_exports));
  return ok(renderBundles2(await listBundles2(context.root)));
}
async function issueCreate(context, options) {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  try {
    assertNotParked(flow);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  if (!options.title.trim()) {
    return refused(
      new GateRefusal("A unit needs a title.", 'wfctl work issue create --title "<what it delivers>"')
    );
  }
  let created = "";
  await mutateFlow(context.root, flow.id, (current) => {
    const id = `U${String(current.issues.length + 1).padStart(3, "0")}`;
    created = id;
    return {
      ...current,
      issues: [
        ...current.issues,
        {
          id,
          title: options.title.trim(),
          status: "open",
          notes: [],
          acceptance: options.acceptance
        }
      ]
    };
  });
  return ok(`${created}  ${options.title.trim()}`);
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
  const bound = await currentFlow(context.root);
  if (!bound) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  try {
    assertNotParked(bound);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  if (!bound.issues.some((issue) => issue.id.toUpperCase() === id.toUpperCase())) {
    return refused(new GateRefusal(`No unit named ${id}.`, "wfctl work issue list"));
  }
  const flow = await mutateFlow(context.root, bound.id, (current) => ({
    ...current,
    issues: current.issues.map(
      (issue) => issue.id.toUpperCase() === id.toUpperCase() ? change(issue) : issue
    )
  }));
  const next = flow.issues.find((issue) => issue.id.toUpperCase() === id.toUpperCase());
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
      const { readRegistry: readRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
      const registered = await readRegistry2(context.root);
      const match = registered.find(
        (entry) => entry.repository === options.repository && entry.worktreeId === options.worktreeId
      );
      if (!match) {
        throw new GateRefusal(
          `${options.repository} (${options.worktreeId}) is not a registered checkout.`,
          `wfctl repo add ${options.repository} --path <dir> --worktree ${options.worktreeId}`,
          registered.length > 0 ? `Registered:
${registered.map((entry) => `  ${entry.repository}  ${entry.worktreeId}  ${entry.path}`).join("\n")}` : "Nothing is registered, so no checkout can be claimed."
        );
      }
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
async function issueDrop(context, options) {
  if (!options.reason.trim()) {
    return refused(
      new GateRefusal(
        "Dropping a unit records why it left the route.",
        `wfctl work issue drop ${options.id} --reason "<why it is not being built>"`,
        "An undated, unexplained drop is indistinguishable from work that was forgotten."
      )
    );
  }
  return withIssue(context, options.id, (issue) => {
    const next = {
      ...issue,
      status: "dropped",
      notes: [...issue.notes, `dropped: ${options.reason.trim()}`]
    };
    delete next.claim;
    return next;
  });
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
  await mkdir8(resolve12(context.root, "changes/inbox"), { recursive: true });
  let path = "";
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = resolve12(context.root, "changes/inbox", `${stamp}${suffix}.md`);
    try {
      await writeFile8(candidate, "", { flag: "wx" });
      path = candidate;
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  if (!path) {
    return refused(
      new GateRefusal("Could not create a capture file.", "wfctl doctor")
    );
  }
  await writeFile8(
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
    assertNotParked(flow);
    assertReached(flow, "verified");
    assertRecall(flow, flow.step);
    const { readReviewArtifact: readReviewArtifact2 } = await Promise.resolve().then(() => (init_review_artifact(), review_artifact_exports));
    const { assertReviewUsable: assertReviewUsable2 } = await Promise.resolve().then(() => (init_verify(), verify_exports));
    const review = await readReviewArtifact2(options.review, context.actor);
    assertReviewUsable2(flow, review);
    await mutateFlow(context.root, flow.id, (current) => ({
      ...current,
      step: "verified",
      steppedAt: (/* @__PURE__ */ new Date()).toISOString(),
      /**
       * The whole artifact, not a count of it.
       *
       * Keeping only totals meant the record could never show what was
       * attacked, which is the one thing a review exists to prove — and the
       * same artifact replayed across four flows in two repositories without
       * anything noticing.
       */
      review: {
        reviewer: review.reviewer,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        attacks: review.attacks,
        findings: review.findings,
        stubSurvivors: review.stubSurvivors,
        fixedPoint: review.fixedPoint,
        source: resolve12(options.review)
      }
    }));
    return ok(
      compose([
        `review accepted from ${review.reviewer}: ${review.attacks.length} attack(s), ${review.findings.length} finding(s)`,
        await guidanceFor(context, "work/closed"),
        'next: wfctl work promotion draft "<area>/<page>.md"   (then: wfctl work close --outcome <completed|partial|abandoned>)'
      ])
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
async function park(context, reason, attested) {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  if (!reason.trim()) {
    return refused(
      new GateRefusal(
        "Parking needs their reason.",
        'wfctl work park --reason "<why starting now is premature>" --attested "<what they said>"'
      )
    );
  }
  if (!attested.trim()) {
    return refused(
      new GateRefusal(
        "A hold is the maintainer's, and nothing here says they placed one.",
        `wfctl work park --reason "${reason.trim()}" --attested "<what they said>"`,
        "This command stops the turn guard from ever firing again on this flow. An agent may not quietly decide that work waits."
      )
    );
  }
  await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    parked: {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      reason: reason.trim(),
      attested: attested.trim()
    }
  }));
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
  await mutateFlow(context.root, flow.id, (current) => {
    const next = { ...current };
    delete next.parked;
    return next;
  });
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
  const unfinished = flow.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "dropped"
  );
  if (unfinished.length > 0) {
    return refused(
      new GateRefusal(
        `${unfinished.length} unit(s) are not terminal.`,
        `wfctl work issue complete ${unfinished[0]?.id}`,
        `${unfinished.map((issue) => `  ${issue.id}  ${issue.status}  ${issue.title}`).join("\n")}

Drop one deliberately if it left the route: wfctl work issue drop <id> --reason "<why>"`
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
    await mutateFlow(context.root, flow.id, (current) => ({
      ...current,
      step: "closed",
      steppedAt: (/* @__PURE__ */ new Date()).toISOString(),
      closedAt: (/* @__PURE__ */ new Date()).toISOString(),
      outcome: options.outcome
    }));
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
  const { listQueue: listQueue2, promote: movePages, readOutcome: readOutcome2 } = await Promise.resolve().then(() => (init_promotion_queue(), promotion_queue_exports));
  const { appendEvent: appendEvent2, renderTrajectory: renderTrajectory2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
  const queued = await listQueue2(context.root);
  if (queued.length === 0) {
    return refused(
      new GateRefusal("Nothing is waiting to be promoted.", "wfctl work promotion list")
    );
  }
  const bundle = options.bundle ?? (queued.length === 1 ? queued[0] : void 0);
  if (!bundle) {
    return refused(
      new GateRefusal(
        `${queued.length} records are waiting; name the one they answered about.`,
        `wfctl work promote --bundle ${queued[0]} --subject "<...>" --summary "<...>"`,
        queued.map((id) => `  ${id}`).join("\n")
      )
    );
  }
  if (!queued.includes(bundle)) {
    return refused(
      new GateRefusal(
        `${bundle} is not waiting to be promoted.`,
        "wfctl work promotion list",
        queued.map((id) => `  ${id}`).join("\n")
      )
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
    const { assertPromotable: assertPromotable2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
    const { inspectPage: inspectPage2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
    const { readdir: readdir10 } = await import("node:fs/promises");
    const drafts = resolve12(context.root, "changes/promotion", bundle, "promotion");
    const entries = await readdir10(drafts, { recursive: true, withFileTypes: true }).catch(() => []);
    const issues = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = resolve12(entry.parentPath ?? drafts, entry.name);
      const body = await readFile10(path, "utf8");
      issues.push(...inspectPage2(path.slice(drafts.length + 1), body));
    }
    assertPromotable2(issues);
    const outcome = await readOutcome2(context.root, bundle);
    const trajectory = await appendEvent2(context.root, options.subject, {
      summary: outcome === "abandoned" ? `abandoned: ${options.summary.trim() || options.subject.trim()}` : options.summary.trim() || options.subject.trim(),
      axis: outcome === "abandoned" ? "intent" : "delivery",
      claims: [],
      change: bundle,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      ...options.settles ? { settles: options.settles } : {}
    });
    const result = await movePages({ knowledgeRoot: context.root, bundleId: bundle });
    return ok(
      compose([
        `${result.pages.length} page(s) now in curated knowledge:`,
        result.pages.map((page) => `  knowledge/${page}`).join("\n"),
        `${bundle} archived at:
${result.archived}`,
        renderTrajectory2(trajectory),
        unsettledNotice(trajectory, options.settles)
      ])
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
var init_commands = __esm({
  "src/core/commands.ts"() {
    "use strict";
    init_checkpoint();
    init_gates();
    init_guidance();
    init_flow();
    init_paths();
    init_recall();
    init_steps();
  }
});

// src/core/install.ts
var install_exports = {};
__export(install_exports, {
  FLOWS_DIR: () => FLOWS_DIR,
  GUARD_CHOICES: () => GUARD_CHOICES,
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
  disabledGuards: () => disabledGuards,
  guardStatus: () => guardStatus,
  installHooks: () => installHooks,
  installManagedBlock: () => installManagedBlock,
  planInstall: () => planInstall,
  readInstallState: () => readInstallState,
  renderGuards: () => renderGuards,
  setGuard: () => setGuard
});
import { createHash as createHash3 } from "node:crypto";
import { chmod, mkdir as mkdir9, readFile as readFile11, readdir as readdir7, stat as stat3, writeFile as writeFile9 } from "node:fs/promises";
import { dirname as dirname9, join as join6, relative as relative4, resolve as resolve13 } from "node:path";
function hash(content) {
  return createHash3("sha256").update(content).digest("hex");
}
async function readIfPresent(path) {
  try {
    return await readFile11(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function collect(root, prefix = "") {
  const entries = await readdir7(join6(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? join6(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collect(root, rel));
      continue;
    }
    files.push({ path: rel, content: await readFile11(join6(root, rel), "utf8") });
  }
  return files;
}
async function readInstallState(target) {
  const raw = await readIfPresent(resolve13(target, ".workflow/state.json"));
  return raw ? JSON.parse(raw) : void 0;
}
async function planInstall(options) {
  const state = await readInstallState(options.target);
  const operations = [];
  const edited = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve13(options.target, directory);
    const present = await stat3(path).then(
      (entry) => entry.isDirectory(),
      () => false
    );
    if (!present) operations.push({ kind: "create-directory", path: directory });
  }
  const installable = [];
  for (const file of await collect(resolve13(options.distribution, "templates/runtime"))) {
    installable.push({ path: join6(RUNTIME_DIR, file.path), content: file.content });
  }
  for (const file of await collect(resolve13(options.distribution, "templates/skill/wfctl"))) {
    for (const directory of SKILL_DIRS) {
      installable.push({ path: join6(directory, file.path), content: file.content });
    }
  }
  installable.push({
    path: ".workflow/.gitignore",
    content: await readFile11(resolve13(options.distribution, "templates/workflow/gitignore"), "utf8")
  });
  for (const file of installable) {
    const rel = file.path;
    const current = await readIfPresent(resolve13(options.target, rel));
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
  const shipped = new Set(installable.map((file) => file.path));
  const obsolete = [];
  for (const rel of Object.keys(state?.files ?? {})) {
    if (shipped.has(rel)) continue;
    if (await readIfPresent(resolve13(options.target, rel)) === void 0) continue;
    obsolete.push(rel);
  }
  obsolete.push(...await strandedSkills(options.target));
  return { target: options.target, operations, edited, obsolete: obsolete.sort() };
}
async function strandedSkills(target) {
  const found = [];
  const parents = new Set(SKILL_DIRS.map((directory) => dirname9(directory)));
  const ours = new Set(SKILL_DIRS.map((directory) => directory.split("/").pop()));
  for (const parent of parents) {
    let entries;
    try {
      entries = await readdir7(resolve13(target, parent), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ours.has(entry.name)) continue;
      found.push(join6(parent, entry.name));
    }
  }
  if (await readIfPresent(resolve13(target, "skills-lock.json")) !== void 0) {
    found.push("skills-lock.json");
  }
  return found.sort();
}
async function applyInstall(plan, options) {
  const result = {
    written: [],
    created: [],
    skipped: [],
    conflicts: [],
    obsolete: plan.obsolete,
    replacedHooks: []
  };
  const state = await readInstallState(plan.target) ?? {
    schemaVersion: INSTALL_SCHEMA_VERSION,
    installedVersion: options.version,
    files: {}
  };
  state.installedVersion = options.version;
  for (const operation of plan.operations) {
    const absolute = resolve13(plan.target, operation.path);
    if (operation.kind === "create-directory") {
      await mkdir9(absolute, { recursive: true });
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
    const source = operation.path === ".workflow/.gitignore" ? resolve13(options.distribution, "templates/workflow/gitignore") : runtime ? resolve13(options.distribution, "templates/runtime", relative4(RUNTIME_DIR, operation.path)) : resolve13(
      options.distribution,
      "templates/skill/wfctl",
      relative4(skillDir ?? "", operation.path)
    );
    const content = await readFile11(source, "utf8");
    await mkdir9(dirname9(absolute), { recursive: true });
    await writeFile9(absolute, content, "utf8");
    if (runtime) await chmod(absolute, 493);
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }
  await mkdir9(resolve13(plan.target, ".workflow"), { recursive: true });
  await writeFile9(
    resolve13(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}
`,
    "utf8"
  );
  result.replacedHooks = await installHooks(plan.target);
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
  return withLock(resolve13(target, ".claude/settings.json"), () => installHooksLocked(target));
}
function looksInstalled(command) {
  return /(^|[;&|\s])wfctl\s/.test(command) || command.includes(`$CLAUDE_PROJECT_DIR/${RUNTIME_DIR}/`);
}
async function installHooksLocked(target) {
  const path = resolve13(target, ".claude/settings.json");
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
  const commandsOf = (entry) => {
    const hooks2 = entry?.hooks;
    if (!Array.isArray(hooks2) || hooks2.length === 0) return [];
    return hooks2.map((hook) => hook?.command).filter((command) => typeof command === "string");
  };
  const isOurs = (entry) => {
    const commands = commandsOf(entry);
    if (commands.length === 0) return false;
    return commands.every((command) => ourCommands.has(command) || looksInstalled(command));
  };
  const replaced = [];
  const off = new Set(await disabledGuards(target));
  const skip = new Set(
    [...off].map((guard) => guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard}.mjs`)
  );
  const hooks = { ...existingHooks ?? {} };
  for (const [event, entries] of Object.entries(HOOK_SETTINGS.hooks)) {
    const current = hooks[event];
    const mine = (Array.isArray(current) ? current : []).filter((entry) => isOurs(entry));
    for (const entry of mine) {
      for (const command of commandsOf(entry)) {
        if (!ourCommands.has(command)) replaced.push(`${event}: ${command}`);
      }
    }
    const theirs = (Array.isArray(current) ? current : []).filter((entry) => !isOurs(entry));
    const ours = entries.filter(
      (entry) => !entry.hooks.some((hook) => [...skip].some((name) => hook.command.includes(name)))
    );
    hooks[event] = [...theirs, ...ours];
  }
  settings.hooks = hooks;
  await mkdir9(dirname9(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}
`);
  return replaced;
}
async function installManagedBlock(target, distribution) {
  const body = (await readFile11(resolve13(distribution, "templates/agents/managed.md"), "utf8")).trim();
  const block = `${MANAGED_BEGIN}
${body}
${MANAGED_END}
`;
  const written = /* @__PURE__ */ new Set();
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve13(target, name);
    const real = canonical(path);
    if (written.has(real)) continue;
    written.add(real);
    const existing = await readIfPresent(path);
    if (existing === void 0) {
      await writeFile9(path, block, "utf8");
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
      await writeFile9(path, next, "utf8");
      continue;
    }
    await writeFile9(path, `${existing.trimEnd()}

${block}`, "utf8");
  }
}
async function readSettings(target) {
  const raw = await readIfPresent(resolve13(target, ".claude/settings.json"));
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GateRefusal(
      `${resolve13(target, ".claude/settings.json")} is not valid JSON.`,
      "Repair the file, then try again."
    );
  }
  if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
    throw new GateRefusal(
      `${resolve13(target, ".claude/settings.json")} is not a JSON object.`,
      "Repair the file, then try again."
    );
  }
  return parsed;
}
async function guardStatus(target) {
  const settings = await readSettings(target);
  const hooks = settings.hooks ?? {};
  const choices = await readGuardChoices(target);
  return GUARD_NAMES.map((guard) => {
    const { event, matcher, describes } = GUARD_EVENTS[guard];
    const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
    const armed = entries.some(
      (entry) => entry.matcher === matcher && (entry.hooks ?? []).some((hook) => (hook.command ?? "").includes(scriptFor(guard)))
    );
    const installed = choices[guard] === false ? false : armed;
    return { guard, installed, describes };
  });
}
function scriptFor(guard) {
  return guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard}.mjs`;
}
async function setGuard(target, guard, enabled) {
  return withLock(
    resolve13(target, ".claude/settings.json"),
    () => setGuardLocked(target, guard, enabled)
  );
}
async function setGuardLocked(target, guard, enabled) {
  const path = resolve13(target, ".claude/settings.json");
  const settings = await readSettings(target);
  const hooks = { ...settings.hooks ?? {} };
  const { event, matcher } = GUARD_EVENTS[guard];
  const script = scriptFor(guard);
  const entries = Array.isArray(hooks[event]) ? [...hooks[event]] : [];
  const ourCommand = (HOOK_SETTINGS.hooks[event] ?? []).flatMap((entry) => entry.hooks.map((hook) => hook.command)).find((command) => command.includes(script));
  const isThisGuard = (entry) => (entry?.hooks ?? []).some(
    (hook) => hook.command === ourCommand
  );
  const others = entries.filter((entry) => !isThisGuard(entry));
  await recordGuardChoice(target, guard, enabled);
  if (!enabled) {
    hooks[event] = others;
    settings.hooks = hooks;
    await mkdir9(dirname9(path), { recursive: true });
    await writeAtomic(path, `${JSON.stringify(settings, null, 2)}
`);
    return `${guard} guard off, and it stays off across upgrades.`;
  }
  const ours = HOOK_SETTINGS.hooks[event]?.find(
    (entry) => isThisGuard(entry)
  );
  if (!ours) {
    throw new GateRefusal(`No installed definition for the ${guard} guard.`, "wfctl init knowledge");
  }
  hooks[event] = [...others, ours];
  settings.hooks = hooks;
  await mkdir9(dirname9(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}
`);
  return `${guard} guard on. Restart the session for it to take effect.`;
}
async function readGuardChoices(target) {
  const raw = await readIfPresent(resolve13(target, GUARD_CHOICES));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function recordGuardChoice(target, guard, enabled) {
  const choices = { ...await readGuardChoices(target), [guard]: enabled };
  const path = resolve13(target, GUARD_CHOICES);
  await mkdir9(dirname9(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(choices, null, 2)}
`);
}
async function disabledGuards(target) {
  const choices = await readGuardChoices(target);
  return GUARD_NAMES.filter((guard) => choices[guard] === false);
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
var MANAGED_BEGIN, MANAGED_END, HOOK_SETTINGS, INSTALL_SCHEMA_VERSION, RUNTIME_DIR, SKILL_DIRS, FLOWS_DIR, KNOWLEDGE_DIRECTORIES, GUARD_NAMES, GUARD_EVENTS, GUARD_CHOICES;
var init_install = __esm({
  "src/core/install.ts"() {
    "use strict";
    init_gates();
    init_paths_resolve();
    init_lock();
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
    GUARD_CHOICES = ".workflow/guards.json";
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
import { stat as stat4 } from "node:fs/promises";
import { resolve as resolve14, sep as sep3 } from "node:path";
async function inspectLeaf(entry, now = /* @__PURE__ */ new Date()) {
  const base = {
    repository: entry.repository,
    worktreeId: entry.worktreeId,
    checkout: entry.checkout,
    path: entry.path,
    graph: "unreachable"
  };
  const reachable = await stat4(entry.path).then(
    (found) => found.isDirectory(),
    () => false
  );
  if (!reachable) return base;
  const graph = await stat4(resolve14(entry.path, GRAPH_PATH)).catch(() => void 0);
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
function assertTraversable(leaves, target) {
  const relevant = target ? leaves.filter((leaf) => contains(leaf.path, target)) : leaves;
  const blocked = relevant.filter((leaf) => leaf.graph === "missing" || leaf.graph === "unreachable");
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
    return `${leaf.graph.padEnd(11)} ${age.padEnd(5)} ${leaf.repository}  ${label(leaf).padEnd(14)}  ${leaf.path}`;
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
  const target = resolve14(options.target);
  if (options.knowledgeRoot) {
    const base = resolve14(options.knowledgeRoot);
    if (target === base || target.startsWith(`${base}${sep3}`)) return;
  }
  const containing = options.leaves.find((leaf) => contains(leaf.path, target));
  if (!containing) {
    throw new GateRefusal(
      `${options.target} is not inside any registered repository.`,
      "wfctl repo add <owner/name> --path <dir> [--worktree <id>]",
      options.leaves.length === 0 ? "Nothing is registered, so there is nowhere this write could legitimately land." : `Registered:
${options.leaves.map((leaf) => `  ${leaf.repository}  ${label(leaf)}  ${leaf.path}`).join("\n")}`
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
    init_paths_resolve();
    init_registry();
    GRAPH_PATH = "graphify-out/graph.json";
    STALE_AFTER_DAYS = 30;
  }
});

// src/core/write-hook.ts
var write_hook_exports = {};
__export(write_hook_exports, {
  decideWrite: () => decideWrite
});
import { relative as relative5, resolve as resolve15 } from "node:path";
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
  if (contains(knowledgeRoot, target)) return {};
  const claimed = flow.issues.find((issue) => issue.status === "claimed")?.claim;
  try {
    assertInsideClaim({
      target,
      knowledgeRoot,
      leaves: input.leaves ?? [],
      ...claimed ? { claim: { repository: claimed.repository, worktreeId: claimed.worktreeId } } : {}
    });
  } catch (error) {
    if (error instanceof GateRefusal) return { refusal: error };
    throw error;
  }
  const normalized = normalize2(knowledgeRoot, target);
  const first = input.writtenThisUnit.length === 0;
  const covered = flow.recall.covered.some(
    (entry) => normalize2(knowledgeRoot, entry) === normalized
  );
  if (!first && covered) return {};
  if (first && (flow.recall.counters.graphify ?? 0) === 0) {
    try {
      assertTraversable(input.leaves ?? [], target);
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
function normalize2(root, path) {
  const absolute = resolve15(root, path);
  return relative5(root, absolute) || absolute;
}
var init_write_hook = __esm({
  "src/core/write-hook.ts"() {
    "use strict";
    init_leaves();
    init_paths();
    init_recall();
    init_gates();
    init_paths_resolve();
  }
});

// src/core/debts.ts
var debts_exports = {};
__export(debts_exports, {
  collectDebts: () => collectDebts,
  renderDebts: () => renderDebts
});
async function collectDebts(root) {
  const gaps = (await listTrajectories(root)).map((trajectory) => deriveGap(trajectory));
  return {
    delivery: gaps.filter((gap) => gap.delivery.length > 0),
    direction: gaps.filter((gap) => gap.direction.length > 0)
  };
}
function renderDebts(report) {
  if (report.delivery.length === 0 && report.direction.length === 0) {
    return [
      "No gaps.",
      "",
      "Either everything recorded is delivered, or nothing has been re-read since",
      "it changed. A gap dies when the subject is read again at a new revision \u2014",
      "never because somebody said the work was done."
    ].join("\n");
  }
  const lines = [];
  if (report.delivery.length > 0) {
    lines.push("Accepted and not delivered:", "");
    for (const gap of report.delivery) {
      lines.push(`  ${gap.subject}`);
      for (const item of gap.delivery) lines.push(`    ${item}`);
    }
    lines.push("");
  }
  if (report.direction.length > 0) {
    lines.push("Declared direction not yet reached:", "");
    for (const gap of report.direction) {
      lines.push(`  ${gap.subject}`);
      for (const item of gap.direction) lines.push(`    ${item}`);
    }
    lines.push("");
  }
  lines.push(
    "Each becomes work the ordinary way \u2014 put it to the maintainer and open a",
    "flow. Grouping several of these by the outcome that would close them",
    "usually turns the list into one decision."
  );
  return lines.join("\n");
}
var init_debts = __esm({
  "src/core/debts.ts"() {
    "use strict";
    init_trajectory();
  }
});

// src/core/decided.ts
var decided_exports = {};
__export(decided_exports, {
  findDecisions: () => findDecisions,
  renderDecisions: () => renderDecisions
});
import { readFile as readFile12, readdir as readdir8 } from "node:fs/promises";
import { join as join7, relative as relative6, resolve as resolve16 } from "node:path";
function terms(subject) {
  const words = subject.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 0);
  const meaningful2 = words.filter((term) => !FILLER.has(term));
  return meaningful2.length > 0 ? meaningful2 : words;
}
function score(body, want) {
  const text = body.toLowerCase();
  return want.filter((term) => text.includes(term)).length;
}
function excerpt(body, want) {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  const best = lines.map((line) => ({ line: line.trim(), hits: score(line, want) })).filter((entry) => entry.hits > 0).sort((left, right) => right.hits - left.hits)[0];
  return best?.line.replace(/^[-*#>|\s]+/, "").slice(0, 300) ?? "";
}
async function adjudications(root) {
  const { RECONSTRUCTION_ARCHIVE: RECONSTRUCTION_ARCHIVE2, RECONSTRUCTION_DIR: RECONSTRUCTION_DIR2 } = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
  const out = [];
  for (const dir of [RECONSTRUCTION_DIR2, RECONSTRUCTION_ARCHIVE2]) {
    let cases = [];
    try {
      cases = (await readdir8(resolve16(root, dir), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      continue;
    }
    for (const id of cases) {
      const path = join7(dir, id, "case.json");
      let record;
      try {
        record = JSON.parse(await readFile12(resolve16(root, path), "utf8"));
      } catch {
        continue;
      }
      const contradictions = Array.isArray(record.contradictions) ? record.contradictions : [];
      for (const entry of contradictions) {
        const resolution = entry.resolution?.trim();
        if (!resolution) continue;
        out.push({
          subject: entry.subject ?? "",
          resolution,
          path,
          ...record.startedAt ? { at: record.startedAt.slice(0, 10) } : {}
        });
      }
    }
  }
  return out;
}
async function walk(root, dir) {
  const base = resolve16(root, dir);
  try {
    const entries = await readdir8(base, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => relative6(root, join7(entry.parentPath ?? base, entry.name)));
  } catch {
    return [];
  }
}
async function findDecisions(root, subject) {
  const want = terms(subject);
  if (want.length === 0) return [];
  const found = [];
  for (const lane of LANES) {
    for (const path of await walk(root, lane.dir)) {
      const body = await readFile12(resolve16(root, path), "utf8").catch(() => "");
      if (score(body, want) < Math.min(2, want.length)) continue;
      const said = excerpt(body, want);
      if (!said) continue;
      const at = /\b(20\d{2}-\d{2}-\d{2})/.exec(body)?.[1];
      found.push({ where: lane.label, said, path, ...at ? { at } : {} });
    }
  }
  for (const adjudication of await adjudications(root)) {
    if (score(`${adjudication.subject} ${adjudication.resolution}`, want) === 0) continue;
    found.push({
      where: "an adjudicated contradiction",
      said: adjudication.resolution,
      path: adjudication.path,
      ...adjudication.at ? { at: adjudication.at } : {}
    });
  }
  for (const trajectory of await listTrajectories(root)) {
    if (score(trajectory.subject, want) === 0) continue;
    for (const event of trajectory.events.filter((entry) => entry.axis === "vision")) {
      found.push({
        where: "a declared direction",
        said: event.summary,
        path: `trajectories/${trajectory.id}.json`,
        ...event.at ? { at: event.at.slice(0, 10) } : {}
      });
    }
  }
  return found;
}
function renderDecisions(subject, decisions) {
  if (decisions.length === 0) {
    return [
      `Nothing recorded about "${subject}".`,
      "",
      "That is a real answer: it means nobody has settled this, so it is a",
      "question worth their turn. Say so when you ask, rather than asking as",
      "though you had not looked."
    ].join("\n");
  }
  return [
    `${decisions.length} place(s) already say something about "${subject}":`,
    "",
    ...decisions.map(
      (decision) => [
        `${decision.at ?? "undated"}  ${decision.where}`,
        `  "${decision.said}"`,
        `  ${decision.path}`
      ].join("\n")
    ),
    "",
    "Cite the promoted page where there is one and the record where there is not,",
    "and say which. Asking again spends their turn on your bookkeeping."
  ].join("\n");
}
var LANES, FILLER;
var init_decided = __esm({
  "src/core/decided.ts"() {
    "use strict";
    init_trajectory();
    LANES = [
      { dir: "knowledge", label: "a curated page" },
      { dir: "changes/active", label: "an open record" },
      { dir: "changes/promotion", label: "a record awaiting promotion" },
      { dir: "changes/archive", label: "a closed record" },
      { dir: "changes/inbox", label: "a capture" }
    ];
    FILLER = /* @__PURE__ */ new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "of",
      "for",
      "to",
      "in",
      "on",
      "is",
      "it",
      "we",
      "our",
      "be",
      "do",
      "does",
      "how",
      "what",
      "why",
      "should"
    ]);
  }
});

// src/core/doctor.ts
var doctor_exports = {};
__export(doctor_exports, {
  exitCodeFor: () => exitCodeFor,
  renderReport: () => renderReport,
  runDoctor: () => runDoctor
});
import { spawnSync as spawnSync2 } from "node:child_process";
import { access, readFile as readFile13, readdir as readdir9, stat as stat5 } from "node:fs/promises";
import { resolve as resolve17 } from "node:path";
async function exists2(path) {
  return access(path).then(
    () => true,
    () => false
  );
}
async function runDoctor(targetInput, options = {}) {
  const target = resolve17(targetInput);
  const runner = options.runner ?? run;
  const checks = [];
  let state;
  try {
    state = await readInstallState(target);
  } catch (error) {
    checks.push({
      name: "installation",
      status: "fail",
      message: `.workflow/state.json cannot be read: ${error.message}`,
      remedy: "wfctl init knowledge   (after moving the unreadable file aside)"
    });
    return { target, checks };
  }
  if (!state) {
    checks.push({
      name: "installation",
      status: "fail",
      message: "This is not an initialized knowledge repository",
      remedy: "wfctl init knowledge"
    });
    return { target, checks };
  }
  if (typeof state.files !== "object" || state.files === null) {
    checks.push({
      name: "installation",
      status: "fail",
      message: ".workflow/state.json has no file record, so nothing owned can be checked",
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
    if (!await exists2(resolve17(target, path))) missing.push(path);
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
    const found = await stat5(resolve17(target, directory)).then(
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
    const skill = resolve17(target, directory, "SKILL.md");
    const present = await exists2(skill);
    const frontmatter2 = present ? (await readFile13(skill, "utf8")).startsWith("---\nname: wfctl") : false;
    checks.push({
      name: `skill:${directory.split("/")[0]}`,
      status: present && frontmatter2 ? "pass" : "fail",
      message: present ? frontmatter2 ? "Installed" : "Present but its frontmatter is not wfctl's" : "Missing \u2014 the agent has no entry point",
      ...present && frontmatter2 ? {} : { remedy: "wfctl init knowledge" }
    });
  }
  const block = await readFile13(resolve17(target, "AGENTS.md"), "utf8").catch(() => "");
  checks.push({
    name: "managed-block",
    status: block.includes("wfctl:begin") ? "pass" : "fail",
    message: block.includes("wfctl:begin") ? "Present in AGENTS.md" : "Absent \u2014 nothing points the agent at the skill",
    ...block.includes("wfctl:begin") ? {} : { remedy: "wfctl init knowledge" }
  });
  let guards = [];
  try {
    guards = await guardStatus(target);
  } catch (error) {
    checks.push({
      name: "guards",
      status: "fail",
      message: `.claude/settings.json cannot be read: ${error.message}`,
      remedy: "Repair the file, then: wfctl init knowledge"
    });
  }
  for (const guard of guards) {
    const script = await exists2(
      resolve17(target, RUNTIME_DIR, guard.guard === "bash" ? "guard-background-bash.mjs" : `guard-${guard.guard}.mjs`)
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
  const { collectPages: collectPages2, validateCurated: validateCurated2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const pages = await collectPages2(target);
  if (pages.length === 0) {
    checks.push({
      name: "curated-knowledge",
      status: "warn",
      message: "Empty; nothing has been recorded about this project yet",
      remedy: "wfctl reconstruct start"
    });
  } else {
    const issues = await validateCurated2(target);
    checks.push({
      name: "curated-knowledge",
      status: issues.length > 0 ? "fail" : "pass",
      message: issues.length > 0 ? `${pages.length} page(s), ${issues.length} structural problem(s)` : `${pages.length} page(s), all structurally valid`,
      ...issues.length > 0 ? { remedy: "wfctl knowledge validate" } : {}
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
  const inbox = await readdir9(resolve17(target, "changes/inbox")).catch(() => []);
  const captures = inbox.filter((entry) => entry.endsWith(".md"));
  checks.push({
    name: "capture-inbox",
    status: captures.length > 0 ? "warn" : "pass",
    message: captures.length > 0 ? `${captures.length} unresolved capture(s); a queue nobody opens is the same as no queue` : "Empty",
    ...captures.length > 0 ? { remedy: "Route or discard each one" } : {}
  });
  const queued = await readdir9(resolve17(target, "changes/promotion")).catch(() => []);
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
    const head2 = `${symbol[check.status]}  ${check.name.padEnd(28)} ${check.message}`;
    return check.status === "pass" || !check.remedy ? head2 : `${head2}
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
      const result = spawnSync2(command, args, {
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
init_commands();
init_gates();
import { existsSync, realpathSync as realpathSync2 } from "node:fs";
import { readFile as readFile14 } from "node:fs/promises";
import { dirname as dirname12, resolve as resolve18 } from "node:path";
import { fileURLToPath } from "node:url";

// src/core/flags.ts
init_gates();
var NONE = { value: [], boolean: [] };
var COMMAND_FLAGS = {
  "brief": { value: [], boolean: ["json"] },
  "handoff": NONE,
  "checkpoint": { value: ["summary", "handoff", "last", "next", "todo"], boolean: [] },
  "work start": { value: ["title", "weight", "attested", "from"], boolean: [] },
  "work adopt": { value: ["attested", "weight", "title", "from"], boolean: [] },
  "work list": NONE,
  "work step": NONE,
  "work issue create": { value: ["title", "satisfies"], boolean: [] },
  "work issue list": NONE,
  "work issue note": { value: ["note"], boolean: [] },
  "work issue claim": { value: ["repository", "worktree"], boolean: [] },
  "work issue complete": NONE,
  "work issue drop": { value: ["reason"], boolean: [] },
  "work park": { value: ["reason", "attested"], boolean: [] },
  "work release": { value: ["attested"], boolean: [] },
  "work verify": { value: ["review"], boolean: [] },
  "work close": { value: ["outcome"], boolean: [] },
  "work promote": { value: ["subject", "summary", "bundle", "settles"], boolean: [] },
  "work promotion draft": NONE,
  "work promotion list": NONE,
  "capture": { value: [], boolean: ["awaits"] },
  "repo add": { value: ["path", "worktree", "checkout"], boolean: [] },
  "repo list": NONE,
  "repo remove": { value: ["worktree"], boolean: [] },
  "reconstruct start": NONE,
  "reconstruct status": NONE,
  "reconstruct scope": {
    value: ["repository", "revision", "raw", "in", "not"],
    boolean: []
  },
  "reconstruct read": { value: ["at"], boolean: [] },
  "reconstruct exclude": { value: ["reason"], boolean: [] },
  "reconstruct contradiction": { value: ["subject", "side"], boolean: [] },
  "reconstruct resolve": { value: ["resolution"], boolean: [] },
  "reconstruct subject": NONE,
  "reconstruct probe": {
    value: ["question", "page", "asker", "answer"],
    boolean: ["passed"]
  },
  "reconstruct stage": NONE,
  "reconstruct abandon": { value: ["reason"], boolean: [] },
  "reconstruct close": NONE,
  "trajectory append": {
    value: ["subject", "summary", "axis", "claim", "at", "change", "settles"],
    boolean: []
  },
  "trajectory list": NONE,
  "trajectory show": NONE,
  "recall list": NONE,
  "recall answer": { value: ["answer", "route", "source"], boolean: [] },
  "recall route": { value: ["covered"], boolean: [] },
  "flow close": NONE,
  "init": { value: ["target"], boolean: [] },
  "guide": NONE,
  "debts": NONE,
  "decided": NONE,
  "knowledge validate": { value: ["page"], boolean: [] },
  "knowledge hash": { value: ["page"], boolean: [] },
  "doctor": NONE,
  "guards": NONE,
  "hook write": { value: ["target"], boolean: [] },
  "help": NONE
};
var ANYWHERE = /* @__PURE__ */ new Map();
for (const [command, spec] of Object.entries(COMMAND_FLAGS)) {
  for (const name of [...spec.value, ...spec.boolean]) {
    ANYWHERE.set(name, [...ANYWHERE.get(name) ?? [], command]);
  }
}
function resolveCommand(argv) {
  for (let length = Math.min(3, argv.length); length >= 1; length -= 1) {
    const key = argv.slice(0, length).join(" ");
    const spec = COMMAND_FLAGS[key];
    if (spec) return { key, spec };
  }
  return void 0;
}
function flagName(token) {
  return token.slice(2).split("=")[0] ?? "";
}
var FLAG_SHAPED = /^--[a-z][a-z0-9-]*(=.*)?$/;
function isCaptureBody(argv, index) {
  if (argv[0] !== "capture" || index === 0) return false;
  return !FLAG_SHAPED.test(argv[index] ?? "");
}
function normalize(argv) {
  const resolved = resolveCommand(argv);
  if (!resolved) return argv;
  const { spec } = resolved;
  const out = [];
  for (const [index, token] of argv.entries()) {
    if (!token.startsWith("--") || !token.includes("=") || isCaptureBody(argv, index)) {
      out.push(token);
      continue;
    }
    const name = flagName(token);
    const value = token.slice(name.length + 3);
    if (spec.boolean.includes(name)) {
      throw new GateRefusal(
        `--${name} takes no value.`,
        `--${name}`,
        `It was given as ${token}. Its presence is the whole meaning; a value attached to it is read by nobody.`
      );
    }
    if (spec.value.includes(name)) {
      if (!value) {
        throw new GateRefusal(`--${name} was given without a value.`, `--${name} "<value>"`);
      }
      out.push(`--${name}`, value);
      continue;
    }
    out.push(token);
  }
  return out;
}
function validate(argv) {
  const resolved = resolveCommand(argv);
  if (!resolved) return;
  const { key, spec } = resolved;
  const unknown = [];
  for (const [index, token] of argv.entries()) {
    if (!token.startsWith("--") || isCaptureBody(argv, index)) continue;
    const name = flagName(token);
    if (!name || spec.value.includes(name) || spec.boolean.includes(name)) continue;
    unknown.push(name);
  }
  if (unknown.length === 0) return;
  const detail = unknown.map((name) => {
    const elsewhere = ANYWHERE.get(name);
    return elsewhere ? `  --${name} belongs to: ${elsewhere.join(", ")}` : `  --${name} is read by no command`;
  }).join("\n");
  throw new GateRefusal(
    `${key} does not read ${unknown.map((name) => `--${name}`).join(", ")}.`,
    "wfctl help",
    `${detail}

A flag nobody reads is a command running with a meaning you did not intend.`
  );
}

// src/core/cli.ts
init_recall();
init_install();
init_promotion_queue();
init_types();
var USAGE = `wfctl \u2014 project workflow

  brief [--json]               the state of this repository, and what awaits whom
  handoff [<flow>]             the full recall body for a flow
  checkpoint --summary ... --handoff ... --last ... --next ...

  work start --title ... --weight <significant|lightweight>
             --attested "<what the maintainer said>" [--from <where it came from>]
  work adopt <bundle> --attested "<what they said>"
             [--weight <significant|lightweight>] [--title ...] [--from <where>]
  work list                    every bundle, and whether anything can reach it
  work step <step>             record that this step is reached
  work issue create --title ... [--satisfies AC-01]...
  work issue list | note <id> --note ... | claim <id> --repository ... --worktree ...
  work issue complete <id> | drop <id> --reason "<why it left the route>"
  work park --reason ... --attested "<their words>"
  work release --attested "<their words>"
  work verify --review <artifact>
  work close --outcome <completed|partial|abandoned>
  work promote --subject "<product subject>" --summary "<what it now does>"
               [--bundle <record>] [--settles <event-id>]
  work promotion draft <page>  create a page draft at the path it will occupy
  work promotion list          records waiting on the maintainer

  capture "<what you found>" [--awaits]

  repo add <owner/name> --path <dir> [--worktree <id>] [--checkout <name>]
  repo list | repo remove <owner/name> [--worktree <id>]

  reconstruct start            open a case over the registered repositories
  reconstruct status
  reconstruct scope --repository <owner/name> [--revision <sha>] [--raw all|selected|none] [--in <path>]...
  reconstruct read <path> [--at <owner/name>]   record a read, or print the file at the pinned revision
  reconstruct exclude <path> --reason "<why>"
  reconstruct contradiction --subject ... --side ... --side ...
  reconstruct resolve <id> --resolution "<what they decided>"
  reconstruct subject <trajectory-id>
  reconstruct probe --question ... --page <path> --asker <agent> [--passed]
  reconstruct stage            advance when this stage's gate passes
  reconstruct abandon --reason "<why>"
  reconstruct close

  trajectory append --subject ... --summary ... --axis <intent|delivery|vision>
                    [--settles <event-id>]   a delivery names the intent it settles
  trajectory list | trajectory show <subject>

  recall list                  the checklist
  recall answer <item> --answer ... --route ... --source ...
  recall route <route> --covered <path> [--covered <path>]...

  flow close [<flow-id>]       flush the checkpoint and drop the fence

  init knowledge [--target <dir>]

  guide [<topic>]              detail for one topic, when the state needs it

  debts                        what is accepted and not delivered, across every subject
  decided "<subject>"          what has already been settled about it, and where
  knowledge validate [--page <path>]
  knowledge hash <path>

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
  if (argv.includes("--help")) {
    return { stdout: USAGE, exitCode: 0 };
  }
  let scanned;
  try {
    scanned = normalize(argv);
    validate(scanned);
  } catch (error) {
    if (error instanceof GateRefusal) {
      return { stdout: error.render(), exitCode: 2 };
    }
    throw error;
  }
  const [group, ...rest] = scanned;
  try {
    switch (group) {
      case void 0:
      case "help":
        return { stdout: USAGE, exitCode: 0 };
      case "brief": {
        if (rest.includes("--json")) {
          const { listFlows: listFlows2, currentFlowId: currentFlowId2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
          const { deriveBlocker: deriveBlocker2 } = await Promise.resolve().then(() => (init_steps(), steps_exports));
          const flows = (await listFlows2(context.root)).filter((flow) => !flow.closedAt);
          const current = await currentFlowId2(context.root);
          const { briefExtras: briefExtras2 } = await Promise.resolve().then(() => (init_commands(), commands_exports));
          const extras = await briefExtras2(context);
          const signals = flows.flatMap((flow) => {
            const blocker = deriveBlocker2(flow);
            return blocker ? [{ id: flow.id, awaits: blocker.awaits, summary: blocker.summary, remedy: blocker.remedy }] : [];
          });
          for (const id of extras.queued) {
            signals.push({
              id,
              awaits: "maintainer",
              summary: "waits in the promotion queue",
              remedy: 'wfctl work promote --subject "<product subject>" --summary "<what it now does>"'
            });
          }
          if (extras.reconstruction) {
            signals.push({
              id: extras.reconstruction.id,
              awaits: "agent",
              summary: `reconstruction at stage ${extras.reconstruction.stage}`,
              remedy: "wfctl reconstruct status"
            });
          }
          for (const id of extras.stranded ?? []) {
            signals.push({
              id,
              awaits: "maintainer",
              summary: "has no flow, so nothing can reach it",
              remedy: `wfctl work adopt ${id} --weight <significant|lightweight> --attested "<what they said>"`
            });
          }
          for (const broken of extras.unreadable ?? []) {
            signals.push({
              id: broken.id,
              awaits: "agent",
              summary: `record cannot be read: ${broken.problem}`,
              remedy: `repair .workflow/flows/${broken.id}.json`
            });
          }
          if (extras.awaitingCaptures) {
            signals.push({
              id: "changes/inbox",
              awaits: "maintainer",
              summary: `${extras.awaitingCaptures} capture(s) await the maintainer`,
              remedy: "put them one decision at a time, not as a backlog"
            });
          }
          return ok_(JSON.stringify({ current, signals }, null, 2));
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
        if (action === "adopt") {
          const { workAdopt: workAdopt2 } = await Promise.resolve().then(() => (init_commands(), commands_exports));
          return await workAdopt2(context, {
            bundle: args[0] ?? "",
            attested: flag(args, "attested") ?? "",
            ...flag(args, "weight") ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") } : {},
            ...flag(args, "title") ? { title: flag(args, "title") } : {},
            ...flag(args, "from") ? { from: flag(args, "from") } : {}
          });
        }
        if (action === "list") {
          const { workList: workList2 } = await Promise.resolve().then(() => (init_commands(), commands_exports));
          return await workList2(context);
        }
        if (action === "start") {
          return await workStart(context, {
            title: flag(args, "title") ?? "",
            attested: flag(args, "attested") ?? "",
            ...flag(args, "weight") ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") } : {},
            ...flag(args, "from") ? { from: flag(args, "from") } : {}
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
          if (sub === "drop") {
            return await issueDrop(context, {
              id: rest_[0] ?? "",
              reason: flag(rest_, "reason") ?? ""
            });
          }
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
        if (action === "park") {
          return await park(context, flag(args, "reason") ?? "", flag(args, "attested") ?? "");
        }
        if (action === "release") return await release(context, flag(args, "attested") ?? "");
        if (action === "close") {
          const outcome = oneOf(
            flag(args, "outcome"),
            ["completed", "partial", "abandoned"],
            "outcome"
          );
          return await close(context, { outcome });
        }
        if (action === "promote") {
          return await promote2(context, {
            subject: flag(args, "subject") ?? "",
            summary: flag(args, "summary") ?? "",
            ...flag(args, "bundle") ? { bundle: flag(args, "bundle") } : {},
            ...flag(args, "settles") ? { settles: flag(args, "settles") } : {}
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
          const { mutateFlow: mutateFlow2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
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
            await mutateFlow2(context.root, flow.id, (current) => ({
              ...current,
              recall: recordWritten2(current.recall, target)
            }));
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
          const { currentBranch: currentBranch2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const checkout = flag(args, "checkout") ?? (flag(args, "worktree") ? worktreeId : currentBranch2(path) || worktreeId);
          const entry = { repository, checkout, path, worktreeId };
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
            ...flag(args, "change") ? { change: flag(args, "change") } : {},
            ...flag(args, "settles") ? { settles: flag(args, "settles") } : {}
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
        if (action === "adopt") {
          const { workAdopt: workAdopt2 } = await Promise.resolve().then(() => (init_commands(), commands_exports));
          return await workAdopt2(context, {
            bundle: args[0] ?? "",
            attested: flag(args, "attested") ?? "",
            ...flag(args, "weight") ? { weight: oneOf(flag(args, "weight"), WORK_WEIGHTS, "weight") } : {},
            ...flag(args, "title") ? { title: flag(args, "title") } : {},
            ...flag(args, "from") ? { from: flag(args, "from") } : {}
          });
        }
        if (action === "list") {
          const { workList: workList2 } = await Promise.resolve().then(() => (init_commands(), commands_exports));
          return await workList2(context);
        }
        if (action === "start") {
          const { listFlows: listFlows2 } = await Promise.resolve().then(() => (init_flow(), flow_exports));
          const openFlows = (await listFlows2(context.root)).filter((entry) => !entry.closedAt);
          if (openFlows[0]) {
            throw new GateRefusal(
              `Flow ${openFlows[0].id} is open; work outside it is out of scope.`,
              `wfctl flow close ${openFlows[0].id}`
            );
          }
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
          const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const id = `${stamp}-reconstruct`;
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
          const { readRegistry: readRegistry3 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
          const { head: head2, resolveRevision: resolveRevision2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const registered = await readRegistry3(context.root);
          const repositories = flags(args, "repository").map((name) => {
            const entry = registered.find((candidate) => candidate.repository === name);
            if (!entry) {
              throw new GateRefusal(
                `${name} is not registered, so there is no checkout to read.`,
                `wfctl repo add ${name} --path <dir>`
              );
            }
            const asked = flag(args, "revision");
            const observed = head2(entry.path);
            return {
              ...entry,
              revision: asked ? resolveRevision2(entry.path, asked) : observed.revision,
              dirty: observed.dirty
            };
          });
          const next = await reconstruct.recordScope(context.root, record, {
            repositories,
            rawScope: oneOf(flag(args, "raw"), ["all", "selected", "none"], "raw", "none"),
            inScope: flags(args, "in"),
            exclude: flags(args, "not")
          });
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "read" && flag(args, "at")) {
          const { citation: citation2, readAt: readAt2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const { readRegistry: readRegistry3 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
          const name = flag(args, "at") ?? "";
          const entry = (await readRegistry3(context.root)).find(
            (candidate) => candidate.repository === name
          );
          const pinned = record.repositories.find((candidate) => candidate.repository === name);
          if (!entry || !pinned) {
            throw new GateRefusal(
              `${name} is not in this case's scope.`,
              "wfctl reconstruct status"
            );
          }
          const file = args[0] ?? "";
          const body = readAt2(entry.path, pinned.revision, file);
          return ok_(
            [`${citation2(name, pinned.revision, file)}`, "", body].join("\n")
          );
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
          const recorded = next.contradictions[next.contradictions.length - 1];
          return ok_(
            `${recorded?.id}  ${recorded?.subject}
recorded; ${next.contradictions.length} to adjudicate after the crawl.
resolve it later with: wfctl reconstruct resolve ${recorded?.id} --resolution "<what they decided>"`
          );
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
          const { readTrajectory: readTrajectory2, subjectId: subjectId2, listTrajectories: listTrajectories2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
          const named = args[0] ?? "";
          const found = await readTrajectory2(context.root, named) ?? await readTrajectory2(context.root, subjectId2(named));
          if (!found) {
            const all = await listTrajectories2(context.root);
            throw new GateRefusal(
              `No trajectory for ${named}.`,
              'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>" --axis <intent|delivery|vision>',
              all.length > 0 ? `Assembled so far:
${all.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "Nothing has been assembled yet."
            );
          }
          const next = {
            ...record,
            trajectories: [.../* @__PURE__ */ new Set([...record.trajectories, found.id])]
          };
          await reconstruct.writeCase(context.root, next);
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "abandon") {
          const reason = flag(args, "reason") ?? "";
          if (!reason.trim()) {
            throw new GateRefusal(
              "Abandoning a reconstruction records why.",
              'wfctl reconstruct abandon --reason "<why this pass is not finishing>"'
            );
          }
          await reconstruct.writeCase(context.root, {
            ...record,
            abandoned: { at: (/* @__PURE__ */ new Date()).toISOString(), reason: reason.trim() }
          });
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${record.id} abandoned: ${reason.trim()}
archived at:
${archived}`);
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
      case "debts": {
        const { collectDebts: collectDebts2, renderDebts: renderDebts2 } = await Promise.resolve().then(() => (init_debts(), debts_exports));
        return ok_(renderDebts2(await collectDebts2(context.root)));
      }
      case "decided": {
        const { findDecisions: findDecisions2, renderDecisions: renderDecisions2 } = await Promise.resolve().then(() => (init_decided(), decided_exports));
        const subject = rest.filter((entry) => !entry.startsWith("--")).join(" ");
        if (!subject.trim()) {
          throw new GateRefusal(
            "Naming the subject is the whole of this command.",
            'wfctl decided "<the subject>"'
          );
        }
        return ok_(renderDecisions2(subject, await findDecisions2(context.root, subject)));
      }
      case "knowledge": {
        const { renderIssues: renderIssues2, validateCurated: validateCurated2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
        const [action, ...args] = rest;
        if (action === "validate") {
          const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
          const page = flag(args, "page");
          const issues = await validateCurated2(context.root, page);
          const pages = page ? 1 : (await collectPages2(context.root)).length;
          return { stdout: renderIssues2(issues, pages), exitCode: issues.length > 0 ? 2 : 0 };
        }
        if (action === "hash") {
          const { contentHash: contentHash2, stripSeal: stripSeal2, KNOWLEDGE_DIR: KNOWLEDGE_DIR2, normalizePage: normalizePage2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
          const asked = args[0] ?? flag(args, "page") ?? "";
          const page = normalizePage2(context.root, asked);
          const body = await readFile14(resolve18(context.root, KNOWLEDGE_DIR2, page), "utf8").catch(
            () => void 0
          );
          if (body === void 0) {
            throw new GateRefusal(
              `No page at ${asked}.`,
              "wfctl knowledge validate",
              `Looked in knowledge/ for ${page}.`
            );
          }
          return ok_(contentHash2(stripSeal2(body)));
        }
        return {
          stdout: [
            "wfctl knowledge <validate|hash>",
            "",
            "  validate [--page <path>]   structural checks over curated pages",
            "  hash <path>                the hash both semantic reviews bind to"
          ].join("\n"),
          exitCode: 1
        };
      }
      case "doctor": {
        const { exitCodeFor: exitCodeFor2, renderReport: renderReport2, runDoctor: runDoctor2 } = await Promise.resolve().then(() => (init_doctor(), doctor_exports));
        const report = await runDoctor2(context.root, {
          distribution: resolve18(context.assets, "..", "..")
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
        if (rest[0] === "close") return await flowClose(context, rest[1]);
        return { stdout: "wfctl flow close [<flow-id>]", exitCode: 1 };
      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve18(flag(rest, "target") ?? process.cwd());
        const distribution = resolve18(context.assets, "..", "..");
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
        const outstanding = [];
        if (result.conflicts.length) {
          outstanding.push(
            `${result.conflicts.length} file(s) were edited after they were installed, and were left alone:`,
            ...result.conflicts.map((path) => `  ${path}`),
            "  Compare each against the shipped version and keep the edit or drop it.",
            "  Nothing here is replaced without you deciding that."
          );
        }
        if (result.obsolete.length) {
          const groups = /* @__PURE__ */ new Map();
          for (const path of result.obsolete) {
            const segments = path.split("/");
            const key = segments.length > 1 ? segments.slice(0, 2).join("/") : path;
            groups.set(key, [...groups.get(key) ?? [], path]);
          }
          outstanding.push(
            `${result.obsolete.length} file(s) belong to an older wfctl and are no longer part of it:`,
            ...[...groups].map(([key, members]) => members.length > 1 ? `  ${key}/  (${members.length} entries)` : `  ${key}`),
            "  They are not read by anything and are not removed for you.",
            "  Delete them once you have checked nothing local depends on them."
          );
        }
        if (result.replacedHooks.length) {
          outstanding.push(
            `${result.replacedHooks.length} hook entr(ies) from an older wfctl were replaced:`,
            ...result.replacedHooks.map((entry) => `  ${entry}`),
            "  Reported because a hook you did not expect to change is worth knowing about."
          );
        }
        if (outstanding.length) {
          lines.push("", ...outstanding);
        }
        lines.push(
          "",
          "Guidance is not installed \u2014 it ships with wfctl and is read from there,",
          "so upgrading wfctl upgrades it. There is nothing here to refresh.",
          "",
          "Restart the agent session so the new instructions load."
        );
        const unresolved = result.conflicts.length + result.obsolete.length;
        return { stdout: lines.join("\n"), exitCode: unresolved > 0 ? 3 : 0 };
      }
      default:
        return {
          stdout: `wfctl has no command "${group}".

${USAGE}`,
          exitCode: 1
        };
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
  for (let depth = 0; depth < 3; depth += 1) {
    const candidate = resolve18(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname12(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve18(start, "templates", "guidance");
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
  const { findRepositoryRoot: findRepositoryRoot2 } = await Promise.resolve().then(() => (init_paths_resolve(), paths_resolve_exports));
  const context = {
    /**
     * The repository, not the directory the command was typed in. Every fence
     * is relative to this, and taking it from cwd meant `cd changes && wfctl …`
     * removed all of them.
     */
    root: process.argv[2] === "init" ? process.cwd() : findRepositoryRoot2(process.cwd()),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown"
  };
  const result = await run2(process.argv.slice(2), context);
  process.exitCode = result.exitCode;
  process.stdout.write(`${result.stdout}
`);
}
export {
  findGuidance,
  run2 as run
};
