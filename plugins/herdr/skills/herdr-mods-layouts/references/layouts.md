# Layouts: `layouts/<name>.json`

One file describes one whole window. Every layout shows the same world: the same spaces,
tabs, terminals, and agents. A layout may show less of it, but never a different one.
Structure such as spaces, tabs, and splits lives in each machine's core document and
changes only through commands. There is no `spaces.json`.

## Contents
- [Lifecycle and ownership](#lifecycle-and-ownership)
- [Node types](#node-types)
- [Properties any node can have](#properties-any-node-can-have)
- [Root-only fields](#root-only-fields)
- [The look and its cascade](#the-look-and-its-cascade)
- [Pane frames](#pane-frames)
- [Floating blocks and drawers](#floating-blocks-and-drawers)
- [Keys scoped to a layout](#keys-scoped-to-a-layout)
- [Changing a layout at run time](#changing-a-layout-at-run-time)
- [Annotated examples](#annotated-examples)

## Lifecycle and ownership

- **Adding a layout:** write a new file and it appears in Settings and in the
  `layout.switch` cycle (`cmd-shift-l` on macOS, `ctrl-shift-l` elsewhere).
  - `layout.switch {name}` picks one directly.
  - `shared("layout")` holds the shown layout's name.
  - `layouts()` lists all names, with `main` first.
- **Shipped layouts:** `main` ("Herdr"), `terminals`, and `win98` are rewritten on every
  start.
  - Edit a shipped file and the next start moves your version to `<name>-edited`, then
    restores Herdr's.
  - `layout.clone {name, as?}` duplicates a layout, records `cloned_from`, copies its look
    and clicks as-is, and switches to it. Clones are never updated.
  - `layout.reset {name}` restores a shipped layout and its clicks, keeping the previous
    file as `<name>.json.old-<time>`.
- **Clicks:** sizes, hidden/shown, active stack child, floating spots, theme picks,
  background, text size, and pane header/border looks are stored in
  `layouts/.state/<name>.json`, not in your JSON.
  - Don't edit `.state` files.
  - A deliberate edit to a field in the layout file beats a stored click on that field.
- **Mod lifetime:** a layout switch starts that layout's mods fresh. Pane mods belong to
  their tab and are kept. A block removed, or given another mod or other props, starts
  over.
- **Errors:** an invalid file keeps the last good version running and writes the reason
  to `layout.error`. A block naming a missing mod shows `no mod folder` in
  `herdr-app status`.

## Node types

| `type` | Meaning | Extra fields |
|---|---|---|
| `block` | Shows content | `content` (below) |
| `row` / `column` | Children side by side / stacked | `children`, `gap`, `divider`, `resizable` |
| `stack` | Shows one child at a time | `children`, `active: "<child id>"`, optional `header`: a mod that draws the tabs, or `"tabs"` for a plain built-in strip |

`block.content` is one of:

| Content | Shows |
|---|---|
| `{ "mod": "<folder>", "props": { … } }` | A mod; `props()` returns `props` |
| `{ "tab": "active", "pane": { … } }` | The shown tab's terminals, split as the tab arranges them, each wrapped by the pane frame |
| `{ "terminal": "t7" }` | One fixed terminal. It is not a tab pane, so it never drags and its `target.pane` is the block id |
| `{ "agent": "focused" }` | One agent's terminal, full size: the one chosen with `agent.focus`/`agent.next`, else the focused pane's agent, else the first agent |

## Properties any node can have

- **Identity and size:**
  - `id` must be unique; commands address nodes by it.
  - `size`: `{ "px": 240 }` (fixed) or `{ "weight": 2 }` (a share of what fixed siblings
    leave).
  - `min` / `max` (px) and `hidden`.
- **Paint:**
  - `background`: a theme color name, `#rrggbb[aa]`,
    `{ "gradient": ["#2a6cbd", "#0b2a57"], "angle": 165 }`, or
    `{ "image": "backgrounds/sky.jpg", "fit": "cover" | "contain" }` (path relative to the
    home).
  - `border` (`{ "width": 1, "color": "border" }`), `radius`, `shadow` (`sm`/`md`/`lg`),
    and `focus: { "border": {…} }` while the focused pane is inside.
- **Spacing:** `padding` is a number, or `[vertical, horizontal]`, in px.
- **Rows and columns:**
  - `gap` and `divider` (`{ "width": 1, "color": "border" }`).
  - `resizable` defaults to true: the boundary can be dragged. It applies to that node
    only.
- **`movable`** (default true) lets panes be dragged by the top-center grip.
  - It *inherits*: the nearest explicit ancestor wins, including through the tab block.
  - Root `"movable": false` turns pane dragging off for the whole layout.
- **`window_drag: true`:** dragging this node moves the window, and a double-click
  maximizes it. Controls inside must stop their mouse-down; see
  [patterns](patterns.md#title-bars-and-window_drag).
- **`floating`:** blocks drawn over this node (below).
- **Colors:** theme names (`border`, `accent`, `surface`, `chrome`, `canvas`, …) or hex.
  Prefer names when the layout must work in both light and dark.

## Root-only fields

- `"titlebar": "none"` hides the system title bar so the layout draws its own: a bar mod
  in a `window_drag` block.
  - `"traffic_lights": [x, y]` places the macOS window buttons over the layout. Leave them
    room; the shipped layouts use `[12, 16]` and `[16, 18]`.
  - On Linux and Windows (`window()?.buttons === true`), draw your own buttons with
    `window.minimize`, `window.maximize`, and `window.close`.
- `"preview": "layouts/<name>.svg"` (or a PNG, or `mods/<x>/preview.svg`) is the picture
  Settings shows. Draw one for every new layout; without it the person sees a plain frame.
- `"terminal_menu": "my-menu"` replaces the terminal right-click menu with your mod. See
  [mods](mods.md#terminal-right-click-menu).
- `"movable": false`, as described above.

## The look and its cascade

Precedence: **theme picker > layout look > `settings.json` > Herdr defaults**
(JetBrains Mono 14, Geist, graphite/paper). Look fields can sit on any node, and the
nearest ancestor wins. Today, though, only the root's look is applied.

```json
{ "id": "root", "type": "row",
  "theme": { "light": "paper", "dark": "graphite" },
  "colors": { "accent": "#a7b4c6" },
  "font": "Geist Mono", "font_size": 15, "ui_font": "Geist",
  "terminal_padding": [10, 6], "terminal_opacity": 1 }
```

- **`theme`:**
  - Presets are `graphite`, `ink`, `moss` (dark) and `paper` (light), or any
    `themes/<name>.json`.
  - The `{light, dark}` form follows the system appearance, or `appearance` from settings.
  - A theme file named after a layout (`themes/win98.json`) belongs to that layout only.
- **`colors`:** overrides any theme color by name, for terminals and mods alike. The
  overrides apply in both appearances, so a layout meant for both should override with
  theme names rather than hex.
- **Fonts:**
  - `font` / `font_size` are for terminals (px at zoom 1). `ui_font` is for mods; mod text
    sizes are the mod's own.
  - JetBrains Mono, Geist Mono, and Geist ship with Herdr.
  - `.ttf`/`.otf` files in a mod's `fonts/` folder, or in the home's `fonts/`, are loaded
    too. This is how a layout carries its own fonts (win98 does).
- **`terminal_opacity`:** values below 1 let the frame or gradient behind a terminal show
  through.
- **Theme files:** `themes/<name>.json` is
  `{ "background", "foreground", "selection", "cursor"?, "ansi": [16], "colors"?: {…} }`,
  all `#rrggbb`. Panel colors are derived from it; `colors` overrides them.
- **Theme color names** seen by mods (`theme()`):
  - surfaces: `background`, `canvas`, `chrome`, `surface`, `popover`, `raised`, `hover`,
    `selected`;
  - lines: `border`, `input`;
  - text: `foreground`, `muted`, `dim`;
  - accents and buttons: `accent`, `accent_foreground`, `solid`, `solid_foreground`,
    `selection`;
  - statuses: `working`, `blocked`, `done`, `idle`, `unknown`;
  - terminal palette: `ansi0`–`ansi15`.
- **Deciding whether to set a look:**
  - To follow the person's own look, set no `theme`, as Herdr (main) and Herdr T3 do.
  - A themed layout, like Board or Pasture, brings `theme`, `colors`, and fonts on the
    root.

## Pane frames

The tab block's `pane` object wraps each pane of the shown tab:

```json
{ "tab": "active",
  "pane": { "gap": 8, "radius": 10, "background": "background", "lone": true,
            "border": { "width": 1, "color": "border" },
            "focus":  { "width": 1, "color": "accent" },
            "header": { "content": { "mod": "pane" }, "height": 30,
                        "position": "top", "reveal": "always" } } }
```

- `focus` replaces `border` while that pane has the keyboard. `gap` is the space between
  panes.
- `lone: true` frames a single pane too. By default only split panes are framed.
- **`header`** draws one copy of a mod per pane, with `props()` = `{ pane, terminal }`.
  - Read live facts with `panes().find(p => p.pane === props().pane)`: title, cwd,
    branch, status, program, focused, zoomed, movable.
  - Mod panes have `terminal: null` and a `mod` field.
  - `position` is `top` or `bottom`.
  - `reveal: "hover"` draws the header over the terminal only while hovered, so the
    terminal never resizes.
- Each layout has its own pane frame, so one layout can stay bare while another turns
  panes into cards.

## Floating blocks and drawers

```json
"floating": [ { "id": "board", "content": { "mod": "board" },
                "edge": "left", "align": "center", "peek": 52 } ]
```

- **Placement:** a floating block sits over its node, 12 px in from `edge`
  (`top`/`right`/`bottom`/`left`), positioned along that edge by `align`
  (`start`/`center`/`end`).
  - It sizes to its content; render an empty element to hide it.
  - Clicks and hovers never reach what lies underneath.
- **Moving:** people can drag it. On release it springs to the nearest edge and third,
  and that spot is saved.
- **`peek`** (side edges only) turns it into a drawer: only that many px show until it is
  hovered.
  - Draw one full layout and never change it on hover; that is what keeps it smooth.
  - Put the part that should peek (status, icons) on the edge side of each row.
- **Frame:** Herdr draws the background, border, radius, and shadow (accent while
  dragged), with 5 px above and below. The mod draws content only.
- **Orientation:** read `placement()`, which returns
  `{ edge, align, vertical, hovered, dragging }`. Lay out vertically when `vertical`; on
  the right edge, mirror rows so their edge side faces right.
- **Where to declare it:** floats can be declared on a container. win98 puts its Clippy on
  `screen` with `edge: "left"`, `align: "end"`.

## Keys scoped to a layout

`keys.json` can have a `"layout:<name>"` section that is active only while that layout
shows. It beats `global`, and `terminal` beats both:

```json
{ "layout:my-board": { "cmd-b": "my-board.sidebar", "cmd-shift-k": "layout.toggle:panel" } }
```

A `<mod>.<command>` action is delivered to that mod's `nextCommand()`.

## Changing a layout at run time

| Command | Effect |
|---|---|
| `layout.toggle` / `layout.show` / `layout.hide {id}` | Show or hide a node |
| `layout.resize {id, px \| weight}` | Resize a node; stored as a click |
| `layout.select {stack, child}` | Switch a stack's visible child |
| `layout.set {layout}` | Replace the personal layout tree. On shipped layouts only click/look fields change. |
| `layout.switch {name?}` | Show another layout; with no name, the next one |

- **Reading the tree:** `layout()` in a mod returns the file's tree, not live click state.
  The shipped mods find a node with a recursive `find(layout(), "sidebar")` and read
  `size.px`.
- **State that must survive:** keep UI state such as "which panel is open" in
  `shared(...)`.
- **Writing the tree from a mod:** win98 does this to set a background image. Mutate a
  copy of `layout()`, then call `run("layout.set", { layout: copy })`.

## Annotated examples

### Herdr (main), shipped

```text
root(row, titlebar:none, traffic_lights:[12,16], background:canvas, terminal_padding:[14,12])
├ sidebar(column, px268, min44, max480, background:chrome, resizable:false)
│ ├ brand(block, px46, window_drag)               mod workspace-chrome
│ ├ sidebar-lists(column)
│ │ ├ spaces(block, weight1, min90)               mod spaces
│ │ └ agents(block, weight1, min90)               mod agents
│ └ sidebar-footer(block, px69)                   mod workspace-chrome {footer:true}
└ work(column, resizable:false)
  ├ tabs(block, px42, window_drag)                 mod tabs
  ├ work-body(row, padding8, gap8)
  │ ├ main(block)  {tab:"active", pane:{gap8, radius10, lone, border, focus,
  │ │                header:{mod pane, height30, top, always}}}
  │ └ panel(column, hidden, px368, min280, max900)
  │   └ panel-body(stack, active:"files")  files→mod files | changes→mod changes
  └ status(block, px28)                            mod workspace-status
```

How the shipped mods behave around this tree:
- **Sidebar rail:** below 160 px, the sidebar mods draw a compact rail.
- **Folding:** collapses the sidebar to 44 px, or 76 px on macOS to leave room for the
  traffic lights.
- **Right panel:** `tabs` opens it with `layout.select` plus `layout.show`.

### Board (herdrdev/herdr-layout-examples)

This example shows one mod across four blocks, selected by `props.role`, plus a light
theme with its own palette:

```json
{ "id": "root", "type": "column", "titlebar": "none", "theme": "paper",
  "preview": "mods/board/preview.svg", "ui_font": "Geist", "font_size": 13,
  "background": "#f6f7f9",
  "colors": { "background": "#ffffff", "foreground": "#303746", "border": "#e5e7ec", "accent": "#7465db" },
  "terminal_padding": [12, 10], "gap": 0, "resizable": false,
  "children": [
    { "id": "board-header", "type": "block", "size": { "px": 100 }, "window_drag": true,
      "content": { "mod": "board", "props": { "role": "header" } } },
    { "id": "board-cards", "type": "block", "size": { "px": 355 },
      "border": { "width": 1, "color": "#e5e7ec" }, "content": { "mod": "board" } },
    { "id": "workspace", "type": "column", "padding": [14, 24], "gap": 0, "resizable": false, "children": [
      { "id": "workspace-title", "type": "block", "size": { "px": 34 }, "background": "#ffffff", "radius": 7,
        "content": { "mod": "board", "props": { "role": "terminals" } } },
      { "id": "live-terminals", "type": "block", "background": "#ffffff",
        "content": { "tab": "active", "pane": {
          "gap": 12, "radius": 7, "background": "#ffffff", "lone": true,
          "border": { "width": 1, "color": "#e5e7ec" }, "focus": { "width": 1, "color": "#c8c1ef" },
          "header": { "content": { "mod": "board", "props": { "role": "pane" } },
                      "height": 28, "position": "top", "reveal": "always" } } } }
    ] }
  ]
}
```

### Common recipes

- **Sidebar on the right:** swap the two children of `root`.
- **No sidebar by default:** set `"hidden": true` on `sidebar`. The person can still
  toggle it with `layout.toggle:sidebar`.
- **Agent focus view:** a block with `{ "agent": "focused" }` next to a list mod that runs
  `agent.focus`.
- **Window over the layout, holding terminals:** a mod calls
  `openOverlay({ kind: "window", key, layout: { type: "column", children: [ {type:"block", size:{px:28}, content:{mod:"my-titlebar"}}, {type:"block", content:{terminal:"t7"}} ] } })`.
  - The terminal keeps its presses for text selection, so give the window a mod block to
    drag it by.
