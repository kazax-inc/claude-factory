// factory-plan-pane: a pane that shows the factory plan's progress as a tree
// of phases, tasks, split subtasks and the SPEC items each task implements,
// read from the project's .factory folder (the factory plugin's layout). It
// reads and never writes those files, and works without the factory plugin
// installed: with no .factory folder it says the factory is not initialized.

import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, Timer } from 'claude-code'

import type { PlanFeature, PlanSnapshot } from '../types'
import { briefFeature, chooseRoot, fingerprint, loadSnapshot } from './load'
import {
  STAGES,
  allTasks,
  expandableKeys,
  fit,
  flatten,
  progress,
  specCoverage,
  type Row,
  type Shown,
} from './tree'

const PANE = 'factory-plan'
const TITLE = 'Factory plan'
const POLL_MS = 4000
const RELOAD_DELAY_MS = 300
const FACTORY_PATH = /(^|[\\/])\.factory[\\/]/

// Change a tag when that value's shape changes: an older value is then read
// as the initial instead of being misread after a reload.
const snapshot = atom({ plugin: 'factory-plan-pane', key: 'snapshot' } as const, null, { shape: 'snapshot-1' })
const expanded = atom({ plugin: 'factory-plan-pane', key: 'expanded' } as const, {}, { shape: 'expanded-1' })
const rootChoice = atom({ plugin: 'factory-plan-pane', key: 'root' } as const, '')
const featureChoice = atom({ plugin: 'factory-plan-pane', key: 'feature' } as const, '')
const runningFeatures = atom({ plugin: 'factory-plan-pane', key: 'running' } as const, [])

/** Agent statuses that still count as working (AgentStatus). */
const WORKING = new Set(['pending', 'running', 'waiting'])

type Els = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

const LOOK: Record<Shown, { glyph: string; color: string; word: string }> = {
  done: { glyph: '✓', color: 'success', word: 'done' },
  in_progress: { glyph: '◐', color: 'suggestion', word: 'in progress' },
  todo: { glyph: '○', color: 'inactive', word: 'to do' },
  blocked: { glyph: '✗', color: 'error', word: 'blocked' },
  dropped: { glyph: '⊘', color: 'inactive', word: 'dropped' },
}

/** The folder whose .factory the pane reads: the chosen one, else the session's project. */
async function projectRoot($: EngineInterface): Promise<string> {
  const chosen = await read($, rootChoice)
  return chosen !== '' ? chosen : $.session.root()
}

/** `path` relative to the session's project when inside it. */
function shortPath(path: string, sessionRoot: string): string {
  if (path === sessionRoot) return path
  return path.startsWith(`${sessionRoot}/`) ? path.slice(sessionRoot.length + 1) : path
}

function pickFeature(snap: PlanSnapshot, chosen: string): PlanFeature | undefined {
  const { features } = snap
  return (
    features.find(feature => feature.name === chosen) ??
    features.find(feature => feature.name === snap.active) ??
    features.find(feature => feature.hasPlan) ??
    features[0]
  )
}

type Mark = { text: string; color: string }

/**
 * The icons after a feature's stage: a green dot while a factory agent works
 * on it in this session, the tree's blocked mark when any of its tasks is
 * blocked, and its done mark once the feature is done.
 */
function featureIcons(feature: PlanFeature, isRunning: boolean): Mark[] {
  const icons: Mark[] = []
  if (isRunning) icons.push({ text: '●', color: 'success' })
  if (progress(allTasks(feature)).blocked > 0) icons.push({ text: LOOK.blocked.glyph, color: LOOK.blocked.color })
  if (feature.status === 'done' || feature.stage === 'done') icons.push({ text: LOOK.done.glyph, color: LOOK.done.color })
  return icons
}

/** What the feature's STATE.md says when it needs the person: waiting on them, or paused. */
function featureNote(feature: PlanFeature): Mark | undefined {
  if (feature.status === 'waiting_on_user') return { text: '(waiting on you)', color: 'warning' }
  if (feature.status === 'paused') return { text: '(paused)', color: 'inactive' }
  return undefined
}

