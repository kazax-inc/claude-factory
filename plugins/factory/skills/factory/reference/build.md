# Build and phase close

Brief templates: briefs.md. Report paths: layout.md. Round, gate and escalation rules: SKILL.md.
How the settings change this stage: settings.md (How the settings apply).

## Picking tasks

A task is **ready** when it is in `plan_phase`, its STATE row is `todo` and every dep is `done`
(a dep on a split task means all its children). Take the first ready task in plan order, plus
any ready task linked to it by `parallel_with` (unless `workflow.parallel_tasks` is off). Stop at
the `--until` target; without a flag, where `workflow.pacing` says: after this task or batch
(`task`), at the end of the phase (`phase`, the default), or not at all (`all`, like
`--through`).

## One task (Phase: <phase id>, Task: <task id>)

1. **Frontmatter** — read the task file's frontmatter (`scope`, `tests`, `gates`, `docs`,
   `verifies`) and its rows in `routing/phase-<n>.md`.
2. **Start** — `state-keeper`: the task `in_progress`. The first task of a phase also sets
   `phase_base` to the current commit (`git rev-parse HEAD`).
3. **Writers** (round 1) by the task's `type` in `plan.md`:

   | type | writers |
   |---|---|
   | `feature` | `test-writer` and `implementer` in parallel (`tests` vs `scope`) |
   | `test` | `test-writer` |
   | `refactor` | `refactorer` |
   | `migration` | `migration-writer` and `test-writer` in parallel |
   | `docs` | `docs-writer` (`Write:` = the task's `scope`) |
   | `probe` | `test-writer` in probe mode for the assumptions in `verifies` |

   Skip `test-writer` when the task's `tests` is empty (no test cases); a `migration-writer`
   without a test-writer then gets the task's `tests` on its `Write:` line.
   `TOO_LARGE` → changes.md, Split. `BLOCKED` → its questions go to the user, or the fault goes
   upstream (changes.md).
4. **Gates** — the task's gates are its `gates` list minus the gates the settings set to `off`,
   plus those set to `always` when `scope` is not empty. `test-runner` first; if it passes, the
   others in parallel and `spec-auditor` last once they pass (`workflow.gate_order: sequential`:
   one at a time, in list order, ending the round at the first FAIL). Every gate gets the diff
   command:
   `git diff HEAD -- <scope> <tests>` and `git ls-files -o --exclude-standard -- <scope> <tests>`.
   A `probe` task has no gates: its result is a fact, recorded at close.
5. **Fix rounds** — on FAIL, route the report paths by owner tag (SKILL.md), then re-run
   `test-runner` and every gate that has not yet passed. Spec, contract and plan findings wait
   until the code gates pass.
6. **Close**, one task at a time:
   1. held `spec` / `contract` / `plan` findings → changes.md, change protocol;
   2. a `probe` task: `state-keeper` records one decision per assumption (`ref: AS-<n>`, the
      result); a `CONTRADICTED` one goes through the change protocol before its dependents run;
   3. `docs-writer` if `docs: true` and `workflow.docs` is on;
   4. `state-keeper`: the task `done`; it counts `loops` from the task's reports; add a
      `user_round` for each extra round the user ordered;
   5. `commit-writer`: `Files:` = `scope`, `tests`, the docs-writer's files, `reports/<task>/`,
      `.factory/plans/<f>/probes/` for a probe, `.factory/plans/<f>/STATE.md`,
      `.factory/plans/<f>/decisions.md`, and the plan and spec files changed for this task —
      including a split it came from (`plan.md`, `tasks/`, `routing/`, `reports/<parent>/`,
      `reports/split-<parent>/`); `Trailer:` = the commit attribution lines your own
      instructions give, verbatim, or `none`.

## Parallel tasks

Only tasks linked by `parallel_with` run together, and only while `workflow.parallel_tasks` is on
(plan-reviewer checked their files are disjoint). Their writers and gates run side by side;
`state-keeper` and `commit-writer` calls stay one at a time. A `test-runner` failure in a file of
the other running task is re-run once after that task's writers finish before it is routed.
Phase 0 tasks never run in parallel.

## Resume

For a task left `in_progress`: Grep `^(agent|verdict):` in `reports/<task>/` (the round is the
number ending each file name), and run `git status --porcelain -- <scope> <tests>`.

- No reports: no changes → start round 1; changes → start round 1 anyway (the writers see the
  existing edits).
- Writer reports in the last round, some of the task's gates missing from it → run the missing
  ones.
- A gate FAIL in the last round → start the next fix round.
- Every gate of the task (after the settings' adjustment) has a PASS as its latest verdict, in
  any round → close.

## Phase close (Phase: <n>, Task: phase-<n>-close)

1. **Audit** — `spec-auditor` in parallel batches of up to 6 areas touched by the phase, with
   `git diff <phase_base>..HEAD -- . ':(exclude).factory'` and the phase's task ids. It always
   runs: `gates.spec-auditor` in the settings covers the task gate only. Its return names the
   SPEC ids with blocking findings. `impl` / `tests` findings → `plan-writer` fix mode adds fix
   tasks to this phase → `plan-reviewer` (`Task: phase-<n>-close`) → `model-router` routes them
   (not with `routing.mode: defaults`) → `state-keeper` adds their rows; build them as usual,
   then re-run the failed audit batches. `spec` / `contract` findings → change protocol.
2. **Acceptance** — `e2e-tester` when any task of the phase lists UI gates and the settings'
   `tests.levels.e2e` is on, given the phase's task ids. FAIL by owner tag: `impl` → fix tasks
   as in step 1; `tests` → `e2e-tester` again with its report; `spec` → change protocol; `env` →
   the user.
3. **Retro** — `retro-analyst` writes `retro/phase-<n>.md` (skipped, with step 4, when
   `workflow.retro` is off).
4. **Proposals** — read its `proposals` and ask the user in one multi-select question (most
   useful first). Apply the accepted ones: `routing` → `model-router` rules mode; `settings` →
   you write the change to `.factory/settings.json` (accepting it is the approval); `plan` →
   `plan-writer` retro mode on later phases and conventions (then `plan-reviewer` on what it
   changed); `plugin` → leave them in the retro and tell the user they are edits for the
   plugin's maintainer.
5. **Next phase** — `model-router` routes it (not with `routing.mode: defaults`);
   `state-keeper` sets `plan_phase` to it and the next step.
6. **Commit** — `commit-writer`: `Files: .factory/plans/<f>/ <e2e test files>` as
   `docs(<f>): close phase <n>`.
7. **Pause** — stop with the three-line status unless `--through`, a later `--until` or
   `workflow.pacing: all` is set.

After the last phase: `state-keeper` sets `stage: done`, `status: done`. On request,
`commit-writer` drafts the PR description.
