---
name: opengpui
description: "Show the person a native UI in Herdr instead of plain text: forms to fill, tables to review, cards with numbers, approve/reject buttons. Write the UI in OpenUI Lang to a .oui file, open it with `opengpui show`, and get what they click or type back in your terminal. Use when an answer is easier to read or give as UI than as chat (a deploy review, a choice between options, a form of several fields, a status board), or when the person asks for a panel, form or dashboard in Herdr. Requires herdr-app and the opengpui CLI."
---

# opengpui: native UI from an agent, inside Herdr

opengpui draws OpenUI Lang (https://openui.com) with Herdr's native gpui
elements. You write a `.oui` file; a Herdr pane shows it and re-draws whenever
you change the file; what the person does comes back to you.

## Loop

1. **Learn the language once per task:** `opengpui prompt` prints the full
   manual for exactly the components this build draws: syntax, every
   component's signature, rules and examples. Read it before writing.
   Ignore its first line ("respond only in openui-lang"): that is written for
   chat models; you write the code to a file.
2. **Write** the UI to a file, e.g. `./ui/review.oui`. One statement per line,
   `root = Stack([...])` first, then the referenced statements. Keep it under
   1 MiB (the pane reads at most that).
3. **Check** it: `opengpui check ./ui/review.oui`. It parses exactly as the pane
   will and prints each error with a hint. Fix until it says `ok`.
4. **Show** it: `opengpui show ./ui/review.oui --title "Deploy review"`.
   - Opens to the right of the focused pane; `--down` below, `--tab` as a new tab.
   - Colors follow the Herdr theme; `--look openui` uses OpenUI's own theme.
   - Show once. Afterwards just rewrite the file: the open pane follows it.
5. **Get the answer.** Every action the person takes arrives two ways:
   - typed into your terminal as one line:
     `[opengpui <file>] continue_conversation: <message> {"params":…,"form":…,"state":{…}}`
     (to your `$HC_TERMINAL_ID`; `--reply <terminal>` sends elsewhere, `--no-reply` nowhere);
   - appended as JSON to an events file, printed by `opengpui show`.
     `opengpui wait <file>` blocks until the next event and prints it;
     `opengpui events <file>` prints all of them.
   Form fields arrive under `state.<formName>.<field>`; `$variables` as `state.$name`.
6. **Errors come back too.** If the file has errors once it is complete, the pane
   lists them at the bottom and sends them to you as
   `[opengpui <file>] errors in your OpenUI file: …`. Fix the file; the pane
   re-renders by itself.

## Writing good surfaces

- Ask with buttons: `Button("Approve", @ToAssistant("Approve deploy"))` sends
  that message to you. Put inputs in a `Form("name", buttons, [fields])` so the
  values ride along and required fields are validated before sending.
- Use `$variables` for state that changes in place (`$filter`, a toggle):
  `@Set`, `@Reset` and bound inputs update the pane without a round trip to you.
- Keep the person's attention: a CardHeader title, the decision or the numbers
  first, details below. Tables are column-oriented: `Table([Col("Name", names), …])`.
- Long-running work: rewrite the file as results arrive; the pane updates live.
  To stream one response as you generate it, frame it with protocol markers:
  first line `]]>openui:content`, last line `]]>openui:end`; the pane treats it
  as streaming (inputs wait) until the end line appears.

## What the pane draws

Every component of OpenUI's `openui` library (the default) and `chat` library
(`--library chat`), as `opengpui prompt` lists them: layout (Tabs, Accordion,
Steps, Carousel, Modal), content (markdown, callouts, code, images and galleries),
tables (also EditableTable), charts (bar, line, area, radar, pie, radial, stacked,
scatter), every form field (Select, DatePicker, Slider, checkbox/radio/switch
groups, Chips, OptionCards) and card blocks. Use only what the manual for your
library lists: a component from the other library is rejected by `opengpui check`.
Images need real `http(s)` URLs or paths under your home folder; Herdr downloads
and caches them.

## Limits

- The file must be under your home folder: Herdr mods read only there.
- Query()/Mutation() need tools: `--tools tools.json` with
  `{ "name": { "command": "/abs/path", "args": [], "cwd": "…" } }`. A tool runs
  that command with the JSON arguments appended as the last argv and must print
  JSON (or text). It runs with the person's rights: only define tools you would
  run yourself.
- `@OpenUrl` opens http(s) links in the person's browser.
