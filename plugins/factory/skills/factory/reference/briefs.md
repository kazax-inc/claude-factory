# Brief templates

Every brief opens with the header of SKILL.md (`Feature:`, `Phase:`, `Task:`, `Project:`). Below
are the lines that follow it, per agent family. `<f>` is the feature; `<r>` the round and
`<batch>` the batch label (layout.md, Reports). Leave out a line that has nothing to say. Never
paste file contents into a brief.

## Setup writers

```
# repo-explorer (intake)
Read: .factory/specs/<f>/brief.md
Write: .factory/specs/<f>/repo-map.md

# researcher
Read: .factory/specs/<f>/brief.md, .factory/specs/<f>/repo-map.md
Write: .factory/specs/<f>/research/<topic>.md
Input: Question: <one precise question> · Feeds: <the decision it informs>

# requirements-analyst
Read: .factory/specs/<f>/brief.md, .factory/specs/<f>/repo-map.md, .factory/specs/<f>/research/   (revise: + .factory/plans/<f>/decisions.md)
Write: .factory/specs/<f>/requirements/   (split: + .factory/specs/<new feature>/requirements/ for each new feature)
Input: Mode: write | revise <decision ids> | split <new feature>: <story ids>; …

# architect
Read: .factory/specs/<f>/requirements/index.md, .factory/specs/<f>/repo-map.md, .factory/plans/<f>/decisions.md
Write: .factory/specs/<f>/adr/
Input: Mode: propose | decide "ADR-0003: B", "ADR-0004: A, but <change>" | amend ADR-NNNN per D-<n> · <report paths>

# api-contract-designer
Read: .factory/specs/<f>/requirements/index.md, .factory/specs/<f>/repo-map.md, .factory/plans/<f>/decisions.md, <accepted ADR ids>
Write: .factory/specs/<f>/contracts/
Input: Mode: write | revise · D-<n> · CHANGED: <ids from architect> · <report paths>

# specs-writer
Read: .factory/specs/<f>/requirements/index.md, .factory/plans/<f>/decisions.md, .factory/specs/<f>/contracts/index.md, .factory/specs/<f>/repo-map.md
Write: .factory/specs/<f>/index.md, .factory/specs/<f>/spec/
Input: Mode: outline | areas <codes> | revise <codes> | revise index · D-<n> · <report paths> · CHANGED: <ids upstream>

# test-strategist
Read: .factory/specs/<f>/index.md, .factory/specs/<f>/repo-map.md
Write: .factory/plans/<f>/test-strategy/
Input: Mode: index + areas <codes> | areas <codes> | revise <codes> | revise infra · CHANGED: <ids> · INF NEEDED: <text from plan-writer>

# plan-writer
Read: .factory/specs/<f>/index.md, .factory/specs/<f>/contracts/index.md, .factory/plans/<f>/test-strategy/index.md, .factory/plans/<f>/decisions.md, .factory/specs/<f>/repo-map.md
      (revise, fix, split, retro: + .factory/plans/<f>/STATE.md; retro: + .factory/plans/<f>/retro/phase-<n>.md)
Write: .factory/plans/<f>/plan.md, .factory/plans/<f>/conventions.md, .factory/plans/<f>/tasks/
Input: Mode: outline | phase <n> | revise <task ids> | split <task id> | fix <phase n> | retro <P ids> · <report paths> · CHANGED: <ids> · Changed files: <paths>
```

## Setup reviewers

```
# spec-reviewer
Read: .factory/specs/<f>/index.md
Report: .factory/plans/<f>/reports/<specify | D-n>/spec-reviewer[-<b1 | cross | changed>]-<r>.md
Input: Mode: all | areas <codes> | cross | changed · Parity: <CHANGED ids> · Previous: <its last report>

# plan-reviewer
Read: .factory/plans/<f>/plan.md
Report: .factory/plans/<f>/reports/<plan | D-n | split-<id> | phase-<n>-close>/plan-reviewer[-<p<n> | cross>]-<r>.md
Input: Mode: all | phase <n> | cross | tasks <ids> · Previous: <its last report>
```

## Routing and state

