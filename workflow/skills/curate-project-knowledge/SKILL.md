---
name: curate-project-knowledge
description: Reconcile raw work records, archived specs, code evidence, external sources, and maintainer testimony into the curated OKF project knowledge bundle. Use when bootstrapping knowledge from legacy raw files, converging new work into current truth, changing project vision or concepts, recording or superseding decisions, resolving contradictions, or maintaining knowledge indexes and history.
---

# Curate Project Knowledge

Curate current truth without erasing evidence or manufacturing certainty.

## Procedure

1. Define the topic or bounded raw set being reconciled.
2. Invoke `analyze-with-graphify` to map related raw records, curated concepts, decisions, repositories, and code evidence.
3. Establish provenance for each material claim.
4. Separate:
   - original intent,
   - later decisions,
   - implementation reality,
   - superseded behavior,
   - unresolved contradiction.
5. Ask the maintainer when chronology or authority cannot be established.
6. Update or create the smallest set of OKF concepts that expresses current truth.
7. Preserve previous decisions:
   - link the successor to the predecessor,
   - mark the predecessor `deprecated`,
   - explain what changed and why.
8. Set honest `generated`, `verified`, `status`, `stale_after`, and `sources`.
9. Update affected `index.md` and newest-first `log.md`.
10. Validate the bundle and report draft or unresolved concepts.

Read [the knowledge model](references/knowledge-model.md) before first-time convergence or decision migration.
