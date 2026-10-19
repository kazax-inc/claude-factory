---
schema: factory.brief/1
feature: side-panel
source: .dev/brief.md
date: 2026-10-19
---

# Side panel — brief

References: the six mod definitions are `.dev/usage.md`, `.dev/agents.md`, `.dev/files.md`,
`.dev/plans.md`, `.dev/open-question.md`, `.dev/git.md` (relative links below point there).
Mod API facts: `.dev/panel-api-notes.md`. Intake source: `.dev/side-panel-intake.md`.

## Idea (verbatim)

Copied from `.dev/brief.md`; headings demoted by two levels, text unchanged.

### Claude Code mods — brief

A set of Claude Code mods, each one a tab of a side panel docked next to the chat. Together
they show what Claude is doing, what it costs, where `/factory` features stand and what is
waiting on you, without leaving the session.

This brief only introduces the mods. Each mod has a definition file in `.dev/` that describes
its behavior: location, data sources, layout, features, interactions, states, settings,
non-goals and open questions. Those files are the source for requirements and the spec. How
the mods are built (architecture, mod API, storage, rendering) is left to the factory
pipeline.

#### Mods

| Tab | Mod | Definition | Question it answers |
|---|---|---|---|
| [0] | Usage | [usage.md](usage.md) | Will I hit a subscription limit before it resets, and what is using it up? |
| [1] | Agents | [agents.md](agents.md) | What is running right now, which agent is stuck or expensive, and what did each one return? |
| [2] | Files | [files.md](files.md) | What is in this project, what changed, and what is Claude touching? |
| [3] | Plans | [plans.md](plans.md) | Where is each `/factory` feature, what is blocking it, what runs next, and what has it cost? |
| [4] | Open Question | [open-question.md](open-question.md) | What do I need to decide, why, and what are my options? |
| [5] | Git | [git.md](git.md) | What state is the repo in, what changed, and how do branches relate? |

- **Usage** — subscription windows (5h, weekly, per-model) with a projection at reset, and the
  live cost, context and cache figures of the main agent and each subagent.
- **Agents** — a live tree of the main agent and every subagent it spawned, with status,
  metrics, current activity, alerts and a detail view.
- **Files** — an IDE-style file tree with git state and Claude's read/write activity, and
  multi-selection that sends `@path` mentions to the prompt.
- **Plans** — progress of every `/factory` feature: pipeline stage, phases and tasks as a
  dependency tree, gate verdicts, live agents per task and usage per task/phase.
- **Open Question** — one inbox for requirement questions, gate questions, proposed ADRs and
  blockers, with answers sent to chat.
- **Git** — a read-only view of status, commit graph, branches, tags, remotes, worktrees and
  stashes, with actions sent to chat.

#### Shared principles

These come from the definition files and hold for every mod:

- **Read-only.** A mod reads session events, the filesystem, read-only git commands or the
  YAML frontmatter of the factory's Markdown files. It never writes project files and never
  runs a mutating command.
- **Actions go through chat.** Every action inserts a prompt (not submitted by default) or
  submits a `/factory` command. Claude then acts and asks for permission as usual.
- **Cross-links.** Mods link to each other: Usage → Agents, Plans ↔ Agents, Plans ↔ Open
  Question, Files ↔ Git.
- **Graceful states.** Each mod defines its empty, error, large-data and narrow-pane states,
  and keeps the last good data when a source fails.
- **Keyboard first.** Each mod has its own key bindings and settings, listed in its file.

#### Dependencies on the factory

Plans and Open Question read what the `/factory` pipeline writes in `.plan/` and `.specs/`.
Every file there is Markdown whose data lives in its YAML frontmatter; the formats are in the
factory plugin's `docs/data.md`. The mods parse the frontmatter (split on the first two `---`
lines, then a YAML 1.2 parser) and never the Markdown body. Some of their open questions may
need changes on the factory side, for example a `/factory decide` command.

#### Open questions

Each definition file ends with its own open questions. They are carried into requirements as
they are.

## Intake answers

From `.dev/side-panel-intake.md`, approved by the user with the run plan on 2026-10-19.

### Scope of this feature

`side-panel` is feature 1 of 7 and builds **only the foundation shared by all tabs**. Each tab
is its own later feature, created with `/factory new <slug> <brief> --until build`:

| # | Slug | Brief | Builds |
|---|---|---|---|
| 1 | `side-panel` | `.dev/brief.md` (+ the six definitions as references) | the foundation shared by all tabs, listed below |
| 2 | `usage-tab` | `.dev/usage.md` | tab [0] |
| 3 | `agents-tab` | `.dev/agents.md` | tab [1] |
| 4 | `git-tab` | `.dev/git.md` | tab [5]; before Files, which reuses its git layer |
| 5 | `files-tab` | `.dev/files.md` | tab [2] |
| 6 | `plans-tab` | `.dev/plans.md` | tab [3] |
| 7 | `open-question-tab` | `.dev/open-question.md` | tab [4] and the factory-side changes |

