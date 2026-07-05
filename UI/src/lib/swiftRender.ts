// ─────────────────────────────────────────────────────────────────────────────
// SwiftUI → render tree. Parses the *actual* Swift source of a screen (the
// `var body: some View { … }` block) into a tree of typed nodes with resolved
// modifiers, so the iOS preview renders what the code says — not a hardcoded
// mock. Tolerant by design: unknown views render as labelled placeholders and
// unparseable statements are skipped, never thrown.
// ─────────────────────────────────────────────────────────────────────────────

export interface SwiftArg {
  label: string | null
  value: string
}

export interface SwiftModifier {
  name: string
  args: SwiftArg[]
}

export interface SwiftNode {
  kind: string // 'VStack' | 'Text' | 'TextField' | … | custom view names
  args: SwiftArg[]
  children: SwiftNode[]
  modifiers: SwiftModifier[]
  line: number // 1-based line in the original source
}

// ── theme / token resolution ─────────────────────────────────────────────────

export interface SwiftTheme {
  colors: Record<string, string> // constant name -> #RRGGBB
  numbers: Record<string, number> // constant name -> value
}

/** Parse Theme.swift-style constants; fall back to rulebook tokens. */
export function buildSwiftTheme(
  themeCode: string | undefined,
  rulebook: Record<string, string> = {},
): SwiftTheme {
  const theme: SwiftTheme = { colors: {}, numbers: {} }
  for (const [key, value] of Object.entries(rulebook)) {
    const name = key.split('.').pop()!
    if (key.startsWith('color.')) theme.colors[name] = value
    else if (/^-?[\d.]+$/.test(value)) theme.numbers[name] = Number(value)
  }
  if (themeCode) {
    const colorRe = /static\s+let\s+(\w+)\s*=\s*Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)/g
    for (const m of themeCode.matchAll(colorRe)) theme.colors[m[1]] = m[2]
    const numRe = /static\s+let\s+(\w+)\s*:\s*(?:CGFloat|Double|Int)\s*=\s*([\d.]+)/g
    for (const m of themeCode.matchAll(numRe)) theme.numbers[m[1]] = Number(m[2])
  }
  return theme
}

const SYSTEM_COLORS: Record<string, string> = {
  white: '#FFFFFF',
  black: '#000000',
  gray: '#8E8E93',
  secondary: '#8A8A8E',
  primary: '#1A1A1A',
  red: '#FF3B30',
  green: '#34C759',
  blue: '#007AFF',
  orange: '#FF9500',
  yellow: '#FFCC00',
  pink: '#FF2D55',
  purple: '#AF52DE',
  indigo: '#5856D6',
  teal: '#30B0C7',
  mint: '#00C7BE',
  cyan: '#32ADE6',
  brown: '#A2845E',
  clear: 'transparent',
  accentColor: '#007AFF',
}

export function resolveColor(expr: string | undefined, theme: SwiftTheme): string | undefined {
  if (!expr) return undefined
  const e = expr.trim()
  const hex = e.match(/Color\(hex:\s*"(#[0-9A-Fa-f]{6})"\)/)
  if (hex) return hex[1]
  const themed = e.match(/^(?:Theme|AppTheme)\.(\w+)$/)
  if (themed) return theme.colors[themed[1]]
  const dotted = e.match(/^(?:Color)?\.?(\w+)$/)
  if (dotted && SYSTEM_COLORS[dotted[1]]) return SYSTEM_COLORS[dotted[1]]
  const named = e.match(/^Color\("([^"]+)"\)$/)
  if (named) return theme.colors[named[1]] ?? '#8E8E93'
  return undefined
}

export function resolveNumber(expr: string | undefined, theme: SwiftTheme): number | undefined {
  if (!expr) return undefined
  const e = expr.trim()
  if (/^-?[\d.]+$/.test(e)) return Number(e)
  const themed = e.match(/^(?:Theme|AppTheme)\.(\w+)$/)
  if (themed) return theme.numbers[themed[1]]
  return undefined
}

// ── lexer helpers ────────────────────────────────────────────────────────────

/** Blank out line and block comments, preserving offsets and newlines. */
function stripComments(src: string): string {
  const out = src.split('')
  let i = 0
  let inString = false
  while (i < src.length) {
    const c = src[i]
    if (inString) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '"') inString = false
      i++
      continue
    }
    if (c === '"') {
      inString = true
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') out[i++] = ' '
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i++
      }
      if (i < src.length) {
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
      }
      continue
    }
    i++
  }
  return out.join('')
}

/** Index of the delimiter matching src[open] (which must be an opener). */
function matchDelim(src: string, open: number): number {
  const opener = src[open]
  const closer = opener === '(' ? ')' : opener === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === opener) depth++
    else if (c === closer) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Split on top-level commas (ignores commas inside (), {}, [], ""). */
