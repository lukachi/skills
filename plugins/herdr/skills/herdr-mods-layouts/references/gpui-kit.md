# gpui-kit in Herdr mods

Herdr embeds **gpui-shell**: JavaScript that builds GPUI element trees. Version 0.7.1 is
named in the header of the installed `gpui-kit.d.ts`.
- **Upstream docs** at https://gpui-kit.com describe a newer gpui-kit (0.9). They are good
  for the mental model and performance advice, but the local `gpui-kit.d.ts` decides which
  APIs exist.
- **Searching the types:** the file is about 22k lines. Grep for the method you need.
- **Mental model:** GPUI itself is Zed's Rust UI framework (https://gpui.rs). Mods never
  touch Rust.

## Contents
- [Modules](#modules)
- [Elements and composition](#elements-and-composition)
- [Styling](#styling)
- [Events](#events)
- [Focus and keyboard](#focus-and-keyboard)
- [Motion](#motion)
- [Long lists](#long-lists)
- [Controls, text and editors](#controls-text-and-editors)
- [Phase rules](#phase-rules)
- [Performance](#performance)
- [Differences from upstream docs](#differences-from-upstream-docs)

## Modules

| Import | Main exports |
|---|---|
| `"gpui-kit"` (alias `"gpui"`) | `View`, `div`, `svg`, `image`, `list`, `uniform_list`, `PathBuilder`, `Background`; types `Context`, `AsyncContext`, `Entity`, `FocusHandle`, `Window`, `Task`, `Timer`, `KeyEvent`, `MouseButtonEvent`, `ScrollWheelEvent` |
| `"gpui-base"` | See the breakdown below |
| `"herdr"` | Herdr data and commands; see [mods](mods.md#the-herdr-module) |
| `"gpui-fps"` | `fps_monitor`, `show_fps_monitor`, `hide_fps_monitor` |
| Standard | `fs/promises`, `path`, `url`, `buffer`, `crypto`, `zlib`, `os`, `process`, `net`, `websocket` |
| Globals | `fetch`, `console`, `localStorage`, `sessionStorage`, `window` (the GPUI window; `herdr`'s `window()` function shadows it when imported) |

`"gpui-base"` exports, by area:
- **Layout:** `h_flex`, `v_flex`, `h_resizable` / `v_resizable` / `resizable_panel`.
- **Controls:** `Button`, `Link`, `Checkbox`, `Switch`, `Radio`, `RadioGroup`, `Toggle`,
  `ToggleGroup`, `Tabs`/`Tab`.
- **Display:** `Progress*`, `Avatar*`, `Accordion*`, `Collapsible`, `Table*`,
  `Pagination`.
- **Overlays and pickers:** `Popover`, `HoverCard`, `Popup`, `Select`, `Combobox`,
  `DatePicker`.
- **Scrolling:** `Scrollbar`, `v_virtual_list`, `h_virtual_list`,
  `VirtualListScrollHandle`.
- **Text and inputs:** `InputState`/`Input`, `NumberInput`, `TextareaState`/`Textarea`,
  `TextView`, `EditorState`/`Editor`, `Slider*`, `OtpInput`.
- **Docking and theme:** `DockArea`, `set_theme`.

There is **no `text()` export**, even though some upstream examples show one. A string is
already an element: `.child("hello")`.

## Elements and composition

```js
v_flex().id("root").size_full().gap(4)
  .child("A heading")
  .child(h_flex().gap(8).child(svg("mods/x/icon.svg").size(14)).child(name))
  .children(items.map((it) => row(it)))
  .when(isEmpty, (el) => el.child("Nothing yet"));   // the callback must return the element
```

- **Children:** `child(x)` accepts an element, an entity, a string, a number, or a
  boolean. `children(iterable)` takes many.
- **Conditionals:** `.when(cond, el => …)` returns the element, so the chain continues.
  `.map(fn)` also exists.
- **Containers:** `div()` is a bare box; `h_flex()` and `v_flex()` are flex rows and
  columns.
- **Images:** `svg(path)` is a one-color vector glyph tinted by `text_color`.
  `image(path)` is full-color. Paths are relative to the app home.
- **Component slots:** `content`, `trigger`, `header`, `panel`, `footer`, `image`,
  `fallback`, `input`.
- **Single use:** an element belongs to one render and is used once. Don't store elements
  on `this`. Write a function that builds a fresh one, e.g. `button(t, id, label, onClick)`.
- **Nested views:** create a retained child with `cx.new(ChildClass, props)` in `init`, and
  pass new props with `entity.set_props(...)`. The child's `update(props)` runs.
  - This is how you isolate frequently-changing parts; see
    [Performance](#performance).

## Styling

The method names follow GPUI's Tailwind-like naming, in snake_case.

**Methods that take a value**
- **Box size:** `w`, `h`, `size`, `min_w`, `max_w`, `min_h`, `max_h`.
- **Spacing:** `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`; `m*`; `gap`, `gap_x`, `gap_y`.
- **Flex:** `flex_basis`, `flex_grow`, `flex_shrink`.
- **Position:** `top`, `left`, `right`, `bottom`, `inset`.
- **Paint:** `bg`, `border`, `border_t`/`r`/`b`/`l`, `border_color`, `rounded*`, `opacity`.
- **Text:** `font_family`, `font_weight`, `text_size`, `text_color`, `text_bg`,
  `line_height` (a bare number is a multiplier).
- **Units:** a number means px. Strings may be `"12px"`, `"1rem"`, or `"50%"`.

**Flags (no argument)**

There are about 3,000 of these, generated from Tailwind names:
- **Flex:** `flex`, `flex_col`, `flex_1`, `flex_none`, `items_center`, `justify_between`.
- **Sizing and position:** `size_full`, `w_full`, `relative`, `absolute`, `inset_0`.
- **Overflow and text:** `overflow_hidden`, `truncate`, `text_ellipsis`,
  `whitespace_nowrap`.
- **Borders:** `border_1`, `rounded_full`.
- **Weights:** `font_medium`, `font_semibold`.
- **Cursor:** `cursor_pointer`.

**State styles**
- `.hover(s => s.bg(t.hover))`, `.active(s => …)`, `.focus(s => …)`.
- They are resolved natively, so no JS runs on hover.

**Scrolling**
- `overflow_y_scrollbar()` (or `overflow_scrollbar`, `overflow_x_scrollbar`) scrolls and
  paints a bar.
- `overflow_y_scroll()` scrolls without a bar.
- A scrolling container needs an `.id()`.

**Colors**
- In mods, colors are **hex strings only**: `#rgb`, `#rrggbb`, or `#rrggbbaa`.
  `.bg("accent")` fails `herdr-app check` with "`accent` is not a color value".
- Take colors from `theme()` (from `"herdr"`), which follows the person's theme. The
  shipped mods don't use `cx.theme()`.
- Add translucency by appending two hex digits: `t.blocked + "26"`.

**Drawing**
- `window.paint_path(PathBuilder…, Background.linear_gradient(...) | Background.checkerboard(...))`
  draws vector paths. win98 uses it for bevels and dithering.

## Events

| Method | Notes |
|---|---|
| `.on_click((e, cx) => …)` | Requires an `id`. `e.click_count` reports double-clicks. |
| `.on_mouse_down(button, h)` / `.on_mouse_up` / `.on_mouse_down_out` | `button` is `"left"`, `"right"`, or `"middle"`. `e.position`, `e.bounds`. |
| `.on_mouse_move(h)` | For drags. Compare `e.position` against the start point, with a threshold of about 4 px. |
| `.on_hover((hovered, cx) => …)` | Fires on enter and exit. Prefer `.hover(style)` when only the look changes. |
| `.on_scroll_wheel(h)` | |
| `.on_size_change((size, cx) => …)` | Only on `div`/`h_flex`/`v_flex`, with a stable `id`. Reports logical px (multiplied by zoom). |
| `.on_drop((e, cx) => …)` | `e.paths`: absolute paths of files dropped from outside. |
| `.on_key_down` / `.on_key_up` / `.on_modifiers_changed` | Need `track_focus` on the focus path. |
| `.on_action(name, h)` | Pairs with `cx.bind_keys` and `.key_context`. |
| Component events | `on_change`, `on_open_change`, `on_confirm`, `on_dismiss`, `on_item_click(key)`, `on_item_secondary_click`, `on_resize` |
| `.tooltip("text")` | Only on `div`, `h_flex`, `v_flex`, and `Button`. |

- **Stopping bubbling:** call `cx.stop_propagation()` in a handler to keep the event from
  reaching handlers above. This matters most inside `window_drag` areas and overlay
  windows.
- **Wiring limits:** input handlers only reach GPUI on `div`, `h_flex`, `v_flex`,
  `Button`, `Link`, `Checkbox`, `Switch`, `Radio`, `Toggle`, `Tabs`, and `Tab`.
  - On anything else they are logged and dropped.
  - Wrap other components in a `div` that takes the handlers.

## Focus and keyboard

```js
init(_p, cx) { this.h = cx.focus_handle(); this.h.focus(); }
render() {
  return v_flex().id("root").track_focus(this.h)
    .on_key_down((e, cx) => {
      if (e.key === "escape") { /* … */ }
      else if (e.key === "down") { this.sel++; }
      else return;                 // let unhandled keys bubble
      cx.stop_propagation(); cx.notify();
    });
}
```

- **`KeyEvent` fields:**
  - `key`: the printed key, such as `"s"`, `"enter"`, `"escape"`, `"up"`, or `"tab"`.
  - `key_char`: the typed character, which you need for shifted keys.
  - `modifiers`: `{shift, control, alt, platform, function}`, where `platform` is Cmd on
    macOS.
  - `is_held`.
- **First focus:** the first Tab into an unfocused window does nothing. Focus a handle
  explicitly.
- **Select/Combobox:** arrow-key navigation inside their lists is yours to write.
- **Element-scoped bindings that beat app keys:**
  `cx.bind_keys([{ keystroke: "escape", action: "my_esc", context: "MyCtx" }])` (in
  `init`), plus `.key_context("MyCtx").on_action("my_esc", (e, cx) => …)`.

## Motion

All motion runs natively, only while the element is drawn. `render` is never re-run for
it.

| API | Use |
|---|---|
| `.frames(["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"], 90)` | Text spinner: cycles the element's text. `ms ≥ 16`. |
| `svg(arc).spin(900)` | Rotating icon, e.g. `mods/workspace-chrome/spinner.svg`. `ms ≥ 100`. |
| `.loop("opacity", { from: 0.4, to: 1, period: 1200 })` | Pulse, there and back. Properties: `opacity`, `width`, `height`, `left`, `top`. About 30 fps. |
| `.transition("left", 300 \| { duration, delay?, easing? })` | Animates **later** changes of that property. Easing: `linear`, `ease-in`, `ease-out`, `ease-in-out`. |
| `.spring("top", { response, damping, epsilon })` | Spring toward later target changes. |

- **Change data, not frames.** A timer may change *state* every few seconds; the
  transition then animates the move. Pasture does this with
  `cx.timer.every(4200, cx => { this.step++; cx.notify(); })` plus
  `.transition("left", {duration: 4200, easing: "ease-in-out"})`.
- **Transitions only animate later changes to the same element.** To restart an animation
  for a row that moved, give it a new `id` (a Herdr T3 technique).
- **Never use `cx.timer.every(90, () => cx.notify())` for animation.** Each mod redraw
  redraws the whole window.

## Long lists

| API | When |
|---|---|
| `v_virtual_list(id, count, sizes, getKey, (range, cx) => Element[])` | Rows with known sizes (a number, or an array of px). The shipped `changes` diff viewer uses it. |
| `uniform_list(id, count, getKey, range => Element[])` | All rows the same height; one row is measured. |
| `list(id, count, getKey, (index, cx) => Element)` | Unequal, unknown heights. Costlier: one host entry per visible item per frame. |
| `.children(array)` inside an `overflow_y_scrollbar` | Short lists (tens of rows). Can't be scrolled from code. |

Rules inside the row renderer, which runs during layout about twice per frame:
- **No handlers.** `on_click` throws there. Use `.on_item_click(key)` and
  `.on_item_secondary_click(key)` on the list element.
- **No retained state** (`InputState.new`, `cx.focus_handle()`) and no `cx.notify()`.
- **Keys must be unique.** Duplicate keys throw, except in `list`, where they silently
  merge.
- **Scrollbar:** put `Scrollbar.vertical("<same id>").viewport_from_layout().absolute().inset_0()`
  inside a `relative()` parent.
- **Scrolling from code:** create `this.scroll = VirtualListScrollHandle.new()` in `init`,
  attach it with `.track_scroll(this.scroll)`, then call `scroll_to_item(i, "top" | "center")`
  or `scroll_to_bottom()`.

```js
div().flex_1().min_h(0).relative()
  .child(v_virtual_list("rows", this.rows.length, 20, (i) => String(i),
    (range) => this.rows.slice(range.start, range.end).map((r) => this.row(r, t))).size_full())
  .child(Scrollbar.vertical("rows").viewport_from_layout().absolute().inset_0())
```

## Controls, text and editors

- **Base controls come unstyled and controlled.** You draw their checked, disabled, and
  selected looks.
  - Values go in through `checked` / `open` and come out through `on_change` /
    `on_open_change`.
  - Store the value in the handler, then `cx.notify()`.
- **Text input:**

  ```js
  // init
  this.input = InputState.new({ value: "", placeholder: "Search" });
  this.input.on("change", (_e, cx) => { this.q = this.input.value(); cx.notify(); });
  this.input.on("submit", () => this.submit());
  this.input.focus();
  cx.timer.after(600, () => this.input.focus());   // shipped workaround for overlays
  // render
  Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(t.input).bg(t.background)
  ```

  - Other `InputState` methods: `set_value`, `set_selected_range({start, end})`,
    `set_masked`, `set_loading`, and `release()`.
  - Events: `change`, `submit`, `focus`, `blur`, and `paste_other` (a paste with no text,
    such as an image).
  - `TextareaState`/`Textarea` work the same for multiple lines.
- **Markdown and HTML:** `TextView.markdown(id, text)` and `TextView.html(id, html)`.
  HTML is rendered without CSS. Both return an element with `on_link_click` and
  `selectable`.
- **Code view/editor** (a Herdr addition):

  ```js
  this.ed = EditorState.new({ language: "rust", value, readonly: true,
    font_family: settings().font_family, font_size: 12,
    syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4,
              type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
  // render
  Editor.new(this.ed)
  ```

  - Options: `line_numbers` and `folding` (both on by default) and `soft_wrap` (off by
    default).
  - A viewer belongs beside the shell as a pane:
    `run("pane.split", { direction: "right", mod: "my-viewer", props: { file } })`.
- **Subscriptions:** `state.on(...)` listeners persist until `release()`. Register them
  once, in `init`, not in `render`.

## Phase rules

`cx.phase()` returns `render`, `event`, `task`, `layout`, or `none`.

| Phase | Allowed | Not allowed |
|---|---|---|
| `init` | Create state (`InputState.new`, `cx.focus_handle()`, `cx.new`, timers, `spawn`) | |
| `render` | Read data and describe elements | `notify`, `bind_keys`, dialogs, `set_theme`, creating state. Keep it cheap: no slow work, no `await`. |
| List row renderers | Describe elements | Handlers, state, `notify` |
| Event handlers | Change state, `notify`, `run`, overlays, create state | Using the handler `cx` after the handler returns |
| `spawn` / timer callbacks | Async work, with the `cx` that survives `await` | |

**Forbidden everywhere:** `setTimeout`, `setInterval`, and their `clear*` functions throw
("use cx.timer.after"). `Task.cancel()` stops a timer or task, but leaves its promise
pending forever.

**Identity:**
- Without an `id`, an element is keyed by its position in the tree. When a conditional
  sibling appears or disappears, hover, press, and focus state shift to the wrong element.
- Give interactive and scrolling elements stable ids.
- Components built with `Component.new(id)` take their id there and ignore `.id()`.

## Performance

These points come from https://gpui-kit.com/shell/performance and the shipped mods.
- **What it costs:** script cost is roughly *how often a view is invalidated × how big its
  description is*.
- **Isolate what changes often** into a `cx.new(Child)` entity. A child row can re-render
  for about 0.01 ms, where the whole panel costs about 0.3 ms.
- **Notify only for visible changes.** Never call `window.refresh()` per event; it rebuilds
  every view.
- **Read host data once per render into locals.** `panes()` copies every pane on each call.
- **A theme change rebuilds every view**, which is expected.
- **Use virtual lists** for hundreds of rows.

## Differences from upstream docs

**Present here, absent from upstream's API page:**
- motion: `frames`, `loop`/`LoopPolicy`, `spin`;
- events: `on_size_change`, `on_drop`, `on_item_secondary_click`;
- views and editing: `View.close(cx)`, `EditorState`/`Editor`, `TextView`;
- inline tokens on inputs: `token()`, `on_token_click`, `replace_with_token`.

**Upstream-only in this build** (don't use them):
- `cx.open_path`, `on_pinch`;
- `list().with_follow_mode("tail")`, `on_visible_range_change`;
- `TextareaState.set_submit_on_enter`.

**Colors:** hex only here, where upstream also accepts tokens.

Re-check all of the above with a grep of `gpui-kit.d.ts` after each Herdr update.
