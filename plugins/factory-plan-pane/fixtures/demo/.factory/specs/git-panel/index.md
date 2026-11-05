---
schema: factory.spec/2
feature: git-panel
summary: "A read-only side panel showing the current branch, the working tree status and recent commits."
areas:
  - {code: GIT, title: "Read-only git layer", scope: "Running git, parsing its output, refusing writes."}
  - {code: PANEL, title: "Panel UI", scope: "Layout, states and refresh of the side panel."}
  - {code: NFR, title: "Non-functional", scope: "Refresh speed and accessibility."}
assumptions:
  - {id: AS-1, text: "git 2.30+ prints porcelain v2 for status", blocking: true}
open_issues: []
---
# git-panel — spec

## Summary

A side panel that shows where the repository stands without leaving the editor.

## Scope

Branch, status and the last commits. Nothing in the panel writes to the repository.

## Non-goals

Staging, committing, pushing.

## How to read this spec

Ids resolve to files under `.factory/specs/git-panel/`.
