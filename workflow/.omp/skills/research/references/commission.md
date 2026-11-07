# Research Commission

Before spawning a researcher, prepare an assignment containing:

- **Objective:** What needs to be discovered and why.
- **Questions:** Specific questions the research must answer.
- **Context:** Relevant existing knowledge and constraints.
- **Scope:** What to investigate and what to exclude.
- **Deliverable:** Expected report and its exact path in `.reports/`.
- **Acceptance:** Conditions for considering the research complete.

## Principles

- Define the desired outcome, not a rigid investigation procedure.
- Give researchers freedom to follow relevant discoveries.
- Do not impose arbitrary source counts or report lengths.
- Reuse existing knowledge instead of commissioning duplicate work.
- Keep assignments focused, but allow follow-up questions.

## Researcher Responsibilities

- Investigate the assigned question thoroughly.
- Prefer primary sources, official documentation, and actual source code.
- Verify your own claims against the collected evidence.
- Compare conflicting information when relevant.
- Cite evidence for every significant technical claim.
- Record source URLs, relevant code locations, and verification dates.
- Distinguish established facts from interpretations and unknowns.
- Never invent sources, APIs, capabilities, or verification results.
- Do not conceal uncertainty or missing evidence.
- Never access the owner's browsers, browser profiles, cookies, saved passwords or keychain, and never pass browser cookies to download tools (for example `yt-dlp --cookies-from-browser`). Use a headless browser with a fresh, empty profile; if the project provides a shared browser tool, use it.

## Parallel Research

- Use a single researcher when the investigation is focused.
- Spawn multiple researchers when the work can be divided into independent questions.
- Give each researcher a clearly defined, non-overlapping scope.
- Allow intentional overlap only when independent perspectives are useful.
- Each researcher produces their own report.
- Keep each worker session alive until its deliverable is accepted.
- Preserve every accepted research report independently and in full in `research/inbox`.
- Never replace original reports with consolidated summaries.
- When combining research, create a separate knowledge note linking to the original reports and relevant findings.
- Preserve distinct findings, supporting evidence, disagreements, and unresolved questions.
- Consolidation must not silently discard information or erase provenance.
- Preserve disagreements, conflicting evidence, and unresolved questions.
- Delegate targeted follow-up research when necessary.
