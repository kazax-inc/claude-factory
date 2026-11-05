# Decisions — who answers, the decision agent, overrides

Brief templates: briefs.md. Change protocol: changes.md. Log format: `../../../docs/data-model.md`.

## Who answers

From the specify stage on, every question the pipeline raises is a **decision point**. With
`workflow.decisions: agent` (the default) you brief `decision`, which answers it or escalates it,
and logs both in `.factory/plans/<f>/decision-log.md`. The user reviews that log and can override
any entry. With `workflow.decisions: user` you put every decision point to the user (User mode).

Always the user, whatever the setting — never brief `decision` for these:

- `/factory setup`, a settings check, and any change to `.factory/settings.json`: a `settings`
  retro proposal, a setting an agent suggests (settings.md);
- intake and discover (`Phase: setup` with `Task: intake` or `discover`): the brief questions,
  the open questions `Q<n>`, a feature split. This is where the user defines the work;
- the greenfield foundation: ADRs with `impact: foundation` (specify-plan.md);
- `env` findings that need an action outside the repo, and every `env` finding with
  `failures.environment: ask`;
- what `decision` escalates;
- a gate that fails the task again after a `stuck` ruling, and a review loop that does not pass
  in the round after its ruling;
- the user's overrides.

## Kinds

| Kind | Decision point | `Input:` | Apply the answer |
|---|---|---|---|
| `adr` | `architect` returned major ADRs (not `foundation`) | `Kind: adr <ADR ids>` | `architect` decide mode with every choice (`"ADR-0003: B"`) |
| `questions` | a return lists `QUESTIONS FOR THE USER` (any agent after discover, a `BLOCKED` writer, a breaking contract change) | `Kind: questions` · each question verbatim with `<agent>` and its report path | the answer goes on the asking agent's next `Input:` line (`Answers: AD-5 "<answer>"`), or into the change protocol when `CHANGE` names steps |
| `change` | changes.md step 1: `spec` / `contract` / `plan` findings, a contradicted probe, a hard-to-test item the plan stage offers to fix | `Kind: change` · the report paths, or the probe report, or `hard to test: <SPEC ids>` | accepted → changes.md from step 2 under `Task: D-<n>`, running the `CHANGE` steps; rejected → the finding goes back to the task's writer as an `impl` fix, with the answer on `Input:` |
| `approval` | the spec passed `spec-reviewer` (specify-plan.md, step 8) | `Kind: approval spec` | `"approved"` → as the user's approval; `"changes: …"` → `specs-writer` revise mode on those areas with `D-<n>`, `spec-reviewer` changed mode, then the approval again |
| `conflict` | two gates of one task return contradicting findings | `Kind: conflict` · both report paths | route the finding that holds to its owner with the answer on `Input:`; the other gate passes on that point in its next round (`Previous:` + the answer) |
| `stuck` | a gate fails a task `failures.ask_after` times, or a review loop reaches that many rounds | `Kind: stuck <task \| run> <agent>` · the failing reports | `direct` → one more round, the direction on the writer's `Input:`; `split` → changes.md, Split; `upstream <agent>` → change protocol |
| `freeze` | `security-reviewer` fails a task `failures.escalate_after` times | `Kind: freeze <task>` · its reports | `freeze` → change protocol (specs-writer records the forms outside the rule set as documented limits), then the next round; `continue` → next round with the direction |
| `retro` | phase close step 4, the `routing` and `plan` proposals | `Kind: retro <P ids>` · the retro path | apply the accepted ones (build.md, Phase close); put `settings` proposals to the user; tell the user the `plugin` ones |

- **Batch** each decision point in one run: every major ADR of the architect's return, every
  question of a round (both tasks of a parallel batch), every held finding of a task.
- Never run two `decision` at once; it is the only writer of the log.
- Brief it with the usual header: `Task:` is the current run (`specify`, `plan`, a task id,
  `phase-<n>-close`, `D-<n>`, `override-AD-<n>`). It writes no report: its log is the record.
