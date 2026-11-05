// A small in-memory factory project for the tests, and the hooks that serve
// it as the file system beneath the plugin (`claude plugin test` gives a test
// no disk). The data follows the factory's data model, schemas factory.*/2.

import type { FsEntry, On } from 'claude-code'

export const ROOT = '/proj'

const fm = (lines: string[]) => `---\n${lines.join('\n')}\n---\n# body\n`

const task = (feature: string, id: string, implementsIds: string[]) =>
  fm([
    'schema: factory.task/2',
    `feature: ${feature}`,
    `id: ${id}`,
    `implements: [${implementsIds.join(', ')}]`,
    'scope: ["src/"]',
    'gates: [test-runner, code-reviewer]',
  ])

/**
 * `alpha` (active, building phase 2): leaves T1.1, T1.2, T1.3a done, T1.3b in
 * progress, T2.1 blocked, T2.2 to do, T2.3 dropped; T1.3 is split into T1.3a
 * and T1.3b. `beta` is at the specify stage, with no plan.
 */
export function project(root = ROOT): Record<string, string> {
  const base = `${root}/.factory`
  return {
    [`${base}/plans/STATE.md`]: fm(['schema: factory.index/2', 'active: alpha']),
    [`${base}/plans/alpha/STATE.md`]: fm([
      'schema: factory.state/2',
      'feature: alpha',
      'status: active',
      'stage: build',
      'spec: approved',
      'plan_phase: 2',
      'phase_base: "3f2a91c"',
      'updated: 2026-11-04',
      'tasks:',
      '  - {id: T1.1, status: done, loops: 0, user_rounds: 0}',
      '  - {id: T1.2, status: done, loops: 2, user_rounds: 0}',
      '  - {id: T1.3, status: split, loops: 0, user_rounds: 0}',
      '  - {id: T1.3a, status: done, loops: 0, user_rounds: 0}',
      '  - {id: T1.3b, status: in_progress, loops: 0, user_rounds: 0}',
      '  - {id: T2.1, status: blocked, loops: 1, user_rounds: 0}',
      '  - {id: T2.2, status: todo, loops: 0, user_rounds: 0}',
      '  - {id: T2.3, status: dropped, loops: 0, user_rounds: 0}',
      'waiting_on_user:',
      '  - {text: "Pick the \\"storage\\" option of ADR-0003", kind: adr, ref: ADR-0003, task: null, since: 2026-11-03}',
      'next: ["Run T1.3b round 2"]',
    ]),
    [`${base}/plans/alpha/plan.md`]: fm([
      'schema: factory.plan/2',
      'feature: alpha',
      'phases:',
      '  - {id: 1, name: "Core", goal: "Data visible through the real entry"}',
      '  - {id: 2, name: "UI", goal: "Every state drawn"}',
      'tasks:',
      '  - {id: T1.1, title: "Probe the format", type: probe, size: S, deps: []}',
      '  - {id: T1.2, title: "Runner", type: feature, size: M, deps: [T1.1]}',
      '  - {id: T1.3, title: "Parser", type: feature, size: M, deps: [T1.1], split_into: [T1.3a, T1.3b]}',
      '  - {id: T1.3a, title: "Parse the header", type: feature, size: S, deps: [T1.1]}',
      '  - {id: T1.3b, title: "Parse the entries", type: feature, size: S, deps: [T1.3a]}',
      '  - {id: T2.1, title: "Layout", type: feature, size: M, deps: [T1.2]}',
      '  - {id: T2.2, title: "Rows", type: feature, size: S, deps: [T2.1]}',
      '  - {id: T2.3, title: "Polling fallback", type: feature, size: S, deps: [T2.1]}',
    ]),
    [`${base}/plans/alpha/tasks/T1.1.md`]: task('alpha', 'T1.1', ['SPEC-A-1']),
    [`${base}/plans/alpha/tasks/T1.2.md`]: task('alpha', 'T1.2', ['SPEC-A-2']),
    [`${base}/plans/alpha/tasks/T1.3.md`]: task('alpha', 'T1.3', ['SPEC-A-3', 'SPEC-A-4']),
    [`${base}/plans/alpha/tasks/T1.3a.md`]: task('alpha', 'T1.3a', ['SPEC-A-3']),
    [`${base}/plans/alpha/tasks/T1.3b.md`]: task('alpha', 'T1.3b', ['SPEC-A-4']),
    [`${base}/plans/alpha/tasks/T2.1.md`]: task('alpha', 'T2.1', ['SPEC-B-1']),
    [`${base}/plans/alpha/tasks/T2.2.md`]: task('alpha', 'T2.2', ['SPEC-B-2']),
    [`${base}/plans/alpha/tasks/T2.3.md`]: task('alpha', 'T2.3', ['SPEC-B-3']),
    [`${base}/specs/alpha/index.md`]: fm([
      'schema: factory.spec/2',
      'feature: alpha',
      'summary: "Alpha shows the data in a panel."',
      'areas:',
      '  - {code: A, title: "Data", scope: "Reading the data."}',
      '  - {code: B, title: "Panel", scope: "Drawing it."}',
      'assumptions: []',
      'open_issues: []',
    ]),
    [`${base}/specs/alpha/spec/a.md`]: fm([
      'schema: factory.spec-area/2',
      'feature: alpha',
      'area: A',
      'items:',
      '  - {id: SPEC-A-1, title: "Reads the format", covers: [AC-1.1], refs: []}',
      '  - {id: SPEC-A-2, title: "Runs read-only", covers: [AC-1.2], refs: []}',
      '  - {id: SPEC-A-3, title: "Parses the header", covers: [AC-1.3], refs: []}',
      '  - {id: SPEC-A-4, title: "Parses the entries", covers: [AC-1.4], refs: []}',
    ]),
    [`${base}/specs/alpha/spec/b.md`]: fm([
      'schema: factory.spec-area/2',
      'feature: alpha',
      'area: B',
      'items:',
      '  - {id: SPEC-B-1, title: "Lays out three sections", covers: [AC-2.1], refs: []}',
      '  - {id: SPEC-B-2, title: "Draws one row per entry", covers: [AC-2.2], refs: []}',
      '  - {id: SPEC-B-3, title: "Falls back to polling", covers: [], refs: []}',
    ]),
    [`${base}/plans/beta/STATE.md`]: fm([
      'schema: factory.state/2',
      'feature: beta',
      'status: active',
      'stage: specify',
      'spec: draft',
      'plan_phase: null',
      'tasks: []',
      'waiting_on_user: []',
      'next: ["Run spec-reviewer"]',
    ]),
    [`${base}/specs/beta/index.md`]: fm([
      'schema: factory.spec/2',
      'feature: beta',
      'summary: "Beta searches the data."',
      'areas: []',
    ]),
  }
}