function describe(snap: PlanSnapshot, sessionRoot: string): string {
  const where = shortPath(snap.root, sessionRoot)
  if (!snap.isInitialized) return `the factory plugin is not initialized in ${where}`
  const feature = pickFeature(snap, '')
  if (feature === undefined) return `no factory feature yet in ${where}`
  if (!feature.hasPlan) return `${feature.name} has no plan yet (stage ${feature.stage || 'unknown'})`
  const { done, total } = progress(allTasks(feature))
  return `${feature.name}, ${done}/${total} tasks done`
}

// Module variables start over on a reload of the module; session.start runs
// again then and reads the plan afresh.
let autoOpen = true
let hasPlan = false
let hasAutoOpened = false
let lastFingerprint = ''
let pending: Timer | undefined
let inFlight: Promise<PlanSnapshot | undefined> | undefined
let isQueued = false
/** Factory subagents working now: agent id to the feature its brief names. */
const agents = new Map<string, string>()

/** Writes the features the tracked agents work on, when they changed. */
async function syncRunning($: EngineInterface): Promise<void> {
  const names = [...new Set(agents.values())].sort()
  const now = await read($, runningFeatures)
  if (now.length === names.length && now.every((name, index) => name === names[index])) return
  await update($, runningFeatures, () => names)
}

/** Drops tracked agents the session no longer lists as working (stopped, failed). */
async function pruneAgents($: EngineInterface): Promise<void> {
  if (agents.size === 0) return
  const listed = await $.agent.list()
  for (const id of [...agents.keys()]) {
    const agent = listed.find(one => one.id === id)
    if (agent === undefined || !WORKING.has(agent.status)) agents.delete(id)
  }
  await syncRunning($)
}

async function reload($: EngineInterface): Promise<PlanSnapshot> {
  const root = await projectRoot($)
  const next = await loadSnapshot($, root)
  lastFingerprint = await fingerprint($, root).catch(() => '')
  hasPlan = next.features.some(feature => feature.hasPlan)
  await update($, snapshot, () => next)
  return next
}

async function drain($: EngineInterface): Promise<PlanSnapshot | undefined> {
  let last: PlanSnapshot | undefined
  try {
    do {
      isQueued = false
      last = await reload($)
    } while (isQueued)
  } finally {
    inFlight = undefined
  }
  return last
}

/** One read at a time; a request during a read runs once more after it. */
function requestReload($: EngineInterface): Promise<PlanSnapshot | undefined> {
  if (inFlight !== undefined) {
    isQueued = true
    return inFlight
  }
  inFlight = drain($)
  return inFlight
}

/** A read shortly after a burst of writes, once. */
function scheduleReload($: EngineInterface): void {
  pending?.cancel()
  pending = $.clock.after(RELOAD_DELAY_MS, () => {
    pending = undefined
    void requestReload($).catch(() => undefined)
  })
}

/**
 * While the pane is shown, re-reads when a STATE.md or plan.md changed on
 * disk: the factory's agents, another session or an editor wrote it.
 */
async function poll($: EngineInterface): Promise<void> {
  const panes = await $.ui.panes()
  if (!panes.some(pane => pane.id === PANE && pane.isPlaced && pane.isShown)) return
  await pruneAgents($)
  const now = await fingerprint($, await projectRoot($))
  if (now !== lastFingerprint) await requestReload($)
}

