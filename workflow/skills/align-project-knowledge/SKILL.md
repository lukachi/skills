---
name: align-project-knowledge
description: Align a significant task's shaping spec with current project purpose, Areas, capabilities, flows, architecture, decisions, repository responsibilities, and known uncertainties. Use after the shaping record exists and before choosing a design, approving framing, changing a contract or flow, or making assumptions about why the project behaves as it does.
---

# Align Project Knowledge

Do not design from code and memory alone. Establish the project's current intent before proposing a solution.

## Procedure

1. Read `.workflow/config.json` and resolve the configured knowledge repository.
2. Inspect the current session skill catalog and require the official native
   `qmd` skill. Invoke it before retrieval. If it is absent, stop and ask to
   run `wfctl upgrade` or reinstall the selected project/user skills, then
   restart the agent session. An on-disk file alone does not prove the running
   agent loaded it.
3. Run QMD from that knowledge root. Require `qmd status`; if QMD or the
   project-local `.qmd/index.yml` is missing, stop and report the broken
   workflow environment.
4. Run `wfctl knowledge build --target <knowledge-root>`. Stop alignment if
   validation or graph compilation fails; do not silently reason over broken
   navigation. The generated
   `.workflow/current/knowledge-graph.json` is disposable navigation, never
   authority and never an edit target.
5. Start at `knowledge/index.md`, then use `qmd search ... -c knowledge` for
   exact terms or a structured `qmd query` with authored `intent:`, `lex:`,
   `vec:`, and when useful `hyde:` fields for hybrid retrieval.
   If QMD MCP is available, use `query` with
   `collections: ["knowledge"]`. Open the returned concepts directly and use
   directory indexes for progressive disclosure. Retrieval ranking is not
   authority.
6. Expand the QMD candidates through explicit incoming and outgoing edges in
   the compiled graph. Follow material typed relationships, Area ownership,
   decision lineage, and human-authored links so lexical similarity does not
   define the task boundary.
7. Open only concepts relevant to the work, including:
   - vision and non-goals,
   - the relevant Area index, capabilities, concepts, rules, and flows,
   - architectural boundaries,
   - current and superseded decisions,
   - repository responsibilities,
   - recorded uncertainties.
8. Inspect `status`, `generated`, `verified`, `stale_after`, and `sources` before treating a concept as authoritative.
9. Follow links to predecessor decisions and supporting sources when the proposed work depends on them.
10. Compare the proposed behavior with both code evidence and curated intent.
11. Treat only `knowledge/` as the default current-knowledge surface. Do not
   consult `raw/` or `intake/` to fill a gap.
12. Record QMD queries, graph-expanded concept paths, directly reviewed
    concept paths, constraints, and any conflict in the living spec.

When a living spec already exists, run `wfctl work status <id>` first. Read
curated knowledge from its `Knowledge root`, update only its exact `Spec` path,
and inspect implementation only from its exact `Code root`. Do not treat the
spec's repository as the implementation checkout.

## Conflicts

- `raw/` is neither evidence nor current truth. It is an untrusted clue source
  used only through `process-raw-intake`.
- A later timestamp does not automatically make a source authoritative.
- `status: stable` means ready for consumption, not human-reviewed.
- A human verification predating a meaningful content update does not prove the
  update was reviewed.
- When sources or code disagree and the correct intent cannot be established, ask the maintainer.
- Preserve unresolved uncertainty explicitly. Do not create a spec that silently selects one interpretation.
