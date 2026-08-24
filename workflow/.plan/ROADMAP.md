# What this round fixes

Assembled from the dogfood on knowledge-humid and the design discussion that
followed it. Verified against, not remembered.

## A — A bundle exists because the maintainer said so

- [ ] A1 `work start` requires their words. Attested, verbatim, dated. Refused empty.
- [ ] A2 `work adopt <bundle>` — same flow, sources instead of a conversation.
      Binds an existing bundle to the open fence rather than creating one.
- [ ] A3 Provenance: where each source was, recorded per source.
- [ ] A4 Supersession: an absorbed bundle is marked and points at the survivor.
      Never deleted — the duplicates are the evidence of the confusion.
- [ ] A5 `members` becomes real. The fence names one canonical bundle; the rest
      are superseded into it. (`members[0]` is currently whichever was first.)
- [ ] A6 `work list` — stranded bundles are visible at all.
- [ ] A7 `brief` reports bundles in changes/active with no flow.

## B — The installer reports; it never forces

- [ ] B1 A file it cannot cleanly own becomes a conflict line, not a write.
- [ ] B2 Files a previous version owned that this one no longer ships are
      reported. (25 obsolete skills survived a fresh install this morning.)
- [ ] B3 Hook ownership by stable slot identity, not the exact command string.
      0.8.0's SessionStart hook survived and 0.9.0 appended its own.
- [x] B4 `init knowledge --help` must not perform the install.
- [ ] B5 Non-zero exit while conflicts are outstanding.

## C — Records that arrive wrong

- [x] C1 `--flag=value`. `capture --awaits=true "probe"` wrote a capture whose
      body was the literal flag and discarded the real body.

## D — Smaller

- [ ] D1 `repo add` labels every non-worktree checkout `main` whatever its
      branch. `--checkout` is accepted and undocumented.

## E — Round three, still standing

- [ ] E1 `--raw selected` is dead code
- [ ] E2 the crawl gate is satisfied by one read however large the scope
- [ ] E3 `knowledge hash` / `validate --page` accept files outside the corpus
- [x] E4 `KNOWN_FLAGS` is global rather than per-command
- [ ] E5 `doctor` exits 2 instead of reporting when state is corrupt
- [ ] E6 `findGuidance` climbs six ancestors
- [ ] E7 `recall route graphify` with no `--covered` satisfies the floor
- [ ] E8 `decided` cannot see reconstruction adjudications
- [ ] E9 `--settles` is not wired from the changes flow's own delivery

## F — The skill

- [ ] F1 Attested creation and adoption reach the installed skill and the
      managed block, or agents learn the old rule.

## G — Evals (separate; not this round)

- [ ] G1 The scorer asserts one thing: whether a read-only eval touched files.
- [ ] G2 18 evals, 0 recorded runs.
