// The factory-mods plugin's hooks, for the factory plugin's pipeline:
//   - after an agent writes a .plan/ or .specs/ file, check its YAML frontmatter and hand the
//     errors back to that agent (a PostToolUse block), so it fixes the file in the same run;
//   - record the usage of every subagent a /factory brief attributes to a feature and task, and
//     of the orchestrator itself, as Markdown files with a YAML frontmatter under
//     .plan/<feature>/stats/;
//   - `/factory-check`: check every pipeline file and rewrite every task's stats.
// Data formats: ../docs/data.md.

import type { EngineInterface, Register } from 'claude-code'
import { checkDoc, planTasks, STAGE_BY_PHASE, STAGES, TASK_STATUSES } from './schemas'
import {
  addRequest, fmtMs, fmtNum, fmtPct, isoTime, merge, metricsOf, msBetween, newMetrics, statsBody, type Metrics,
} from './stats'
import { renderDoc, splitFrontmatter, type YamlMap } from './yaml'

type $ = EngineInterface
type TaskInfo = { title: string | null; phase: string | null; status: string }
type Run = {
  feature: string
  task: string
  phase: string | null
  agent: string | null
  description: string | null
  effort: string | null
  started_at: string | null
  ended_at: string | null
  turns: number
  metrics: Metrics
}

// The plugin that ships the /factory skill and the agents (`factory:<agent>`).
const FACTORY = 'factory'
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
const SETUP_PHASE = 'setup'
const MAIN = '<main>'

// ---------------------------------------------------------------- files

const norm = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')
const join = (...parts: string[]) => parts.join('/')
const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_')

async function readText($: $, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(path)
  } catch {
    return undefined
  }
}

/** Frontmatter of a Markdown file; undefined when it is missing, has none or does not parse. */
async function readDoc($: $, path: string): Promise<YamlMap | undefined> {
  const text = await readText($, path)
  if (text === undefined) return undefined
  try {
    return splitFrontmatter(text)[0]
  } catch {
    return undefined
  }
}

async function list($: $, path: string) {
  try {
    return await $.fs.list(path)
  } catch {
    return []
  }
}

async function features($: $, root: string): Promise<string[]> {
  return (await list($, join(root, '.plan'))).filter(e => e.kind === 'dir' && SLUG_RE.test(e.name)).map(e => e.name).sort()
}

const now = async ($: $) => isoTime(await $.clock.now())

// Hooks of one session share these files: run their writes one after another.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work)
  queue = run.catch(() => undefined)
  return run
}

// ---------------------------------------------------------------- pipeline state

const asList = (v: unknown): YamlMap[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [])
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

function stageStatuses(state: YamlMap): Record<string, string> {
  const phase = state.phase
  const pos =
    state.status === 'done'
      ? STAGES.length
      : typeof phase === 'number' && STAGE_BY_PHASE[phase]
        ? STAGES.indexOf(STAGE_BY_PHASE[phase]!)
        : -1
  return Object.fromEntries(STAGES.map((s, i) => [s, i < pos ? 'done' : i === pos ? 'in_progress' : 'todo']))
}

/** The setup stages and every plan task, with title, phase and status. */
async function featureTasks($: $, root: string, feature: string): Promise<Map<string, TaskInfo>> {
  const dir = join(root, '.plan', feature)
  const state = (await readDoc($, join(dir, 'STATE.md'))) ?? {}
  const plan = await readDoc($, join(dir, 'plan.md'))
  const out = new Map<string, TaskInfo>()
  for (const [stage, status] of Object.entries(stageStatuses(state)))
    if (stage !== 'build') out.set(stage, { title: stage[0]!.toUpperCase() + stage.slice(1), phase: SETUP_PHASE, status })
  const inState = new Map(asList(state.tasks).map(t => [String(t.id), t]))
  const status = (t?: YamlMap) => ((TASK_STATUSES as readonly unknown[]).includes(t?.status) ? String(t!.status) : 'todo')
  for (const [phase, t] of planTasks(plan)) {
    const st = inState.get(String(t.id))
    out.set(String(t.id), { title: str(t.title) ?? str(st?.title), phase, status: status(st) })
  }
  for (const [id, st] of inState) if (!out.has(id)) out.set(id, { title: str(st.title), phase: null, status: status(st) })
  return out
}

