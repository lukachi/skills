import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  mutateFlow,
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
      renderBrief(flows, current?.id, await briefExtras(context)),
      await guidanceFor(context, "session/start"),
    ]),
  );
}

/**
 * Everything else that awaits somebody.
 *
 * A promotion queue, a capture marked for the maintainer and an open
 * reconstruction were each invisible here, and the brief is the surface the
 * whole design calls authoritative.
 */
export async function briefExtras(context: CommandContext) {
  const { listQueue } = await import("./promotion-queue.js");
  const { currentCase } = await import("./reconstruct.js");
  const { readdir, readFile: read } = await import("node:fs/promises");

  const queued = await listQueue(context.root).catch(() => []);

  const inbox = await readdir(resolve(context.root, "changes/inbox")).catch(() => []);
  let awaitingCaptures = 0;
  for (const entry of inbox) {
    if (!entry.endsWith(".md")) continue;
    const body = await read(resolve(context.root, "changes/inbox", entry), "utf8").catch(() => "");
    if (/^awaits:\s*maintainer/m.test(body)) awaitingCaptures += 1;
  }

  const reconstruction = await currentCase(context.root).catch(() => undefined);

  const { listBundles } = await import("./bundles.js");
  const stranded = (await listBundles(context.root).catch(() => []))
    .filter((entry) => entry.state === "stranded")
    .map((entry) => entry.bundle);

  return {
    queued,
    awaitingCaptures,
    stranded,
    ...(reconstruction ? { reconstruction: { id: reconstruction.id, stage: reconstruction.stage } } : {}),
  };
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

/**
 * The maintainer's words, or no bundle.
 *
 * This is the first of their two decisions, and it was the only one recorded
 * nowhere: the step definition said to put the weight to them in your own
 * words, which is an instruction behind a branch the model evaluates, and the
 * agent that skips it leaves a record indistinguishable from one they asked
 * for. Bundles opened because something was noticed mid-work are the observed
 * result. It also settles the capture question by possession rather than
 * judgment — if you cannot quote them, it is a capture.
 */
function assertAttested(words: string, command: string): string {
  const said = words.trim();
  if (said) return said;
  throw new GateRefusal(
    "A bundle exists because the maintainer asked for it, and nothing here says they did.",
    command,
    "Put the work to them in your own words — what it is, and whether it changes " +
      "behaviour, meaning, contracts, data or operations — then record their answer " +
      "verbatim.\n\n" +
      "If you cannot quote them, this is not a bundle:\n" +
      '  wfctl capture "<what you found>"',
  );
}

export async function workStart(
  context: CommandContext,
  options: { title: string; weight?: WorkWeight; attested: string; from?: string },
): Promise<CommandResult> {
  try {
    /** The fence spans both cases, in this direction too. */
    const { currentCase } = await import("./reconstruct.js");
    const open = await currentCase(context.root).catch(() => undefined);
    if (open && !open.abandoned) {
      throw new GateRefusal(
        `Reconstruction ${open.id} is open at stage ${open.stage}; work outside it is out of scope.`,
        `wfctl reconstruct abandon --reason "<why this pass is not finishing>"`,
      );
    }

    if (!options.weight) {
      const definition = definitionFor("opened");
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        "wfctl work start --title \"<...>\" --weight <significant|lightweight>",
        definition.demands,
      );
    }
    const attested = assertAttested(
      options.attested,
      'wfctl work start --title "<...>" --weight <significant|lightweight> ' +
        '--attested "<what they said>"',
    );

    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title,
      weight: options.weight,
      attested,
      ...(options.from
        ? {
            sources: [
              { from: options.from, attested, at: new Date().toISOString() },
            ],
          }
        : {}),
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

  const next = await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    recall: recordAnswer(current.recall, {
      item: item.id,
      answer: options.answer,
      route: options.route,
      source: options.source,
      at: new Date().toISOString(),
    }),
  }));
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
  const next = await mutateFlow(context.root, flow.id, (current) => ({
    ...current,
    recall: recordRoute(current.recall, options.route, options.covered ?? []),
  }));
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
  try {
    assertNotParked(flow);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  const bundle = flow.members[0] ?? flow.id;
  const path = await createPromotionDraft(options.knowledgeRoot, bundle, options.page);
  return ok(
    compose([await guidanceFor(context, "work/promotion-path"), `draft created at:\n${path}`]),
  );
}

