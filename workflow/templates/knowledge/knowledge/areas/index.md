# Areas

Areas are the primary durable decomposition of the project: coherent parts of
the product or system that provide recognizable responsibility or
functionality. Examples might include combat, economy, identity, billing, or
deployment.

Each Area has an `index.md` as its human-facing current map. Add capabilities,
concepts, rules, use cases, implementation, decisions, and a local `log.md`
only when the Area needs them. Do not flatten unrelated knowledge into this
index.

The typed folders inside an Area are sibling collections. Capability and use
case pages link their related rules, implementation, and decisions; those
artifacts are not normally nested below the capability or use case.

Product-bearing pages state intent, delivery, and alignment independently.
This keeps accepted but unimplemented capabilities, partial delivery, legacy
behavior with unknown intent, and known drift visible without flattening them
into one misleading status.
