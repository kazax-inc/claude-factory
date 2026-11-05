---
schema: factory.state/2
feature: git-panel
mode: existing
until: build
status: waiting_on_user
stage: build
spec: approved
plan_phase: 2
phase_base: "3f2a91c"
updated: 2026-11-04
tasks:
  - {id: T1.1, status: done, loops: 0, user_rounds: 0}
  - {id: T1.2, status: done, loops: 1, user_rounds: 0}
  - {id: T1.3, status: split, loops: 0, user_rounds: 0}
  - {id: T1.3a, status: done, loops: 0, user_rounds: 0}
  - {id: T1.3b, status: done, loops: 0, user_rounds: 0}
  - {id: T1.4, status: done, loops: 0, user_rounds: 0}
  - {id: T2.1, status: done, loops: 0, user_rounds: 0}
  - {id: T2.2, status: in_progress, loops: 2, user_rounds: 0}
  - {id: T2.3, status: split, loops: 0, user_rounds: 0}
  - {id: T2.3a, status: done, loops: 0, user_rounds: 0}
  - {id: T2.3b, status: in_progress, loops: 0, user_rounds: 0}
  - {id: T2.3c, status: todo, loops: 0, user_rounds: 0}
  - {id: T2.4, status: blocked, loops: 1, user_rounds: 0}
  - {id: T2.5, status: todo, loops: 0, user_rounds: 0}
  - {id: T3.1, status: todo, loops: 0, user_rounds: 0}
  - {id: T3.2, status: todo, loops: 0, user_rounds: 0}
  - {id: T3.3, status: todo, loops: 0, user_rounds: 0}
  - {id: T3.4, status: dropped, loops: 0, user_rounds: 0}
waiting_on_user:
  - {text: "T2.4 is blocked: is a missing git binary an error or an empty panel?", kind: blocker, ref: SPEC-PANEL-5, task: T2.4, since: 2026-11-03}
next: ["Run T2.2 round 3: implementer fixes the code-reviewer report"]
---
# STATE — git-panel

Entrypoints: [spec](../../specs/git-panel/index.md) · [plan](plan.md)
