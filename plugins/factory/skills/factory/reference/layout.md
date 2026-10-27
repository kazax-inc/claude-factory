# Layout — files, owners, ids, context packs, budgets

The canonical map of the factory's files. Read it when you brief an agent on files, plan a
fan-out, or meet a path or id you cannot place. Field-level formats are in
`../../../docs/data-model.md`; this file does not repeat them.

## Files and owners

Every file has exactly one writer. No two agents edit the same file at the same time.

```
.factory/                                 writer                  holds
  settings.json                           the user; orchestrator  project settings (the one JSON file; reference/settings.md)
  specs/<feature>/
    index.md          ENTRYPOINT          specs-writer            summary, areas, assumptions, open issues, how to read the spec
    brief.md                              orchestrator            the user's idea verbatim + intake answers
    repo-map.md                           repo-explorer           codebase brief, conventions, related features
    research/<topic>.md                   researcher              sourced findings for one question
    requirements/index.md                 requirements-analyst    story list, open questions, context, non-goals
    requirements/US-<n>.md                requirements-analyst    one story, its acceptance criteria, its edge cases
    spec/<area>.md                        specs-writer            one behavior area: SPEC items, errors, UI states, area-only terms
    spec/glossary.md                      specs-writer            terms used by two or more areas
    contracts/index.md                    api-contract-designer   interface catalogue
    contracts/rules.md                    api-contract-designer   rules every interface follows (CR-n)
    contracts/<slug>.md                   api-contract-designer   one interface
    adr/NNNN-<slug>.md                    architect               one decision: `## Decision` first, then context and options
  plans/
    STATE.md                              state-keeper            the active feature
    <feature>/
      STATE.md                            state-keeper            stage, status, task rows, waiting on user, next step
      plan.md         ENTRYPOINT          plan-writer             phases and one row per task
      conventions.md                      plan-writer             rules every task follows (CONV-n)
      tasks/<task id>.md                  plan-writer             one task: what it implements, scope, gates, done when
      test-strategy/index.md              test-strategist         frameworks, commands, infrastructure (INF-n), untested, hard to test
      test-strategy/<area>.md             test-strategist         test cases for one spec area (TC-<AREA>-n)
      routing/index.md                    model-router            setup-stage routing, accepted rules, escalations
      routing/phase-<n>.md                model-router            deviations from the settings' model and effort, per task and agent, for one plan phase
      decisions.md                        state-keeper            user and orchestrator decisions (D-n)
      reports/<run>/<file>.md             the reporting agent     one report per agent run (see Reports)
      probes/AS-<n>/                      test-writer             scratch code of one probe
      retro/phase-<n>.md                  retro-analyst           retrospective of one plan phase
      stats/                              generated               usage data; no agent writes it
