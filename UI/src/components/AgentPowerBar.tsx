import { useEffect, useRef, useState } from 'react'

export type StepPhase = 'idle' | 'charging' | 'boom' | 'done'

const CELLS = 8

/** One step's own 8-cell battery — fills while that step runs, booms on complete. */
export function StepBattery({
  fill,
  phase,
  compact = false,
}: {
  fill: number
  phase: StepPhase
  compact?: boolean
}) {
  const pct = Math.max(0, Math.min(1, fill))
  const litCells = pct * CELLS

  return (
    <div className={`step-battery${compact ? ' step-battery--compact' : ''}`} aria-hidden>
      <div className={`step-battery__shell step-battery__shell--${phase}`}>
        <div className="step-battery__cells">
          {Array.from({ length: CELLS }, (_, i) => {
            const cellProgress = Math.max(0, Math.min(1, litCells - i))
            const isLit = cellProgress >= 1
            const isPartial = cellProgress > 0 && cellProgress < 1

            return (
              <div
                key={i}
                className={[
                  'step-battery__cell',
                  isLit ? 'step-battery__cell--lit' : '',
                  isPartial ? 'step-battery__cell--partial' : '',
                  phase === 'charging' && isPartial ? 'step-battery__cell--live' : '',
                  phase === 'boom' && isLit ? 'step-battery__cell--flash' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div
                  className="step-battery__cell-fill"
                  style={{ height: `${cellProgress * 100}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="step-battery__nub" />
        {phase === 'boom' && <div className="step-battery__burst" />}
      </div>
      {!compact && phase === 'charging' && (
        <span className="step-battery__hint">
          {pct >= 0.88 ? 'Thinking…' : pct >= 0.4 ? 'Processing…' : 'Warming up…'}
        </span>
      )}
    </div>
  )
}

export function stepPhase(
  index: number,
  activeIndex: number,
  boomIndex: number,
): StepPhase {
  if (index === boomIndex) return 'boom'
  if (index < activeIndex) return 'done'
  if (index === activeIndex) return 'charging'
  return 'idle'
}

/** Boom on finish + cinematic wake on the next step. */
export function useStageTransition(activeIndex: number, stageCount: number) {
  const [boomIndex, setBoomIndex] = useState(-1)
  const [wakeIndex, setWakeIndex] = useState(-1)
  const prevRef = useRef(activeIndex)

  useEffect(() => {
    const prev = prevRef.current
    if (prev !== activeIndex && prev >= 0 && prev < stageCount) {
      setBoomIndex(prev)
      if (activeIndex >= 0 && activeIndex < stageCount) {
        setWakeIndex(activeIndex)
      }
      const t1 = window.setTimeout(() => setBoomIndex(-1), 750)
      const t2 = window.setTimeout(() => setWakeIndex(-1), 900)
      prevRef.current = activeIndex
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }
    prevRef.current = activeIndex
  }, [activeIndex, stageCount])

  return { boomIndex, wakeIndex }
}

/** @deprecated use useStageTransition */
export function useStageBoom(activeIndex: number, _stageIds: string[]) {
  const { boomIndex } = useStageTransition(activeIndex, _stageIds.length)
  return boomIndex
}

/** Overall pipeline fill: completed steps + partial current step. */
export function overallPipelineFill(
  activeIndex: number,
  stepFill: number,
  stageCount: number,
): number {
  if (activeIndex < 0 || stageCount <= 0) return 0
  return Math.min(1, (activeIndex + stepFill) / stageCount)
}

/** Duration-weighted overall fill (demo loops with uneven stage times). */
export function overallPipelineFillWeighted(
  elapsedMs: number,
  totalDurationMs: number,
): number {
  if (totalDurationMs <= 0) return 0
  return Math.min(1, elapsedMs / totalDurationMs)
}

/** Master progress bar — total pipeline progress across all stages. */
export function PipelineProgressBar({
  fill,
  activeIndex,
  stageCount,
  label = 'Pipeline',
  compact = false,
}: {
  fill: number
  activeIndex: number
  stageCount: number
  label?: string
  compact?: boolean
}) {
  const pct = Math.max(0, Math.min(1, fill))
  const pctDisplay = Math.round(pct * 100)
  const stepLabel =
    activeIndex >= 0 ? `Step ${activeIndex + 1} / ${stageCount}` : `— / ${stageCount}`
  const isActive = activeIndex >= 0 && pct < 1

  return (
    <div
      className={`pipeline-progress${compact ? ' pipeline-progress--compact' : ''}`}
      role="progressbar"
      aria-valuenow={pctDisplay}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${pctDisplay}%`}
    >
      <div className="pipeline-progress__header">
        <span className="pipeline-progress__label">{label}</span>
        <span className="pipeline-progress__meta">
          {stepLabel}
          <span className="pipeline-progress__sep">·</span>
          {pctDisplay}%
        </span>
      </div>
      <div className="pipeline-progress__track">
        <div
          className={[
            'pipeline-progress__fill',
            isActive ? 'agent-progress-shimmer' : '',
            pct >= 1 ? 'pipeline-progress__fill--complete' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${pct * 100}%` }}
        />
        {isActive && <div className="pipeline-progress__glow" style={{ left: `${pct * 100}%` }} />}
      </div>
    </div>
  )
}
