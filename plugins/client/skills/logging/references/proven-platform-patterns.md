# Proven Platform Patterns

Use these compact shapes when adapting the logging foundation to a concrete
client runtime. They are examples of the same contract, not four competing
logger designs.

## Web

Place a reusable facade in a package when several workspace modules or
applications can consume it. Keep browser persistence application-owned:

```text
packages/logger
    -> contract, factory, console transport

apps/web/core/logger
    -> configured web root
    -> IndexedDB transport
```

The IndexedDB transport owns batching, retention, queries, export, and mapping
between the current common record and any legacy stored schema.

New errors should receive the transport's minimal string fallback before JSONL
export. Other non-cloneable context still fails best effort; do not add a
recursive common serializer.

## React Native

In a single-application repository, prefer an application module over an
artificial workspace package:

```text
core/logging/index.ts
    -> facade and process-local root

core/logging/transports/native-file.ts
    -> buffer, JSONL, rotation, native filesystem
```

Initialize once before application features start. Register a best-effort flush
when the established app lifecycle leaves the active state. Skip the native
file transport on web.

Keep filesystem behavior inside the transport and test the installed API
version. In particular, determine whether move/rename operations mutate the
source object before using them for rotation.

## Electron

Use one package with explicit runtime entrypoints:

```text
logger
├── index.ts
├── native/client.ts
├── native/main/index.ts
└── preload.ts
```

- `index.ts` is Electron-free.
- `native/client.ts` configures renderer console plus bounded batch RPC.
- `native/main/index.ts` configures main console plus file persistence and
  registers `writeBatch`.
- `preload.ts` owns a console-only process-local root.

The renderer transport should only be installed when the preload bridge exists,
so browser previews and Storybook remain valid consumers. The main handler
writes received records straight to the file transport.

Keep incident capture in error handling:

```ts
log.error("Workspace load failed", error, { workspaceId })
reporting.captureException(error)
```

The reporting layer may use a breadcrumb transport, but the logger must not
automatically turn every error record into an incident.

When the renderer also uses OpenReplay or another session provider, keep its
event adapter in that provider package:

```text
feature logger.event(...)
    -> renderer logger
        -> console and file transports
        -> OpenReplay event transport
```

The provider transport forwards only explicit event records. Exception capture
remains an error-reporting decision, while initialization, identity, consent,
and reset remain provider control operations.

## Electrobun

Use the same package split, replacing Electron entrypoints with the repository's
Electrobun native-module conventions:

```text
renderer logger
    -> console
    -> bounded writeBatch client

Bun handler registry
    -> validate batch
    -> host file transport
```

Register `writeBatch` in the native handler/module registry. If the repository
also derives agent capabilities from handler definitions, leave logging
unexposed unless it has explicit capability metadata.

The host file transport may resolve its own application-data location or
receive a public resolver from the composition root. Do not reach into another
package's private filesystem implementation.

## Shared Proof Obligations

Across all four variants, verify:

- shallow scope and context snapshots;
- original local error identity before a boundary;
- boundary-local lossy error strings;
- bounded async queues and deterministic flush;
- independent transport failures;
- stable persisted schemas or explicit adapters;
- no native requests when the native bridge is absent;
- no host re-logging of renderer records.
- explicit event identity preserved across transports;
- no accidental promotion of ordinary `info` logs into remote events.
