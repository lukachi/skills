# Recall

You cannot feel that something is missing. A person searching their memory
senses that an answer exists and has not surfaced; you experience only the
plausible answer you already have. Nothing seems absent, which is why the first
search that returns something ends the search.

This checklist is that missing sense, written down.

## The items

**A — precedent.** Has the maintainer already answered this? Is there a current
decision record, or a superseded one? Was this proposed and rejected before?
Does a recorded non-goal forbid it?

**B — language.** What is the canonical term and its aliases? Which discouraged
names would hide it from a search? Are you searching with those terms or with
your own paraphrase?

**C — ownership.** Which Area owns this responsibility? Which repository owns
the code? Does a capability already cover it?

**D — prior art.** Does an implementation already exist — by graph traversal,
not text search? What calls it and what depends on it? Is there an existing
pattern to match?

**E — state of truth.** Does curated knowledge contradict this? Is any page for
this subject marked drifted? Is there an open uncertainty record?

**F — work in flight.** Is another flow touching this subject? Is there an inbox
capture about it? Is a debt scheduled against it?

**G — evidence quality.** Production code, or a fixture, mock, demo or test?
Implementation authority, or a clue from a note? At which exact revision?

**H — absence.** If nothing was found, how many independent routes were tried?
Are you recording *not-found*, or asserting it does not exist?

## Recording one

```sh
wfctl recall answer <item> --answer "<what you found>" \
  --route <qmd|graphify|grep|read|maintainer> --source "<where>"
```

An item counts only with an answer, the route that produced it, **and** its
source. An answer with no source is a guess with a sentence around it.

## What each step requires

The tool decides, not you. Alignment needs group E and at least one retrieval
query. Framing needs A, B, C and E. Implementation needs D and at least one
graph traversal. Verification needs G. Promotion needs E and H.

The counter line prints at every gate whether or not it refuses, because the
shape of the work is worth seeing on a step that passes: many text searches and
no traversal means the code was searched by string and never by structure.

## Recording a route

```sh
wfctl recall route graphify --covered <path> --covered <path>
```

This is also what tells the write guard which files are known ground, so it goes
quiet there instead of re-delivering the same page.

## Between gates, nothing is checked

That is deliberate. The room to work, research and be wrong is the space between
them. Gates exist only where a guess turns into something the project will cite
later.
