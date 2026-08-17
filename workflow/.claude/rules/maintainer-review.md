# Maintainer review

How to write to the maintainer, and which decisions are theirs. Every message
this workflow puts in front of a person is governed by this, whatever produced
it. OKF records provenance, trust, and lifecycle; it does not provide an
approval process. `PROJECT_WORKFLOW.md` is the maintainer's own copy of the
gates.

## What the maintainer cannot see

Five facts drive every rule below.

1. **They did not watch.** Not the tool calls, not the gate that refused, not
   the file you fixed on the way. Anything you refer back to, they are meeting
   for the first time.
2. **They hold no identifier you generated.** A bundle id, a criterion id, an
   issue number, a record slug, a milestone code, a schema value printed as a
   category — each is an address, and an address is something to look up rather
   than something to read.
3. **They are deciding about their product, not auditing your work.** Proof
   belongs in the record, which has a place for each kind of it. What reaches
   them is what the answer turns on.
4. **Reading is the expensive part.** A message that catches them up first
   buries what it came to say. Several decisions in one message get answered as
   none of them.
5. **The last thing they saw may be days old and from another session.** They
   are not resuming your context. There is no thread for you to continue.

## Rules

### 1. Lead with what is now true

The first line is what changed, in the product's own terms. Not what you did,
not what you are about to do, not where the work stands.

Bad: "I have finished reviewing the bundle and refreshed every receipt, so the
completion gate passes now. Below is a summary of what the review turned up."

Good: "The quest board now shows quests a player cannot accept yet. Nothing
waits on you — I am drafting the pages next."

Then, if anything: **what you need from them**, one question with a
recommendation. Then **what happens next without them**, one line. Then stop.

### 2. Carry no address

Apply one test to every sentence before it reaches them:

> Would they have to look something up to understand this?

If yes, it is an address, whatever form it takes. It is a test rather than a
list of banned strings, because it reads the reader and not the shape of the
string or the language it is written in.

Two failure modes, and over-correcting the first produces the second:

Bad — **addressed prose**: "The check in the catalog store was narrowed
because the gate validates on publish." Every noun is something to look up.

Bad — **emptied prose**: "A check was narrowed for a reason that turned out to
be wrong." Nothing to look up and nothing to decide on either.

Good: "The client stopped checking anything but the shape of a record, on the
belief that publishing would catch the rest — and publishing does not."

An address is never deleted to satisfy this. It moves into the record, and is
brought back out when they ask to audit rather than to decide. A finding whose
evidence was dropped to keep a sentence clean has been made worse.

### 3. Show the shape rather than describe it

Prose is the wrong medium for a structure. When the answer is a control flow, a
layout, a state machine, a set of relationships, or a change to any of those,
draw it: `show-project-work` carries the formats and their examples.

Bad: "The create flow now goes through the resource client, which wraps the API
contract, and the legacy path is gone, so the route calls the new handler."

Good:

```diff
 entrypoint
   runCommand
+    handleCreateResource
+      ResourceClient.create(input)
-    legacyCreateFlow
```

This is what saves rule 2 from producing rule 2's second failure mode. Shortening
a description loses the substance; replacing it with the shape keeps all of it.

### 4. One decision per packet

Several stacked in one message read as a status report and get answered as none
of them.

Bad: one message settling the reward model, the failure state, and who owns the
board.

Good: the reward model, with a recommendation. The other two wait.

**A numbered round of questions is not this.** Interviewing the maintainer
through `grill-project-decisions` asks the whole frontier at once, numbered, one
recommendation each — a round they can answer in one sitting. What this rule
forbids is decisions buried inside prose, not decisions on their own lines.

### 5. Give the answer a shape they can hit

Name the options, or say what a bare yes changes. Before sending, draft their
one-line reply in their own voice: if the only answer that fits is "which one?",
you wrote a status line and the question is still missing.

Bad: "I need your word on the boundaries here."

Good: "Either a player sees quests they cannot accept, greyed out, or the board
hides them until they qualify. Greyed out, I think — the hidden version reads as
a bug the first time someone hears about a quest they cannot find. Say which."

A count fails this test and so does a category. "I do not know" is an answer you
can record, and saying so out loud is worth more than a preference guessed from
a polite reply and then treated as settled.

### 6. Find their answer before asking for it

Run `wfctl knowledge decided "<subject>"` before putting anything to them. It
reads the four places an answer lands — a promoted page, the bundle that asked,
a resolved map, a capture — plus work already delivered, and reports the date and
their own words. On a bundle, `--record <id>` writes the result into the framing,
and the framing gate holds until it has.

Their answer is usually not on a page. Twenty-two of twenty-six recorded
decisions in one project had never been promoted, so a search of curated
knowledge truthfully found nothing and read exactly like a question nobody had
answered.

Bad: asking what a completed issue already recorded as theirs to settle.

Good: "You settled this on 3 June — <their words>. It still holds unless the
new failure state changes it; does it?"

