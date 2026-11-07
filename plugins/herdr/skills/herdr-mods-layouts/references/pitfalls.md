# Pitfalls: symptom → cause → fix

Start every diagnosis with these, in order:
1. `herdr-app check <mod folder>`
2. `herdr-app status` (look at `errors`)
3. the `*.error` file next to whatever you edited
4. `herdr-app shot /tmp/x.png`, then look at the picture

## Loading and errors

| Symptom | Cause | Fix |
|---|---|---|
| The edit seems ignored; the old UI keeps running | The save was invalid. Herdr keeps the last good version. | Read `herdr-app status`, or `layout.error` / `keys.error` / `settings.error` / `programs.error`. |
| `` `setTimeout` is not available in the shell `` | No browser timers | `cx.timer.after(ms, cx => …)` / `cx.timer.every`. |
| `` `accent` is not a color value `` | A theme *name* passed to a mod style | Use `theme().accent`. Names only work in layout JSON. |
| A block shows nothing; status says `no mod folder` | The layout references a missing or renamed mod | Fix `content.mod`, or copy the mod folder in. |
| Edits to `main.json` or a shipped mod vanished; a `<name>-edited` copy appeared | Shipped files are restored on start | Work in a clone (`layout.clone`, `mod.clone`). |
| Fresh `keys.json` defaults never arrive after an update | Any edit, even whitespace, makes the file yours | Add new default shortcuts by hand. |
| The whole keymap stopped working | A malformed section (Flockbook hit this with a `mod:` section) | Check `keys.error`. Validate one section at a time. |
| Stale-context error after `await` | A handler's `cx` was used after the handler returned | Do async work in `cx.spawn(async (cx) => …)` and use *that* `cx`. |
| Error when reusing a stored element | Elements are consumed by their first parent | Build elements in functions, every render. |
| `InputState.new` / `focus_handle` throws | Created in `render` or a list row renderer | Create them in `init` or in an event handler. |
| `on_click` throws inside a virtual list | Handlers aren't allowed in row renderers | Use `.on_item_click(key)` on the list element. |
| A handler is "logged and dropped" | Input handlers attached to a component that doesn't wire them | Wrap the component in a `div` that takes the handler. |
| Duplicate-key error in a list | Two rows share a `get_key` | Key by data identity (`address`, `id`). |
| Side effects run twice after a hot reload | Top-level module code re-ran | Keep side effects in `init`, not at module scope or on `globalThis`. |

## Rendering and behavior