export const register: Register = (on, options) => {
  autoOpen = options.autoOpen !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'factory-plan',
      description: 'Show the factory plan in a pane (optionally for another project folder)',
      argumentHint: '[project folder]',
    })
    // A reload forgets which agents were tracked: start from none running.
    agents.clear()
    await update($, runningFeatures, () => [])
    await requestReload($).catch(() => undefined)
    $.clock.every(POLL_MS, () => void poll($).catch(() => undefined))
    return next(e)
  })

  on('command.run', { command: 'factory-plan' }, async ($, e) => {
    const sessionRoot = await $.session.root()
    if (e.args.trim() !== '') {
      const chosen = chooseRoot(sessionRoot, e.args)
      if (chosen !== '') {
        const stat = await $.fs.stat(chosen).catch(() => undefined)
        if (stat?.kind !== 'dir') return { text: `factory-plan: no folder at ${chosen}` }
      }
      await update($, rootChoice, () => chosen)
      await update($, featureChoice, () => '')
    }
    const snap = await requestReload($)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    const about = snap === undefined ? '' : `: ${describe(snap, sessionRoot)}`
    return {
      text: opened.isPlaced
        ? `Factory plan pane opened${about}.`
        : `Factory plan pane waits to be drawn (${opened.reason})${about}.`,
    }
  })

  // Writes the factory's agents make under .factory, and each turn's end.
  // Observers: a failure here must never change the tool call's outcome.
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const result = await next(e)
    if (FACTORY_PATH.test(e.file_path)) scheduleReload($)
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const result = await next(e)
    if (FACTORY_PATH.test(e.file_path)) scheduleReload($)
    return result
  }).catch(($, e, next) => next(e))

  // A feature runs from the start of a subagent briefed for it (the brief
  // opens with `Feature: <name>`) until that agent's own turn completes.
  on('agent.spawn', async ($, e, next) => {
    const feature = briefFeature(e.prompt)
    const started = await next(e)
    if (feature !== undefined && started.agentId !== undefined) {
      agents.set(started.agentId, feature)
      await syncRunning($)
    }
    return started
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined && agents.delete(e.agentId)) await syncRunning($)
    scheduleReload($)
    return next(e)
  })

  // Opens the pane by itself once, where it is a sidebar (fullscreen), and
  // only in a project that has a factory plan.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (autoOpen && hasPlan && !hasAutoOpened && e.viewport?.isFullscreen === true) {
      hasAutoOpened = true
      void $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const els: Els = { Box, Text, Button }
    const width = Math.max(24, e.props.bodyColumns)
    const snap = await read($, snapshot)
    const refresh = (
      <Button key="refresh" plain hotkey="r" label="Refresh" onPress={() => void requestReload($)} />
    )

    if (snap === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Reading the factory plan…</Text>
          {refresh}
        </Box>
      )
    }

    const sessionRoot = await $.session.root()
    const isElsewhere = snap.root !== sessionRoot
    const where = shortPath(snap.root, sessionRoot)
    const project = isElsewhere ? (
      <Text dimColor>
        Project: {where} {'(/factory-plan . for this one)'}
      </Text>
    ) : null

    if (!snap.isInitialized) {
      return (
        <Box flexDirection="column">
          <Text weight="bold">Factory plan</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="warning">The factory plugin is not initialized in this project.</Text>
            <Text dimColor>No .factory folder in {snap.root}.</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text>
              With the factory plugin installed, run <Text weight="bold">/factory setup</Text> or{' '}
              <Text weight="bold">/factory new</Text> to start a plan here.
            </Text>
            <Text dimColor>{'/factory-plan <folder> shows the plan of another project.'}</Text>
          </Box>
          <Box marginTop={1}>{refresh}</Box>
        </Box>
      )
    }

    const chosen = await read($, featureChoice)
    const feature = pickFeature(snap, chosen)
    if (feature === undefined) {
      return (
        <Box flexDirection="column">
          <Text weight="bold">Factory plan</Text>
          <Text dimColor>The factory is set up here but has no feature yet.</Text>
          <Text dimColor>{'Run /factory new <idea> to start one.'}</Text>
          {project}
          <Box marginTop={1}>{refresh}</Box>
        </Box>
      )
    }

    const running = await read($, runningFeatures)
    const choices = await read($, expanded)
    const rows = flatten(feature, choices)
    const keys = expandableKeys(feature)
    const setAll = (isOpen: boolean) =>
      update($, expanded, map => ({ ...map, ...Object.fromEntries(keys.map(key => [key, isOpen])) }))
    const toggle = (row: Row) =>
      update($, expanded, map => {
        const byDefault = row.kind === 'phase' && row.isCurrent
        return { ...map, [row.key]: !(map[row.key] ?? byDefault) }
      })

    return (
      <Box flexDirection="column">
        {snap.features.length > 1
          ? featureList(els, snap, feature, running, name => update($, featureChoice, () => name))
          : null}
        {header(els, snap, feature, running.includes(feature.name), width)}
        {feature.hasPlan ? (
          <Box flexDirection="row" gap={2} marginTop={1}>
            <Button key="expand-all" plain hotkey="e" label="Expand all" onPress={() => void setAll(true)} />
            <Button key="collapse-all" plain hotkey="c" label="Collapse all" onPress={() => void setAll(false)} />
            {refresh}
          </Box>
        ) : null}
        {feature.hasPlan ? (
          <Box flexDirection="column" marginTop={1}>
            {rows.length === 0 ? <Text dimColor>The plan has no phases yet.</Text> : null}
            {rows.map(row => treeRow(els, row, width, () => void toggle(row)))}
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>No plan yet: this feature is at the {feature.stage || 'first'} stage.</Text>
            <Box marginTop={1}>{refresh}</Box>
          </Box>
        )}
        {footer(els, feature, project)}
      </Box>
    )
  })
}

