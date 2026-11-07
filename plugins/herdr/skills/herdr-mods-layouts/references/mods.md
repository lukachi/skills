# Mods: `mods/<name>/`

A mod is a small JavaScript program that *describes* native GPUI elements. Rust draws
them; there is no DOM. Mods are trusted code. They have unrestricted command access, plus
network, process, and file access with the person's rights.

## Contents
- [Anatomy](#anatomy)
- [`mod.json`](#modjson)
- [Lifecycle](#lifecycle)
- [View and `cx`](#view-and-cx)
- [The `herdr` module](#the-herdr-module)
- [Commands from a mod](#commands-from-a-mod)
- [Overlays: dialog, popup, window](#overlays-dialog-popup-window)
- [Keys, focus and `nextCommand`](#keys-focus-and-nextcommand)
- [State](#state)
- [Machine, files and programs](#machine-files-and-programs)
- [Terminal right-click menu](#terminal-right-click-menu)
- [Assets and fonts](#assets-and-fonts)
- [Checked template](#checked-template)

## Anatomy

```text
mods/<name>/
  main.js        required; default-exports a class extending View
  mod.json       where the mod first appears, and its overlay defaults
  *.js           more ES modules: import X from "./x.js"
  *.svg, *.png   art, referenced as "mods/<name>/<file>"
  fonts/         .ttf/.otf files loaded with the look
```

Herdr writes `jsconfig.json` and a per-mod copy of the `.d.ts` files into each mod folder.
Leave them alone; the app rewrites them. Only the default export needs to extend `View`.
Sub-views can be plain classes with `init(p, cx)` / `render(cx)` that your view calls
(this is how win98 is organized).

## `mod.json`

| Key | Meaning |
|---|---|
| `place` | `"left"`, `"right"`, `"top"`, `"bottom"` docks one copy into the shown layout the first time Herdr sees the folder. `"none"` means only where a layout or another mod puts it. After first sight, the layouts decide. |
| `size` | px for that first dock. A `0` size with `place:"bottom"` gives an invisible background mod. |
| `title` | The name shown for the mod, for example in pane headers and the palette. |
| `overlay` | Defaults when opened with `mod.open`: `{ "kind": "dialog" \| "popup" \| "window", "width", "height", "at": "top" \| "pointer" \| {x,y}, "offset" }`. A `width`/`height` of 1 or less is a share of the window. |
| `focusable` | `true` lets `pane.go` move the keyboard onto a visible copy (see below). |

Examples from shipped and gallery mods:

```json
{ "place": "none" }
{ "place": "none", "title": "Agents" }
{ "place": "none", "title": "Picker", "overlay": { "kind": "popup", "at": "top", "offset": 40, "width": 640, "height": 0.8 } }
{ "place": "none", "overlay": { "kind": "dialog", "width": 560 } }
{ "place": "bottom", "size": 0 }
```

## Lifecycle

- **Start:** a copy starts the first time its block shows.
  - It **stays alive while the block is in the layout**, even when hidden: a hidden
    column, an inactive stack child, a pane in another tab, or a pane behind a zoom.
  - Timers keep running while hidden, so poll gently.
- **Restart:** a layout switch starts the new layout's mods fresh; pane mods belong to
  their tab and are kept. A block that is removed, or given another mod or other props,
  starts over.
- **Hot reload:** saving any file in the folder reloads every copy in place. This excludes
  the app-written `jsconfig.json`, `.d.ts`, hidden files, and `node_modules`.
  - The old build's tasks stop. A loop ends at its next `cx` use.
  - A broken save keeps the old build running and reports the error in
    `herdr-app status`.
  - Top-level module code has already run by then, so keep side effects on `globalThis`
    out of the module's top level.
- **Command delivery:** `<mod>.<command>` from keys or `run()` reaches *shown* copies only.
- **`async close(cx)`** on the exported View gets one final call when its pane, tab, slot,
  or overlay goes away, and on app quit. It is not called for hidden copies or inactive
  tabs.
  - Budget: 250 ms, shared across copies on quit. Unfinished tasks are then cancelled.
  - Start cleanup inside `close`. Don't await work started earlier.
  - On quit, only `exec(...)` and `run("terminal.kill", …)` reliably go out.
  - It is best-effort: it doesn't run after a crash or forced kill.

## View and `cx`

```js
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, theme, run } from "herdr";

export default class MyMod extends View {
  init(props, cx) { /* once: retained state, focus handles, InputState, timers, spawn */ }
  render(cx)      { /* describe the UI from live data; return an element */ }
  async close(cx) { /* optional bounded cleanup */ }
}
```

**When `render` runs:**
- After `cx.notify()`.
- When Herdr's live data changes: spaces, agents, terminals, focus, theme, shared state.
- On hot reload.

It is never called per frame, and many `notify()` calls coalesce into one render per frame.
Keep `render` cheap and synchronous; slow work belongs in `cx.spawn`.

**`cx` is per call.** A handler's `cx` dies when the handler returns. For async work, use
`cx.spawn(async (cx) => …)` or `cx.timer.every/after(ms, (cx) => …)`; the `cx` they pass
survives `await`.

A task's `cx` belongs to the copy that started it: `cx.notify()` redraws that copy, even
when another copy resolved a shared promise.

| `cx` member | Use |
|---|---|
| `notify()` | Re-render this view. Illegal inside `render`. |
| `spawn(async cx => …, {owner?})` | An async task owned by the view. `{owner: null}` outlives views. |
| `timer.after(ms, cx => …)` / `timer.every(ms, cx => …)` | Timers. `every` measures from the end of the previous call, so ticks don't stack. |
| `sleep(ms)` | An awaitable delay inside a spawned task. |
| `focus_handle()` | A keyboard focus handle (create it in `init`). |
| `new(Class, props)` | A retained child view (entity), so it can re-render on its own. |
| `stop_propagation()` / `propagate()` | Event bubbling control. |
| `bind_keys([{keystroke, action, context}])` | Element-level key bindings; pair them with `.key_context()` and `.on_action()`. |

**Size:** put `.id("root").on_size_change((size, cx) => { this.size = size; cx.notify(); })`
on the root `div`/`h_flex`/`v_flex`.
- It reports `{width, height}` after the first layout and on every resize.
- The shipped picker divides by `settings().zoom` to get layout px. Herdr T3 does the same
  before calling `layout.resize`.

## The `herdr` module

Grep `herdr.d.ts` for exact shapes. Everything listed under "Live data" re-renders the mod
when it changes.

**Live data**
- `spaces(): SpaceInfo[]`: `id`, `index`, `name`, `named`, `folder`, `machine` (null =
  this computer), `branch`, `active`, `status`, and `tabs[]`.
  - Each tab has `id`, `index`, `name`, `named`, `active`, `status`, `panes`, `zoomed`,
    `settled`, `settled_at`, `changed_at`, and `working_since`.
- `agents(): AgentInfo[]`: `address`, `pane`, `space`, `space_name`, `tab`, `tab_index`,
  `tab_name`, `status`, `app`, `program`, `title`, `seq` (higher = changed more
  recently), `pinned`, and `focused`.
- `panes(): PaneInfo[]`: `pane`, `terminal` (null for mod panes, which have `mod`), `tab`,
  `title`, `cwd`, `branch`, `status`, `app`, `program`, `focused`, `zoomed`, `movable`.
  - Every call copies all panes, so call it once per render.
- `terminals()`: every core terminal, as `hc ls --json` gives it.
  - Fields include `address`, `argv`, `name`, `parent`, `labels`, and `state`, plus
    `status`, `report`, and `program`.
  - Sub-agents are `terminals().filter(k => k.parent === addr && k.state === "live")`.
- `focused()`: `{space, tab, pane, terminal, shown, agent, cwd}`.
  - `pane` is null when a layout terminal block or a window terminal has the keyboard, so
    check `focused()?.pane` before offering pane controls.
- `machines()`: `[{name, layout: "loading" | "ready" | "unavailable"}]`; the local machine
  has `name: null`.
- `theme()` returns colors, and `themes()` the available themes.
- `settings()`: the shown look (including `zoom` and `dark`) plus `font_family`.
  - `fonts()`, `keys()`, `commands()`, and `layouts()` return what their names say.
  - `layout()` returns the shown layout *file* tree.
- `window()`: `{platform, titlebar, buttons, maximized, fullscreen, active}`, or null under
  `herdr-app check` and before the window exists. Read it as `window()?.platform`.
  - It shadows the gpui global `window`; import it under another name
    (`window as win`) if you need both.
- `placement()`: for floating copies only; null otherwise.
- `updates()` and `telemetry()` also exist.

**Program**

`program` describes how the terminal shows: `{key, name, icon, tint, tile, color, shell,
agent}`.
- Draw `svg(icon).text_color(c)` when `tint` is true, else `image(icon)`.
- `tile` and `color` are for colored tiles.

**Status**

| Value | Meaning |
|---|---|
| `working` | The agent is busy |
| `blocked` | It needs the person |
| `done` | It finished while unwatched; becomes `idle` once seen on any client |
| `idle` | Nothing pending |

A space's or tab's status is its most urgent agent's: blocked > done > working > idle.

**Act**
- `run(name, args)`: see [Commands from a mod](#commands-from-a-mod).
- `setAgentOrder(addresses)`: call it on every render of an agent list so
  `agent.next`/`agent.prev` follow your order.
- `notify({title, body?, level?, timeout?, icon?, action?: {name, args}})`: a toast, drawn
  by the `toast` mod. Clicking it runs `action`.
- `playSound("done" | "blocked" | "<path>.mp3")`.
- `openOverlay(spec)` / `closeOverlay(id)`: see below.

**This copy**
- `props()`: the block's `props`. For overlays it also includes `overlay`, the overlay id.
- `shared(key)` / `setShared(key, value)`: see [State](#state).
- `nextCommand()`: see [Keys, focus and `nextCommand`](#keys-focus-and-nextcommand).

## Commands from a mod

`run(name, args)` is the only way to change the app; keys, menus, and the CLI use the same
command list.

- Unknown argument names are errors.
- Target ids (`id`, `pane`, `space`, `terminal`) must be strings.
- An agent never gets a missing-argument dialog. Pass every required argument, for example
  `space.close {id, confirmed: true}`.

Main groups (run `herdr-app commands` for all 71 with their arguments):
- **Spaces:** `space.new {name?, folder?, tab?, argv?, task?, machine?}`, `space.close`,
  `space.rename`, `space.move`, `space.select {index | id}`, `space.next`/`prev`.
- **Tabs:**
  - `tab.new {name?, space?, folder?, argv?, task?}`, or `{…, mod, props?}` for a mod tab.
  - `tab.close`, `tab.rename`, `tab.move`, `tab.select`, `tab.next`/`prev`,
    `tab.settle`/`unsettle`.
- **Panes:** `pane.split {direction, pane?, argv? | mod?, props?}`, `pane.close`,
  `pane.zoom`, `pane.focus {pane | terminal}`, `pane.go {direction}`,
  `pane.swap {direction}`.
- **Terminals:**
  - `terminal.open {argv?, folder?, place?: tab | right | down, name?}`, `terminal.kill`.
  - `terminal.keep {terminal, place?}` / `terminal.park` (give a pane / send back).
  - `terminal.peek`, `terminal.show`, `terminal.pin {terminal, pinned}`.
  - `terminal.scroll`, `terminal.search`, `terminal.copy`/`paste`/`paste_image`,
    `terminal.right_click`.
- **Agents:** `agent.focus {terminal}`, `agent.next`, `agent.prev`.
- **Layout:** `layout.switch`/`toggle`/`show`/`hide`/`resize`/`select`/`set`/`reset`/`clone`.
- **App:** `mod.open {name}` (again: closes it), `mod.clone`, `overlay.close`, `app.help`,
  `app.palette`, `app.settings {section?}`, `app.theme {name}`, zoom, `app.feedback`.
- **Window:** `window.minimize`, `window.maximize`, `window.close`. On macOS also
  `app.quit`/`hide`/`hide_others`/`show_all`.
- **Mod commands:** `run("<mod>.<command>")` delivers to that mod's `nextCommand()`.

## Overlays: dialog, popup, window

```js
const id = openOverlay({
  mod: "my-mod", props: { … },   // or layout: { …blocks… } instead of mod
  kind: "dialog" | "popup" | "window",
  width, height,                 // px, or ≤ 1 = share of the window
  at: "pointer" | { x, y },      // popup default: the pointer; window: top-left, else centered
  modal, frame: "none", key, keep,
});
// inside the overlay mod:
closeOverlay(props().overlay);
```

- **dialog:** centered, and dims the window.
  - A click outside closes it unless `modal: true`.
  - Esc closes the top dialog or popup.
- **popup:** anchored at `at`.
  - It is as tall as its items; `height` is only a maximum.
  - Anchor it under the clicked element with
    `{ x: e.bounds.x, y: e.bounds.y + e.bounds.height }`.
- **window:**
  - Stays open until closed. It sits under dialogs, doesn't dim, and ignores clicks
    outside it.
  - Any press the mod doesn't stop drags it, so stop presses on your controls.
  - `key` remembers where it was dropped, and reopening the same key replaces it.
  - `keep: true` (with `key`) reopens it on the next start.
  - A layout switch closes windows; kept ones come back with their layout.
- **`frame: "none"`** drops Herdr's border, corners, shadow, and background, so the mod
  draws its own.
- **`layout:`** an overlay can hold layout blocks, terminals included. Esc then goes to
  the terminal, so provide a close control. It closes itself when its terminal ends.
- **Reuse the shipped dialogs** instead of writing your own:
  - `openOverlay({mod:"confirm", kind:"dialog", props:{title, detail, command:{name,args}}})`
  - `openOverlay({mod:"prompt", kind:"dialog", props:{title, value, hint, command:{name,args}}})`.
    The prompt merges `{name: text}` into the args.

## Keys, focus and `nextCommand`

- **Binding a key to a mod:** add `"alt-s": "my-mod.toggle"` in `keys.json` (any section),
  or call `run("my-mod.toggle")`. The mod receives it with:

  ```js
  cx.spawn(async (cx) => {
    for (;;) {
      const c = await nextCommand();
      try { this.command(c); } catch (e) { console.log(String(e)); }
      cx.notify();
    }
  });
  ```

- **`mod:<name>` section:** active while that mod has the keyboard. tmux-prefix uses
  `"mod:tmux-prefix": {"ctrl-b": "tmux-prefix.send-prefix"}`.
- **Opening on a key:** `"ctrl-b": "mod.open:tmux-prefix"` opens an overlay mod using its
  `mod.json` overlay defaults.
- **Raw keys inside a mod:**
  1. In `init`: `this.h = cx.focus_handle(); this.h.focus();`.
  2. On the root: `.id("x").track_focus(this.h).on_key_down((e, cx) => { …; cx.stop_propagation(); })`.
  3. Read `e.key` (`"enter"`, `"escape"`, `"up"`, `"a"`), `e.key_char` (shifted
     characters), and `e.modifiers.{shift, control, alt, platform, function}`.
- **`focusable: true`** in `mod.json` lets `pane.go` move onto the copy.
  - It then receives `"focus"` from `nextCommand()`; respond by focusing your own handle.
  - It receives `"focus"` again after a popup over it closes.
  - To leave, call `run("pane.go", {direction})`.
- **Overlay inputs:** `InputState.focus()` sometimes misses the first frame. The shipped
  prompt, picker, and worktree mods re-focus with
  `cx.timer.after(600, () => this.input.focus())`.
- **Keys the app would grab first** (for example Esc in menus): bind element keys with
  `cx.bind_keys([{keystroke:"escape", action:"my_escape", context:"MyMenu"}])` plus
  `.key_context("MyMenu").on_action("my_escape", …)`, as `win98/menu.js` does.
- **Choosing keys:** avoid ctrl+letters that programs rely on: c, d, l, r, w, a, e, u, k,
  z, and `[`. On many Mac layouts, option+key types characters. Only take these if the
  person asks, and say what typing they lose.

## State

| Store | Scope | Notes |
|---|---|---|
| Fields on `this` | This copy, until it restarts | Most UI state |
| `localStorage` | Per mod copy, persisted to `data/<mod>/store.json` | String values: `JSON.stringify` / `JSON.parse` |
| `shared(key)` / `setShared(key, v)` | Every mod, persisted in `shared.json` | Every `setShared` re-renders all mods. Namespace keys as `<mod>.<thing>`. Survives layout switches. |
| `fs/promises` | Reads anywhere under home; writes only under the app home | The write limit is not a security boundary |

Shared keys used by shipped mods (read them, don't clobber them):
- `layout`
- `sidebar.width`, `sidebar.collapsed`
- `agents.sort`
- `space.colors` (`{spaceId: "ansi3" | "#hex"}`)
- `workspace.panels`
- `new-menu.agents`
- `frame.welcomed`

**Cross-copy request idiom (win98):** write a stamped request,
`setShared("x.req", { cmd, t: Date.now() })`. The receiver acts only when `t` is newer than
the last stamp it handled.

## Machine, files and programs

- **`exec(cmd, args, {cwd?, on?})`** returns a promise of `{code, stdout, stderr}`.
  - It runs in the person's real environment (PATH, HOME, auth), with a 30 s limit and
    8 MiB of output.
  - `on: space.machine` runs it on that machine through herdr-core.
  - It rejects if the program can't start or the machine is unreachable.
  - Newer builds add `timeout`; check `herdr.d.ts` first.
- **`hc(args)`** runs herdr-core, for example
  `hc(["machine", "ls", "--json"])` or `hc(["read", "t3", "--lines", "50"])`.
- **Files:**
  - `readTextFile(path, {on?})` reads up to 1 MiB and returns null when the file is absent.
  - `writeTextFile(path, text, expected)` writes locally only, with optimistic
    concurrency: `expected` is the previous text, or null to create the file.
- **`watchFolder(dir)`** resolves with the changed paths on the next change. Loop on it
  with a guard; see [patterns](patterns.md#watch-a-folder).
  - Locally only. For remote spaces, poll instead.
  - On Linux it skips git-ignored directories and rejects trees larger than 4096
    directories, so keep a timer fallback.
- **Other helpers:**
  - `home()` and `appHome()` return the two folders.
  - `pickFolder({prompt})` opens the system folder picker.
  - `knownAgents({on})` lists agents the person can start (`run` is the argv;
    `installed` says whether they can start it here).
- **Also available:** `fetch`, `websocket`, `net`, `crypto`, `zlib`, `path`, `url`,
  `buffer`, `os`, `process.run`, and `console.log`. Prefer `exec` over `process.run`:
  `exec` gets the person's real environment.
- **Absolute paths:** strings that another program will run, such as a notifier's click
  action, need absolute paths. Only `exec` gets the person's PATH.

## Terminal right-click menu

A layout root with `"terminal_menu": "my-menu"` replaces the whole terminal menu; items
are not merged.
- It opens as a pointer popup. The default size is 220×260; `mod.json` `overlay`
  width/height override it.
- `props()` is `{tab: "pane", target: {pane, terminal}, overlay}`.
- Always act on `target`, never on the focused pane.
- A terminal outside a tab (a layout terminal block, a window) has no pane: `target.pane`
  is the block id and is absent from `panes()`. Leave pane items out in that case.

```js
import { View, div } from "gpui-kit";
import { props, run, closeOverlay } from "herdr";
export default class MyMenu extends View {
  render() {
    return div().id("split-target").child("Split this pane").on_click(() => {
      const { target, overlay } = props();
      closeOverlay(overlay);
      run("pane.split", { pane: target.pane, direction: "right" });
    });
  }
}
```

## Assets and fonts

- **Paths:** relative to the app home, never to the mod.
  - `svg("mods/<name>/icon.svg")` is a one-color glyph tinted with `text_color`.
  - `image("mods/<name>/logo.png")` is full color.
  - Program icons live under `icons/`.
- **Updating assets:** saving an asset under `mods/` refreshes every mod showing it.
- **Shared icons:** you may reuse other mods' art, such as
  `mods/workspace-chrome/spinner.svg` for a ring spinner. If that mod is renamed or
  missing, the image breaks.
- **Renaming:** renaming a mod means renaming its asset paths too. `mod.clone` does this
  for you.
- **Fonts:** `.ttf`/`.otf` files in `mods/<name>/fonts/` load at start and on the next look
  change.

## Checked template

This complete mod passes `herdr-app check`. It is an agent list that:
- sorts agents by urgency and feeds `setAgentOrder`;
- shows native status visuals and program icons;
- shrinks to a compact rail when narrow, or on a `toggle` key command.

```js
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, theme, run, setAgentOrder, props, shared, setShared, nextCommand } from "herdr";

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class AgentStrip extends View {
  init(_props, cx) {
    this.width = 0;
    cx.timer.every(30000, (cx) => cx.notify()); // only for relative-time text; live data re-renders by itself
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();          // keys.json: "alt-a": "agent-strip.toggle"
        if (c === "toggle") setShared("agent-strip.compact", !shared("agent-strip.compact"));
        cx.notify();
      }
    });
  }

  status(t, s) {
    if (s === "working") return div().text_color(t.working).frames(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], 90);
    if (s === "blocked") return div().px(6).rounded(5).bg(t.blocked + "26").text_color(t.blocked).text_size(10.5).child("Needs you");
    if (s === "done") return div().size(7).rounded(4).bg(t.done);
    return div().size(7).rounded(4).border(1.5).border_color(t.idle);
  }

  render() {
    const t = theme();
    const list = [...agents()].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0) || b.seq - a.seq);
    setAgentOrder(list.map((a) => a.address));
    const compact = Boolean(shared("agent-strip.compact")) || this.width < 160;
    return v_flex()
      .id("root")
      .on_size_change((size, cx) => { this.width = size.width; cx.notify(); })
      .size_full().p(8).gap(2)
      .bg(t.chrome).text_size(12.5).text_color(t.foreground)
      .overflow_y_scrollbar()
      .when(list.length === 0, (el) => el.child(div().text_color(t.dim).child(props()?.empty ?? "No agents")))
      .children(list.map((a) => {
        const pic = icon(a.program, 14, t.muted);  // elements are single-use: build once, use once
        return h_flex()
          .id(`agent-${a.address}`)
          .h(28).px(8).gap(8).items_center().rounded(6)
          .when(a.focused, (el) => el.bg(t.selected))
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .when(Boolean(pic), (el) => el.child(pic))
          .when(!compact, (el) => el.child(div().flex_1().truncate().child(a.tab_name)))
          .child(this.status(t, a.status));
      }));
  }
}
```

Place it with `{"place": "none", "title": "Agent strip"}`, then reference it from a layout
block: `{ "id": "strip", "type": "block", "size": { "px": 220 }, "content": { "mod": "agent-strip", "props": { "empty": "Nothing running" } } }`.
