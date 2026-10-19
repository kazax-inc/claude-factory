# Factory data format

Every file the pipeline writes is Markdown. The data meant for programs (dashboards, usage
tools, the orchestrator itself) lives in the file's **YAML frontmatter**: the block between a
first line `---` and the next `---` line. The body after it is for people.

- Agents write the frontmatter of the files they own. The plugin's hooks check it after every
  Write or Edit and hand the errors back to the agent, which fixes the file in the same run.
- The hooks write the usage stats under `.plan/<feature>/stats/`, with the same layout: data
  in the frontmatter, a short readable summary in the body.
- Nothing is JSON, and nothing needs an external runtime: the hooks are a TypeScript module
  that Claude Code runs itself (`hooks/register.ts`), on any operating system.

Every frontmatter has a `schema` field, `factory.<kind>/<version>`. Fields are only added
within a version, so readers ignore keys they do not know. Dates are `YYYY-MM-DD`;
timestamps are ISO 8601 UTC (`2026-10-19T09:16:24Z`).

## Reading it

Any YAML 1.2 parser reads these files (`yaml` for JavaScript, `ruamel.yaml` for Python,
`serde_yaml` for Rust, …). Split the file on its first two `---` lines and parse the part
between them. With a YAML 1.1 parser (PyYAML, `js-yaml`'s default schema), treat dates as
strings: hook-written timestamps are quoted, but agent-written dates are not.

The hooks use a subset they parse themselves: block mappings and lists by indentation (two
spaces), inline lists `[a, b]` and maps `{a: b}`, quoted and plain values, `|` / `>` block
text and `#` comments. No anchors, aliases, tags or multiple documents.

## Files and owners

| File | Schema | Written by |
|---|---|---|
| `.plan/STATE.md` | `factory.index/1` | `state-keeper` |
| `.plan/<feature>/STATE.md` | `factory.state/1` | `state-keeper` |
| `.plan/<feature>/plan.md` | `factory.plan/1` | `plan-writer` |
| `.plan/<feature>/routing.md` | `factory.routing/1` | `model-router` |
| `.plan/<feature>/test-strategy.md` | `factory.test-strategy/1` | `test-strategist` |
| `.plan/<feature>/retro-<phase>.md` | `factory.retro/1` | `retro-analyst` |
| `.specs/<feature>/brief.md` | `factory.brief/1` | orchestrator |
| `.specs/<feature>/requirements.md` | `factory.requirements/1` | `requirements-analyst` |
| `.specs/<feature>/spec.md` | `factory.spec/1` | `specs-writer`, `docs-writer` (status) |
| `.specs/<feature>/contracts.md` | `factory.contracts/1` | `api-contract-designer` |
| `.specs/<feature>/adr/NNNN-<slug>.md` | `factory.adr/1` | `architect`, `state-keeper` (decision) |
| `.plan/<feature>/stats/runs/<agent-id>.md` | `factory.run/1` | hooks |
| `.plan/<feature>/stats/tasks/<task>.md` | `factory.task-stats/1` | hooks |
| `.plan/<feature>/stats/orchestrator/<session-id>.md` | `factory.orchestrator/1` | hooks |

Whether to commit `stats/` is your choice; it holds no paths or secrets, only ids and numbers.

## Pipeline files

### `.plan/STATE.md` — `factory.index/1`

```yaml
schema: factory.index/1
active: usage-panel
features:
  - feature: usage-panel
    mode: existing          # greenfield | existing
    phase: 4                # pipeline phase, as in the feature's STATE
    until: build            # requirements | spec | plan | build
    status: active          # active | waiting_on_user | paused | done
    updated: 2026-10-19
```

### `.plan/<feature>/STATE.md` — `factory.state/1`

```yaml
schema: factory.state/1
feature: usage-panel
mode: existing
until: build
status: active
phase: 4
spec: approved              # none | draft | reviewed | approved
updated: 2026-10-19
tasks:
  - id: T1.1
    title: Usage store
    status: done            # todo | in_progress | review | done | blocked
    gates: {test-runner: PASS, code-reviewer: PASS}
    loops: 1
waiting_on_user:
  - text: Pick the chart library
    kind: adr               # requirement | gate | adr | blocker
    ref: ADR-0003           # optional: Q-id or ADR id
    task: T1.4              # optional
    since: 2026-10-18
decisions:
  - date: 2026-10-18
    text: Storage → option A
    by: user                # user | ADR-NNNN
    ref: ADR-0002           # optional: the question or ADR it answers
next: [T1.2 implement]
```

`phase` is the pipeline phase: `0` Intake, `1` Discover, `2` Specify, `3` Plan, `4` Build,
`5` Verify code, `6` Verify UI, `7` Close. Its **stage** is `intake`, `discover`, `specify`,
`plan` for 0–3 and `build` for 4–7; a feature with `status: done` is at stage `done`.

A plan task that is not yet in `tasks` is `todo`. A question is pending while it is in
`waiting_on_user`; once answered it leaves that list and a decision with the same `ref` is
added.

### `.plan/<feature>/plan.md` — `factory.plan/1`

```yaml
schema: factory.plan/1
feature: usage-panel
spec: .specs/usage-panel/spec.md
phases:
  - id: 1
    name: Core
    tasks:
      - id: T1.1
        title: Usage store
        type: feature       # feature | test | refactor | migration | ui | docs
        ui: false
        depends_on: []
        parallel_with: [T1.2]
        implements: [SPEC-1, SPEC-2]
        scope: [src/usage/store.ts]
```

Task ids are `T<phase id>.<n>`. Each task also has a `### <id> <title>` section in the body
with its done criteria and notes.

### `.plan/<feature>/routing.md` — `factory.routing/1`

```yaml
schema: factory.routing/1
feature: usage-panel
updated: 2026-10-19
overrides:
  - {agent: specs-writer, model: opus, effort: high, reason: cross-module behaviour}
tasks:
  - {task: T1.1, agent: implementer, model: opus, effort: medium, reason: new plugin API surface}
escalations:
  - date: 2026-10-19
    task: T2.3
    agent: implementer
    from: sonnet/medium
    to: opus/medium
    cause: capability       # capability | rushed
    reason: circled on transform order
```

### `.plan/<feature>/test-strategy.md` — `factory.test-strategy/1`

```yaml
schema: factory.test-strategy/1
feature: usage-panel
cases:
  - {spec: SPEC-1, level: unit, test: store keeps the last reading per window, task: T1.1}
hard_to_test: [SPEC-9]
```

`level`: `unit | property | integration | e2e | visual`.

### `.plan/<feature>/retro-<phase>.md` — `factory.retro/1`

```yaml
schema: factory.retro/1
feature: usage-panel
phase: 1
tasks: 4
loops: 3
escalations: 1
gate_failures: {code-reviewer: 2, test-runner: 1}
```

### `.specs/<feature>/brief.md` — `factory.brief/1`

```yaml
schema: factory.brief/1
feature: usage-panel
source: inline              # inline | path of the brief file
date: 2026-10-19
```

### `.specs/<feature>/requirements.md` — `factory.requirements/1`

```yaml
schema: factory.requirements/1
feature: usage-panel
stories: [US-1, US-2]
criteria: [AC-1.1, AC-1.2, AC-2.1]
open_questions:
  - {id: Q1, text: Show cost on subscription plans?, affects: [US-2]}
```

### `.specs/<feature>/spec.md` — `factory.spec/1`

```yaml
schema: factory.spec/1
feature: usage-panel
status: approved            # draft | reviewed | approved
items:
  - {id: SPEC-1, covers: [AC-1.1, AC-1.2]}
open_issues: []
```

### `.specs/<feature>/contracts.md` — `factory.contracts/1`

```yaml
schema: factory.contracts/1
feature: usage-panel
interfaces:
  - {name: UsageStore, kind: module-api, breaking: false}
```

`kind`: `module-api | plugin-api | ipc-command | event | data-schema`.

### `.specs/<feature>/adr/NNNN-<slug>.md` — `factory.adr/1`

```yaml
schema: factory.adr/1
id: ADR-0003                # ADR- plus the file's number
feature: usage-panel
title: Chart library
status: proposed            # proposed | accepted | rejected | superseded
impact: major               # minor | major
options:
  - {id: A, title: Hand-drawn gauges (no dependency)}
  - {id: B, title: ink-chart}
recommendation: A
chosen: null                # option id once decided
decided: null               # date once decided
```

## Computing progress

Nothing writes progress totals; readers derive them from STATE.md and plan.md:

- **Task status**: `tasks[].status` in STATE.md, `todo` for plan tasks not listed there.
- **Counts**: the number of tasks per status, and `percent = 100 × done / total`.
- **Phase status**: `done` when every task is done, `todo` when none has left `todo`,
  otherwise `in_progress`. Check the blocked count for blocked work.
- **Ready tasks**: `todo` tasks whose `depends_on` are all `done`.
- **Stage status**: stages before the feature's stage are `done`, its stage `in_progress`, the
  rest `todo`.
- **Times**: each task's and setup stage's `started_at` / `done_at` are in its stats file
  (below). A phase starts with its first task and ends with its last; the `build` stage spans
  the plan's tasks.

## Usage stats

The hooks sum the model requests Claude Code reports for each subagent the orchestrator
spawns, attributed by the `Feature:`, `Phase:` and `Task:` lines that open the subagent's
brief. A spawn whose `Feature:` names no existing `.plan/<feature>/` or `.specs/<feature>/`
is ignored. Task ids:

| Task id | Phase | Covers |
|---|---|---|
| `T<n>.<m>` | plan phase id (from plan.md) | the task and all its gates, fixes, escalations and close steps |
| `phase-<n>-close` | `<n>` | phase-level work (retro, phase-end audit or e2e run) |
| `intake`, `discover`, `specify`, `plan` | `setup` | pipeline work before the build |
| `unassigned` | `null` | brief had a feature but no task |

So usage rolls up **plan** (feature) → **phase** (`setup`, `0`, `1`, …) → **task**. Plan- and
phase-level totals are sums of task files. Orchestrator files are plan-level overhead, not
split per task.

### Metrics

Run, task and orchestrator files share these fields:

```yaml
duration_ms: 270607
requests: 26
tool_calls: 69
tokens: {input: 52, output: 21104, cache_read: 2220137, cache_write: 102530, total: 2343823}
cache_hit_rate: 0.9558
context: {peak_tokens: 120653, window: 1000000, peak_pct: 0.1207}
by_model:
  claude-opus-5-5:
    requests: 26
    tokens: {input: 52, output: 21104, cache_read: 2220137, cache_write: 102530, total: 2343823}
```

- `duration_ms` — the run's turns, as Claude Code timed them. On task files it is `agent_ms`
  (the sum over runs; parallel runs overlap).
- `requests` — model requests that returned usage. `tool_calls` — tool calls they asked for.
- `tokens` — exact counts as the API reported them. `input` is uncached input,
  `cache_write` cache-creation input, `total` the sum of the four.
- `cache_hit_rate` — `cache_read / (input + cache_read + cache_write)`; `null` with no requests.
- `context.peak_tokens` — the largest prompt sent in one request (input + cache read + cache
  write): how full the context window got. `peak_pct = peak_tokens / window`. On aggregates,
  the run with the highest peak wins.

### `stats/runs/<agent-id>.md` — `factory.run/1`

```yaml
schema: factory.run/1
run_id: a111
session_id: abc
feature: usage-panel
phase: "1"
task: T1.1
agent: implementer          # without the plugin's `factory:` prefix
description: T1.1 implement
effort: medium              # null when the model has no effort setting
models: [claude-opus-5-5]
started_at: "2026-10-19T09:16:24Z"
ended_at: "2026-10-19T09:20:55Z"
turns: 1                    # more than 1 when the agent was resumed
# + the metrics
```

### `stats/tasks/<task>.md` — `factory.task-stats/1`

```yaml
schema: factory.task-stats/1
feature: usage-panel
phase: "1"
task: T1.1
title: Usage store
status: done
started_at: "2026-10-19T09:16:24Z"
done_at: "2026-10-19T09:47:07Z"
updated_at: "2026-10-19T09:47:07Z"
wall_ms: 1843000
agent_ms: 270607
runs: 6
# + the metrics, duration_ms replaced by agent_ms
by_agent:
  implementer: {runs: 2, duration_ms: 412000, requests: 41, tokens: {…}, cache_hit_rate: 0.95, context: {…}}
run_ids: [a111, …]
```

- One file per plan task and per setup stage (`intake`, `discover`, `specify`, `plan`), written
  once it has a run or leaves `todo`.
- `started_at` / `done_at` are **observed**: stamped when the hook first sees the status leave
  `todo` or reach `done` (or at the first run, if earlier). Reopening a task clears `done_at`.
- `wall_ms` — from the earliest of (status start, first run) to the latest of (done, last run
  end).
- The file name is the task id with characters outside `[A-Za-z0-9._-]` replaced by `_`.
- It is rewritten after each run of the task, including bookkeeping runs after `done`: read
  `status` and `updated_at`, not just whether the file exists.

### `stats/orchestrator/<session-id>.md` — `factory.orchestrator/1`

The main session's own requests from its first `/factory` on, added at the end of each turn to
the feature that is `active` at that moment. The metrics, plus `session_id`, `feature`, `turns`,
`started_at`, `ended_at` and `updated_at`.

## Limits

- Usage is recorded while the plugin is loaded. Runs that happened without it are not
  counted, and cannot be rebuilt later.
- If the plugin reloads while a subagent is running, the requests of that turn made before the
  reload are lost; later turns of the same agent continue its file.
- `/factory-check` checks every pipeline file and rewrites every task's stats from the run
  files; it does not create runs.
