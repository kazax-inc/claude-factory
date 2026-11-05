import { describe, expect, test } from 'claude-code/testing'

import { frontmatter, parseYaml } from '../hooks/frontmatter'
import { briefFeature, chooseRoot } from '../hooks/load'
import { fit, rollup } from '../hooks/tree'

describe('frontmatter', () => {
  test('reads the factory subset: scalars, flow rows, lists, nested maps', () => {
    const map = frontmatter(
      [
        '---',
        'schema: factory.state/2',
        'plan_phase: 2',
        'phase_base: "3f2a91c"',
        'spec: approved',
        'done: true',
        'empty: null',
        'tasks:',
        '  - {id: T1.1, status: done, loops: 0}',
        '  - {id: T1.3, title: "Parser, part \\"one\\"", split_into: [T1.3a, T1.3b]}',
        'commands:',
        '  build: "npm run build"',
        '  test: npm test',
        'next: ["Run T1.2 round 2: fix it"]',
        'listed:',
        '- a',
        '- "b c"',
        '---',
        '# Body: not read',
      ].join('\n'),
    )
    expect(map).toEqual({
      schema: 'factory.state/2',
      plan_phase: 2,
      phase_base: '3f2a91c',
      spec: 'approved',
      done: true,
      empty: null,
      tasks: [
        { id: 'T1.1', status: 'done', loops: 0 },
        { id: 'T1.3', title: 'Parser, part "one"', split_into: ['T1.3a', 'T1.3b'] },
      ],
      commands: { build: 'npm run build', test: 'npm test' },
      next: ['Run T1.2 round 2: fix it'],
      listed: ['a', 'b c'],
    })
  })

  test('a file without frontmatter reads as an empty map; CRLF and a BOM are fine', () => {
    expect(frontmatter('# Just a title\n')).toEqual({})
    expect(frontmatter('\uFEFF---\r\nactive: alpha\r\n---\r\n')).toEqual({ active: 'alpha' })
  })

  test('malformed frontmatter throws with the line', () => {
    expect(() => frontmatter('---\nactive: alpha\n')).toThrow(/not closed/)
    expect(() => parseYaml('tasks:\n  - {id: T1.1, status: done')).toThrow(/line 2/)
  })
})

describe('chooseRoot', () => {
  test('resolves a folder against the session project, and . or empty to it', () => {
    expect(chooseRoot('/proj', '')).toBe('')
    expect(chooseRoot('/proj', '.')).toBe('')
    expect(chooseRoot('/proj', 'fixtures/demo/')).toBe('/proj/fixtures/demo')
    expect(chooseRoot('/proj', './fixtures/demo/.factory')).toBe('/proj/fixtures/demo')
    expect(chooseRoot('/proj', '"/other place"')).toBe('/other place')
    expect(chooseRoot('/proj', 'C:\\work\\app')).toBe('C:\\work\\app')
  })
})

describe('briefFeature', () => {
  test('reads the feature of a factory brief, and nothing from another prompt', () => {
    expect(briefFeature('Feature: git-panel\nPhase: 2\nTask: T2.2\nProject: existing')).toBe('git-panel')
    expect(briefFeature('\nFeature: auth\r\nPhase: setup\r\nTask: intake')).toBe('auth')
    expect(briefFeature('Feature: auth')).toBeUndefined()
    expect(briefFeature('Summarize the Feature: list\nPhase: x')).toBeUndefined()
  })
})

describe('tree helpers', () => {
  test('rollup: done when every live status is, blocked first, dropped apart', () => {
    expect(rollup([])).toBe('todo')
    expect(rollup(['done', 'dropped'])).toBe('done')
    expect(rollup(['dropped'])).toBe('dropped')
    expect(rollup(['done', 'blocked', 'todo'])).toBe('blocked')
    expect(rollup(['done', 'todo'])).toBe('in_progress')
    expect(rollup(['todo', 'todo'])).toBe('todo')
  })

  test('fit cuts with an ellipsis', () => {
    expect(fit('Status parser', 20)).toBe('Status parser')
    expect(fit('Status parser', 8)).toBe('Status…')
    expect(fit('Status parser', 1)).toBe('…')
  })
})
