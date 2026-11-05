# Research Worker Lifecycle

- Spawn a dedicated Herdr worker for each research assignment.
- Never assign research to an unrelated existing worker.
- Launch workers in their assigned working directories.
- Tell each worker the exact report path, to write the report there and nowhere else, and to return that path through Herdr.
- Workers do not need OpenSpec skills or other access to the Store.
- Keep the worker session alive until the deliverable is accepted.
- If the result is unsatisfactory, provide specific feedback and let the same worker continue.
- Only the coordinator accepts deliverables and closes worker sessions.
- Worker context management is governed by separate rules.

## Shared Session Management

Before spawning or managing research workers,
load the `session-management` skill.

Follow its delegation, lifecycle, context management,
and monitoring policies.

Research-specific report acceptance remains governed
by this research workflow.
