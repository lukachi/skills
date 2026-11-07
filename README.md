# Agent Development Guidance

Canonical source for reusable development skills, rules, and related guidance.

## Structure

Development areas are organized under `plugins/`. Each area may contain
different kinds of agent guidance instead of forcing everything into a single
global `skills/` directory.

```text
plugins/
├── client/
│   ├── skills/
│   │   └── <skill-name>/
│   │       ├── SKILL.md
│   │       └── references/    # optional, loaded only when needed
│   └── rules/                  # reserved for future client rules
└── herdr/
    └── skills/
        └── <skill-name>/
            ├── SKILL.md
            └── references/
```

`plugins/client` is currently an organizational namespace, not an installable
Codex plugin. It intentionally has no `.codex-plugin/plugin.json` or marketplace
metadata. `plugins/herdr` follows the same convention.

## Client skills

| Skill | Scope |
| --- | --- |
| [api-integration](plugins/client/skills/api-integration/SKILL.md) | Typed transports, contracts, mock data, server state, queries, mutations, and cache invalidation |
| [code-quality](plugins/client/skills/code-quality/SKILL.md) | Code hygiene, type safety, automated linting, formatting, and verification |
| [components](plugins/client/skills/components/SKILL.md) | UI primitives, composition, effects, ownership, and async render states |
| [error-handling](plugins/client/skills/error-handling/SKILL.md) | Error ownership, propagation, reporting, retry, recovery, and failure boundaries |
| [file-structure](plugins/client/skills/file-structure/SKILL.md) | File placement, directory ownership, co-location, entrypoints, and structural changes |
| [forms](plugins/client/skills/forms/SKILL.md) | Form state, schemas, validation, submission, and server field errors |
| [localization](plugins/client/skills/localization/SKILL.md) | Source-text keys, context, typed resources, interpolation, plurals, and enum labels |
| [logging](plugins/client/skills/logging/SKILL.md) | Structured records, child loggers, transports, persistence, and runtime delivery |
| [native-integration](plugins/client/skills/native-integration/SKILL.md) | Modular native RPC, typed handlers, renderer clients, capabilities, and host registries |
| [routing](plugins/client/skills/routing/SKILL.md) | URL contracts, page trees, layouts, guards, navigation, and router composition |
| [state-management](plugins/client/skills/state-management/SKILL.md) | Client state, persistence, selectors, hydration, and secure storage adapters |
| [user-feedback](plugins/client/skills/user-feedback/SKILL.md) | Contextual success, warning, error, fallback, and recovery presentation |

## Herdr skills

Tool-specific skills for the Herdr desktop app. Herdr is their declared scope, so
they name Herdr's files, commands, and APIs directly.

| Skill | Scope |
| --- | --- |
| [herdr-mods-layouts](plugins/herdr/skills/herdr-mods-layouts/SKILL.md) | Herdr window layouts, gpui-kit mods, themes, key bindings, debugging, installing, and gallery sharing |
| [opengpui](plugins/herdr/skills/opengpui/SKILL.md) | Show a person native UI in a Herdr pane with OpenUI Lang (forms, tables, cards, approvals) and get their input back; copy of [openGPUI](https://github.com/lukachi/openGPUI)'s `skills/opengpui`, which is the source |

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

The client collection is the canonical, actively maintained source for these
development practices. Continue validating the guidance against real projects
and update the owning skill when practice exposes a missing case.
