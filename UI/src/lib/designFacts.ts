// Extracts comparable design facts from SwiftUI and Flutter source so the
// offline analyzer can detect drift and propose Android sync fixes.

export type FactCategory =
  | 'color'
  | 'padding-vertical'
  | 'padding-horizontal'
  | 'spacing'
  | 'font-size'
  | 'corner-radius'
  | 'text'
  | 'animation-ms'

export type FactScope = 'screen' | 'component' | 'inner'

export interface DesignFact {
  category: FactCategory
  value: string
  line: number
  platform: 'ios' | 'android'
  /** Substring used to locate this fact for proposed-fix generation. */
  needle: string
  label: string
  scope?: FactScope
}

function normalizeHex(hex: string): string {
  const h = hex.replace(/^#/, '').toUpperCase()
  return h.length === 6 ? `#${h}` : hex
}

function dartHex(raw: string): string {
  return `#${raw.slice(-6).toUpperCase()}`
}

/** Outermost screen-edge horizontal padding on iOS (last modifier chain entry). */
export function extractScreenEdgePaddingIos(code: string): DesignFact | null {
  const lines = code.split('\n')
  let last: DesignFact | null = null
  lines.forEach((line, i) => {
    const m = line.match(/\.padding\(\.horizontal,\s*(\d+)\)/)
    if (m) {
      last = {
        category: 'padding-horizontal',
        value: m[1],
        line: i + 1,
        platform: 'ios',
        needle: m[0],
        label: 'Screen edge horizontal padding',
        scope: 'screen',
      }
    }
  })
  return last
}

/** ScrollView / SingleChildScrollView horizontal padding on Android. */
export function extractScreenEdgePaddingAndroid(code: string): DesignFact | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('SingleChildScrollView') && !lines[i].includes('ScrollView(')) continue
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      const m = lines[j].match(/EdgeInsets\.symmetric\(\s*horizontal:\s*(\d+)/)
      if (m) {
        const needle = m[0].includes(')') ? m[0] : `EdgeInsets.symmetric(horizontal: ${m[1]})`
        return {
          category: 'padding-horizontal',
          value: m[1],
          line: j + 1,
          platform: 'android',
          needle,
          label: 'Screen edge horizontal padding',
          scope: 'screen',
        }
      }
    }
  }
  const fallback = extractAndroidFacts(code).find((f) => f.category === 'padding-horizontal')
  return fallback ? { ...fallback, scope: 'screen' as const, label: 'Screen edge horizontal padding' } : null
}

