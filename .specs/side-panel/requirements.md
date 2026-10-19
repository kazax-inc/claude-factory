---
schema: factory.requirements/1
feature: side-panel
stories: [US-1, US-2, US-3, US-4, US-5, US-6, US-7, US-8, US-9, US-10, US-11, US-12, US-13, US-14]
criteria: [AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-1.5, AC-1.6, AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5, AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-5.1, AC-5.2, AC-5.3, AC-5.4, AC-5.5, AC-5.6, AC-5.7, AC-5.8, AC-5.9, AC-6.1, AC-6.2, AC-6.3, AC-6.4, AC-7.1, AC-7.2, AC-7.3, AC-7.4, AC-7.5, AC-7.6, AC-7.7, AC-8.1, AC-8.2, AC-8.3, AC-8.4, AC-8.5, AC-8.6, AC-8.7, AC-8.8, AC-9.1, AC-9.2, AC-9.3, AC-9.4, AC-9.5, AC-9.6, AC-9.7, AC-10.1, AC-10.2, AC-10.3, AC-10.4, AC-11.1, AC-11.2, AC-11.3, AC-11.4, AC-12.1, AC-12.2, AC-12.3, AC-12.4, AC-13.1, AC-13.2, AC-13.3, AC-13.4, AC-13.5, AC-14.1, AC-14.2, AC-14.3, AC-14.4, AC-14.5]
open_questions:
  - id: Q1
    text: "Which rate-limit windows does the shared data expose? (Usage: per-model windows on every plan?)"
    affects: [US-5]
  - id: Q2
    text: "Is the limit projection shown in the status line? (Usage)"
    affects: [US-11]
  - id: Q3
    text: "Is per-agent cost acceptable as an estimate from a price table? (Agents)"
    affects: [US-6]
  - id: Q4
    text: "Does adding files to chat insert into the prompt or submit it? (Files)"
    affects: [US-9]
  - id: Q5
    text: "Is a folder added to chat one @folder/ mention or expanded to its files? (Files)"
    affects: [US-9]
  - id: Q6
    text: "May a /factory command be sent while a turn is running? (Plans, Next task)"
    affects: [US-9, US-5]
  - id: Q7
    text: "Does the git layer cover other worktrees' branches by default? (Git)"
    affects: [US-8]
  - id: Q8
    text: "Until a tab's own feature is built, what does the panel show in its place?"
    affects: [US-1, US-4]
  - id: Q9
    text: "Which Claude Code surfaces must the panel support in v1 (terminal only, or desktop and mobile too)?"
    affects: [US-2, US-3]
---

# Side panel (foundation) — requirements

## Context

This feature is feature 1 of 7. It builds **only the foundation shared by the six tabs** of a side panel docked next to the chat: Usage [0], Agents [1], Files [2], Plans [3], Open Question [4], Git [5]. Each tab is its own later feature (`usage-tab`, `agents-tab`, `git-tab`, `files-tab`, `plans-tab`, `open-question-tab`). The needs below come from the brief's "Foundation needs" list and from what the six definitions (`.dev/usage.md`, `.dev/agents.md`, `.dev/files.md`, `.dev/plans.md`, `.dev/open-question.md`, `.dev/git.md`) require from shared code.

Stated constraints:
- The panel ships inside the existing `factory-mods` Claude Code plugin (`plugins/factory-mods/`, TypeScript, no `package.json`); paths below are relative to it. `hooks/hooks.json` keeps its single entry module `hooks/register.ts`; the panel is reached from it by static import.
- The existing frontmatter checks and per-task usage stats must keep working, and their tests (`claude plugin test plugins/factory-mods`, `hooks/*.test.ts`) must pass.
- Reuse `hooks/yaml.ts` (`splitFrontmatter`, `parseYaml`) and `hooks/schemas.ts` (`planTasks`, `STAGE_BY_PHASE`, `checkDoc`). Move `featureTasks`, `stageStatuses` and `loadRuns` (today private in `hooks/register.ts`) into a shared module, so the hooks and the panel compute progress the same way (rules in `docs/data.md`, "Computing progress").
- Mod API facts (build 2.1.303) are in `.dev/panel-api-notes.md`; the authority is `.claude-plugin/types/claude-code/index.d.ts`. The plugin uses no `$.ui`, `$.state`, `$.prompt` or `userConfig` today.

