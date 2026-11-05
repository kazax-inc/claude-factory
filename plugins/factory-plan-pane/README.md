# factory-plan-pane

A Claude Code mod that keeps the [factory](../factory) plan beside the chat: a pane showing the
active feature's progress as a tree of phases, tasks, split subtasks and the spec items each task
implements, with each node's status.

```text
● git-panel [build] ✗ (waiting on you)
○ auth [done] ✓
○ search [specify] ●

git-panel · waiting on you · active feature
A read-only side panel showing the current branch, the working tree status and recent commits.

intake › discover › specify › plan › build › done
███████████░░░░░░░░░░░░░ 7/15 tasks · 47%
2 in progress · 1 blocked · 1 dropped · specs 8/14
⚠ Waiting on you: T2.4 is blocked: is a missing git binary an error or an empty panel?

e: Expand all  c: Collapse all  r: Refresh

▸ ✓ Phase 1 · Core  5/5
▾ ✗ Phase 2 · Panel  2/7  ◂ current
  ▸ ✓ T2.1 Panel layout and empty state  feature M
  ▸ ◐ T2.2 Branch and status rows  feature M · 2 loops
  ▾ ◐ T2.3 Recent commits list  split · 1/3
    ▸ ✓ T2.3a Commit log runner  feature S
    ▾ ◐ T2.3b Commit rows with relative dates  feature S
        · SPEC-PANEL-4 Lists the last 20 commits with relative dates
    ▸ ○ T2.3c Load more commits  feature S
  ▸ ✗ T2.4 Error state when git is missing  feature S · 1 loop
    ○ T2.5 Document the panel  docs S
▸ ○ Phase 3 · Polish  0/3
Next: Run T2.2 round 3: implementer fixes the code-reviewer report
✓ done  ◐ in progress  ○ to do  ✗ blocked  ⊘ dropped
```

It only reads the project's `.factory/` folder and never writes it. It does not need the factory
plugin installed: in a project with no `.factory/` folder the pane says the factory plugin is not
initialized there, and it never opens by itself in such a project.

## Install

At the prompt of a Claude Code session:

```text
/plugin install factory-plan-pane --marketplace kazax-inc/claude-factory
```

From a shell: `claude plugin install factory-plan-pane --marketplace kazax-inc/claude-factory`.

## Use

- `/factory-plan` opens the pane for the session's project.
- `/factory-plan <folder>` shows the plan of another project folder (relative to the session's
  project, or absolute; a path to the `.factory` folder itself works too). `/factory-plan .` comes
  back to the session's project.
- Press a phase or a task (click, or Enter on it once the pane has the keyboard: ctrl+x tab) to
  open or close it. `e` expands every node, `c` collapses them all, `r` reads the plan again.
- With several features, a list at the top shows each one as `● <feature> [<stage>]`, followed
  by a green ● while a factory agent works on it in this session (an agent whose brief opens with
  `Feature: <feature>`), ✗ when one of its tasks is blocked, ✓ once it is done, and
  `(waiting on you)` or `(paused)` from its `STATE.md`. Press a row to show that feature; ● before
  the name marks the one shown.

The pane opens by itself as a sidebar when the terminal is in fullscreen and the project has a
factory plan. Turn that off with the plugin's **Open the plan pane by itself** option in
`/config`.

It reads the plan again when an agent writes under `.factory/`, at the end of each turn, and,
while the pane is shown, when a `STATE.md` or `plan.md` changes on disk.

## What it reads

The factory's files (schemas `factory.*/2`, described in the factory's
[`docs/data-model.md`](../factory/docs/data-model.md)), from their YAML frontmatter only:

| File | What the pane takes |
|---|---|
| `.factory/plans/STATE.md` | the active feature |
| `.factory/plans/<feature>/STATE.md` | stage, status, current phase, each task's status and loops, what waits on the user, the next step |
| `.factory/plans/<feature>/plan.md` | phases, task rows, `split_into` (subtasks) |
| `.factory/plans/<feature>/tasks/<id>.md` | `implements`: the spec items under each task |
| `.factory/specs/<feature>/index.md` | the summary and the spec areas |
| `.factory/specs/<feature>/spec/<area>.md` | spec item titles and the spec total |

A split task and a phase show their children's roll-up: done when every live child is, blocked
when any child is, in progress when any is started. Progress is done over the task set (tasks
that are not split), dropped tasks counted apart. A file that is missing or does not parse is
named at the bottom of the pane instead of failing it.

## Develop

```text
.claude-plugin/plugin.json   the manifest (one option: autoOpen)
hooks/register.tsx           the hooks: command, pane drawing, reloads, auto-open
hooks/load.ts                reads .factory into a snapshot
hooks/tree.ts                roll-ups, default expansion, the flattened tree
hooks/frontmatter.ts         the factory's YAML subset
types/index.d.ts             the snapshot types and the mod's $.state contract
tests/                       claude plugin test: an in-memory project served as $.fs
fixtures/demo/.factory/      a mock factory project (three features) for trying the pane
```

This repository has no factory plan of its own, so try the pane on the mock project:

```text
/factory-plan plugins/factory-plan-pane/fixtures/demo
```

Check and test it from the repository root:

```bash
claude plugin validate plugins/factory-plan-pane
claude plugin test plugins/factory-plan-pane
tsc -p plugins/factory-plan-pane              # once a session has loaded the mod and laid its types
```
