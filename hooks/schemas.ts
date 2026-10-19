// The frontmatter each pipeline file must carry, and the checks the post-write hook runs on it.
// Field-by-field documentation: ../README.md.

import { isMap, isScalar, splitFrontmatter, YamlError, type Yaml, type YamlMap } from './yaml'

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const
export const STAGES = ['intake', 'discover', 'specify', 'plan', 'build'] as const
// Pipeline phase number (STATE `phase`) -> stage. 4–7 are the per-task build loop.
export const STAGE_BY_PHASE = ['intake', 'discover', 'specify', 'plan', 'build', 'build', 'build', 'build'] as const

const MODES = ['greenfield', 'existing']
const UNTILS = ['requirements', 'spec', 'plan', 'build']
const FEATURE_STATUSES = ['active', 'waiting_on_user', 'paused', 'done']
const SPEC_STATUSES = ['none', 'draft', 'reviewed', 'approved']
const TASK_TYPES = ['feature', 'test', 'refactor', 'migration', 'ui', 'docs']
const VERDICTS = ['PASS', 'FAIL']
const QUESTION_KINDS = ['requirement', 'gate', 'adr', 'blocker']
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
const PIPELINE_PHASES = STAGE_BY_PHASE.map((_, n) => String(n))

type Kind = 'id' | 'str' | 'int' | 'bool' | 'date'
// [kind, required, allowed values]; a list takes its item schema (or null for single values),
// a map the allowed values of its values.
type Values = readonly string[]
type Field =
  | [kind: Kind, required: boolean, values?: Values]
  | [kind: 'list', required: boolean, item: Schema | null]
  | [kind: 'map', required: boolean, values?: Values]
type Schema = { [key: string]: Field }

const TYPE_CHECKS: Record<Kind, [(v: Yaml) => boolean, string]> = {
  id: [v => typeof v === 'string' || typeof v === 'number', 'a name or number'],
  str: [v => typeof v === 'string' || typeof v === 'number', 'text'],
  int: [v => Number.isInteger(v) && (v as number) >= 0, 'a whole number'],
  bool: [v => typeof v === 'boolean', 'true or false'],
  date: [v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v), 'a date YYYY-MM-DD'],
}

const SCHEMAS: Record<string, Schema> = {
  'factory.index/1': {
    active: ['id', false],
    features: ['list', true, {
      feature: ['id', true], mode: ['str', true, MODES], phase: ['int', true, PIPELINE_PHASES],
      until: ['str', true, UNTILS], status: ['str', true, FEATURE_STATUSES], updated: ['date', true],
    }],
  },
  'factory.state/1': {
    feature: ['id', true],
    mode: ['str', true, MODES],
    until: ['str', true, UNTILS],
    status: ['str', true, FEATURE_STATUSES],
    phase: ['int', true, PIPELINE_PHASES],
    spec: ['str', true, SPEC_STATUSES],
    updated: ['date', true],
    tasks: ['list', false, {
      id: ['id', true], title: ['str', false], status: ['str', true, TASK_STATUSES],
      gates: ['map', false, VERDICTS], loops: ['int', false],
    }],
    waiting_on_user: ['list', false, {
      text: ['str', true], kind: ['str', true, QUESTION_KINDS], ref: ['id', false], task: ['id', false],
      since: ['date', false],
    }],
    decisions: ['list', false, { date: ['date', true], text: ['str', true], by: ['str', true], ref: ['id', false] }],
    next: ['list', false, null],
  },
  'factory.plan/1': {
    feature: ['id', true],
    spec: ['str', true],
    phases: ['list', true, {
      id: ['id', true], name: ['str', true], tasks: ['list', true, {
        id: ['id', true], title: ['str', true], type: ['str', true, TASK_TYPES], ui: ['bool', true],
        depends_on: ['list', true, null], parallel_with: ['list', true, null],
        implements: ['list', true, null], scope: ['list', true, null],
      }],
    }],
  },
  'factory.routing/1': {
    feature: ['id', true],
    updated: ['date', true],
    overrides: ['list', false, {
      agent: ['str', true], model: ['str', true], effort: ['str', true, EFFORTS], reason: ['str', true],
    }],
    tasks: ['list', false, {
      task: ['id', true], agent: ['str', true], model: ['str', true], effort: ['str', true, EFFORTS],
      reason: ['str', true],
    }],
    escalations: ['list', false, {
      date: ['date', true], task: ['id', true], agent: ['str', true], from: ['str', true], to: ['str', true],
      cause: ['str', true, ['capability', 'rushed']], reason: ['str', true],
    }],
  },
  'factory.brief/1': { feature: ['id', true], source: ['str', true], date: ['date', true] },
  'factory.requirements/1': {
    feature: ['id', true],
    stories: ['list', true, null],
    criteria: ['list', true, null],
    open_questions: ['list', false, { id: ['id', true], text: ['str', true], affects: ['list', false, null] }],
  },
  'factory.spec/1': {
    feature: ['id', true],
    status: ['str', true, ['draft', 'reviewed', 'approved']],
    items: ['list', true, { id: ['id', true], covers: ['list', true, null] }],
    open_issues: ['list', false, null],
  },
  'factory.contracts/1': {
    feature: ['id', true],
    interfaces: ['list', true, {
      name: ['str', true],
      kind: ['str', true, ['module-api', 'plugin-api', 'ipc-command', 'event', 'data-schema']],
      breaking: ['bool', false],
    }],
  },
  'factory.adr/1': {
    id: ['id', true],
    feature: ['id', true],
    title: ['str', true],
    status: ['str', true, ['proposed', 'accepted', 'rejected', 'superseded']],
    impact: ['str', true, ['minor', 'major']],
    options: ['list', true, { id: ['id', true], title: ['str', true] }],
    recommendation: ['id', false],
    chosen: ['id', false],
    decided: ['date', false],
  },
  'factory.test-strategy/1': {
    feature: ['id', true],
    cases: ['list', true, {
      spec: ['id', true], level: ['str', true, ['unit', 'property', 'integration', 'e2e', 'visual']],
      test: ['str', true], task: ['id', false],
    }],
    hard_to_test: ['list', false, null],
  },
  'factory.retro/1': {
    feature: ['id', true],
    phase: ['id', true],
    tasks: ['int', true],
    loops: ['int', true],
    escalations: ['int', true],
    gate_failures: ['map', false],
  },
}

