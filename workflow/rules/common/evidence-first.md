# Evidence-first reasoning

Treat claims, plans, existing documents, and prior agent output as unverified until checked.

For any task that depends on understanding, locating, changing, debugging,
reviewing, or verifying source code:

1. Invoke `analyze-with-graphify` before reading or searching source code, even
   when the maintainer does not mention Graphify.
2. Require it to inspect the current session skill catalog and invoke the
   official native `graphify` skill.
3. Stop and tell the maintainer when either the Graphify CLI or native session
   skill is unavailable. Offer the supported installation and session-restart path.
4. Use text search only after graph traversal, as a supplementary precision tool.
5. Inspect the actual source reached through the graph and record the query,
   pinned revision, paths, symbols, and checks in the active change or curation
   record. Graphify output is navigation, not authority.

Do not use Graphify as the primary analyzer for raw or curated Markdown.
Use QMD for Markdown retrieval and the generated knowledge graph for explicit
relationship expansion, then read selected files directly. Before
knowledge-dependent work, require the official native `qmd` skill in the
current session and invoke it. An on-disk skill installed after session start
does not count; stop and request installation or a session restart instead of
inventing a partial QMD procedure. Raw coverage comes from Git-frozen intake
sources and explicit full-file review. Existing-project coverage comes from
exact clean source revisions, Graphify traversal, direct source and test
inspection, Git history review, repository dossiers, cross-repository
reconciliation, and maintainer adjudication. Curated trust comes from OKF
metadata, authoritative provenance, and current verification. QMD rank,
snippets, and its index are never authority.

Do not turn mocks, fixtures, fakes, placeholders, disabled checks, or partial wiring into production completion claims. Name missing evidence and unfinished work directly.
