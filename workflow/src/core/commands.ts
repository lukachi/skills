import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { renderBrief, renderHandoff, buildCheckpoint } from "./checkpoint.js";
import {
  GateRefusal,
  assertNotParked,
  assertReached,
  assertRecall,
  assertReviewed,
} from "./gates.js";
import { compose, loadGuidance, type GuidanceKey } from "./guidance.js";
import {
  clearCurrent,
  closeFlow,
  currentFlow,
  listFlows,
  openFlow,
  readFlow,
  writeFlow,
} from "./flow.js";
import { createPromotionDraft } from "./paths.js";
import { findItem, recordAnswer, recordRoute, renderCounterLine } from "./recall.js";
import { definitionFor, nextStep, renderStep } from "./steps.js";
import type { FlowRecord, IssueRecord, RecallRoute, WorkStep, WorkWeight } from "./types.js";

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

    /**
     * The record's directory is created here, with the flow, and never by hand.
     * A bundle that appears because somebody made a folder is a workload nobody
     * agreed to, and the write guard refuses one for exactly that reason — so
     * the only way to get one is the command the maintainer asked for.
     */
    await mkdir(resolve(context.root, "changes/active", flow.id), { recursive: true });
    await writeFlow(context.root, { ...flow, members: [flow.id] });

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
    assertReviewed(flow, to);
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
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }

  /**
   * Dropping the fence must not strand a claim.
   *
   * `work close` refused while a unit was claimed and `flow close` did not, so
   * the bundle was left in `changes/active/` with no open flow that could ever
   * close it.
   */
  const claimed = flow.issues.filter((issue) => issue.status === "claimed");
  if (claimed.length > 0) {
    return refused(
      new GateRefusal(
        `${claimed.length} unit(s) are still claimed.`,
        `wfctl work issue complete ${claimed[0]?.id}`,
        claimed.map((issue) => `  ${issue.id}  ${issue.title}`).join("\n"),
      ),
    );
  }
  const closed = await closeFlow(context.root, flow.id);
  return ok(`flow ${closed.id} closed; the fence is down and the checkpoint is flushed.`);
}

/* ------------------------------------------------------------------ units */

/**
 * Units carry a status and the agent's own notes, and nothing else.
 *
 * There is no dependency graph here on purpose. A map that came out of grilling
 * can be worked efficiently in an order no graph would predict, and the
 * previous implementation's blocking edges mostly encoded preference — then
 * refused work on the strength of it. Where order genuinely matters, it is
 * written in the notes, which is also where everything else learned about a
 * unit goes.
 */
export async function issueCreate(
  context: CommandContext,
  options: { title: string; acceptance: string[] },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", 'wfctl work start --title "<...>"'));
  }
  if (!options.title.trim()) {
    return refused(
      new GateRefusal("A unit needs a title.", 'wfctl work issue create --title "<what it delivers>"'),
    );
  }

  const id = `U${String(flow.issues.length + 1).padStart(3, "0")}`;
  const issue: IssueRecord = {
    id,
    title: options.title.trim(),
    status: "open",
    notes: [],
    acceptance: options.acceptance,
  };
  await writeFlow(context.root, { ...flow, issues: [...flow.issues, issue] });
  return ok(`${id}  ${issue.title}`);
}

export async function issueList(context: CommandContext): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  if (flow.issues.length === 0) {
    return ok("no units yet.");
  }
  const lines = flow.issues.map((issue) => {
    const notes = issue.notes.length > 0 ? `\n      ${issue.notes.join("\n      ")}` : "";
    const claim = issue.claim ? `  [${issue.claim.repository}/${issue.claim.worktreeId}]` : "";
    return `${issue.id}  ${issue.status.padEnd(8)}  ${issue.title}${claim}${notes}`;
  });
  return ok(lines.join("\n"));
}

async function withIssue(
  context: CommandContext,
  id: string,
  change: (issue: IssueRecord) => IssueRecord,
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  const found = flow.issues.find((issue) => issue.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    return refused(new GateRefusal(`No unit named ${id}.`, "wfctl work issue list"));
  }
  const issues = flow.issues.map((issue) => (issue === found ? change(found) : issue));
  await writeFlow(context.root, { ...flow, issues });
  const next = issues.find((issue) => issue.id === found.id);
  return ok(`${next?.id}  ${next?.status}  ${next?.title}`);
}

