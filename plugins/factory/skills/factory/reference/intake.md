# Intake and discover

Brief templates: briefs.md. Paths and ids: layout.md.

## /factory new (Phase: setup, Task: intake)

The settings were checked at the start of the run (SKILL.md); without a settings file, the setup
questions ran first (settings.md).

1. **Name.** `.factory/specs/<feature>/` and `.factory/plans/<feature>/` must not exist. If they
   do, ask whether to resume that feature or pick another name.
2. **Brief.** Take the idea verbatim: the inline text, or the file it points to (read it and
   keep its path as the source). If it is too thin to write requirements from (no clear user,
   capability or outcome), ask at most 3 questions in one AskUserQuestion call: who it is for,
   the core capability, hard constraints such as platform or stack. Do not ask what
   `requirements-analyst` can list as an open question. Write
   `.factory/specs/<feature>/brief.md`; its first intake answer is the settings' exposure:
   ```
   ---
   schema: factory.brief/2
   feature: <feature>
   source: inline            # inline | "<path of the brief file>"
   date: YYYY-MM-DD
   ---

   # <Feature> — brief
   ## Idea (verbatim)
   ## Intake answers
   - Exposure: private | internal | public   (from .factory/settings.json)
   ```
   This is the only feature file you write. It transcribes the user's input; it is not a spec.
3. **Map.** `repo-explorer` writes `.factory/specs/<feature>/repo-map.md`. Its `mode` is
   `greenfield` when there is no code the feature can live in or build on, otherwise `existing`;
   it goes on every later brief's `Project:` line.
4. **Register.** `state-keeper`: create `.factory/plans/<feature>/STATE.md` with the mode,
   `until` and `stage: discover`, and make the feature `active`.
5. **Continue** with Discover and stop at the target: `--until`, else `workflow.until` in the
   settings:
   - `discover` — requirements written, open questions answered;
   - `specify` — spec approved;
   - `plan` — plan-reviewer PASS, first phase routed, task rows in STATE;
   - `build` — every task done, no pause between phases;
   - `phase-<n>` or a task id — that phase closed, or that task closed.

   At the stop, give the user the two entrypoints (`.factory/specs/<feature>/index.md`,
   `.factory/plans/<feature>/plan.md`, as far as they exist) and the command to continue.

## Greenfield mode

When there is no code to fit into, the decisions an existing codebase would have made are made
explicitly, and the plan builds the ground the feature stands on.

- **Discover** — `researcher` runs only if the brief names external libraries or APIs, or
  leaves the stack open.
- **Specify** — `architect` always runs. Its ADRs decide the foundation: language and
  framework, project layout and module boundaries, build tool, test framework, lint and
  format, packaging. Each is major: the user picks before `specs-writer` starts.
- **Plan** — `test-strategist` takes the test framework from the accepted ADR and defines the
  layout and commands. `plan-writer` opens with phase 0 — Foundation: project skeleton, build,
  format and lint config, a test harness with one passing smoke test, the commands in the
  README. Every later task depends on it.
- **Build** — phase 0 tasks run one at a time. Their gates are `test-runner`, `code-reviewer`
  and `dependency-auditor`, adjusted by the settings' `gates` like any task.

A feature in an existing codebase follows the normal pipeline; `architect` runs only if the
feature forces structural choices.

## Discover (Phase: setup, Task: discover)

1. **Research** — only when the feature depends on an external library, API or standard. One
   `researcher` per precise question, in parallel; each writes `research/<topic>.md`.
2. **Requirements** — `requirements-analyst` writes `requirements/index.md` and one file per
   story. Its return gives the counts, the open questions, and a split proposal when the
   feature holds more than about 8 stories or several independent capabilities.
3. **Answers** — ask the open questions (AskUserQuestion, up to 4 per call, recommended answer
   first, free text accepted). Questions the user leaves open stay in `waiting_on_user`.
4. **Split** (only if proposed) — one question, default "keep as one feature". If the user
   splits, for each new feature:
   1. write its `brief.md` (the original idea, plus a line naming the stories it takes over,
      `source` = the parent's `requirements/index.md`);
   2. `repo-explorer` writes its `repo-map.md` (`Feature:` = the new feature);
   3. `state-keeper` registers it, with `Feature:` = the new feature and the event
      `register mode=<parent's mode> until=discover inactive`.

   Then one `requirements-analyst` run in split mode moves the stories: it writes each new
   feature's `requirements/` (index, the moved story files and their open questions, keeping
   their ids) and removes them from the current feature. A new feature starts when the user
   switches to it, at its open questions.
5. **Record** — `state-keeper`: one decision per answer (`ref: Q<n>`), `stage: specify`.
6. **Route** — `model-router` writes the setup routing in `routing/index.md`. Skip it when the
   feature has 4 stories or fewer, or with `routing.mode: defaults`: the agents then run at
   their settings defaults.
