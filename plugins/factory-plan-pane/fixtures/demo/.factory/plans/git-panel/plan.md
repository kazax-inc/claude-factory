---
schema: factory.plan/2
feature: git-panel
phases:
  - {id: 1, name: "Core", goal: "Branch and status visible through the real entry"}
  - {id: 2, name: "Panel", goal: "The side panel draws every state"}
  - {id: 3, name: "Polish", goal: "Fast refresh, keyboard and screen reader support"}
tasks:
  - {id: T1.1, title: "Probe porcelain v2 output", type: probe, size: S, deps: []}
  - {id: T1.2, title: "Git runner", type: feature, size: M, deps: [T1.1]}
  - {id: T1.3, title: "Status parser", type: feature, size: M, deps: [T1.1], split_into: [T1.3a, T1.3b]}
  - {id: T1.3a, title: "Parse the branch header", type: feature, size: S, deps: [T1.1]}
  - {id: T1.3b, title: "Parse changed entries", type: feature, size: S, deps: [T1.3a]}
  - {id: T1.4, title: "Wire status into the CLI entry", type: feature, size: S, deps: [T1.2, T1.3]}
  - {id: T2.1, title: "Panel layout and empty state", type: feature, size: M, deps: [T1.4]}
  - {id: T2.2, title: "Branch and status rows", type: feature, size: M, deps: [T2.1], parallel_with: [T2.3]}
  - {id: T2.3, title: "Recent commits list", type: feature, size: M, deps: [T2.1], split_into: [T2.3a, T2.3b, T2.3c]}
  - {id: T2.3a, title: "Commit log runner", type: feature, size: S, deps: [T2.1]}
  - {id: T2.3b, title: "Commit rows with relative dates", type: feature, size: S, deps: [T2.3a]}
  - {id: T2.3c, title: "Load more commits", type: feature, size: S, deps: [T2.3b]}
  - {id: T2.4, title: "Error state when git is missing", type: feature, size: S, deps: [T2.1]}
  - {id: T2.5, title: "Document the panel", type: docs, size: S, deps: [T2.2, T2.3]}
  - {id: T3.1, title: "Refresh on file changes", type: feature, size: M, deps: [T2.2]}
  - {id: T3.2, title: "Keyboard navigation", type: feature, size: S, deps: [T2.2]}
  - {id: T3.3, title: "Screen reader labels", type: feature, size: S, deps: [T3.2]}
  - {id: T3.4, title: "Polling fallback for file watching", type: feature, size: S, deps: [T3.1]}
---
# git-panel — plan

## Phases

1. **Core** — the git layer and the CLI entry.
2. **Panel** — every state of the side panel.
3. **Polish** — refresh speed and accessibility.

## Critical path

T1.1 → T1.3 → T1.4 → T2.1 → T2.2 → T3.1

## Risks

Porcelain output differs on old git versions (AS-1).

## Out of plan

Staging and committing.