function phaseOf(task: string, plan: YamlMap | undefined): string | null {
  if ((STAGES as readonly string[]).includes(task)) return SETUP_PHASE
  const hit = planTasks(plan).find(([, t]) => String(t.id) === task)
  return hit?.[0] ?? /^T(\d+)\./.exec(task)?.[1] ?? null
}

// ---------------------------------------------------------------- stats files

const statsDir = (root: string, feature: string, kind: string) => join(root, '.plan', feature, 'stats', kind)
const taskStatsPath = (root: string, feature: string, task: string) =>
  join(statsDir(root, feature, 'tasks'), `${safeName(task)}.md`)
const runPath = (root: string, feature: string, runId: string) => join(statsDir(root, feature, 'runs'), `${safeName(runId)}.md`)

async function loadRuns($: $, root: string, feature: string): Promise<YamlMap[]> {
  const dir = statsDir(root, feature, 'runs')
  const files = (await list($, dir)).filter(e => e.kind === 'file' && e.name.endsWith('.md')).map(e => e.name).sort()
  const docs = await Promise.all(files.map(name => readDoc($, join(dir, name))))
  return docs.filter((d): d is YamlMap => !!d?.run_id)
}

/**
 * Sums a task's runs and stamps its status changes into stats/tasks/<task>.md.
 *
 * started_at / done_at are observed: the file holds what was seen so far, so a task reaching
 * done gets the time this runs, and reopening it clears done_at.
 */
async function writeTaskStats($: $, root: string, feature: string, task: string, runs: YamlMap[], info?: TaskInfo) {
  info ??= (await featureTasks($, root, feature)).get(task) ?? { title: null, phase: null, status: 'todo' }
  const path = taskStatsPath(root, feature, task)
  const prev = (await readDoc($, path)) ?? {}
  const at = await now($)
  const mine = runs.filter(r => r.task === task).sort((a, b) => String(a.started_at ?? '').localeCompare(String(b.started_at ?? '')))
  const totals = newMetrics()
  const byAgent: Record<string, Metrics & { runs: number }> = {}
  for (const r of mine) {
    merge(totals, metricsOf(r))
    const agent = (byAgent[str(r.agent) ?? 'unknown'] ??= { runs: 0, ...newMetrics() })
    merge(agent, metricsOf(r))
    agent.runs++
  }
  const starts = [str(prev.started_at), ...mine.map(r => str(r.started_at))].filter((s): s is string => !!s)
  if (!starts.length && info.status !== 'todo') starts.push(at)
  const doneAt = info.status === 'done' ? (prev.status === 'done' ? str(prev.done_at) : null) ?? at : null
  // Wall clock: earliest of (first status change, first run) to latest of (done, last run end).
  const ends = [doneAt, ...mine.map(r => str(r.ended_at))].filter((s): s is string => !!s)
  const first = starts.length ? starts.sort()[0]! : null
  const last = ends.length ? ends.sort().at(-1)! : null
  const { duration_ms: agentMs, ...metrics } = totals
  const record = {
    schema: 'factory.task-stats/1',
    feature,
    phase: info.phase ?? str(mine.find(r => r.phase)?.phase),
    task,
    title: info.title,
    status: info.status,
    started_at: first,
    done_at: doneAt,
    updated_at: at,
    wall_ms: first && last ? msBetween(first, last) : null,
    agent_ms: agentMs,
    runs: mine.length,
    ...metrics,
    by_agent: Object.fromEntries(Object.entries(byAgent).map(([name, { by_model, ...a }]) => [name, a])),
    run_ids: mine.map(r => String(r.run_id)),
  }
  const rows = Object.entries(byAgent)
    .map(([name, a]) => `| ${name} | ${a.runs} | ${fmtMs(a.duration_ms)} | ${fmtNum(a.tokens.total)} | ${fmtPct(a.cache_hit_rate)} |\n`)
    .join('')
  const extra = rows ? `\n| agent | runs | time | tokens | cache hit |\n|---|---|---|---|---|\n${rows}` : ''
  const body = statsBody(`${task} — ${info.title ?? task}`, totals, 'agent time', agentMs, extra).replace(
    '\n\n|',
    `\n\nStatus: ${info.status} · wall ${fmtMs(record.wall_ms)}\n\n|`,
  )
  await $.fs.write(path, renderDoc(record, body))
}

