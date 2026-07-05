import type { Inconsistency, ProposedFix } from '../types'

/** Builds a minimal unified diff that replaces the first occurrence of `find`
 *  with `replace` on `targetLine` (or the first line containing `find`). */
function buildLineFix(
  fileName: string,
  code: string,
  targetPlatform: 'ios' | 'android',
  find: string,
  replace: string,
  context = 1,
): ProposedFix {
  const lines = code.split('\n')
  const idx = lines.findIndex((l) => l.includes(find))
  if (idx === -1) {
    return { targetPlatform, file: fileName, diff: '' }
  }
  const start = Math.max(0, idx - context)
  const end = Math.min(lines.length, idx + context + 1)
  const before = lines.slice(start, idx)
  const after = lines.slice(idx + 1, end)
  const oldLine = lines[idx]
  const newLine = oldLine.replace(find, replace)
  const count = before.length + 1 + after.length
  const hunkLines = [
    ...before.map((l) => ` ${l}`),
    `-${oldLine}`,
    `+${newLine}`,
    ...after.map((l) => ` ${l}`),
  ]
  const diff = [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -${start + 1},${count} +${start + 1},${count} @@`,
    ...hunkLines,
    '',
  ].join('\n')
  return { targetPlatform, file: fileName, diff }
}

function findLine(lines: string[], needle: string): number {
  const idx = lines.findIndex((l) => l.includes(needle))
  return idx === -1 ? 1 : idx + 1
}

function normalizeHex(hex: string): string {
  const h = hex.replace(/^#/, '').toUpperCase()
  return h.length === 6 ? `#${h}` : hex
}

function extractIosPrimaryColor(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Color\(hex:\s*"([^"]+)"\)/)
    if (m && (lines[i].includes('.background') || lines[i].includes('backgroundColor'))) {
      return { value: normalizeHex(m[1]), line: i + 1 }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Color\(hex:\s*"([^"]+)"\)/)
    if (m) return { value: normalizeHex(m[1]), line: i + 1 }
  }
  return null
}

function extractAndroidPrimaryColor(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Color\(0x([0-9A-Fa-f]+)\)/)
    if (m && (lines[i].includes('backgroundColor') || lines[i].includes('color:'))) {
      const raw = m[1].slice(-6)
      return { value: `#${raw.toUpperCase()}`, line: i + 1 }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Color\(0x([0-9A-Fa-f]+)\)/)
    if (m) {
      const raw = m[1].slice(-6)
      return { value: `#${raw.toUpperCase()}`, line: i + 1 }
    }
  }
  return null
}

function extractIosPadding(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\.padding\(\.vertical,\s*(\d+)\)/)
    if (m) return { value: m[1], line: i + 1 }
  }
  return null
}

function extractAndroidPadding(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/EdgeInsets\.symmetric\(vertical:\s*(\d+)\)/)
    if (m) return { value: m[1], line: i + 1 }
  }
  return null
}

function extractIosCornerRadius(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\.cornerRadius\((\d+)\)/)
    if (m) return { value: m[1], line: i + 1 }
  }
  return null
}

function extractAndroidCornerRadius(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/BorderRadius\.circular\((\d+)\)/)
    if (m) return { value: m[1], line: i + 1 }
  }
  return null
}

function extractIosHeadingSize(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/size:\s*(\d+)/)
    if (m && lines[i - 1]?.includes('SpaceGrotesk')) {
      return { value: m[1], line: i + 1 }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\.font\(\.custom\([^,]+,\s*size:\s*(\d+)\)/)
    if (m) return { value: m[1], line: i + 1 }
  }
  return null
}

function extractAndroidHeadingSize(code: string): { value: string; line: number } | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/fontSize:\s*(\d+)/)
    if (m && (lines[i - 1]?.includes('SpaceGrotesk') || lines[i - 2]?.includes('SpaceGrotesk'))) {
      return { value: m[1], line: i + 1 }
    }
  }
  return null
}

/** Lightweight client-side consistency check — runs when the engine is offline.
 *  Compares extracted design tokens between iOS and Android and against the
 *  rulebook, returning propagate/flag findings with proposed fixes. */
