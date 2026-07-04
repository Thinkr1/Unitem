import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Inconsistency } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// LoginPreview renders a device mockup styled after the real runtime, not the
// IDE that authored it:
//   iOS      → Simulator.app window chrome around an iPhone
//   Android  → Android Emulator window chrome (title bar + side control
//              rail) around a Pixel
//
// Crucially, every on-screen value (button color, padding, radius, heading
// size, label, even the press-animation speed) is derived live from the
// `inconsistencies` prop instead of a static per-platform constant. When an
// agent's fix flips a finding's status to "resolved", both device mockups
// re-render using the rulebook's `expected` value on the next render — so
// the two phones visibly converge instead of staying frozen at their
// original drifted state. A small "N fixes applied" badge and a brief green
// flash on the affected element make that convergence obvious.
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RING: Record<string, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
}

const FIXED_COLOR = '#22c55e'

type ElementKey = 'heading' | 'progressBar' | 'counter' | 'workoutButton'

const ELEMENT_MAP: Record<string, ElementKey> = {
  'inc-001': 'workoutButton',
  'inc-002': 'workoutButton',
  'inc-003': 'workoutButton',
  'inc-004': 'heading',
  'inc-005': 'progressBar',
  'inc-006': 'workoutButton',
  'inc-007': 'workoutButton',
}

// The individual design-token findings that drive the Daily Goals schematic,
// keyed by role rather than by UI region (several share one region, e.g.
// `workoutButton` covers padding, color, radius, press duration and label).
const TOKEN_FINDING_IDS = {
  buttonPadding: 'inc-001',
  primaryColor: 'inc-002',
  cornerRadius: 'inc-003',
  headingSize: 'inc-004',
  progressHeight: 'inc-005',
  pressDuration: 'inc-006',
  buttonLabel: 'inc-007',
} as const

function findFinding(inconsistencies: Inconsistency[], id: string): Inconsistency | undefined {
  return inconsistencies.find((i) => i.id === id)
}

/** The value a platform should currently render: the drifted value while a
 *  finding is open, or the rulebook's `expected` value once it's resolved. */
function currentValue(
  finding: Inconsistency | undefined,
  platform: 'ios' | 'android',
  fallback: string,
): string {
  if (!finding) return fallback
  if (finding.status === 'resolved' && finding.expected != null && finding.expected !== '') {
    return finding.expected
  }
  return finding[platform].value
}