Product principles (approved by the user, apply to every requirement):
- **Works without `/factory`.** The panel is useful in any session; factory-only parts show a friendly empty state with the one command to start.
- **Plain words.** Labels are plain words; jargon gets a hover or legend. Defaults are sensible; settings are optional.
- **Never blocks the user.** Actions insert into the prompt by default; nothing is gated on following the pipeline; free-text answers are always accepted.
- **Read-only.** The panel never writes project files and never runs a mutating command.

## User stories

### US-1 Panel shell and `/panel` command
As a user, I want one side panel with six tabs in a fixed order and a `/panel` command to open, close or jump to a tab, so that I can reach any view without leaving the session.

- AC-1.1 Given a session in any project (with or without `.plan/`), When I run `/panel`, Then the panel opens and shows Usage [0] if this is its first opening in the session, otherwise the tab that was shown last.
- AC-1.2 Given the panel is open or closed, When I run `/panel <tab>` with an index `0`–`5` or a tab name (`usage`, `agents`, `files`, `plans`, `questions`, `git`; case-insensitive), Then the panel is open and shows that tab, and the tab labels keep the order [0]–[5].
- AC-1.3 Given the panel is open, When I run `/panel close`, Then the panel closes, and it does not reopen by itself later in the session.
- AC-1.4 Given any state, When I run `/panel` with an argument that is not a known tab or `close`, Then nothing changes and the reply lists the valid arguments in plain words.
- AC-1.5 Given the engine refuses to place the panel (`isPlaced: false` with a reason), When I run `/panel`, Then the reply states the reason in plain words and what to do (for example "widen the terminal").
- AC-1.6 Given a tab reports a badge (for example Open Question's pending count), When the count changes, Then the tab's label shows the new count, and shows no badge at 0.

### US-2 Keyboard routing with visible buttons
As a keyboard user, I want each tab's keys to work when that tab is shown, and as a user who does not memorise keys, I want every action to also be a visible button, so that both ways of working are first-class.

- AC-2.1 Given a tab declares a key binding (key, action, plain label), When that tab is shown and the panel has focus and I press the key, Then the action runs; and When another tab is shown, Then pressing it does not run that action.
- AC-2.2 Given any action a tab declares, When the tab is drawn, Then the action is reachable as a visible button (directly or through a visible menu button), and the button shows its key hint when it has one.
- AC-2.3 Given the panel-level bindings (tab switching, help) and every tab's bindings, When the bindings are registered, Then a key used at panel level is not also bound by a tab, and a collision is reported as a failing check in the test suite.
- AC-2.4 Given any tab, When I open the help/legend from its visible button, Then it lists that tab's key bindings and explains each jargon term or symbol the tab uses (for example `ctx`, `⟲`, *est.*).
- AC-2.5 Given a surface where raw keys are unavailable, When the panel is drawn, Then every action is still usable through buttons and nothing shows a key hint that cannot work there.

### US-3 Placement, narrow and inline fallbacks
As a user on any terminal width, I want the panel to adapt to where and how wide it is drawn, so that it stays usable instead of breaking.

- AC-3.1 Given the panel is drawn with placement `dock`, When it renders, Then it shows the tab strip and the shown tab's body at full layout.
- AC-3.2 Given the panel is drawn with placement `inline` (above the prompt), When it renders, Then it shows the tab strip and a compact body that fits the rows it is given, and the tab can still be switched.
- AC-3.3 Given the panel body is narrower than the narrow threshold (40 columns unless the architect sets another), When it renders, Then tab labels shorten to their index (and badge), and the tab receives a `narrow` flag to drop columns in its declared order.
- AC-3.4 Given the terminal is resized while the panel is open, When the next frame is drawn, Then the layout follows the new placement and width without losing the shown tab or its selection.

### US-4 Cross-tab links
As a user, I want to jump from an item in one tab to the same thing in another tab ("open agent X in Agents", "task T1.2 in Plans", "file in Git", "question in Open Question"), so that I can follow a thread across views.

- AC-4.1 Given a link to one of the target kinds `agent <id>` (Agents), `task <feature> <id>` (Plans), `feature <feature>` (Plans), `file <path>` (Git or Files), `question <feature> <ref>` (Open Question), When I activate it by button or key, Then the panel shows the target tab and that tab receives the target to reveal and select.
- AC-4.2 Given a link whose target tab is not built yet, When it is drawn, Then it shows as a dim hint naming the tab (for example "in Agents, not available yet"), and activating it changes nothing.
- AC-4.3 Given a link whose target no longer exists (for example an agent cleared by `/clear`, or a removed task), When I activate it, Then the target tab is shown with a plain "not found" hint, and no error is thrown.
- AC-4.4 Given the cross-link pairs the definitions need (Usage → Agents, Plans ↔ Agents, Plans ↔ Open Question, Files ↔ Git), When each is exercised in tests, Then each resolves to its target tab.

### US-5 Shared session data
As the Usage, Agents, Files and Plans tabs, I want one store of session events, so that they show the same agents, figures and activity without each one re-listening and disagreeing.

- AC-5.1 Given `agent.spawn` events (with `parentAgentId` when nested), When their results arrive, Then the store holds a tree rooted at the main agent where each subagent is a child of the agent that spawned it, at any depth, with type, description, model, background flag and start time.
- AC-5.2 Given a spawned agent, When it is waiting, running, finished, failed, or stopped by `max_tokens`, Then the store reports the matching status (`queued`, `running`, `done`, `failed`, `max_tokens`), its stop reason and end time, and the first lines of its final answer.
- AC-5.3 Given `turn.step` results, When each one completes, Then the store records one request per step with agent id, model, effort when known, and input, output, cache-read and cache-write tokens; and per-agent totals equal the sum of their requests.
- AC-5.4 Given `tool.call` events, When each call finishes, Then the store records tool name, agent id, a short target (path or command) with credentials masked, start time, duration and error flag, in call order per agent.
- AC-5.5 Given the main loop's `turn.start` and `turn.complete` (no `agentId`), When they occur, Then the store's busy state is `busy` between them and `idle` otherwise, and subscribers are notified of each change.
- AC-5.6 Given a spawn prompt whose first lines carry `Feature:`, `Phase:` and `Task:`, When the agent is recorded, Then its factory attribution (feature, phase, task) is stored using the same parsing rule the hooks use.
- AC-5.7 Given `session.measure` and `$.session.usage()` readings, When they arrive, Then the store holds the context fill, compaction count, the session cost when reported, and every rate-limit window the session reports, by kind, and no window it does not report (Q1).
- AC-5.8 Given a session with recorded agents, requests and tool calls, When `/clear` arrives (`session.end` with reason `clear`), Then session figures, the agent tree (back to the main agent only) and activity are reset, and the last rate-limit readings are kept.
- AC-5.9 Given recorded session data, When the plugin module hot-reloads (for example after a settings change), Then the data is still present afterwards.

### US-6 Price table for estimated cost
As the Usage, Agents and Plans tabs, I want one price table to estimate cost from tokens, so that every estimate agrees and prices are easy to update.

- AC-6.1 Given a model id present in the price table and a token breakdown, When cost is estimated, Then it equals the sum of each token kind (input, output, cache read, cache write) times that model's price for that kind.
- AC-6.2 Given a model id not in the table, When cost is estimated, Then the result is "no price" (shown as a dash with a hint), never a guessed number.
- AC-6.3 Given any cost the foundation computes from tokens, When a tab formats it, Then it is labelled *est.*; and Given Claude Code reports a session cost (`cost.usd`), Then the session total uses that reported value without the *est.* label (Q3).
- AC-6.4 Given a maintainer updating prices, When they edit the table, Then the change is confined to one module that also states the date the prices were taken, and the legend shows that date.

### US-7 Factory data reader
As the Plans and Open Question tabs, I want a read-only reader of the factory's `.plan/` and `.specs/` frontmatter, so that I show features, progress and questions computed exactly as the hooks compute them.

- AC-7.1 Given a project with `.plan/STATE.md` and features under `.plan/<feature>/` and `.specs/<feature>/`, When the reader loads, Then it returns per feature the index entry, STATE, plan, routing, task stats, runs and orchestrator records, requirements `open_questions`, and ADRs, parsed from frontmatter only with `splitFrontmatter` and `parseYaml`, never from the Markdown body.
- AC-7.2 Given the same files, When progress is computed by the panel and by the hooks, Then task status, counts, percent, phase status, ready tasks and stage status are identical, because both call the same shared module (holding `featureTasks`, `stageStatuses`, `loadRuns`).
- AC-7.3 Given a file that was read successfully, When it later fails to parse or fails `checkDoc`, Then the reader keeps the last good data for that file and reports a warning with the file path and the problem.
- AC-7.4 Given a file that never parsed, When the reader loads, Then that file is reported as a warning with the problem, and the rest of the feature still loads.
- AC-7.5 Given a project with no `.plan/` and no `.specs/`, When the reader loads, Then it reports a "no factory data" state (not an error) that tabs show with the hint `/factory new <feature> <idea>`.
- AC-7.6 Given a pipeline file changes on disk, When the change is detected (change event, or a poll as fallback), Then the reader re-reads only the changed files and notifies subscribers, and a draw never triggers a file read.
- AC-7.7 Given any reader operation, When it runs, Then it performs no file write.

### US-8 Read-only git runner and parsers
As the Git and Files tabs, I want one safe way to run git and parse its output, so that both show the same repository state and the panel can never change the repository.

- AC-8.1 Given any git request, When it runs, Then the process is invoked as `git --no-optional-locks -C <dir> …` with `GIT_OPTIONAL_LOCKS=0`, with no shell, and with a timeout.
- AC-8.2 Given a request whose subcommand and arguments are not on the read-only allowlist (for example `commit`, `checkout`, `stash` without `list`, `branch -d`, `worktree add`), When it is requested, Then it is refused with an error and no process is started.
- AC-8.3 Given a git command is already running for a directory, When more requests arrive for it, Then they do not start in parallel: one runs at a time, and duplicate pending requests are coalesced into a single follow-up run whose result every requester receives.
- AC-8.4 Given a command times out, exits non-zero, or git is not installed, When it finishes, Then the result is an error naming the command and the cause, and the git layer keeps the last good parsed result for that query so tabs can show it with the error.
- AC-8.5 Given the directory is not inside a git repository, When status is requested, Then the result is a distinct "not a git repo" state, not a generic error.
- AC-8.6 Given output of `git status --porcelain=v2 --branch` (NUL-separated if the architect chooses), When it is parsed, Then the result holds branch head, upstream, ahead/behind, detached HEAD, and one entry per path with staged and unstaged states, rename/copy original path, conflicts (`u`), untracked (`?`) and ignored (`!`), including paths with spaces and non-ASCII characters.
- AC-8.7 Given output of `git diff --numstat` and `git diff --cached --numstat`, When it is parsed, Then each path has added and removed line counts, and binary files are marked binary instead of counted.
- AC-8.8 Given another worktree's path, When status is requested for it, Then the runner runs in that worktree (`-C <worktree>`) under the same rules (Q7).

### US-9 Chat actions
As every tab, I want one helper that sends actions to chat, so that every action behaves the same way: inserted for the user to edit by default, submitted only when the user chose so.

- AC-9.1 Given an insert action and a prompt that already holds text, When it runs, Then the text is appended to the prompt (separated by a space when needed), the user's text is kept, and nothing is submitted (Q4).
- AC-9.2 Given a tab whose auto-submit setting is on, When one of its insert actions runs, Then the text is submitted instead of inserted; and Given it is off (default), Then it is inserted.
- AC-9.3 Given a tab whose confirm setting is on, When a submitting action (a `/factory` command or a submit) is triggered, Then an in-panel confirmation with Confirm and Cancel buttons appears first, and Cancel sends nothing.
- AC-9.4 Given the session is busy, When a submit or `/factory` command is sent, Then it is queued until idle, the action reports a `queued` state the tab can show on its button, and the state clears when the queued item starts (Q6).
- AC-9.5 Given a `/factory` command action with arguments, When it is sent, Then it runs as that command with those arguments, exactly once.
- AC-9.6 Given one or more file and folder paths, When a mention is built, Then each file becomes one `@path` and each folder one `@folder/` mention, not expanded to its files (Q5), relative to the project root.
- AC-9.7 Given the user ignores or edits an inserted prompt, When nothing is submitted, Then the panel takes no further action and does not re-insert.

### US-10 Settings
As a user, I want optional settings with sensible defaults, grouped by tab, so that I can tune the panel in `/config` without having to.

- AC-10.1 Given the plugin's `userConfig`, When I open `/config`, Then every panel setting's name carries the prefix of its tab (or `panel` for shell-wide settings) and a plain-words description, and choice settings show as pickers.
- AC-10.2 Given no setting is set, When the panel runs, Then every setting has its default and the panel works fully.
- AC-10.3 Given a setting with an invalid value, When the panel loads, Then that setting uses its default and the panel shows one warning naming the setting; other settings are unaffected.
- AC-10.4 Given I change a setting, When the module reloads, Then the panel keeps its open state, shown tab and session data, and uses the new value.

### US-11 Status line composer
As the Usage and Open Question tabs, I want to share the plugin's single status line, so that a limit warning and a pending-question count can both appear without overwriting each other.

- AC-11.1 Given several segments set by different owners (for example the Usage limit warning and Open Question's `? N`), When the line is composed, Then all non-empty segments appear in a stable order on one line.
- AC-11.2 Given every segment is empty, When the line is composed, Then the status line is cleared (`$.ui.status(undefined)`), not set to an empty string.
- AC-11.3 Given a segment's text does not change, When its owner sets it again, Then the status line is not re-sent.
- AC-11.4 Given an owner's status setting is `off` (for example Usage `statusLine: off`; default `warn` shows the warning only when a limit is predicted before reset, Q2), When it sets a segment, Then that segment is not shown.

### US-12 Toast policy
As a user, I want toasts to be rare and useful, so that notifications do not nag me.

- AC-12.1 Given a tab raises a toast with a key, When the same key is raised again within the dedupe window, Then only one toast is shown.
- AC-12.2 Given the raising tab is shown and the panel is focused, When it raises a toast, Then no toast is shown (the tab itself already shows the change).
- AC-12.3 Given a tab's notify setting is off (or badge-only), When it raises a toast, Then no toast is shown.
- AC-12.4 Given many toasts are raised in a burst, When they are processed, Then at most one is shown per rate-limit interval and the rest are summarised in one toast ("3 more updates").

### US-13 Shared graceful states
As every tab, I want one vocabulary of states, so that loading, empty, error, large and narrow views look and read the same across tabs.

- AC-13.1 Given a source with no reading yet, When a tab draws it, Then a shared `loading` state is shown, or the last stored values dimmed when the tab provides them.
- AC-13.2 Given an empty source, When a tab draws it, Then a shared `empty` state shows one plain-words line and at most one action button (for example `/factory new <feature> <idea>` or "ask Claude to `git init`").
- AC-13.3 Given a source that fails after a good reading, When the tab draws, Then the last good data is shown, marked stale, with an error line naming the source and a Retry button.
- AC-13.4 Given a list longer than its cap or the drawing budget, When it draws, Then only the visible rows are drawn, and a "N more" / "show more" row is shown; the drawn tree stays within the engine's size limit.
- AC-13.5 Given a view declares a column drop order, When the panel is narrow, Then columns are dropped in that order and the remaining ones stay aligned.

### US-14 Coexistence and read-only guarantee
As the factory maintainer, I want the panel to live inside the plugin without changing what the plugin already does, so that the pipeline checks and usage stats stay trustworthy.

- AC-14.1 Given `hooks/hooks.json`, When the plugin loads, Then it still names one entry module, and the panel is reached from it by static import.
- AC-14.2 Given the existing test suite, When `claude plugin test .` runs, Then all existing tests pass.
- AC-14.3 Given the same event sequence, When it runs before and after this feature, Then the frontmatter check results and the stats files the hooks write are identical.
- AC-14.4 Given panel code throws while handling an event, When the error happens, Then the event still reaches the factory hooks and the engine with the result it would have had, and the panel shows an error state instead of crashing the session.
- AC-14.5 Given the panel's test suite with faked fs and processes, When every foundation path runs, Then panel code calls no file write on project files and starts no process other than allowlisted git commands.

## Edge cases

- **Empty**: no `.plan/` or `.specs/` (AC-7.5); not a git repo (AC-8.5); no subagents (tree is the main agent only); no rate-limit data off subscription (store holds no windows); empty prompt when inserting (no leading separator).
- **Huge**: > 50 agents and thousands of tool calls in a long session (store memory is bounded, see Assumptions; lists virtualize, AC-13.4); status capped at 1,000 entries; folders with > 2,000 entries; large `.plan/` with many features and stats files.
- **Invalid**: malformed or schema-invalid frontmatter (AC-7.3, AC-7.4); unknown model id (AC-6.2); invalid setting (AC-10.3); unknown `/panel` argument (AC-1.4); porcelain paths with spaces, newlines, non-ASCII or renames (AC-8.6); binary numstat (AC-8.7); loop events for an `agentId` with no recorded spawn (recorded under the main agent with type "unknown").
- **Concurrent**: overlapping git requests (AC-8.3); parallel subagents writing requests and tool calls at once; a file changed while it is being read (re-read on the next change); two owners setting status segments in the same tick; several actions queued while busy.
- **Offline**: no network is used by any foundation part; git remote data is local only.
- **Interrupted**: an aborted turn (`isAborted`) ends busy state and marks running agents accordingly; a git command killed by timeout (AC-8.4); hot reload drops timers, which must be re-armed, while `$.state` data survives (AC-5.9); the person closes the pane (`ui.close` with origin `person`) and the panel stays closed (AC-1.3).
- **Reset**: `/clear` arrives as `session.end { reason: 'clear' }` with no new `session.start` (AC-5.8); factory data and git data are not reset by `/clear`.
- **Undo/redo**: not applicable; the panel changes no data. A queued action cannot be recalled by the panel once sent (the user can still edit an inserted prompt).
- **Permissions**: unreadable files or folders are reported per entry, never crash; the panel never triggers a permission prompt by itself, because it runs only allowlisted read-only git and reads files through `$.fs`.
- **Surfaces**: the engine draws no pane until a width threshold (110/144 columns); no `Client` on mobile means no raw keys (AC-2.5).

## Non-goals

- The six tabs' own content, layout and behavior (each is a later feature).
- Factory-side changes: `/factory decide`, gate question ids and the `source` field (feature `open-question-tab`).
- Swimlane/timeline view of agents, DAG view of tasks, and PR status via `gh` (not in v1, per the approved defaults).
- Any file write, mutating git command, or agent control (stop, restart, change model).
- Network calls, billing history, or usage across sessions.
- A navigation history stack (back/forward) across cross-links.
- Auto-accepting any recommendation or submitting any action without the user's setting.

## Assumptions

- A1. The panel opens only when the user asks (`/panel` or a button); a `panel` setting may offer opening at session start, default off.
- A2. The shown tab and the panel's open state are remembered for the session (surviving hot reload), not across sessions; each new session opens on Usage [0].
- A3. `/panel` with no argument opens and focuses the panel; it does not toggle it closed. Closing is `/panel close` or the engine's close.
- A4. Tab names accepted by `/panel` are `usage`, `agents`, `files`, `plans`, `questions` (also `open-question`) and `git`.
- A5. The session store is bounded: per agent it keeps the most recent tool calls (order of a few hundred) and counts the dropped ones; per-request usage is kept in full as numbers. The architect fixes the caps.
- A6. Credential masking reuses one shared `redact` rule for tool-call targets (Agents) and remote URLs (Git).
- A7. Paths with spaces in `@` mentions are written in the form Claude Code accepts; the architect confirms the form against the engine.
- A8. Toast dedupe window and rate-limit interval default to about 10 seconds; the architect may tune them.
- A9. The factory attribution parser (`Feature:` / `Phase:` / `Task:`, today `briefHeader` in `hooks/register.ts`) also moves to the shared module, for the same reason as `featureTasks`.
- A10. Per-tab settings named in the definitions (`autoSubmitActions`, `confirmNext`, `confirmAnswers`, `notify`, `statusLine`, …) are declared by each tab's feature; the foundation only provides the prefix convention and the helpers that honor them.

## Items for the architect

These are design choices, not user questions; each becomes an ADR where it is major.
- One pane with hand-drawn tabs (Buttons + `$.state`) versus six engine panes drawn as tabs. The brief marks this a major ADR for the user to pick from the architect's options.
- How keys reach the panel (Button `hotkey` versus a `Client` surface module) and which keys switch tabs and open help without colliding with tab keys (tabs use digits, `j/k/l/h`, `/`, `?`, `[`/`]`, `a`, `r`, `s`, `c`, `f`, `g`, `y`, `n`, `d`, `o`, `.`, Space, Enter, Esc).
- Storage of session data (`$.state` atoms versus module state rebuilt from `$.agent.list()`), caps, and subscription granularity for drawing.
- Change detection for factory files and git (`classic.FileChanged` with `watchPaths` versus `$.clock.every` polling), and poll intervals.
- The read-only git allowlist, the timeout default, and whether to use `-z` output.
- Module layout under `hooks/` and the shared progress module's name and API.
- The userConfig key format for prefixes (for example `usageWarnThreshold` versus `usage.warnThreshold`), given what `userConfig` accepts.
- Narrow threshold and inline row budget.

## Open questions

Answered by the approved defaults (the user approved them with the run plan on 2026-10-19; record each as a decision `by: user`):
- Q1 — Rate-limit windows. **Answered:** expose every `rateLimits` kind the session reports (`five_hour`, `seven_day`, `seven_day_<model>`, `spend_limit`) and nothing else; never assume one exists.
- Q2 — Projection in the status line. **Answered:** yes, only when a limit is predicted before reset; Usage setting `statusLine: warn` (default) / `off`. The composer must support it.
- Q3 — Per-agent cost as an estimate. **Answered:** yes, tokens × the shared price table, always labelled *est.*; the session total uses Claude Code's `cost.usd` when reported.
- Q4 — Add to chat: insert or submit. **Answered:** insert only (`$.prompt.fill` append), like every action.
- Q5 — Folder mention. **Answered:** one `@folder/` mention, not expanded.
- Q6 — Command while a turn runs. **Answered:** allowed; `$.command.run` queues until idle and the button shows *queued*. (Plans still disables Next task while the feature is `waiting_on_user`; that rule belongs to `plans-tab`.)
- Q7 — Other worktrees. **Answered:** yes by default; `--all` already includes their branches, and the git layer can run in another worktree's directory.

The other approved defaults (swimlane view, DAG view, `gh` PR status, recording every gate question, `/factory decide`) concern only their tabs or the factory side and are carried by those features.

Answered by the user for this feature (record each as a decision `by: user`):
- Q8 — Until a tab's own feature is built, what does the panel show in its place? **Answered: A.** All six tab labels are shown in order. An unbuilt tab is dimmed and its body is one line ("Usage arrives with the usage-tab feature"). (Rejected: B, show only built tabs.)
- Q9 — Which surfaces must the panel support in v1? **Answered: A.** The terminal (dock and inline) is the tested target. On desktop and mobile the panel still draws and every action works through buttons, but it isn't tested there. (Rejected: B, terminal and desktop tested; C, all three surfaces tested.)
