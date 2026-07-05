import { useEffect, useMemo, useState } from 'react'
import {
  overallPipelineFill,
  overallPipelineFillWeighted,
  PipelineProgressBar,
  StepBattery,
  stepPhase,
  useStageTransition,
} from './AgentPowerBar'

interface FlowStage {
  id: string
  label: string
  agent: string
  detail: string
  durationMs: number
}

interface EngineProgress {
  state: 'idle' | 'running'
  stage: string
  detail: string
  done: number
  total: number
}

const STAGES: FlowStage[] = [
  {
    id: 'discover',
    label: 'Discover',
    agent: 'deterministic parser',
    detail: 'tree-sitter + regex extract Daily Goals facts',
    durationMs: 2600,
  },
  {
    id: 'map',
    label: 'Map',
    agent: 'mapper agent',
    detail: 'pair DailyGoalsView.swift with daily_goals_screen.dart',
    durationMs: 3600,
  },
  {
    id: 'retrieve',
    label: 'Retrieve',
    agent: 'context tools',
    detail: 'small counterpart slice + matching convention_refs',
    durationMs: 2400,
  },
  {
    id: 'judge',
    label: 'Judge',
    agent: 'classifier fan-out',
    detail: 'propagate, hold, or flag with confidence',
    durationMs: 6800,
  },
  {
    id: 'validate',
    label: 'Validate',
    agent: 'schema gate',
    detail: 'retry invalid JSON before tickets.json',
    durationMs: 4200,
  },
  {
    id: 'review',
    label: 'Review',
    agent: 'human console',
    detail: 'accept, override, or narrow focus',
    durationMs: 5200,
  },
  {
    id: 'fix',
    label: 'Fix',
    agent: 'cloud fixer',
    detail: 'minimal counterpart edit + PR',
    durationMs: 6000,
  },
  {
    id: 'verify',
    label: 'Verify',
    agent: 'verifier',
    detail: 'build and visual result return to console',
    durationMs: 4600,
  },
]

export default function LiveFlowPanel() {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [engine, setEngine] = useState<EngineProgress | null>(null)

  const totalDuration = useMemo(
    () => STAGES.reduce((sum, stage) => sum + stage.durationMs, 0),
    [],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 80)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8787/progress')
        if (!res.ok) return
        const next = (await res.json()) as EngineProgress
        if (!cancelled) setEngine(next.state === 'running' ? next : null)
      } catch {
        if (!cancelled) setEngine(null)
      }
    }
    const timer = window.setInterval(poll, 600)
    poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const isLive = engine != null
  const elapsedInLoop = (now - startedAt) % totalDuration
  let cursor = 0
  const demoActiveIndex = STAGES.findIndex((stage) => {
    const isActive = elapsedInLoop >= cursor && elapsedInLoop < cursor + stage.durationMs
    cursor += stage.durationMs
    return isActive
  })

  const engineActiveIndex =
    engine != null ? STAGES.findIndex((s) => s.id === engine.stage) : -1
  const activeIndex = engineActiveIndex >= 0 ? engineActiveIndex : demoActiveIndex
  const activeStage = STAGES[activeIndex] ?? STAGES[0]
  const { boomIndex, wakeIndex } = useStageTransition(activeIndex, STAGES.length)

  const stageStart = STAGES.slice(0, activeIndex).reduce(
    (sum, stage) => sum + stage.durationMs,
    0,
  )
  const activeElapsed = isLive && engine
    ? Math.min(activeStage.durationMs, (now - startedAt) % 4000)
    : elapsedInLoop - stageStart
  const stepFill =
    isLive && engine && engine.total > 0
      ? Math.min(1, engine.done / engine.total)
      : Math.min(1, activeElapsed / activeStage.durationMs)

  const overallFill = isLive
    ? overallPipelineFill(activeIndex, stepFill, STAGES.length)
    : overallPipelineFillWeighted(stageStart + activeElapsed, totalDuration)

  return (
    <section className="agent-flow-panel border-b border-edge px-4 py-3">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="agent-live-tag">{isLive ? '● live' : '◌ simulation'}</span>
          <h2 className="font-heading text-[13px] font-semibold text-ink">
            Agent flow monitor
          </h2>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          {isLive && engine?.detail
            ? engine.detail
            : `${activeStage.label}: ${activeStage.detail}`}
        </p>
      </div>

      <PipelineProgressBar
        fill={overallFill}
        activeIndex={activeIndex}
        stageCount={STAGES.length}
        label="Overall progress"
      />

      <div className="mt-3 grid grid-cols-8 gap-2">
        {STAGES.map((stage, index) => {
          const phase = stepPhase(index, activeIndex, boomIndex)
          const fill =
            phase === 'done' || phase === 'boom'
              ? 1
              : phase === 'charging'
                ? stepFill
                : 0
          const isWake = index === wakeIndex
          const isActive = index === activeIndex

          return (
            <div key={stage.id} className="min-w-0">
              <div
                className={[
                  'agent-stage flex h-full flex-col rounded-xl border border-edge bg-surface-raised p-2.5',
                  isActive ? 'agent-stage--active' : '',
                  phase === 'done' ? 'agent-stage--done' : '',
                  phase === 'boom' ? 'agent-stage--boom' : '',
                  isWake ? 'agent-stage--wake' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <p className="truncate text-center font-heading text-[11px] font-semibold text-ink">
                  {phase === 'done' ? '✓ ' : ''}
                  {stage.label}
                </p>
                <p className="mb-2 mt-0.5 truncate text-center font-mono text-[9px] text-ink-faint">
                  {stage.agent}
                </p>
                <StepBattery fill={fill} phase={phase} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
