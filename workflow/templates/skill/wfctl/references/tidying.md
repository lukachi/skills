# Tidying `changes/`

Read this when the user asks to tidy the repository's `changes/` area or describes a similar need. This guide helps the agent investigate and reason with the user. It is not a CLI state machine or a fixed classification scheme.

## Boundary

This guide applies to everything under `changes/` except `changes/archive/`. Read references outside it when they are needed to understand a record, but changes outside this boundary require a separate request. Do not tidy archived records through this guide.

## What tidying means

Tidying is a collaborative reconciliation of a chosen area within that boundary. The agent finds out what work each record represents, how the records relate, and which information is current, duplicated, superseded, misplaced, or missing. That inquiry can lead to merging or cleaning up bundles and units, changing their boundaries, reorganizing supporting files, or leaving distinct records separate. The user settles changes to agreed scope and meaning; the agent makes the repository reflect those decisions.

The result should let a person or a fresh agent locate the right record, understand what was agreed and delivered, follow the supporting information, and distinguish current understanding from history. Count fewer files only when the semantics warrant it. Keep unique information and its origin understandable through any merge or move.

The user can start with a broad request. Do not assume a bundle, unit, flow, directory, or file type is the right starting point. First learn what feels confusing or hard to find, then inspect enough of the repository to propose a useful scope.

## Where to look

- Begin with the user's examples and the repository's own entry points: its instructions, indexes, and documented conventions.
- Inspect the relevant folders and actual file contents, especially bundle scopes, unit contracts, their progress and evidence, records that appear related, older versions, untracked or ignored material, and nearby source files when they explain a record.
- Follow references in both directions: what points to a file, and what that file relies on. Use Git history when a move, split, or merge has obscured the origin of an idea.
- Check live work before touching shared files. Another agent's active edits or local recovery notes may explain an apparent inconsistency.

Paths, titles, and status labels are clues, not proof. A file's role comes from its content, its links, the decisions around it, and how people use it.

## What to think through

Ask what each piece of information is for, who agreed to it, whether it is current, and what would be lost if it moved or disappeared. For bundles and units, compare their agreed boundaries and actual delivery before deciding whether they represent the same work, related work, or separate commitments. Look for duplicated accounts, conflicting claims, missing links, misleading names, unclear ownership, and material that is difficult to find or recover. Separate what the files demonstrate from what the agent infers. Do not resolve a real disagreement by choosing the tidier-looking text.

Consider whether the proposed change only improves navigation or whether it changes an agreed meaning. The second case needs a decision from the user. Do not turn every discovered file or task into a new wfctl record merely to make the layout look regular.

## Work with the user

After an initial read-only pass, offer a bounded scope and explain why it is the useful place to start. Show the important relationships you found, including any bundles or units proposed for merging or cleanup, the specific changes you recommend, and the semantic questions that remain. Give the user enough context to confirm the scope and settle those questions without making them classify every file.

Carry out the agreed changes in reviewable portions. If deeper reading changes the meaning of the proposed work, bring the new decision back to the user. At the end, show what became easier to find or understand, what moved or merged, and what remains uncertain. Check the resulting references and repository state as part of the agent's work.

## How this guide is used

An installed agent instruction should point here when the user asks to tidy up. The guide is useful even when no wfctl bundle, unit, or flow exists. Using it does not itself create one.
