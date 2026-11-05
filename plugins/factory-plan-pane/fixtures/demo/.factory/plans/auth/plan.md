---
schema: factory.plan/2
feature: auth
phases:
  - {id: 1, name: "Login", goal: "Both sign-in paths work end to end"}
tasks:
  - {id: T1.1, title: "Session store", type: feature, size: S, deps: []}
  - {id: T1.2, title: "Password login", type: feature, size: M, deps: [T1.1]}
  - {id: T1.3, title: "Magic link login", type: feature, size: M, deps: [T1.1], parallel_with: [T1.2]}
---
# auth — plan