| Symptom | Cause | Fix |
|---|---|---|
| Hover, press, or focus jumps to the wrong row | No `id`, so elements are keyed by position, which shifts | Stable ids from data: `` `row-${a.address}` ``. |
| Hover/active/selection state sticks to the wrong card after reordering | Index-based ids | Same fix: data-based ids. |
| A transition doesn't play for a moved row | Transitions animate only *later* changes to the same element | Give the moved row a new id to restart it, or change the transitioned property itself. |
| High CPU or battery use | Animating with `cx.timer` + `cx.notify()`; it redraws the whole window | Use `.frames`, `.spin`, `.loop`, `.transition`. Timers only for outside data, at 30 s or slower for relative times. |
| UI lags under a busy feed | One large view re-renders on every tick | Split it into `cx.new(Child)` views and notify only for visible changes. |
| Nothing updates when agents change | The data is cached on `this` in `init` | Read `agents()`/`spaces()` in `render`; it re-runs on changes. |
| Clicking a control drags the window, or a right-click opens the system menu | The control sits in a `window_drag` block | `.on_mouse_down("left" \| "right", (_e, cx) => cx.stop_propagation())`. |
| A pane-header button also focuses the pane | The click bubbled to the header | `cx.stop_propagation()` in the button. |
| Keys don't reach the mod | No focus | `cx.focus_handle()` in `init`, `.track_focus(h)` on the root, `h.focus()`. |
| An overlay input doesn't take typing at first | Focus was lost while the overlay opened | `cx.timer.after(600, () => this.input.focus())`, as the shipped mods do. |
| An app shortcut wins over the mod's key | App bindings resolve first | `cx.bind_keys` + `.key_context` + `.on_action`, or a `mod:<name>` section in `keys.json`. |
| Shifted characters arrive as their base key | `e.key` is the printed key | Use `e.key_char`. |
| The popup is shorter or taller than `height` | Popups size to their items; `height` is a maximum | Size the content itself. |
| A popup at `at: "pointer"` opens in the wrong place over overlays | The pointer position is stale | Anchor at the clicked element: `{x: e.bounds.x, y: e.bounds.y + e.bounds.height}`. |
| A drag never ends | The release happened outside the element | Reset on the next press, on hover exit, or with `on_mouse_down_out`. |
| A plain list can't scroll to an item from code | Only virtual lists have scroll handles | Use `v_virtual_list` + `VirtualListScrollHandle` + `.track_scroll`. |
| Fixed px designs overflow narrow windows | The mod ignores its block size | Read `on_size_change`. Below about 160 px, draw a compact form. |
| `on_size_change` numbers look too big | The sizes include zoom | Divide by `settings().zoom` before using them as layout px. |
| A pane action hits the wrong pane | It used the focused pane | Pass `pane`/`terminal` explicitly: from `props()`, or `target` in menus. |
| Pane controls fail when a terminal block or window has focus | `focused().pane` is null then | Check `focused()?.pane` before offering pane items. |
| A `layout()` read doesn't reflect a resize or hide | `layout()` returns the file, not the click state | Keep UI state in `shared()`. Measure with `on_size_change`. |
| A mod in a hidden column keeps doing work | Copies stay alive while their block is in the layout | Poll gently and stop loops when the data isn't needed. |
| A background mod stops when the layout is switched | It only runs while some block holds it in the *shown* layout | Add it to each layout. Deduplicate work across copies with `shared()`. |
| `watchFolder` fires constantly | Your own git commands touch the index, or the tree is huge (`node_modules`) | `git --no-optional-locks -c core.fsmonitor=false …`. Watch a narrower root. |
| `watchFolder` rejects on Linux | More than 4096 non-ignored directories | Fall back to a timer. |
| `hc label` changes show up late | The label round-trip takes about 0.65 s | Keep a pending local value until the label arrives. |
| An external notifier can't find programs | Strings run by other programs don't get the person's PATH | Use absolute paths. Only `exec` gets the real environment. |
| An asset breaks after renaming the mod | Asset paths embed the mod name: `mods/<name>/…` | Rename the paths too, or use `mod.clone`. |
| Remote space data is missing | `watchFolder` and `writeTextFile` are local-only | Use `exec`/`readTextFile` with `on: space.machine`, and poll. |

## Platform and keys

| Symptom | Cause | Fix |
|---|---|---|
| Docs say `ctrl-shift-l`; nothing happens on a Mac | The macOS keymap uses `cmd-…` (`cmd-shift-l`) | Read the person's `keys.json` / `keys()` before naming shortcuts. |
| A new ctrl+letter breaks the shell | Programs rely on ctrl+c/d/l/r/w/a/e/u/k/z/[ | Avoid them unless the person asks; then say what typing they lose. |
| An option+key binding types a character instead | Mac keyboard layouts compose characters with Option | Prefer cmd/ctrl chords. `option_as_alt` in settings changes this. |
| A custom title bar overlaps the traffic lights | No room left | Add left padding when `window()?.platform === "macos" && titlebar === "none" && !fullscreen`. |
| No window buttons on Linux or Windows | `titlebar: "none"` hides the system ones | When `window()?.buttons`, draw them with `window.minimize`, `window.maximize`, `window.close`. |
| `cannot read property 'platform' of null` in `check` | `window()` is null under `check` and before the window exists | Read it with optional chaining: `window()?.platform`. |

## Escape hatch

`ctrl-alt-shift-escape` always works, and nothing can rebind it. It sets the shown layout
and `keys.json` aside as `*.reset-<time>` and returns to `main`.
