// The YAML subset the pipeline's frontmatter uses: block mappings and sequences by indentation,
// flow collections (`[a, b]`, `{k: v}`), quoted and plain scalars, `|` / `>` block scalars and
// comments. No anchors, tags or multiple documents. Plain scalars resolve as YAML 1.2's core
// schema does, except that dates stay strings.

export type Yaml = null | boolean | number | string | Yaml[] | { [key: string]: Yaml }
export type YamlMap = { [key: string]: Yaml }

export class YamlError extends Error {}

const INT_RE = /^[-+]?\d+$/
const FLOAT_RE = /^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/
const KEY_RE = /^([^\s'"\[\]{},#&*!|>%@`-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?:\s+|$)(.*)$/
const NULLS = new Set(['', '~', 'null', 'Null', 'NULL'])
const BOOLS: Record<string, boolean> = { true: true, True: true, TRUE: true, false: false, False: false, FALSE: false }

export const isScalar = (v: unknown): boolean => v === null || typeof v !== 'object'
export const isMap = (v: unknown): v is YamlMap => v !== null && typeof v === 'object' && !Array.isArray(v)

export function resolvePlain(s: string): Yaml {
  if (NULLS.has(s)) return null
  if (s in BOOLS) return BOOLS[s]!
  if (INT_RE.test(s) || FLOAT_RE.test(s)) return Number(s)
  return s
}

/** Index just past the quoted string that starts at s[pos]. */
function quotedEnd(s: string, pos: number): number {
  const q = s[pos]
  let i = pos + 1
  while (i < s.length) {
    if (q === '"' && s[i] === '\\') {
      i += 2
      continue
    }
    if (s[i] === q) {
      if (q === "'" && s[i + 1] === "'") {
        i += 2
        continue
      }
      return i + 1
    }
    i++
  }
  throw new YamlError(`unterminated ${q}-quoted string: ${s.slice(pos)}`)
}

function unquote(token: string): string {
  if (token[0] === "'") return token.slice(1, -1).replace(/''/g, "'")
  try {
    return JSON.parse(token)
  } catch {
    throw new YamlError(`bad escape in ${token}`)
  }
}

function stripComment(s: string): string {
  const m = /\s#/.exec(s)
  return (m ? s.slice(0, m.index) : s).trim()
}

/** `[a, b]` and `{k: v}` collections, possibly nested. */
class FlowParser {
  i = 0
  constructor(readonly s: string) {}

  ws(): void {
    while (this.i < this.s.length && ' \t\r\n'.includes(this.s.charAt(this.i))) this.i++
  }

  value(stops: string): Yaml {
    this.ws()
    const c = this.s[this.i]
    if (c === '[') return this.collection(']', [])
    if (c === '{') return this.collection('}', {})
    if (c === "'" || c === '"') {
      const end = quotedEnd(this.s, this.i)
      const token = this.s.slice(this.i, end)
      this.i = end
      return unquote(token)
    }
    const start = this.i
    while (
      this.i < this.s.length &&
      !stops.includes(this.s.charAt(this.i)) &&
      !(this.s[this.i] === ':' && stops.includes(':') && [' ', undefined].includes(this.s[this.i + 1]))
    )
      this.i++
    return resolvePlain(this.s.slice(start, this.i).trim())
  }

  collection(close: string, out: Yaml[] | YamlMap): Yaml {
    this.i++
    for (;;) {
      this.ws()
      if (this.i >= this.s.length) throw new YamlError(`unterminated collection: ${this.s}`)
      if (this.s[this.i] === close) {
        this.i++
        return out
      }
      if (Array.isArray(out)) out.push(this.value(',]'))
      else {
        const key = this.value(':,}')
        this.ws()
        if (this.s[this.i] !== ':') throw new YamlError(`expected ':' after key '${key}' in ${this.s}`)
        this.i++
        out[String(key)] = this.value(',}')
      }
      this.ws()
      const c = this.s[this.i]
      if (c === ',') this.i++
      else if (c !== close) throw new YamlError(`expected ',' or '${close}' in ${this.s}`)
    }
  }
}

const isItem = (content: string) => content === '-' || content.startsWith('- ')

class BlockParser {
  lines: string[]
  i = 0
  constructor(text: string) {
    this.lines = text.split(/\r?\n/)
  }

  fail(msg: string): never {
    throw new YamlError(`line ${this.i + 1}: ${msg}`)
  }

  /** [indent, content] of the next line that is not blank or a comment. */
  peek(): [number, string] | undefined {
    while (this.i < this.lines.length) {
      const raw = this.lines[this.i]!
      const body = raw.replace(/^ +/, '')
      if (body.startsWith('\t')) this.fail('tabs are not allowed for indentation')
      if (body.trim() && !body.startsWith('#')) return [raw.length - body.length, body.trimEnd()]
      this.i++
    }
    return undefined
  }

  node(): Yaml {
    const nxt = this.peek()
    if (!nxt) return null
    return isItem(nxt[1]) ? this.seq(nxt[0]) : this.map(nxt[0])
  }

  map(indent: number): YamlMap {
    const out: YamlMap = {}
    for (;;) {
      const nxt = this.peek()
      if (!nxt || nxt[0] < indent) return out
      const [ind, content] = nxt
      if (ind > indent) this.fail(`unexpected indentation: ${content}`)
      if (isItem(content)) this.fail(`a list item where a 'key: value' line was expected: ${content}`)
      const [key, rest] = this.splitKey(content)
      if (key in out) this.fail(`duplicate key '${key}'`)
      this.i++
      if (rest) {
        out[key] = this.scalar(rest, indent)
        continue
      }
      const child = this.peek()
      out[key] = child && (child[0] > indent || (child[0] === indent && isItem(child[1]))) ? this.node() : null
    }
  }

  seq(indent: number): Yaml[] {
    const out: Yaml[] = []
    for (;;) {
      const nxt = this.peek()
      if (!nxt || nxt[0] < indent || !isItem(nxt[1])) {
        if (nxt && nxt[0] > indent) this.fail(`unexpected indentation: ${nxt[1]}`)
        return out
      }
      const [ind, content] = nxt
      if (ind > indent) this.fail(`unexpected indentation: ${content}`)
      const rest = content.slice(1).replace(/^ +/, '')
      const col = ind + content.length - rest.length
      if (!rest) {
        this.i++
        const child = this.peek()
        out.push(child && child[0] > indent ? this.node() : null)
      } else if (isItem(rest) || (!'[{"\''.includes(rest.charAt(0)) && KEY_RE.test(rest))) {
        // `- key: value` or `- - x`: the item is a block node starting at this column.
        this.lines[this.i] = ' '.repeat(col) + rest
        out.push(this.node())
      } else {
        this.i++
        out.push(this.scalar(rest, indent))
      }
    }
  }

  splitKey(content: string): [string, string] {
    if (content[0] === '"' || content[0] === "'") {
      const end = quotedEnd(content, 0)
      const m = /^\s*:(?:\s+|$)(.*)$/.exec(content.slice(end))
      if (!m) this.fail(`expected ':' after ${content.slice(0, end)}`)
      return [unquote(content.slice(0, end)), m[1]!.trim()]
    }
    const m = KEY_RE.exec(content)
    if (!m) this.fail(`expected 'key: value', got: ${content}`)
    return [m[1]!.trim(), m[2]!.trim()]
  }

  /** The value after `key:` or `- ` on the current line (already consumed). */
  scalar(rest: string, indent: number): Yaml {
    if (rest[0] === '|' || rest[0] === '>') return this.blockScalar(rest, indent)
    if (rest[0] === '[' || rest[0] === '{') {
      let text = rest
      for (;;) {
        try {
          const p = new FlowParser(text.includes('#') ? stripComment(text) : text)
          const value = p.value('')
          p.ws()
          if (p.i !== p.s.length) this.fail(`unexpected text after collection: ${p.s.slice(p.i)}`)
          return value
        } catch (err) {
          // A flow collection may span lines: append the next one and retry.
          if (!(err instanceof YamlError) || this.i >= this.lines.length) throw err
          text += ' ' + this.lines[this.i]!.trim()
          this.i++
        }
      }
    }
    if (rest[0] === '"' || rest[0] === "'") {
      const end = quotedEnd(rest, 0)
      const tail = rest.slice(end).trim()
      if (tail && !tail.startsWith('#')) this.fail(`unexpected text after quoted string: ${tail}`)
      return unquote(rest.slice(0, end))
    }
    if ('&*!'.includes(rest.charAt(0))) this.fail(`anchors, aliases and tags are not supported: ${rest}`)
    let value = stripComment(rest)
    // Plain scalars may wrap onto more-indented lines.
    for (;;) {
      const nxt = this.peek()
      if (!nxt || nxt[0] <= indent) break
      if (KEY_RE.test(nxt[1]) || isItem(nxt[1])) this.fail(`unexpected indentation: ${nxt[1]}`)
      value += ' ' + stripComment(nxt[1])
      this.i++
    }
    return resolvePlain(value)
  }

  blockScalar(header: string, indent: number): string {
    const m = /^([|>])([-+]?)\s*(#.*)?$/.exec(header)
    if (!m) this.fail(`bad block scalar header: ${header}`)
    const [, style, chomp] = m
    const lines: string[] = []
    let blockIndent: number | undefined
    while (this.i < this.lines.length) {
      const raw = this.lines[this.i]!
      if (raw.trim()) {
        const ind = raw.length - raw.replace(/^ +/, '').length
        if (ind <= indent) break
        blockIndent ??= ind
        if (ind < blockIndent) break
        lines.push(raw.slice(blockIndent))
      } else lines.push('')
      this.i++
    }
    while (chomp !== '+' && lines.length && !lines[lines.length - 1]) lines.pop()
    const text =
      style === '|' ? lines.join('\n') : lines.join('\n').replace(/(?<!\n)\n(?!\n)/g, ' ').replace(/\n\n/g, '\n')
    return text + (chomp === '-' || !text ? '' : '\n')
  }
}

export function parseYaml(text: string): Yaml {
  const parser = new BlockParser(text)
  const value = parser.node()
  if (parser.peek()) parser.fail(`unexpected line: ${parser.lines[parser.i]!.trim()}`)
  return value
}

/** True if `s` can be written unquoted and reads back as the same string. */
function plainOk(s: string, flow: boolean): boolean {
  if (!s || s !== s.trim() || s.includes('\n') || resolvePlain(s) !== s) return false
  if ('-?:,[]{}#&*!|>\'"%@`'.includes(s.charAt(0)) || s.includes(': ') || s.includes(' #') || s.endsWith(':')) return false
  // YAML 1.1 readers would turn these into dates or booleans.
  if (/^\d{4}-\d\d-\d\d/.test(s) || /^(yes|no|on|off|y|n)$/i.test(s)) return false
  return !(flow && /[,\[\]{}]/.test(s))
}

function dumpScalar(v: unknown, flow = false): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  const s = String(v)
  return plainOk(s, flow) ? s : JSON.stringify(s)
}

function dumpInline(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(dumpInline).join(', ') + ']'
  if (isMap(v)) return '{' + Object.entries(v).map(([k, x]) => `${dumpScalar(k, true)}: ${dumpInline(x)}`).join(', ') + '}'
  return dumpScalar(v, true)
}

const isBlock = (v: unknown) =>
  (isMap(v) && Object.keys(v).length > 0) || (Array.isArray(v) && v.length > 0 && !v.every(isScalar))

/** Block-style YAML; short lists of scalars and empty collections inline. */
export function dumpYaml(value: unknown, indent = 0): string[] {
  const pad = ' '.repeat(indent)
  const lines: string[] = []
  if (isMap(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      if (isBlock(v)) lines.push(`${pad}${dumpScalar(k)}:`, ...dumpYaml(v, indent + 2))
      else lines.push(`${pad}${dumpScalar(k)}: ${dumpInline(v)}`)
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      const sub = isBlock(v) ? dumpYaml(v, indent + 2) : [`${pad}  ${dumpInline(v)}`]
      lines.push(`${pad}- ${sub[0]!.slice(indent + 2)}`, ...sub.slice(1))
    }
  } else lines.push(pad + dumpScalar(value))
  return lines
}

const FM_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*\r?$\n?/m

/** [data, body]; data is undefined when the text has no frontmatter. Throws YamlError. */
export function splitFrontmatter(text: string): [YamlMap | undefined, string] {
  const m = FM_RE.exec(text)
  if (!m || m.index !== 0) {
    if (text.replace(/^﻿/, '').startsWith('---'))
      throw new YamlError("frontmatter opened with '---' but never closed with a '---' line")
    return [undefined, text]
  }
  const data = parseYaml(m[1]!)
  if (data !== null && !isMap(data)) throw new YamlError("frontmatter must be a mapping of 'key: value' lines")
  return [data ?? {}, text.slice(m[0].length)]
}

export function renderDoc(data: YamlMap, body: string): string {
  return '---\n' + dumpYaml(data).join('\n') + '\n---\n\n' + body.trimEnd() + '\n'
}
