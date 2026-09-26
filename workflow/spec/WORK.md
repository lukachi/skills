# Bundle and unit contract

This document defines the active project records.

## Bundle

A bundle is an agreed scope for a delivery. The delivery may be a feature, a group of features, a milestone, or another meaningful batch chosen with the user. Scope can grow or change through agreement. A bundle can have zero units.

The canonical document is `changes/active/<bundle-id>/change.md`. It records the agreed delivery scope, later decisions or scope changes, progress and outcome, and evidence or references. It is human-editable Markdown and tracked by Git.

An agent checks existing scopes before offering or creating a new bundle. The user's request to do work is not itself an instruction to create one. An ignored or declined offer creates nothing. The CLI refuses creation over an existing bundle directory.

## Unit

A unit is an agreed contract for one specific task within exactly one bundle. It records an intended outcome, boundary, progress and decisions, and completion evidence. It is not a flow segment, source file, action, bug, agent session, or automatic subdivision of a bundle.

The canonical document is `changes/active/<bundle-id>/units/<unit-id>.md`. The CLI creates a unit only under an existing bundle using the current Markdown contract, with agreement text. It refuses an existing unit file. Agents may edit the document as work proceeds; a changed task contract or bundle scope needs agreement.

## Supporting information

Keep useful research, plans, specifications, and evidence with the relevant delivery when their meaning warrants retention. Distinguish durable material from reproducible or disposable output by reading its contents and purpose, not by file name alone. Do not blanket-ignore a directory that may contain durable material. The bundle and unit documents link to supporting files; they do not have to duplicate them.

## Tidying

Tidying covers `changes/` except `changes/archive/`. The agent investigates meaning and relationships, proposes a bounded scope, and brings semantic changes to the user. Merging, splitting, renaming, or cleaning bundles and units may be appropriate; no CLI state machine decides those changes. See the installed [tidying guide](../templates/skill/wfctl/references/tidying.md).