function validate(obj: YamlMap, schema: Schema, where: string, errors: string[]): void {
  for (const [key, [kind, required, arg]] of Object.entries(schema)) {
    const here = where ? `${where}.${key}` : key
    const v = obj[key]
    if (v === null || v === undefined) {
      if (required) errors.push(`\`${here}\` is missing`)
      continue
    }
    if (kind === 'list') {
      if (!Array.isArray(v)) {
        errors.push(`\`${here}\` must be a list, got ${JSON.stringify(v)}`)
        continue
      }
      v.forEach((item, i) => {
        if (arg && !Array.isArray(arg)) {
          if (isMap(item)) validate(item, arg as Schema, `${here}[${i}]`, errors)
          else errors.push(`\`${here}[${i}]\` must be a mapping of 'key: value' lines`)
        } else if (!isScalar(item)) errors.push(`\`${here}[${i}]\` must be a single value`)
      })
    } else if (kind === 'map') {
      if (!isMap(v)) errors.push(`\`${here}\` must be a mapping, got ${JSON.stringify(v)}`)
      else if (arg)
        for (const [k, x] of Object.entries(v))
          if (!(arg as readonly string[]).includes(String(x)))
            errors.push(`\`${here}.${k}\` is '${x}', expected one of: ${arg.join(', ')}`)
    } else {
      const [check, label] = TYPE_CHECKS[kind]
      if (!check(v)) errors.push(`\`${here}\` must be ${label}, got ${JSON.stringify(v)}`)
      else if (arg && !(arg as readonly string[]).includes(String(v)))
        errors.push(`\`${here}\` is '${v}', expected one of: ${(arg as readonly string[]).join(', ')}`)
    }
  }
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))]
}

const asList = (v: Yaml | undefined): YamlMap[] => (Array.isArray(v) ? v.filter(isMap) : [])

/** [phase id, task] for every task in plan.md's frontmatter, ids as strings. */
export function planTasks(plan: YamlMap | undefined): [string, YamlMap][] {
  return asList(plan?.phases).flatMap(p => asList(p.tasks).map((t): [string, YamlMap] => [String(p.id), t]))
}

/** The schema a pipeline file must declare, from its path relative to the project root. */
export function expectedSchema(rel: string[]): string | undefined {
  const [top = '', , name = '', file = ''] = rel
  if (rel.length === 2 && top === '.plan' && rel[1] === 'STATE.md') return 'factory.index/1'
  if (rel.length === 3 && top === '.plan') {
    if (name === 'STATE.md') return 'factory.state/1'
    if (['plan.md', 'routing.md', 'test-strategy.md'].includes(name)) return `factory.${name.slice(0, -3)}/1`
    if (/^retro-.+\.md$/.test(name)) return 'factory.retro/1'
  }
  if (rel.length === 3 && top === '.specs' && ['brief.md', 'requirements.md', 'spec.md', 'contracts.md'].includes(name))
    return `factory.${name.slice(0, -3)}/1`
  if (rel.length === 4 && top === '.specs' && name === 'adr' && file.endsWith('.md')) return 'factory.adr/1'
  return undefined
}

