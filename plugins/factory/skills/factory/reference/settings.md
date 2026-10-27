# Settings and /factory setup

`.factory/settings.json` holds the project's factory settings. It is the one JSON file of the
factory and belongs to the user: they edit it whenever they like; you write it only when they ask
for a change or approve one you propose. Agents never write it. The defaults are in
`../templates/settings.json` and reproduce the factory's behavior without settings; the meaning
of each key is in `../../../docs/data-model.md`, and editors check the file against
`../../../docs/schema/settings-1.json`.

## Check (start of every run)

Read `.factory/settings.json` and check it against the rules below. Do this on every run: the
user may have edited it since the last one.

- **Missing file** — `new` and `next`: run the question round of Setup, write the file, then go
  on with the command. `status` and `switch`: do the command, then suggest `/factory setup`.
- **Missing keys** — take the template's value. Never an error.
- **Errors** — list them, one line each: `<key path> — <problem> — <what is expected>`. Then one
  AskUserQuestion: "I'll fix the file myself" or "Apply these corrections: …" (your proposed
  values, the smallest change that makes the file valid). Run no factory step until the file is
  valid; `status` and `setup` still run.

| Rule | Error when |
|---|---|
| syntax | the file is not valid JSON |
| `schema` | missing, or not `factory.settings/1` (a higher number: the plugin is older than the file — ask the user to update it) |
| keys | a key that is not in the template, except `$schema` and the `project.commands` keys below; name the closest known key |
| `agents` | an agent name that is not one of the template's; `model` not `haiku \| sonnet \| opus`; `effort` not `low \| medium \| high \| xhigh \| max` |
| `routing.mode` | not `auto \| defaults` |
| `workflow` | `until` not `discover \| specify \| plan \| build`; `pacing` not `task \| phase \| all`; `gate_order` not `parallel \| sequential`; `parallel_tasks`, `docs`, `retro` not booleans |
| `failures` | `escalate_after` not an integer in 1–9; `ask_after` not an integer in 2–10; `escalate_after` ≥ `ask_after`; `debugger` not a boolean; `environment` not `fix-trivial \| ask` |
| `security` | `exposure` not `private \| internal \| public`; a check not a boolean; `gates.security-reviewer` is not `off` while every check is `false` |
| `tests` | `depth` not `minimal \| standard \| thorough`; a level not a boolean; every level `false` |
| `gates` | a value not `off \| auto \| always` (test-runner and code-reviewer are not listed: they always run) |
| `project.commands` | a key other than `build`, `format`, `lint`, `typecheck`, `test`, `test_one`; an empty value |

Retired keys (none yet) are listed here when a plugin version drops one: they are not errors; say
once that they are ignored, and let Setup remove them.

## Setup — `/factory setup [--defaults] [<change in words>]`

Setup spawns no agent and writes nothing but `.factory/settings.json`. It is unrelated to
`Phase: setup`, the stages before the build.

**No settings file yet:**

1. If `.plan/` or `.specs/` exist at the repo root, say they hold an older factory layout that
   this version does not read, and leave them alone.
2. Questions, in one AskUserQuestion (skipped with `--defaults`, which keeps the template):
   - **Exposure** — who can reach the software: private (only you or your team, no untrusted
     input), internal (trusted users), public (the internet, or people you do not know). Look at
     the README and manifests first and recommend one: a web service, an API or a published
     package is public; a personal tool or script is private.
   - **Test depth** — standard (recommended), minimal, thorough.
   - **Test levels** (multi-select) — unit, integration, e2e, property; recommend the levels the
     repo already uses, unit and integration when it has no tests. `visual` keeps the template
     value: a level is only allowed, never forced, so it costs nothing where nothing renders.
   - **Pacing** — pause after each plan phase (recommended), after each task, or never.
3. Write `.factory/settings.json`: the template, the answers, and the exposure preset in
   `security.checks`:

   | exposure | checks set to `true` (the others `false`) |
   |---|---|
   | private | injection, filesystem, secrets, dependencies |
   | internal | the private set, untrusted_input, privilege, memory_safety |
   | public | all eight |

4. Tell the user in three lines: the path, what was set (exposure, test depth and levels,
   pacing), and that they can edit the file at any time, ask you to change it, and commit it to
   share it with their team.

**Settings file exists:** run the Check, then list the keys the template has and the file lacks
(a newer plugin) and any retired keys, and offer to add or remove them. Show a short summary
(exposure and enabled checks, gates not `auto`, test depth and levels, pacing, routing mode,
agents that differ from the template). Then apply the change the command describes, or ask what
to change, as a proposed edit (old → new value per key) written only once the user approves.
Changing `exposure` does not touch `checks`; offer to apply that exposure's preset.

## Changing settings outside setup

- When the user asks for a change in their own words ("cheaper models", "no e2e tests"), propose
  the exact keys and values, and write them once they approve.
- A retro proposal of kind `settings` is approved when the user accepts it at phase close; write
  it then.
- An agent's return or report may suggest a setting; put it to the user like any proposal.
  Never change a setting on your own, even to unblock a run.

## How the settings apply

- **Model and effort** — for each spawn: the (task, agent) row of `routing/phase-<n>.md`, else
  the agent's `setup` row in `routing/index.md`, else `agents.<agent>` in the settings, else the
  agent's own frontmatter. Routing files hold only the runs that deviate from the settings.
- **routing.mode `defaults`** — skip every model-router call except escalation. An escalation
  still writes the task's row in `routing/phase-<n>.md`. Retro proposes `settings` changes
  instead of routing rules.
- **Gates of a task** — the task's `gates`, minus the gates set to `off`, plus the gates set to
  `always` when the task's `scope` is not empty. test-runner always runs first; code-reviewer
  always runs on a task with a `scope`. plan-writer keeps listing gates by their triggers, so a
  change to `gates` applies at once, even to tasks planned earlier.
- **Gate order** — `parallel`: after test-runner passes, the other gates run side by side, and
  spec-auditor last. `sequential`: one gate at a time in the order of the task's list, and the
  round ends at the first FAIL; the next round re-runs from test-runner.
- **Failures** — a gate that fails a task `escalate_after` times goes to model-router
  escalation; `ask_after` times, or a review loop reaching `ask_after` rounds, stops and asks the
  user. `debugger: false` removes the debugger from escalation; `environment: ask` sends every
  `env` finding to the user.
- **Pacing** — a flag on the command wins; then `workflow.until` for `/factory new`; then
  `workflow.pacing` (`task`: stop after each task or parallel batch; `phase`: after each phase
  close; `all`: run every phase). `until: build` means no pause.
- **Exposure** — copied into the intake answers of `brief.md`, so specs weigh hardening
  against it; security-reviewer reads it with `security.checks`.
- **Tests** — test-strategist reads `tests` and `project.commands`; test-writer, code-reviewer
  and e2e-tester read `tests.depth` (and test-writer `tests.levels.property`). e2e-tester runs
  at phase close only when `tests.levels.e2e` is `true`.
