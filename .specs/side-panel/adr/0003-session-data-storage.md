---
schema: factory.adr/1
id: ADR-0003
feature: side-panel
title: "Storage of panel data: $.state atoms, caps and subscription granularity"
status: proposed
impact: major
options:
  - id: A
    title: "$.state atoms split by source, with a family per agent, feature and worktree"
  - id: B
    title: "One $.state atom per source (session, factory, git, view)"
  - id: C
    title: "Module memory, rebuilt from $.agent.list() after a reload"
recommendation: A
chosen: null
decided: null
---

# 0003 — Storage of panel data: $.state atoms, caps and subscription granularity

## Context

The panel holds four kinds of data:
- **Session**: the agent tree, per-agent requests and tool calls, busy state and figures
  (US-5).
- **Factory**: the reader's parsed frontmatter, with warnings and last good data (US-7).
- **Git**: query results with last good data (US-8).
- **View**: open, shown tab, per-tab selection, help, confirmations and queued actions (US-1,
  US-9).

It must survive a hot reload (AC-5.9), and a settings change is a reload (AC-10.4). A draw must
never read files (AC-7.6). This is major because it fixes storage and ships the plugin's first
public data contract.

Engine facts (index.d.ts):

- `$.state` holds named values for the session that survive a hot reload of the plugin's code
  (3459–3500):
  - A `get` made while drawing subscribes that drawing, and a later `set` redraws it.
  - **Any plugin reads any value**; only the owner writes.
  - Writes are refused while drawing. Values are JSON. `ifVersion` gives compare-and-set.
- Refs must be literals in source, declared in `PluginState` through the plugin's contract
  (7939–7951, 12627–12638). The contract is a `.d.ts` that plugin.json names as `types`
  (header 91–99). The reference mods use `types/index.d.ts`. Factory's plugin.json has no
  `types` today.
- Tools for shaping the data:
  - An atom with a `shape` tag reads as absent after a reload whose code names another tag
    (740–749, 12311–12324).
  - `StateFamily<T>` holds one value per id (12582–12595), and `memberOf` addresses a member
    (6185–6187).
  - `derive` caches by source versions in plugin memory; the cache is lost on reload and
    rebuilt by the next read (3806–3834).
- Redraws run at most 10 a second, or 30 for a shown terminal pane (2384–2385). A `$.state`
  write redraws its readers at that rate (4078–4079).
- Module variables reset on reload, and a change to the options reloads the plugin
  (9706–9708).
- `$.agent.list()` gives only id, description, type, status, parentId, spawnedBy and name. It
  has no model, tokens, requests, tool calls, times or answer (121–184).
- `/clear` raises `session.end` with reason `clear`, continues under a new session id, and
  fires no `session.start` (11477–11485). The flightdeck mod resets its own `$.state` on clear,
  so values outlive `/clear`.
- `$.store` persists across sessions, 4 MiB in all (3427–3458). That lifetime is wrong here (A2).
  No size cap is stated for `$.state`; `set` takes "JSON data, as `$.store.set` takes" (3490).

## Options

### A — Atoms split by source, with families (recommended)

| Key (plugin `factory`) | Kind | Holds |
|---|---|---|
| `session` | atom, shaped | busy, current turn, context, compactions, cost, rate limits by kind; agent index (id → parent, type, model, description, background, status, stop reason, start/end, factory attribution, totals) |
| `agentActivity` | family by agent id, shaped | request tuples, recent tool calls, dropped count, answer head |
| `factoryIndex` | atom, shaped | feature list, "no factory data", reader warnings |
| `feature` | family by feature slug, shaped | parsed frontmatter per file, last good, warnings |
| `git` | family by worktree path, shaped | per query: last good result, error, time, running |
| `view` | atom, shaped | open, shown tab, per-tab selection and scroll, help, confirm, queued actions |

A draw reads `view`, then only the shown tab's sources. Agents reads the `agentActivity`
members of its visible rows only.

- Pros:
  - Survives reloads and `/config` changes.
  - A tool call writes one small member and redraws only the drawings that read it.
  - It is the engine's idiom, as in filetree and flightdeck.
  - Shape tags make an upgraded module start clean instead of misreading old data.
- Cons:
  - Adds `types/index.d.ts` and plugin.json `types`.
  - Any plugin can read these values, so their shapes become a soft public API. The contract
    marks them internal, and a shape tag lets us change them.
  - More keys to name and test.
- Cost to reverse: low to medium. The data lives for the session only, so a change is a new
  shape tag and needs no migration.

### B — One atom per source

`session` holds everything, including all tool calls; plus `factory`, `git` and `view`.

- Pros: fewest keys and the smallest contract; still survives reloads.
- Cons: every tool call reserializes the whole session store (a few hundred KB, even with the
  caps below) and redraws every drawing that reads any part of it (Usage, Agents and Files at
  once). It is also the single largest value, closest to any unstated host limit.
- Cost to reverse: low.

### C — Module memory, rebuilt from `$.agent.list()`

- Pros: no public contract, no plugin.json change, and the fastest writes.
- Cons:
  - **Fails AC-5.9 and AC-10.4.** After any reload, including every `/config` change, only
    id, type, description, status and parent come back (121–184). Requests, tokens, tool calls,
    model, busy state and figures are lost.
  - Drawings do not subscribe, so every change needs `$.ui.invalidate('ui.render')` (2383–2393),
    which redraws everything.
  - Factory and git last good data (AC-7.3, AC-8.4) are lost on reload.
- Cost to reverse: low.

## Recommendation

**A.** It is the only option that meets AC-5.9 and AC-10.4 and still redraws only what changed
when parallel subagents stream tool calls. The public-contract cost is small: the data lives
for the session only and is shape-tagged, so it is cheap to change.

## Caps (for every option; fixes A5)

- Tool calls: the 200 most recent per agent, plus a count of the dropped ones. Each target is at
  most 200 characters, after the shared `redact` (A6).
- Final answer: the first 5 lines, at most 400 characters.
- Requests: kept in full as number tuples `[atMs, model, effort, input, output, cacheRead,
  cacheWrite]`, with running totals per agent, so draws never sum.
- Agents: not capped; a tree node is about 300 bytes.
- Git status: at most 1,000 entries, plus a count of the rest.
- Factory: frontmatter only, never bodies.
- Budget: at most 1 MiB of JSON per value and 4 MiB in all, mirroring `$.store`'s cap because
  `$.state` states none.

## Rules (for every option)

- Writes come only from event hooks, presses and timers, never from a draw.
- `session.end` with reason `clear` resets the session data to the main agent only and keeps
  the rate limits (AC-5.8). Factory, git and view data are kept.
- The foundation uses no `$.store`. If a tab wants to show the last limits dimmed across
  sessions, that is its own decision.
- The factory hooks' own module state (`runs`, `mainTurns`, `isFactorySession` in
  `hooks/register.ts`) is unchanged (AC-14.3).

## Consequences

- If A or B: plugin.json gains `"types": "./types/index.d.ts"`, and `types/index.d.ts` declares
  `PluginState['factory']`, documented as internal. Literal refs live in one module
  (ADR-0006).
- If C: the requirements-analyst must relax AC-5.9 and AC-10.4 (data lost on reload or on a
  settings change) before the spec.
