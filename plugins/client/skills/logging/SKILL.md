---
name: logging
description: Use whenever work adds, changes, reviews, debugs, or consumes application logging in web, React Native, Electron, Electrobun, or another client runtime. Trigger for logger calls, structured log or event records, child loggers, scopes and context, log levels, console usage, transports, browser or native persistence, Electron renderer-to-main logging, logging RPC, batching, buffering, flushing, file logs, Sentry or OpenReplay integration, telemetry breadcrumbs, tracked application events, or deciding where logging infrastructure belongs, even if the request only mentions diagnostics, traces, persisted logs, analytics events, or replacing console calls.
---

# Logging

Use one structured logging contract and facade across client runtimes. Keep
platform delivery behind transports so application code does not know whether a
record goes to a console, browser storage, a native file, or another process.

Logging records diagnostic facts. It does not decide how an error is handled,
whether a user sees feedback, whether an operation retries, or whether an
exception becomes a tracked incident.

Explicit application events may use the same facade and transport pipeline when
the record keeps its event identity. Do not infer analytics events by parsing
ordinary human-readable log messages.

## Inspect Before Extending

Before changing logging:

1. Find the public logger facade and its factory.
2. Find where the root logger is configured for each runtime.
3. Find registered transports and their lifecycle.
4. For desktop applications, trace renderer-to-host delivery and identify which
   runtime owns file access.
5. Check whether the repository already has log persistence, retention,
   telemetry breadcrumbs, or an established privacy policy.

Extend the existing foundation when it preserves the boundaries below. Do not
create a second application logger for one feature or runtime.

## Keep One Contract, Not One Runtime Instance

Main, renderer, preload, workers, browser pages, and React Native JavaScript run
in separate environments. They cannot share one physical singleton.

Provide:

- one platform-neutral logger contract;
- one logger factory and facade behavior;
- one process-local root logger per runtime;
- platform transports selected at the runtime's composition root.

Place that contract at the narrowest real common owner. A monorepo with several
runtimes may justify a package; a single React Native application may only need
`core/logging`. Do not manufacture a package boundary that has no consumers.

Feature code imports only its configured logger facade. It must not import file
writers, RPC clients, telemetry SDKs, or storage adapters merely to emit a log.

## Use A Direct Record Flow

Keep the core pipeline small:

```text
logger method
    -> merge child scope
    -> create one structured log or event record
    -> fan out to configured transports
```

Do not insert generic normalization, conversion, sanitization, enrichment, or
middleware chains. A transport may perform the smallest representation change
required by its own boundary. Keep that change inside the transport.

Read `references/facade-and-records.md` when defining or changing the logger
contract, record shape, child behavior, messages, levels, or error argument.

## Separate Stable Scope From Event Context

Use `child(...)` for values repeated by several records:

```ts
const log = logger.child({
  module: "authentication",
})

const refreshLog = log.child({
  operation: "refresh-session",
  requestId,
})
```

Pass values belonging to one event to the log method:

```ts
refreshLog.info("Session refreshed", {
  userId,
  expiresAt,
})
```

When the facade supports explicit tracked events, use the dedicated method:

```ts
const mtlsLog = logger.child({ module: "mtls" })

mtlsLog.event("mtls_provision", {
  method: "jwt",
})
```

The event name is a stable machine contract. It is not an ordinary `info`
message reinterpreted later by a telemetry transport.

Keep scopes small and mostly flat. Prefer identifiers and operational metadata
over entire entities or live runtime objects.

Snapshot the scope and event context shallowly when creating a logger or record
so later caller mutation cannot change a queued record. Do not deep-clone or
walk values; callers should provide small, boundary-compatible fields.

Use stable human-readable messages and put variable values in context:

```ts
// Avoid
log.info(`Project ${projectId} opened`)

// Prefer
log.info("Project opened", { projectId })
```

## Choose Levels By Meaning

- `debug`: detailed diagnosis that may be disabled or dropped.
- `info`: a meaningful lifecycle event, state transition, or completed action.
- `warn`: an unexpected but recoverable state or an applied fallback.
- `error`: a failed operation or diagnostic error event.

Do not log every function call or every successful request. Logging volume must
remain useful enough to inspect.

Let each transport choose its own level threshold. Feature code must not know
whether a particular environment persists `debug`, `info`, or only higher
levels.

An explicit application event is a separate record kind, even when its local
console or file representation uses the `info` level.

## Compose Platform Transports At Bootstrap

The logger facade should exist before optional platform services initialize.
Keep a console transport available as the early and emergency fallback, then
register persistence, RPC, or telemetry transports at bootstrap.