```

The orchestrator writes `brief.md`, and `settings.json` only when the user asks for or approves a
change (settings.md). The repo's own code and tests are written by the build agents inside a
task's `scope` and `tests`; docs by docs-writer, in the paths its brief names.

**Indexes and Grep.** The two entrypoints (`.factory/specs/<f>/index.md`, `.factory/plans/<f>/plan.md`) and the
part indexes hold one-line catalogue rows in their frontmatter. Where an index would only copy
what fragments already declare, Grep their frontmatter instead:

| To list | Grep |
|---|---|
| ADRs and their status | `^(id\|title\|status\|summary):` in `.factory/specs/<f>/adr/` |
| SPEC items of the feature and what they cover | `- \{id: SPEC-` in `.factory/specs/<f>/spec/` |
| tasks that implement an item | the item id in `.factory/plans/<f>/tasks/` |
| test cases of an item | `spec: <item id>` in `.factory/plans/<f>/test-strategy/` |
| a run's verdicts | `^verdict:` in `.factory/plans/<f>/reports/<run>/` |
| features and what they do | Glob `.factory/specs/*/index.md`, read each `summary` |
| feature progress | Glob `.factory/plans/*/STATE.md`, read each frontmatter |

## Ids

| Id | Form | Example | Lives in |
|---|---|---|---|
| story | `US-<n>` | `US-3` | `requirements/US-3.md` |
| acceptance criterion | `AC-<story>.<n>` | `AC-3.2` | the story's file |
| open question | `Q<n>` | `Q4` | `requirements/index.md` |
| spec area | `<AREA>`: 2–10 capitals or digits | `GIT`, `NFR` | `spec/<area>.md` |
| spec item | `SPEC-<AREA>-<n>` | `SPEC-GIT-3` | `spec/git.md` |
| assumption | `AS-<n>` | `AS-2` | `.factory/specs/<f>/index.md` |
| interface | `C-<SLUG>`: capitals, digits, hyphens | `C-GIT-RUNNER` | `contracts/git-runner.md` |
| contract rule | `CR-<n>` | `CR-4` | `contracts/rules.md` |
| decision record | `ADR-<NNNN>` | `ADR-0007` | `adr/0007-<slug>.md` |
| task | `T<phase>.<n>`, split children add a letter | `T3.2`, `T3.2a` | `tasks/T3.2.md` |
| convention | `CONV-<n>` | `CONV-5` | `conventions.md` |
| test case | `TC-<AREA>-<n>` | `TC-GIT-1` | `test-strategy/git.md` |
| infrastructure item | `INF-<n>` | `INF-2` | `test-strategy/index.md` |
| decision | `D-<n>` | `D-12` | `decisions.md` |
| retro proposal | `P<n>` | `P2` | `retro/phase-<n>.md` (ids restart in each retro) |
| routing rule | `R<n>` | `R1` | `routing/index.md` |

Numbers are sequential and never reused: a removed item leaves a gap. Ids are unique within a
feature; another feature's id is written `<feature>:<id>` (`auth:SPEC-LOGIN-2`). Reserved area
codes: `NFR` (performance, accessibility, security constraints that cut across areas) and
`DATA` (the data model and stored state), each used only when needed.

### The id block

Agents that follow citations carry this block verbatim. Keep every copy identical to this one.

<!-- id-block:start -->
```
Ids resolve to files (<f> = the feature). Open a file only when you need what it says; find an id with Grep.
- US-n, AC-n.m → .factory/specs/<f>/requirements/US-n.md · Qn → .factory/specs/<f>/requirements/index.md
- SPEC-<AREA>-n → .factory/specs/<f>/spec/<area in lower case>.md · terms → .factory/specs/<f>/spec/glossary.md
- C-<SLUG> → .factory/specs/<f>/contracts/<slug in lower case>.md · CR-n → .factory/specs/<f>/contracts/rules.md
- ADR-NNNN → .factory/specs/<f>/adr/NNNN-*.md (read its frontmatter and `## Decision` only) · AS-n → .factory/specs/<f>/index.md
- T<p>.<n> → .factory/plans/<f>/tasks/<id>.md · CONV-n → .factory/plans/<f>/conventions.md · D-n → .factory/plans/<f>/decisions.md
- TC-<AREA>-n → .factory/plans/<f>/test-strategy/<area in lower case>.md · INF-n → .factory/plans/<f>/test-strategy/index.md
- <feature>:<id> → the same rule in that feature's folders
```
<!-- id-block:end -->

## Context packs

A build agent's reading list is derived from its task file; no file stores it. Given a task:

1. the task file `.factory/plans/<f>/tasks/<id>.md`;
2. `.factory/plans/<f>/conventions.md`;
3. the area file of every item in `implements` (whole file: it gives the surrounding behavior);
4. every `C-…` and `ADR-…` in those items' `refs` (contract file; ADR frontmatter and Decision),
   plus `contracts/rules.md` when any contract is named;
5. `.factory/plans/<f>/test-strategy/index.md` for the commands;
6. every id in the task's `reads_extra`.

| Agent | Pack |
|---|---|
| implementer, refactorer, migration-writer | 1–6 |
| test-writer | 1–6, plus the cases in `test-strategy/<area>.md` whose `spec` is in `implements` |
| debugger | the failing report, then 1–6 as the failure needs |
| gates | the diff, then 1–6; never a writer's report |
| docs-writer | 1, the diff, 3–4, the decisions in `decisions.md` that cite the task's items |
| commit-writer | 1, the file list in its brief |

`.factory/settings.json` belongs to the pack of every agent whose prompt names a settings key
(test-strategist, test-writer, code-reviewer, security-reviewer, e2e-tester, model-router,
retro-analyst); each reads only the keys its prompt names.

`spec/glossary.md` is read only when a term is unclear. An agent that needs a file outside its
pack may open it and names it as `PACK GAP: <path>` in its report, so the plan can be fixed.

Upstream agents (specs-writer, plan-writer, reviewers, model-router, retro-analyst) navigate from
the entrypoints and indexes, and their brief names the fragments of their pass.

## Reports

Every gate run, build-writer run and probe writes one report:

```
.factory/plans/<f>/reports/<run>/<agent>[-<batch>]-<round>.md
```

- `<run>` — the brief's `Task:` value: `specify`, `plan`, a task id, `phase-<n>-close`,
  `D-<n>` (every run of a change protocol, named after its decision), `split-<task id>` (the
  review of a split). Only gates and writers working on a task write under its id, so a task's
  folder holds that task's rounds and nothing else.
- `<batch>` — set when the same agent runs several times in one round: `b1`, `b2` for area
  batches, `p<n>` for a plan phase, `cross` and `changed` for those review passes, `AS-<n>` for
  a probe. Omitted otherwise.
- `<round>` — in a task, round 1 is the first writing and gating; each fix round adds one, and
  every agent in a round shares the number. In other runs, it counts that review loop.

The orchestrator computes the path, finds the next round number with a Glob of the folder, and
puts it on the brief's `Report:` line. Reports are never edited after they are written.

## Budgets

Targets that keep every fragment readable in one go. A fragment may exceed one only with a
`size_exception: "<reason>"` in its frontmatter; reviewers block unjustified excess.

| Fragment | Budget |
|---|---|
| task | production diff ≤ 250 lines (`size: S` ≤ 100, `M` ≤ 250; no larger size), tests ≤ 400 lines |
| task | ≤ 4 logic files in `scope` (wiring edits of ≤ ~20 lines per file do not count; mark the task `kind: wiring`) |
| task | ≤ 5 SPEC items (a wiring task may exceed this while its diff stays in budget), ≤ 6 done-when lines |
| task file | ≤ 60 lines; done-when lines cite SPEC and TC ids and never restate their text |
| plan phase | ≤ ~15 tasks |
| spec area | ≤ 300 lines, about 8 items |
| glossary | ≤ 120 lines |
| story | ≤ 80 lines |
| contract | ≤ 200 lines, one interface |
| ADR | frontmatter + `## Decision` ≤ 20 lines; the rest is free; an amendment is a new ADR |
| conventions | ≤ 100 lines; procedures go to INF items |
| test-strategy area | ≤ 200 lines |
| index bodies (spec, plan, requirements, contracts) | ≤ 150 lines |
| report | ≤ 60 lines; a phase-close audit lists failing rows only |

## Pass sizes

Writers work in sequential passes: a fresh agent per pass, ≤ 6 fragments each (areas for
specs-writer and test-strategist, one plan phase for plan-writer). The first pass (outline)
allocates every id and catalogue row; later passes write their own fragments, and may add
glossary terms (specs-writer) or adjust their own phase's rows in `plan.md` (plan-writer), never
renumbering an id. A feature small enough for one pass does everything in it.

Read-only reviewers and auditors run once over everything, cross checks included, when the spec
has 6 areas or fewer, or the plan 15 tasks or fewer. Above that they fan out as parallel batches
(≤ 6 areas, or one plan phase) plus one cross pass over frontmatter and the changed ids.
