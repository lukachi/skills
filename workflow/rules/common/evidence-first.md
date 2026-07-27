# Evidence-first reasoning

Treat claims, plans, existing documents, and prior agent output as unverified until checked.

For codebase navigation, search, architecture analysis, debugging, or implementation tracing:

1. Use the `analyze-with-graphify` skill and Graphify first.
2. Stop and tell the maintainer when Graphify is unavailable. Offer the installation path.
3. Use text search only after graph traversal, as a supplementary precision tool.
4. Record relevant graph queries and source locations in the active spec.

Do not turn mocks, fixtures, fakes, placeholders, disabled checks, or partial wiring into production completion claims. Name missing evidence and unfinished work directly.