/**
 * Dropping the fence.
 *
 * It took no id, so the remedy printed beside every fence refusal —
 * `wfctl flow close <id>` — silently did nothing, and a flow the pointer had
 * lost could never be closed by any command at all.
 *
 * It also skipped every gate `work close` runs, so it was the unguarded way
 * past the step chain, past a park the maintainer set, and past units nobody
 * delivered.
 */
export async function flowClose(context: CommandContext, id?: string): Promise<CommandResult> {
  const flow = id ? await readFlow(context.root, id) : await currentFlow(context.root);
  if (!flow) {
    const open = (await listFlows(context.root)).filter((entry) => !entry.closedAt);
    return refused(
      new GateRefusal(
        id ? `No flow named ${id}.` : "No flow is open.",
        open.length > 0 ? `wfctl flow close ${open[0]?.id}` : "wfctl brief",
        open.length > 0
          ? `Open:\n${open.map((entry) => `  ${entry.id}`).join("\n")}`
          : undefined,
      ),
    );
  }

  if (flow.parked) {
    return refused(
      new GateRefusal(
        `${flow.id} is parked: ${flow.parked.reason}`,
        `wfctl work release --attested "<what they said>"`,
        "The maintainer held this work. Dropping the fence would discard that " +
          "without telling them.",
      ),
    );
  }

  /**
   * Dropping the fence must not strand a claim.
   *
   * `work close` refused while a unit was claimed and `flow close` did not, so
   * the bundle was left in `changes/active/` with no open flow that could ever
   * close it.
   */
  const unfinished = flow.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "dropped",
  );
  if (unfinished.length > 0) {
    return refused(
      new GateRefusal(
        `${unfinished.length} unit(s) are not terminal.`,
        `wfctl work issue complete ${unfinished[0]?.id}`,
        `${unfinished.map((issue) => `  ${issue.id}  ${issue.status}  ${issue.title}`).join("\n")}\n\n` +
          "Drop one deliberately if it left the route; closing over it reports " +
          "undelivered work as delivered.",
      ),
    );
  }
  const closed = await closeFlow(context.root, flow.id);
  return ok(`flow ${closed.id} closed; the fence is down and the checkpoint is flushed.`);
}

/**
 * Assemble a bundle from work that already exists somewhere.
 *
 * This is not a migration for older records and it does not parse anything. It
 * is the same bundle creation, with the details taken from wherever the work
 * actually lives — a stranded bundle, two records that are the same work said
 * differently, an inbox entry that should have been a unit. The demands and the
 * gates after it are the flow's own; only the sourcing differs, which is why
 * nothing downstream has to know a bundle was adopted.
 *
 * With no flow open it opens one around the bundle. With a flow open it absorbs
 * the bundle into the one the fence already carries, and the absorbed record is
 * marked where it sits rather than moved or deleted.
 *
 * Every absorption is its own maintainer answer. Merging three confused records
 * is a decision about what the work is, and asking once for a batch is asking
 * about none of them.
 */