```
# model-router
Read: .factory/plans/<f>/plan.md            (setup: .factory/specs/<f>/requirements/index.md; rules: .factory/plans/<f>/retro/phase-<n>.md)
Write: .factory/plans/<f>/routing/
Input: Mode: setup | phase <n> | tasks <ids> | escalate <task> <agent> | rules <P ids> · <report paths>

# state-keeper — one call per moment, one event per line
Write: .factory/plans/STATE.md, .factory/plans/<f>/STATE.md, .factory/plans/<f>/decisions.md
Input:
- register mode=existing until=plan            (a split-off feature: … inactive, in a brief whose Feature: is that feature)
- stage specify
- spec approved
- task T1.2 in_progress
- phase_base "3f2a91c"
- task T1.2 done
- user_round T1.2
- rows add T1.1 T1.2 T1.3
- row T1.3 split
- decision by=user ref=Q1 "Detached HEAD shows the short sha" affects=[US-1]
- decision by=decision ref=AD-5 "Empty input returns an empty list" affects=[SPEC-GIT-4]
- decision by=decision ref=AD-11 "<answer>" supersedes=AD-6
- affects D-4 [SPEC-GIT-2, T1.3]
- waiting add kind=adr ref=ADR-0003 "Pick the storage option"
- waiting remove ref=ADR-0003
- plan_phase 2
- next "Run T2.1"
```

## Decisions

```
# decision — one run per decision point, never two at once (decisions.md)
Read: .factory/specs/<f>/brief.md, .factory/specs/<f>/requirements/index.md, .factory/plans/<f>/decisions.md, .factory/plans/<f>/decision-log.md
      (once they exist: + .factory/specs/<f>/index.md, .factory/plans/<f>/plan.md)
Write: .factory/plans/<f>/decision-log.md
Input: Kind: adr <ADR ids> | questions | change | approval spec | conflict | stuck <task | run> <agent> | freeze <task> | retro <P ids>
       · the questions verbatim, each with its agent · <report, ADR or retro paths>
       | Override: AD-<n> "<the user's answer>"
```

## Build writers

```
# implementer · refactorer · migration-writer · test-writer
Read: .factory/plans/<f>/tasks/<id>.md
Write: <the task's scope> (test-writer: <the task's tests>; migration-writer without a test-writer: both)
Report: .factory/plans/<f>/reports/<id>/<agent>-<r>.md
Input: <round 2+: the report paths to address>

# docs-writer (type docs)
Read: .factory/plans/<f>/tasks/<id>.md
Write: <the task's scope>
Report: .factory/plans/<f>/reports/<id>/docs-writer-<r>.md

# test-writer, probe mode
Read: .factory/specs/<f>/index.md (the AS rows), .factory/specs/<f>/repo-map.md   (probe task: + .factory/plans/<f>/tasks/<id>.md)
Write: .factory/plans/<f>/probes/AS-<n>/ (one folder per assumption)
Report: .factory/plans/<f>/reports/<specify | id>/test-writer[-AS-<n>]-<r>.md
Input: Mode: probe <AS ids>

# debugger
Read: .factory/plans/<f>/tasks/<id>.md
Write: <the task's scope and tests>
Report: .factory/plans/<f>/reports/<id>/debugger-<r>.md
Input: Failing: <report paths>
```

## Gates

```
# test-runner · code-reviewer · security-reviewer · perf-reviewer · dependency-auditor
# ui-reviewer · ux-reviewer · a11y-reviewer · spec-auditor (task)
Read: .factory/plans/<f>/tasks/<id>.md
Report: .factory/plans/<f>/reports/<id>/<agent>-<r>.md
Input: Diff: git diff HEAD -- <scope> <tests> ; git ls-files -o --exclude-standard -- <scope> <tests> · Previous: <its last report>

# spec-auditor (phase close)
Read: .factory/specs/<f>/index.md
Report: .factory/plans/<f>/reports/phase-<n>-close/spec-auditor-<batch>-<r>.md
Input: Areas: <codes> · Tasks: <phase task ids> · Diff: git diff <phase_base>..HEAD -- . ':(exclude).factory'

# e2e-tester (phase close)
Read: <the phase's task ids>
Write: <the repo's e2e folder>
Report: .factory/plans/<f>/reports/phase-<n>-close/e2e-tester-<r>.md
```

## Close

```
# docs-writer (docs: true)
Read: .factory/plans/<f>/tasks/<id>.md
Write: <the documentation files to update: README, docs/, doc comments in scope>
Input: Diff: git diff HEAD -- <scope> <tests>

# commit-writer
Read: .factory/plans/<f>/tasks/<id>.md            (setup, phase close or a change: name it instead)
Input: Files: <paths to commit> · Trailer: <your commit attribution lines, verbatim> | none

# retro-analyst
Read: .factory/plans/<f>/STATE.md, .factory/plans/<f>/plan.md
Write: .factory/plans/<f>/retro/phase-<n>.md
Input: Phase: <n> · Base: <phase_base> · Tasks: <phase task ids>
```
