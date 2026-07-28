# Workflow routing

Classify work before changing product or implementation state. Creating a
`shaping` record is safe recordkeeping, not implementation.

Use the full workflow when work may change observable behavior, domain meaning, interfaces, data or control flow, persistent state, security, reliability, architecture, operational behavior, or coordination across components or repositories.

Skip the full workflow only when the change is clearly local and preserves behavior and contracts, such as presentation-only polish, copy edits, formatting, or a mechanical correction with no design choice.

If classification is uncertain, explain the possible impact and ask the maintainer whether to use the full workflow. Recommend one answer. If the maintainer declines, proceed lightly and offer `wfctl work handoff` before closing so reusable findings enter `changes/inbox/` without becoming authoritative history.

Never use task size alone as the classifier. A one-line contract change can be significant; a large mechanical rewrite can be lightweight.

Once work is classified as significant, create its shaping record before
extended discussion so requirements and decisions survive session compaction.
