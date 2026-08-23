## Project workflow

This block is managed by `wfctl`. It is the whole of what you need to know; there
are no skills to find and no rules directory to open.

**Run `wfctl brief` before anything else in a session.** It reports the state of
this repository — open flows, what waits on you, what waits on the maintainer —
and it is authoritative. Do not rediscover that state by scanning records, and do
not read it back to the maintainer.

**The tool tells you what comes next.** Every command prints what the current
state demands and the command that records it, and the following command refuses
until that exists. You are not expected to know the sequence. Follow what you are
handed.

**A refusal names the command that clears it.** Read the remedy line and act on
it. Do not work around a refusal by editing a record by hand.

**`wfctl guide <topic>`** brings back the detail for one topic when you need it
— start with `wfctl guide wfctl`. This block stays short on purpose: it is
loaded every session and says only what cannot arrive any other way.

**Two decisions are the maintainer's, and only two.** What the work is, before it
starts. What the project says about itself, afterwards. Closing is neither — the
checks have already answered it, and asking them to confirm arithmetic costs a
night.

**One flow at a time.** `wfctl work start` and `wfctl reconstruct start` open a
fence around the workload you agreed on. While it is open, work outside it is out
of scope: something you notice along the way goes to `wfctl capture`, never into
a new record.

**Checkpoint often.** `wfctl checkpoint` writes where the work stands. It is what
a fresh session resumes from, so anything left only in a message is lost with the
session. Do not stop early to protect context — that is what the checkpoint is
for.

**End a turn only when you are waiting on the maintainer.** If you are not, take
the next action in the same turn. Finishing a unit is not finishing.

**Three guards run without being called** — the session brief, the write guard on
the first write of a unit, and the turn guard when a turn ends with work still
outstanding. `wfctl guards` shows which are on. Turning one off is the
maintainer's decision, not yours.

**You are in the knowledge repository.** Code lives in the leaf repositories this
one knows about, and you edit it from here. There is nothing to install there and
no second session to open.
