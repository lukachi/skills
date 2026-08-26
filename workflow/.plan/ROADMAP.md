# What the 0.9.0 round fixed

**Historical.** This is the record of one completed round, not the current plan.
It was assembled from the dogfood on knowledge-humid and the design discussion
that followed it, and verified against the tool rather than remembered. Twenty-
five of its twenty-seven items landed; the two under G were deferred deliberately
and are still open.

Rounds after this one are in the commit history, not here. Read it as evidence of
what was decided and why, and never as a description of what the tool does now —
`spec/` is normative and the CLI's own output is authoritative.

## A — A bundle exists because the maintainer said so

- [x] A1 `work start` requires their words. Attested, verbatim, dated. Refused empty.
- [x] A2 `work adopt <bundle>` — same flow, sources instead of a conversation.
      Binds an existing bundle to the open fence rather than creating one.
- [x] A3 Provenance: where each source was, recorded per source.
- [x] A4 Supersession: an absorbed bundle is marked and points at the survivor.
      Never deleted — the duplicates are the evidence of the confusion.
- [x] A5 `members` becomes real. The fence names one canonical bundle; the rest
      are superseded into it. (`members[0]` is currently whichever was first.)
- [x] A6 `work list` — stranded bundles are visible at all.
- [x] A7 `brief` reports bundles in changes/active with no flow.

## B — The installer reports; it never forces

- [x] B1 A file it cannot cleanly own becomes a conflict line, not a write.
- [x] B2 Files a previous version owned that this one no longer ships are
      reported. (25 obsolete skills survived a fresh install this morning.)
- [x] B3 Hook ownership by stable slot identity, not the exact command string.
      0.8.0's SessionStart hook survived and 0.9.0 appended its own.
- [x] B4 `init knowledge --help` must not perform the install.
- [x] B5 Non-zero exit while conflicts are outstanding.

- [x] B6 `.workflow/.gitignore` was dropped in 0.9.0. The stop guard writes
      session memory under `.workflow/current/` and its own comment calls that
      directory gitignored; nothing ignored it, so every session dirtied the
      tree.

## C — Records that arrive wrong

- [x] C1 `--flag=value`. `capture --awaits=true "probe"` wrote a capture whose
      body was the literal flag and discarded the real body.

## D — Smaller

- [x] D1 `repo add` labels every non-worktree checkout `main` whatever its
      branch. `--checkout` is accepted and undocumented.

## E — Round three, still standing

- [x] E1 `--raw selected` is dead code
- [x] E2 the crawl gate is satisfied by one read however large the scope
      (stale: `assertCrawlComplete` already requires every in-scope file, and
      the empty-scope hole was closed. No change needed.)
- [x] E3 `knowledge hash` / `validate --page` accept files outside the corpus
- [x] E4 `KNOWN_FLAGS` is global rather than per-command
- [x] E5 `doctor` exits 2 instead of reporting when state is corrupt
- [x] E6 `findGuidance` climbs six ancestors
- [x] E7 `recall route graphify` with no `--covered` satisfies the floor
- [x] E8 `decided` cannot see reconstruction adjudications
- [x] E9 `--settles` is not wired from the changes flow's own delivery

## F — The skill

- [x] F1 Attested creation and adoption reach the installed skill and the
      managed block, or agents learn the old rule.

## G — Evals (separate; not this round)

- [ ] G1 The scorer asserts one thing: whether a read-only eval touched files.
- [ ] G2 18 evals, 0 recorded runs.