export function analyzeLocally(
  iosCode: string,
  androidCode: string,
  rulebook: Record<string, string>,
  iosFileName: string,
  androidFileName: string,
  screenId: string,
): Inconsistency[] {
  const findings: Inconsistency[] = []
  const iosLines = iosCode.split('\n')
  const androidLines = androidCode.split('\n')

  const iosColor = extractIosPrimaryColor(iosCode)
  const androidColor = extractAndroidPrimaryColor(androidCode)
  const rulePrimary = rulebook['color.primary']

  if (iosColor && androidColor && iosColor.value !== androidColor.value) {
    const androidHex = `0xFF${androidColor.value.replace('#', '').toUpperCase()}`
    const iosHex = `0xFF${iosColor.value.replace('#', '').toUpperCase()}`
    const fix =
      iosColor.value === normalizeHex(rulePrimary ?? '')
        ? buildLineFix(androidFileName, androidCode, 'android', androidHex, iosHex)
        : buildLineFix(
            iosFileName,
            iosCode,
            'ios',
            `Color(hex: "${iosColor.value.replace('#', '')}")`,
            `Color(hex: "${androidColor.value.replace('#', '')}")`,
          )
    findings.push({
      id: `${screenId}-local-color`,
      property: 'Primary color',
      severity: 'error',
      rule: 'Primary actions use the brand indigo token (color.primary).',
      ios: iosColor,
      android: androidColor,
      status: 'open',
      verdict: 'propagate',
      changeKind: 'token',
      confidence: 0.82,
      reason: `iOS uses ${iosColor.value} but Android uses ${androidColor.value} — sync the brand token.`,
      conventionRefs: ['color.primary'],
      originPlatform: 'ios',
      proposedFix: fix.diff ? fix : null,
    })
  }

  const iosPad = extractIosPadding(iosCode)
  const androidPad = extractAndroidPadding(androidCode)
  const rulePad = rulebook['button.padding.vertical']

  if (iosPad && androidPad && (iosPad.value !== androidPad.value || (rulePad && (iosPad.value !== rulePad || androidPad.value !== rulePad)))) {
    const iosFind = `.padding(.vertical, ${iosPad.value})`
    const iosReplace = `.padding(.vertical, ${rulePad ?? androidPad.value})`
    findings.push({
      id: `${screenId}-local-padding`,
      property: 'Button padding',
      severity: 'error',
      rule: 'Primary buttons use 16pt vertical padding (button.padding.vertical).',
      expected: rulePad ?? undefined,
      ios: iosPad,
      android: androidPad,
      status: 'open',
      verdict: 'flag',
      changeKind: 'drift',
      confidence: 0.9,
      reason: `Vertical padding differs — iOS ${iosPad.value}pt, Android ${androidPad.value}pt${rulePad ? ` (rulebook: ${rulePad}pt)` : ''}.`,
      conventionRefs: ['button.padding.vertical'],
      proposedFix: buildLineFix(iosFileName, iosCode, 'ios', iosFind, iosReplace),
    })
  }

  const iosRadius = extractIosCornerRadius(iosCode)
  const androidRadius = extractAndroidCornerRadius(androidCode)
  const ruleRadius = rulebook['button.cornerRadius']

  if (iosRadius && androidRadius && (iosRadius.value !== androidRadius.value || (ruleRadius && (iosRadius.value !== ruleRadius || androidRadius.value !== ruleRadius)))) {
    findings.push({
      id: `${screenId}-local-radius`,
      property: 'Button corner radius',
      severity: 'warning',
      rule: 'Primary buttons use a 12pt corner radius (button.cornerRadius).',
      expected: ruleRadius ?? undefined,
      ios: iosRadius,
      android: androidRadius,
      status: 'open',
      verdict: 'flag',
      changeKind: 'drift',
      confidence: 0.85,
      reason: `Corner radius differs — iOS ${iosRadius.value}pt, Android ${androidRadius.value}pt.`,
      conventionRefs: ['button.cornerRadius'],
      proposedFix: buildLineFix(
        iosFileName,
        iosCode,
        'ios',
        `.cornerRadius(${iosRadius.value})`,
        `.cornerRadius(${ruleRadius ?? androidRadius.value})`,
      ),
    })
  }

  const iosSize = extractIosHeadingSize(iosCode)
  const androidSize = extractAndroidHeadingSize(androidCode)
  const ruleSize = rulebook['typography.heading.size']

  if (iosSize && androidSize && iosSize.value !== androidSize.value) {
    findings.push({
      id: `${screenId}-local-heading`,
      property: 'Heading font size',
      severity: 'warning',
      rule: 'Screen headings use the typography.heading.size token.',
      expected: ruleSize ?? undefined,
      ios: iosSize,
      android: androidSize,
      status: 'open',
      verdict: 'propagate',
      changeKind: 'token',
      confidence: 0.8,
      reason: `Heading size differs — iOS ${iosSize.value}pt, Android ${androidSize.value}pt.`,
      conventionRefs: ['typography.heading.size'],
      originPlatform: 'ios',
      proposedFix: buildLineFix(
        androidFileName,
        androidCode,
        'android',
        `fontSize: ${androidSize.value}`,
        `fontSize: ${iosSize.value}`,
      ),
    })
  }

  // Platform-native controls: stepper vs IconButton pattern
  const hasIosStepper = iosCode.includes('Button("-")') || iosCode.includes('Button("+")')
  const hasAndroidIcons = androidCode.includes('IconButton') && androidCode.includes('Icons.')
  if (hasIosStepper && hasAndroidIcons) {
    findings.push({
      id: `${screenId}-local-hold-stepper`,
      property: 'Stepper control style',
      severity: 'info',
      rule: 'Stepper controls follow platform-native patterns.',
      ios: { value: 'Button("-") / Button("+")', line: findLine(iosLines, 'Button("-")') },
      android: { value: 'IconButton(Icons.remove/add)', line: findLine(androidLines, 'IconButton') },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.91,
      reason:
        'iOS uses labeled stepper buttons; Android uses Material IconButtons — each platform keeps its native control.',
      conventionRefs: ['hold/native-stepper'],
    })
  }

  return findings
}
