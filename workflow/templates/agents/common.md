## Project workflow

This block is managed by `wfctl`. Read `.workflow/config.json` and all files under `.workflow/rules/` before project work. Use `PROJECT_WORKFLOW.md` as the maintainer-facing contract for review gates.

- Invoke `analyze-with-graphify` before inspecting, searching, planning,
  changing, debugging, reviewing, or verifying source code, even when the
  maintainer does not mention Graphify.
- Require that skill to confirm and invoke the official native `graphify` skill
  exposed in the current session before project analysis continues.
- Treat Graphify as the primary source-code navigation tool; text search is
  supplementary and direct source inspection is authoritative.
- Do not use Graphify as the primary analyzer for Markdown intake or curated
  knowledge.
- Use QMD from the knowledge repository for Markdown retrieval. Treat its
  index, ranking, and snippets as navigation only; verify by direct reading and
  authoritative sources.
- Present bounded review packets and require explicit maintainer decisions at the gates defined by the workflow.
- Preserve uncertainty and report missing evidence instead of guessing.
- Execute required `wfctl` commands yourself when tool access permits. Do not
  delegate routine CLI operation, spec editing, or record maintenance to the
  maintainer; ask them for decisions, approval, or missing authority.
- For significant multi-turn work, create the shaping spec early, update it
  after every material maintainer turn, and resume from the full file rather
  than conversation memory.
