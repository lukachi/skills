import { renderBrief, renderHandoff, buildCheckpoint } from "./checkpoint.js";
import { GateRefusal, assertNotParked, assertReached, assertRecall } from "./gates.js";
import { compose, loadGuidance, type GuidanceKey } from "./guidance.js";
import { closeFlow, currentFlow, listFlows, openFlow, readFlow, writeFlow } from "./flow.js";
import { createPromotionDraft } from "./paths.js";
import { findItem, recordAnswer, recordRoute, renderCounterLine } from "./recall.js";
import { definitionFor, nextStep, renderStep } from "./steps.js";
import type { FlowRecord, RecallRoute, WorkStep, WorkWeight } from "./types.js";

/**
 * The command layer.
 *
 * Every command does the same three things in the same order: refuse if the
 * state is wrong, apply the change, then print the guidance for the state the
 * flow is now in. The third part is the whole point — an instruction that
 * arrives inside the result of a command the agent was already running has no
 * branch in front of it and nothing to skim past.
 */
export interface CommandContext {
  root: string;
  /** Where the installed guidance bundle lives. */
  assets: string;
  actor: string;
  /** Whether this session has fetched the bound flow's handoff. */
  handoffRead?: boolean;
}

export interface CommandResult {
  stdout: string;
  exitCode: number;
}

function ok(stdout: string): CommandResult {
  return { stdout, exitCode: 0 };
}

function refused(error: GateRefusal): CommandResult {
  return { stdout: error.render(), exitCode: 2 };
}

async function guidanceFor(context: CommandContext, key: GuidanceKey): Promise<string | undefined> {
  return loadGuidance({ root: context.assets }, key);
}

/** The session-start hook's output. */
export async function brief(context: CommandContext): Promise<CommandResult> {
  const flows = await listFlows(context.root);
  const current = await currentFlow(context.root);
  return ok(
    compose([
      renderBrief(flows, current?.id),
      await guidanceFor(context, "session/start"),
    ]),
  );
}

export async function handoff(context: CommandContext, id?: string): Promise<CommandResult> {
  const flow = id ? await readFlow(context.root, id) : await currentFlow(context.root);
  if (!flow) {
    return refused(
      new GateRefusal("No flow is open.", 'wfctl work start --title "<what this is>"'),
    );
  }
  return ok(renderHandoff(flow));
}

export async function checkpoint(
  context: CommandContext,
  input: { summary: string; handoff: string; last: string; next: string; todo?: string[] },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }

  const next: FlowRecord = {
    ...flow,
    checkpoint: buildCheckpoint({
      summary: input.summary,
      handoff: input.handoff,
      lastAction: input.last,
      nextAction: input.next,
      actor: context.actor,
      ...(input.todo ? { todo: input.todo } : {}),
    }),
  };
  await writeFlow(context.root, next);
  return ok(`checkpoint written for ${flow.id}`);
}

export async function workStart(
  context: CommandContext,
  options: { title: string; weight?: WorkWeight },
): Promise<CommandResult> {
  try {
    if (!options.weight) {
      const definition = definitionFor("opened");
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        "wfctl work start --title \"<...>\" --weight <significant|lightweight>",
        definition.demands,
      );
    }
    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title,
      weight: options.weight,
    });
    return ok(
      compose([
        `flow ${flow.id} opened`,
        await guidanceFor(context, "work/aligned"),
        renderStep({ ...flow, step: "aligned" }),
      ]),
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    if (error instanceof Error && "remedy" in error) {
      return refused(new GateRefusal(error.message, String((error as { remedy: string }).remedy)));
    }
    throw error;
  }
}

/**
 * Advance the flow one step.
 *
 * Advancing is the only way a step is reached, and each advance checks the
 * previous step's recall. That is what makes skipping impossible without
 * knowing the sequence: the step you skipped is the precondition of the one you
 * are trying to enter.
 */
export async function advance(context: CommandContext, to: WorkStep): Promise<CommandResult> {
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

  const advanced: FlowRecord = { ...flow, step: to };
  await writeFlow(context.root, advanced);

  const following = nextStep(to) ?? to;
  return ok(
    compose([
      `flow ${flow.id} is now at ${to}`,
      await guidanceFor(context, `work/${to}` as GuidanceKey),
      renderStep(advanced),
      following !== to ? `then: ${definitionFor(following).command}` : undefined,
    ]),
  );
}

export async function recallAnswer(
  context: CommandContext,
  options: { item: string; answer: string; route: RecallRoute; source: string },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }

  const item = findItem(options.item);
  if (!item) {
    return refused(
      new GateRefusal(`No recall item named ${options.item}.`, "wfctl recall list"),
    );
  }
  if (!options.source.trim()) {
    return refused(
      new GateRefusal(
        "An answer needs the source it came from.",
        'wfctl recall answer <item> ... --source "<where you found it>"',
        "An answer with no source is a guess with a sentence around it.",
      ),
    );
  }

  const next: FlowRecord = {
    ...flow,
    recall: recordAnswer(flow.recall, {
      item: item.id,
      answer: options.answer,
      route: options.route,
      source: options.source,
      at: new Date().toISOString(),
    }),
  };
  await writeFlow(context.root, next);
  return ok(renderCounterLine(next.step, next.recall));
}

/** Records that a retrieval route was used, and what it covered. */
export async function recallRoute(
  context: CommandContext,
  options: { route: RecallRoute; covered?: string[] },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const next: FlowRecord = {
    ...flow,
    recall: recordRoute(flow.recall, options.route, options.covered ?? []),
  };
  await writeFlow(context.root, next);
  return ok(renderCounterLine(next.step, next.recall));
}

export async function promotionDraft(
  context: CommandContext,
  options: { knowledgeRoot: string; page: string },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  const bundle = flow.members[0] ?? flow.id;
  const path = await createPromotionDraft(options.knowledgeRoot, bundle, options.page);
  return ok(
    compose([await guidanceFor(context, "work/promotion-path"), `draft created at:\n${path}`]),
  );
}

export async function flowClose(context: CommandContext): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl flow list"));
  }
  const closed = await closeFlow(context.root, flow.id);
  return ok(`flow ${closed.id} closed; the fence is down and the checkpoint is flushed.`);
}