/** Serves `files` (absolute path to text) as `$.fs` beneath the plugin. */
export function serve(on: On, files: Record<string, string>): void {
  const folders = new Set<string>()
  for (const path of Object.keys(files)) {
    const parts = path.split('/')
    for (let end = 2; end < parts.length; end += 1) folders.add(parts.slice(0, end).join('/'))
  }
  const entries = (folder: string): FsEntry[] => {
    const names = new Map<string, FsEntry['kind']>()
    for (const path of [...Object.keys(files), ...folders]) {
      if (!path.startsWith(`${folder}/`)) continue
      const rest = path.slice(folder.length + 1)
      const name = rest.split('/')[0]!
      names.set(name, rest.includes('/') || folders.has(`${folder}/${name}`) ? 'dir' : 'file')
    }
    return [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false }))
  }

  on('fs.exists', (_, e) => ({ value: e.path in files || folders.has(e.path) }))
  on('fs.read', (_, e) => {
    const text = files[e.path]
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.list', (_, e) => (folders.has(e.path) ? { value: entries(e.path) } : { deny: `ENOENT: ${e.path}` }))
  on('fs.stat', (_, e) => {
    if (folders.has(e.path)) return { value: { kind: 'dir', size: 0, mtimeMs: 1, isLink: false } }
    if (e.path in files) return { value: { kind: 'file', size: files[e.path]!.length, mtimeMs: 1, isLink: false } }
    return { deny: `ENOENT: ${e.path}` }
  })
}
