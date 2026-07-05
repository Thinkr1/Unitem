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
      className="device-bezel relative flex flex-col overflow-hidden"
      style={{
        width: DEVICE_W,
        height: DEVICE_H,
        borderRadius: 46,
        padding: 5,
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
      className="device-bezel relative flex flex-col overflow-hidden"
      style={{
        width: DEVICE_W,
        height: DEVICE_H,
        borderRadius: 30,
        padding: 4,
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
      className="device-preview-canvas flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1"
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

/** Full-bleed preview area — phone scales to fill the panel (no window chrome). */
export function DeviceCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScaleToFit width={DEVICE_W} height={DEVICE_H}>
        {children}
      </ScaleToFit>
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
    <div className="device-preview-window flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="device-preview-titlebar relative flex shrink-0 items-center justify-center border-b border-edge px-3"
        style={{ height: 32 }}
      >
        <div className="absolute left-3"><TrafficLights /></div>
        <span className="device-preview-title text-[11px] font-medium">
          {device}
        </span>
        {badge && (
          <span className="device-preview-badge absolute right-3 font-mono text-[10px]">
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

/** Standalone Android Emulator-style window (titlebar only). */
export function EmulatorWindow({ device, children }: { device: string; children: ReactNode }) {
  return (
    <div className="device-preview-window relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="device-preview-titlebar relative flex shrink-0 items-center justify-center border-b border-edge px-3"
        style={{ height: 32 }}
      >
        <div className="absolute left-3 flex items-center gap-[5px]" aria-hidden>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#d4d4d4' }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#d4d4d4' }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#a3a3a3' }} />
        </div>
        <span className="device-preview-title text-[11px] font-medium">
          {device}{' '}
          <span className="text-ink-faint">— Android Emulator</span>
        </span>
      </div>

      <ScaleToFit width={DEVICE_W} height={DEVICE_H}>
        {children}
      </ScaleToFit>
    </div>
  )
}
