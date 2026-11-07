---
name: herdr-mods-layouts
description: "Build, change, debug, install, or share customizations for the Herdr desktop app (herdr-app). That includes layouts (window trees in `layouts/*.json`), mods (panels in `mods/*/main.js` written in gpui-kit JavaScript), pane headers, sidebars, agent boards, overlays, themes, fonts, `keys.json` bindings, `programs.json`, and `RECIPE.md` sharing on the herdr.dev gallery. Use this whenever the user wants Herdr's window to look or behave differently, such as 'a panel that shows my PRs', 'move the agents list', 'a timer on every tab', 'make it warmer', 'rebind ctrl+1', or 'add this layout from herdr.dev'. Also use it when they mention `~/.config/herdr-app`, gpui-kit or gpui-base code, `herdr-app check`, or the herdr-layout and herdr-mod topics, even if they never say mod or layout. Do not use it for starting, reading, or coordinating terminals and agents through `hc`; use herdr-core for that."
---

# Herdr mods and layouts

The Herdr app (`herdr-app`) redraws its whole window from files in its home folder
(`~/.config/herdr-app`, or `$HERDR_APP_HOME`), and applies edits within about a second.
Nothing in the default UI is special:
- the spaces sidebar, agents list, tab bar, menus, dialogs, and toasts are all mods;
- the window itself is a layout JSON.

So "change the app" means editing those files, or writing a mod.

The window is one of two programs:

| Program | What it does | When to use it |
|---|---|---|
| `herdr-app` | The window: spaces, tabs, layouts, mods | Changing what the person sees |
| `hc` (herdr-core) | Runs every terminal and agent; they survive window restarts | Orchestration: use the herdr-core skill / `hc --skill` |

## 1. Load ground truth before writing anything

Herdr changes fast, and it regenerates its own manual on every start. Treat the installed
files as authoritative over this skill and over anything online. This skill was verified
against herdr-app 0.1.13, hc 0.1.18, and gpui-shell 0.7.1. Upstream `master` already
documents APIs that this build lacks, such as `exec`'s `timeout` option.

1. Run `herdr-app --version`, then read `$HOME_DIR/AGENTS.md`, where `$HOME_DIR` is
   `${HERDR_APP_HOME:-~/.config/herdr-app}`. It covers files, commands, layouts, mods, and
   sharing.
2. Grep, don't read whole, in `herdr.d.ts` (the `herdr` module) and `gpui-kit.d.ts`
   (elements, about 22k lines). Each mod folder gets its own copy of the types plus a
   `jsconfig.json`.
3. Run `herdr-app --skill` for the window-driving rules, and `herdr-app commands` for the
   exact command arguments.
4. Read the shipped mod closest to what you are building, in `mods/<name>/main.js`. These
   are the best examples of current idioms. See [patterns](references/patterns.md) for
   which one to open.

Never edit `AGENTS.md`, the `.d.ts` files, `frame/`, `layouts/.state/`, `view.json`,
`shared.json`, `installed.json`, or `data/`: the app owns them.

## 2. Pick the smallest lever

| The person wants | Change | Notes |
|---|---|---|
| Font, size, theme, accent, sounds, zoom for every layout | `settings.json` | Only fills what the shown layout leaves unset. Herdr (main) sets none, so settings decide it. |
| A different key | `keys.json` | Sections: `global`, `terminal`, `layout:<name>`, `mod:<name>`. Any edit freezes the file against future default updates. |
| How a program is named or iconed | `programs.json` | Field-by-field overlay on the built-in table of 120 programs. |
| A color scheme | `themes/<name>.json` | Picked up by Settings automatically. |
| A different arrangement or look of the window | A layout, as a **clone** of a shipped layout or a new file | [layouts](references/layouts.md) |
| New behavior or a new panel, header, overlay, or board | A mod, placed by a layout or opened as an overlay | [mods](references/mods.md), [gpui-kit](references/gpui-kit.md) |
| Changes to a shipped mod | `mod.clone`, then point a cloned layout at the clone | Never edit shipped files. |

Shipped layouts (`main`, `terminals`, `win98`) and shipped mods are replaced on every start.
An edit to one is moved aside to `<name>-edited`, and the original is restored. Clone first:

```sh
herdr-app do layout.clone '{"name":"main","as":"my-main"}'   # also switches to it
herdr-app do mod.clone '{"name":"agents","as":"my-agents"}'  # rewrites its own mods/<name>/ paths
```

A cloned layout still references the shipped mods. To change a mod's code, clone the mod
too and repoint `content.mod` in your layout.

Make only the requested change. Leave unrelated mods, keys, and settings alone.

## 3. Build

- **Layout:** write `layouts/<name>.json` as a tree of `row`/`column`/`stack`/`block`
  nodes with unique `id`s.
  - Put the look (`theme`, `colors`, fonts, `terminal_padding`) on the root.
  - Exactly one block should normally show `{ "tab": "active" }`, with a `pane` frame.
  - Add `"preview": "layouts/<name>.svg"` so Settings shows a picture.
  - Details and full examples: [layouts](references/layouts.md).
- **Mod:** create `mods/<name>/main.js`, which default-exports a class extending `View`
  with `init(props, cx)` and `render(cx)`, plus a `mod.json`.
  - Use `{"place":"none"}` when a layout or overlay places the mod.
  - Data comes from the live `herdr` module (`spaces()`, `agents()`, `panes()`,
    `terminals()`, `focused()`, `theme()`).
  - Every change goes through `run(command, args)`.
  - Full API: [mods](references/mods.md). Element builders: [gpui-kit](references/gpui-kit.md).