Cite the page when there is one and the record when there is not, and say which.

### 7. Re-establish the subject before asking about it

A claim is the unit of record, not the unit of a question. Recorded atomically it
keeps only what separates it from its neighbours, which is exactly what a reader
who was not there cannot reconstruct.

Bad: "This is one colour on one side and another on the other side — was that
intended?" A complete atomic claim and an unanswerable question.

Good: four things above the question — **what it is**, named as the product names
it and where a person meets it; **where it came from**, which sources and when;
**what turns on it**, the flow it sits in and what changes either way; and **what
is true right now**, checked against the pinned source and the current
implementation rather than repeated from a days-old record.

Ask about the subject and list its atomic claims underneath. Several claims about
one capability are one question. Translate rather than cite: a term that exists
only in the implementation is replaced by what it does for the product, with the
original in parentheses at most once.

### 8. Render, do not compose

Where a packet can be generated from records, generate it. A renderer that never
reads an address cannot print one, which is worth more than care taken one
message at a time.

Bad: editing a rendered packet by hand because it reads wrong.

Good: repairing the record it read. A packet edited by hand is composed again,
and composed is what put file paths and criterion ids in front of them.

`wfctl work ask <id> [--stage promotion|completion]` renders the gates.
`wfctl knowledge trajectory ask` and `trajectory debts --ask` render the vision
and debt questions. A section still holding the shipped template's own words is
reported as unwritten rather than read out as scope.

### 9. Never report by count

Bad: "Eleven cases are gate-clean and none can close without your decision."
Accurate, reads as brevity, works as concealment — it says nothing about what the
eleven contain, and the longer the queue the more it hides.

Good: name one and what it turns on. If naming them all is too long for one
message, that is a fact about the backlog and not a reason to compress it into a
number.

Confirming a written record is the exception, and it is one decision rather than
many: when the material already carries their own dated decisions, ask once
whether they still stand, with named exceptions.

### 10. Keep the blocker true

A checkpoint blocker is the one sentence written for the maintainer rather than
the next agent, and the only one that crosses a session boundary.

Bad: a blocker still naming a decision that was made two days ago. A missing
blocker makes the next session look; a stale one makes it act — reopening a
settled decision, or recommending an option since proved impossible.

Good: rewriting it in the same turn the answer, discovery, or change removes what
it was waiting for. Nothing validates blocker text against the record it hangs
on; only the person changing the record can keep it true.

## When to break them

1. **They asked you to explain.** Explain fully. Still no preamble and no closer,
   but the body runs as long as the subject needs, with headings so they can skim
   back.
2. **The action is irreversible.** Confirm first. Safety outranks brevity, and a
   destructive step is described in full even when the description is long.
3. **They repeated the question.** The shape failed. Drop to plain form —
   `wait-what` — and re-pitch before answering anything else.
4. **The ambiguity is real.** One short clarifying question beats a guess you
   then have to unwind.
5. **A rule would delete the answer.** "What are my options" is answered with the
   options: two to four, ranked, one line of trade-off each, recommendation
   first. The rules shape the answer; they never replace it.
6. **A rule fights a gate.** The gate wins and the shape stays. Where the gate
   demands something the maintainer should not read, put it in the record and say
   so in one line.

## Auto-clarity

Suspend the compressed form and write plainly, without being asked, when:

- a security consequence or an irreversible action is being described;
- the order of a multi-step sequence could be misread if any of it is cut;
- shortening created an ambiguity the reader cannot resolve;
- they asked you to clarify, or repeated a question;
- they answered a packet with a question instead of a decision.

Resume the normal form once the unclear part is settled. Never announce the
switch, and never name the register you are writing in.

## Before you send

Delete:

1. The first sentence, if it announces what you are about to do or catches them
   up on what they missed.
2. The last sentence, if it asks whether they need anything else or recaps what
   just happened.
3. Any sidebar that begins in effect with "by the way".
4. Any table that is not comparing things the answer turns on. Four hundred
   reports written while this rule was already in force: sixty-three per cent
   carried a table and twelve per cent ended in a question. Reached for before
   there is a question, a table is a log with borders.
5. Any hedge carrying no real uncertainty, and any idiom. Keep a hedge that
   carries one; deleting it manufactures confidence.

Then verify: **if they read only the first line and the last line, do they know
what is true now and what, if anything, is theirs to decide?**

Sentences are active, one idea each, twenty words or fewer, in simple past,
present, or future. The same word for the same thing every time; a synonym reads
as a second thing. A path, a symbol, a version, a price, or a count is reproduced
character for character or left out — never paraphrased into approximate prose,
because being unable to check it is the cost the shortening was meant to avoid.

## Persistence

These rules govern every message for the rest of the session, not the next one.
They do not lapse when the topic changes, when a finding is urgent, or when the
work has been running for forty turns. **If you are unsure whether they still
apply, they do.**

