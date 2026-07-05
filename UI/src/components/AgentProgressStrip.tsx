import {
  overallPipelineFill,
  PipelineProgressBar,
  StepBattery,
  stepPhase,
  useStageTransition,
} from './AgentPowerBar'
import type { EngineProgress } from '../hooks/useEngineProgress'

const STAGES = [
  { id: 'discover', label: 'Discover' },
  { id: 'map', label: 'Map' },
  { id: 'judge', label: 'Judge' },
  { id: 'fix', label: 'Fix' },
  { id: 'review', label: 'Review' },
] as const

export interface LocalAnalysisProgress {
  stage: string
  detail: string
  done: number
  total: number
}

interface AgentProgressStripProps {
  engineProgress: EngineProgress | null
  localProgress?: LocalAnalysisProgress | null
  idleHint?: string
}

export default function AgentProgressStrip({
  engineProgress,
  localProgress = null,
  idleHint,
}: AgentProgressStripProps) {
  const isEngineLive = engineProgress?.state === 'running'
  const isLocalLive = !!localProgress
  const progress = isEngineLive ? engineProgress : isLocalLive ? localProgress : null

  const activeIndex = progress
    ? STAGES.findIndex((s) => s.id === progress.stage)
    : -1
  const { boomIndex, wakeIndex } = useStageTransition(activeIndex, STAGES.length)

  if (!progress) {
    return (
      <div className="pipeline-strip mb-2 flex items-center gap-2 glass-card px-3 py-2">
        <span className="agent-live-tag shrink-0 text-ink-faint">○ agents idle</span>
        <p className="truncate font-mono text-[9px] text-ink-faint">
          {idleHint ?? 'Edit either file to re-analyze · agents will propose consistency fixes'}
        </p>
      </div>
    )
  }

  const events = isEngineLive ? (engineProgress?.events ?? []) : []
  const stepFill =
    progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0.35
  const overallFill = overallPipelineFill(activeIndex, stepFill, STAGES.length)

  return (
    <div className="pipeline-strip mb-2 flex flex-col gap-2 glass-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="agent-live-tag shrink-0">
          {isEngineLive ? '● live' : '● analyzing'}
        </span>
        {progress.detail && (
          <p className="truncate font-mono text-[9px] text-ink-faint">{progress.detail}</p>
        )}
      </div>

      <PipelineProgressBar
        fill={overallFill}
        activeIndex={activeIndex}
        stageCount={STAGES.length}
        label={isEngineLive ? 'Engine pipeline' : 'Re-analyzing pair'}
        compact
      />

      <div className="grid grid-cols-5 gap-1.5">
        {STAGES.map((stage, index) => {
          const phase = stepPhase(index, activeIndex, boomIndex)
          const fill =
            phase === 'done' || phase === 'boom'
              ? 1
              : phase === 'charging'
                ? stepFill
                : 0

          return (
            <div
              key={stage.id}
              className={[
                'agent-stage rounded-lg border border-edge bg-surface-raised px-2 py-1.5',
                index === activeIndex ? 'agent-stage--active' : '',
                phase === 'done' ? 'agent-stage--done' : '',
                phase === 'boom' ? 'agent-stage--boom' : '',
                index === wakeIndex ? 'agent-stage--wake' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <p className="mb-1 truncate text-center font-heading text-[10px] font-semibold text-ink">
                {phase === 'done' ? '✓ ' : ''}
                {stage.label}
              </p>
              <StepBattery fill={fill} phase={phase} compact />
            </div>
          )
        })}
      </div>

      {events.length > 0 && (
        <div className="max-h-24 overflow-y-auto rounded-lg bg-surface-raised px-3 py-2">
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
