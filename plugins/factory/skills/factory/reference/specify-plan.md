# Specify and plan

Brief templates: briefs.md. Pass sizes, budgets and report paths: layout.md. Writers run in
sequential passes of up to 6 fragments; reviewers run as parallel batches plus one cross pass.
A decision point goes to `decision`, or to the user with `workflow.decisions: user`
(decisions.md); "decide" below means that.

## Specify (Phase: setup, Task: specify)

1. **Architecture** — `architect` (propose mode) when the feature forces structural choices
   (storage, module boundaries, public or plugin API, data formats, concurrency, new
   dependencies); always in greenfield. It writes one ADR per decision and decides minor ones
   itself. Its return lists the major ones as questions with options, the greenfield
   foundation marked `foundation`.
2. **Decisions** — the major ADRs are one `adr` decision point; the `foundation` ones always go
   to the user, in one AskUserQuestion (options from the return, recommendation first; answers
   like "A, but …" are fine). An escalated or deferred ADR the user leaves open: `state-keeper`
   adds `waiting add kind=adr ref=ADR-NNNN`. Then one `architect` run in decide mode records all
   the answers in the ADRs, and `state-keeper` removes the matching waiting items. A rejected ADR
   goes back to `architect` with the direction that rejected it.
3. **Contracts** — `api-contract-designer` when the feature adds or changes interfaces. A
   breaking change comes back as a question: a `questions` decision point.
4. **Outline** — `specs-writer` outline pass: writes `.factory/specs/<f>/index.md` (summary, areas with
   their codes, assumptions, open issues) and `spec/glossary.md`. If all areas fit one pass
   (6 or fewer) and no assumption is `blocking`, it writes the area files in the same pass.
5. **Probes** — for each assumption with `blocking: true`, one `test-writer` in probe mode, in
   parallel, with scratch code under `.factory/plans/<f>/probes/AS-<n>/`. Each return says `CONFIRMED`
   or `CONTRADICTED`. Record every result: `state-keeper` adds a decision with `ref: AS-<n>`
   (`by=orchestrator`, the probe's one-line result). A contradicted assumption that touches a
   decision goes to `architect` (amend); then `specs-writer` in `revise index` mode, with the
   probe reports, updates the index before any area pass. A contradicted assumption that changes
   behavior is first a `change` decision point (it escalates a change of the user's scope).
6. **Areas** — `specs-writer` area passes, one after another, each naming up to 6 area codes.
7. **Review** — `spec-reviewer` once in `all` mode when the spec has 6 areas or fewer;
   otherwise in parallel batches of up to 6 areas, plus one cross pass over the index,
   glossary, contract rules and area frontmatter. Its return names the area codes
   with blocking findings. Route a FAIL by owner tag: `spec` → `specs-writer` revise mode with
   the report paths and those area codes; `contract` → `api-contract-designer` revise mode with
   the report paths. Then re-run the failed batches and the cross pass. Loop limits as in
   SKILL.md.
8. **Approval** — an `approval` decision point; `open_issues` must be empty first. With
   `workflow.decisions: user`, give the user the entrypoint path and the areas with their item
   counts (from the specs-writer returns) and ask for approval. Changes → `specs-writer` revise
   mode on the areas named, `spec-reviewer` changed mode, then this step again. On approval:
   `state-keeper` sets `spec: approved` and `stage: plan`; `commit-writer` commits
   `Files: .factory/specs/<f>/ .factory/plans/<f>/` as `docs(<f>): spec`.

`--until specify` stops here.

## Plan (Phase: setup, Task: plan)

1. **Test strategy** — `test-strategist`: the first pass writes `test-strategy/index.md`
   (frameworks, commands including `real_entry`, infrastructure items, hard-to-test items) and
   up to 6 area files; further passes take up to 6 areas each. It follows the settings' `tests`
   (depth, levels) and `project.commands`; items left without a case by them are listed as
   `untested`, which is the user's choice, not a defect. Hard-to-test items usually mean a vague
   spec item: a `change` decision point on fixing them through the change protocol (changes.md).
2. **Outline** — `plan-writer` outline pass: writes `plan.md` (phases, every task row with its
   id, type, size and deps), `conventions.md`, and every task file's frontmatter (the cut). A plan
   small enough for one pass also gets the task bodies here.
3. **Tasks** — `plan-writer` phase passes write the task bodies, one plan phase per pass, one
   after another. When a
   pass returns `INF NEEDED`, run `test-strategist` in `revise infra` mode with that text, then
   `plan-writer` revise mode on the tasks that need the new INF ids, before the review.
4. **Review** — `plan-reviewer` once in `all` mode when the plan has 15 tasks or fewer;
   otherwise in parallel, one batch per phase, plus one cross pass over `plan.md`, coverage and
   dependencies. Its return names the task ids with blocking findings.
   Route a FAIL by owner tag: `plan` → `plan-writer` revise mode with the report paths and those
   task ids; `spec` or `contract` → the spec is already approved, so changes.md. Then re-run the
   failed batches and the cross pass.
5. **Route** — `model-router` routes the first phase into `routing/phase-<n>.md` (skipped with
   `routing.mode: defaults`).
6. **State** — `state-keeper`: a `todo` row for every task, `stage: build`, `plan_phase` = the
   first phase (`0` in greenfield, otherwise `1`).
7. **Commit** — `commit-writer`: `Files: .factory/plans/<f>/` as `docs(<f>): plan`.

`--until plan` stops here.
