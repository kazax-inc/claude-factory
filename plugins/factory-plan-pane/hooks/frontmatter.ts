// Reads the YAML frontmatter of a factory Markdown file. The factory writes a
// small subset of YAML (its data-model.md, "Format rules"): `key: value`
// lines, nested maps by indentation, block lists whose rows are one-line flow
// mappings (`- {id: T1.1, title: "Probe", deps: []}`) or scalars, flow lists,
// double-quoted strings with `\"`, bare ids, numbers, booleans and null.
// This parser covers that subset and returns plain JSON values; anything it
// cannot read throws, and the caller reports the file.

export type Yaml = null | boolean | number | string | Yaml[] | { [key: string]: Yaml }
export type YamlMap = { [key: string]: Yaml }

type Line = { indent: number; text: string; number: number }

/** The frontmatter of `source` as a map; an empty map when the file has none. */
export function frontmatter(source: string): YamlMap {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return {}
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end < 0) throw new Error('frontmatter is not closed by a --- line')
  return parseYaml(lines.slice(1, end).join('\n'))
}

/** A block of the factory's YAML subset, parsed. */
export function parseYaml(text: string): YamlMap {
  const lines: Line[] = []
  text.split('\n').forEach((raw, index) => {
    const body = raw.replace(/\s+$/, '')
    const trimmed = body.trimStart()
    if (trimmed === '' || trimmed.startsWith('#')) return
    if (/^\t/.test(body)) throw new Error(`line ${index + 1}: tabs are not allowed`)
    lines.push({ indent: body.length - trimmed.length, text: trimmed, number: index + 1 })
  })
  if (lines.length === 0) return {}
  const [value, next] = parseBlock(lines, 0, lines[0]!.indent)
  if (next < lines.length) throw new Error(`line ${lines[next]!.number}: unexpected indentation`)
  if (!isMap(value)) throw new Error('frontmatter is not a map')
  return value
}

export const isMap = (value: Yaml | undefined): value is YamlMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseBlock(lines: Line[], start: number, indent: number): [Yaml, number] {
  return lines[start]!.text.startsWith('-') && /^-(\s|$)/.test(lines[start]!.text)
    ? parseSequence(lines, start, indent)
    : parseMapping(lines, start, indent)
}

function parseSequence(lines: Line[], start: number, indent: number): [Yaml[], number] {
  const items: Yaml[] = []
  let index = start
  while (index < lines.length) {
    const line = lines[index]!
    if (line.indent !== indent || !/^-(\s|$)/.test(line.text)) break
    const rest = line.text.slice(1).trim()
    index += 1
    if (rest !== '') {
      items.push(parseInline(rest, line.number))
    } else if (index < lines.length && lines[index]!.indent > indent) {
      const [value, next] = parseBlock(lines, index, lines[index]!.indent)
      items.push(value)
      index = next
    } else {
      items.push(null)
    }
  }
  return [items, index]
}

function parseMapping(lines: Line[], start: number, indent: number): [YamlMap, number] {
  const map: YamlMap = {}
  let index = start
  while (index < lines.length) {
    const line = lines[index]!
    if (line.indent < indent) break
    if (line.indent > indent) throw new Error(`line ${line.number}: unexpected indentation`)
    if (/^-(\s|$)/.test(line.text)) break
    const [key, rest] = splitKey(line.text, line.number)
    index += 1
    if (rest !== '') {
      map[key] = parseInline(rest, line.number)
      continue
    }
    const child = lines[index]
    const opensBlock =
      child !== undefined &&
      (child.indent > indent || (child.indent === indent && /^-(\s|$)/.test(child.text)))
    if (!opensBlock) {
      map[key] = null
      continue
    }
    const [value, next] = parseBlock(lines, index, child.indent)
    map[key] = value
    index = next
  }
  return [map, index]
}

