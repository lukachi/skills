# Why wfctl exists

A project needs durable accounts of agreed deliveries, task contracts, decisions, and useful evidence. Agents also need a small place to recover their immediate working context after compaction or a new session. These are different needs.

`wfctl` serves those needs when the user chooses to use it. Ordinary work proceeds as it would with any agent. The tool does not decide that a request is significant, create a record because a session began, or gate source edits behind workflow steps.

A **bundle** describes an agreed delivery. It may hold one feature, several, or a milestone, and its scope can change by agreement. A **unit** is an agreed task contract within one bundle. A bundle need not have units. These are project records and are tracked as editable Markdown.

A **flow** is a short, local checkpoint and handoff for one agent thread. Its namespace is selected manually. It links to durable records where useful, but it does not own their contracts or accumulated progress. It is ignored by Git.

The agent may offer to preserve meaningful work at a natural pause. The offer names the proposed record and checks whether an existing bundle or unit already covers it. Declining leaves the ordinary work alone.

Tidying the live `changes/` area is semantic work with the user. Records may be merged, moved, clarified, or left separate according to their meaning. `changes/archive/` is outside that guide's boundary.

Promotion, review, and knowledge curation need their own future decisions. The current work contract is [`spec/OPTIONAL_WORK.md`](spec/OPTIONAL_WORK.md).
