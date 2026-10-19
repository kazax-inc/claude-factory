---
schema: factory.adr/1
id: ADR-0001
feature: side-panel
title: "Panel shell: one pane with drawn tabs or six engine panes"
status: proposed
impact: major
options:
  - id: A
    title: "One pane (id panel) with a hand-drawn tab strip"
  - id: B
    title: "Six engine panes, one per tab, shown as the engine's own tabs"
recommendation: A
chosen: null
decided: null
---

# 0001 — Panel shell: one pane with drawn tabs or six engine panes

## Context

The brief marks this as the user's pick. The shell must give: a fixed tab order [0]–[5]
(AC-1.2), `/panel <tab>` to open on a tab (AC-1.2), cross-links that show the target tab
(AC-4.1), badges (AC-1.6), dimmed placeholders for unbuilt tabs (Q8), short labels when narrow
(AC-3.3), an inline fallback (AC-3.2) and per-tab keys (AC-2.1).

What the engine offers (build 2.1.303, `.claude-plugin/types/claude-code/index.d.ts`):

- One pane per id. Opening an id that is already open only changes its title
  (index.d.ts:2515, 7552–7553).
- The surface shows one pane at a time and draws the rest as tabs. A pane's `title` is its tab
  label, drawn only while more than one pane is open (7559–7565, 10733–10740, 14869–14871).
  Panes are listed in open order (2555, 7416).
- **No call shows a given pane.** The `ui` noun (2366–2637) has `toast`, `notify`, `status`,
  `open`, `close`, `panes`, `scroll`, `focus`, `copy`, `selection` and `view`. `open({ focus })`
  raises a pane only while the prompt holds the keys over an empty composer. A pane the person
  is using refuses it (7567–7574). `$.ui.focus` is denied on a site that does not hold the keys
  (2581–2582).
- The person switches panes by clicking a tab, by Tab then Enter on it, or with ctrl+x tab. They
  close one with its mark or ctrl+x x, which raises `ui.close` with origin `person`
  (10726–10728, 10737, 7537).
- The engine remembers pane ids across sessions for placement. A pane opened on request is
  placed at any width. One opened by the plugin itself waits below 144 columns, or below 110 for
  an id the person opened before (7544–7548, 14807–14816).
- A Button `hotkey` presses only while the plugin's site holds the focus (1113–1121).
- A throw while drawing makes the engine draw its own error for that component (4075–4076).

## Options

### A — One pane with a hand-drawn tab strip

How it works: `$.ui.open({ id: 'panel', title: 'Panel' })`. One `ui.render` hook for
`{ component: 'Pane', requestId: 'panel' }` draws a strip of six Buttons (`[0] Usage` …
`[5] Git`, each with its badge, dimmed while unbuilt) and below it the shown tab's body. The
shown tab and each tab's selection live in `$.state` (ADR-0003). `/panel <tab>`, cross-links
and the panel keys (ADR-0002) only write the shown tab. Each tab's draw runs inside a
try/catch, so a tab that throws shows its own error state, not the engine's.

- Pros: every criterion holds as written. Order is fixed. Any press can switch tabs, so
  cross-links work. We control badges, dimming and narrow labels. Inline is one block. There is
  one pane id for the engine's placement memory.
- Cons:
  - We build and test the strip and tab switching ourselves (about one module).
  - The strip takes one body row.
  - When another plugin's pane shares the dock, the person may see the engine's tab row above
    our strip, two levels of tabs. index.d.ts does not say whether that row spans plugins.
  - ctrl+x tab cycles panes, not our tabs.
  - The engine keeps one scroll window per pane, so the shell must reset or restore the offset
    on a tab switch (`$.ui.scroll`, index.d.ts:14951–14970).
- Cost to reverse: medium-low. Tab bodies are shell-independent draw functions. Moving to B
  replaces the shell, panel keys and link navigation, and the engine forgets id `panel`.
- Impact on existing code: none beyond the panel modules (ADR-0006).

### B — Six engine panes, one per tab

How it works: `/panel` opens six panes in order (`usage`, `agents`, `files`, `plans`,
`questions`, `git`), with titles as tab labels. A badge is a retitle (`Questions 3`). Six
render hooks, one per pane.

- Pros:
  - Native tabs: click, ctrl+x tab, and per-pane scroll, focus and close.
  - The engine scopes hotkeys to the focused pane, so AC-2.1 isolation comes free.
  - No strip row.
  - A throw in one tab breaks only its pane.
- Cons:
  - **Cross-links cannot show another pane.** A press inside pane X holds the keys there, so
    `open({ focus })` and `$.ui.focus` on pane Y are refused (7567–7574, 2581–2582). AC-4.1
    would have to shrink to "the target is selected in its tab; you switch to it".
  - **Fixed order is not guaranteed.** Tabs follow open order, so a tab the person closes and
    reopens goes last. Restoring the order means closing and reopening all six, which loses
    scroll and flickers.
  - Labels are plain strings. They cannot be dimmed (Q8) or shortened by width (AC-3.3); the
    engine truncates them. A retitle cannot happen from inside a draw.
  - `/panel <tab>` raises the pane only while the composer is empty and holds the keys.
  - Until each tab ships, five placeholder panes sit in the dock (Q8).
  - Closing one pane makes "the panel is closed" (AC-1.3) ambiguous.
- Cost to reverse: medium. The engine remembers six pane ids; tab bodies are reusable.
- Impact on existing code: none beyond the panel modules. Requirements AC-1.2 (order), AC-3.3
  (labels), AC-4.1 (links) and Q8 (dimming) would need relaxing before the spec.

## Recommendation

**A.** With today's API, B cannot meet AC-4.1 or AC-1.2's fixed order, because nothing shows a
given pane. Q8's dimmed placeholders and AC-3.3's short labels also need a strip we draw. A
keeps every requirement as written. Its price is one strip module, plus nested tabs when another
plugin's pane shares the dock. Revisit if the engine adds a "show this pane" call.

## Consequences

- If A: pane id `panel`. The title is `Panel`, retitled to `Panel · <tab>` on a switch, so the
  engine's tab row stays informative when other plugins' panes are open. The shell owns the
  strip, the help overlay (ADR-0002), the per-tab scroll offset and a per-tab error boundary.
  The panel keys `t`, `b` and `i` (ADR-0002) apply.
- If B: ADR-0002 drops `t` and `b`, since the engine switches panes, and keeps `i` per pane.
  The requirements-analyst relaxes AC-1.2, AC-3.3, AC-4.1 and Q8 before the spec.
- Either way, each tab body is a function of its context (data, size, placement, narrow flag)
  that never touches the shell, so the choice stays reversible.