function splitKey(text: string, number: number): [string, string] {
  if (text.startsWith('"')) {
    const scanner = new Scanner(text, number)
    const key = scanner.quoted()
    scanner.skipSpaces()
    if (!scanner.take(':')) throw new Error(`line ${number}: expected ':' after the key`)
    return [key, text.slice(scanner.at).trim()]
  }
  const match = /^([^:]+?):(\s+|$)(.*)$/.exec(text)
  if (match === null) throw new Error(`line ${number}: expected 'key: value'`)
  return [match[1]!.trim(), (match[3] ?? '').trim()]
}

// A value written on one line: a flow map or list, a quoted string, or a
// plain scalar, which in block context runs to the end of the line.
function parseInline(text: string, number: number): Yaml {
  const first = text[0]
  if (first === '{' || first === '[' || first === '"' || first === "'") {
    const scanner = new Scanner(text, number)
    const value = scanner.value()
    scanner.skipSpaces()
    if (!scanner.isDone() && scanner.peek() !== '#') {
      throw new Error(`line ${number}: unexpected text after the value`)
    }
    return value
  }
  return plain(text.replace(/\s+#.*$/, ''))
}

function plain(word: string): Yaml {
  const text = word.trim()
  if (text === '' || text === '~' || text === 'null') return null
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return text
}

class Scanner {
  at = 0
  constructor(
    private readonly text: string,
    private readonly number: number,
  ) {}

  isDone(): boolean {
    return this.at >= this.text.length
  }

  peek(): string {
    return this.text[this.at] ?? ''
  }

  take(char: string): boolean {
    if (this.peek() !== char) return false
    this.at += 1
    return true
  }

  skipSpaces(): void {
    while (this.peek() === ' ') this.at += 1
  }

  fail(what: string): never {
    throw new Error(`line ${this.number}, column ${this.at + 1}: ${what}`)
  }

  value(): Yaml {
    this.skipSpaces()
    const char = this.peek()
    if (char === '{') return this.map()
    if (char === '[') return this.list()
    if (char === '"' || char === "'") return this.quoted()
    return plain(this.word())
  }

  // A plain scalar inside a flow collection ends at `,`, `]` or `}`.
  word(): string {
    const start = this.at
    while (!this.isDone() && !',]}'.includes(this.peek())) this.at += 1
    return this.text.slice(start, this.at)
  }

  map(): YamlMap {
    this.take('{')
    const map: YamlMap = {}
    this.skipSpaces()
    if (this.take('}')) return map
    for (;;) {
      this.skipSpaces()
      const key = this.peek() === '"' || this.peek() === "'" ? this.quoted() : this.key()
      this.skipSpaces()
      if (!this.take(':')) this.fail(`expected ':' after '${key}'`)
      map[key] = this.value()
      this.skipSpaces()
      if (this.take('}')) return map
      if (!this.take(',')) this.fail("expected ',' or '}'")
    }
  }

  key(): string {
    const start = this.at
    while (!this.isDone() && !':,}'.includes(this.peek())) this.at += 1
    const key = this.text.slice(start, this.at).trim()
    if (key === '') this.fail('expected a key')
    return key
  }

  list(): Yaml[] {
    this.take('[')
    const items: Yaml[] = []
    this.skipSpaces()
    if (this.take(']')) return items
    for (;;) {
      items.push(this.value())
      this.skipSpaces()
      if (this.take(']')) return items
      if (!this.take(',')) this.fail("expected ',' or ']'")
    }
  }

  quoted(): string {
    const quote = this.peek()
    this.at += 1
    let out = ''
    while (!this.isDone()) {
      const char = this.peek()
      this.at += 1
      if (char === quote) {
        // YAML single quotes escape themselves by doubling.
        if (quote === "'" && this.peek() === "'") {
          this.at += 1
          out += "'"
          continue
        }
        return out
      }
      if (char === '\\' && quote === '"') {
        out += this.escape()
        continue
      }
      out += char
    }
    return this.fail('string is not closed')
  }

  escape(): string {
    const char = this.peek()
    this.at += 1
    switch (char) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case '0':
        return '\0'
      case 'u': {
        const hex = this.text.slice(this.at, this.at + 4)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail('bad \\u escape')
        this.at += 4
        return String.fromCharCode(parseInt(hex, 16))
      }
      default:
        return char
    }
  }
}
