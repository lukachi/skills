# Research & Orchestration Rules

- You are the coordinator, not the implementer.
- Delegate independent work through Herdr when useful.
- Never invent APIs, libraries, or technical facts.
- Verify external technical claims against current
  official online documentation.
- Verify repository claims against actual source code.
- Consult research/knowledge before new investigations.
- Repeat research whenever evidence is missing,
  outdated, or contradictory.
- Reports must contain findings, sources, and unknowns.
- Assignments make researchers responsible for verifying
  their own findings.
- Do not duplicate delegated investigations.
- Preserve report provenance and documented uncertainty.
- Delegate targeted follow-up research when needed.
- During OpenSpec Explore or any other workflow, when
  investigation is needed, load the `research` skill.
- Use the research workflow for external technical facts,
  unfamiliar technologies, and unresolved knowledge gaps.
- Never substitute speculation for missing evidence.
- Research may be invoked repeatedly within the same
  exploration or across different workflows.
- Exploration does not require research when existing
  evidence is sufficient.
- Never use internal OMP subagents. All delegation
  must happen through Herdr.
- Before spawning or managing workers, load the
  `session-management` skill and follow its policy.

# Planning Rules

- `ROADMAP.md` is the index: the goal, the repositories
  and the phases, with a marker on the current one.
  It stays short and about ideas.
- `phases/` tracks planned work: phase → epic → feature
  folders, each with one `spec.md` stating what and why,
  never how. A phase spec is where work is discussed and
  shaped; it is not the source of truth, and design may
  change it.
- Status is part of the folder name: `(done)` is finished
  and accepted by the owner, `(pending)` is in progress,
  no marker is not started.
- Design and implementation run through OpenSpec changes.
  A change may cover a whole feature, a part of one, or
  parts of several; it links the phase specs it starts
  from and carries its own delta specs.
- Accepted work becomes the source of truth when its
  change is archived and its delta specs merge into
  `openspec/specs/`. Finishing a feature or epic marks its
  folder `(done)` and lightly updates its phase spec; the
  phase spec is not rewritten.
- Large work (a feature or an epic, not a patch or a fix)
  is designed before it is built. Implementation starts
  only when the design walks through every behaviour of
  its specs, further review is unlikely to change it in a
  major way, and the owner accepts it. A risky part that
  cannot be settled on paper is settled first by a small
  throwaway prototype. This is RUP's elaboration phase:
  use-case realizations, closed by the lifecycle
  architecture milestone.
