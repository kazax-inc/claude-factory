// The values factory-plan-pane keeps in $.state, and the plan snapshot it
// reads from a project's .factory folder (layout: the factory plugin's
// docs/data-model.md, schemas factory.*/2).

/** A plan task's status, as a feature's STATE.md rows spell it. */
export type PlanStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'split' | 'dropped'

/** A SPEC item a task implements, with its title from the spec area file. */
export type PlanSpecItem = { id: string; title: string }

/** One plan task; a split task holds its children as `subtasks`. */
export type PlanTask = {
  id: string
  title: string
  type: string
  size: string
  /** From STATE.md; a split task's own row says `split`. */
  status: PlanStatus
  loops: number
  deps: string[]
  specs: PlanSpecItem[]
  subtasks: PlanTask[]
}

export type PlanPhase = { id: string; name: string; goal: string; tasks: PlanTask[] }

/** One feature: its STATE.md, plan.md and spec index, joined. */
export type PlanFeature = {
  name: string
  summary: string
  stage: string
  status: string
  spec: string
  planPhase: string
  updated: string
  next: string[]
  waiting: string[]
  hasPlan: boolean
  phases: PlanPhase[]
  /** SPEC items across the feature's spec area files. */
  specTotal: number
  /** Files that were missing or could not be parsed, repo-relative. */
  problems: string[]
}

/** What the pane draws from; `isInitialized` false when there is no .factory folder. */
export type PlanSnapshot = {
  root: string
  isInitialized: boolean
  active: string
  features: PlanFeature[]
  loadedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'factory-plan-pane': {
      /** The last plan read; null before the first read. */
      snapshot: Shaped<PlanSnapshot | null>
      /** Node key (`<feature>:<node id>`) to open or closed, where the person chose. */
      expanded: Shaped<Record<string, boolean>>
      /** The project folder `/factory-plan <path>` chose; '' for the session's project. */
      root: string
      /** The feature shown; '' for the active one. */
      feature: string
      /** Features a factory subagent is working on in this session now. */
      running: string[]
    }
  }
}