- **One mod, several blocks:** pass a distinguishing prop (for example
  `{"role":"header"}`) and branch on `props().role`. A mod cannot import another mod's
  files, so shared code lives inside one mod folder.

### Runtime rules that bite

The mod runtime is not a browser. These rules come from the d.ts files and from verified
`herdr-app check` failures:

- There is no DOM, CSS, HTML, `require`, `eval`, or Node API.
  - `setTimeout` and `setInterval` throw. Use `cx.timer.after` / `cx.timer.every`.
  - Instead of top-level `await`, use `cx.spawn(async (cx) => …)` in `init`.
- Every callback gets its own `cx`. Never store one or use it after the call returns.
  Async work must use the `cx` that `cx.spawn` or the timer hands you.
- Colors are hex values from `theme()` (imported from `"herdr"`). A bare token such as
  `.bg("accent")` fails in mods. Layout JSON, by contrast, accepts theme names. Add alpha
  by appending hex: `t.blocked + "26"`.
- Elements are single-use, per render. Build repeated UI with functions, never cache
  elements on `this`.
  - `InputState.new`, `cx.focus_handle()`, and `cx.new` belong in `init` or event
    handlers, never in `render`.
- `render` reruns automatically when live Herdr data, the theme, or shared state change.
  - Don't poll that data.
  - Timers are only for outside data, or for time-based text such as "5m ago" (at 30 s
    or slower).
- Animate natively with `.frames()`, `svg().spin()`, `.loop()`, `.transition()`, or
  `.spring()`. A `cx.timer` + `cx.notify()` animation redraws the whole window on every
  tick and drains battery.
- Give interactive, scrolling, or measured elements a stable `.id()` that is unique among
  siblings. List rows should use data keys (`agent-${a.address}`), not indexes.
- Inside any `window_drag` block, each control must stop the press:
  `.on_mouse_down("left", (_e, cx) => cx.stop_propagation())`. Otherwise the press drags
  the window.

## 4. Verify: never call it done without this loop

```sh
herdr-app check "$HOME_DIR/mods/<name>"      # loads + renders once; exit 1 with the exact error
herdr-app status                             # shown layout, overlays, errors from files and mods
herdr-app do layout.switch '{"name":"<layout>"}'
herdr-app shot /tmp/herdr.png                # then actually look at the PNG
```

- **`check` only covers the first render.** It works on any folder, including one outside
  the home, and uses empty shared state. It does not lay the mod out, and it does not run
  deferred list rows, nested views, or later async states. Exercise those in the running
  window.
- **A still-working screen proves nothing.** A broken save keeps the last good version
  running. The real error lands in `herdr-app status` or in `layout.error`, `keys.error`,
  `settings.error`, or `programs.error` next to the file.
- **For layouts:** switch to the layout, take a `shot`, then switch away and back. Copies
  restart on a layout change, so this exercises `init`.
- **Report only what you actually saw.** If no window is running, say so: `shot` and
  `status` need one.
- **Tell the person the escape hatch.** `ctrl-alt-shift-escape` sets the shown layout and
  `keys.json` aside and returns to `main`. `cmd-shift-l` on macOS (`ctrl-shift-l`
  elsewhere) cycles layouts.

## 5. Installing someone else's layout or mod

The source can be a `herdr.dev/layouts/<owner>/<slug>` or `herdr.dev/mods/<owner>/<slug>`
URL, or a GitHub folder. Gallery entries are **not reviewed**, and mods are trusted code
with the person's full access.

1. Read `RECIPE.md` and every file before writing anything. Tell the person, before
   adding it, if anything:
   - reaches the network (`fetch`, websocket);
   - runs programs (`exec`, `hc`);
   - reads files outside its own folder;
   - writes settings.
2. Copy `layouts/<name>.json` into `layouts/` and each `mods/<name>/` into `mods/`. Leave
   out `RECIPE.md` and `preview.png`.
   - Never overwrite. On a name clash with the person's files or Herdr's, rename the file
     or folder, every `"mod"` reference, and every `mods/<name>/` asset path.
3. Merge any `keys.json` section by section, and ask before replacing a key the person
   already uses.
4. Adapt only where the recipe's assumptions fail here, or the person asks. If the files
   don't work on this version, rebuild from the recipe.
5. Run `herdr-app check` on each mod. Then `layout.switch` for a layout. The person's own
   layout is untouched; deleting the files removes the addition.

Publishing your own work: [sharing](references/sharing.md).

## References: read the one you need

| File | Read when |
|---|---|
| [references/layouts.md](references/layouts.md) | Writing or editing any `layouts/*.json`: node types, sizing, look cascade, pane frames, floating drawers, custom title bars, stacks, overlays holding layouts |
| [references/mods.md](references/mods.md) | Writing any mod: anatomy, `mod.json`, lifecycle, the full `herdr` API, overlays, keys, state, files, `exec`, a complete checked template |
| [references/gpui-kit.md](references/gpui-kit.md) | Element builders, styles, events, focus and keys, motion, virtual lists, inputs/editor/markdown, phase rules, performance |
| [references/patterns.md](references/patterns.md) | Proven idioms with code: status visuals, agent lists, pane headers, context menus, dialogs, compact sidebars, panels, drag reorder, git/watch loops, background mods |
| [references/pitfalls.md](references/pitfalls.md) | Something fails, misbehaves, or looks wrong: symptom → cause → fix |
| [references/sharing.md](references/sharing.md) | Publishing to the gallery, writing `RECIPE.md`, repo layout, URL scheme |
