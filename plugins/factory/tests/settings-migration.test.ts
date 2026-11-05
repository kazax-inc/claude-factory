import { expect, test } from 'claude-code/testing'
import { migrate } from '../hooks/register'

// A template in the layout of skills/factory/templates/settings.json.
const TEMPLATE = `{
  "$schema": "https://example.invalid/settings-1.json",
  "schema": "factory.settings/1",
  "agents": {
    "architect": { "model": "opus", "effort": "high" },
    "decision": { "model": "opus", "effort": "xhigh" }
  },
  "workflow": {
    "until": "plan",
    "decisions": "agent"
  },
  "project": {
    "commands": {}
  }
}
`

// The same project's settings written by an older plugin, with values of its own.
const OLD = JSON.stringify({
  $schema: 'https://example.invalid/settings-1.json',
  schema: 'factory.settings/1',
  agents: { architect: { model: 'sonnet', effort: 'medium' } },
  workflow: { until: 'build' },
  project: { commands: { test: 'npm test' } },
})

test('adds the keys a newer template has and keeps every value of the file', () => {
  const result = migrate(OLD, TEMPLATE)

  expect(result?.added).toEqual(['agents.decision', 'workflow.decisions'])
  expect(JSON.parse(result?.text ?? '')).toEqual({
    $schema: 'https://example.invalid/settings-1.json',
    schema: 'factory.settings/1',
    agents: {
      architect: { model: 'sonnet', effort: 'medium' },
      decision: { model: 'opus', effort: 'xhigh' },
    },
    workflow: { until: 'build', decisions: 'agent' },
    project: { commands: { test: 'npm test' } },
  })
})

test('lays the file out like the template', () => {
  const old = JSON.parse(TEMPLATE)
  delete old.workflow.decisions

  expect(migrate(JSON.stringify(old), TEMPLATE)?.text).toBe(TEMPLATE)
})

test('leaves a complete, invalid or foreign file alone', () => {
  expect(migrate(TEMPLATE, TEMPLATE)).toBeUndefined()
  expect(migrate('{ "schema": ', TEMPLATE)).toBeUndefined()
  expect(migrate('{ "schema": "factory.settings/2" }', TEMPLATE)).toBeUndefined()
})

test('at session start, writes the missing keys and logs one line', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  const writes: { path: string; text: string }[] = []
  const logs: string[] = []
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_, e) => ({ value: e.path.endsWith('templates/settings.json') ? TEMPLATE : OLD }))
  on('fs.write', (_, e) => {
    writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  on('ui.log', (_, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/project', surface: null, isInteractive: false })

  expect(writes.map(w => w.path)).toEqual(['/project/.factory/settings.json'])
  expect(JSON.parse(writes[0]?.text ?? '').workflow.decisions).toBe('agent')
  expect(logs).toEqual([
    'factory: added agents.decision, workflow.decisions to .factory/settings.json, with their default values',
  ])
})

test('a project without factory settings is not touched', async ($, on) => {
  const touched: string[] = []
  on('fs.exists', () => ({ value: false }))
  on('fs.read', (_, e) => {
    touched.push(e.path)
    return { value: '' }
  })
  on('fs.write', (_, e) => {
    touched.push(e.path)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/project', surface: null, isInteractive: false })

  expect(touched).toEqual([])
})

test('a failed read never stops the session', async ($, on) => {
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => {
    throw new Error('EACCES')
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  expect(await $.session.start({ cwd: '/project', surface: null, isInteractive: false })).toEqual({ cwd: '/project' })
})