/** Rewrites the stats of every task and setup stage whose status changed since its file was written. */
async function syncFeature($: $, root: string, feature: string, runs?: YamlMap[]) {
  runs ??= await loadRuns($, root, feature)
  for (const [task, info] of await featureTasks($, root, feature)) {
    const prev = await readDoc($, taskStatsPath(root, feature, task))
    if (!prev && info.status === 'todo') continue
    if (prev && prev.status === info.status && str(prev.title) === info.title) continue
    await writeTaskStats($, root, feature, task, runs, info)
  }
}

// ---------------------------------------------------------------- subagent runs

const HEADER_RE = { feature: /^\s*Feature:\s*(.+?)\s*$/m, phase: /^\s*Phase:\s*(.+?)\s*$/m, task: /^\s*Task:\s*(.+?)\s*$/m }

/** Feature / Phase / Task from the briefing header the orchestrator puts on every spawn. */
function briefHeader(prompt: string): Partial<Record<keyof typeof HEADER_RE, string>> {
  const out: Partial<Record<keyof typeof HEADER_RE, string>> = {}
  for (const [key, rx] of Object.entries(HEADER_RE) as [keyof typeof HEADER_RE, RegExp][]) {
    const m = rx.exec(prompt)
    if (!m) continue
    const value = key === 'phase' ? m[1]!.replace(/^Phase\s+/i, '') : m[1]!
    out[key] = value.trim().split(/\s+[—–-]\s+|\s/)[0]!.replace(/^[`*,;]+|[`*,;]+$/g, '')
  }
  return out
}

// agentId -> its run, or null for a subagent that is not a factory spawn.
const runs = new Map<string, Run | null>()
// turnId -> the main loop's requests this turn.
const mainTurns = new Map<string, Metrics>()
let isFactorySession = false

function runFromDoc(doc: YamlMap): Run {
  return {
    feature: String(doc.feature), task: String(doc.task), phase: str(doc.phase), agent: str(doc.agent),
    description: str(doc.description), effort: str(doc.effort), started_at: str(doc.started_at),
    ended_at: str(doc.ended_at), turns: Number(doc.turns) || 0, metrics: metricsOf(doc),
  }
}

/** The run a subagent's turn belongs to, created from its brief on its first turn. */
async function startRun($: $, root: string, agentId: string, prompt: string): Promise<void> {
  if (runs.has(agentId)) return
  const header = briefHeader(prompt)
  const feature = header.feature
  if (!feature) {
    // A later turn of a run this module did not see begin (it reloaded): find its file.
    for (const f of await features($, root)) {
      const doc = await readDoc($, runPath(root, f, agentId))
      if (doc) return void runs.set(agentId, runFromDoc(doc))
    }
    return void runs.set(agentId, null)
  }
  const isFeature =
    SLUG_RE.test(feature) &&
    ((await $.fs.exists(join(root, '.plan', feature))) || (await $.fs.exists(join(root, '.specs', feature))))
  if (!isFeature) return void runs.set(agentId, null)
  const doc = await readDoc($, runPath(root, feature, agentId))
  if (doc) return void runs.set(agentId, runFromDoc(doc))
  const task = header.task ?? 'unassigned'
  const plan = await readDoc($, join(root, '.plan', feature, 'plan.md'))
  // The plan is authoritative for plan tasks; the header covers phase-level work (phase-<n>-close).
  const inPlan = planTasks(plan).some(([, t]) => String(t.id) === task)
  const isStage = (STAGES as readonly string[]).includes(task)
  const info = (await $.agent.list()).find(a => a.id === agentId)
  runs.set(agentId, {
    feature, task,
    phase: inPlan || isStage ? phaseOf(task, plan) : (header.phase ?? phaseOf(task, plan)),
    agent: info ? info.type.replace(new RegExp(`^${FACTORY}:`), '') : null,
    description: info?.description ?? null,
    effort: null, started_at: await now($), ended_at: null, turns: 0, metrics: newMetrics(),
  })
}

