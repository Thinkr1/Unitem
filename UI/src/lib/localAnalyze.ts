import type { Inconsistency, ProposedFix, Verdict } from '../types'
import {
  countByCategory,
  extractAndroidFacts,
  extractIosFacts,
  extractScreenEdgePaddingAndroid,
  extractScreenEdgePaddingIos,
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
      return android.needle.includes('vertical:')
        ? android.needle.replace(/vertical:\s*\d+/, `vertical: ${ios.value}`)
        : `EdgeInsets.symmetric(vertical: ${ios.value})`
    case 'padding-horizontal':
      return android.needle.includes('horizontal:')
        ? android.needle.replace(/horizontal:\s*\d+/, `horizontal: ${ios.value}`)
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
    } else if (ref === 'layout.padding.horizontal') {
      iosFact = extractScreenEdgePaddingIos(iosCode) ?? iosFacts.find((f) => f.category === 'padding-horizontal')
      androidFact = extractScreenEdgePaddingAndroid(androidCode) ?? androidFacts.find((f) => f.category === 'padding-horizontal')
    } else if (ref === 'button.padding.vertical') {
      iosFact = iosFacts.find((f) => f.category === 'padding-vertical')
      androidFact = androidFacts.find((f) => f.category === 'padding-vertical')
    } else if (item.property.toLowerCase().includes('padding')) {
      iosFact = iosFacts.find((f) => f.category === 'padding-vertical') ?? extractScreenEdgePaddingIos(iosCode) ?? undefined
      androidFact = androidFacts.find((f) => f.category === 'padding-vertical') ?? extractScreenEdgePaddingAndroid(androidCode) ?? undefined
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

function screenEdgePaddingFinding(
  iosCode: string,
  androidCode: string,
  androidFileName: string,
  screenId: string,
  rulebook: Record<string, string>,
): Inconsistency | null {
  const ios = extractScreenEdgePaddingIos(iosCode)
  const android = extractScreenEdgePaddingAndroid(androidCode)
  if (!ios || !android || ios.value === android.value) return null

  const replace = androidReplaceFor(ios, android)
  const proposedFix = buildLineFix(androidFileName, androidCode, 'android', android.needle, replace)
  const expected = rulebook['layout.padding.horizontal']

  return {
    id: `${screenId}-screen-padding-h`,
    property: 'Screen edge horizontal padding',
    severity: 'error',
    rule: 'Screen content uses the same horizontal inset on both platforms (layout.padding.horizontal).',
    expected: expected ?? undefined,
    ios: { value: `${ios.value}pt`, line: ios.line },
    android: { value: `${android.value}pt`, line: android.line },
    status: 'open',
    verdict: 'propagate',
    changeKind: 'token',
    confidence: 0.92,
    reason: `iOS screen padding is ${ios.value}pt — propagate to Android (currently ${android.value}pt).`,
    conventionRefs: ['layout.padding.horizontal'],
    originPlatform: 'ios',
    proposedFix: proposedFix.diff ? proposedFix : null,
  }
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
  const findings: Inconsistency[] = []

  const screenPad = screenEdgePaddingFinding(
    iosCode,
    androidCode,
    androidFileName,
    screenId,
    rulebook,
  )
  if (screenPad && !existingIds.has(screenPad.id)) findings.push(screenPad)

  const iosFacts = extractIosFacts(iosCode)
  const androidFacts = extractAndroidFacts(androidCode)
  const pairs = pairFacts(iosFacts, androidFacts)

  pairs.forEach((pair, index) => {
    if (pair.category === 'padding-horizontal' && pair.ios.scope === 'screen') return
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

export interface AgentEvent {
  ts: string
  text: string
}

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const STAGE_MS = 750

/** Runs the offline agent pipeline stage-by-stage with real extracted details. */
export async function runLocalAgentPipeline(
  iosCode: string,
  androidCode: string,
  rulebook: Record<string, string>,
  iosFileName: string,
  androidFileName: string,
  screenId: string,
  baseline: Inconsistency[],
  onProgress: (stage: string, detail: string, done: number, events: AgentEvent[]) => void,
): Promise<LocalAnalyzeResult> {
  const events: AgentEvent[] = []
  const pause = () => new Promise((r) => window.setTimeout(r, STAGE_MS))

  // ── 1. Discover ──
  const iosFacts = extractIosFacts(iosCode)
  const androidFacts = extractAndroidFacts(androidCode)
  const iosCounts = countByCategory(iosFacts)
  const androidCounts = countByCategory(androidFacts)
  events.push({
    ts: timestamp(),
    text: `Discover: ${iosFacts.length} iOS facts · ${androidFacts.length} Android facts`,
  })
  for (const [cat, n] of Object.entries(iosCounts)) {
    const a = androidCounts[cat] ?? 0
    if (n > 0 || a > 0) {
      events.push({ ts: timestamp(), text: `  · ${cat}: iOS=${n} Android=${a}` })
    }
  }
  const iosScreenPad = extractScreenEdgePaddingIos(iosCode)
  const androidScreenPad = extractScreenEdgePaddingAndroid(androidCode)
  if (iosScreenPad) {
    events.push({
      ts: timestamp(),
      text: `  · screen edge padding iOS: ${iosScreenPad.value}pt (line ${iosScreenPad.line})`,
    })
  }
  if (androidScreenPad) {
    events.push({
      ts: timestamp(),
      text: `  · screen edge padding Android: ${androidScreenPad.value}pt (line ${androidScreenPad.line})`,
    })
  }
  onProgress('discover', 'Discover agent: extracting design facts from both files…', 0, [...events])
  await pause()

  // ── 2. Map ──
  const pairs = pairFacts(iosFacts, androidFacts)
  const mismatches = pairs.filter((p) => p.ios.value !== p.android.value)
  events.push({ ts: timestamp(), text: `Map: ${pairs.length} cross-platform pairs (${mismatches.length} mismatched)` })
  for (const p of mismatches.slice(0, 8)) {
    events.push({
      ts: timestamp(),
      text: `  · ${p.ios.label}: iOS ${p.ios.value} ↔ Android ${p.android.value}`,
    })
  }
  onProgress('map', `Map agent: paired ${pairs.length} elements · ${mismatches.length} need review`, 1, [...events])
  await pause()

  // ── 3. Judge ──
  const refreshed = refreshBaseline(baseline, iosCode, androidCode, iosFileName, androidFileName)
  const openBaseline = refreshed.filter((i) => i.status === 'open')
  events.push({
    ts: timestamp(),
    text: `Judge: ${openBaseline.length} open baseline findings refreshed`,
  })
  for (const item of openBaseline.filter((i) => i.verdict !== 'hold').slice(0, 6)) {
    events.push({
      ts: timestamp(),
      text: `  · ${item.verdict ?? 'flag'}: ${item.property} (iOS ${item.ios.value} / Android ${item.android.value})`,
    })
  }
  onProgress('judge', `Judge agent: classified ${mismatches.length + openBaseline.length} differences`, 2, [...events])
  await pause()

  // ── 4. Fix ──
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
  const withFix = discovered.filter((i) => i.proposedFix?.diff)
  events.push({
    ts: timestamp(),
    text: `Fix: ${discovered.length} new findings · ${withFix.length} proposed Android patches`,
  })
  for (const item of withFix.slice(0, 6)) {
    events.push({ ts: timestamp(), text: `  · patch ${item.proposedFix?.file}: ${item.property}` })
  }
  onProgress('fix', `Fix agent: generated ${withFix.length} proposed sync diffs`, 3, [...events])
  await pause()

  // ── 5. Review ──
  const items =
    baseline.length > 0
      ? mergeFindings(refreshed, discovered)
      : discovered.length > 0
        ? discovered
        : refreshed
  const open = items.filter((i) => i.status === 'open' && i.verdict !== 'hold')
  events.push({
    ts: timestamp(),
    text: `Review: ${open.length} open issues · ${open.filter((i) => i.verdict === 'propagate').length} propose Android sync`,
  })
  onProgress(
    'review',
    `Review: ${open.length} open issue${open.length === 1 ? '' : 's'} ready`,
    4,
    [...events],
  )
  await pause()

  return {
    items,
    openCount: open.length,
    propagateCount: open.filter((i) => i.verdict === 'propagate').length,
    newCount: discovered.length,
  }
}
