---
schema: factory.routing/1
feature: side-panel
updated: 2026-10-19
overrides:
  - agent: architect
    model: opus
    effort: xhigh
    reason: cross-cutting foundation for six features combining concurrency (single-flight git, event store), security (git allowlist, read-only) and storage caps
  - agent: api-contract-designer
    model: opus
    effort: high
    reason: nine shared interfaces that six later features build on, checked against a 16,700-line engine types file
  - agent: specs-writer
    model: opus
    effort: high
    reason: default kept; 76 criteria over 14 stories to pin to ADRs and contracts
  - agent: spec-reviewer
    model: opus
    effort: high
    reason: gate raised; a spec or contract gap escapes into six downstream features
  - agent: plan-writer
    model: opus
    effort: high
    reason: default kept; many new modules plus the register.ts extraction under a one-entry-module constraint
  - agent: test-strategist
    model: opus
    effort: medium
    reason: no existing panel test pattern; needs a mod API test approach for the terminal surface while desktop and mobile stay untested
  - agent: plan-reviewer
    model: opus
    effort: high
    reason: gate raised; checks ordering of the register.ts refactor against existing hook tests and full criteria coverage
tasks: []
escalations: []
---

# Routing — side-panel

## Notes
- This covers only Specify and Plan. Task routing (implementer, test-writer, debugger per task)
  comes once plan.md exists.
- architect at xhigh: this run's ADRs set the shape that all six tab features build on. The work
  combines cross-cutting architecture (one pane or six engine panes, module layout under hooks/,
  userConfig key format), concurrency (single-flight git runner, session event store with
  `/clear` reset, change detection) and security-sensitive scope (git allowlist, the read-only
  guarantee). If the architect gets this wrong, every later feature pays for it.
- api-contract-designer at high: the contracts (session store, factory reader, git runner, chat
  actions, status composer, toast policy, cross-link API, graceful-state vocabulary, tab
  registration) are the public API of the foundation. They must match the real mod API in
  `.claude-plugin/types/claude-code/index.d.ts`, so the agent has to check them against that
  file rather than against the intake notes.
- Both gates are raised from medium to high. A missed defect here is reworked in up to six
  features, so the extra review cost is small next to that.
- test-strategist is raised from Sonnet: the repo has no pattern for testing panel or mod
  code, the only tested surface is the terminal (dock and inline), and the strategy has to say
  how to fake the session events, `$.ui.status`, `$.prompt.fill` and `$.command.run`. That
  is design work, not filling in a template.
- Nothing is under-specified: requirements have no open questions left and Q1 to Q9 are user
  decisions. The pane-layout ADR waits on the user's choice. The architect should present the
  options and must not choose on the user's behalf.
