import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Live pipeline stage strip — polls the engine's GET /progress and shows which
// architecture stage is running (discover → map → judge → fix → review).
// Hidden while the engine is idle. This is REAL state, not an animation.
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = [
  { id: 'discover', label: 'Discover', agent: 'deterministic parser' },
  { id: 'map', label: 'Map', agent: 'mapper' },
  { id: 'judge', label: 'Judge', agent: 'classifier agents' },
  { id: 'fix', label: 'Fix', agent: 'fixer agent' },
  { id: 'review', label: 'Review', agent: 'human console' },
] as const

interface EngineProgress {
  state: 'idle' | 'running'
  stage: string
  detail: string
  done: number
  total: number
  events?: { ts: string; text: string }[]
}

export default function PipelineStrip() {
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const lingerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8787/progress')
        if (!res.ok) return
        const next = (await res.json()) as EngineProgress
        if (cancelled) return
        if (next.state === 'running') {
          if (lingerRef.current) window.clearTimeout(lingerRef.current)
          setProgress(next)
        } else {
          // linger on the last stage briefly so fast runs are still visible
          lingerRef.current = window.setTimeout(() => setProgress(null), 2500)
        }
      } catch {
        if (!cancelled) setProgress(null) // engine down — hide
      }
    }
    const timer = window.setInterval(poll, 600)
    poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (lingerRef.current) window.clearTimeout(lingerRef.current)
    }
  }, [])

  if (!progress) return null
  const activeIndex = STAGES.findIndex((s) => s.id === progress.stage)
  const events = progress.events ?? []

  return (
    <div className="mx-1 mb-3 flex flex-col gap-2 rounded-xl border border-accent/30 bg-surface px-4 py-2.5">
      <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 font-heading text-[10.5px] font-bold uppercase tracking-wider text-accent">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Pipeline
      </span>

      <div className="flex items-center gap-1.5">
        {STAGES.map((stage, i) => {
          const isActive = i === activeIndex
          const isDone = activeIndex > -1 && i < activeIndex
          return (
            <div key={stage.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span
                  className={`h-px w-4 ${isDone || isActive ? 'bg-accent/60' : 'bg-edge'}`}
                />
              )}
              <span
                className={[
                  'rounded-full border px-2.5 py-1 font-heading text-[10.5px] font-semibold transition-colors',
                  isActive
                    ? 'border-accent bg-accent/15 text-accent'
                    : isDone
                      ? 'border-accent/40 text-ink-muted'
                      : 'border-edge text-ink-faint',
                ].join(' ')}
              >
                {isDone ? '✓ ' : ''}
                {stage.label}
                {isActive && progress.total > 0 && (
                  <span className="ml-1 font-mono">
                    {progress.done}/{progress.total}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <span className="min-w-0 flex-1 truncate text-right font-mono text-[10.5px] text-ink-muted">
        {progress.detail}
      </span>
      </div>

      {/* Activity feed — the engine's live "thinking": one line per real event */}
      {events.length > 0 && (
        <div className="max-h-24 overflow-y-auto rounded-lg bg-surface-deep px-3 py-2">
          {events
            .slice()
            .reverse()
            .map((event, i) => (
              <div
                key={`${event.ts}-${i}`}
                className={`font-mono text-[10px] leading-relaxed ${
                  i === 0 ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                <span className="text-accent/70">[{event.ts}]</span> {event.text}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
