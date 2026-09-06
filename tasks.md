# Canvas / Tabs / Folder polish — task list

Scope: `apps/web` (plus the minimal `apps/api` + `packages/*` needed for tab reorder persistence).
Verification: typecheck + lint + unit tests for every touched package, then the running web app.

---

## Phase 1 — Page icon picker

- [x] **T1** `PageView.tsx` — expand the `ICONS` list (currently 12) to a fuller, professional set;
  keep the 6-wide grid, keep "Remove icon". Update the icon-picker test if it asserts a count.

## Phase 2 — Block gutter handle (the `+` / `⠿`)

- [x] **T2** `CanvasBlockHandle.tsx` / `CanvasEditor.tsx` — the handle overlaps list bullets and
  ordered-list numbers (image 2). Make it sit in the left gutter for every block type
  (drop `nested` per-item targeting so it always aligns to the document's left edge), and give
  the content column enough gutter so `+` / `⠿` never touch text.

## Phase 3 — Plain `/table` block

- [x] **T3** `canvas.css` — kill the stray vertical scrollbar on `.tableWrapper`
  (`overflow-x:auto` forces `overflow-y` to `auto`; pin `overflow-y:hidden`).
- [x] **T4** `canvas.css` + `CanvasEditor.tsx` — stop columns/borders shifting when the mouse
  hovers a column border (shrink cell `min-width`, align `.column-resize-handle`, add
  `overflow:hidden` on the table, set a sane `cellMinWidth`).
- [x] **T5** Add discoverable "add row" / "add column" controls: Notion-style hover `+` on the
  table's right edge (column) and bottom edge (row), plus keep the toolbar buttons. New
  `CanvasTableControls.tsx`.

## Phase 4 — Slash-menu ranking

- [x] **T6** `canvas-slash-menu.ts(x)` — `filterCanvasBlocks` must rank **title** matches above
  keyword/description matches, so `/pa` → **Page** before **Text** (image 6). Prefix-of-title
  beats substring-of-title beats keyword.

## Phase 5 — Folder view thumbnails

- [x] **T7** `FolderView.tsx` — for image entries (`mimeType` starts with `image/`) render the
  actual image thumbnail in the icon slot instead of a generic glyph (image 4). Non-images keep
  a type glyph. Graceful fallback if the image fails to load.

## Phase 6 — Draggable channel tabs

- [x] **T8** `apps/api` — `PUT /channels/:id/tabs/reorder` `{ orderedIds }` → set `position = index`,
  return `{ tabs }`, emit `tab:updated` per tab. Service fn in `tab-service.ts`. e2e in
  `apps/api-e2e/tests/channel-tabs.test.ts`.
- [x] **T9** `packages/client-core` — `reorderTabsOp` (optimistic `tabs/set`, rollback via
  `fetchTabs`); make the `tabs/update` reducer keep the list sorted by `position`.
- [x] **T10** `useTabActions.ts` — expose `reorderTabs(orderedIds)`.
- [x] **T11** `ChannelTabs.tsx` — native HTML5 drag to reorder tabs (not the Messages tab),
  commit on drop. Co-located test.

## Phase 7 — Verification

- [x] **T12** typecheck — web, api, client-core, shared, editor all pass.
- [x] **T13** `oxlint --deny-warnings` — 0 warnings on every touched file (one pre-existing
  unused-import warning in `apps/cli/tests/...` is unrelated and untouched).
- [x] **T14** tests — web unit 785 pass (1 pre-existing timezone-only failure in
  `message-date-utils.test.ts`, unrelated); `@openslaq/editor` 31 pass; `client-core` 331 pass;
  api-e2e `channel-tabs` + `folder-file-mentions` + `mentions` 26 pass. New tests added:
  slash-menu ranking, `FolderItemThumb`, `CanvasTableControls`, `ChannelTabs` drag, tab-reorder e2e.
- [x] **T15** web app runs (localhost:3005), all changes compiled over HMR with no errors, and
  the app boots clean (no console errors). The interactive canvas / folder / tab views sit behind
  Stack Auth sign-in, which can't be completed here — those were verified by typecheck + unit
  tests + api-e2e, and a static token-accurate preview of each visual change was produced.

---

# Round 2 — follow-up feedback

## Phase 8 — Canvas title ↔ tab name

- [x] **T16** Renaming the canvas page title must rename the owning channel tab (image 1).
  `updatePage` service: on a title change, if the page backs a `channel_tabs` row, update its
  `name` and emit `tab:updated`. New `syncTabNameForPage` in `tab-service.ts`. e2e coverage.

## Phase 9 — Page icons

- [x] **T17** Add still more icons — people / faces / gestures and a marketing+sales set
  (megaphone, handshake, chart-up, target, gift, party, ...). ~90 total.

## Phase 10 — Emoji applies immediately

- [x] **T18** Picking a page icon currently needs a refresh / tab bounce to show. `PageView`
  must optimistically patch its local `page` (icon, cover) right after `update()` resolves,
  not only re-read on next mount.

## Phase 11 — Plain table

- [x] **T19** The bottom "+" doesn't add a row (image 2). Make the edge controls target the
  table's last cell first, so bottom "+" appends a row at the end and right "+" appends a column
  at the end; use onMouseDown-preventDefault + onClick like the toolbar buttons.
- [x] **T20** While dragging a column border the mouse cursor is wrong. tiptap adds
  `resize-cursor` to the editor root (via prosemirror-tables), not `.tableWrapper` — fix the CSS
  selector so the cursor becomes `col-resize`.

## Phase 12 — Folder PDF thumbnails

- [x] **T21** Image previews landed but the folder is mostly PDFs. Render **page 1 of the PDF**
  into the row icon (add `pdfjs-dist` to `apps/web`; render once, cache the data URL; fall back
  to the glyph on failure). Make the icon a bit taller so an A4 page fits.

## Phase 13 — Verification (round 2)

- [x] **T22** typecheck (web/api/client-core/shared/editor) ✓ · lint 0 warnings on touched files ✓ · web unit 787 pass (1 pre-existing tz-only failure) ✓ · `@openslaq/editor` 31 ✓ · `client-core` 331 ✓ · api-e2e channel-tabs (13, +title-sync) / pages / mentions / folder-file-mentions 41 ✓ · web + api boot clean, pdfjs-dist optimized by Vite with no errors · preview refreshed.

---

# Round 3 — table "+" still not adding rows

## Phase 14 — Rewrite the table add-row / add-column controls

- [x] **T23** `CanvasTableControls.tsx` — the "+" clicks did nothing. Root causes: it relied on
  `editor.chain().addRowAfter()` which needs a live cell selection, and clicking the portalled
  button could move focus out of the editor / swap the button DOM between mousedown & mouseup.
  Rewrite:
  * add rows/cols with a **direct ProseMirror transaction** (`@tiptap/pm/tables` `addRow` /
    `addColumn` at `map.height` / `map.width`) — no dependency on the caret.
  * remember the last table's start position in a ref, so the buttons keep working after focus
    leaves the editor.
  * act on **onMouseDown** (preventDefault) instead of onClick; `tabIndex={-1}`; skip re-renders
    when the tracked rect is unchanged.
  * unit test now clicks the buttons and asserts a row (2→3) and a column (cells 6→9) are added.
- [x] **T24** Verify — web typecheck ✓, lint 0 warnings on touched files ✓, `CanvasTableControls`
  unit tests (2) ✓, full web suite 788 pass (same 1 pre-existing tz-only failure), Vite optimized
  `@tiptap/pm/tables` and reloaded with no errors, app boots clean.

---

# Round 4 — big asks

## Phase 15 — Delete added rows / columns

- [x] **T25** `CanvasTableControls.tsx` — add a "−" beside each "+" (right edge = remove last
  column, bottom edge = remove last row) using `@tiptap/pm/tables` `removeRow` / `removeColumn`;
  guard against emptying the table (keep ≥1 row and ≥1 col). Unit-test add + remove.

## Phase 16 — Proportional image resize

- [x] **T26** `CanvasImageNode.tsx` — add a `width` attr (px, serialized) and a single
  bottom-right drag handle that changes width only (height stays `auto`), so the image scales
  as one unit — never width or height alone. Clamp to [96px, container width]. Extract the clamp
  math and unit-test it; NodeView render test for the handle.

## Phase 17 — Real-time collaborative canvas editing

- [x] **T27** Add matching tiptap collab deps to `apps/web`: `@tiptap/extension-collaboration`,
  `@tiptap/extension-collaboration-caret`, `@tiptap/y-tiptap`, `yjs`, `y-protocols` — pinned to
  the 3.20.x line to match `@tiptap/core@3.20.0`.
- [x] **T28** Socket relay (`apps/api/src/socket/`): rooms keyed by pageId. `canvas:join` (auth
  via `canReadPage`) → tell the joiner whether to **seed** from `page.content` or hands them the
  merged Y update log; `canvas:update` → append + `Y.mergeUpdates` compaction + broadcast;
  `canvas:awareness` → broadcast; grace-period room retention. Server stays schema-free (opaque
  Yjs bytes only). New `ClientToServerEvents` / `ServerToClientEvents` entries in shared.
- [x] **T29** Client hook `useCanvasCollab(pageId, ydoc, awareness, user)` — wires the socket
  relay to a `Y.Doc` + `y-protocols/awareness`; first client seeds from `page.content`.
- [x] **T30** `CanvasEditor.tsx` — when a `collab` prop is present, add `Collaboration` (bound to
  the shared `Y.Doc`) + `CollaborationCaret` (identity = current user, colour hashed from id);
  don't pass `content` in collab mode. Live text from every peer, standard inline carets.
- [x] **T31** Gutter avatars — a small ProseMirror decoration extension that reads awareness and
  draws a circular avatar in the left gutter of the block each remote user's caret sits in.
- [x] **T32** `PageView.tsx` / `CanvasView.tsx` — pass `collab={{ user }}` (id, display name,
  avatar) down so the canvas is collaborative inside a channel.
- [x] **T33** Verify — typecheck, lint, unit tests (Y merge round-trip, colour hash, gutter
  decoration mapping, resize clamp), single-editor smoke, and a two-context web-e2e (mock-auth
  as two users) proving live sync + a visible remote avatar.

## Phase 18 — Verification (round 4)

- [x] **T34** full typecheck + lint + `test:web` + `@openslaq/editor` + `test:core` + api-e2e +
  web/api boot; refresh the preview.

---

# Round 5 — Notion-parity: table, toolbar, emoji, favicons

## Phase 19 — Link favicons (image 15)

- [x] **T35** Extract `getFaviconUrl` from `BookmarksBar.tsx` into `apps/web/src/lib/favicon.ts`
  (Google s2 service). Use it in `FolderView.tsx` `FolderItemThumb` for `kind:"link"` entries
  (favicon in the thumb, `Link2` glyph fallback on error) and in the folder "Add link" flow.
  Reuse it in `BookmarksBar`. Unit-test the URL builder.

## Phase 20 — Emoji-mart page icon picker (image 5)

- [x] **T36** Replace the flat emoji grid in `PageView.tsx` with `@emoji-mart/react` `Picker`
  (already a dep): category tabs, search, Frequently Used, preview + skin tone on. Portal +
  edge-aware positioning (reuse the pattern from `message/EmojiPicker.tsx`). Keep "Remove icon".
  Selecting writes the native emoji via the existing `patchMeta({ icon })`.

## Phase 21 — Bottom floating format toolbar (images 6 → 7, 8–13)

- [x] **T37** New `CanvasBottomToolbar.tsx` — a floating bar pinned bottom-centre of the editor:
  `[+]  Aa  😊  📎  ☑  ⊞  ▯▯`  (NO AI/sparkles). Remove the sticky top `CanvasToolbar`.
- [x] **T38** `+` menu (image 8): Divider, Callout, Blockquote, List, Image, File (Ctrl+U),
  Page. (Record clip / Date / Profile / Workflow / Placeholder have no backing — omit.)
- [x] **T39** `Aa` menu (image 9): Code block, Bulleted list, Ordered list, Check list,
  H3 / H2 / H1, Paragraph — checkmark on the active one; maps to tiptap toggle commands.
- [x] **T40** `😊` opens the emoji-mart picker → inserts the native emoji at the caret.
- [x] **T41** `📎` opens the OS file picker → routes images to `onUploadImage`, other files too
  if supported; tooltip "File · Ctrl+U", and wire the Ctrl+U shortcut.
- [x] **T42** `☑` toggles the check list (tooltip "Check list · Ctrl+Shift+9"); `⊞` inserts a
  table; `▯▯` "Layouts" → a 2-column layout (new lightweight `columns` node) or, if that's too
  big this round, a labelled no-op with a follow-up note.
- [x] **T43** Keep inline formatting reachable: a small bubble menu (B/I/U/S/link/code) on text
  selection, since the persistent B/I/U/S row is gone.

## Phase 22 — Notion-style table (images 1–4)

- [x] **T44** Extended `CanvasTableControls.tsx` (kept, not replaced): a grip strip down the
  left of every row (`canvas-table-row-grip-N`) and across the top of every column
  (`canvas-table-col-grip-N`), faint until hover, blue when active (`.canvas-table-grip` in
  `canvas.css`). Click → `CellSelection.rowSelection` / `colSelection` (from `@tiptap/pm/tables`)
  over the whole row/column via a direct PM transaction, then opens a Radix context menu
  anchored to the grip. Shows once the caret is inside the table (same trigger as the edge
  `+/−`), matching the existing affordance behaviour.
- [x] **T45** Row menu (image 4 labels exactly): Insert row above (`addRowBefore`), Insert row
  below (`addRowAfter`), Merge selection (`mergeCells`, disabled when not mergeable), Split cell
  (`splitCell`, shown only when `splitCell(state)` is possible), Clear contents (replace each
  selected cell's body with an empty paragraph), Delete row (`deleteRow`). Column menu mirrors
  it: Insert column left / right (`addColumnBefore/After`), Merge / Split / Clear, Delete column
  (`deleteColumn`).
- [x] **T46** Kept the edge `+` (bottom = add row, right = add col; tooltip "Insert row" /
  "Insert column") and `−` buttons untouched. Added a corner handle (`canvas-table-select-all`,
  round dot) that selects the whole table and opens a small menu — Clear contents + Delete table
  (`deleteTable`) — restoring the delete-table action lost when the top toolbar was removed.
  Unit tests: grip counts, row/col menu insert+delete, Clear contents keeps the row, corner
  handle deletes the table (8 tests total, all green).

## Phase 23 — Verify (round 5)

- [x] **T47** web typecheck ✓ · lint 0 warnings on touched files (1 pre-existing warning in
  `apps/cli/tests/commands/update.test.ts`, untouched) ✓ · `test:web` 825 pass / 1 pre-existing
  tz-only failure (`message-date-utils`) ✓ · `@openslaq/editor` 31 ✓ · `client-core` 331 ✓ ·
  api-e2e canvas-collab 1 ✓ (full api-e2e: 839 pass, 13 pre-existing infra failures — Stack Auth
  `getServerUserById` network errors, external link-preview fetch timeout, marketplace/feature-
  flag seed; none touch canvas/table/page and no API files changed this round) · web (3005) +
  api (3001) boot clean, Vite transforms `CanvasTableControls.tsx` with no errors, no console
  errors on load · preview refreshed.

---

# Round 7 — error page, canvas polish

## Phase 24 — Professional error page

- [x] **T48** `ErrorBoundary.tsx` — dropped the always-open `<details>` dumping `error.message`
  + full `error.stack` in red (info disclosure + scary UX). Now: warning glyph, calm headline
  ("Something went wrong"), one-line reassurance, primary **Reload page** + secondary **Back to
  home**, and a copyable **Reference** = the Sentry `captureException` event id for support.
  Raw message/stack are shown only behind `import.meta.env.DEV` (developer-only `<details>`).
  `role="alert"`. New `ErrorBoundary.test.tsx` (2): renders children normally; on throw shows
  the calm screen + reference and never leaks the error text (env stubbed non-dev).

## Phase 25 — Canvas surface + toolbar position

- [x] **T49** ~~Darken the canvas surface~~ — **reverted in Round 8 (T53)**: the user clarified
  they meant the checkbox, not the page background. The `--canvas-surface` token and
  `bg-canvas-surface` class were removed; `page-view` / `index.css` are back to `--surface`.
- [x] **T50** Bottom toolbar was centred on the whole viewport, not the canvas (image 3).
  First pass: `absolute inset-x-0` inside a `relative` `CanvasEditor` root. Superseded by
  Round 8 (T54) — `fixed` + measured `containerRef` box — because `absolute` still drifted
  vertically.

## Phase 26 — Table selection only on demand

- [x] **T51** "The table always has the highlight." Grips + edge `+/−` were painted at rest and
  a grip click left a `CellSelection` shading the row/column forever. Fixes in
  `CanvasTableControls.tsx` / `canvas.css`:
  * Grips and the edge `+/−` clusters are `opacity: 0` at rest; revealed only while a
    `pointermove` hit-test says the pointer is near the table box, or a menu is open
    (`[data-testid="canvas-table-controls"][data-active]`).
  * Grips sit flush to the border now (`GAP` 6 → 0) so clicking the row's left edge / the
    column's top edge is what selects it.
  * On menu dismiss, a lingering `CellSelection` is collapsed back to a caret
    (`collapseCellSelection`, `TextSelection.near`) — highlight shows only while you're acting
    on the row/column.
  * `.selectedCell` restyled from grey fill to a blue tint + blue cell border (Notion image 6).
  * Tests (+2 → 10): `data-active` starts `"false"`; a grip click highlights the row
    (`CellSelection`) and Escape clears it.

## Phase 27 — Verify (round 7)

- [x] **T52** web typecheck ✓ · lint 0 warnings on touched files ✓ · `test:web` 829 pass / same
  1 pre-existing tz-only failure ✓ · web (3005) + api (3001) boot clean; Vite transforms all
  touched modules 200, `--canvas-surface` token + `.bg-canvas-surface` utility emitted,
  `color-mix` selectedCell compiles, no console errors on load · interactive canvas check still
  blocked by the Stack Auth sign-in gate (unchanged session limitation).

---

# Round 8 — corrections

## Phase 28 — Checkbox, not canvas colour

- [x] **T53** The earlier "make it darker" was about the **task-list checkbox**, not the page
  surface. The native checkbox rendered as a solid white block on dark. `canvas.css` now styles
  it `appearance: none`: 16px, 1.5px `--border-strong` border, 4px radius, transparent fill —
  a hollow rounded box (image 3). `:hover` → blue border; `:checked` → blue fill + white
  `clip-path` checkmark. The T49 `--canvas-surface` darkening was reverted (see T49).

## Phase 29 — Toolbar holds its position

- [x] **T54** `absolute bottom-5` still drifted vertically as the document grew / the caret
  moved. `CanvasBottomToolbar` now takes the scroll viewport via `containerRef` and pins itself
  with `position: fixed` to a measured box — `left`/`width` from the viewport's rect (so it's
  centred on the canvas column) and `bottom = (viewportBottomGap) + 20`. Re-measured on
  `resize`, capture-phase `scroll`, editor `transaction`, and a `ResizeObserver`. Holds still
  regardless of content length or caret position.

## Phase 30 — Table chrome: gone until you act

- [x] **T55** Killed the "cloudy" always-on look. `CanvasTableControls.tsx` / `canvas.css`:
  * Row/column grips are now fully transparent, always-live click targets flush on the borders
    — a thin blue rail shows only under the pointer (`.canvas-table-grip:hover`). No grey fill,
    no proximity-reveal.
  * The `pointermove` reveal now drives **only** the edge `+/−` clusters (`data-active`), with
    a tight top/left margin (−2px) so it never reads as permanent chrome; wider on the
    right/bottom (+34px) to keep the `+/−` reachable.
  * `.selectedCell` is a crisp blue outline + 1px inset ring — the translucent blue/grey wash
    (`color-mix … 16%`) is removed. Selection shows only after a grip click, and
    `collapseCellSelection` still clears it on menu dismiss.
  * Table tests stay green (18 across the 3 touched files); `data-active` still starts `false`.

## Phase 31 — Verify (round 8)

- [x] **T56** web typecheck ✓ · lint 0 warnings on touched files ✓ · `test:web` 829 pass / same
  1 pre-existing tz failure (`message-date-utils`); the extra unhandled-rejection line is
  pre-existing `AppLayout.test.tsx` teardown noise — `stackApp.signOut is not a function` from
  an incomplete Stack mock, unrelated to this round; `AppLayout.test.tsx` passes 5/5 in
  isolation · Vite transforms all touched modules 200, `canvas.css` carries the new checkbox
  (`appearance:none` + `clip-path`), reworked grip hover, and clean `.selectedCell` · no
  console errors · interactive canvas check still gated by Stack Auth sign-in.

---

# Round 9 — toolbar bottom, table grip nub

## Phase 32 — Toolbar sticks to the bottom

- [x] **T57** The `fixed` + measured-`bottom` approach still floated the bar mid-canvas
  (`scrollRef`'s bottom edge isn't the viewport bottom when the outer `page-view` is the real
  scroller — its rect bottom sat ~700px). Fixed: the bar is now `position: fixed; bottom: 20px`
  (viewport bottom, always), and `containerRef` supplies **only** `left` + `width` so it stays
  horizontally centred on the canvas column. `BOTTOM_GAP` / capture-phase `scroll` listener
  dropped; `box` → `span`.

## Phase 33 — Grabbable grip nub

- [x] **T58** The user wants the small grey handle from Notion back (image 2) — a nub you grab
  to select the whole row / column. `canvas-table-grip` `<button>` stays a generous transparent
  hit area, but now paints a centred grey `::before` nub — `22×4` for columns, `4×20` for rows,
  `8×8` rounded square for the corner. Visible while the pointer is over the table
  (`[data-active="true"] … ::before { opacity: 1 }`), turns blue on hover. The `pointermove`
  box was widened on the top/left to `GRIP + 6` px so the nub doesn't vanish as you reach for
  it (still `+34` right/bottom for the `+/−`). Clicking the nub selects the line + opens the
  menu as before; `.selectedCell` blue outline unchanged.

## Phase 34 — Verify (round 9)

- [x] **T59** web typecheck ✓ · lint 0 warnings on touched files ✓ · `test:web` 829 pass / same
  1 pre-existing tz failure ✓ · Vite transforms `CanvasBottomToolbar.tsx` /
  `CanvasTableControls.tsx` 200, `canvas.css` carries the `[data-axis="col"|"row"]::before` nub
  rules · no console errors · interactive canvas check still gated by Stack Auth sign-in.

---

# Round 10 — one row + one column nub only

## Phase 35 — Follow the pointer

- [x] **T60** Every nub was showing whenever the pointer was over the table. Now a
  `pointermove` in `CanvasTableControls.tsx` also resolves which single row (Y in
  `metrics.rows[i]`) and single column (X in `metrics.cols[i]`) the pointer lines up with and
  stores `{ row, col }` in `hot` state. Each grip gets `data-hot="true"` only when it is that
  row / column (or it is the open menu's target). CSS: `.canvas-table-grip::before` is
  `opacity: 0` except `[data-hot="true"]` and `:hover` — so at most the two relevant nubs (row
  + column) are painted, never the whole rail. Corner nub still shows on its own `:hover` only.
  New test (+1 → 11): a `pointerMove` at the origin marks only `row-grip-0` + `col-grip-0` hot.

## Phase 36 — Verify (round 10)

- [x] **T61** web typecheck ✓ · lint 0 warnings on touched files ✓ · `test:web` — same 1
  pre-existing tz failure, everything else green (CanvasTableControls 11/11) · `canvas.css`
  `[data-hot="true"]::before` rule transforms 200, no console errors · interactive canvas check
  still gated by Stack Auth sign-in.
