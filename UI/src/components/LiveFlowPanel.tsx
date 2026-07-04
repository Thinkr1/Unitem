import { useEffect, useMemo, useState } from 'react'

interface FlowStage {
  id: string
  label: string
  agent: string
  detail: string
  durationMs: number
  tone: 'fast' | 'watch' | 'human'
}

const STAGES: FlowStage[] = [
  {
    id: 'discover',
    label: 'Discover',
    agent: 'deterministic parser',
    detail: 'tree-sitter + regex extract Login facts',
    durationMs: 2600,
    tone: 'fast',
  },
  {
    id: 'map',
    label: 'Map',
    agent: 'mapper agent',
    detail: 'pair LoginView.swift with LoginScreen.kt',
    durationMs: 3600,
    tone: 'watch',
  },
  {
    id: 'retrieve',
    label: 'Retrieve',
    agent: 'context tools',
    detail: 'small counterpart slice + matching convention_refs',
    durationMs: 2400,
    tone: 'fast',
  },
  {
    id: 'judge',
    label: 'Judge',
    agent: 'classifier fan-out',
    detail: 'propagate, hold, or flag with confidence',
    durationMs: 6800,
    tone: 'watch',
  },
  {
    id: 'validate',
    label: 'Validate',
    agent: 'schema gate',
    detail: 'retry invalid JSON before tickets.json',
    durationMs: 4200,
    tone: 'watch',
  },
  {
    id: 'review',
    label: 'Review',
    agent: 'human console',
    detail: 'accept, override, or narrow focus',
    durationMs: 5200,
    tone: 'human',
  },
  {
    id: 'fix',
    label: 'Fix',
    agent: 'cloud fixer',
    detail: 'minimal counterpart edit + PR',
    durationMs: 6000,
    tone: 'watch',
  },
  {
    id: 'verify',
    label: 'Verify',
    agent: 'verifier',
    detail: 'build and visual result return to console',
    durationMs: 4600,
    tone: 'watch',
  },
]

const TONE_CLASS: Record<FlowStage['tone'], string> = {
  fast: 'border-match/45 bg-match/10 text-match',
  watch: 'border-accent/50 bg-accent/12 text-accent',
  human: 'border-violet-400/50 bg-violet-400/12 text-violet-200',
}

const DOT_CLASS: Record<FlowStage['tone'], string> = {
  fast: 'bg-match shadow-[0_0_12px_rgba(74,222,128,0.7)]',
  watch: 'bg-accent shadow-[0_0_12px_rgba(245,165,36,0.8)]',
  human: 'bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.75)]',
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

export default function LiveFlowPanel() {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const totalDuration = useMemo(
    () => STAGES.reduce((sum, stage) => sum + stage.durationMs, 0),
    [],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 300)
    return () => window.clearInterval(timer)
  }, [])

  const elapsedInLoop = (now - startedAt) % totalDuration
  let cursor = 0
  const activeIndex = STAGES.findIndex((stage) => {
    const isActive = elapsedInLoop >= cursor && elapsedInLoop < cursor + stage.durationMs
    cursor += stage.durationMs
    return isActive
  })
  const activeStage = STAGES[activeIndex] ?? STAGES[0]
  const stageStart = STAGES.slice(0, activeIndex).reduce(
    (sum, stage) => sum + stage.durationMs,
    0,
  )
  const activeElapsed = elapsedInLoop - stageStart
  const activeProgress = Math.min(100, (activeElapsed / activeStage.durationMs) * 100)
  const trailDots = Math.min(11, Math.max(3, Math.floor(activeElapsed / 650) + 3))
  const nextStage = STAGES[(activeIndex + 1) % STAGES.length]

  return (
    <section className="border-b border-edge bg-surface/85 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              live diff
            </span>
            <h2 className="font-heading text-[13px] font-semibold text-ink">
              Agent flow monitor
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            {activeStage.agent} → {nextStage.agent}: {activeStage.detail}
          </p>
        </div>

        <div className="min-w-56 rounded-xl border border-edge-bright/70 bg-well/80 p-2.5">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-ink-faint">
            <span>{activeStage.label} running</span>
            <span>{formatSeconds(activeElapsed)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-edge">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${activeProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1 overflow-hidden" aria-label="Lag dots">
            {Array.from({ length: trailDots }, (_, index) => (
              <span
                key={`${activeStage.id}-${index}`}
                className={`flow-dot h-1.5 w-1.5 rounded-full ${DOT_CLASS[activeStage.tone]}`}
                style={{ animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {STAGES.map((stage, index) => {
          const complete = index < activeIndex
          const active = index === activeIndex
          return (
            <div key={stage.id} className="min-w-0">
              <div
                className={`relative h-full rounded-xl border p-2.5 transition-all ${
                  active
                    ? `${TONE_CLASS[stage.tone]} shadow-[0_0_26px_rgba(245,165,36,0.18)]`
                    : complete
                      ? 'border-match/25 bg-match/5 text-ink-muted'
                      : 'border-edge bg-well/70 text-ink-faint'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-heading text-[11px] font-semibold">
                    {stage.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      active
                        ? DOT_CLASS[stage.tone]
                        : complete
                          ? 'bg-match'
                          : 'bg-edge-bright'
                    }`}
                  />
                </div>
                <p className="truncate font-mono text-[9.5px]">{stage.agent}</p>
                {active ? (
                  <div className="mt-2 flex gap-0.5">
                    {Array.from({ length: Math.min(6, trailDots) }, (_, dot) => (
                      <span
                        key={dot}
                        className={`flow-dot h-1 w-1 rounded-full ${DOT_CLASS[stage.tone]}`}
                        style={{ animationDelay: `${dot * 80}ms` }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