/** One row per feature, `● <feature> [<stage>] <icons> (<note>)`; a press shows that feature. */
function featureList(
  els: Els,
  snap: PlanSnapshot,
  shown: PlanFeature,
  running: readonly string[],
  choose: (name: string) => unknown,
) {
  const { Box, Button, Text } = els
  return (
    <Box flexDirection="column" marginBottom={1}>
      {snap.features.map(feature => {
        const isShown = feature.name === shown.name
        const marks = [...featureIcons(feature, running.includes(feature.name)), featureNote(feature)]
        return (
          <Button key={`feature:${feature.name}`} plain onPress={() => void choose(feature.name)}>
            <Text color={isShown ? 'claude' : undefined} weight={isShown ? 'bold' : undefined} dimColor={!isShown}>
              {`${isShown ? '●' : '○'} ${feature.name}`}
            </Text>
            {feature.stage !== '' ? <Text dimColor>{` [${feature.stage}]`}</Text> : ''}
            {marks.map(mark => (mark === undefined ? '' : <Text color={mark.color}>{` ${mark.text}`}</Text>))}
          </Button>
        )
      })}
    </Box>
  )
}

function header(els: Els, snap: PlanSnapshot, feature: PlanFeature, isRunning: boolean, width: number) {
  const { Box, Text } = els
  const icons = featureIcons(feature, isRunning)
  const words = feature.status === 'waiting_on_user' ? 'waiting on you' : feature.status === 'paused' ? 'paused' : ''
  const state = [words, feature.name === snap.active ? 'active feature' : '']
    .filter(part => part !== '')
    .join(' · ')
  const tasks = progress(allTasks(feature))
  const specs = specCoverage(feature)
  const percent = tasks.total === 0 ? 0 : Math.round((tasks.done * 100) / tasks.total)
  const cells = Math.max(8, Math.min(24, width - 24))
  const filled = tasks.total === 0 ? 0 : Math.round((cells * tasks.done) / tasks.total)
  const counts = [
    tasks.active > 0 ? `${tasks.active} in progress` : '',
    tasks.blocked > 0 ? `${tasks.blocked} blocked` : '',
    tasks.dropped > 0 ? `${tasks.dropped} dropped` : '',
    specs.total > 0 ? `specs ${specs.done}/${specs.total}` : '',
  ].filter(part => part !== '')

  return (
    <Box flexDirection="column">
      <Text>
        <Text weight="bold">{feature.name}</Text>
        {icons.map(icon => (
          <Text color={icon.color}>{` ${icon.text}`}</Text>
        ))}
        {state !== '' ? <Text dimColor>{` · ${state}`}</Text> : null}
      </Text>
      {feature.summary !== '' ? <Text dimColor>{feature.summary}</Text> : null}
      <Box marginTop={1}>{stageStrip(els, feature.stage, width)}</Box>
      {feature.hasPlan ? (
        <Text>
          <Text color="success">{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(cells - filled)}</Text>
          {` ${tasks.done}/${tasks.total} tasks · ${percent}%`}
        </Text>
      ) : null}
      {counts.length > 0 ? <Text dimColor>{counts.join(' · ')}</Text> : null}
      {feature.waiting.length > 0 ? (
        <Text color="warning">
          {`⚠ Waiting on you${feature.waiting.length > 1 ? ` (${feature.waiting.length})` : ''}: ${feature.waiting[0]}`}
        </Text>
      ) : null}
    </Box>
  )
}