/**
 * Frontmatter errors of one pipeline file, its cross-file rules included.
 * `rel` is its path relative to the project root, split on `/`; `plan` the feature's plan.md
 * frontmatter when it has one (for STATE.md's task ids).
 */
export function checkDoc(rel: string[], text: string, plan?: YamlMap): string[] {
  const expected = expectedSchema(rel)
  let data: YamlMap | undefined
  let body: string
  try {
    ;[data, body] = splitFrontmatter(text)
  } catch (err) {
    if (err instanceof YamlError) return [`the YAML frontmatter does not parse: ${err.message}`]
    throw err
  }
  if (!expected) return []
  if (!data)
    return [
      `no YAML frontmatter: the file must start with a '---' line, \`schema: ${expected}\` and the ` +
        "documented fields, then a closing '---' line",
    ]
  if (data.schema !== expected) return [`\`schema\` must be \`${expected}\`, got ${JSON.stringify(data.schema ?? null)}`]
  const errors: string[] = []
  const schema = SCHEMAS[expected]!
  validate(data, schema, '', errors)
  const feature = rel.length > 2 ? rel[1] : undefined
  if (feature && 'feature' in schema && data.feature != null && String(data.feature) !== feature)
    errors.push(`\`feature\` is '${data.feature}' but the file is in the '${feature}' folder`)

  if (expected === 'factory.index/1') {
    const rows = asList(data.features).map(f => String(f.feature))
    errors.push(...duplicates(rows).map(d => `feature '${d}' is listed twice in \`features\``))
    if (rows.length && data.active != null && !rows.includes(String(data.active)))
      errors.push(`\`active\` is '${data.active}', which is not in \`features\``)
  } else if (expected === 'factory.state/1') {
    const ids = asList(data.tasks).map(t => String(t.id))
    errors.push(...duplicates(ids).map(d => `task ${d} is listed twice in \`tasks\``))
    const planIds = new Set(planTasks(plan).map(([, t]) => String(t.id)))
    if (planIds.size)
      for (const id of ids)
        if (!planIds.has(id)) errors.push(`task ${id} in \`tasks\` is not in plan.md (use the exact task ids from plan.md)`)
  } else if (expected === 'factory.plan/1') {
    const tasks = planTasks(data)
    const ids = tasks.map(([, t]) => String(t.id))
    errors.push(...duplicates(ids).map(d => `task ${d} is listed twice in \`phases\``))
    errors.push(...duplicates(asList(data.phases).map(p => String(p.id))).map(d => `phase ${d} is listed twice in \`phases\``))
    for (const [phase, t] of tasks) {
      const id = String(t.id)
      if (id !== `T${phase}.${id.split('.')[1]}` || !/^T[^.]+\.\d+$/.test(id))
        errors.push(`task id '${id}' must be T${phase}.<n> (phase ${phase})`)
      for (const key of ['depends_on', 'parallel_with']) {
        const refs = t[key]
        if (Array.isArray(refs))
          for (const d of refs) if (!ids.includes(String(d))) errors.push(`task ${id}: \`${key}\` names unknown task '${d}'`)
      }
    }
    const headings = [...body.matchAll(/^###\s+(T\d+\.\d+)\b/gm)].map(m => m[1]!)
    for (const id of ids) if (!headings.includes(id)) errors.push(`task ${id} has no '### ${id} <title>' section in the body`)
    for (const h of headings) if (!ids.includes(h)) errors.push(`the body has a '### ${h}' section but \`phases\` has no task ${h}`)
  } else if (expected === 'factory.adr/1') {
    const m = /^(\d+)-/.exec(rel[3] ?? '')
    if (m && String(data.id) !== `ADR-${m[1]}`) errors.push(`\`id\` must be ADR-${m[1]} to match the file name`)
    const options = new Set(asList(data.options).map(o => String(o.id)))
    for (const key of ['recommendation', 'chosen'])
      if (data[key] != null && !options.has(String(data[key])))
        errors.push(`\`${key}\` is '${data[key]}', which is not an option id`)
  }
  return errors
}