- `WARN` lines go to the user in the end-of-run lines; they are not questions.

## Recording

After each return, one `state-keeper` call records, for every `DECIDED` item:
`decision by=decision ref=AD-<n> "<answer from the return>" affects=[<ids>]`. Not recorded there:
an `adr` choice (the ADR records it), a `retro` choice (the applied change records it), and an
`approval` of `"approved"` (record `spec approved` instead). The change protocol of a decided
`change` runs under the `D-<n>` this call adds.

## Escalations

Put the `ESCALATED` items to the user (AskUserQuestion, up to 4 per call, the options from the
return with the recommended one first, free text accepted). Record each answer:
`decision by=user ref=AD-<n> "<answer>" affects=[<ids>]`, then apply it as its kind says. A
question the user leaves open: `waiting add kind=<adr | approval | gate | blocker | retro>
ref=AD-<n> "<question>"`; the step that needs it waits, the rest of the run goes on.

## User mode (`workflow.decisions: user`)

Put each decision point to the user as the factory always did, batched, recommended option
first: major ADRs one question each (options from the architect's return); the spec approval
with the entrypoint and the areas with their item counts; agents' questions verbatim; a change
from the report's `## Blocking` lines tagged `spec`, `contract`, `plan`; conflicting verdicts; a
stuck loop with a three-line summary; the freeze question; retro proposals in one multi-select
question, most useful first. Record each answer `by=user` with the id it answers (`ADR-NNNN`,
`AS-<n>`, a task id, `P<n>`) and apply it as in the table. No log is written.

## End of run

When `decision` decided anything in this run, add one line to the three of SKILL.md:
`Decided for you: AD-4 … AD-7 — .factory/plans/<f>/decision-log.md · change one with /factory override AD-<n> <answer>`.

## /factory decisions [<feature>]

Read-only. Read the frontmatter of the feature's `decision-log.md` and `decisions.md`. One line
per entry: `AD-<n> · <run> · <question> → <choice> · <status>`; an escalated entry shows the
user's answer (the `decisions.md` row whose `ref` is that AD id) or `waiting on you`. End with
the file path and the override command. No log yet: say that no decision was made for the user.

## Override — `/factory override <AD-n> [<answer>]`

A plain request to change one of these decisions ("change AD-4 to B", "undo the storage
decision") is this command: find the entry by its `question` in the log's frontmatter and name
its id.

1. **Find** — the entry's row in `decision-log.md` of the active feature (`<feature>:AD-<n>` for
   another).
   - Not `active` → say what replaced it (`superseded_by`, or the user's decision that
     overrode it) and stop.
   - Escalated and still waiting → this is the answer to it: record and apply it as in
     Escalations.
   - No answer, or one that does not say what to do instead ("revert", "undo") → read that
     entry's section and ask, with its options and free text.
2. **Check** — `decision` in override mode, `Task: override-AD-<n>`,
   `Input: Override: AD-<n> "<answer>"`. `ESCALATED` (the answer contradicts another of the
   user's decisions or the requirements) → ask the user. With their resolution, run this step
   again. If they keep the old decision, stop.
3. **Record** — `state-keeper`: `decision by=user ref=AD-<n> "<answer>" affects=[<ids>]` (this
   is `D-<m>`), and for each entry decided again (`AD-11 replaces AD-6`):
   `decision by=decision ref=AD-11 "<answer>" supersedes=AD-6`.
4. **Propagate** — `CHANGE` names steps → changes.md, change protocol from step 2 under
   `Task: D-<m>` (an ADR choice changes through `architect` amend mode with the user's option).
   `CHANGE: none` → `commit-writer`: `Files: .factory/plans/<f>/decision-log.md
   .factory/plans/<f>/decisions.md .factory/plans/<f>/STATE.md` as `docs(<f>): override AD-<n>`.
5. **Tell** — the end-of-run lines, with the `WARN` lines.
