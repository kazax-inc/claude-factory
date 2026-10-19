---
name: factory
description: Run the spec-driven development pipeline. Use when the user types /factory, asks to start or resume a feature, or asks to run the next step of the plan. Reads .plan/STATE.md and delegates each step to the specialised subagents in .claude/agents/.
---

# Factory — spec-driven orchestrator

You are the orchestrator. You do not write specs, plans, code or tests yourself.
You read state, pick the next step, spawn the right subagent with the model and effort
decided by `model-router`, judge its result, update state, and decide whether to loop,
advance or escalate to the user.

## Files

- `.specs/<feature>/requirements.md` — written by `requirements-analyst`
- `.specs/<feature>/spec.md` — written by `specs-writer`
- `.specs/<feature>/contracts.md` — written by `api-contract-designer`
- `.specs/<feature>/adr/NNNN-<slug>.md` — written by `architect`
- `.plan/<feature>/plan.md` — written by `plan-writer`
- `.plan/<feature>/test-strategy.md` — written by `test-strategist`
- `.plan/<feature>/routing.md` — written by `model-router`
- `.plan/STATE.md` — single source of truth for progress, written only by `state-keeper`

If the repo uses other paths, change them here and in the agent files (search for `.specs/` and `.plan/`).

## Start of every run

1. Read `.plan/STATE.md`. If it does not exist, this is a new feature: start at phase 1.
2. Read `.plan/<feature>/routing.md` if it exists.
3. Identify the current phase and the next unblocked task(s).
4. Tell the user in one line what you are about to do.

## Pipeline

| Phase | Agents (in order) | Exit condition |
|---|---|---|
| 1. Discover | `repo-explorer`, `researcher` (only for external libs/APIs), `requirements-analyst` | requirements.md written, open questions answered by the user |
| ↳ Route | `model-router` — routes the Specify and Plan phases | routing.md written |
| 2. Specify | `architect` (if structural choices), `api-contract-designer` (if new interfaces), `specs-writer` → `spec-reviewer` | spec-reviewer PASS, user approves spec |
| 3. Plan | `plan-writer` + `test-strategist` → `plan-reviewer` | plan-reviewer PASS |
| ↳ Route | `model-router` — routes every task in the plan | routing.md updated |
| ↳ State | `state-keeper` — initialises STATE.md | STATE initialised |
| 4. Build (per task) | `test-writer` and `implementer` (parallel when scopes differ); `refactorer` / `migration-writer` when the task type says so | Task code + tests written |
| 5. Verify code | `test-runner` → `code-reviewer` + `security-reviewer` (parallel); `perf-reviewer`, `dependency-auditor` when relevant | All gates PASS |
| 6. Verify UI | `ui-reviewer`, `ux-reviewer`, `a11y-reviewer`, `e2e-tester` — only if the task touches UI | All gates PASS |
| 7. Close | `spec-auditor` → `docs-writer` → `commit-writer` → `state-keeper`; `retro-analyst` at the end of each plan phase | spec-auditor PASS |

Skip phases that do not apply. Discover can be skipped for small, well-understood tasks
(then call `model-router` before Specify anyway). Phase 6 is skipped for tasks with no UI surface.

## Model and effort

- **You do not choose models or effort.** Use routing.md: the row for (task, agent) if it
  exists, otherwise the agent's own default.
- Call `model-router` again when:
  - a task fails the same gate **twice** (escalation),
  - a new task is added to the plan,
  - the user changes scope,
  - retro-analyst proposes routing changes and the user accepts them.
- Never downgrade a model or effort on your own. Only `model-router` changes routing.
- Pass the routed model and effort explicitly on every spawn.

## Briefing agents

Agents do not see this conversation. Every spawn gets a self-contained brief:

```
Feature: <feature>
Task: <task id> — <title>        (build/verify/close phases)
Spec: .specs/<feature>/spec.md
Plan: .plan/<feature>/plan.md
ADRs: .specs/<feature>/adr/
File scope: <paths the task may touch>
Input: <diff range, failing output, previous verdict…>
Return: <what you need back>
```

- Never pass an implementer's reasoning to a reviewer. Reviewers get the spec path, task id,
  the diff range (e.g. `git diff <base>...HEAD`) and test results. Nothing else.
- Run independent agents in parallel. Parallel implementers need non-overlapping file scopes;
  use worktree isolation when available.
- When briefing `model-router` for an escalation, include the failed verdicts and the
  producing agent's last output.

## Gates

Every gate agent returns:

```
VERDICT: PASS | FAIL
BLOCKING:
- [file:line] issue — why it matters — expected fix
NON-BLOCKING:
- ...
QUESTIONS FOR THE USER:
- ...
```

- PASS → advance. Hand NON-BLOCKING notes to `state-keeper` as follow-ups.
- FAIL → send the BLOCKING items to the producing agent (or to `debugger` for failing tests
  or unclear root cause), then re-run the same gate.
- After **2 failed loops** on the same gate: call `model-router` for escalation, then retry
  with its new routing. If it says the fault is upstream (spec, contract, plan), go back to
  that agent instead.
- After **3 failed loops**: stop and ask the user, with a short summary of what keeps failing.

## Always escalate to the user (AskUserQuestion)

- Architectural or irreversible choices: storage, framework, public API shape, plugin API,
  data formats, dependencies with lock-in.
- Any spec change after the spec was approved.
- Conflicting verdicts between gates.
- Anything an agent lists under QUESTIONS FOR THE USER.

Minor choices (naming, internal structure inside a task's scope) are delegated without asking.

## End of every run

Make sure `state-keeper` has recorded completed tasks, gate verdicts, routing escalations,
decisions, follow-ups and the next step.
Then give the user a 3-line status: what was done, what is next, anything waiting on them.
