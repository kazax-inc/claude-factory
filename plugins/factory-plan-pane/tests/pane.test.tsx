import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { ROOT, project, serve } from './support'

const PLUGIN = 'factory-plan-pane'
const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'factory-plan',
  props: {
    title: 'Factory plan',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

// Nothing sits beneath the plugin: these hooks stand for the engine.
async function start($: Engine, on: On, files: Record<string, string>) {
  serve(on, files)
  const clock = mock.clock(on)
  on('session.root', () => ({ value: ROOT }))
  on('command.register', () => ({ value: { command: 'factory-plan' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  return clock
}

test('without a .factory folder the pane says the factory is not initialized', async ($, on) => {
  await start($, on, {})
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /factory plugin is not initialized/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: `No .factory folder in ${ROOT}.` })).toBeDefined()
    expect(await ui.find({ key: 'expand-all' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the current phase starts open and the others closed, on every surface', async ($, on) => {
  await start($, on, project())
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'alpha:P1' }))?.text).toMatch(/Phase 1 · Core\s+3\/4/)
    expect((await ui.find({ key: 'alpha:P2' }))?.text).toMatch(/Phase 2 · UI\s+0\/2\s+◂ current/)
    expect(await ui.find({ key: 'alpha:T2.1' })).toBeDefined()
    expect(await ui.find({ key: 'alpha:T1.2' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the header shows stage, progress, counts and what waits on the person', async ($, on) => {
  await start($, on, project())
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Alpha shows the data in a panel.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3\/6 tasks · 50%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '1 in progress · 1 blocked · 1 dropped · specs 3/7' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '⚠ Waiting on you: Pick the "storage" option of ADR-0003' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Next: Run T1.3b round 2' })).toBeDefined()
  await ui.unmount()
})

test('a phase and a split task open and close on press', async ($, on) => {
  await start($, on, project())
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'alpha:P1' })
  expect((await ui.find({ key: 'alpha:T1.2' }))?.text).toMatch(/T1\.2 Runner\s+feature M · 2 loops/)
  expect((await ui.find({ key: 'alpha:T1.3' }))?.text).toMatch(/T1\.3 Parser\s+split · 1\/2/)
  expect(await ui.find({ key: 'alpha:T1.3a' })).toBeUndefined()

  await ui.press({ key: 'alpha:T1.3' })
  expect(await ui.find({ key: 'alpha:T1.3a' })).toBeDefined()
  expect(await ui.find({ key: 'alpha:T1.3b' })).toBeDefined()

  await ui.press({ key: 'alpha:P1' })
  expect(await ui.find({ key: 'alpha:T1.2' })).toBeUndefined()

  await ui.press({ key: 'alpha:P2' })
  expect(await ui.find({ key: 'alpha:T2.1' })).toBeUndefined()
  await ui.unmount()
})

test('expand all shows subtasks and spec items; collapse all leaves the phases', async ($, on) => {
  await start($, on, project())
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await ui.press({ key: 'expand-all' })
  expect(await ui.find({ key: 'alpha:T1.3a' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /SPEC-A-3 Parses the header/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /SPEC-B-1 Lays out three sections/ })).toBeDefined()

  await ui.press({ key: 'collapse-all' })
  expect(await ui.find({ key: 'alpha:P1' })).toBeDefined()
  expect(await ui.find({ key: 'alpha:P2' })).toBeDefined()
  expect(await ui.find({ key: 'alpha:T2.1' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /SPEC-/ })).toBeUndefined()
  await ui.unmount()
})

test('another feature is chosen from the tabs; one with no plan says so', async ($, on) => {
  await start($, on, project())
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'feature:alpha' }))?.text).toBe('● alpha ★')

  await ui.press({ key: 'feature:beta' })
  expect(await ui.find({ type: 'Text', text: /No plan yet: this feature is at the specify stage/ })).toBeDefined()
  expect(await ui.find({ key: 'expand-all' })).toBeUndefined()
  await ui.unmount()
})

test('/factory-plan <folder> shows the plan of another project, and . comes back', async ($, on) => {
  await start($, on, { ...project('/proj/demo') })
  const run = (args: string) =>
    $.command.run({
      command: 'factory-plan',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })

  expect((await run('demo')).text).toBe('Factory plan pane opened: alpha, 3/6 tasks done.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'alpha:P2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Project: demo/ })).toBeDefined()

  expect((await run('.')).text).toBe(`Factory plan pane opened: the factory plugin is not initialized in ${ROOT}.`)
  expect(await ui.find({ type: 'Text', text: /factory plugin is not initialized/ })).toBeDefined()

  expect((await run('nowhere')).text).toBe(`factory-plan: no folder at ${ROOT}/nowhere`)
  await ui.unmount()
})

test('a write under .factory reads the plan again', async ($, on) => {
  const files = project()
  const clock = await start($, on, files)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'alpha:P2' }))?.text).toMatch(/0\/2/)

  files[`${ROOT}/.factory/plans/alpha/STATE.md`] = files[`${ROOT}/.factory/plans/alpha/STATE.md`]!.replace(
    '{id: T2.1, status: blocked',
    '{id: T2.1, status: done',
  )
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/.factory/plans/alpha/STATE.md`, old_string: 'a', new_string: 'b' })
  await clock.advance(1000)
  expect((await ui.find({ key: 'alpha:P2' }))?.text).toMatch(/1\/2/)
  await ui.unmount()
})
