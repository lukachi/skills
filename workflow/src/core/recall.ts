import type {
  RecallAnswer,
  RecallCounters,
  RecallGroup,
  RecallItem,
  RecallRoute,
  RecallState,
  WorkStep,
} from "./types.js";
import { RECALL_ROUTES } from "./types.js";

/**
 * The recall checklist.
 *
 * An agent has no feeling-of-knowing. A person searching their memory can sense
 * that an answer exists and has not surfaced yet; an agent experiences only the
 * plausible answer it already has, which is why it reaches for grep and stops
 * as soon as something comes back. Nothing is missing from its point of view.
 *
 * This list is that missing sense, externalised. It does not make the agent
 * more careful — it makes the un-retrieved state countable, so a gate can see
 * it and the agent can be shown it.
 */
export const RECALL_ITEMS: readonly RecallItem[] = [
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
  { id: "D12", group: "D", question: "What calls it, and what depends on it — the blast radius?" },
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
  { id: "H24", group: "H", question: "Am I recording not-found, or asserting it does not exist?" },
];

/**
 * Which groups a step requires, and the minimum routes it must have used.
 *
 * The floor is a count and is gameable on its own — one empty query satisfies
 * it. It is kept because the failure it catches is not subtle cheating but the
 * complete absence of a tool: greps in the hundreds and zero traversals. The
 * answered items are the real check; the floor is what makes "never opened the
 * graph" impossible to miss.
 */
export interface StepRequirement {
  groups: RecallGroup[];
  floor: Partial<Record<RecallRoute, number>>;
}

export const STEP_REQUIREMENTS: Partial<Record<WorkStep, StepRequirement>> = {
  aligned: { groups: ["E"], floor: { qmd: 1 } },
  framed: { groups: ["A", "B", "C", "E"], floor: { qmd: 1 } },
  implement: { groups: ["D"], floor: { graphify: 1 } },
  verified: { groups: ["G"], floor: {} },
  promoted: { groups: ["E", "H"], floor: {} },
};

export function emptyCounters(): RecallCounters {
  return RECALL_ROUTES.reduce((counters, route) => {
    counters[route] = 0;
    return counters;
  }, {} as RecallCounters);
}

export function emptyRecall(): RecallState {
  return { answers: [], counters: emptyCounters(), covered: [] };
}

export function itemsForGroup(group: RecallGroup): RecallItem[] {
  return RECALL_ITEMS.filter((item) => item.group === group);
}

export function findItem(id: string): RecallItem | undefined {
  return RECALL_ITEMS.find((item) => item.id.toUpperCase() === id.toUpperCase());
}

/**
 * An answer counts only when it carries a route and a source. A blank answer,
 * or one attributed to nothing, is treated as absent — otherwise the checklist
 * degrades into a list of sentences the agent writes to itself.
 */
export function isAnswered(state: RecallState, itemId: string): boolean {
  return state.answers.some(
    (answer) =>
      answer.item.toUpperCase() === itemId.toUpperCase() &&
      answer.answer.trim().length > 0 &&
      answer.source.trim().length > 0,
  );
}

export interface RecallShortfall {
  missingItems: RecallItem[];
  missingFloor: { route: RecallRoute; required: number; actual: number }[];
}

export function shortfallFor(step: WorkStep, state: RecallState): RecallShortfall {
  const requirement = STEP_REQUIREMENTS[step];
  if (!requirement) {
    return { missingItems: [], missingFloor: [] };
  }

  const missingItems = requirement.groups
    .flatMap((group) => itemsForGroup(group))
    .filter((item) => !isAnswered(state, item.id));

  const missingFloor = Object.entries(requirement.floor)
    .map(([route, required]) => ({
      route: route as RecallRoute,
      required: required ?? 0,
      actual: state.counters[route as RecallRoute] ?? 0,
    }))
    .filter((entry) => entry.actual < entry.required);

  return { missingItems, missingFloor };
}

export function isSatisfied(shortfall: RecallShortfall): boolean {
  return shortfall.missingItems.length === 0 && shortfall.missingFloor.length === 0;
}

/**
 * The line printed unprompted at every gate.
 *
 * It is printed whether or not the gate refuses, because its job is not to
 * justify a refusal. It is to show the shape of the work: many greps and no
 * traversal means the code was searched by string and never by structure, and
 * that is worth seeing even on a step that passes.
 */
export function renderCounterLine(step: WorkStep, state: RecallState): string {
  const requirement = STEP_REQUIREMENTS[step];
  const required = requirement
    ? requirement.groups.flatMap((group) => itemsForGroup(group))
    : [];
  const answered = required.filter((item) => isAnswered(state, item.id)).length;

  const counters = RECALL_ROUTES.map((route) => `${route} ${state.counters[route] ?? 0}`).join(
    " · ",
  );
  const lines = [`recall: ${answered}/${required.length} required answered · ${counters}`];

  const shortfall = shortfallFor(step, state);
  if (shortfall.missingItems.length > 0) {
    const missing = shortfall.missingItems
      .map((item) => `${item.id} ${item.question}`)
      .join("\n         ");
    lines.push(`missing: ${missing}`);
  }
  for (const entry of shortfall.missingFloor) {
    lines.push(
      `floor:   ${entry.route} used ${entry.actual}, this step requires ${entry.required}`,
    );
  }
  return lines.join("\n");
}

export function recordAnswer(state: RecallState, answer: RecallAnswer): RecallState {
  const answers = state.answers.filter(
    (existing) => existing.item.toUpperCase() !== answer.item.toUpperCase(),
  );
  answers.push(answer);
  const counters = { ...state.counters };
  counters[answer.route] = (counters[answer.route] ?? 0) + 1;
  return { ...state, answers, counters };
}

export function recordRoute(
  state: RecallState,
  route: RecallRoute,
  covered: string[] = [],
): RecallState {
  const counters = { ...state.counters };
  counters[route] = (counters[route] ?? 0) + 1;
  const merged = new Set([...state.covered, ...covered]);
  return { ...state, counters, covered: [...merged].sort() };
}
