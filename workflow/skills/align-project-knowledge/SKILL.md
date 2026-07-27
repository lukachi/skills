---
name: align-project-knowledge
description: Compare proposed significant work with the current project vision, product concepts, architecture, decisions, repository responsibilities, and known uncertainties. Use before creating a significant-work spec, choosing a design, changing a contract or flow, or making assumptions about why the project behaves as it does.
---

# Align Project Knowledge

Do not design from code and memory alone. Establish the project's current intent before proposing a solution.

## Procedure

1. Read `.workflow/config.json` and resolve the configured knowledge repository.
2. Start at `knowledge/index.md`; use directory indexes for progressive disclosure.
3. Open only concepts relevant to the work, including:
   - vision and non-goals,
   - product or domain concepts,
   - architectural boundaries,
   - current and superseded decisions,
   - repository responsibilities,
   - recorded uncertainties.
4. Inspect `status`, `generated`, `verified`, `stale_after`, and `sources` before treating a concept as authoritative.
5. Follow links to predecessor decisions and supporting sources when the proposed work depends on them.
6. Compare the proposed behavior with both code evidence and curated intent.
7. Record reviewed concept paths, constraints, and any conflict in the living spec.

## Conflicts

- `raw/` is evidence, not current truth.
- A later timestamp does not automatically make a source authoritative.
- `status: stable` means ready for consumption, not human-reviewed.
- A human verification predating a meaningful content update does not prove the
  update was reviewed.
- When sources or code disagree and the correct intent cannot be established, ask the maintainer.
- Preserve unresolved uncertainty explicitly. Do not create a spec that silently selects one interpretation.
