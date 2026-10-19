---
schema: factory.state/1
feature: side-panel
mode: existing
until: build
status: active
phase: 1
spec: none
updated: 2026-10-19
tasks: []
waiting_on_user: []
decisions:
  - date: 2026-10-19
    text: "Intake approved with the run plan: side-panel builds only the shared foundation; tab behavior and factory-side changes are out of scope"
    by: user
  - date: 2026-10-19
    text: "Defaults for the six definitions' open questions accepted as recorded in the brief (.specs/side-panel/brief.md)"
    by: user
  - date: 2026-10-19
    text: "Usage per-model windows: expose every rateLimits kind the session reports and nothing else"
    by: user
  - date: 2026-10-19
    text: "Usage limit projection in the status line only when a limit is predicted before reset; setting statusLine warn (default) / off"
    by: user
  - date: 2026-10-19
    text: "Agents per-agent cost = tokens x shared price table, labelled est.; session total uses cost.usd when reported"
    by: user
  - date: 2026-10-19
    text: "Files add-to-chat inserts only ($.prompt.fill append)"
    by: user
  - date: 2026-10-19
    text: "Files folder mention is one @folder/ mention, not expanded"
    by: user
  - date: 2026-10-19
    text: "Plans: a /factory command may be sent while a turn runs; it queues until idle and the button shows queued"
    by: user
  - date: 2026-10-19
    text: "Git layer covers other worktrees by default (--all) and can run in another worktree's directory"
    by: user
  - date: 2026-10-19
    text: "Unbuilt tabs are shown dimmed in order, with a one-line placeholder body"
    by: user
  - date: 2026-10-19
    text: "Terminal (dock and inline) is the tested surface; desktop and mobile draw and work through buttons but are untested"
    by: user
next:
  - model-router routes Specify and Plan
---

# STATE — side-panel

Brief: .specs/side-panel/brief.md · Requirements: .specs/side-panel/requirements.md · Spec: none yet · Plan: .plan/side-panel/plan.md (not yet written)

## Follow-ups (non-blocking notes)
- Repo-explorer reported EXISTING: TypeScript Claude Code plugin; single entry module hooks/hooks.json → hooks/register.ts; tests via `claude plugin test .`.
- 2026-10-20 — Repo split into two plugins in one marketplace: `plugins/factory/` (skill, agents) and `plugins/factory-mods/` (hooks, docs/data.md). The panel goes in factory-mods; tests via `claude plugin test plugins/factory-mods`.

## Log
- 2026-10-19 — Feature registered: mode existing, until build, phase 1 (Discover).
- 2026-10-19 — Intake done: brief written to .specs/side-panel/brief.md (source .dev/brief.md, intake answers from .dev/side-panel-intake.md approved by user).
- 2026-10-19 — repo-explorer reported EXISTING.
- 2026-10-19 — requirements-analyst done: .specs/side-panel/requirements.md (14 stories, 76 criteria, all open questions answered). Decisions Q1–Q9 recorded.
