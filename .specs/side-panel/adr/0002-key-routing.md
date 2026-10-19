---
schema: factory.adr/1
id: ADR-0002
feature: side-panel
title: "Key routing: Button hotkeys first, optional Client aliases, panel keys t b i"
status: accepted
impact: minor
options:
  - id: A
    title: "Button hotkeys for every binding, plus an optional Client layer for raw-key aliases"
  - id: B
    title: "One Client surface module catches every key"
  - id: C
    title: "Button hotkeys only, no raw keys at all"
recommendation: A
chosen: A
decided: 2026-10-19
---

# 0002 — Key routing: Button hotkeys first, optional Client aliases, panel keys t b i

## Context

Each tab declares key bindings that must work only while that tab is shown (AC-2.1). Every
action must also be a visible button (AC-2.2). Panel keys must not collide with tab keys
(AC-2.3), and help lists the shown tab's keys and terms (AC-2.4). Where no raw keys exist,
everything must still work (AC-2.5).

Engine facts (index.d.ts):

- A pane has no `onKey`. A Button `hotkey` is **one digit or one lowercase letter**. It presses
  the Button while the plugin's site holds the focus (after ctrl+x tab, a click or
  `open({ focus })`). Shift+w is `w`, and when two Buttons share a key the later one wins
  (1113–1121, 9803–9809).
- In a focused pane, Tab walks the elements, a hotkey presses its Button and the arrows scroll
  (10741–10745).
- A `Client` gets raw keys with modifiers and special names, never Escape (1444–1460). Its
  `onKey` fires **only after a click has given it the focus** (1624–1628). It reaches the hooks
  through `surface.post`, which arrives as `ui.message` (1629–1637, 4118–4126). Desktop has
  `Client` (3923–3934); mobile does not (3941–3949).
- Escape never reaches the plugin: it hands the keys back. With `closeOnEscape` it also closes
  the pane (7576–7586).
- Tests: `press({ key })` presses a Button by its key; `key()` only reaches a Client's `onKey`
  (16341–16354, 16378–16388).

The keys the six definitions use: digits (Git 1–5, Open Question 1–9), `j k l h s c g f y o a r
n d`, `/ ? [ ] .`, Space, Enter, Esc, Shift+↑/↓ and right-click. That leaves these letters
free: `b e i m p q t u v w x z`, and the digit `0`.

## Options

### A — Button hotkeys first, optional Client aliases (chosen)
Every binding's primary key is a digit or lowercase letter, drawn as the `hotkey` of that
action's visible Button. A non-letter key (`/`, `?`, `[`, `]`, `.`, Shift+arrows) may only be an
extra alias of a letter binding, served by an optional foundation `Client` key layer once the
person clicks into it.
- Pros: keyboard users get every primary key after ctrl+x tab, with no click. Every action is a
  button. It works on desktop and mobile through presses, and is testable with `press`.
- Cons: the definitions' non-letter keys need a letter primary, and their aliases need a click
  first.

### B — One Client catches every key
- Pros: any key works, including `/ ? [ ]` and Shift, through one router.
- Cons: nothing works until the person clicks the Client, so ctrl+x tab is not enough. Mobile
  has no Client. The Client's tree bounds (1439–1440) cap the whole panel body.

### C — Button hotkeys only
- Pros: simplest.
- Cons: `/ ? [ ] .` and Shift-extend are gone even for mouse-and-keyboard users.

## Decision

1. **Binding table per tab:** `{ key, label, run, help? }`, with `key` a digit or lowercase
   letter. The shell draws it as that action's Button `hotkey`, shows the hint on the button,
   and lists it in help.
2. **Raw-key aliases** (`alias: '/'` and the like) are optional. They work only through the
   foundation's `Client` key layer, which posts `{ key }` to `ui.message`; the router runs the
   shown tab's binding. A tab chooses whether to draw that layer. Where no `Client` exists
   (mobile), or the tab draws none, aliases are not shown at all (AC-2.5).
3. **Enter and Space** press the focused Button natively; tabs do not bind them.
4. **Esc is the engine's.** The pane opens without `closeOnEscape`, so Esc only hands the keys
   back and the panel stays open (AC-1.3, A3). A definition's "Esc clears" becomes a visible
   Clear button with a letter key.
5. **Arrows** scroll the pane natively. `j` / `k` / `l` / `h` are hotkeys of move and expand
   buttons that change the tab's selection in `$.state` (ADR-0003).
6. **Panel keys** are reserved, and no tab may bind them:
   - `t`: next tab, wrapping.
   - `b`: previous tab.
   - `i`: help and legend for the shown tab.

   Digits stay with the tabs, so `[0]`–`[5]` on the strip label positions, not hotkeys. Strip
   Buttons are clickable and focusable without hotkeys. If ADR-0001 picks B (six panes), `t`
   and `b` go away and `i` stays in each pane.
7. **Collision check** (AC-2.3): a pure `checkBindings(panelKeys, tabs)`, run in the test suite
   over every registered tab, fails on:
   - a tab key that is also a panel key;
   - two bindings of one tab on the same key;
   - a primary key that is not a digit or lowercase letter;
   - an alias that does not belong to a binding.

   Each later tab feature's own tests therefore catch its collisions.
8. **Help** (AC-2.4) is drawn by the shell from the shown tab's binding table and glossary
   (`ctx`, `⟲`, *est.* …). It is opened by a visible `Help` button whose hotkey is `i`.

## Consequences

- Each later tab feature remaps its definition's non-letter keys to letter primaries. It may
  keep them as Client aliases. Affected keys:
  - Plans: `[` / `]` (previous / next feature).
  - Open Question: `?` (discuss in chat).
  - Files: `/` (search) and `.` (ignored files).
  - Git: `/` (search).
  - Files and Agents: "Esc clears".

  The tab features' requirements should state this.
- Reversible: the binding table is internal. Changing the mechanism changes the router, not
  the tabs.
