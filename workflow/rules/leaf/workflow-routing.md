# Workflow routing

Classify work before changing project state.

Use the full workflow when work may change observable behavior, domain meaning, interfaces, data or control flow, persistent state, security, reliability, architecture, operational behavior, or coordination across components or repositories.

Skip the full workflow only when the change is clearly local and preserves behavior and contracts, such as presentation-only polish, copy edits, formatting, or a mechanical correction with no design choice.

If classification is uncertain, explain the possible impact and ask the maintainer whether to use the full workflow. Recommend one answer. If the maintainer declines, proceed lightly and offer a compact handoff record before closing.

Never use task size alone as the classifier. A one-line contract change can be significant; a large mechanical rewrite can be lightweight.
