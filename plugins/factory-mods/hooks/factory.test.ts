import { describe, expect, test } from 'claude-code/testing'
import { checkDoc } from './schemas'
import { dumpYaml, parseYaml, renderDoc, splitFrontmatter } from './yaml'

const STATE = `---
schema: factory.state/1
feature: usage-panel
mode: existing
until: build
status: active
phase: 4
spec: approved
updated: 2026-10-19
tasks:
  - id: T1.1
    title: Usage store
    status: done
    gates: {test-runner: PASS, code-reviewer: PASS}
    loops: 1
  - id: T1.2
    status: in_progress   # implementer running
waiting_on_user:
- text: "Pick chart library: A or B?"
  kind: adr
  ref: ADR-0003
  since: 2026-10-18
decisions: []
next: [T1.2 implement]
---

# STATE — usage-panel
`

const PLAN = `---
schema: factory.plan/1
feature: usage-panel
spec: .specs/usage-panel/spec.md
phases:
  - id: 1
    name: Core
    tasks:
      - id: T1.1
        title: Usage store
        type: feature
        ui: false
        depends_on: []
        parallel_with: [T1.2]
        implements: [SPEC-1, SPEC-2]
        scope: [src/usage/store.ts]
      - id: T1.2
        title: Gauge component
        type: ui
        ui: true
        depends_on: [T1.1]
        parallel_with: []
        implements: [SPEC-3]
        scope: [src/usage/gauge.tsx]
---

# Usage panel — plan

## Phase 1 — Core
### T1.1 Usage store
### T1.2 Gauge component
`

describe('yaml', () => {
  test('parses block maps, lists of maps, flow collections and comments', async () => {
    const [data] = splitFrontmatter(STATE)
    expect(data?.phase).toBe(4)
    expect(data?.updated).toBe('2026-10-19')
    expect(data?.tasks).toEqual([
      { id: 'T1.1', title: 'Usage store', status: 'done', gates: { 'test-runner': 'PASS', 'code-reviewer': 'PASS' }, loops: 1 },
      { id: 'T1.2', status: 'in_progress' },
    ])
    expect(data?.waiting_on_user).toEqual([
      { text: 'Pick chart library: A or B?', kind: 'adr', ref: 'ADR-0003', since: '2026-10-18' },
    ])
    expect(data?.next).toEqual(['T1.2 implement'])
  })

  test('parses block scalars and wrapped plain scalars', async () => {
    expect(parseYaml('a: |\n  one\n  two\nb: >-\n  three\n  four\nc: five\n  six\n')).toEqual({
      a: 'one\ntwo\n',
      b: 'three four',
      c: 'five six',
    })
  })

  test('reports a parse error with its line', async () => {
    expect(() => parseYaml('a: 1\n  b: 2\n')).toThrow(/line 2/)
  })

  test('round-trips what it writes', async () => {
    const value = {
      schema: 'factory.task-stats/1',
      phase: '1',
      started_at: '2026-10-19T09:16:24Z',
      title: 'Store: v2 # draft',
      cache_hit_rate: 0.9558,
      done_at: null,
      models: ['claude-opus-5-5'],
      by_agent: { implementer: { runs: 2, tokens: { input: 1, output: 2 } } },
      run_ids: [],
    }
    const [data] = splitFrontmatter(renderDoc(value, '# body'))
    expect(data).toEqual(value)
    expect(parseYaml(dumpYaml(value).join('\n'))).toEqual(value)
  })
})

describe('frontmatter checks', () => {
  const plan = splitFrontmatter(PLAN)[0]

  test('a valid STATE.md and plan.md pass', async () => {
    expect(checkDoc(['.plan', 'usage-panel', 'STATE.md'], STATE, plan)).toEqual([])
    expect(checkDoc(['.plan', 'usage-panel', 'plan.md'], PLAN)).toEqual([])
  })

  test('a missing frontmatter is reported', async () => {
    const errors = checkDoc(['.plan', 'usage-panel', 'STATE.md'], '# STATE\nMode: existing\n')
    expect(errors[0]).toMatch(/no YAML frontmatter/)
  })

  test('bad values and unknown task ids are reported', async () => {
    const bad = STATE.replace('status: done', 'status: finished').replace('id: T1.2', 'id: T9.9')
    const errors = checkDoc(['.plan', 'usage-panel', 'STATE.md'], bad, plan)
    expect(errors).toContain("`tasks[0].status` is 'finished', expected one of: todo, in_progress, review, done, blocked")
    expect(errors).toContain('task T9.9 in `tasks` is not in plan.md (use the exact task ids from plan.md)')
  })

  test('plan tasks must match the body and each other', async () => {
    const bad = PLAN.replace('depends_on: [T1.1]', 'depends_on: [T0.1]').replace('### T1.2 Gauge component\n', '')
    const errors = checkDoc(['.plan', 'usage-panel', 'plan.md'], bad)
    expect(errors).toContain("task T1.2: `depends_on` names unknown task 'T0.1'")
    expect(errors).toContain("task T1.2 has no '### T1.2 <title>' section in the body")
  })

  test('an ADR id must match its file name', async () => {
    const adr = `---
schema: factory.adr/1
id: ADR-0002
feature: usage-panel
title: Chart library
status: proposed
impact: major
options:
  - {id: A, title: Hand-drawn gauges}
  - {id: B, title: ink-chart}
recommendation: C
---
`
    expect(checkDoc(['.specs', 'usage-panel', 'adr', '0003-chart-library.md'], adr)).toEqual([
      '`id` must be ADR-0003 to match the file name',
      "`recommendation` is 'C', which is not an option id",
    ])
  })
})