export async function issueNote(
  context: CommandContext,
  options: { id: string; note: string },
): Promise<CommandResult> {
  if (!options.note.trim()) {
    return refused(new GateRefusal("An empty note records nothing.", 'wfctl work issue note <id> --note "<...>"'));
  }
  return withIssue(context, options.id, (issue) => ({
    ...issue,
    notes: [...issue.notes, options.note.trim()],
  }));
}

/**
 * A claim binds repository and worktree, never branch and commit.
 *
 * Every recorded binding deadlock in the previous implementation came from
 * pinning a revision that then moved under the record: a claim that outlived
 * its branch and blocked its own release, a checkpoint that could never match
 * again, a rebind that destroyed the record's accounting on the way past. A
 * claim is about which files are being edited.
 */
export async function issueClaim(
  context: CommandContext,
  options: { id: string; repository: string; checkout: string; worktreeId: string },
): Promise<CommandResult> {
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
      worktreeId: options.worktreeId,
    },
  }));
}

export async function issueComplete(
  context: CommandContext,
  id: string,
): Promise<CommandResult> {
  const result = await withIssue(context, id, (issue) => {
    const next: IssueRecord = { ...issue, status: "done" };
    delete next.claim;
    return next;
  });
  if (result.exitCode !== 0) return result;

  const flow = await currentFlow(context.root);
  const remaining = (flow?.issues ?? []).filter((issue) => issue.status === "open");
  return ok(
    compose([
      result.stdout,
      remaining.length > 0
        ? `${remaining.length} unit(s) still open:\n  ${remaining.map((issue) => `${issue.id}  ${issue.title}`).join("\n  ")}\n\nFinishing a unit is not finishing. The next unit is available work, and available work is yours.`
        : "every unit is terminal.",
    ]),
  );
}

/* --------------------------------------------------------------- captures */

/**
 * The one place a finding met during work can go.
 *
 * It exists so that noticing something is not a reason to open a second
 * workload. Both this and the write guard refuse a new record while a flow is
 * open, which is what actually stops it.
 */
