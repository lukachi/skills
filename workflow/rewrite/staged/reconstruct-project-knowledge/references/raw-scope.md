# Deciding what raw material a reconstruction reads

Read this when the frozen snapshot or the working tree holds raw files. When
neither does, the CLI records `unavailable` and there is no decision to make.

7. Resolve raw scope before starting any reconstruction-linked intake. The CLI
   records `unavailable` automatically only when the frozen snapshot and
   working tree contain no raw files. Otherwise inventory the pinned snapshot,
   use QMD only far enough to describe its themes, and recommend one
   maintainer-facing choice:
   - `all`: every raw blob in the reconstruction-start snapshot;
   - `selected`: named themes mapped by the agent to explicit paths;
   - `excluded`: raw will not participate in this reconstruction.

   Raw being unreviewed, contradictory, obsolete, or unable to prove current
   behavior is never by itself a reason to recommend `excluded`; those are
   normal raw properties. Judge scope by possible relevance to the declared
   reconstruction objective and by information-loss risk. Material that may
   preserve intended behavior, abandoned alternatives, decision history, or
   unrealized product ideas normally belongs in `all` or a bounded `selected`
   scope even though every claim still requires reconciliation. Recommend
   `excluded` only when the mapped snapshot is outside the declared objective
   or the maintainer confirms that it should not inform this reconstruction.
   If relevance cannot yet be established safely, present a neutral choice or
   recommend a bounded selected review; do not convert uncertainty into
   exclusion.

   Ask one focused question. Do not require the maintainer to know pathspecs.
   Record the answer yourself:

   ```sh
   wfctl knowledge reconstruct raw-scope <case-id> \
     --mode selected \
     --path raw/<approved-path> \
     --by human:<maintainer-id> \
     --note "<what was included or excluded and why>"
   ```

   Use repeated `--path` for selected scope. `all` and `excluded` take no
   paths. Never invent `human:*` approval. Never start a linked intake case
   before this decision. If `reconstruct check` reports a legacy v3 case,
   record its scope through this command before continuing. Once linked intake
   starts, the scope is immutable; a materially revised choice requires a new
   reconstruction case.