- Web may use console, browser persistence, and remote transports.
- React Native may use console, native persistence adapters, and telemetry.
- Electron or Electrobun main may use console and native file transports.
- Electron or Electrobun renderer may use console and a buffered RPC transport
  that delivers records to the host-owned file transport.
- Tests may use an in-memory or no-op transport.

Provider-specific telemetry transports belong to the provider integration
module. For example, an OpenReplay renderer package may expose a transport that
maps explicit event records to `trackEvent`, while application features remain
unaware of OpenReplay.

Read `references/platform-transports.md` when adding transports, file
persistence, Electron renderer-to-main delivery, batching, flushing, or
transport lifecycle.

Read `references/proven-platform-patterns.md` for compact web, React Native,
Electron, and Electrobun implementation shapes and the edge cases they expose.

## Keep Transports Isolated

A transport must never break application behavior or prevent another transport
from receiving a record.

- Keep logger methods synchronous from the caller's perspective.
- Put queues and batching inside asynchronous transports, not the core logger.
- Bound every queue.
- Make registration idempotent and removable for tests, HMR, and teardown.
- Support best-effort `flush()` and `dispose()` where a transport needs them.
- Report a broken transport directly through a guarded console fallback, not
  through the same logger.

Do not hide an unbounded pre-initialization queue in the logger. Early records
may go only to the console until optional transports are ready.

## Keep Platform Boundaries Honest

In a desktop renderer, file access belongs to the privileged host. Deliver
structured records through the existing native-RPC foundation instead of
granting renderer code filesystem access.

Application code still calls the common facade. The RPC client is an
implementation detail of the renderer transport, not the public logger used by
features.

Prefer one batch ingestion method over duplicating `debug`, `info`, `warn`, and
`error` as RPC methods. The host must persist received renderer records without
re-logging them through its own root logger; re-logging changes source metadata,
timestamps, and can create loops or duplicates.

Register logging RPC in the native handler registry, but do not expose it as an
agent capability merely because the repository uses the same registry for both.
Operational transport methods and user- or agent-invokable capabilities have
different semantics.

## Do Not Build An Error Conversion System

The logger may accept an `unknown` error value for local diagnosis. The logging
core must not inspect error classes, extract domain fields, traverse custom
causes, or maintain error-type registries.

Local transports may use the original value. A transport that requires a wire
or persistent representation owns a small, explicitly lossy fallback such as
`JSON.stringify`, with a final string fallback if encoding throws. Do not
reconstruct an error instance on the receiving side.

If a known diagnostic value matters, the caller that knows its meaning should
pass it explicitly in context. Adding a new application error type must not
require editing logging infrastructure.

## Do Not Promise Automatic Secret Cleanup

Do not pass passwords, tokens, cookies, private keys, raw authorization
payloads, or unnecessary personal data to the logger.

Do not invent a recursive sanitizer and rely on it to make unsafe logging safe.
If a repository or telemetry SDK already provides a proven boundary safeguard,
preserve it as defense in depth without turning it into a general application
error-conversion pipeline.

## Keep Observability Concerns Distinct

- Sentry-style breadcrumbs may be implemented as a logging transport.
- Capturing an exception as an incident is an error-reporting decision; do not
  automatically capture every `logger.error`.
- Stable typed application events may travel through the logging pipeline when
  the facade and record distinguish them from ordinary logs.
- Metrics, timings, and analytics events must not be derived from human log
  messages or an `info` level alone.
- Provider session control such as initialization, user identity, consent, and
  reset is not a log transport and remains in the provider integration.
- User feedback is UI behavior, not a logging transport.

## Verify The Result

Before finishing logging work, verify that:

- feature code imports only the configured logger facade;
- child scope and event context remain distinct;
- explicit application events remain distinguishable from ordinary logs;
- queued records cannot change when the caller later mutates its scope or
  context object;
- messages are stable and dynamic values are structured;
- transports are registered once and fail independently;
- asynchronous transports have bounded queues and a flush policy;
- browser or Storybook execution does not instantiate a native transport when
  its bridge is absent;
- renderer persistence crosses the established native boundary;
- the host preserves the renderer record rather than re-logging it;
- existing persisted-log schemas remain readable or have an explicit migration;
- transport failures cannot recurse through the logger;
- no new normalization, sanitizer, or error-type registry was introduced;
- sensitive values are absent from records and transport payloads.

## Related Skills

- Native RPC contracts, handlers, renderer clients, and host registration ->
  **native-integration**.
- Placement of the logging package, platform entrypoints, and local helpers ->
  **file-structure**.
- Query and mutation ownership remains in **api-integration**; logging a request
  does not move cache or error-handling responsibilities into this skill.
- Catch boundaries, reporting policy, user feedback, retries, and typed error
  outcomes belong to the repository's error-handling guidance, not this skill.
