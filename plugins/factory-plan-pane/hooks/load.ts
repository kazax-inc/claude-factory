// Reads a project's .factory folder into a PlanSnapshot. Paths and schemas are
// the factory plugin's (docs/data-model.md): plans/STATE.md names the active
// feature; per feature, plans/<f>/STATE.md holds the task statuses,
// plans/<f>/plan.md the phases and task rows, plans/<f>/tasks/<id>.md the SPEC
// items each task implements, and specs/<f>/ the summary and item titles.
// Nothing here writes: the pane only reads what the factory's agents wrote.

import type { EngineInterface } from 'claude-code'

import type { PlanFeature, PlanPhase, PlanSnapshot, PlanStatus, PlanTask } from '../types'
import { frontmatter, isMap, type Yaml, type YamlMap } from './frontmatter'

type Engine = EngineInterface

const STATUSES: readonly PlanStatus[] = ['todo', 'in_progress', 'done', 'blocked', 'split', 'dropped']

const str = (value: Yaml | undefined): string =>
  value === null || value === undefined || typeof value === 'object' ? '' : String(value)

const num = (value: Yaml | undefined): number => (typeof value === 'number' ? value : Number(str(value)) || 0)

const strings = (value: Yaml | undefined): string[] => {
  if (Array.isArray(value)) return value.map(str).filter(text => text !== '')
  const one = str(value)
  return one === '' ? [] : [one]
}

const rows = (value: Yaml | undefined): YamlMap[] => (Array.isArray(value) ? value.filter(isMap) : [])

const phaseOf = (taskId: string): string => /^T(\d+)\./.exec(taskId)?.[1] ?? ''

type Read = { map: YamlMap } | { missing: true } | { error: string }

async function readFrontmatter($: Engine, path: string): Promise<Read> {
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return { missing: true }
  }
  try {
    return { map: frontmatter(text) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function folders($: Engine, path: string): Promise<string[]> {
  const entries = await $.fs.list(path).catch(() => [])
  return entries.filter(entry => entry.kind === 'dir' && !entry.name.startsWith('.')).map(entry => entry.name)
}

/** The plan of the project at `root` (absolute), as the pane draws it. */
export async function loadSnapshot($: Engine, root: string): Promise<PlanSnapshot> {
  const loadedAt = await $.clock.now()
  const base = `${root}/.factory`
  if (!(await $.fs.exists(base))) return { root, isInitialized: false, active: '', features: [], loadedAt }
  const index = await readFrontmatter($, `${base}/plans/STATE.md`)
  const active = 'map' in index ? str(index.map.active) : ''
  const names = new Set([...(await folders($, `${base}/plans`)), ...(await folders($, `${base}/specs`))])
  const features = await Promise.all([...names].sort().map(name => loadFeature($, base, name)))
  return { root, isInitialized: true, active, features, loadedAt }
}

async function loadFeature($: Engine, base: string, name: string): Promise<PlanFeature> {
  const problems: string[] = []
  const get = async (path: string, isExpected: boolean): Promise<YamlMap | undefined> => {
    const read = await readFrontmatter($, `${base}/${path}`)
    if ('map' in read) return read.map
    if ('error' in read) problems.push(`.factory/${path}: ${read.error}`)
    else if (isExpected) problems.push(`.factory/${path}: missing`)
    return undefined
  }

  const [state, plan, specIndex] = await Promise.all([
    get(`plans/${name}/STATE.md`, true),
    get(`plans/${name}/plan.md`, false),
    get(`specs/${name}/index.md`, false),
  ])
  const stage = str(state?.stage)
  if (plan === undefined && (stage === 'build' || stage === 'done')) {
    problems.push(`.factory/plans/${name}/plan.md: missing`)
  }

  // SPEC item titles, from every area the spec index lists.
  const areas = rows(specIndex?.areas).map(area => str(area.code)).filter(code => code !== '')
  const areaFiles = await Promise.all(areas.map(code => get(`specs/${name}/spec/${code.toLowerCase()}.md`, true)))
  const titles = new Map<string, string>()
  for (const area of areaFiles) {
    for (const item of rows(area?.items)) titles.set(str(item.id), str(item.title))
  }

  // Statuses and loop counts, from the feature's STATE rows.
  const statuses = new Map<string, { status: PlanStatus; loops: number }>()
  for (const row of rows(state?.tasks)) {
    const status = str(row.status) as PlanStatus
    statuses.set(str(row.id), { status: STATUSES.includes(status) ? status : 'todo', loops: num(row.loops) })
  }

  const taskRows = rows(plan?.tasks).filter(row => str(row.id) !== '')
  const implemented = new Map<string, string[]>()
  await Promise.all(
    taskRows.map(async row => {
      const id = str(row.id)
      const isSplit = strings(row.split_into).length > 0
      const file = await get(`plans/${name}/tasks/${id}.md`, !isSplit)
      implemented.set(id, strings(file?.implements))
    }),
  )

  return {
    name,
    summary: str(specIndex?.summary),
    stage,
    status: str(state?.status),
    spec: str(state?.spec),
    planPhase: str(state?.plan_phase),
    updated: str(state?.updated),
    next: strings(state?.next),
    waiting: rows(state?.waiting_on_user).map(row => str(row.text)).filter(text => text !== ''),
    hasPlan: plan !== undefined,
    phases: buildPhases(plan, taskRows, statuses, implemented, titles, problems, name),
    specTotal: titles.size,
    problems,
  }
}

function buildPhases(
  plan: YamlMap | undefined,
  taskRows: YamlMap[],
  statuses: Map<string, { status: PlanStatus; loops: number }>,
  implemented: Map<string, string[]>,
  titles: Map<string, string>,
  problems: string[],
  feature: string,
): PlanPhase[] {
  const byId = new Map(taskRows.map(row => [str(row.id), row]))
  const children = new Set(taskRows.flatMap(row => strings(row.split_into)))

  const build = (id: string, seen: Set<string>): PlanTask => {
    const row = byId.get(id)
    if (row === undefined) problems.push(`.factory/plans/${feature}/plan.md: no row for ${id}`)
    const own = statuses.get(id)
    const split = seen.has(id) ? [] : strings(row?.split_into)
    const inner = new Set(seen).add(id)
    return {
      id,
      title: str(row?.title),
      type: str(row?.type),
      size: str(row?.size),
      status: own?.status ?? (split.length > 0 ? 'split' : 'todo'),
      loops: own?.loops ?? 0,
      deps: strings(row?.deps),
      specs: (implemented.get(id) ?? []).map(spec => ({ id: spec, title: titles.get(spec) ?? '' })),
      subtasks: split.map(child => build(child, inner)),
    }
  }

  const phases = new Map<string, PlanPhase>()
  for (const row of rows(plan?.phases)) {
    const id = str(row.id)
    phases.set(id, { id, name: str(row.name), goal: str(row.goal), tasks: [] })
  }
  for (const row of taskRows) {
    const id = str(row.id)
    if (children.has(id)) continue
    const phaseId = phaseOf(id)
    let phase = phases.get(phaseId)
    if (phase === undefined) {
      phase = { id: phaseId, name: '', goal: '', tasks: [] }
      phases.set(phaseId, phase)
    }
    phase.tasks.push(build(id, new Set()))
  }
  return [...phases.values()].sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id))
}