export async function workAdopt(
  context: CommandContext,
  options: { bundle: string; attested: string; weight?: WorkWeight; title?: string; from?: string },
): Promise<CommandResult> {
  try {
    const { bundleExists, listBundles, markSuperseded, readSupersession } = await import(
      "./bundles.js"
    );

    const bundle = options.bundle.trim();
    if (!bundle) {
      throw new GateRefusal(
        "Adoption needs the bundle it is assembling from.",
        'wfctl work adopt <bundle> --weight <significant|lightweight> --attested "<what they said>"',
      );
    }
    if (bundle.includes("/") || bundle.includes("..")) {
      throw new GateRefusal(
        "A bundle is named, not pathed.",
        "wfctl work list",
        `Give the name as it appears under changes/active, not ${bundle}.`,
      );
    }
    if (!(await bundleExists(context.root, bundle))) {
      const known = (await listBundles(context.root)).map((entry) => entry.bundle);
      throw new GateRefusal(
        `There is no bundle named ${bundle}.`,
        "wfctl work list",
        known.length ? `Under changes/active:\n${known.map((n) => `  ${n}`).join("\n")}` : undefined,
      );
    }

    const already = await readSupersession(context.root, bundle);
    if (already) {
      throw new GateRefusal(
        `${bundle} was already absorbed into ${already.by}.`,
        `wfctl work adopt ${already.by} --weight <significant|lightweight> --attested "<what they said>"`,
        "Absorbing it twice would give one body of work two live records, which " +
          "is the state adoption exists to end.",
      );
    }

    const attested = assertAttested(
      options.attested,
      `wfctl work adopt ${bundle} --weight <significant|lightweight> --attested "<what they said>"`,
    );
    const at = new Date().toISOString();
    const source = { from: options.from ?? `changes/active/${bundle}`, bundle, attested, at };

    const open = await currentFlow(context.root);
    if (open) {
      const canonical = open.members[0];
      if (!canonical) {
        throw new GateRefusal(
          `Flow ${open.id} carries no bundle to absorb into.`,
          "wfctl brief",
        );
      }
      if (open.members.includes(bundle)) {
        throw new GateRefusal(
          `${bundle} is already part of flow ${open.id}.`,
          "wfctl work list",
        );
      }
      await markSuperseded(context.root, bundle, { by: canonical, at, attested });
      const updated = await mutateFlow(context.root, open.id, (flow) => ({
        ...flow,
        members: [...flow.members, bundle],
        sources: [...(flow.sources ?? []), source],
      }));
      return ok(
        compose([
          `${bundle} absorbed into ${canonical}.`,
          `It stays in changes/active, marked superseded — the duplicate is the`,
          `evidence of whatever produced it, and deleting it would take that with it.`,
          "",
          `Flow ${updated.id} now spans ${updated.members.length} bundle(s).`,
          renderStep(updated),
        ]),
      );
    }

    /** The fence spans both cases, in this direction too. */
    const { currentCase } = await import("./reconstruct.js");
    const openCase = await currentCase(context.root).catch(() => undefined);
    if (openCase && !openCase.abandoned) {
      throw new GateRefusal(
        `Reconstruction ${openCase.id} is open at stage ${openCase.stage}; work outside it is out of scope.`,
        `wfctl reconstruct abandon --reason "<why this pass is not finishing>"`,
      );
    }

    if (!options.weight) {
      throw new GateRefusal(
        "This flow needs its weight settled before it opens.",
        `wfctl work adopt ${bundle} --weight <significant|lightweight> --attested "<what they said>"`,
        definitionFor("opened").demands,
      );
    }

    const flow = await openFlow(context.root, {
      kind: "work",
      title: options.title ?? bundle,
      weight: options.weight,
      attested,
      members: [bundle],
      sources: [source],
    });

    return ok(
      compose([
        `flow ${flow.id} opened around ${bundle}`,
        "",
        "Nothing about where it stopped is carried over. Every gate is walked here,",
        "because a step recorded elsewhere is a check this tool never ran — and a",
        "flow that reports checks nobody ran is the green gate the review exists to",
        "stop.",
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

/** Every bundle, and whether anything can still reach it. */
export async function workList(context: CommandContext): Promise<CommandResult> {
  const { listBundles, renderBundles } = await import("./bundles.js");
  return ok(renderBundles(await listBundles(context.root)));
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
  try {
    assertNotParked(flow);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  if (!options.title.trim()) {
    return refused(
      new GateRefusal("A unit needs a title.", 'wfctl work issue create --title "<what it delivers>"'),
    );
  }

  /**
   * The id is derived inside the lock, from the record as it stands there.
   * Deriving it outside gave concurrent calls the same number, and a claim
   * recorded against it afterwards pointed at whichever one survived.
   */
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
          acceptance: options.acceptance,
        },
      ],
    };
  });
  return ok(`${created}  ${options.title.trim()}`);
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
  const bound = await currentFlow(context.root);
  if (!bound) {
    return refused(new GateRefusal("No flow is open.", "wfctl brief"));
  }
  /**
   * A park stops the work, not only the claim. The agent could mark every unit
   * done and draft every page while the maintainer was holding it, so release
   * landed on a record that said it had been delivered.
   */
  try {
    assertNotParked(bound);
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
  if (!bound.issues.some((issue) => issue.id.toUpperCase() === id.toUpperCase())) {
    return refused(new GateRefusal(`No unit named ${id}.`, "wfctl work issue list"));
  }

  // Read and write under one lock: the plain pair is what lost units when two
  // sessions each read the same record and the second overwrote the first.
  const flow = await mutateFlow(context.root, bound.id, (current) => ({
    ...current,
    issues: current.issues.map((issue) =>
      issue.id.toUpperCase() === id.toUpperCase() ? change(issue) : issue,
    ),
  }));

  const next = flow.issues.find((issue) => issue.id.toUpperCase() === id.toUpperCase());
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

      /**
       * A claim names a checkout the registry knows. It accepted any string, so
       * the write guard later reported the contradiction it had been handed —
       * "claimed from acme/nope, and that path is in acme/leaf" — for a
       * repository that never existed.
       */
      const { readRegistry } = await import("./registry.js");
      const registered = await readRegistry(context.root);
      const match = registered.find(
        (entry) =>
          entry.repository === options.repository && entry.worktreeId === options.worktreeId,
      );
      if (!match) {
        throw new GateRefusal(
          `${options.repository} (${options.worktreeId}) is not a registered checkout.`,
          `wfctl repo add ${options.repository} --path <dir> --worktree ${options.worktreeId}`,
          registered.length > 0
            ? `Registered:\n${registered.map((entry) => `  ${entry.repository}  ${entry.worktreeId}  ${entry.path}`).join("\n")}`
            : "Nothing is registered, so no checkout can be claimed.",
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
      worktreeId: options.worktreeId,
    },
  }));
}

