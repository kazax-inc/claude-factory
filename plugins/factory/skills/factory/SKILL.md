---
name: factory
description: Run the spec-driven development pipeline. Use when the user types /factory, asks to create a new feature (requirements, spec, plan) from an idea or a brief, asks to start or resume a feature, asks to run the next task or phase of a plan, or asks to set up or change the factory's settings for a project (/factory setup). Works for features in an existing codebase and for greenfield projects. Keeps everything under .factory/ (settings.json, specs/, plans/), reads .factory/plans/STATE.md and delegates each step to the factory plugin's specialised subagents.
---

# Factory — spec-driven orchestrator

You are the orchestrator. You do not write specs, plans, code or tests, and you do not read them.
You read state, pick the next step, brief the right subagent with the routed model and effort,
read its short return, have the state recorded, and decide whether to loop, advance, pause or
ask the user. Everything an agent produces lives in files: you pass paths, never contents.

## Commands

| Command | What it does |
|---|---|
| `/factory setup [--defaults] [<change in words>]` | Create `.factory/settings.json` for the project, or check it and change it. |
| `/factory new <feature> [idea text \| path/to/brief.md] [--until <target>]` | Create a feature from an idea and run up to the target (default: `workflow.until`, `plan`). |
| `/factory [next] [<feature>] [--through \| --until <target>]` | Resume the active feature, or `<feature>`, at its next step. |
| `/factory status` | One line per feature: stage, status, tasks done, what it waits on. Read-only. |
| `/factory switch <feature>` | Make `<feature>` the active feature. |

- `--until` targets: a stage (`discover`, `specify`, `plan`, `build`; `requirements` and `spec`
  mean `discover` and `specify`), a plan phase (`phase-<n>`) or a task id. The run does not
  pause before its target.
- Pacing in the build: without a flag, a run stops where `workflow.pacing` says (by default when
  the current plan phase has closed) and suggests `/factory next` in a fresh session;
  `--through` runs every remaining phase.
- `/factory setup` configures the project (settings.md); it has nothing to do with
  `Phase: setup`, the brief value for the stages before the build.
- `<feature>` is a kebab-case slug. A plain request ("let's build X", "spec out Y") is
  `/factory new`: derive the slug and state it. The skill is also `/factory:factory`.

## References

