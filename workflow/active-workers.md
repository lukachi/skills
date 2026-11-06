# Active Workers

Active Herdr worker assignments managed by the coordinator.

| Worker | Working Directory | Assignment | Reference |
|---|---|---|---|

<!--
Reference:
- OpenSpec: change name + task ID
- Research: research topic or expected report path
- Other: relevant task or document

This file tracks assignments, not session statuses.
Herdr provides actual session state.
-->

## Model allocation

The coordinator sets the model and effort of every worker at spawn (`omp --model <model> --thinking <effort>`) and never changes them mid-session. The table reflects Claude Opus 5.5 and Sonnet 5.5 as of November 2026; re-check it against current research when models change.

| Work | Model | Effort | Why |
|---|---|---|---|
| Coordination, architecture and design (the coordinator) | Opus | `high` | Judgment-heavy and small in tokens; Opus leads on long, ambiguous work. |
| External research | Opus | `medium` | Wrong facts end up in specs; Opus made the fewest factual errors. |
| Code reconnaissance: mapping owners, seams and flows with `file:line` evidence | Sonnet | `high` | Factual mapping, matching Opus on well-scoped reading at half the price. The coordinator spot-checks claims. |
| Assessments that need judgment (reuse of existing code, fit of an existing mechanism) | Opus | `medium` | Open-ended evaluation, where Sonnet trails. |
| Throwaway prototypes of risky parts | Opus | `medium` | The risk is choosing the wrong approach, and more effort does not fix that. |
| Implementing a well-specified slice with acceptance checks | Sonnet | `high` | Equal serious defects and green tests at about a third lower cost in practitioner measurements; budget one fix round. |
| Implementing ambiguous, cross-cutting or performance-sensitive work, or work in a language where Sonnet has not proven itself | Opus | `medium` | Opus leads on multi-file judgment. |
| Mechanical migrations with a compile or test oracle | Sonnet | `high` | Cheap when a check catches failures. |
| Tests | same worker as the implementation | — | Split work on context boundaries, not roles. |
| Review of behaviour, shared contracts or cross-cutting changes | Opus | `medium`; `high` when the review gates integration | Review recall on hard bugs is where Opus leads most; `high` mainly cuts false alarms. Deterministic checks run first. |

Rules:
- No `max`. `xhigh` only for a one-off hard problem that already failed at `high`. Sonnet never above `high`: switch to Opus instead. Never `low` for work that must be verified.
- Escalation: the worker skipped files or checks, or stopped early → raise effort; it had the context and was confidently wrong → switch to Opus.
