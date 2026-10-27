# Changes after approval, and splits

Brief templates: briefs.md.

## Change protocol (Phase: <current plan phase> | setup, Task: D-<n>)

Use it for any change to approved artifacts: a user decision that changes behavior, a
contradicted probe, `spec` / `contract` / `plan` findings from a gate or an audit (after the
task's code gates passed), hard-to-test items the user wants fixed.

1. **Decide** — put the change to the user (for findings, from the report's `## Blocking` lines
   tagged `spec`, `contract`, `plan`), unless it only corrects the spec to match behavior the
   user already approved. `state-keeper` records the decision `D-<n>`. Every run below uses
   `Task: D-<n>`, so its reports go to `reports/D-<n>/`.
2. **Revise in order**, each step only if affected, each given the decision id, the report paths
   that triggered it, and the `CHANGED` ids returned by the step before:
   1. `architect` — amend mode (a new ADR with `amends:`), or decide mode;
   2. `api-contract-designer` — revise mode;
   3. `specs-writer` — revise mode, only the areas involved;
   4. `test-strategist` — revise mode, only those areas' cases;
   5. `plan-writer` — revise mode: not-done tasks that cite the changed ids are edited; for done
      tasks whose code no longer matches, fix tasks are added to the current `plan_phase` (or,
      before the build, to the first phase).

   Each returns `CHANGED: [ids]` (added, modified, removed).
3. **Review the changed set** — `spec-reviewer` in changed mode with the CHANGED ids as its
   parity list; `plan-reviewer` on revised and new tasks.
4. **Route** — `model-router` tasks mode for revised and new tasks (skipped with
   `routing.mode: defaults`).
5. **Record** — `state-keeper`: `rows add` for new tasks, `affects D-<n> [<CHANGED ids>]`. A task
   in progress whose files changed picks them up at its next round.
6. **Commit** — `commit-writer`: `Files:` = the files steps 1–5 changed under `.factory/specs/<f>/` and
   `.factory/plans/<f>/` (from the returns), `reports/D-<n>/`, `.factory/plans/<f>/STATE.md`,
   `.factory/plans/<f>/decisions.md`, as `docs(<f>): D-<n>`.

A task whose own findings started the change closes after step 3, with `spec-auditor` re-run.

## Split (Task: split-<task id> for the review)

Triggers: a build writer returns `TOO_LARGE` (only before its first edit; its report holds a
split proposal), plan-reviewer flags a task too large, a `model-router` escalation returns
`SPLIT`, or the user asks.

1. `plan-writer` split mode — given the task and the report that triggered the split (the
   `TOO_LARGE` report, or the failed gate reports for a `SPLIT` escalation), plus any files the
   task's writers already changed (`git status --porcelain -- <scope> <tests>`). It adds children
   `T<p>.<n>a`, `b`, … (a re-split takes the next free letter), sets `split_into` on the parent
   row, turns the parent file into a stub with `superseded_by`, and rewires the dependents.
   Changed files stay in the working tree and go to the child that owns them; that child's
   round 1 starts from them.
2. `plan-reviewer` — the new rows and files only, `Task: split-<task id>`.
3. `model-router` — tasks mode for the children (skipped with `routing.mode: defaults`).
4. `state-keeper` — `row <id> split`, `rows add <children>`.

Continue with the first ready child; the split's plan files and reports are committed with it
(build.md, Close).