async function endRun($: $, root: string, agentId: string, sessionId: string, durationMs: number) {
  const run = runs.get(agentId)
  if (!run) return
  run.turns++
  run.metrics.duration_ms += durationMs
  run.ended_at = await now($)
  const record = {
    schema: 'factory.run/1', run_id: agentId, session_id: sessionId, feature: run.feature, phase: run.phase,
    task: run.task, agent: run.agent, description: run.description, effort: run.effort,
    models: Object.keys(run.metrics.by_model).sort(), started_at: run.started_at, ended_at: run.ended_at,
    turns: run.turns, ...run.metrics,
  }
  const body = statsBody(`Run ${agentId} — ${run.agent ?? 'agent'} · ${run.task}`, run.metrics, 'time', run.metrics.duration_ms)
  await $.fs.write(runPath(root, run.feature, agentId), renderDoc(record, body))
  const all = await loadRuns($, root, run.feature)
  // Stamp status changes too, so a state-keeper run is reflected even if its edit was missed.
  await syncFeature($, root, run.feature, all)
  await writeTaskStats($, root, run.feature, run.task, all)
}

// ---------------------------------------------------------------- orchestrator

/** Adds the main loop's requests of one turn to the active feature's orchestrator file. */
async function recordOrchestrator($: $, root: string, sessionId: string, turn: Metrics, durationMs: number) {
  const active = str((await readDoc($, join(root, '.plan', 'STATE.md')))?.active)
  if (!active || !turn.requests) return
  const path = join(statsDir(root, active, 'orchestrator'), `${safeName(sessionId)}.md`)
  const prev = await readDoc($, path)
  const at = await now($)
  const metrics = merge(prev ? metricsOf(prev) : newMetrics(), { ...turn, duration_ms: durationMs })
  const record = {
    schema: 'factory.orchestrator/1', session_id: sessionId, feature: active,
    turns: (Number(prev?.turns) || 0) + 1, started_at: str(prev?.started_at) ?? at, ended_at: at, updated_at: at,
    ...metrics,
  }
  const body = statsBody(`Orchestrator — session ${sessionId}`, metrics, 'time', metrics.duration_ms, `\nTurns: ${record.turns}\n`)
  await $.fs.write(path, renderDoc(record, body))
}

// ---------------------------------------------------------------- /factory-check

async function pipelineFiles($: $, root: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const e of await list($, dir)) {
      if (e.kind === 'dir' && e.name !== 'stats') await walk(join(dir, e.name))
      else if (e.kind === 'file' && e.name.endsWith('.md')) out.push(join(dir, e.name))
    }
  }
  for (const top of ['.plan', '.specs'])
    for (const e of await list($, join(root, top))) if (e.kind === 'dir' && SLUG_RE.test(e.name)) await walk(join(root, top, e.name))
  if (await $.fs.exists(join(root, '.plan', 'STATE.md'))) out.push(join(root, '.plan', 'STATE.md'))
  return out
}

async function checkAll($: $, root: string): Promise<string> {
  const report: string[] = []
  for (const path of await pipelineFiles($, root)) {
    const rel = path.slice(root.length + 1).split('/')
    const plan = rel[0] === '.plan' && rel[2] === 'STATE.md' ? await readDoc($, join(root, '.plan', rel[1]!, 'plan.md')) : undefined
    const errors = checkDoc(rel, (await readText($, path)) ?? '', plan)
    if (errors.length) report.push(`${rel.join('/')}:\n${errors.map(e => `  - ${e}`).join('\n')}`)
  }
  let rebuilt = 0
  for (const f of await features($, root)) {
    const all = await loadRuns($, root, f)
    const tasks = await featureTasks($, root, f)
    const ids = new Set([...all.map(r => String(r.task)), ...[...tasks].filter(([, i]) => i.status !== 'todo').map(([t]) => t)])
    for (const task of ids) await writeTaskStats($, root, f, task, all, tasks.get(task))
    rebuilt += ids.size
  }
  return (
    (report.length ? `${report.length} file(s) with frontmatter errors:\n\n${report.join('\n\n')}` : 'All frontmatter is valid.') +
    `\n\nRewrote the stats of ${rebuilt} task(s) and setup stage(s).`
  )
}

// ---------------------------------------------------------------- hooks

/** Bookkeeping never stands in the way: a hook that fails hands the event on unchanged. */
function passOn<E, R>($: unknown, e: E, next: (e: E) => R): R {
  return next(e)
}

