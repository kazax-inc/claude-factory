# Factory data model (v2)

Every factory file is Markdown, except the project's settings (`.factory/settings.json`, last
section). The data meant for programs lives in its YAML frontmatter, between the two `---` lines
at the top; the body is for people and agents. This document is the
reference for scripts and dashboards that read the files, and for the agents' templates, which
must match it. Paths, owners, ids and budgets are defined once in
[`skills/factory/reference/layout.md`](../skills/factory/reference/layout.md).

All Markdown schemas are version 2 (`factory.<name>/2`). Every Markdown file carries `schema`
and, except the feature index, `feature` (the feature folder's name).

## Format rules

- Frontmatter is the first block of the file, opened and closed by a `---` line.
- Only the documented keys. Unknown keys are an error for reviewers.
- Catalogue rows are one-line flow mappings, one row per line under their key:
  `- {id: SPEC-GIT-1, title: "Runs git read-only", covers: [AC-8.1]}`. Never put several rows on
  one line (`tasks: [{…}, {…}]`): line-oriented tools and diffs depend on one row per line.
- Every free-text value is double-quoted (titles, text, reasons, summaries, test names). Inside
  it, `"` is written `\"`. Ids, enum values, numbers, booleans, dates and `null` are bare.
- Lists are `[a, b]`, `[]` when empty; maps are `{k: v}`, `{}` when empty.
- Two spaces per indent level, never tabs. Dates are `YYYY-MM-DD`.
- No hook validates the files. Writers re-read their frontmatter before returning; reviewers
  treat malformed frontmatter as blocking.

Types used below: **id** (an id of the form in layout.md, bare), **text** (quoted string),
**enum** (one of the listed bare words), **int**, **bool**, **date**, **path** (repo-relative,
quoted), **list<…>**, **map<…>**. `?` marks an optional key; optional keys may be omitted or `null`.

## .factory/specs/<feature>/

### index.md — `factory.spec/2` (entrypoint)

```yaml
schema: factory.spec/2
feature: <feature>
summary: "One line: what the feature does for whom."
areas:
  - {code: GIT, title: "Read-only git layer", scope: "Running git, parsing its output, refusing writes."}
assumptions:
  - {id: AS-1, text: "git 2.30+ prints porcelain v2 for status", blocking: true}
open_issues: []
```

| key | type | notes |
|---|---|---|
| summary | text | read by agents of other features to find related specs |
| areas | `list<{code: id, title: text, scope: text}>` | one row per `spec/<area>.md`, in reading order |
| assumptions | `list<{id, text, blocking: bool}>` | facts about external systems the spec relies on; `blocking` when an area depends on it before planning |
| open_issues | `list<text>` | unresolved points; must be empty before approval |

Body: `## Summary`, `## Scope`, `## Non-goals`, `## How to read this spec` (the id block with the
feature's name). The spec's approval status is not here; it is `spec` in the feature's STATE.

### spec/<area>.md — `factory.spec-area/2`

```yaml
schema: factory.spec-area/2
feature: <feature>
area: GIT
items:
  - {id: SPEC-GIT-1, title: "Runs git without writing", covers: [AC-8.1, AC-8.2], refs: [C-GIT-RUNNER, ADR-0002]}
```

| key | type | notes |
|---|---|---|
| area | id | equals the file name in capitals |
| items | `list<{id, title: text, covers: list<id>, refs: list<id>}>` | `covers`: AC ids (an `NFR`/`DATA` item may cover none); `refs`: interfaces, ADRs, other SPEC items the item depends on |

Body: `# <AREA> — <title>`, `## Terms` (terms used only here), then sections (`## Behavior`,
`## Errors & edge cases`, `## UI states`) holding one `### SPEC-<AREA>-<n> — <title>` block per
item. Every item in `items` has a block and every block an item.

### spec/glossary.md — `factory.glossary/2`

```yaml
schema: factory.glossary/2
feature: <feature>
terms: ["pane", "tab registry"]
```

Body: `- **<term>** — <definition>` per term, in the order of `terms`.

### requirements/index.md — `factory.requirements/2`

```yaml
schema: factory.requirements/2
feature: <feature>
stories:
  - {id: US-1, title: "See the current branch"}
open_questions:
  - {id: Q1, text: "Should detached HEAD show a sha or a tag?", affects: [US-1]}
```

| key | type | notes |
|---|---|---|
| stories | `list<{id, title: text}>` | one row per `requirements/US-<n>.md` |
| open_questions | `list<{id, text, affects: list<id>}>` | stays as written; answers are D-n decisions with `ref: Q<n>` |

Body: `## Context`, `## Non-goals`, `## Assumptions`, `## Cross-story edge cases`, `## Open questions`.

### requirements/US-<n>.md — `factory.story/2`

```yaml
schema: factory.story/2
feature: <feature>
id: US-1
criteria: [AC-1.1, AC-1.2]
```

Body: `# US-1 — <title>`, the story sentence, `## Acceptance criteria` (`- AC-1.1 Given … When … Then …`),
`## Edge cases`.

### contracts/index.md — `factory.contracts/2`

```yaml
schema: factory.contracts/2
feature: <feature>
interfaces:
  - {id: C-GIT-RUNNER, name: "Git runner", kind: module-api, module: "src/git/runner.ts", breaking: false}
```

| key | type | notes |
|---|---|---|
| interfaces | `list<{id, name: text, kind: enum, module: path, breaking: bool}>` | `kind`: `module-api \| plugin-api \| ipc-command \| event \| data-schema \| cli \| http-api`; `breaking` when it changes an existing public contract |

### contracts/rules.md — `factory.contract-rules/2`

```yaml
schema: factory.contract-rules/2
feature: <feature>
rules: [CR-1, CR-2]
```

Body: `- CR-<n> — <rule>` per rule.

### contracts/<slug>.md — `factory.contract/2`

```yaml
schema: factory.contract/2
feature: <feature>
id: C-GIT-RUNNER
```

Body: `# C-GIT-RUNNER — <name>`, the signature block in the repo's language, `Errors`,
`Invariants`, `Side effects`, `Compatibility`. Name, kind and module are in the index row only.

### adr/NNNN-<slug>.md — `factory.adr/2`

```yaml
schema: factory.adr/2
feature: <feature>
id: ADR-0002
title: "Run git as a child process"
impact: major
status: proposed
options:
  - {id: A, title: "Child process per call"}
  - {id: B, title: "Bundled git library"}
recommendation: A
chosen: null
decided: null
summary: null
amends: null
amended_by: []
superseded_by: null
```

| key | type | notes |
|---|---|---|
| impact | enum | `minor` (internal, reversible; decided by the architect) or `major` (decided by the user) |
| status | enum | `proposed \| accepted \| rejected \| superseded` |
| options | `list<{id, title: text}>` | |
| recommendation, chosen | `id?` | an option id |
| decided | `date?` | |
| summary | `text?` | the binding outcome in one line, set when accepted |
| amends | `id?` | the ADR this one amends |
| amended_by | `list<id>` | ADRs that amend this one |
| superseded_by | `id?` | |

Body: `# ADR-NNNN — <title>`, `## Decision` (first; `Pending` until accepted, then the binding
outcome in ≤ 20 lines), `## Context`, `## Options` (`### A — <title>` each opening with an
`Outcome:` paragraph), `## Recommendation`, `## Consequences`.

### brief.md — `factory.brief/2`

```yaml
schema: factory.brief/2
feature: <feature>
source: inline
date: 2026-01-31
```

`source`: `inline` or the path of the brief file. Body: `## Idea (verbatim)`, `## Intake answers`
(the first answer is `Exposure: <security.exposure>`, copied from the settings at intake).

### repo-map.md — `factory.repo-map/2`

```yaml
schema: factory.repo-map/2
feature: <feature>
mode: existing
related: [auth]
```

`mode`: `existing | greenfield`; `related`: other features whose specs touch the same code.
Body: `## Relevant files`, `## Key symbols`, `## Conventions`, `## Reuse and collision risks`,
`## Related features`, `## Unknowns`.

### research/<topic>.md — `factory.research/2`

```yaml
schema: factory.research/2
feature: <feature>
question: "Which porcelain format is stable across git 2.30–2.45?"
date: 2026-01-31
```

Body: `## Answer`, `## Options`, `## Details` (facts with source links), `## Caveats`.

## .factory/plans/

### STATE.md — `factory.index/2`

```yaml
schema: factory.index/2
active: git-panel
```

The active feature. Feature progress is in each `.factory/plans/<feature>/STATE.md`.

### <feature>/STATE.md — `factory.state/2`

```yaml
schema: factory.state/2
feature: <feature>
mode: existing
until: plan
status: active
stage: build
spec: approved
plan_phase: 1
phase_base: "3f2a91c"
updated: 2026-01-31
tasks:
  - {id: T1.1, status: done, loops: 1, user_rounds: 0}
  - {id: T1.2, status: in_progress, loops: 0, user_rounds: 0}
waiting_on_user:
  - {text: "Pick the storage option of ADR-0003", kind: adr, ref: ADR-0003, task: null, since: 2026-01-30}
next: ["Run T1.2 round 2: implementer fixes the code-reviewer report"]
```

| key | type | notes |
|---|---|---|
| mode | enum | `existing \| greenfield` |
| until | id | target of the last command, bare: a stage, `phase-<n>` or a task id |
| status | enum | `active \| waiting_on_user \| paused \| done` |
| stage | enum | `intake \| discover \| specify \| plan \| build \| done` |
| spec | enum | `none \| draft \| reviewed \| approved` |
| plan_phase | `id?` | the plan phase being built |
| phase_base | `text?` | commit at the start of `plan_phase`, quoted (a sha may be all digits); the phase-close audit diffs from it |
| tasks | `list<{id, status: enum, loops: int, user_rounds: int}>` | one row per plan task, same ids as `plan.md`; `status`: `todo \| in_progress \| done \| blocked \| split \| dropped`; `loops`: rounds with a gate FAIL; `user_rounds`: extra rounds the user ordered (scope or docs changes) |
| waiting_on_user | `list<{text, kind: enum, ref: id?, task: id?, since: date}>` | `kind`: `requirement \| adr \| approval \| gate \| blocker \| retro` |
| next | `list<text>` | the single next step |

Body: `# STATE — <feature>` and links to the two entrypoints. No log: events are in reports,
`decisions.md` and git history.

### <feature>/plan.md — `factory.plan/2` (entrypoint)

```yaml
schema: factory.plan/2
feature: <feature>
phases:
  - {id: 1, name: "Core", goal: "Branch and status visible through the real entry"}
tasks:
  - {id: T1.1, title: "Probe porcelain v2 output", type: probe, size: S, deps: []}
  - {id: T1.2, title: "Git runner", type: feature, size: M, deps: [T1.1], parallel_with: [T1.3]}
  - {id: T1.3, title: "Status parser", type: feature, size: M, deps: [T1.1], split_into: [T1.3a, T1.3b]}
```

| key | type | notes |
|---|---|---|
| phases | `list<{id, name: text, goal: text}>` | `0` is the greenfield foundation phase |
| tasks | `list<{id, title: text, type: enum, size: enum, deps: list<id>, parallel_with?: list<id>, split_into?: list<id>}>` | `type`: `feature \| test \| refactor \| migration \| docs \| probe`; `size`: `S \| M`; `parallel_with` names tasks of the same phase with disjoint files; a row with `split_into` is replaced by its children |

Task ids are `T<phase>.<n>`, split children `T<phase>.<n><letter>`. Body: `# <Feature> — plan`,
`## Phases` (a short paragraph per phase), `## Critical path`, `## Risks`, `## Out of plan`.

### <feature>/conventions.md — `factory.conventions/2`

```yaml
schema: factory.conventions/2
feature: <feature>
rules: [CONV-1, CONV-2]
```

Body: `- CONV-<n> — <rule> (ADR-NNNN)` per rule, citing the ADR it comes from when there is one.

### <feature>/tasks/<task id>.md — `factory.task/2`

```yaml
schema: factory.task/2
feature: <feature>
id: T1.2
implements: [SPEC-GIT-1, SPEC-GIT-2]
scope: ["src/git/runner.ts"]
tests: ["src/git/runner.test.ts"]
reads_extra: [INF-1]
gates: [test-runner, code-reviewer, security-reviewer]
docs: false
kind: logic
pending_probe: []
verifies: []
fixes: []
superseded_by: []
```

| key | type | notes |
|---|---|---|
| implements | `list<id>` | SPEC items the task makes true |
| scope | `list<path>` | production files the task may touch (directories end with `/`) |
| tests | `list<path>` | test files and fixtures the task may touch |
| reads_extra | `list<id or path>` | needs beyond the derived context pack |
| gates | `list<agent>` | gate agents for this task, test-runner first |
| docs | bool | run docs-writer at close |
| kind | enum | `logic \| wiring \| mechanical` |
| pending_probe | `list<id>` | assumptions (AS-n) whose probe this task waits on |
| verifies | `list<id>` | the assumptions (AS-n) a `probe` task verifies |
| fixes | `list<id>` | the done tasks whose code this fix task corrects; non-empty marks a fix task |
| superseded_by | `list<id>` | set on a split parent; the file is then a stub |
| size_exception | `text?` | why the task exceeds a budget |

Body: `# T1.2 — <title>`, `## Goal`, `## Steps` (optional, ≤ 8), `## Done when` (cites SPEC and
TC ids), `## Notes` (code pointers, CONV ids), `## Rollback` (migrations and destructive steps).
The row in `plan.md` is authoritative for title, type, size and deps.

### <feature>/test-strategy/index.md — `factory.test-strategy/2`

```yaml
schema: factory.test-strategy/2
feature: <feature>
frameworks: ["vitest"]
commands:
  build: "npm run build"
  format: "npm run format:check"
  lint: "npm run lint"
  typecheck: "npx tsc --noEmit"
  test: "npm test"
  test_one: "npx vitest run <file>"
  real_entry: "node dist/cli.js status --json"
infra:
  - {id: INF-1, text: "Temporary git repo fixture with a detached HEAD"}
untested:
  - {id: SPEC-GIT-7, reason: "Only an e2e run proves it; tests.levels.e2e is off"}
hard_to_test: [SPEC-GIT-4]
```

| key | type | notes |
|---|---|---|
| commands | `map<text>` | keys `build`, `format`, `lint`, `typecheck`, `test`, `test_one`, `real_entry`; omit what the project lacks; `real_entry` loads the code through the real entry point |
| infra | `list<{id, text}>` | fixtures, mocks, harnesses the plan must build first |
| untested | `list<{id, reason: text}>` | items the settings (`tests.levels`, `tests.depth`) leave without a case; reviewers and auditors accept them |
| hard_to_test | `list<id>` | items that are hard to test (often a vague spec) |

Body: `## Layout`, `## Infrastructure` (`### INF-<n>` procedures when one line is not enough).

### <feature>/test-strategy/<area>.md — `factory.test-cases/2`

```yaml
schema: factory.test-cases/2
feature: <feature>
area: GIT
cases:
  - {id: TC-GIT-1, spec: SPEC-GIT-1, level: unit, test: "runner refuses commands that write"}
```

`level`: `unit | property | integration | e2e | visual`. Body: `## Notes`, discriminating inputs
per case only when the test name is not enough.

### <feature>/routing/index.md — `factory.routing/2`

```yaml
schema: factory.routing/2
feature: <feature>
updated: 2026-01-31
setup:
  - {agent: specs-writer, model: opus, effort: high, reason: "Four areas with concurrency rules"}
rules:
  - {id: R1, text: "Parser tasks with a denylist start the implementer at opus/high", since: 2026-01-31}
escalations:
  - {date: 2026-01-31, task: T1.2, agent: implementer, from: sonnet/medium, to: opus/medium, cause: capability, reason: "Circled on quoting"}
```

`effort`: `low | medium | high | xhigh | max`; `cause`: `capability | rushed | scope | upstream`.

### <feature>/routing/phase-<n>.md — `factory.routing-phase/2`

```yaml
schema: factory.routing-phase/2
feature: <feature>
phase: 1
updated: 2026-01-31
tasks:
  - {task: T1.2, agent: implementer, model: opus, effort: medium, reason: "New parsing state machine"}
```

Rows are deviations from the agents' defaults. Lookup for a spawn: the phase file's (task,
agent) row, else the agent's `setup` row in `routing/index.md`, else `agents.<agent>` in
`.factory/settings.json`, else the agent's own frontmatter.

### <feature>/decisions.md — `factory.decisions/2`

```yaml
schema: factory.decisions/2
feature: <feature>
decisions:
  - {id: D-1, date: 2026-01-30, by: user, text: "Detached HEAD shows the short sha", ref: Q1, affects: [US-1], status: active}
```

| key | type | notes |
|---|---|---|
| by | enum | `user \| orchestrator` |
| ref | `id?` | what it answers: `Q<n>`, `AS-<n>`, `ADR-<NNNN>`, a task id |
| affects | `list<id>` | ids it changes, filled from the change protocol's CHANGED list when known |
| status | enum | `active \| superseded` |
| superseded_by | `id?` | |

ADR choices are recorded in the ADR itself, not here.

### <feature>/reports/<run>/<file>.md — `factory.report/2`

```yaml
schema: factory.report/2
feature: <feature>
run: T1.2
agent: code-reviewer
round: 2
verdict: FAIL
blocking: {impl: 2, tests: 1}
date: 2026-01-31
```

| key | type | notes |
|---|---|---|
| run | id | `specify`, `plan`, a task id, `phase-<n>-close`, `D-<n>` (a change protocol) or `split-<task id>` |
| round | int | see Reports in layout.md |
| verdict | enum | gates: `PASS \| FAIL`; writers and probes: `DONE \| BLOCKED \| TOO_LARGE` |
| blocking | `map<int>?` | gates only; count per owner, non-zero only: `impl \| tests \| spec \| contract \| plan \| env` |

Gate body: `## Blocking` (`- [<owner>] [<file:line or id>] issue — why it matters — expected fix`),
`## Non-blocking`, `## Questions for the user`. Writer body: `## Changed files`, `## Tests`,
`## Deviations`, `## Extra surface`, `## Findings`, `## Split proposal`, `## Questions for the user`.

### <feature>/retro/phase-<n>.md — `factory.retro/2`

```yaml
schema: factory.retro/2
feature: <feature>
phase: 1
tasks: 5
rounds: 9
fails: {code-reviewer: 2, test-runner: 1}
escalations: 1
splits: 0
proposals:
  - {id: P1, kind: routing, text: "Start parser test-writers on opus"}
  - {id: P2, kind: plan, text: "Add a real-entry smoke line to every phase-2 wiring task"}
  - {id: P3, kind: plugin, text: "agents/test-writer.md: require a mutation check for cut boundaries"}
  - {id: P4, kind: settings, text: "agents.implementer: sonnet/medium → opus/medium"}
```

`kind`: `routing` (applied by model-router), `settings` (a change to `.factory/settings.json`,
written by the orchestrator once the user accepts it), `plan` (applied by plan-writer to later
phases), `plugin` (an edit to the factory plugin, for its maintainer).

## Computed values

Everything below comes from frontmatter alone.

- **Task set** — rows of `plan.md` `tasks` without `split_into`. Totals and percentages use it.
- **Progress** — STATE `tasks` rows with `status: done` over the task set; per phase by the id prefix.
- **Ready tasks** — in the task set, in phase `plan_phase`, STATE status `todo`, every dep `done`
  (a dep on a split task means all its children).
- **Parallel batch** — ready tasks linked by `parallel_with`.
- **Spec coverage** — SPEC ids from the area files' `items` versus the union of the task files'
  `implements`; done coverage uses only tasks with status `done`.
- **Test coverage** — SPEC ids with at least one `cases[].spec` in `test-strategy/`; the
  `untested` ids are counted apart.
- **Gate history** — report frontmatter under `reports/<task>/`: `verdict` per agent and round.
- **Loops** — STATE `loops`; FAILs per gate from the reports.
- **Stage strip** — STATE `stage` in the order `intake → discover → specify → plan → build → done`.
- **Routing per task** — `routing/phase-<n>.md` rows, with the lookup order above (it needs
  `.factory/settings.json` and the agents' frontmatter for the runs without a row).

## .factory/settings.json — `factory.settings/1`

The project's settings: the one JSON file of the factory. It belongs to the user, who edits it
at will; the orchestrator writes it only when the user asks for or approves a change, and checks
it at the start of every `/factory` run (rules in
[`reference/settings.md`](../skills/factory/reference/settings.md)). It has no `feature` key.
`/factory setup` writes it from [`templates/settings.json`](../skills/factory/templates/settings.json);
editors check it against [`schema/settings-1.json`](schema/settings-1.json). A missing key takes
the template's value, which reproduces the factory's behavior without settings.

| key | type | default | notes |
|---|---|---|---|
| `$schema` | text | the schema URL | for editors |
| schema | `factory.settings/1` | — | required |
| agents | `map<agent, {model, effort}>` | the agents' frontmatter | `model`: `haiku \| sonnet \| opus`; `effort`: `low \| medium \| high \| xhigh \| max`; routing files hold only deviations from it |
| routing.mode | enum | `auto` | `auto \| defaults`; `defaults`: model-router runs only for escalations |
| workflow.until | enum | `plan` | default target of `/factory new`: `discover \| specify \| plan \| build` |
| workflow.pacing | enum | `phase` | where a build run pauses without a flag: `task \| phase \| all` |
| workflow.parallel_tasks | bool | `true` | run `parallel_with` tasks together |
| workflow.gate_order | enum | `parallel` | `parallel \| sequential` (one gate at a time, the round ends at the first FAIL) |
| workflow.docs | bool | `true` | docs-writer at the close of `docs: true` tasks |
| workflow.retro | bool | `true` | retro-analyst at phase close |
| failures.escalate_after | int | `2` | 1–9, below `ask_after`: same-gate FAILs before escalation |
| failures.ask_after | int | `3` | 2–10: same-gate FAILs, or review rounds, before asking the user |
| failures.debugger | bool | `true` | escalation may route the debugger |
| failures.environment | enum | `fix-trivial` | `fix-trivial \| ask`: handling of `env` findings |
| security.exposure | enum | `public` | `private \| internal \| public`; weighs security findings, copied into `brief.md` |
| security.checks | `map<bool>` | all `true` | `untrusted_input`, `injection`, `privilege`, `filesystem`, `secrets`, `memory_safety`, `denial_of_service`, `dependencies` |
| tests.depth | enum | `standard` | `minimal \| standard \| thorough` |
| tests.levels | `map<bool>` | all `true` | `unit`, `property`, `integration`, `e2e`, `visual`; at least one `true` |
| gates | `map<agent, enum>` | all `auto` | `off \| auto \| always` for `security-reviewer`, `dependency-auditor`, `perf-reviewer`, `ui-reviewer`, `ux-reviewer`, `a11y-reviewer`, `spec-auditor` (the task gate; the phase-close audit always runs) |
| project.commands | `map<text>` | `{}` | `build`, `format`, `lint`, `typecheck`, `test`, `test_one`; test-strategist uses them as given |

A task's effective gates: its `gates` list, minus the gates set to `off`, plus the gates set to
`always` when its `scope` is not empty.