/**
 * A cheap fingerprint of the files that change while the factory runs: the
 * feature folders and the modification times of each STATE.md and plan.md.
 * The pane re-reads everything when it changes.
 */
export async function fingerprint($: Engine, root: string): Promise<string> {
  const base = `${root}/.factory`
  if (!(await $.fs.exists(base))) return 'none'
  const names = (await folders($, `${base}/plans`)).sort()
  const files = [`${base}/plans/STATE.md`, ...names.flatMap(name => [`${base}/plans/${name}/STATE.md`, `${base}/plans/${name}/plan.md`])]
  const times = await Promise.all(files.map(path => $.fs.stat(path).then(stat => stat.mtimeMs, () => 0)))
  return `${names.join(',')}|${times.join(',')}`
}

/**
 * The feature a factory brief is for. Every brief the factory's orchestrator
 * gives a subagent opens with `Feature:`, `Phase:` and `Task:` lines (its
 * SKILL.md, brief header), so tools can attribute the run; undefined for any
 * other prompt.
 */
export function briefFeature(prompt: string): string | undefined {
  const match = /^\s*Feature:[ \t]*([^\s]+)[ \t]*\r?\n[ \t]*Phase:/.exec(prompt)
  return match?.[1]
}

/**
 * The project folder `/factory-plan <path>` names: '' for the session's own
 * project (`.` or empty), else an absolute path. A path to the .factory
 * folder itself means the project holding it.
 */
export function chooseRoot(sessionRoot: string, argument: string): string {
  const path = argument.trim().replace(/^(["'])(.*)\1$/, '$2')
  if (path === '' || path === '.' || path === './') return ''
  const isAbsolute = /^([\\/]|[A-Za-z]:[\\/])/.test(path)
  const joined = isAbsolute ? path : `${sessionRoot}/${path}`
  const cleaned = joined
    .replace(/[\\/]\.(?=[\\/]|$)/g, '')
    .replace(/[\\/]+$/, '')
    .replace(/[\\/]\.factory$/, '')
  return cleaned === sessionRoot ? '' : cleaned
}
