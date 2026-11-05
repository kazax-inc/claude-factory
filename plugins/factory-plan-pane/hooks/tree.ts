// Turns a feature's plan into the rows the pane draws: status roll-ups for
// split tasks and phases, which nodes start open, and the flattened tree
// under the person's expand and collapse choices. Pure: no `$` here.

import type { PlanFeature, PlanPhase, PlanStatus, PlanTask } from '../types'

/** A status as drawn: a split task and a phase show their children's roll-up. */
export type Shown = Exclude<PlanStatus, 'split'>

export type Row = {
  /** `<feature>:<node id>`: the expand state's key and the Button's address. */
  key: string
  depth: number
  kind: 'phase' | 'task' | 'spec'
  status: Shown
  label: string
  meta: string
  isExpandable: boolean
  isOpen: boolean
  isCurrent: boolean
}

export const STAGES = ['intake', 'discover', 'specify', 'plan', 'build', 'done'] as const

/** One status for several: done when every live one is, blocked when any is. */
export function rollup(statuses: readonly Shown[]): Shown {
  if (statuses.length === 0) return 'todo'
  const live = statuses.filter(status => status !== 'dropped')
  if (live.length === 0) return 'dropped'
  if (live.every(status => status === 'done')) return 'done'
  if (live.includes('blocked')) return 'blocked'
  if (live.some(status => status === 'in_progress' || status === 'done')) return 'in_progress'
  return 'todo'
}

export function taskStatus(task: PlanTask): Shown {
  if (task.subtasks.length > 0) return rollup(task.subtasks.map(taskStatus))
  return task.status === 'split' ? 'todo' : task.status
}

/** The task set: tasks that are not split, at any depth. */
export function leaves(tasks: readonly PlanTask[]): PlanTask[] {
  return tasks.flatMap(task => (task.subtasks.length > 0 ? leaves(task.subtasks) : [task]))
}

export type Progress = { done: number; total: number; dropped: number; blocked: number; active: number }

/** Done over the task set, dropped tasks counted apart. */
export function progress(tasks: readonly PlanTask[]): Progress {
  const set = leaves(tasks).map(taskStatus)
  const count = (status: Shown) => set.filter(one => one === status).length
  const dropped = count('dropped')
  return { done: count('done'), total: set.length - dropped, dropped, blocked: count('blocked'), active: count('in_progress') }
}

export const allTasks = (feature: PlanFeature): PlanTask[] => feature.phases.flatMap(phase => phase.tasks)

/** SPEC items made true by done tasks, over the items the spec lists. */
export function specCoverage(feature: PlanFeature): { done: number; total: number } {
  const set = leaves(allTasks(feature))
  const referenced = new Set(set.flatMap(task => task.specs.map(spec => spec.id)))
  const done = new Set(set.filter(task => taskStatus(task) === 'done').flatMap(task => task.specs.map(spec => spec.id)))
  return { done: done.size, total: Math.max(feature.specTotal, referenced.size) }
}

/** The phase being built: STATE's `plan_phase`, else the first not done. */
export function currentPhase(feature: PlanFeature): string {
  if (feature.planPhase !== '') return feature.planPhase
  return feature.phases.find(phase => !isFinished(phase))?.id ?? ''
}

const isFinished = (phase: PlanPhase): boolean => {
  const status = rollup(phase.tasks.map(taskStatus))
  return status === 'done' || status === 'dropped'
}

const phaseKey = (feature: PlanFeature, phase: PlanPhase) => `${feature.name}:P${phase.id}`
const taskKey = (feature: PlanFeature, task: PlanTask) => `${feature.name}:${task.id}`

/** Only the current phase starts open; the person's choices override it. */
function isOpen(expanded: Readonly<Record<string, boolean>>, key: string, byDefault: boolean): boolean {
  return expanded[key] ?? byDefault
}

/** The spec items a task shows itself: on a split task, those no child shows. */
function ownSpecs(task: PlanTask) {
  if (task.subtasks.length === 0) return task.specs
  const shown = new Set(leaves(task.subtasks).flatMap(child => child.specs.map(spec => spec.id)))
  return task.specs.filter(spec => !shown.has(spec.id))
}

const isTaskExpandable = (task: PlanTask) => task.subtasks.length > 0 || ownSpecs(task).length > 0

function taskMeta(task: PlanTask): string {
  const parts = [task.subtasks.length > 0 ? 'split' : [task.type, task.size].filter(part => part !== '').join(' ')]
  if (task.subtasks.length > 0) {
    const { done, total } = progress(task.subtasks)
    parts.push(`${done}/${total}`)
  }
  if (task.loops > 0) parts.push(`${task.loops} loop${task.loops === 1 ? '' : 's'}`)
  return parts.filter(part => part !== '').join(' · ')
}

/** The rows shown for a feature under the given expand choices. */
export function flatten(feature: PlanFeature, expanded: Readonly<Record<string, boolean>>): Row[] {
  const out: Row[] = []
  const current = currentPhase(feature)

  const addTask = (task: PlanTask, depth: number) => {
    const key = taskKey(feature, task)
    const status = taskStatus(task)
    const isExpandable = isTaskExpandable(task)
    const open = isExpandable && isOpen(expanded, key, false)
    out.push({
      key,
      depth,
      kind: 'task',
      status,
      label: task.title === '' ? task.id : `${task.id} ${task.title}`,
      meta: taskMeta(task),
      isExpandable,
      isOpen: open,
      isCurrent: false,
    })
    if (!open) return
    for (const child of task.subtasks) addTask(child, depth + 1)
    for (const spec of ownSpecs(task)) {
      out.push({
        key: `${key}/${spec.id}`,
        depth: depth + 1,
        kind: 'spec',
        status: status === 'done' ? 'done' : status === 'dropped' ? 'dropped' : 'todo',
        label: spec.title === '' ? spec.id : `${spec.id} ${spec.title}`,
        meta: '',
        isExpandable: false,
        isOpen: false,
        isCurrent: false,
      })
    }
  }

  for (const phase of feature.phases) {
    const key = phaseKey(feature, phase)
    const isCurrent = phase.id === current
    const isExpandable = phase.tasks.length > 0
    const open = isExpandable && isOpen(expanded, key, isCurrent)
    const { done, total } = progress(phase.tasks)
    const title = phase.name === '' ? `Phase ${phase.id}` : `Phase ${phase.id} · ${phase.name}`
    out.push({
      key,
      depth: 0,
      kind: 'phase',
      status: rollup(phase.tasks.map(taskStatus)),
      label: title,
      meta: `${done}/${total}`,
      isExpandable,
      isOpen: open,
      isCurrent,
    })
    if (open) for (const task of phase.tasks) addTask(task, 1)
  }
  return out
}

/** Every key that opens or closes in this feature: what expand all and collapse all set. */
export function expandableKeys(feature: PlanFeature): string[] {
  const keys: string[] = []
  const addTask = (task: PlanTask) => {
    if (isTaskExpandable(task)) keys.push(taskKey(feature, task))
    task.subtasks.forEach(addTask)
  }
  for (const phase of feature.phases) {
    if (phase.tasks.length > 0) keys.push(phaseKey(feature, phase))
    phase.tasks.forEach(addTask)
  }
  return keys
}

/** `text` cut to `width` cells, ending with an ellipsis when cut. */
export function fit(text: string, width: number): string {
  const chars = [...text]
  if (chars.length <= width) return text
  if (width <= 1) return '…'
  return `${chars.slice(0, width - 1).join('').trimEnd()}…`
}