function splitTopLevel(src: string): string[] {
  const parts: string[] = []
  let depth = 0
  let inString = false
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      parts.push(src.slice(start, i))
      start = i + 1
    }
  }
  parts.push(src.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

function parseArgs(argsSrc: string): SwiftArg[] {
  return splitTopLevel(argsSrc).map((part) => {
    // "label: value" — but not "::" and not a URL inside a string
    const m = part.match(/^([\w$]+)\s*:\s*([\s\S]*)$/)
    if (m) return { label: m[1], value: m[2].trim() }
    return { label: null, value: part }
  })
}

// ── parser ───────────────────────────────────────────────────────────────────

const CONTROL_KEYWORDS = new Set(['if', 'else', 'guard', 'switch', 'for', 'while', 'ForEach', 'Group'])

class Parser {
  private src: string
  private lineStarts: number[]

  constructor(src: string, lineStarts: number[]) {
    this.src = src
    this.lineStarts = lineStarts
  }

  private lineAt(index: number): number {
    let lo = 0
    let hi = this.lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.lineStarts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  /** Parse the view statements inside src[from..to) (exclusive of braces). */
  parseViews(from: number, to: number): SwiftNode[] {
    const nodes: SwiftNode[] = []
    let i = from
    while (i < to) {
      const c = this.src[i]
      if (/\s/.test(c)) {
        i++
        continue
      }
      const rest = this.src.slice(i, to)
      const ident = rest.match(/^([A-Za-z_][\w.]*)/)
      if (!ident) {
        i++ // stray token — skip one char and resync
        continue
      }
      const name = ident[1]

      // let/var/@State etc. — skip the whole line
      if (/^(let|var|private|public|internal|func|return|self|case|default)$/.test(name) || c === '@') {
        const nl = this.src.indexOf('\n', i)
        i = nl === -1 ? to : nl + 1
        continue
      }

      // control flow: render the first branch's children transparently
      if (CONTROL_KEYWORDS.has(name.split('.')[0])) {
        const brace = this.src.indexOf('{', i)
        if (brace === -1 || brace >= to) {
          const nl = this.src.indexOf('\n', i)
          i = nl === -1 ? to : nl + 1
          continue
        }
        const close = matchDelim(this.src, brace)
        if (close === -1 || close > to) break
        nodes.push(...this.parseViews(brace + 1, close))
        i = close + 1
        continue
      }

      const parsed = this.parseExpression(i, to)
      if (!parsed) {
        const nl = this.src.indexOf('\n', i)
        i = nl === -1 ? to : nl + 1
        continue
      }
      if (/^[A-Z]/.test(name)) nodes.push(parsed.node)
      i = parsed.end
    }
    return nodes
  }

  /** Parse `Name(args)? { children }? .mod(args)…` starting at `start`. */
  private parseExpression(start: number, to: number): { node: SwiftNode; end: number } | null {
    const rest = this.src.slice(start, to)
    const ident = rest.match(/^([A-Za-z_][\w]*)/)
    if (!ident) return null
    const name = ident[1]
    let i = start + name.length

    const node: SwiftNode = {
      kind: name,
      args: [],
      children: [],
      modifiers: [],
      line: this.lineAt(start),
    }

    i = this.skipSpacesSameStatement(i, to)
    if (this.src[i] === '(') {
      const close = matchDelim(this.src, i)
      if (close === -1 || close > to) return null
      node.args = parseArgs(this.src.slice(i + 1, close))
      i = close + 1
    }

    i = this.skipSpacesSameStatement(i, to)
    if (this.src[i] === '{') {
      const close = matchDelim(this.src, i)
      if (close === -1 || close > to) return null
      // Button("x") { action } — a closure on a string-labelled Button is the
      // action, not content; content closures get parsed as child views.
      const inner = this.src.slice(i + 1, close)
      const children = this.parseViews(i + 1, close)
      node.children = children
      if (name === 'Button' && node.args.some((a) => a.label === null && a.value.startsWith('"')) && children.length === 0) {
        // plain action closure — nothing visual inside
      } else if (children.length === 0 && inner.trim() && name !== 'Button') {
        // non-view closure content (e.g. computed) — ignore
      }
      i = close + 1
    }

    // modifier chain (may span newlines)
    for (;;) {
      const j = this.skipAllSpaces(i, to)
      if (this.src[j] !== '.') break
      const modMatch = this.src.slice(j + 1, to).match(/^([a-zA-Z_]\w*)/)
      if (!modMatch) break
      const modName = modMatch[1]
      let k = j + 1 + modName.length
      let args: SwiftArg[] = []
      const afterName = this.skipSpacesSameStatement(k, to)
      if (this.src[afterName] === '(') {
        const close = matchDelim(this.src, afterName)
        if (close === -1 || close > to) break
        args = parseArgs(this.src.slice(afterName + 1, close))
        k = close + 1
      } else if (this.src[afterName] === '{') {
        // trailing-closure modifier (.overlay { … }) — skip its body
        const close = matchDelim(this.src, afterName)
        if (close === -1 || close > to) break
        k = close + 1
      }
      node.modifiers.push({ name: modName, args })
      i = k
    }

    return { node, end: i }
  }

  /** Skip spaces/tabs but NOT newlines (a newline ends the call segment). */
  private skipSpacesSameStatement(i: number, to: number): number {
    while (i < to && (this.src[i] === ' ' || this.src[i] === '\t')) i++
    return i
  }

  /** Skip all whitespace including newlines (for modifier chains). */
  private skipAllSpaces(i: number, to: number): number {
    while (i < to && /\s/.test(this.src[i])) i++
    return i
  }
}

/** Parse a SwiftUI file: returns the view nodes of `var body: some View`. */
export function parseSwiftUI(source: string): SwiftNode[] {
  try {
    const src = stripComments(source)
    const bodyMatch = src.match(/var\s+body\s*:\s*some\s+View\s*/)
    let open: number
    if (bodyMatch && bodyMatch.index !== undefined) {
      open = src.indexOf('{', bodyMatch.index + bodyMatch[0].length - 1)
    } else {
      // pasted snippet without a body — parse the whole thing
      open = -1
    }
    const lineStarts = [0]
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1)
    const parser = new Parser(src, lineStarts)
    if (open === -1) return parser.parseViews(0, src.length)
    const close = matchDelim(src, open)
    if (close === -1) return parser.parseViews(open + 1, src.length)
    return parser.parseViews(open + 1, close)
  } catch {
    return []
  }
}

// ── modifier interpretation ──────────────────────────────────────────────────

export interface ResolvedStyle {
  padding: { top: number; bottom: number; left: number; right: number }
  width?: number
  height?: number
  maxWidthInfinity?: boolean
  background?: string
  foreground?: string
  cornerRadius?: number
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  opacity?: number
  roundedBorderField?: boolean
  switchToggle?: boolean
  tint?: string
  textAlign?: 'left' | 'center' | 'right'
  border?: { color: string; width: number; radius?: number }
}

const WEIGHTS: Record<string, number> = {
  ultraLight: 200,
  thin: 100,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
  black: 900,
}

const FONT_PRESETS: Record<string, { size: number; weight?: number }> = {
  largeTitle: { size: 34, weight: 700 },
  title: { size: 28 },
  title2: { size: 22 },
  title3: { size: 20 },
  headline: { size: 17, weight: 600 },
  body: { size: 17 },
  callout: { size: 16 },
  subheadline: { size: 15 },
  footnote: { size: 13 },
  caption: { size: 12 },
  caption2: { size: 11 },
}

/** "SpaceGrotesk-Bold" → { family: "Space Grotesk", weight: 700 } */
function parseFontName(raw: string): { family: string; weight?: number } {
  const [base, ...suffixes] = raw.split('-')
  const family = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const suffix = suffixes.join('').toLowerCase()
  const weight =
    suffix.includes('black') ? 900 :
    suffix.includes('heavy') || suffix.includes('extrabold') ? 800 :
    suffix.includes('semibold') ? 600 :
    suffix.includes('bold') ? 700 :
    suffix.includes('medium') ? 500 :
    suffix.includes('light') ? 300 :
    suffix.includes('thin') ? 100 :
    undefined
  return { family, weight }
}

function arg(args: SwiftArg[], label: string): string | undefined {
  return args.find((a) => a.label === label)?.value
}

function positional(args: SwiftArg[], index = 0): string | undefined {
  const found = args.filter((a) => a.label === null)
  return found[index]?.value
}

export function resolveStyle(node: SwiftNode, theme: SwiftTheme): ResolvedStyle {
  const style: ResolvedStyle = { padding: { top: 0, bottom: 0, left: 0, right: 0 } }

  for (const mod of node.modifiers) {
    switch (mod.name) {
      case 'padding': {
        const amountRaw = mod.args.find((a) => a.label === null && !a.value.startsWith('.') && !a.value.startsWith('['))
        const amount = resolveNumber(amountRaw?.value ?? mod.args[1]?.value, theme) ?? 16
        const edges = mod.args.map((a) => a.value).join(' ')
        const all = mod.args.length === 0 || (!edges.includes('.') && mod.args.length === 1)
        const has = (edge: string) => edges.includes(edge)
        if (all || (!has('horizontal') && !has('vertical') && !has('top') && !has('bottom') && !has('leading') && !has('trailing'))) {
          style.padding = { top: amount, bottom: amount, left: amount, right: amount }
        } else {
          if (has('horizontal')) { style.padding.left += amount; style.padding.right += amount }
          if (has('vertical')) { style.padding.top += amount; style.padding.bottom += amount }
          if (has('top')) style.padding.top += amount
          if (has('bottom')) style.padding.bottom += amount
          if (has('leading')) style.padding.left += amount
          if (has('trailing')) style.padding.right += amount
        }
        break
      }
      case 'frame': {
        const w = arg(mod.args, 'width')
        const h = arg(mod.args, 'height')
        const maxW = arg(mod.args, 'maxWidth')
        if (w) style.width = resolveNumber(w, theme)
        if (h) style.height = resolveNumber(h, theme)
        if (maxW === '.infinity') style.maxWidthInfinity = true
        break
      }
      case 'background': {
        const color = resolveColor(positional(mod.args), theme)
        if (color) style.background = color
        break
      }
      case 'foregroundColor':
      case 'foregroundStyle': {
        const color = resolveColor(positional(mod.args), theme)
        if (color) style.foreground = color
        break
      }
      case 'tint':
      case 'accentColor': {
        const color = resolveColor(positional(mod.args), theme)
        if (color) style.tint = color
        break
      }
      case 'cornerRadius': {
        style.cornerRadius = resolveNumber(positional(mod.args), theme)
        break
      }
      case 'clipShape': {
        const v = positional(mod.args) ?? ''
        const rr = v.match(/RoundedRectangle\(cornerRadius:\s*([^,)]+)/)
        if (rr) style.cornerRadius = resolveNumber(rr[1], theme)
        else if (v.includes('Capsule') || v.includes('Circle')) style.cornerRadius = 999
        break
      }
      case 'font': {
        const v = positional(mod.args) ?? ''
        const custom = v.match(/\.custom\(\s*"([^"]+)"\s*,\s*size:\s*([^,)]+)/)
        const system = v.match(/\.system\(\s*size:\s*([^,)]+)(?:,\s*weight:\s*\.(\w+))?/)
        const preset = v.match(/^\.(\w+)$/)
        if (custom) {
          const { family, weight } = parseFontName(custom[1])
          style.fontFamily = family
          if (weight) style.fontWeight = weight
          style.fontSize = resolveNumber(custom[2], theme)
        } else if (system) {
          style.fontSize = resolveNumber(system[1], theme)
          if (system[2] && WEIGHTS[system[2]]) style.fontWeight = WEIGHTS[system[2]]
        } else if (preset && FONT_PRESETS[preset[1]]) {
          style.fontSize = FONT_PRESETS[preset[1]].size
          const w = FONT_PRESETS[preset[1]].weight
          if (w) style.fontWeight = w
        }
        break
      }
      case 'fontWeight': {
        const v = (positional(mod.args) ?? '').replace('.', '')
        if (WEIGHTS[v]) style.fontWeight = WEIGHTS[v]
        break
      }
      case 'bold':
        style.fontWeight = 700
        break
      case 'opacity': {
        style.opacity = resolveNumber(positional(mod.args), theme)
        break
      }
      case 'textFieldStyle': {
        if ((positional(mod.args) ?? '').includes('roundedBorder')) style.roundedBorderField = true
        break
      }
      case 'toggleStyle': {
        if ((positional(mod.args) ?? '').includes('switch')) style.switchToggle = true
        break
      }
      case 'multilineTextAlignment': {
        const v = positional(mod.args) ?? ''
        if (v.includes('center')) style.textAlign = 'center'
        else if (v.includes('trailing')) style.textAlign = 'right'
        else style.textAlign = 'left'
        break
      }
      case 'overlay': {
        const v = positional(mod.args) ?? ''
        const stroke = v.match(/RoundedRectangle\(cornerRadius:\s*([^,)]+)\)\s*\.stroke\(([^,)]+)(?:,\s*lineWidth:\s*([^)]+))?\)/)
        if (stroke) {
          const color = resolveColor(stroke[2], theme) ?? '#D1D1D6'
          style.border = {
            color,
            width: resolveNumber(stroke[3], theme) ?? 1,
            radius: resolveNumber(stroke[1], theme),
          }
        }
        break
      }
      default:
        break // .resizable, .autocapitalization, .buttonStyle, … — no visual mapping needed
    }
  }
  return style
}

/** First unlabeled string-literal argument, unquoted ("Email" → Email). */
export function firstStringArg(node: SwiftNode): string | undefined {
  for (const a of node.args) {
    if (a.label === null) {
      const m = a.value.match(/^"([\s\S]*)"$/)
      if (m) return m[1]
    }
  }
  return undefined
}

/** VStack/HStack spacing: argument or SwiftUI's ~8pt default. */
export function stackSpacing(node: SwiftNode, theme: SwiftTheme): number {
  return resolveNumber(arg(node.args, 'spacing'), theme) ?? 8
}

export function stackAlignment(node: SwiftNode): string | undefined {
  return arg(node.args, 'alignment')?.replace('.', '')
}