The tabs' own behavior and the factory-side changes (`/factory decide`, gate question ids) are
out of scope here; the foundation must only provide what they stand on.

### Foundation needs

**The `side-panel` foundation** (the architect decides how, in ADRs; these are the needs its
requirements must cover, gathered from all six definitions):
- **Panel shell and navigation.**
  - A panel shell with stable tab order `[0]`–`[5]` and a `/panel` command to open, close or
    jump to a tab. One pane with drawn tabs or six panes is a major ADR, so the user picks.
  - Keyboard routing per tab, with every action also a visible button. Vibe coders must not
    need to memorise keys.
  - Narrow and inline fallbacks.
- **Cross-links.** Cross-tab navigation ("open agent X in Agents", "task T1.2 in Plans", "file in
  Git", "question in Open Question"). A link to a tab that is not built yet degrades to a dim
  hint.
- **Shared session data.**
  - A session event store shared by Usage, Agents, Files and Plans: agent tree via
    `parentAgentId`, per-request usage, tool calls, busy state, and `/clear` reset.
  - A pricing table for *est.* costs, in one module and easy to update.
- **Factory files.** A factory data reader for Plans and Open Question.
  - It reuses `hooks/yaml.ts` (`splitFrontmatter`, `parseYaml`) and `hooks/schemas.ts`
    (`planTasks`, `STAGE_BY_PHASE`, `checkDoc`).
  - It moves `featureTasks` / `stageStatuses` / `loadRuns` out of `hooks/register.ts` into a
    shared module, so the hooks and the panel compute progress the same way.
  - It keeps the last good data when a file does not parse.
- **Read-only git.** A git runner (single-flight, timeout, `--no-optional-locks`) and a
  porcelain v2 parser, used by Git and Files. It never runs a mutating command.
- **Chat actions.** One helper for insert, submit and `/factory` command, honoring
  `autoSubmit`/confirm settings.
- **Settings and status.**
  - Settings through `userConfig`, one prefix per tab.
  - A status-line composer: Usage's limit warning and Open Question's `? N` share
    `$.ui.status`.
  - Toast policy.
- **Graceful states.** A shared vocabulary for empty, error, large-data and narrow states.
- **Constraint.** `hooks/hooks.json` keeps one entry module; the panel is imported from it. The
  existing frontmatter checks and usage stats must keep working, and their tests must pass.

### Product principles

- **Works without `/factory`.** Usage, Agents, Files and Git are useful in any session. Plans
  and Open Question show a friendly empty state with the one command to start.
- **Plain words.** Labels are plain words; jargon (`ctx`, `⟲`) gets a hover or legend.
  Defaults are sensible, and settings are optional.
- **Never blocks the user.** Actions insert into the prompt by default, so the user can edit or
  ignore them. Nothing is gated on following the pipeline. Free-text answers are always
  accepted, not only listed options.
- **Read-only.** A tab never writes project files and never runs mutating commands.


### Default answers to the definitions' open questions
| Mod | Question | Default |
|---|---|---|
| Usage | Per-model windows on every plan? | Show every `rateLimits` kind the session reports (`five_hour`, `seven_day`, `seven_day_<model>`, `spend_limit`) and hide the rest; never assume one exists. |
| Usage | Projection in the status line? | Yes, only when a limit is predicted before reset. Setting `statusLine: warn` (default) / `off`. |
| Agents | Per-agent cost as an estimate? | Yes: tokens × the shared price table, always labelled *est.* The session total uses Claude Code's `cost.usd` when reported. |
| Agents | Swimlane/timeline view? | Not in v1 (non-goal); the tree only. |
| Files | Add to chat: insert or submit? | Insert only (`$.prompt.fill` append), like every action. |
| Files | Folder mention? | One `@folder/` mention, not expanded. |
| Plans | Next task while a turn runs? | Allowed: `$.command.run` queues until idle, and the button shows *queued*. Still disabled while the feature is `waiting_on_user`, with a link to Open Question. |
| Plans | DAG graph view? | Not in v1; tree with `⇠` refs and dependency highlighting. |
| Open Q | Record every gate question? | Yes (see factory changes). |
| Open Q | `/factory decide` subcommand? | Yes (see factory changes). |
| Git | Other worktrees' branches in graph? | Yes by default: `--all` already includes them; decorate each worktree's HEAD. |
| Git | PR status via `gh`? | Not in v1 (non-goal). |


### How open questions are handled

Requirements open questions those defaults already cover are recorded at once as decisions
`by: user` (the user approved them with the run plan), and the run continues without
stopping. New questions are asked, batched in one AskUserQuestion for the feature.

### Mod API

Facts about Claude Code's mod API (build 2.1.303) are in `.dev/panel-api-notes.md`; the
authority is `.claude-plugin/types/claude-code/index.d.ts` once the plugin has loaded. These are
intake material, not decisions: the architect decides.
