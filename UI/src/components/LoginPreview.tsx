import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Inconsistency } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// LoginPreview renders a mockup of the login screen inside the IDE canvas the
// platform is actually designed in:
//   iOS      → Xcode SwiftUI preview canvas
//   Android  → Android Studio layout preview
//
// The device inside uses the *actual* design-token values from mockData for
// each platform, so the two look measurably different and inconsistencies can
// be seen spatially.  Hard-coded to the login screen, exactly like mockData.
// ─────────────────────────────────────────────────────────────────────────────

// Daily Goals schematic preview — token values differ per platform so drift
// is visible spatially. iOS schematic buttons are lightly interactive.

const SEVERITY_RING: Record<string, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
}

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

const PLATFORM_VALUES = {
  ios: {
    headingSize: 30,
    progressHeight: 10,
    progress: 0.38,
    buttonColor: '#5A55F2',
    buttonRadius: 14,
    buttonPaddingV: 20,
    buttonLabel: 'Complete workout',
    device: 'iPhone 15 Pro',
  },
  android: {
    headingSize: 26,
    progressHeight: 8,
    progress: 0.38,
    buttonColor: '#4F46E5',
    buttonRadius: 8,
    buttonPaddingV: 12,
    buttonLabel: 'Start workout',
    device: 'Pixel 7',
  },
}

function ringStyle(color: string): CSSProperties {
  return {
    outline: `2px solid ${color}`,
    outlineOffset: '2px',
    borderRadius: 'inherit',
  }
}

interface LoginPreviewProps {
  platform: 'ios' | 'android'
  activeInconsistency: Inconsistency | null
  inconsistencies: Inconsistency[]
}

export default function LoginPreview({
  platform,
  activeInconsistency,
  inconsistencies,
}: LoginPreviewProps) {
  const v = PLATFORM_VALUES[platform]
  const [waterGlasses, setWaterGlasses] = useState(3)
  const [workoutDone, setWorkoutDone] = useState(false)

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

  function highlight(key: ElementKey): CSSProperties {
    if (activeElement === key && activeInconsistency) {
      return ringStyle(SEVERITY_RING[activeInconsistency.severity])
    }
    return {}
  }

  // ── Daily Goals screen (shared between both device frames) ────────────────
  const screen = (
    <div
      className="flex flex-1 flex-col items-stretch justify-center overflow-hidden px-6 pb-6 pt-3"
      style={{ background: '#ffffff' }}
    >
      {/* Heading */}
      <div className="mb-4 text-center" style={highlight('heading')}>
        <p
          style={{
            fontSize: v.headingSize * 0.72,
            fontWeight: 700,
            color: '#1A1B4B',
            fontFamily: 'Space Grotesk, sans-serif',
            lineHeight: 1.2,
            margin: 0,
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
      <div className="mb-5" style={highlight('progressBar')}>
        <div
          style={{
            height: v.progressHeight * 0.85,
            borderRadius: 6,
            background: '#e8e8ef',
            overflow: 'hidden',
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
      <div style={highlight('workoutButton')}>
        <button
          type="button"
          onClick={() => setWorkoutDone((d) => !d)}
          style={{
            width: '100%',
            background: v.buttonColor,
            borderRadius: v.buttonRadius * 0.72,
            paddingTop: v.buttonPaddingV * 0.5,
            paddingBottom: v.buttonPaddingV * 0.5,
            border: 'none',
            cursor: 'pointer',
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
    <XcodeCanvas device={v.device}>
      <IPhoneFrame>{screen}</IPhoneFrame>
    </XcodeCanvas>
  ) : (
    <StudioCanvas device={v.device}>
      <PixelFrame>{screen}</PixelFrame>
    </StudioCanvas>
  )
}

// ── Device frames ────────────────────────────────────────────────────────────

function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
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
      className="relative flex flex-col overflow-hidden"
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

// ── IDE canvas chrome ──────────────────────────────────────────────────────────

function XcodeCanvas({ device, children }: { device: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: '#2b2b2e' }}>
      {/* Canvas toolbar */}
      <div
        className="flex shrink-0 items-center justify-between px-3"
        style={{ height: 30, background: '#323236', borderBottom: '1px solid rgba(0,0,0,0.35)' }}
      >
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#147efb" aria-hidden>
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 6l7 4-7 4V8z" />
          </svg>
          <span style={{ fontSize: 10.5, color: '#c7c7cc', fontFamily: 'ui-sans-serif, system-ui' }}>
            Preview
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#8e8e93', fontFamily: 'ui-monospace, monospace' }}>
          Xcode
        </span>
      </div>

      {/* Canvas surface */}
      <ScaleToFit width={252} height={500}>
        {children}
      </ScaleToFit>

      {/* Bottom preview control bar */}
      <div
        className="flex shrink-0 items-center justify-center gap-2 px-3"
        style={{ height: 34, background: '#323236', borderTop: '1px solid rgba(0,0,0,0.35)' }}
      >
        <div
          className="flex items-center gap-1.5 rounded px-2 py-0.5"
          style={{ background: '#3f3f44' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#147efb" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span style={{ fontSize: 10, color: '#e5e5ea', fontFamily: 'ui-sans-serif, system-ui' }}>
            {device}
          </span>
        </div>
        <span style={{ fontSize: 9.5, color: '#8e8e93' }}>Selectable</span>
      </div>
    </div>
  )
}

export function StudioCanvas({ device, children }: { device: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: '#3c3f41' }}>
      {/* Design surface toolbar */}
      <div
        className="flex shrink-0 items-center justify-between px-3"
        style={{ height: 30, background: '#4b4f52', borderBottom: '1px solid rgba(0,0,0,0.35)' }}
      >
        <div className="flex items-center gap-2">
          {/* Design | Blueprint segmented look */}
          <div className="flex items-center overflow-hidden rounded" style={{ border: '1px solid #5c6063' }}>
            <span style={{ fontSize: 9.5, color: '#e6e6e6', background: '#5c6063', padding: '1px 6px' }}>
              Design
            </span>
            <span style={{ fontSize: 9.5, color: '#a8adb2', padding: '1px 6px' }}>Blueprint</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3ddc84', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#c9ccd0', fontFamily: 'ui-sans-serif, system-ui' }}>
              {device}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 10, color: '#9aa0a6' }}>Android Studio</span>
      </div>

      {/* Design surface */}
      <ScaleToFit width={252} height={500}>
        {children}
      </ScaleToFit>

      {/* Bottom zoom controls */}
      <div
        className="flex shrink-0 items-center justify-end gap-2 px-3"
        style={{ height: 30, background: '#4b4f52', borderTop: '1px solid rgba(0,0,0,0.35)' }}
      >
        <span style={{ fontSize: 12, color: '#9aa0a6', lineHeight: 1 }}>−</span>
        <span style={{ fontSize: 9.5, color: '#c9ccd0' }}>100%</span>
        <span style={{ fontSize: 12, color: '#9aa0a6', lineHeight: 1 }}>+</span>
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
  expected: string
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
      <span style={{ color: '#4ade80' }}>{expected}</span>
    </div>
  )
}
