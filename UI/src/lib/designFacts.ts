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

export interface DesignFact {
  category: FactCategory
  value: string
  line: number
  platform: 'ios' | 'android'
  /** Substring used to locate this fact for proposed-fix generation. */
  needle: string
  label: string
}

function normalizeHex(hex: string): string {
  const h = hex.replace(/^#/, '').toUpperCase()
  return h.length === 6 ? `#${h}` : hex
}

function dartHex(raw: string): string {
  return `#${raw.slice(-6).toUpperCase()}`
}

export function extractIosFacts(code: string): DesignFact[] {
  const facts: DesignFact[] = []
  const lines = code.split('\n')

  lines.forEach((line, i) => {
    const lineNo = i + 1

    const color = line.match(/Color\(hex:\s*"([^"]+)"\)/)
    if (color) {
      const ctx = line.includes('.background') ? 'background' : line.includes('foreground') ? 'foreground' : 'fill'
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
    if (padH) {
      facts.push({
        category: 'padding-horizontal',
        value: padH[1],
        line: lineNo,
        platform: 'ios',
        needle: padH[0],
        label: 'Horizontal padding',
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

  return facts
}

export function extractAndroidFacts(code: string): DesignFact[] {
  const facts: DesignFact[] = []
  const lines = code.split('\n')

  lines.forEach((line, i) => {
    const lineNo = i + 1

    const color = line.match(/Color\(0x([0-9A-Fa-f]+)\)/)
    if (color) {
      const ctx = line.includes('backgroundColor') ? 'background' : line.includes('color:') ? 'foreground' : 'fill'
      facts.push({
        category: 'color',
        value: dartHex(color[1]),
        line: lineNo,
        platform: 'android',
        needle: color[0],
        label: `Color ${ctx}`,
      })
    }

    const padV = line.match(/EdgeInsets\.symmetric\(vertical:\s*(\d+)\)/)
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

    const padH = line.match(/EdgeInsets\.symmetric\(horizontal:\s*(\d+)\)/)
    if (padH) {
      facts.push({
        category: 'padding-horizontal',
        value: padH[1],
        line: lineNo,
        platform: 'android',
        needle: padH[0],
        label: 'Horizontal padding',
      })
    }

    const padSym = line.match(/padding:\s*const EdgeInsets\.symmetric\(horizontal:\s*(\d+)\)/)
    if (padSym) {
      facts.push({
        category: 'padding-horizontal',
        value: padSym[1],
        line: lineNo,
        platform: 'android',
        needle: `horizontal: ${padSym[1]}`,
        label: 'Horizontal padding',
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

  return facts
}

/** Pair facts by category + ordinal index within that category. */
export function pairFacts(
  iosFacts: DesignFact[],
  androidFacts: DesignFact[],
): { category: FactCategory; ios: DesignFact; android: DesignFact }[] {
  const pairs: { category: FactCategory; ios: DesignFact; android: DesignFact }[] = []
  const categories = new Set([
    ...iosFacts.map((f) => f.category),
    ...androidFacts.map((f) => f.category),
  ])

  for (const category of categories) {
    const ios = iosFacts.filter((f) => f.category === category)
    const android = androidFacts.filter((f) => f.category === category)
    const count = Math.min(ios.length, android.length)
    for (let i = 0; i < count; i++) {
      pairs.push({ category, ios: ios[i], android: android[i] })
    }
    // Unpaired iOS facts (Android missing counterpart) — handled separately
  }

  return pairs
}

export function unpairedIosFacts(iosFacts: DesignFact[], androidFacts: DesignFact[]): DesignFact[] {
  const paired = new Set(pairFacts(iosFacts, androidFacts).map((p) => p.ios))
  return iosFacts.filter((f) => !paired.has(f))
}