export async function capture(
  context: CommandContext,
  options: { text: string; awaits?: "maintainer" },
): Promise<CommandResult> {
  if (!options.text.trim()) {
    return refused(new GateRefusal("A capture needs its finding.", 'wfctl capture "<what you found>"'));
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(context.root, "changes/inbox", `${stamp}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    [
      "---",
      `captured_at: ${new Date().toISOString()}`,
      `awaits: ${options.awaits ?? "nobody"}`,
      "status: pending",
      "---",
      "",
      options.text.trim(),
      "",
    ].join("\n"),
    "utf8",
  );
  return ok(compose([await guidanceFor(context, "work/capture"), `captured at:\n${path}`]));
}

/* ----------------------------------------------------------- verification */

export async function verify(
  context: CommandContext,
  options: { review: string },
): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }

  try {
    const { readReviewArtifact } = await import("./review-artifact.js");
    const { assertReviewUsable } = await import("./verify.js");
    const review = await readReviewArtifact(options.review, context.actor);
    assertReviewUsable(flow, review);

    /**
     * The accepted review is written to the record.
     *
     * It was validated and then discarded, so `work step verified` had no
     * review precondition at all and the adversarial round was decorative.
     * Storing it is what lets the step gate ask whether one happened.
     */
    await writeFlow(context.root, {
      ...flow,
      step: "verified",
      review: {
        reviewer: review.reviewer,
        at: new Date().toISOString(),
        attacks: review.attacks.length,
        findings: review.findings.length,
      },
    });

    return ok(
      compose([
        `review accepted from ${review.reviewer}: ${review.attacks.length} attack(s), ${review.findings.length} finding(s)`,
        await guidanceFor(context, "work/closed"),
      ]),
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}

/* ------------------------------------------------------- park and release */

export async function park(context: CommandContext, reason: string): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  if (!reason.trim()) {
    return refused(
      new GateRefusal(
        "Parking needs their reason.",
        'wfctl work park --reason "<why starting now is premature>"',
      ),
    );
  }
  await writeFlow(context.root, {
    ...flow,
    parked: { at: new Date().toISOString(), reason: reason.trim() },
  });
  return ok(
    `${flow.id} is parked: ${reason.trim()}\n\n` +
      "Approving a framing settles what the work is, never that it begins. Only " +
      "their own word starts it — never an answer to a different question, and " +
      "never the condition that held it having cleared.",
  );
}

export async function release(context: CommandContext, attested: string): Promise<CommandResult> {
  const flow = await currentFlow(context.root);
  if (!flow) return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  if (!flow.parked) return ok(`${flow.id} is not parked.`);
  if (!attested.trim()) {
    return refused(
      new GateRefusal(
        "A release carries their own words.",
        'wfctl work release --attested "<what they said>"',
        "This is one of the two places wording is recorded, because a release " +
          "inferred from anything else is a start nobody agreed to.",
      ),
    );
  }
  const next = { ...flow };
  delete next.parked;
  await writeFlow(context.root, next);
  return ok(`${flow.id} released: "${attested.trim()}"`);
}

/* ------------------------------------------------------------------ close */

/**
 * Closing runs every gate the step machine runs.
 *
 * It did not, and that made the whole design optional: a flow at `opened` with
 * no recall, no framing, no units and no review closed as `completed`. `close`
 * was the one step-recording command that skipped `assertReached` and
 * `assertRecall`, so skipping straight to it skipped everything.
 */
export async function close(
  context: CommandContext,
  options: { outcome: "completed" | "partial" | "abandoned" },
): Promise<CommandResult> {
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
        open.map((issue) => `  ${issue.id}  ${issue.title}`).join("\n"),
      ),
    );
  }

  try {
    const { closeBundle } = await import("./promotion-queue.js");
    const bundle = flow.members[0] ?? flow.id;
    const result = await closeBundle({
      knowledgeRoot: context.root,
      bundleId: bundle,
      outcome: options.outcome,
    });
    await writeFlow(context.root, { ...flow, step: "closed", closedAt: new Date().toISOString() });
    /**
     * Drop the fence with the closure.
     *
     * Only `flow close` cleared the pointer, so a closed and archived record
     * kept accepting units, captures, steps and checkpoints.
     */
    await clearCurrent(context.root);
    return ok(
      result.waitingOnPromotion
        ? `${bundle} closed as ${options.outcome} and waits in the promotion queue.\n\n` +
            "Its pages are what the maintainer is asked about. Nothing else is."
        : `${bundle} closed as ${options.outcome} and archived; it had nothing to say about itself.`,
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}


/**
 * Promotion writes the pages **and** appends to the subject's line.
 *
 * Writing only the pages was a gap. A closed change is an event on a subject's
 * line, so a promotion that skips it leaves the line built solely by
 * reconstruction — stale the moment work lands, and rediscovered by the next
 * reconstruction at the cost of reading everything again.
 */
export async function promote(
  context: CommandContext,
  options: { subject: string; summary: string },
): Promise<CommandResult> {
  const { listQueue, promote: movePages } = await import("./promotion-queue.js");
  const { appendEvent, renderTrajectory } = await import("./trajectory.js");

  const queued = await listQueue(context.root);
  const bundle = queued[0];
  if (!bundle) {
    return refused(
      new GateRefusal("Nothing is waiting to be promoted.", "wfctl work promotion list"),
    );
  }

  if (!options.subject.trim()) {
    return refused(
      new GateRefusal(
        "Promotion needs the product subject this work belongs to.",
        'wfctl work promote --subject "<the product subject>" --summary "<what it now does>"',
        "The pages say what is true now. The subject's line says how it got " +
          "there, and a promotion that writes only pages leaves that line to be " +
          "rediscovered by the next reconstruction.",
      ),
    );
  }

  try {
    const trajectory = await appendEvent(context.root, options.subject, {
      summary: options.summary.trim() || options.subject.trim(),
      axis: "delivery",
      claims: [],
      change: bundle,
      at: new Date().toISOString(),
    });
    const result = await movePages({ knowledgeRoot: context.root, bundleId: bundle });
    return ok(
      compose([
        `${bundle} promoted and archived at:\n${result.archived}`,
        renderTrajectory(trajectory),
      ]),
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