function numeric(value: string): number {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

interface DailyGoalsTokens {
  headingSize: number
  progressHeight: number
  progress: number
  buttonColor: string
  buttonRadius: number
  buttonPaddingV: number
  buttonLabel: string
  pressDurationMs: number
  device: string
}

const DAILY_GOALS_FALLBACK: Record<'ios' | 'android', Record<string, string>> = {
  ios: {
    padding: '20',
    color: '#5A55F2',
    radius: '14',
    heading: '30',
    progress: '10',
    press: '300ms',
    label: '"Complete workout"',
  },
  android: {
    padding: '12',
    color: '#4F46E5',
    radius: '8',
    heading: '26',
    progress: '8',
    press: '150ms',
    label: "'Start workout'",
  },
}

function dailyGoalsTokens(
  platform: 'ios' | 'android',
  inconsistencies: Inconsistency[],
): DailyGoalsTokens {
  const fallback = DAILY_GOALS_FALLBACK[platform]
  const padding = findFinding(inconsistencies, TOKEN_FINDING_IDS.buttonPadding)
  const color = findFinding(inconsistencies, TOKEN_FINDING_IDS.primaryColor)
  const radius = findFinding(inconsistencies, TOKEN_FINDING_IDS.cornerRadius)
  const heading = findFinding(inconsistencies, TOKEN_FINDING_IDS.headingSize)
  const progress = findFinding(inconsistencies, TOKEN_FINDING_IDS.progressHeight)
  const press = findFinding(inconsistencies, TOKEN_FINDING_IDS.pressDuration)
  const label = findFinding(inconsistencies, TOKEN_FINDING_IDS.buttonLabel)

  return {
    headingSize: numeric(currentValue(heading, platform, fallback.heading)),
    progressHeight: numeric(currentValue(progress, platform, fallback.progress)),
    progress: 0.38,
    buttonColor: currentValue(color, platform, fallback.color),
    buttonRadius: numeric(currentValue(radius, platform, fallback.radius)),
    buttonPaddingV: numeric(currentValue(padding, platform, fallback.padding)),
    buttonLabel: unquote(currentValue(label, platform, fallback.label)),
    pressDurationMs: numeric(currentValue(press, platform, fallback.press)),
    device: platform === 'ios' ? 'iPhone 15 Pro' : 'Pixel 7',
  }
}

function fixedCount(inconsistencies: Inconsistency[]): number {
  return Object.values(TOKEN_FINDING_IDS).filter(
    (id) => findFinding(inconsistencies, id)?.status === 'resolved',
  ).length
}

/** Tracks findings that flip to "resolved" between renders so the matching
 *  screen element can flash green once, instead of a value silently jumping. */
function useJustFixed(inconsistencies: Inconsistency[]): Set<string> {
  const prevStatus = useRef<Record<string, Inconsistency['status']>>({})
  const [justFixed, setJustFixed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const prev = prevStatus.current
    const newlyFixed: string[] = []
    for (const inc of inconsistencies) {
      if (prev[inc.id] && prev[inc.id] !== 'resolved' && inc.status === 'resolved') {
        newlyFixed.push(inc.id)
      }
      prev[inc.id] = inc.status
    }
    if (newlyFixed.length === 0) return
    setJustFixed((set) => new Set([...set, ...newlyFixed]))
    const timer = window.setTimeout(() => {
      setJustFixed((set) => {
        const next = new Set(set)
        newlyFixed.forEach((id) => next.delete(id))
        return next
      })
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [inconsistencies])

  return justFixed
}

function ringStyle(color: string): CSSProperties {
  return {
    outline: `2px solid ${color}`,
    outlineOffset: '2px',
    borderRadius: 'inherit',
  }
}

function FixedBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <div className="mb-3 flex justify-center">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-heading"
        style={{
          background: 'rgba(34,197,94,0.12)',
          border: `1px solid ${FIXED_COLOR}55`,
          color: FIXED_COLOR,
          fontSize: 9.5,
          fontWeight: 600,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {count} {count === 1 ? 'fix' : 'fixes'} applied
      </span>
    </div>
  )
}

function loginTokens(
  platform: 'ios' | 'android',
  rulebook: Record<string, string>,
  inconsistencies: Inconsistency[],
) {
  const brand = inconsistencies.find((i) =>
    i.property.toLowerCase().includes('brand'),
  )
  const brandFixed = brand?.status === 'resolved' && brand.expected
  return {
    brandPrimary: brandFixed
      ? brand.expected!
      : platform === 'ios'
        ? (brand?.ios.value ?? rulebook['color.brandPrimary'] ?? '#6366F1')
        : (brand?.android.value ?? '#4F46E5'),
    brandInk: rulebook['color.brandInk'] ?? '#1A1B4B',
    textSecondary: rulebook['color.textSecondary'] ?? '#8A8BB3',
    headingSize: Number(rulebook['font.headingSize'] ?? 28),
    forgotColor: platform === 'android' ? '#5A55F2' : (rulebook['color.textSecondary'] ?? '#8A8BB3'),
    device: platform === 'ios' ? 'iPhone 15 Pro' : 'Pixel 7',
  }
}

function LoginSchematicPreview({
  platform,
  rulebook,
  activeInconsistency,
  inconsistencies,
}: {
  platform: 'ios' | 'android'
  rulebook: Record<string, string>
  activeInconsistency: Inconsistency | null
  inconsistencies: Inconsistency[]
}) {
  const t = loginTokens(platform, rulebook, inconsistencies)
  const activeElement =
    activeInconsistency?.status === 'open'
      ? loginElementFor(activeInconsistency)
      : null

  function highlight(key: LoginElementKey): CSSProperties {
    if (activeElement === key && activeInconsistency) {
      return ringStyle(SEVERITY_RING[activeInconsistency.severity])
    }
    return {}
  }

  const screen = (
    <div
      className="flex flex-1 flex-col items-stretch justify-center overflow-hidden px-6 pb-6 pt-4"
      style={{ background: '#ffffff' }}
    >
      <div className="mb-6 text-center" style={highlight('heading')}>
        <p
          style={{
            fontSize: t.headingSize * 0.72,
            fontWeight: 700,
            color: t.brandInk,
            fontFamily: 'Space Grotesk, sans-serif',
            margin: 0,
          }}
        >
          Welcome back
        </p>
      </div>

      <div
        className="mb-3 rounded-lg border border-[#e2e2e8] px-3 py-2.5"
        style={{ height: 36, background: '#fafafa' }}
      >
        <span style={{ fontSize: 12, color: '#a1a1aa' }}>Email</span>
      </div>
      <div
        className="mb-4 rounded-lg border border-[#e2e2e8] px-3 py-2.5"
        style={{ height: 36, background: '#fafafa' }}
      >
        <span style={{ fontSize: 12, color: '#a1a1aa' }}>Password</span>
      </div>

      <div
        className="mb-5 flex items-center gap-2"
        style={highlight('toggle')}
      >
        <div
          style={{
            width: 44,
            height: 26,
            borderRadius: 13,
            background: platform === 'ios' ? '#34C759' : '#6750A4',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 22,
              height: 22,
              borderRadius: 11,
              background: '#fff',
            }}
          />
        </div>
        <span style={{ fontSize: 13, color: t.brandInk }}>Remember me</span>
      </div>

      <div style={highlight('signIn')}>
        <button
          type="button"
          style={{
            width: '100%',
            background: t.brandPrimary,
            borderRadius: 12,
            padding: '14px 0',
            border: 'none',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            Sign In
          </span>
        </button>
      </div>

      <div className="mt-4 text-center" style={highlight('forgot')}>
        <span
          style={{
            fontSize: 12,
            color: platform === 'android' ? t.forgotColor : t.textSecondary,
          }}
        >
          Forgot password?
        </span>
      </div>
    </div>
  )

  const frame = platform === 'ios' ? (
    <SimulatorWindow device={t.device}>
      <IPhoneFrame>{screen}</IPhoneFrame>
    </SimulatorWindow>
  ) : (
    <EmulatorWindow device={t.device}>
      <PixelFrame>{screen}</PixelFrame>
    </EmulatorWindow>
  )

  return frame
}

interface LoginPreviewProps {
  platform: 'ios' | 'android'
  variant?: 'login' | 'daily-goals'
  rulebook?: Record<string, string>
  activeInconsistency: Inconsistency | null
  inconsistencies: Inconsistency[]
}

type LoginElementKey = 'heading' | 'signIn' | 'forgot' | 'toggle'

function loginElementFor(item: Inconsistency): LoginElementKey | null {
  const p = item.property.toLowerCase()
  if (p.includes('brand') || p.includes('primary')) return 'signIn'
  if (p.includes('hardcoded') || p.includes('forgot')) return 'forgot'
  if (p.includes('toggle')) return 'toggle'
  return null
}

export default function LoginPreview({
  platform,
  variant = 'daily-goals',
  rulebook = {},
  activeInconsistency,
  inconsistencies,
}: LoginPreviewProps) {
  const v = dailyGoalsTokens(platform, inconsistencies)
  const [waterGlasses, setWaterGlasses] = useState(3)
  const [workoutDone, setWorkoutDone] = useState(false)
  const [pressed, setPressed] = useState(false)
  const justFixed = useJustFixed(inconsistencies)

  if (variant === 'login') {
    return (
      <LoginSchematicPreview
        platform={platform}
        rulebook={rulebook}
        activeInconsistency={activeInconsistency}
        inconsistencies={inconsistencies}
      />
    )
  }

  const activeElement =
    activeInconsistency?.status === 'open'
      ? (ELEMENT_MAP[activeInconsistency.id] ?? null)
      : null

  const openById = inconsistencies.filter((i) => i.status === 'open')
  const ambientElements = new Map<ElementKey, string>()
  for (const inc of openById) {
    const el = ELEMENT_MAP[inc.id]
    if (el && inc.id !== activeInconsistency?.id) {
      if (!ambientElements.has(el) || inc.severity === 'error') {
        ambientElements.set(el, SEVERITY_RING[inc.severity])
      }
    }
  }

  const flashingElements = new Set<ElementKey>()
  for (const id of justFixed) {
    const el = ELEMENT_MAP[id]
    if (el) flashingElements.add(el)
  }

  function highlight(key: ElementKey): CSSProperties {
    if (activeElement === key && activeInconsistency) {
      return ringStyle(SEVERITY_RING[activeInconsistency.severity])
    }
    return {}
  }

  function flashClass(key: ElementKey): string {
    return flashingElements.has(key) ? 'fixed-flash' : ''
  }

  // ── Daily Goals screen (shared between both device frames) ────────────────
  const screen = (
    <div
      className="flex flex-1 flex-col items-stretch justify-center overflow-hidden px-6 pb-6 pt-3"
      style={{ background: '#ffffff' }}
    >
      <FixedBadge count={fixedCount(inconsistencies)} />

      {/* Heading */}
      <div className={`mb-4 text-center ${flashClass('heading')}`} style={highlight('heading')}>
        <p
          style={{
            fontSize: v.headingSize * 0.72,
            fontWeight: 700,
            color: '#1A1B4B',
            fontFamily: 'Space Grotesk, sans-serif',
            lineHeight: 1.2,
            margin: 0,
            transition: 'font-size 220ms ease',
          }}
        >
          Daily Goals
        </p>
        {activeElement === 'heading' && activeInconsistency && (
          <InconsistencyPill
            expected={activeInconsistency.expected}
            actual={activeInconsistency[platform].value}
            label="font size"
            color={SEVERITY_RING[activeInconsistency.severity]}
          />
        )}
      </div>

      {/* Progress bar */}
      <div className={`mb-5 ${flashClass('progressBar')}`} style={highlight('progressBar')}>
        <div
          style={{
            height: v.progressHeight * 0.85,
            borderRadius: 6,
            background: '#e8e8ef',
            overflow: 'hidden',
            transition: 'height 220ms ease',
          }}
        >
          <div
            style={{
              width: `${v.progress * 100}%`,
              height: '100%',
              background: '#4F46E5',
              borderRadius: 6,
            }}
          />
        </div>
        {activeElement === 'progressBar' && activeInconsistency && (
          <InconsistencyPill
            expected={activeInconsistency.expected}
            actual={activeInconsistency[platform].value}
            label="height"
            color={SEVERITY_RING[activeInconsistency.severity]}
          />
        )}
      </div>

      {/* Water counter */}
      <div
        className="mb-5 flex items-center justify-center gap-3"
        style={highlight('counter')}
      >
        <span style={{ fontSize: 13, color: '#1A1B4B', fontWeight: 500 }}>
          Water: {waterGlasses}/8
        </span>
        <button
          type="button"
          onClick={() => setWaterGlasses((n) => Math.max(0, n - 1))}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1.5px solid #e2e2e8',
            background: '#fafafa',
            fontSize: 16,
            fontWeight: 600,
            color: '#1A1B4B',
            cursor: 'pointer',
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setWaterGlasses((n) => Math.min(8, n + 1))}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1.5px solid #e2e2e8',
            background: '#fafafa',
            fontSize: 16,
            fontWeight: 600,
            color: '#1A1B4B',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* Workout button */}
      <div className={flashClass('workoutButton')} style={highlight('workoutButton')}>
        <button
          type="button"
          onClick={() => setWorkoutDone((d) => !d)}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          style={{
            width: '100%',
            background: v.buttonColor,
            borderRadius: v.buttonRadius * 0.72,
            paddingTop: v.buttonPaddingV * 0.5,
            paddingBottom: v.buttonPaddingV * 0.5,
            border: 'none',
            cursor: 'pointer',
            transform: pressed ? 'scale(0.97)' : 'scale(1)',
            transition: `transform ${v.pressDurationMs}ms ease, background-color ${v.pressDurationMs}ms ease, border-radius 220ms ease, padding 220ms ease`,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#ffffff',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {workoutDone ? 'Workout complete' : v.buttonLabel}
          </span>
        </button>
        {activeElement === 'workoutButton' && activeInconsistency && (
          <InconsistencyPill
            expected={activeInconsistency.expected}
            actual={activeInconsistency[platform].value}
            label={activeInconsistency.property.toLowerCase()}
            color={SEVERITY_RING[activeInconsistency.severity]}
          />
        )}
      </div>

      {/* Ambient markers */}
      {activeElement === null && ambientElements.size > 0 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from(ambientElements.entries()).map(([el, color]) => (
            <span
              key={el}
              title={el}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 0 3px ${color}22`,
                display: 'inline-block',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )

  return platform === 'ios' ? (
    <SimulatorWindow device={v.device}>
      <IPhoneFrame>{screen}</IPhoneFrame>
    </SimulatorWindow>
  ) : (
    <EmulatorWindow device={v.device}>
      <PixelFrame>{screen}</PixelFrame>
    </EmulatorWindow>
  )
}

// ── Device frames ────────────────────────────────────────────────────────────
// Hardware buttons sit outside the clipped screen area so they read as small
// protrusions on the bezel, the way both real hardware and each platform's
// simulator skin render them.

function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        width: 252,
        height: 500,
        borderRadius: 46,
        padding: 5,
        background: '#0f0f11',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.55)',
        flexShrink: 0,
      }}
    >
      {/* Silent switch + volume rocker (left edge) */}
      <span className="absolute" style={{ left: -2, top: 88, width: 3, height: 22, borderRadius: '2px 0 0 2px', background: '#000' }} />
      <span className="absolute" style={{ left: -2, top: 128, width: 3, height: 42, borderRadius: '2px 0 0 2px', background: '#000' }} />
      <span className="absolute" style={{ left: -2, top: 178, width: 3, height: 42, borderRadius: '2px 0 0 2px', background: '#000' }} />
      {/* Power button (right edge) */}
      <span className="absolute" style={{ right: -2, top: 140, width: 3, height: 70, borderRadius: '0 2px 2px 0', background: '#000' }} />

      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ borderRadius: 42, background: '#fff' }}>
        {/* Dynamic Island */}
        <div
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2"
          style={{ width: 82, height: 24, borderRadius: 12, background: '#000' }}
        />
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-2" style={{ height: 38, background: '#fff' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>9:41</span>
          <div className="flex items-center gap-1">
            <svg width="15" height="9" viewBox="0 0 16 10" fill="none">
              <rect x="0.5" y="0.5" width="13" height="9" rx="2.5" stroke="rgba(26,26,26,0.35)" />
              <rect x="1.5" y="1.5" width={9} height={7} rx={1.5} fill="rgba(26,26,26,0.75)" />
            </svg>
          </div>
        </div>
        {children}
        {/* Home indicator */}
        <div style={{ height: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 100, height: 4, borderRadius: 2, background: '#1a1a1a', opacity: 0.25 }} />
        </div>
      </div>
    </div>
  )
}

export function PixelFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        width: 252,
        height: 500,
        borderRadius: 30,
        padding: 4,
        background: '#101112',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.55)',
        flexShrink: 0,
      }}
    >
      {/* Volume rocker + power button (right edge, Pixel-style) */}
      <span className="absolute" style={{ right: -2, top: 116, width: 3, height: 52, borderRadius: '0 2px 2px 0', background: '#000' }} />
      <span className="absolute" style={{ right: -2, top: 176, width: 3, height: 34, borderRadius: '0 2px 2px 0', background: '#4a7cf6' }} />

      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ borderRadius: 26, background: '#fff' }}>
        {/* Punch-hole camera */}
        <div
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2"
          style={{ width: 9, height: 9, borderRadius: '50%', background: '#000' }}
        />
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-2" style={{ height: 34, background: '#fff' }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a', fontFamily: 'Roboto, sans-serif' }}>9:41</span>
          <div className="flex items-center gap-1">
            <svg width="15" height="9" viewBox="0 0 16 10" fill="none">
              <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="rgba(26,26,26,0.35)" />
              <rect x="1.5" y="1.5" width={10} height={7} rx={0.5} fill="rgba(26,26,26,0.75)" />
            </svg>
          </div>
        </div>
        {children}
        {/* Android gesture nav pill */}
        <div style={{ height: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 90, height: 3, borderRadius: 2, background: '#1a1a1a', opacity: 0.3 }} />
        </div>
      </div>
    </div>
  )
}

// ── Scale-to-fit ────────────────────────────────────────────────────────────
// Scales a fixed-size child up/down to fill its container while preserving
// aspect ratio, so the phone occupies the whole canvas instead of floating in
// dead space. Keeps all internal proportions crisp via a single transform.
export function ScaleToFit({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width: cw, height: ch } = el.getBoundingClientRect()
      if (cw > 0 && ch > 0) {
        setScale(Math.min(cw / width, ch / height))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2"
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Simulator / emulator window chrome ──────────────────────────────────────
// These wrap the device frames to look like the actual runtime window each
// platform's tooling opens — Simulator.app on macOS, the Android Emulator
// window elsewhere — rather than an IDE's design-canvas panel.

function TrafficLights() {
  return (
    <div className="flex items-center gap-[6px]" aria-hidden>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
    </div>
  )
}

export function SimulatorWindow({ device, children }: { device: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: '#1e1e1e' }}>
      {/* macOS-style window titlebar, matching Simulator.app */}
      <div
        className="relative flex shrink-0 items-center justify-center px-3"
        style={{ height: 30, background: 'linear-gradient(180deg,#3d3d3f,#323234)', borderBottom: '1px solid rgba(0,0,0,0.5)' }}
      >
        <div className="absolute left-3"><TrafficLights /></div>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#d8d8dc', fontFamily: 'ui-sans-serif, system-ui' }}>
          {device}
        </span>
      </div>

      <ScaleToFit width={252} height={500}>
        {children}
      </ScaleToFit>
    </div>
  )
}

function EmulatorControlRail() {
  const controls: { title: string; icon: ReactNode }[] = [
    {
      title: 'Power',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      title: 'Volume up',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a10 10 0 0 1 0 14" />
        </svg>
      ),
    },
    {
      title: 'Volume down',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
      ),
    },
    {
      title: 'Rotate',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      ),
    },
    {
      title: 'Screenshot',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
    {
      title: 'More',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="flex w-9 shrink-0 flex-col items-center gap-3 border-l py-3"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#26272a' }}
    >
      {controls.map((c) => (
        <span
          key={c.title}
          title={c.title}
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ color: '#9aa0a6' }}
        >
          {c.icon}
        </span>
      ))}
    </div>
  )
}

export function EmulatorWindow({ device, children }: { device: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: '#202124' }}>
      {/* Generic (cross-platform) window titlebar, matching the standalone
          Android Emulator window — not the Android Studio layout editor. */}
      <div
        className="relative flex shrink-0 items-center justify-center px-3"
        style={{ height: 30, background: '#292a2d', borderBottom: '1px solid rgba(0,0,0,0.5)' }}
      >
        <div className="absolute left-3 flex items-center gap-[5px]" aria-hidden>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'rgba(255,255,255,0.16)' }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'rgba(255,255,255,0.16)' }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'rgba(255,255,255,0.28)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#d8d8dc', fontFamily: 'ui-sans-serif, system-ui' }}>
          {device} <span style={{ color: '#7a7c80' }}>— Android Emulator</span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScaleToFit width={252} height={500}>
          {children}
        </ScaleToFit>
        <EmulatorControlRail />
      </div>
    </div>
  )
}

function InconsistencyPill({
  expected,
  actual,
  label,
  color,
}: {
  expected?: string | null
  actual: string
  label: string
  color: string
}) {
  return (
    <div
      style={{
        marginTop: 4,
        padding: '3px 7px',
        borderRadius: 4,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9.5,
      }}
    >
      <span style={{ color: '#9899b8' }}>{label}</span>
      <span style={{ color: '#fb7185' }}>{actual}</span>
      <span style={{ color: '#6b7280' }}>→</span>
      <span style={{ color: '#4ade80' }}>{expected ?? '—'}</span>
    </div>
  )
}