Write in the language the maintainer writes in. The examples above are in
English; that is the examples, not the instruction. Technical terms, code,
commands, and exact error strings stay verbatim in any language.

## Which decisions are theirs

Require an explicit maintainer decision before:

- choosing a workflow route when significance is ambiguous;
- starting raw processing, whole-project reconstruction, durable external
  research, semantic curation, or broad direction shaping they did not request;
- implementing a significant spec whose outcome, scope, exclusions, acceptance
  criteria, or material decisions have not been explicitly accepted;
- writing anything into `knowledge/`, which is the project speaking about itself;
- selecting current truth when evidence cannot resolve chronology or authority;
- closing work whose delivery no longer matches the framing they approved;
- recording `verified` by a `human:<id>` actor.

Record approve, correct, or defer. Silence is not approval.

**Reading is never a decision.** Accounting for what each bound repository
declares about itself, running Graphify in every bound root, checking curated
knowledge before settling meaning — a gate refusing until those are done is
telling you to go and do them. Nothing about them reaches the maintainer: not as
a request, not as a status line, not as an apology for the delay. What does reach
them is a product consequence found while reading — a rule in one repository that
makes the proposed route impossible there is a decision, put to them as what the
product must do instead.

Do not request review for freezing a clean Git raw scope, file accounting, QMD
refresh, index or log maintenance, or source-backed drafts that keep their trust
state honest.

## The two gates, and why closure is not one

A maintainer decides two things about a piece of work: what it is, before it
starts, and what the project says about itself afterwards. Everything between is
yours, including the moment the work finishes.

**Framing, before implementation.** `wfctl work issue claim` refuses a delivery
issue whose framing is unapproved, which is the moment to present it: the bundle
has been read, nothing is in flight, and their absence blocks nothing yet.
Approving edits the change record, so refresh its checkpoint and re-read it
before claiming.

**Closure is arithmetic, so close it.** Whether the criteria are met, the
receipts carry evidence, every issue is terminal and the revisions are pinned is
what the completion gate checks. Asking them to confirm that is asking them to
sign a sum they cannot check better than the tool. Four bundles were framed and
approved for one unattended night; two were delivered in sixty-two minutes and
stopped at that gate, the other two were never started, and seven hours and
fifty-four minutes passed before anyone could say the word.

**Closure returns to them when delivery drifted from the framing** — the
acceptance criteria were reworded, added to, or cut since approval, or work left
the route as a dropped issue. The tool names which.

**Promotion is the gate that compounds.** A completion receipt is read by an
auditor once. A page is read first by every session that touches this part of the
project, and it is what the next framing is aligned against. Draft the pages under
the bundle's `promotion/` directory, record them with `wfctl work promotion <id>`,
and put them to the maintainer with `wfctl work ask <id> --stage promotion`, which
shows the pages themselves rather than a list of paths. `wfctl work promote <id>`
writes them.

A bundle closed with pages waiting sits in the promotion queue instead of the
archive, and nothing running is held by it. What it does hold is the next framing
approval in the same Area, because aligning new work against knowledge already
known to be behind tells them something the project has stopped believing.

**Approval and permission to start are different decisions.** A maintainer who
approves a framing and says the work is not to begin — including one approving
only so the bundle stops cluttering their queue — is parking it: `wfctl work
approve ... --park "<why>"`, or `wfctl work park` afterwards. Only `wfctl work
release --attested "<their words>"` starts it. A release is never inferred: not
from a truthful answer to an unrelated question, and not from the condition that
held it having cleared. The last time one was inferred, six commits landed in
three source repositories.

## Recording their answer

Record a framing with `wfctl work approve <id> --stage framing --by
human:<maintainer-id>`, and a promotion with `wfctl work promote <id> --by
human:<maintainer-id>`, which writes the pages in the same act as the receipt.
A framing approval digests the acceptance criteria it settled, which is what later
tells a reworded contract from the one they agreed to.

Pass `--attested "<their answer, word for word>" --session "<where they said
it>"`. That is the ordinary path, because the ordinary case is a maintainer who
already answered in conversation; sending them to a second terminal to retype a
generated id, a stage name and their own identity relocates the same answer to a
less convenient channel and records nothing more. A typed confirmation and an
out-of-band `--token` matching `WFCTL_APPROVAL_TOKEN` both remain, and both prove
a command ran outside your own writing — a stronger record, and theirs to ask for
rather than your default.

Never hand-write `maintainer_review.status`, `by`, `at`, `method`, or `receipt`;
a hand-written receipt fails verification. Existing explicit instructions may
satisfy the framing decision, but still record it through the command, and do not
ask for the same decision twice. Reopen the gate when the approved framing changes
materially — where the acceptance criteria are what changed, the tool reopens it
at closure rather than trusting anyone to notice.

After every material maintainer turn, update the record's mutable current state
and append its decision ledger before continuing. Preserve proposed, approved,
rejected, deferred, and superseded outcomes without copying the transcript.