/**
 * A unit that left the route.
 *
 * Without this, blocking closure on open units would have no escape and the
 * only way past a unit nobody is going to build would be closing over it, which
 * is what reported undelivered work as delivered in the first place.
 */
export async function issueDrop(
  context: CommandContext,
  options: { id: string; reason: string },
): Promise<CommandResult> {
  if (!options.reason.trim()) {
    return refused(
      new GateRefusal(
        "Dropping a unit records why it left the route.",
        `wfctl work issue drop ${options.id} --reason "<why it is not being built>"`,
        "An undated, unexplained drop is indistinguishable from work that was " +
          "forgotten.",
      ),
    );
  }
  return withIssue(context, options.id, (issue) => {
    const next: IssueRecord = {
      ...issue,
      status: "dropped",
      notes: [...issue.notes, `dropped: ${options.reason.trim()}`],
    };
    delete next.claim;
    return next;
  });
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
  /**
   * A unique name, created exclusively.
   *
   * Millisecond timestamps collided: twenty concurrent captures produced
   * sixteen files and twenty successes. Capture is the only sanctioned outlet
   * for a finding met during work, so a lost one is a finding nobody will meet
   * again.
   */
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(resolve(context.root, "changes/inbox"), { recursive: true });

  let path = "";
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = resolve(context.root, "changes/inbox", `${stamp}${suffix}.md`);
    try {
      await writeFile(candidate, "", { flag: "wx" });
      path = candidate;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  if (!path) {
    return refused(
      new GateRefusal("Could not create a capture file.", "wfctl doctor"),
    );
  }

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
    /**
     * Verification is a step, and every step runs the chain.
     *
     * It wrote `step: "verified"` directly and called neither `assertReached`
     * nor `assertRecall` — the one step-recording command that was not
     * `advance()`. A significant flow closed as completed in six commands with
     * no alignment, no framing, no units and no traversals.
     */
    assertNotParked(flow);
    assertReached(flow, "verified");
    assertRecall(flow, flow.step);

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
        at: new Date().toISOString(),
        attacks: review.attacks,
        findings: review.findings,
        stubSurvivors: review.stubSurvivors,
        fixedPoint: review.fixedPoint,
        source: resolve(options.review),
      },
    });

    return ok(
      compose([
        `review accepted from ${review.reviewer}: ${review.attacks.length} attack(s), ${review.findings.length} finding(s)`,
        await guidanceFor(context, "work/closed"),
        'next: wfctl work promotion draft "<area>/<page>.md"   (then: wfctl work close --outcome <completed|partial|abandoned>)',
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

  /**
   * Open units block too, not only claimed ones. Sixty-five undelivered units
   * closed as `completed` because only a claim was checked, and an open unit is
   * exactly the work nobody got to.
   */
  /**
   * Terminal is an allowlist. Filtering for `open` and `claimed` let anything
   * else through — the same denylist mistake the finding-status check had.
   */
  const unfinished = flow.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "dropped",
  );
  if (unfinished.length > 0) {
    return refused(
      new GateRefusal(
        `${unfinished.length} unit(s) are not terminal.`,
        `wfctl work issue complete ${unfinished[0]?.id}`,
        `${unfinished.map((issue) => `  ${issue.id}  ${issue.status}  ${issue.title}`).join("\n")}\n\n` +
          "Drop one deliberately if it left the route: wfctl work issue drop <id> --reason \"<why>\"",
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
    await writeFlow(context.root, {
      ...flow,
      step: "closed",
      closedAt: new Date().toISOString(),
      outcome: options.outcome,
    });
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
  options: { subject: string; summary: string; bundle?: string; settles?: string },
): Promise<CommandResult> {
  const { listQueue, promote: movePages, readOutcome } = await import("./promotion-queue.js");
  const { appendEvent, renderTrajectory } = await import("./trajectory.js");

  const queued = await listQueue(context.root);
  if (queued.length === 0) {
    return refused(
      new GateRefusal("Nothing is waiting to be promoted.", "wfctl work promotion list"),
    );
  }

  /**
   * The maintainer answers about one record. Taking `queued[0]` promoted
   * whichever sorted first — one record's pages entered the corpus on another's
   * authority, and the wrong subject's line recorded it forever. A single
   * queued record needs no naming; more than one does.
   */
  const bundle = options.bundle ?? (queued.length === 1 ? queued[0] : undefined);
  if (!bundle) {
    return refused(
      new GateRefusal(
        `${queued.length} records are waiting; name the one they answered about.`,
        `wfctl work promote --bundle ${queued[0]} --subject "<...>" --summary "<...>"`,
        queued.map((id) => `  ${id}`).join("\n"),
      ),
    );
  }
  if (!queued.includes(bundle)) {
    return refused(
      new GateRefusal(
        `${bundle} is not waiting to be promoted.`,
        "wfctl work promotion list",
        queued.map((id) => `  ${id}`).join("\n"),
      ),
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

  /**
   * Validate before anything is copied. A refusal here writes nothing and
   * leaves the pages in the queue, correctable — half a corpus is worse than
   * none, because the half that landed looks reviewed.
   */
  try {
    const { assertPromotable } = await import("./curated.js");
    const { inspectPage } = await import("./curated.js");
    const { readdir } = await import("node:fs/promises");
    const drafts = resolve(context.root, "changes/promotion", bundle, "promotion");
    const entries = await readdir(drafts, { recursive: true, withFileTypes: true }).catch(() => []);
    const issues = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = resolve(entry.parentPath ?? drafts, entry.name);
      const body = await readFile(path, "utf8");
      issues.push(...inspectPage(path.slice(drafts.length + 1), body));
    }
    assertPromotable(issues);

    /**
     * Abandoned work is not a delivery. The outcome was returned and dropped,
     * so a record closed as `abandoned` appended `axis: delivery` to the
     * subject's line — the one layer the maintainer is shown.
     */
    const outcome = await readOutcome(context.root, bundle);
    const trajectory = await appendEvent(context.root, options.subject, {
      summary:
        outcome === "abandoned"
          ? `abandoned: ${options.summary.trim() || options.subject.trim()}`
          : options.summary.trim() || options.subject.trim(),
      axis: outcome === "abandoned" ? "intent" : "delivery",
      claims: [],
      change: bundle,
      at: new Date().toISOString(),
      ...(options.settles ? { settles: options.settles } : {}),
    });
    const result = await movePages({ knowledgeRoot: context.root, bundleId: bundle });
    return ok(
      compose([
        `${result.pages.length} page(s) now in curated knowledge:`,
        result.pages.map((page) => `  knowledge/${page}`).join("\n"),
        `${bundle} archived at:\n${result.archived}`,
        renderTrajectory(trajectory),
      ]),
    );
  } catch (error) {
    if (error instanceof GateRefusal) return refused(error);
    throw error;
  }
}
