---
schema: factory.spec-area/2
feature: git-panel
area: GIT
items:
  - {id: SPEC-GIT-1, title: "Runs git without writing", covers: [AC-1.1], refs: [C-GIT-RUNNER]}
  - {id: SPEC-GIT-2, title: "Times out a git call after 5 seconds", covers: [AC-1.2], refs: [C-GIT-RUNNER]}
  - {id: SPEC-GIT-3, title: "Parses the branch header, detached HEAD included", covers: [AC-1.3], refs: [AS-1]}
  - {id: SPEC-GIT-4, title: "Parses changed, renamed and untracked entries", covers: [AC-2.1], refs: [AS-1]}
  - {id: SPEC-GIT-5, title: "Prints the status through the CLI entry as JSON", covers: [AC-2.2], refs: []}
---
# GIT — Read-only git layer

## Behavior

### SPEC-GIT-1 — Runs git without writing
### SPEC-GIT-2 — Times out a git call after 5 seconds
### SPEC-GIT-3 — Parses the branch header, detached HEAD included
### SPEC-GIT-4 — Parses changed, renamed and untracked entries
### SPEC-GIT-5 — Prints the status through the CLI entry as JSON
