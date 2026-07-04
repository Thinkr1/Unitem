import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Shared device / window chrome: the iPhone + Pixel frames, the Simulator.app
// and Android Emulator window surrounds, and the scale-to-fit wrapper. Purely
// presentational — screen *content* is rendered by SwiftPreview (from the
// Swift source) and FlutterPreview (DartPad).
// ─────────────────────────────────────────────────────────────────────────────

export const DEVICE_W = 252
export const DEVICE_H = 500

export function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        width: DEVICE_W,
        height: DEVICE_H,
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
        width: DEVICE_W,
        height: DEVICE_H,
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

// ── Window chrome (ported from the schematic-era LoginPreview) ──────────────

function TrafficLights() {
  return (
    <div className="flex items-center gap-[6px]" aria-hidden>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
    </div>
  )
}

/** macOS Simulator.app-style window. `badge` names the render source. */
export function SimulatorWindow({
  device,
  badge,
  children,
}: {
  device: string
  badge?: string
  children: ReactNode
}) {
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
        {badge && (
          <span
            className="absolute right-3"
            style={{ fontSize: 10, color: '#8e8e93', fontFamily: 'ui-monospace, monospace' }}
          >
            {badge}
          </span>
        )}
      </div>

      <ScaleToFit width={DEVICE_W} height={DEVICE_H}>
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

/** Standalone Android Emulator-style window (titlebar + control rail). */
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
        <ScaleToFit width={DEVICE_W} height={DEVICE_H}>
          {children}
        </ScaleToFit>
        <EmulatorControlRail />
      </div>
    </div>
  )
}