/**
 * After a Write or Edit of a pipeline file, in any agent: checks its frontmatter, and puts the
 * errors after the tool's result so the agent that wrote the file fixes it in the same run.
 */
async function checkWrite<R extends { deny?: unknown; isError?: unknown; context?: readonly string[] }>(
  $: $, file: string, result: R,
): Promise<R> {
  if (result.deny !== undefined || result.isError || !file.endsWith('.md')) return result
  const root = norm(await $.session.root())
  const path = norm(file)
  const isWindows = /^[A-Za-z]:\//.test(root)
  const inside = isWindows ? path.toLowerCase().startsWith(root.toLowerCase() + '/') : path.startsWith(root + '/')
  if (!inside) return result
  const rel = path.slice(root.length + 1).split('/')
  if (!['.plan', '.specs'].includes(rel[0]!) || rel.includes('stats')) return result
  const isStatePlan = rel[0] === '.plan' && rel.length === 3 && SLUG_RE.test(rel[1]!)
  const plan = isStatePlan && rel[2] === 'STATE.md' ? await readDoc($, join(root, '.plan', rel[1]!, 'plan.md')) : undefined
  const errors = checkDoc(rel, (await readText($, path)) ?? '', plan)
  if (isStatePlan && ['STATE.md', 'plan.md'].includes(rel[2]!)) await serial(() => syncFeature($, root, rel[1]!))
  if (!errors.length) return result
  const message =
    `${file}: its YAML frontmatter does not match the format documented in your instructions. ` +
    `Fix it now, in this run:\n- ${errors.join('\n- ')}`
  return { ...result, context: [...(result.context ?? []), message] }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'factory-check',
      description: 'Check the YAML frontmatter of every .plan/ and .specs/ file, and rewrite the task usage stats.',
    })
    return next(e)
  })

  on('command.run', { command: 'factory-check' }, async $ => {
    const root = norm(await $.session.root())
    return { text: await serial(() => checkAll($, root)) }
  })

  // The orchestrator's usage counts from the session's first /factory on.
  on('prompt.submit', ($, e, next) => {
    if (e.command && [FACTORY, `${FACTORY}:${FACTORY}`].includes(e.command.name)) isFactorySession = true
    return next(e)
  }).catch(passOn)
  on('tool.call', { tool: 'Skill' }, ($, e, next) => {
    if (e.agentId === undefined && [FACTORY, `${FACTORY}:${FACTORY}`].includes(e.skill)) isFactorySession = true
    return next(e)
  }).catch(passOn)

  on('tool.call', { tool: 'Write' }, async ($, e, next) => checkWrite($, e.file_path, await next(e))).catch(passOn)
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => checkWrite($, e.file_path, await next(e))).catch(passOn)

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined && !runs.has(e.agentId)) {
      const root = norm(await $.session.root())
      await startRun($, root, e.agentId, e.text).catch(() => runs.set(e.agentId!, null))
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage) {
      const key = e.agentId ?? MAIN
      const run = e.agentId === undefined ? undefined : runs.get(e.agentId)
      const metrics = run ? run.metrics : key === MAIN ? (mainTurns.get(e.turnId) ?? mainTurns.set(e.turnId, newMetrics()).get(e.turnId)!) : undefined
      if (metrics) addRequest(metrics, result.usage.model, result.usage, result.toolUses.length)
      if (run && run.effort === null && e.effort !== undefined) run.effort = String(e.effort)
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const root = norm(await $.session.root())
    const sessionId = await $.session.id()
    if (e.agentId !== undefined) {
      if (runs.get(e.agentId)) await serial(() => endRun($, root, e.agentId!, sessionId, e.durationMs)).catch(() => undefined)
    } else {
      const turn = mainTurns.get(e.turnId)
      mainTurns.delete(e.turnId)
      if (turn && !isFactorySession) {
        // After a reload: this session already ran /factory if it has an orchestrator file.
        const active = str((await readDoc($, join(root, '.plan', 'STATE.md')))?.active)
        isFactorySession =
          !!active && (await $.fs.exists(join(statsDir(root, active, 'orchestrator'), `${safeName(sessionId)}.md`)))
      }
      if (turn && isFactorySession)
        await serial(() => recordOrchestrator($, root, sessionId, turn, e.durationMs)).catch(() => undefined)
    }
    return next(e)
  })
}
