# Proven patterns

These idioms come from Herdr's shipped mods (`~/.config/herdr-app/mods/*`) and from the
official examples (https://github.com/herdrdev/herdr-layout-examples). When building
something similar, open the source named in each heading. It is current for the installed
version; this file is not.

All snippets assume:
- `t = theme()`;
- imports from `"gpui-kit"`, `"gpui-base"`, and `"herdr"` as needed.

## Contents
- [Status visuals](#status-visuals)
- [Program icons](#program-icons)
- [Agent lists and navigation order](#agent-lists-and-navigation-order)
- [Pane headers](#pane-headers)
- [One mod, several roles](#one-mod-several-roles)
- [Context menus](#context-menus)
- [Confirm and prompt dialogs](#confirm-and-prompt-dialogs)
- [Keyboard-driven popups](#keyboard-driven-popups)
- [Finding layout nodes and the compact rail](#finding-layout-nodes-and-the-compact-rail)
- [Side panels in a stack](#side-panels-in-a-stack)
- [Title bars and `window_drag`](#title-bars-and-window_drag)
- [Drag to reorder](#drag-to-reorder)
- [Watch a folder](#watch-a-folder)
- [Git and other programs](#git-and-other-programs)
- [Machines](#machines)
- [Background-only mods](#background-only-mods)
- [Self-sizing blocks](#self-sizing-blocks)
- [Cross-copy coordination](#cross-copy-coordination)
- [Consistent space colors](#consistent-space-colors)
- [Testable logic](#testable-logic)

## Status visuals

Source: `pane`, `tabs`, `agents`. This is the house style; reuse it so the mod feels
native.

```js
function status(t, s) {
  if (s === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
  if (s === "blocked") return div().flex_none().px(6).h(18).flex().items_center().rounded(5)
    .bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you");
  if (s === "done") return div().size(7).flex_none().rounded(4).bg(t.done);
  return div().size(7).flex_none().rounded(4).border(1.5).border_color(t.idle);   // idle: ring
}
```

- A text alternative for working is `.frames(["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"], 90)`
  (`peek`).
- For a pulse, use `.loop("opacity", { from: 0.4, to: 1, period: 1200 })`.
- Urgency order for sorting: `const RANK = { blocked: 4, done: 3, working: 2, idle: 1 }`.

## Program icons

Source: `pane`, `agents`, `terminals-bar`.

```js
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color)
                : image(p.icon).w(size).h(size).flex_none();
}
```

- A colored tile, as in `terminals-bar`, uses `p.tile` for the background and `p.color`
  for the glyph.
- Display name: prefer the program name for agents and shells; otherwise use the
  terminal's title:
  `((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell"`.

## Agent lists and navigation order

Source: `agents`.

- **Sort:** pinned first, then by `RANK`, then by most recent change (`seq`).
- **Navigation order:** call `setAgentOrder(list.map(a => a.address))` in every render.
  That makes `agent.next`/`agent.prev` (`cmd-]`/`cmd-[` on macOS) follow your order.
- **Click** runs `run("agent.focus", { terminal: a.address })`.
- **Pin** with `run("terminal.pin", { terminal: a.address, pinned: !a.pinned })`.
- **Sub-agents:** `terminals().filter(k => k.parent === a.address && k.state === "live")`.
  Draw them indented, with tree lines.
  - `terminal.peek {terminal}` previews one.
  - `terminal.keep {terminal}` gives one a pane.
- **Remote agents:** their address contains `/` (`vps/t7`).
- **Relative times** ("3m"): repaint with `cx.timer.every(30000, cx => cx.notify())`.
  Status changes need no timer.
- **Persisted UI choices** (sort mode): `localStorage.setItem("sort", JSON.stringify(v))`.

## Pane headers

Source: `pane`, `terminals-pane`; layout side in
[layouts](layouts.md#pane-frames).

```js
me() { return panes().find((p) => p.pane === props()?.pane); }
render() {
  const p = this.me(); if (!p) return div();
  return h_flex().id(`pane-head-${p.pane}`).size_full().px(10).gap(8).items_center()
    .on_hover((h, cx) => { this.hovered = h; cx.notify(); })
    .on_click(() => run("pane.focus", { pane: p.pane }))
    .child(div().flex_1().truncate().child(p.title))
    .when(this.hovered, (el) => el.child(
      div().id(`zoom-${p.pane}`).on_click((_e, cx) => { cx.stop_propagation(); run("pane.zoom", { pane: p.pane }); })
        .child(svg(`mods/pane/${p.zoomed ? "unzoom" : "zoom"}.svg`).size(14))));
}
```

- Buttons call `cx.stop_propagation()` so the header's own click (focus) doesn't also
  fire.
- Always pass `pane` explicitly. Never rely on the focused pane.

## One mod, several roles

Source: Board, win98, Flockbook.

- **Why:** one mod folder can serve several layout blocks, and a mod cannot import another
  mod's files. So a layout with a header, a board, and pane headers uses *one* mod with a
  role prop:

  ```js
  render(cx) {
    switch (props()?.role) {
      case "header": return this.header(cx);
      case "pane":   return this.paneHeader(cx);
      default:       return this.board(cx);
    }
  }
  ```

- **Bigger mods:** split per role into plain classes in separate files
  (`import Taskbar from "./taskbar.js"`). The default `View` delegates
  `init`/`render`/`close` to the role's class.
- **Shared state between role copies:** use `shared()` keys, not module globals. Copies
  are separate instances, and hot reload re-runs the module.

## Context menus

Source: `spaces`, `tabs`, `terminals-bar` (opening it); `menu` (the shipped menu).

```js
.on_mouse_down("right", (_e, cx) => {
  cx.stop_propagation();
  openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260,
                props: { tab: "space", target: { id: space.id } } });
})
```

- **The shipped `menu` mod** builds its items from `props().tab`: `"pane"`, `"tab"`
  (with `target: {id, space}`), `"space"`, or none (global).
- **Your own menu:** reopen your own mod as a popup with a flag, e.g.
  `openOverlay({ mod: "my-mod", kind: "popup", width: 200, height: 140, props: { menu: true } })`.
  Branch on `props().menu` in `init`/`render`, and close it with
  `closeOverlay(props().overlay)` before running the action.
- **Size:** a popup sizes to its content; `height` is only a maximum.
- **Key hints:** look the binding up in `keys()`:

  ```js
  const hint = (name, arg) => keys().find((b) => b.section === "global" &&
    (b.action === name || b.action === `${name}:${arg}`))?.keys ?? "";
  ```

## Confirm and prompt dialogs

Source: `confirm`, `prompt`, `worktree`. Reuse the shipped ones:

```js
openOverlay({ mod: "confirm", kind: "dialog", width: 380, height: 170,
  props: { title: "Close space?", detail: "Its terminals end.", command: { name: "space.close", args: { id, confirmed: true } } } });

openOverlay({ mod: "prompt", kind: "dialog", width: 380, height: 200,
  props: { title: "Rename tab", value: tab.name, hint: "Empty restores its number",
           command: { name: "tab.rename", args: { id: tab.id } } } });   // prompt adds { name: text }
```

- The dimensions above are illustrative; size them to your content.
- When writing your own dialog, copy `confirm/main.js`. It is about 50 lines covering
  focus, Enter/Esc handling, and theme-colored buttons.

## Keyboard-driven popups

Source: `picker`, `new-menu`, tmux-prefix.

```js
init(_p, cx) {
  this.sel = 0;
  this.h = cx.focus_handle(); this.h.focus();
  this.input = InputState.new({ placeholder: "Filter" });
  this.input.on("change", (_e, cx) => { this.q = this.input.value(); this.sel = 0; cx.notify(); });
  this.input.focus();
  cx.timer.after(600, () => this.input.focus());
}
key(e, cx) {
  const items = this.filtered();
  if (e.key === "down") this.sel = Math.min(this.sel + 1, items.length - 1);
  else if (e.key === "up") this.sel = Math.max(this.sel - 1, 0);
  else if (e.key === "enter") { closeOverlay(props().overlay); items[this.sel]?.go(); }
  else if (e.key === "escape") closeOverlay(props().overlay);
  else if (/^[1-9]$/.test(e.key) && !e.modifiers.platform) { /* digit shortcuts, as in new-menu */ }
  else return;
  cx.stop_propagation(); cx.notify();
}
```

- **Opening:** declare the defaults in `mod.json`
  (`"overlay": {"kind":"popup","at":"top","offset":40,"width":640,"height":0.8}`) and bind
  `"cmd-p": "mod.open:<name>"`. Opening it again closes it.
- **Chords like a tmux prefix:** open the popup on the prefix key, take the next key in
  `on_key_down`, and close it.
  - App bindings can win over raw keys, so use `e.key_char` for shifted characters.
  - tmux-prefix keeps a 500 ms repeat window for repeated keys.

## Finding layout nodes and the compact rail

Source: `agents`, `spaces`, `workspace-chrome`, `tabs`.

```js
const find = (n, id) => n?.id === id ? n : (n?.children ?? []).reduce((r, c) => r ?? find(c, id), null);
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  run("layout.resize", { id: "sidebar",
    px: narrow() ? (shared("sidebar.width") ?? 268) : (window()?.platform === "macos" ? 76 : 44) });
}
```

- **Compact rows:** below 160 px, draw the index or avatar plus the status glyph only.
- **Rail width:** 44 px, or 76 px on macOS, where the traffic lights need room.
- **Where width comes from:**
  - `layout()` has the size from the file. Combined with click state, prefer
    `on_size_change` for live width.
  - Herdr T3 measures with `on_size_change` and divides by `settings().zoom`.

## Side panels in a stack

Source: `tabs`, with the `main` layout's `panel` → `panel-body` stack.

```js
function openPanel(child) {
  run("layout.select", { stack: "panel-body", child });
  run("layout.show", { id: "panel" });
}
```

- **Remembering per space:** `tabs` stores which panel was open per space in
  `localStorage` and restores it when the space changes.
- **Enabled panels:** read from `shared("workspace.panels")`, default
  `["files", "changes"]`.

## Title bars and `window_drag`

Source: `terminals-bar`, `tabs`, `win98/kit.js`.

- **Layout side:**
  - Root: `"titlebar": "none"` and `"traffic_lights": [x, y]`.
  - The bar block: `"window_drag": true`.
- **Mod side, stopping presses:** every control must stop the press, or it drags the
  window (and a right press opens the system menu):

  ```js
  const own = (el) => el
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_mouse_down("right", (_e, cx) => cx.stop_propagation());
  ```

- **Room for the traffic lights:**

  ```js
  const w = window();   // null before the window exists and under `herdr-app check`
  bar.when(w?.platform === "macos" && w?.titlebar === "none" && !w?.fullscreen, (el) => el.pl(72))
  ```

  - `tabs` computes the exact offset as `(traffic_lights[0] + 64) / zoom` minus the
    sidebar width.
  - Herdr T3 reads `layout().traffic_lights`.
- **Window buttons** where the system draws none (`w?.buttons`): call `window.minimize`,
  `window.maximize`, and `window.close`. Show a restore icon when `w?.maximized`.

## Drag to reorder

Source: `spaces` (`space.move`), `tabs` (`tab.move`), `win98/sol.js` (free dragging).

```js
.on_mouse_down("left", (e) => { this.pressed = { id: s.id, y: e.position.y }; })
.on_mouse_move((e, cx) => {
  if (!this.pressed || Math.abs(e.position.y - this.pressed.y) < 4) return;   // 4px threshold
  this.over = i; cx.notify();                                                 // draw an accent drop line
})
.on_mouse_up("left", (_e, cx) => {
  const p = this.pressed; this.pressed = null;
  if (p && this.over != null) run("space.move", { id: p.id, index: this.over + 1 });
  else if (p) run("space.select", { id: p.id });
  this.over = null; cx.notify();
})
```

A release outside the element is never seen. Reset the drag state on the next press and
on hover exit.

## Watch a folder

Source: `files`, `changes`.

```js
watch(root, cx) {
  this.watched = root;
  cx.spawn(async (cx) => {
    while (this.watched === root) {          // guard: a new root ends the old loop
      try { await watchFolder(root); } catch { await cx.sleep(10000); }
      if (this.watched !== root) break;
      await this.refresh(); cx.notify();
    }
  });
}
```

- **Fallback timer:** keep one (the shipped panels use 10 s). `watchFolder` is local-only,
  and on Linux it rejects trees with more than 4096 directories.
- **Scope:** watch what you show, never a whole home folder.

## Git and other programs

Source: `spaces`, `files`, `changes`, `menu`.

```js
const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false",
  "status", "--porcelain=v2", "--branch"], { cwd: space.folder, on: space.machine });
```

- **Why these flags:** they keep git from touching the index, which would re-trigger your
  own `watchFolder` loop.
- **Where the repo is:** a space's *live* folder is its first terminal's cwd
  (`panes()[i].cwd`). `space.folder` is where new terminals start.
- **Failures:** `exec` rejects when the program is missing or the machine is unreachable.
  Catch the rejection and render a quiet fallback.

## Machines

Source: `spaces`, `picker`.

```js
const r = await hc(["machine", "ls", "--json"]);
const list = JSON.parse(r.stdout).machines.filter((m) => !m.temporary);
```

- **Grouping:** group spaces by `space.machine`, with null meaning this computer. Local
  comes first, then machines by name.
- **Availability:** `machines()` gives each machine's layout availability (`loading`,
  `ready`, or `unavailable`). Structural commands fail while a machine is unavailable.

## Background-only mods

Source: Desktop notifications
(https://herdr.dev/mods/benjaminsicard/herdr-mods--desktop-notifications/).

- **Setup:** `mod.json` `{"place":"bottom","size":0}`. `render` returns `div()`, and a
  timer or `cx.spawn` loop does the work.
- **Limits:**
  - It runs only while some block in the *shown* layout holds it, so add it to every
    layout the person uses.
  - Two copies do the work twice, so deduplicate through `shared()`.
  - Prefer Herdr's own `notify()` and `playSound()` for in-app alerts.
  - Call external notifiers through `exec` with absolute paths.

## Self-sizing blocks

Source: Herdr T3.

```js
.id("root").on_size_change((size, cx) => {
  const want = Math.ceil(this.contentWidth / settings().zoom);
  if (want !== this.lastWant) { this.lastWant = want; run("layout.resize", { id: props().block, px: want }); }
})
```

Pass the block's own id in `props` (`"props": {"block": "inbox"}`). Resizing is stored as
a click.

## Cross-copy coordination

Source: `win98/sol.js`.

```js
// sender
setShared("my.req", { cmd: "deal", t: Date.now() });
// receiver, in render
const req = shared("my.req");
if (req && req.t > (this.lastReq ?? 0)) { this.lastReq = req.t; this.handle(req.cmd); }
```

- Every `setShared` re-renders every mod, so use this for rare events, not streams.
- Namespace keys as `<mod>.<thing>`.

## Consistent space colors

Source: `spaces`, `picker`.

- **Where the colors live:** `shared("space.colors")` maps a space id to `"ansi3"` or a
  hex value.
- **Agreeing on colors:** each mod that draws space avatars repeats the same "fewest-used
  palette color" assignment, so they all agree. Map ansi names to hex through `theme()`.
- **Writing:** write a value only when the person picks one.

## Testable logic

Source: Desktop notifications, Herdr T3.

- **Pure logic in its own file:** decisions such as which transition should notify go in
  a module that doesn't import `"herdr"`, e.g. `mods/<name>/alerts.js`.
  - `main.js` imports it.
  - It can be unit-tested with `node --test` outside Herdr.
- **Faking the host:** for whole-mod tests, load `main.js` against a fake `herdr` module
  in a local script.
- **Neither replaces checking in the app:** still run `herdr-app check` and look at the
  real window.
