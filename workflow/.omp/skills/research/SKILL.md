---
name: research
description: Reusable workflow for delegated research, evidence collection, and knowledge preservation.
---

# Research

Research is a repeatable activity, not a mandatory stage.
It can happen during exploration or whenever knowledge is needed.
It does not require an OpenSpec change.

## Workflow

1. Read [Knowledge Management](references/knowledge.md).
   Consult existing knowledge and identify gaps.

2. When investigation is needed, read:
   - [Research Commission](references/commission.md)
   - [Report Contract](references/report.md)

3. Prepare the assignment and read
   [Worker Lifecycle](references/lifecycle.md).

4. Spawn a dedicated researcher through Herdr.
   Include the assignment, researcher responsibilities,
   and full report contract in the initial prompt.

5. Assess the delivered report against the assignment
   and report contract. Do not repeat the investigation.

6. If unsatisfactory, return specific feedback to the
   same worker. Continue until accepted.

7. Preserve the accepted report in `research/inbox`.
   Update `research/knowledge` when findings are reusable.

8. Close the accepted worker session through Herdr.

9. Repeat targeted research whenever new questions arise.

## Principles

- The coordinator manages research, not the investigation itself.
- Researchers own the quality of their evidence.
- Workers do not need OpenSpec skills or Store access.
- Preserve provenance and documented uncertainty.
- Follow the referenced contracts throughout the workflow.
- Before operating Herdr, load the `herdr` skill.
- Follow its documented commands for spawning,
  communicating with, and closing worker sessions.
- Never invent Herdr commands or lifecycle behavior.
