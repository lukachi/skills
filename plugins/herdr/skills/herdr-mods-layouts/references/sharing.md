# Sharing layouts and mods

The gallery at https://herdr.dev/gallery/ indexes public GitHub repos by topic. Nothing is
reviewed; only preview images are screened. Installing agents are expected to read every
file first.

## Repo layout

A layout is a whole window. It brings the mods it needs and may bring themes and keys:

```text
<repo or folder>/
  RECIPE.md
  preview.png
  layouts/<name>.json
  mods/<name>/main.js, mod.json, art…
  themes/<name>.json        optional
  keys.json                 optional; usually a "layout:<name>" section
```

A mod is a piece for the person's own window. It has **no `layouts/` folder**:

```text
<repo or folder>/
  RECIPE.md
  preview.png
  mods/<name>/…
  keys.json                 optional snippet that gets merged: global / terminal / mod:<name> sections
```

- **Several entries in one repo:** use one folder per layout or mod
  (herdrdev/herdr-layout-examples does this).
- **Topics:** add `herdr-layout` for a layout or `herdr-mod` for a mod. The entry appears
  on herdr.dev within about an hour.
- **Card text:** the gallery card appears to use the recipe's H1 and first paragraph
  [INFERENCE], and the index is cached. Keep the H1 a clean product name.
- **Helper programs:** the gallery copies only `layouts/` and `mods/`. Anything else, such
  as a binary or a service, needs its own documented installer. Flockbook and Shepherdr
  ship one.
- **URLs:**
  - A folder at the repo root becomes `herdr.dev/layouts/<owner>/<repo>`.
  - Nested folders join their path segments with `--`, e.g.
    `herdr.dev/layouts/minchenlee/flockbook--herdr-app`.
  - Mods use `herdr.dev/mods/<owner>/<slug>`.

## Writing `RECIPE.md`

A recipe is a **brief**: from it, another agent with an empty folder can rebuild the
thing. The files next to it are one build of it. Write the recipe from the real files, in
this exact order:

```markdown
# <Name>

<One paragraph: what the person sees and why they'd want it.>

![<Name>](preview.png)

This file is the brief: enough to build <Name> from an empty folder. The files next to
it are one build of it. If they don't work on your Herdr, or you want it different,
build it again from here.

## What you see
<Regions top to bottom / left to right: sizes in px, exact hex colors, fonts and sizes,
what each region shows.>

## How it behaves
<Every agent status (working, blocked, done, idle) and how it looks; usually a table.
What clicks, keys and hovers do. What moves and when.>

## Built from
<Layout node tree and block ids; each mod and its props roles; shipped mods reused;
herdr functions and commands called; timers; programs run (exec/hc); network use;
files read outside its folder; art. Versions it was built for.>

## Watch out
<What tripped the build up; what a fresh build would get wrong; limits (sizes, counts);
controls that do nothing yet; assumptions about the setup; name-clash renames needed.>

## Done when
- <Observable check the build really passes>
- `herdr-app check mods/<name>` passes, and switching to another layout and back works.
```

What makes a recipe good:
- **The person first; code only in Built from and Watch out.**
- **Exact over vague:** `29px of wood (#ab7748)`, `agent.focus`, `28px headers`. Avoid
  "a nice header".
- **Status → visual table:** the best recipes all have one.
- **Honesty:** list fake or no-op controls ("chips and plus signs do nothing") and known
  bugs.
- **Disclosure:** state network access, `exec`/`hc` use, files read outside the mod, and
  anything written to settings. Installing agents must report these to the person.
- **Versions:** e.g. "for herdr-app 0.1.12 and herdr-core 0.1.17 or newer".
- **Nothing the build doesn't do.**

## preview.png and the layout preview

- **`preview.png`** is a real screenshot: `herdr-app shot preview.png` while the layout or
  mod is showing, with representative agents in several statuses.
- **The layout's own `"preview"`** (an SVG or PNG path on the root) is a separate,
  stylized picture for the Settings screen. Ship it inside the repo too, e.g.
  `mods/<name>/preview.svg`, so the path survives installation.

## Before publishing

1. Rename everything to avoid clashes with shipped names (`main`, `terminals`, `win98`,
   `agents`, `tabs`, `menu`, …).
2. Check that every asset path is `mods/<this mod>/…`, and that there are no absolute
   paths to your machine.
3. Run `herdr-app check` on every mod. Switch to the layout, take the shot, switch away and
   back.
4. Test from scratch: have a fresh agent install it from the repo by following
   [the install steps](../SKILL.md#5-installing-someone-elses-layout-or-mod) into a
   different `HERDR_APP_HOME` or name, or rebuild it from `RECIPE.md` alone. Gaps in the
   recipe show up immediately.
5. Add the topic. The share prompt from herdr.dev is:
   *"Read ~/.config/herdr-app/AGENTS.md, then write a RECIPE.md for my <name> layout. Put
   the layout, its mods, the recipe and a screenshot named preview.png in one folder, push
   it to a public GitHub repo and add the topic herdr-layout."*

## Studying others' work

- **Official examples**, which pair a recipe with real files
  (https://github.com/herdrdev/herdr-layout-examples):
  - **Board:** agent kanban plus live terminals.
  - **Pasture:** animated agents as sheep; native motion.
  - **Threads:** a tab inbox; 8 mods; a known-broken details card.
  - **Call, Chat, Code, Mission.**
  - **tmux-prefix:** a prefix-key popup mod with a keys snippet.
- **Community:** search GitHub for `topic:herdr-layout` or `topic:herdr-mod`. Large ones
  worth reading:
  - Shepherdr: 29 mods, worktrees, a web app.
  - Herdr T3: an inbox with settle and snooze.
  - Flockbook: chat-style reading, with a Swift helper.
- **Shipped defaults:** https://github.com/herdrdev/herdr-app/tree/master/defaults. These
  may be newer than the installed build.
- **Where to report problems:** the herdr-app CONTRIBUTING closes custom-mod requests.
  Open issues only for bugs or for missing mod capabilities (an API, an event, a setting).
