import type { Register } from 'claude-code'

// Keeps an existing project's .factory/settings.json current with the plugin.
// At session start, the keys a newer plugin added to its template are written
// into the file with their default values. A missing key already takes that
// value, so behavior does not change: the file just shows every setting. A file
// that is missing, not valid JSON or of another schema is left alone; the
// /factory settings check reports it, and adds the keys itself when this hook
// did not run.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

const SETTINGS = '.factory/settings.json'
const TEMPLATE = 'skills/factory/templates/settings.json'
const SCHEMA = 'factory.settings/1'

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The template's keys in its order, each holding the file's value when it has
// one, then the file's own extra keys. `added` collects the dotted paths of the
// keys taken from the template.
function merge(own: JsonObject, template: JsonObject, path: string, added: string[]): JsonObject {
  const entries: [string, Json][] = []
  for (const [key, value] of Object.entries(template)) {
    const at = path === '' ? key : `${path}.${key}`
    if (!Object.hasOwn(own, key)) {
      entries.push([key, value])
      added.push(at)
      continue
    }
    const mine = own[key] as Json
    entries.push([key, isObject(mine) && isObject(value) ? merge(mine, value, at, added) : mine])
  }
  for (const [key, value] of Object.entries(own)) {
    if (!Object.hasOwn(template, key)) entries.push([key, value])
  }
  return Object.fromEntries(entries)
}

// JSON laid out like the template: two-space indent, one line per agent.
function format(value: Json, indent = '', inlineChildren = false): string {
  if (!isObject(value)) return JSON.stringify(value)
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'
  const inner = `${indent}  `
  const lines = entries.map(([key, item]) => {
    const text = inlineChildren && isObject(item)
      ? `{ ${Object.entries(item).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`
      : format(item, inner, indent === '' && key === 'agents')
    return `${inner}${JSON.stringify(key)}: ${text}`
  })
  return `{\n${lines.join(',\n')}\n${indent}}`
}

/**
 * The settings file with the template's missing keys added, and their paths;
 * undefined when nothing is missing or the file is not a valid settings file.
 */
export function migrate(fileText: string, templateText: string): { text: string; added: string[] } | undefined {
  let own: Json
  try {
    own = JSON.parse(fileText) as Json
  } catch {
    return undefined
  }
  const template = JSON.parse(templateText) as Json
  if (!isObject(own) || !isObject(template) || own.schema !== SCHEMA) return undefined
  const added: string[] = []
  const merged = merge(own, template, '', added)
  return added.length === 0 ? undefined : { text: `${format(merged)}\n`, added }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Absolute: a relative path would resolve against the plugin's own folder.
    const settings = `${e.cwd}/${SETTINGS}`
    try {
      if (await $.fs.exists(settings)) {
        const result = migrate(await $.fs.read(settings), await $.fs.read(`${$.plugin.root}/${TEMPLATE}`))
        if (result !== undefined) {
          await $.fs.write(settings, result.text)
          $.ui.log(`factory: added ${result.added.join(', ')} to ${SETTINGS}, with their default values`)
        }
      }
    } catch {
      // Left to the /factory settings check, which adds the keys itself.
    }
    return next(e)
  })
}
