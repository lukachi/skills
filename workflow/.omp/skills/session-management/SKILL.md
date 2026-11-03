---
name: session-management
description: Coordinate Herdr workers, manage their lifecycle, and handle model-specific context maintenance.
---

# Session Management

The coordinator owns all Herdr worker sessions.

Use this skill whenever spawning, supervising,
resuming, or closing workers.

Load the `herdr` skill for actual Herdr operations.
Never invent commands already covered by Herdr.

## Execution Strategy

Before starting implementation, discuss the execution
strategy with the owner.

Consider the actual task, repositories, dependencies,
parallelism, isolation needs, and available tools.

Recommend an approach appropriate to the situation.
Do not impose a fixed execution strategy, mandatory
worktrees, or predefined delegation patterns.

Agree on the approach before launching implementation
workers. Keep the discussion proportional to the
complexity of the work.

## Execution Autonomy

- Once the execution strategy is agreed upon, proceed
  autonomously within the approved scope.
- Do not request confirmation for decisions that can
  be resolved from existing requirements, research,
  design, or established project conventions.
- Make reasonable implementation decisions independently.
- Escalate only genuinely new decisions that require
  changing the agreed scope, requirements, or direction.
- Never block unrelated work while awaiting a decision.
- Do not ask the owner to approve your own recommendation
  when the decision is already within your authority.

## Delegation

- Spawn workers exclusively through Herdr.
- Never spawn internal OMP subagents.
- Never bypass this restriction through shell commands.
- Launch workers in their assigned working directories.
- Pass the worker restrictions and assignment explicitly
  in every initial prompt.
- Workers must not spawn or manage other agents.
- Workers focus exclusively on assigned work.

## Lifecycle

- The coordinator owns worker session management.
- Monitor workers using Herdr's native observability.
- Idle does not necessarily mean completed.
- Keep workers alive while their work needs corrections.
- Close workers after their deliverables are accepted,
  or when the owner explicitly cancels their assignments.
- On cancellation, stop the worker, preserve relevant
  work, and remove its active assignment record.
- Never close a worker merely because its context is growing.

## Assignment Tracking & Recovery

Use `active-workers.md` in the Store root to track
active Herdr worker assignments across handoffs.

### Before Spawning

- Read `active-workers.md`.
- Check whether the requested work is already assigned.
- Reuse an existing worker when appropriate.
- Never spawn duplicate workers for the same assignment.
- Record the planned worker name, working directory,
  assignment, and reference before launching.
- After spawning, update the record with the actual
  Herdr worker identity if different.

### During Work

- Keep assignments recorded until accepted and closed.
- Update records when assignments change.
- Use Herdr for actual worker status and monitoring.
- Use OpenSpec tasks for implementation progress.
- Do not create additional tracking systems.

### After Handoff or Restart

- Read `active-workers.md` before managing workers.
- Reconcile recorded assignments with actual Herdr
  sessions using the Herdr skill.
- Continue supervising existing workers.
- Do not spawn replacements for uncertain sessions
  until their actual state has been established.
- Resolve missing or stale records before proceeding.

### On Completion

- Accept the deliverable using the relevant workflow.
- Update OpenSpec tasks or preserve research reports
  as appropriate.
- Close the accepted worker through Herdr.
- Remove its entry from `active-workers.md`.

## Context Management

### GPT Workers

- Do not manually manage their context.
- Leave context maintenance to OMP.
- Do not initiate compaction or handoff.
- Continue normal lifecycle supervision.

### Claude Opus Workers

Applies to Opus workers with a 1M-token context window.

- Monitor context utilization using available tools.
- At approximately 60%, begin planning a handoff.
- Do not interrupt ongoing coherent work immediately.
- Ask the worker to finish its current coherent unit
  and reach a clean stopping point.
- Wait until the worker is ready for input.
- Initiate `/handoff` through Herdr.
- Confirm successful completion.
- Tell the same worker to resume its assignment.
- Never substitute `/compact` for `/handoff`.
- Do not let workers initiate manual handoffs themselves.

## Worker Launch Configuration

- Resolve the absolute Store directory before spawning.
- Launch workers with the Store's `.omp/config.yml`
  as an explicit OMP `--config` overlay.
- For Opus 1M workers, additionally pass
  `.omp/policies/opus.yml`.
- Do not pass the Opus overlay to GPT workers.
- Select the worker model separately from the overlays.
- Use the Herdr skill for the actual launch procedure.
- Do not install OpenSpec or project skills into
  target repositories just to launch workers.

## Pause & Resume

When the owner requests a pause:

- Read `active-workers.md` and reconcile with Herdr.
- Send `/pause` to active OMP workers through Herdr.
- Verify that each worker reached its paused state.
- Do not close sessions, abort work, or modify assignments.
- Report readiness so the owner can pause the coordinator last.

When the owner resumes the coordinator:

- Reconcile `active-workers.md` with Herdr.
- Resume paused workers using the appropriate
  interactive keys, not a new task prompt.
- Check that workers resume normally.
- If a worker remains idle unexpectedly, inspect its
  state and gently remind it of its existing assignment.
- After resuming a worker, observe its actual state.
  Do not send additional prompts if work resumes normally.
- If a worker remains idle, inspect its latest output
  and determine whether its assignment is still incomplete.
- Only if unfinished work is awaiting input, send a brief
  continuation prompt referencing the existing assignment.
- Do not restart completed work or duplicate instructions.
- Handle blocked workers according to their actual blocker,
  rather than blindly prompting them to continue.

## Soft Supervision

- Periodically inspect active workers through Herdr
  while coordinating ongoing work.
- Use bounded waits; never block orchestration
  indefinitely on a single worker.
- Do not mistake activity for meaningful progress.
- If a worker appears stalled, inspect its recent output
  before intervening.
- Distinguish legitimate long-running work from deadlocks,
  repeated failures, and unnecessary operations.
- When progress is unclear, ask the worker for a brief
  explanation without restarting its assignment.
- Discourage unnecessarily broad tests, builds, or
  expensive operations when narrower checks suffice.
- If an operation is clearly wasteful or stuck, help
  the worker stop it safely and continue productively.
- Never interrupt healthy work merely because it is slow.
- Resolve routine execution problems autonomously.
- Prefer targeted intervention over blanket restrictions.

## Reliability

- Never invent context utilization measurements.
- If context telemetry is unavailable, do not guess.
- Verify session state before sending control commands.
- Do not blindly retry commands with uncertain outcomes.
- Prefer native Herdr and OMP mechanisms over custom scripts.