export function extractIosFacts(code: string): DesignFact[] {
  const facts: DesignFact[] = []
  const lines = code.split('\n')
  const seenLines = new Set<string>()

  lines.forEach((line, i) => {
    const lineNo = i + 1
    const lineKey = `${lineNo}`

    const color =
      line.match(/Color\(hex:\s*"([^"]+)"\)/) ??
      line.match(/\.foregroundColor\(Color\(hex:\s*"([^"]+)"\)\)/)
    if (color) {
      const ctx = line.includes('.background')
        ? 'background'
        : line.includes('foreground')
          ? 'foreground'
          : 'fill'
      facts.push({
        category: 'color',
        value: normalizeHex(color[1]),
        line: lineNo,
        platform: 'ios',
        needle: color[0],
        label: `Color ${ctx}`,
      })
    }

    const padV = line.match(/\.padding\(\.vertical,\s*(\d+)\)/)
    if (padV) {
      facts.push({
        category: 'padding-vertical',
        value: padV[1],
        line: lineNo,
        platform: 'ios',
        needle: padV[0],
        label: 'Vertical padding',
      })
    }

    const padH = line.match(/\.padding\(\.horizontal,\s*(\d+)\)/)
    if (padH && !seenLines.has(`h-${lineKey}`)) {
      seenLines.add(`h-${lineKey}`)
      facts.push({
        category: 'padding-horizontal',
        value: padH[1],
        line: lineNo,
        platform: 'ios',
        needle: padH[0],
        label: 'Horizontal padding',
        scope: 'component',
      })
    }

    const spacing = line.match(/spacing:\s*(\d+)/)
    if (spacing) {
      facts.push({
        category: 'spacing',
        value: spacing[1],
        line: lineNo,
        platform: 'ios',
        needle: `spacing: ${spacing[1]}`,
        label: 'Stack spacing',
      })
    }

    const fontCustom = line.match(/size:\s*(\d+)/)
    if (fontCustom && (line.includes('.font') || lines[i - 1]?.includes('.font'))) {
      facts.push({
        category: 'font-size',
        value: fontCustom[1],
        line: lineNo,
        platform: 'ios',
        needle: `size: ${fontCustom[1]}`,
        label: 'Font size',
      })
    }

    const radius = line.match(/\.cornerRadius\((\d+)\)/)
    if (radius) {
      facts.push({
        category: 'corner-radius',
        value: radius[1],
        line: lineNo,
        platform: 'ios',
        needle: radius[0],
        label: 'Corner radius',
      })
    }

    const text = line.match(/Text\("([^"]+)"\)/)
    if (text) {
      facts.push({
        category: 'text',
        value: text[1],
        line: lineNo,
        platform: 'ios',
        needle: `Text("${text[1]}")`,
        label: `Text "${text[1].slice(0, 24)}${text[1].length > 24 ? '…' : ''}"`,
      })
    }

    const anim = line.match(/duration:\s*([\d.]+)/)
    if (anim && line.includes('animation')) {
      const ms = String(Math.round(Number(anim[1]) * 1000))
      facts.push({
        category: 'animation-ms',
        value: ms,
        line: lineNo,
        platform: 'ios',
        needle: anim[0],
        label: 'Animation duration',
      })
    }
  })

  const screenPad = extractScreenEdgePaddingIos(code)
  if (screenPad) {
    const idx = facts.findIndex(
      (f) => f.category === 'padding-horizontal' && f.line === screenPad.line,
    )
    if (idx >= 0) facts[idx] = screenPad
    else facts.push(screenPad)
  }

  return facts
}

export function extractAndroidFacts(code: string): DesignFact[] {
  const facts: DesignFact[] = []
  const lines = code.split('\n')
  const seenPadHLines = new Set<number>()

  lines.forEach((line, i) => {
    const lineNo = i + 1

    const color = line.match(/Color\(0x([0-9A-Fa-f]+)\)/)
    if (color) {
      const ctx = line.includes('backgroundColor')
        ? 'background'
        : line.includes('color:')
          ? 'foreground'
          : 'fill'
      facts.push({
        category: 'color',
        value: dartHex(color[1]),
        line: lineNo,
        platform: 'android',
        needle: color[0],
        label: `Color ${ctx}`,
      })
    }

    const padV = line.match(/EdgeInsets\.symmetric\([^)]*vertical:\s*(\d+)/)
    if (padV) {
      facts.push({
        category: 'padding-vertical',
        value: padV[1],
        line: lineNo,
        platform: 'android',
        needle: padV[0],
        label: 'Vertical padding',
      })
    }

    const padH = line.match(/EdgeInsets\.symmetric\([^)]*horizontal:\s*(\d+)/)
    if (padH && !seenPadHLines.has(lineNo)) {
      seenPadHLines.add(lineNo)
      const needle = padH[0].endsWith(')') ? padH[0] : `EdgeInsets.symmetric(horizontal: ${padH[1]})`
      facts.push({
        category: 'padding-horizontal',
        value: padH[1],
        line: lineNo,
        platform: 'android',
        needle,
        label: 'Horizontal padding',
        scope: 'component',
      })
    }

    const spacing = line.match(/SizedBox\(height:\s*(\d+)\)/)
    if (spacing) {
      facts.push({
        category: 'spacing',
        value: spacing[1],
        line: lineNo,
        platform: 'android',
        needle: `height: ${spacing[1]}`,
        label: 'Vertical spacing',
      })
    }

    const fontSize = line.match(/fontSize:\s*(\d+)/)
    if (fontSize) {
      facts.push({
        category: 'font-size',
        value: fontSize[1],
        line: lineNo,
        platform: 'android',
        needle: `fontSize: ${fontSize[1]}`,
        label: 'Font size',
      })
    }

    const radius = line.match(/BorderRadius\.circular\((\d+)\)/)
    if (radius) {
      facts.push({
        category: 'corner-radius',
        value: radius[1],
        line: lineNo,
        platform: 'android',
        needle: radius[0],
        label: 'Corner radius',
      })
    }

    const text = line.match(/Text\('([^']+)'\)/) ?? line.match(/Text\("([^"]+)"\)/)
    if (text) {
      facts.push({
        category: 'text',
        value: text[1],
        line: lineNo,
        platform: 'android',
        needle: text[0],
        label: `Text "${text[1].slice(0, 24)}${text[1].length > 24 ? '…' : ''}"`,
      })
    }

    const anim = line.match(/Duration\(milliseconds:\s*(\d+)\)/)
    if (anim) {
      facts.push({
        category: 'animation-ms',
        value: anim[1],
        line: lineNo,
        platform: 'android',
        needle: anim[0],
        label: 'Animation duration',
      })
    }
  })

  const screenPad = extractScreenEdgePaddingAndroid(code)
  if (screenPad) {
    const idx = facts.findIndex(
      (f) => f.category === 'padding-horizontal' && f.line === screenPad.line,
    )
    if (idx >= 0) facts[idx] = screenPad
    else facts.push(screenPad)
  }

  return facts
}

const CATEGORY_ORDER: FactCategory[] = [
  'padding-horizontal',
  'padding-vertical',
  'spacing',
  'color',
  'font-size',
  'corner-radius',
  'text',
  'animation-ms',
]

/** Pair facts — screen-scope padding first, then by category order + index. */
export function pairFacts(
  iosFacts: DesignFact[],
  androidFacts: DesignFact[],
): { category: FactCategory; ios: DesignFact; android: DesignFact }[] {
  const pairs: { category: FactCategory; ios: DesignFact; android: DesignFact }[] = []
  const usedIos = new Set<DesignFact>()
  const usedAndroid = new Set<DesignFact>()

  const iosScreen = iosFacts.find((f) => f.scope === 'screen' && f.category === 'padding-horizontal')
  const androidScreen = androidFacts.find(
    (f) => f.scope === 'screen' && f.category === 'padding-horizontal',
  )
  if (iosScreen && androidScreen) {
    pairs.push({ category: 'padding-horizontal', ios: iosScreen, android: androidScreen })
    usedIos.add(iosScreen)
    usedAndroid.add(androidScreen)
  }

  for (const category of CATEGORY_ORDER) {
    const ios = iosFacts.filter((f) => f.category === category && !usedIos.has(f))
    const android = androidFacts.filter((f) => f.category === category && !usedAndroid.has(f))
    const count = Math.min(ios.length, android.length)
    for (let i = 0; i < count; i++) {
      pairs.push({ category, ios: ios[i], android: android[i] })
      usedIos.add(ios[i])
      usedAndroid.add(android[i])
    }
  }

  return pairs
}

export function countByCategory(facts: DesignFact[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of facts) {
    counts[f.category] = (counts[f.category] ?? 0) + 1
  }
  return counts
}