function stageStrip(els: Els, stage: string, width: number) {
  const { Text } = els
  const at = (STAGES as readonly string[]).indexOf(stage)
  if (at < 0) return <Text dimColor>Stage: {stage || 'unknown'}</Text>
  if (STAGES.join(' › ').length > width) {
    return (
      <Text>
        {'Stage '}
        <Text color="claude" weight="bold">
          {stage}
        </Text>
        <Text dimColor>{` (${at + 1}/${STAGES.length})`}</Text>
      </Text>
    )
  }
  return (
    <Text>
      {STAGES.flatMap((name, index) => [
        index > 0 ? <Text dimColor>{' › '}</Text> : '',
        <Text
          color={index < at ? 'success' : index === at ? 'claude' : 'inactive'}
          weight={index === at ? 'bold' : undefined}
        >
          {name}
        </Text>,
      ])}
    </Text>
  )
}

function treeRow(els: Els, row: Row, width: number, toggle: () => void) {
  const { Box, Button, Text } = els
  const look = LOOK[row.status]
  const indent = row.depth * 2
  const caret = row.isExpandable ? (row.isOpen ? '▾ ' : '▸ ') : '  '
  const glyph = row.kind === 'spec' ? (row.status === 'done' ? '✓' : '·') : look.glyph
  const meta = row.meta === '' ? '' : `  ${row.meta}`
  const current = row.isCurrent ? '  ◂ current' : ''
  const room = Math.max(4, width - indent - caret.length - 2 - meta.length - current.length)
  const label = fit(row.label, room)
  const isDropped = row.status === 'dropped'
  const parts = [
    caret,
    <Text color={row.kind === 'spec' && row.status !== 'done' ? 'inactive' : look.color}>{glyph}</Text>,
    ' ',
    <Text
      weight={row.kind === 'phase' ? 'bold' : undefined}
      dimColor={row.kind === 'spec' || isDropped}
      strikethrough={isDropped}
    >
      {label}
    </Text>,
    meta === '' ? '' : <Text dimColor>{meta}</Text>,
    current === '' ? '' : <Text color="claude">{current}</Text>,
  ]
  return (
    <Box paddingLeft={indent}>
      {row.isExpandable ? (
        <Button key={row.key} plain onPress={toggle}>
          {parts}
        </Button>
      ) : (
        <Text>{parts}</Text>
      )}
    </Box>
  )
}

function footer(els: Els, feature: PlanFeature, project: JSX.Element | null) {
  const { Box, Text } = els
  const legend = (['done', 'in_progress', 'todo', 'blocked', 'dropped'] as const).flatMap((status, index) => [
    index > 0 ? '  ' : '',
    <Text color={LOOK[status].color}>{LOOK[status].glyph}</Text>,
    <Text dimColor>{` ${LOOK[status].word}`}</Text>,
  ])
  return (
    <Box flexDirection="column" marginTop={1}>
      {feature.next.length > 0 ? <Text>{`Next: ${feature.next[0]}`}</Text> : null}
      {feature.hasPlan ? <Text>{legend}</Text> : null}
      {feature.problems.length > 0 ? (
        <Text color="warning">
          {`${feature.problems.length} file${feature.problems.length === 1 ? '' : 's'} not read: ${feature.problems[0]}`}
        </Text>
      ) : null}
      {project}
    </Box>
  )
}
