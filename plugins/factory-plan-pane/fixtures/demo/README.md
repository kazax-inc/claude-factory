# Demo project (mock factory data)

A mock `.factory/` folder for developing and trying the factory-plan-pane mod in a project that
has no factory plan of its own. It follows the factory plugin's data model (schemas
`factory.*/2`) and holds three features:

- `git-panel` (active): building phase 2 of 3, with split tasks, a blocked task, a dropped task,
  loops and a question waiting on the user;
- `auth`: done;
- `search`: still at the specify stage, so it has no plan yet.

Point the pane at it from the repository root:

```
/factory-plan plugins/factory-plan-pane/fixtures/demo
```

`/factory-plan .` goes back to the session's own project.