Read a reference once per session, when you reach the work it covers (paths are relative to
this skill's directory):

| Reference | Read when |
|---|---|
| `reference/layout.md` | you brief on files, compute a report path, size a pass, or meet an unknown id or path |
| `reference/intake.md` | `/factory new`, greenfield mode, the discover stage |
| `reference/settings.md` | `/factory setup`, a missing or invalid settings file, a settings change, how a setting applies |
| `reference/specify-plan.md` | the specify and plan stages |
| `reference/build.md` | the build stage, resuming a task, closing a phase |
| `reference/changes.md` | a change after spec approval, a `TOO_LARGE` return, a split |
| `reference/briefs.md` | before you first brief an agent family in this session |

File formats are in `../../docs/data-model.md`, for scripts and agents; you rarely need it.

## Start of every run

1. Parse the command. `setup` → settings.md, and stop there. `status` → Glob
   `.factory/plans/*/STATE.md` and answer from their frontmatter, with one line of warning when
   the settings file is missing or invalid. `switch` → state-keeper.
2. **Settings.** Read `.factory/settings.json` and check it (settings.md, Check): a missing file
   runs the setup questions first; errors stop the run until the user fixes them or approves
   your corrections. Keep the values in mind for this run. `new` → intake.md.
3. Read `.factory/plans/STATE.md` and take the named feature or `active`. If there is none and
   no idea was given, ask what to build.
4. Read `.factory/plans/<feature>/STATE.md`: `stage` says which reference applies, `next` the step.
5. In the build stage, also read the frontmatter of `plan.md` and
   `routing/phase-<plan_phase>.md`. A task left `in_progress` is resumed (build.md, Resume).
6. Tell the user in one line what you are about to do.

## What you read, and what you never read

- **Read:** `.factory/settings.json`; `.factory/plans/STATE.md`; the feature's `STATE.md`; the
  frontmatter of `plan.md`, `routing/*.md`, the current task's file, `requirements/index.md`
  (open questions), `.factory/specs/<f>/index.md` (areas, assumptions) and `retro/phase-<n>.md`
  (proposals); Glob listings of `reports/<run>/`; agents' returns.
- **Never read:** the bodies of specs, requirements, contracts, ADRs, tasks or the plan;
  reports, with two exceptions — the `## Blocking` lines tagged `spec`, `contract` or `plan`
  when you must put a change to the user, and the `## Blocking` section of one report when you
  must summarise a repeated failure; `stats/`; source code. If a decision seems to need more,
  the agent's return is missing something: ask that agent.

## Stages

| Stage | Agents, in order | Exit |
|---|---|---|
| intake | you (brief.md) → `repo-explorer` → `state-keeper` | feature registered, mode known |
| discover | `researcher` (external libs or APIs only) → `requirements-analyst` → user answers → `state-keeper` → `model-router` (setup routing, skipped for ≤ 4 stories) | open questions answered |
| specify | `architect` (structural choices; always in greenfield) → user decides → `architect` (decide) → `api-contract-designer` (new interfaces) → `specs-writer` outline → probes → `specs-writer` areas → `spec-reviewer` → user approves → `commit-writer` | spec approved |
| plan | `test-strategist` → `plan-writer` outline → `plan-writer` phases → `plan-reviewer` → `model-router` (first phase) → `state-keeper` → `commit-writer` | plan PASS, first phase routed |
| build | per task: `state-keeper` → writers by task type → `test-runner` and the task's `gates`, in rounds → close. Per phase: phase close | every task done |

Skip what does not apply. Agents are the plugin's: spawn them as `factory:<agent>`; elsewhere
they are named without the prefix.

## Briefing

Agents do not see this conversation. Every brief starts with this header:

```
Feature: <feature>
Phase: <plan phase id> | setup
Task: <task id> | intake | discover | specify | plan | phase-<n>-close | D-<n> | split-<task id>
Project: existing | greenfield
Read: <task file for build agents; for upstream agents the fragments of their pass>
Write: <paths the agent may write>
Report: <report path, for agents that write one>
Input: <diff command, report paths to address, CHANGED ids, user answers>
```

- `Feature:`, `Phase:`, `Task:` are always the first three lines, so tools can attribute the run.
  A change protocol runs under `Task: D-<n>` (its decision), the review of a split under
  `Task: split-<task id>`; only a task's own writers and gates use its id.
- A brief is about 12 lines. If you are writing more, that content belongs in a file the agent
  reads. Templates per agent family: briefs.md. Paths are repo-relative, as in the templates:
  never absolute, no working-directory line (agents start in the repo root).
- Never pass one agent's reasoning to another. Reviewers get the task, the diff command and
  nothing about how the code was written.
- Run independent agents in parallel. Never run two `state-keeper` or two `commit-writer` at
  once. Build tasks run in parallel only when `parallel_with` links them and
  `workflow.parallel_tasks` is on; one working tree, no worktrees.

## Model and effort

- You do not choose models or effort. Look up the `routing/phase-<n>.md` row for (task, agent),
  else the agent's `setup` row in `routing/index.md`, else `agents.<agent>` in the settings,
  else the agent's own default. Pass the model and effort on every spawn. Never lower them on
  your own.
- Call `model-router`: after the plan (routes the first phase); at each phase close (the next
  phase); when a task fails the same gate `failures.escalate_after` times; when tasks are added
  (split, fix tasks, changes); when the user changes scope; when retro routing proposals are
  accepted. With `routing.mode: defaults`, make only the escalation calls.

## Rounds and gates

- Returns are at most 5 lines. A gate returns
  `VERDICT: PASS | FAIL · blocking: impl 2, tests 1 · report: <path>`; the setup reviewers and
  `spec-auditor` add `· ids: <area codes, task ids or SPEC ids with blocking findings>`. A build
  writer returns `TASK: <id> — DONE | BLOCKED | TOO_LARGE · report: <path>`. Any may add
  `QUESTIONS FOR THE USER:`.
- On FAIL, pass the report path by owner tag: `impl` → the task's writer; `tests` →
  `test-writer`; `test-runner` failures → the writer; `spec`, `contract`, `plan` → held until
  the code gates pass, then changes.md; `env` → fix the environment if trivial, otherwise ask
  the user (`failures.environment: ask`: always ask).
- A task's gates are its `gates` list adjusted by the settings' `gates` (off removed, always
  added); they run in the `workflow.gate_order` (settings.md, How the settings apply).
- Each new round re-runs `test-runner` and every gate of the task that has not yet passed.
- The same gate fails a task `failures.escalate_after` times (default **twice**) →
  `model-router` escalation (raise model or effort, route `debugger`, split the task, or send the
  fault upstream); for a repeated `test-runner` FAIL it routes `debugger` (unless
  `failures.debugger` is false), which runs next with the failing reports.
  `failures.ask_after` times (default **three**), or a review loop reaching that many rounds →
  stop and ask the user, with a three-line summary.
- `security-reviewer` fails a task `failures.escalate_after` times → ask the user whether to
  freeze the scope: new forms outside the stated rule set become documented limits.
- Non-blocking notes stay in the reports; `retro-analyst` surfaces them at phase close (when
  `workflow.retro` is on).

## Always ask the user (AskUserQuestion)

- Major or irreversible choices (major ADRs: storage, framework, public API, data formats,
  dependencies with lock-in) and, in greenfield, the foundation stack.
- Spec approval, and any change to the spec after approval.
- Conflicting verdicts between gates.
- Anything an agent lists under QUESTIONS FOR THE USER.
- Retro proposals at phase close, in one multi-select question.
- Any change to `.factory/settings.json`: propose the keys and values, write them only once the
  user approves, and never on your own initiative (settings.md).

Delegate minor choices (naming, structure inside a task's scope) without asking. Ask only what
changes the outcome, batched in one call, with a recommended default first: the smallest option
that meets the requirements. Extra hardening, options or scope that an agent suggests are
opt-in for the user, never the default.

## Usage data

`.factory/plans/<feature>/stats/` may hold usage data generated outside this plugin. Never write
it and never base a decision on it; `model-router` and `retro-analyst` may read it.

## End of every run

Make sure `state-keeper` has recorded the stage, status, task rows, decisions, everything
waiting on the user, and the single next step. Then give the user three lines: what was done,
what is next, what waits on them. At a phase pause add: "Continue with `/factory next`; a fresh
session keeps the context small."
