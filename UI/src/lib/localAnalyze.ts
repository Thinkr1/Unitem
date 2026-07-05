import type { Inconsistency, ProposedFix, Verdict } from '../types'
import {
  extractAndroidFacts,
  extractIosFacts,
  pairFacts,
  type DesignFact,
  type FactCategory,
} from './designFacts'

/** Builds a minimal unified diff that replaces the first occurrence of `find`
 *  with `replace`. */
export function buildLineFix(
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

const CATEGORY_RULES: Record<
  FactCategory,
  { property: string; rule: string; conventionRef: string; verdict: Verdict }
> = {
  color: {
    property: 'Color token',
    rule: 'Matching UI elements use the same color token on both platforms.',
    conventionRef: 'color.primary',
    verdict: 'propagate',
  },
  'padding-vertical': {
    property: 'Vertical padding',
    rule: 'Matching elements use the same vertical padding on both platforms.',
    conventionRef: 'button.padding.vertical',
    verdict: 'propagate',
  },
  'padding-horizontal': {
    property: 'Horizontal padding',
    rule: 'Matching elements use the same horizontal padding on both platforms.',
    conventionRef: 'layout.padding.horizontal',
    verdict: 'propagate',
  },
  spacing: {
    property: 'Layout spacing',
    rule: 'Stack/section spacing should stay consistent across platforms.',
    conventionRef: 'layout.spacing',
    verdict: 'propagate',
  },
  'font-size': {
    property: 'Font size',
    rule: 'Matching text uses the same font size on both platforms.',
    conventionRef: 'typography.heading.size',
    verdict: 'propagate',
  },
  'corner-radius': {
    property: 'Corner radius',
    rule: 'Matching components use the same corner radius on both platforms.',
    conventionRef: 'button.cornerRadius',
    verdict: 'flag',
  },
  text: {
    property: 'Copy / label text',
    rule: 'User-facing strings should match across platforms.',
    conventionRef: 'copy.label',
    verdict: 'propagate',
  },
  'animation-ms': {
    property: 'Animation duration',
    rule: 'Motion timing should stay consistent across platforms.',
    conventionRef: 'motion.duration.press',
    verdict: 'propagate',
  },
}

function androidReplaceFor(ios: DesignFact, android: DesignFact): string {
  switch (ios.category) {
    case 'color': {
      const hex = ios.value.replace('#', '').toUpperCase()
      return android.needle.replace(/0x[0-9A-Fa-f]+/i, `0xFF${hex}`)
    }
    case 'padding-vertical':
      return `vertical: ${ios.value}`
    case 'padding-horizontal':
      return android.needle.includes('horizontal:')
        ? `horizontal: ${ios.value}`
        : `EdgeInsets.symmetric(horizontal: ${ios.value})`
    case 'spacing':
      return `height: ${ios.value}`
    case 'font-size':
      return `fontSize: ${ios.value}`
    case 'corner-radius':
      return `BorderRadius.circular(${ios.value})`
    case 'text':
      return android.needle.replace(/'[^']*'|"[^"]*"/, `'${ios.value}'`)
    case 'animation-ms':
      return `Duration(milliseconds: ${ios.value})`
    default:
      return android.needle
  }
}

function findingFromPair(
  pair: { category: FactCategory; ios: DesignFact; android: DesignFact },
  screenId: string,
  index: number,
  iosCode: string,
  androidCode: string,
  iosFileName: string,
  androidFileName: string,
  rulebook: Record<string, string>,
): Inconsistency | null {
  if (pair.ios.value === pair.android.value) return null

  const meta = CATEGORY_RULES[pair.category]
  const ruleKey = meta.conventionRef
  const expected = rulebook[ruleKey]

  let verdict: Verdict = meta.verdict
  let proposedFix: ProposedFix | null = null
  let reason = `${pair.ios.label}: iOS ${pair.ios.value} ≠ Android ${pair.android.value}`

  if (pair.category === 'color' || pair.category === 'text' || pair.category === 'spacing' ||
      pair.category === 'font-size' || pair.category === 'padding-vertical' ||
      pair.category === 'padding-horizontal' || pair.category === 'animation-ms') {
    verdict = 'propagate'
    const replace = androidReplaceFor(pair.ios, pair.android)
    proposedFix = buildLineFix(androidFileName, androidCode, 'android', pair.android.needle, replace)
    reason = `iOS updated to ${pair.ios.value} — propagate to Android (currently ${pair.android.value}).`
  } else if (pair.category === 'corner-radius') {
    verdict = 'flag'
    if (expected && pair.ios.value !== expected && pair.android.value !== expected) {
      proposedFix = buildLineFix(
        iosFileName,
        iosCode,
        'ios',
        pair.ios.needle,
        `.cornerRadius(${expected})`,
      )
      reason = `Both platforms drifted from rulebook ${expected}pt — iOS ${pair.ios.value}, Android ${pair.android.value}.`
    } else {
      proposedFix = buildLineFix(
        androidFileName,
        androidCode,
        'android',
        pair.android.needle,
        `BorderRadius.circular(${pair.ios.value})`,
      )
      reason = `Corner radius mismatch — iOS ${pair.ios.value}pt, Android ${pair.android.value}pt.`
    }
  }

  if (proposedFix && !proposedFix.diff) proposedFix = null

  return {
    id: `${screenId}-drift-${pair.category}-${index}`,
    property: `${meta.property} (${pair.ios.label})`,
    severity: pair.category === 'corner-radius' ? 'warning' : 'error',
    rule: meta.rule,
    expected: expected ?? undefined,
    ios: { value: pair.ios.value, line: pair.ios.line },
    android: { value: pair.android.value, line: pair.android.line },
    status: 'open',
    verdict,
    changeKind: pair.category === 'corner-radius' ? 'drift' : 'token',
    confidence: 0.84,
    reason,
    conventionRefs: [meta.conventionRef],
    originPlatform: 'ios',
    proposedFix,
  }
}

/** Re-evaluate baseline findings against current source — refresh values/lines
 *  and regenerate proposed fixes instead of discarding them. */
function refreshBaseline(
  baseline: Inconsistency[],
  iosCode: string,
  androidCode: string,
  iosFileName: string,
  androidFileName: string,
): Inconsistency[] {
  const iosFacts = extractIosFacts(iosCode)
  const androidFacts = extractAndroidFacts(androidCode)

  return baseline.map((item) => {
    if (item.status !== 'open') return item
    if (item.verdict === 'hold') {
      // Refresh line numbers for hold findings
      const iosLine = iosFacts.find((f) => item.ios.value && f.needle.includes(item.ios.value.split(' ')[0]))?.line
        ?? item.ios.line
      const androidLine = androidFacts.find((f) => item.android.value && f.needle.includes(item.android.value.split(' ')[0]))?.line
        ?? item.android.line
      return { ...item, ios: { ...item.ios, line: iosLine }, android: { ...item.android, line: androidLine } }
    }

    const ref = item.conventionRefs?.[0]
    let iosFact: DesignFact | undefined
    let androidFact: DesignFact | undefined

    if (ref === 'color.primary' || item.property.toLowerCase().includes('color')) {
      iosFact = iosFacts.find((f) => f.category === 'color' && f.label.includes('background')) ?? iosFacts.find((f) => f.category === 'color')
      androidFact = androidFacts.find((f) => f.category === 'color' && f.label.includes('background')) ?? androidFacts.find((f) => f.category === 'color')
    } else if (ref === 'button.padding.vertical' || item.property.toLowerCase().includes('padding')) {
      iosFact = iosFacts.find((f) => f.category === 'padding-vertical')
      androidFact = androidFacts.find((f) => f.category === 'padding-vertical')
    } else if (ref === 'button.cornerRadius' || item.property.toLowerCase().includes('radius')) {
      iosFact = iosFacts.find((f) => f.category === 'corner-radius')
      androidFact = androidFacts.find((f) => f.category === 'corner-radius')
    } else if (ref === 'typography.heading.size' || item.property.toLowerCase().includes('font')) {
      iosFact = iosFacts.find((f) => f.category === 'font-size')
      androidFact = androidFacts.find((f) => f.category === 'font-size')
    } else if (ref === 'copy.workout.label' || ref === 'copy.label' || item.property.toLowerCase().includes('text') || item.property.toLowerCase().includes('copy')) {
      iosFact = iosFacts.find((f) => f.category === 'text')
      androidFact = androidFacts.find((f) => f.category === 'text')
    }

    if (!iosFact && !androidFact) return item

    const ios = iosFact
      ? { value: iosFact.value, line: iosFact.line }
      : item.ios
    const android = androidFact
      ? { value: androidFact.value, line: androidFact.line }
      : item.android

    let proposedFix = item.proposedFix ?? null
    let verdict = item.verdict
    let reason = item.reason

    if (iosFact && androidFact && ios.value !== android.value) {
      const replace = androidReplaceFor(iosFact, androidFact)
      proposedFix = buildLineFix(androidFileName, androidCode, 'android', androidFact.needle, replace)
      if (!proposedFix.diff) proposedFix = null
      reason = `iOS is ${ios.value} — propagate to Android (currently ${android.value}).`
      if (item.verdict === 'flag' || item.verdict === 'propagate') verdict = 'propagate'
    } else if (item.verdict === 'flag' && iosFact && item.expected) {
      if (ref === 'button.padding.vertical' || iosFact.category === 'padding-vertical') {
        proposedFix = buildLineFix(
          iosFileName,
          iosCode,
          'ios',
          iosFact.needle,
          `.padding(.vertical, ${item.expected})`,
        )
      } else if (ref === 'button.cornerRadius' || iosFact.category === 'corner-radius') {
        proposedFix = buildLineFix(
          iosFileName,
          iosCode,
          'ios',
          iosFact.needle,
          `.cornerRadius(${item.expected})`,
        )
      }
      if (proposedFix && !proposedFix.diff) proposedFix = null
      reason = `Both platforms drifted from ${item.expected} — iOS ${ios.value}, Android ${android.value}.`
    } else if (item.verdict === 'propagate' && ios.value === android.value) {
      return { ...item, ios, android, status: 'resolved' as const }
    }

    return { ...item, ios, android, reason, proposedFix, verdict }
  })
}

function hasBaselineCoverage(baseline: Inconsistency[], category: FactCategory): boolean {
  const ref = CATEGORY_RULES[category].conventionRef
  return baseline.some(
    (i) => i.status === 'open' && i.conventionRefs?.includes(ref),
  )
}

function discoverDrift(
  iosCode: string,
  androidCode: string,
  iosFileName: string,
  androidFileName: string,
  rulebook: Record<string, string>,
  screenId: string,
  baseline: Inconsistency[],
  existingIds: Set<string>,
): Inconsistency[] {
  const iosFacts = extractIosFacts(iosCode)
  const androidFacts = extractAndroidFacts(androidCode)
  const pairs = pairFacts(iosFacts, androidFacts)
  const findings: Inconsistency[] = []

  pairs.forEach((pair, index) => {
    if (hasBaselineCoverage(baseline, pair.category)) return
    const finding = findingFromPair(
      pair,
      screenId,
      index,
      iosCode,
      androidCode,
      iosFileName,
      androidFileName,
      rulebook,
    )
    if (finding && !existingIds.has(finding.id)) findings.push(finding)
  })

  // Platform-native holds
  const hasIosStepper = iosCode.includes('Button("-")') || iosCode.includes('Button("+")')
  const hasAndroidIcons = androidCode.includes('IconButton')
  if (hasIosStepper && hasAndroidIcons && !existingIds.has(`${screenId}-hold-stepper`)) {
    findings.push({
      id: `${screenId}-hold-stepper`,
      property: 'Stepper control style',
      severity: 'info',
      rule: 'Stepper controls follow platform-native patterns.',
      ios: { value: 'Button("-") / Button("+")', line: iosCode.split('\n').findIndex((l) => l.includes('Button("-")')) + 1 || 1 },
      android: { value: 'IconButton', line: androidCode.split('\n').findIndex((l) => l.includes('IconButton')) + 1 || 1 },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.91,
      reason: 'Platform-native controls — leave each side as-is.',
      conventionRefs: ['hold/native-stepper'],
    })
  }

  const hasIosToggle = iosCode.includes('Toggle(')
  const hasAndroidSwitch = androidCode.includes('SwitchListTile')
  if (hasIosToggle && hasAndroidSwitch && !existingIds.has(`${screenId}-hold-toggle`)) {
    findings.push({
      id: `${screenId}-hold-toggle`,
      property: 'Toggle control style',
      severity: 'info',
      rule: 'Toggle controls follow platform-native patterns.',
      ios: { value: 'Toggle', line: iosCode.split('\n').findIndex((l) => l.includes('Toggle(')) + 1 || 1 },
      android: { value: 'SwitchListTile', line: androidCode.split('\n').findIndex((l) => l.includes('SwitchListTile')) + 1 || 1 },
      status: 'open',
      verdict: 'hold',
      changeKind: 'platform-native',
      confidence: 0.9,
      reason: 'Platform-native toggle — correct as-is on each platform.',
      conventionRefs: ['hold/native-toggle'],
    })
  }

  return findings
}

function mergeFindings(refreshed: Inconsistency[], discovered: Inconsistency[]): Inconsistency[] {
  const byId = new Map<string, Inconsistency>()
  for (const item of refreshed) byId.set(item.id, item)
  for (const item of discovered) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  return [...byId.values()]
}

export interface LocalAnalyzeResult {
  items: Inconsistency[]
  openCount: number
  propagateCount: number
  newCount: number
}

/** Offline agent pipeline — refreshes baseline findings, discovers new drift,
 *  and proposes Android sync fixes when iOS is edited. */
export function analyzeLocally(
  iosCode: string,
  androidCode: string,
  rulebook: Record<string, string>,
  iosFileName: string,
  androidFileName: string,
  screenId: string,
  baseline: Inconsistency[] = [],
): LocalAnalyzeResult {
  const refreshed = refreshBaseline(
    baseline.length > 0 ? baseline : [],
    iosCode,
    androidCode,
    iosFileName,
    androidFileName,
  )

  const existingIds = new Set(refreshed.map((i) => i.id))
  const discovered = discoverDrift(
    iosCode,
    androidCode,
    iosFileName,
    androidFileName,
    rulebook,
    screenId,
    refreshed,
    existingIds,
  )

  const items =
    baseline.length > 0
      ? mergeFindings(refreshed, discovered)
      : discovered.length > 0
        ? discovered
        : refreshed

  const open = items.filter((i) => i.status === 'open' && i.verdict !== 'hold')
  return {
    items,
    openCount: open.length,
    propagateCount: open.filter((i) => i.verdict === 'propagate').length,
    newCount: discovered.length,
  }
}
