# Agent Development Guidance

Canonical source for reusable development skills, rules, and related guidance.

## Structure

Development areas are organized under `plugins/`. Each area may contain
different kinds of agent guidance instead of forcing everything into a single
global `skills/` directory.

```text
plugins/
└── client/
    ├── skills/
    │   └── <skill-name>/
    │       ├── SKILL.md
    │       └── references/    # optional, loaded only when needed
    └── rules/                  # reserved for future client rules
```

`plugins/client` is currently an organizational namespace, not an installable
Codex plugin. It intentionally has no `.codex-plugin/plugin.json` or marketplace
metadata.

## Client skills

| Skill | Scope |
| --- | --- |
| [api-integration](plugins/client/skills/api-integration/SKILL.md) | Typed transports, contracts, mock data, server state, queries, mutations, and cache invalidation |
| [code-quality](plugins/client/skills/code-quality/SKILL.md) | Code hygiene, type safety, automated linting, formatting, and verification |
| [components](plugins/client/skills/components/SKILL.md) | UI primitives, composition, effects, ownership, and async render states |
| [electron-integration](plugins/client/skills/electron-integration/SKILL.md) | Desktop native bridges, IPC, native modules, deep links, and updates |
| [file-structure](plugins/client/skills/file-structure/SKILL.md) | File placement, directory ownership, co-location, entrypoints, and structural changes |
| [forms](plugins/client/skills/forms/SKILL.md) | Form state, schemas, validation, submission, and server field errors |
| [localization](plugins/client/skills/localization/SKILL.md) | Translation keys, resources, interpolation, and typed enum labels |
| [logging-errors](plugins/client/skills/logging-errors/SKILL.md) | Logging, reporting, feedback, typed outcomes, and sensitive data |
| [routing](plugins/client/skills/routing/SKILL.md) | URL contracts, page trees, layouts, guards, navigation, and router composition |
| [state-management](plugins/client/skills/state-management/SKILL.md) | Client state, persistence, selectors, hydration, and secure storage adapters |

## Content boundaries

- Keep technology-specific guidance when the technology is part of the skill's
  declared scope.
- Do not include product names, organization names, repository paths, custom
  protocols, business entities, or examples copied from a specific product.
- Use neutral resource and operation examples that can transfer between
  codebases.
- Keep each rule in the skill that owns it and cross-reference that skill from
  related topics.
- Keep `SKILL.md` procedural and concise. Put optional detailed patterns in
  `references/`.

## Status

The client collection is a legacy baseline under active review. Its canonical
location and domain-neutral boundary are established; each skill's technical
guidance still needs an explicit review before it should be considered current
best practice.
