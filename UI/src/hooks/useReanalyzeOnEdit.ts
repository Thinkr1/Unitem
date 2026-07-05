import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzePair } from '../lib/api'
import { analyzeLocally } from '../lib/localAnalyze'
import type { Inconsistency } from '../types'
import type { LocalAnalysisProgress } from '../components/AgentProgressStrip'

const STAGE_SEQUENCE = [
  { id: 'discover', detail: 'Discover agent: extracting colors, spacing, text, padding…', weight: 0.2 },
  { id: 'map', detail: 'Map agent: pairing iOS elements with Android counterparts…', weight: 0.2 },
  { id: 'judge', detail: 'Judge agent: classify drift — propagate, hold, or flag…', weight: 0.35 },
  { id: 'fix', detail: 'Fix agent: generating proposed Android sync diffs…', weight: 0.15 },
  { id: 'review', detail: 'Review: updating findings panel…', weight: 0.1 },
] as const

function mergeStatuses(fresh: Inconsistency[], previous: Inconsistency[]): Inconsistency[] {
  const prevById = new Map(previous.map((i) => [i.id, i]))
  return fresh.map((item) => {
    const prev = prevById.get(item.id)
    if (prev && (prev.status === 'resolved' || prev.status === 'ignored')) {
      return { ...item, status: prev.status }
    }
    return item
  })
}

interface ReanalyzeOptions {
  rulebook: Record<string, string>
  iosFileName: string
  androidFileName: string
  screenId: string
  debounceMs?: number
}

export interface ReanalyzeOutcome {
  items: Inconsistency[]
  source: 'engine' | 'local'
  openCount: number
  propagateCount: number
  newCount: number
}

/** Debounced re-analysis when the user edits either side. Only updates
 *  inconsistencies — never overwrites source code. */
export function useReanalyzeOnEdit({
  rulebook,
  iosFileName,
  androidFileName,
  screenId,
  debounceMs = 900,
  onResults,
}: ReanalyzeOptions & {
  onResults: (outcome: ReanalyzeOutcome) => void
}) {
  const [localProgress, setLocalProgress] = useState<LocalAnalysisProgress | null>(null)
  const timerRef = useRef<number | null>(null)
  const stageTimerRef = useRef<number | null>(null)
  const runIdRef = useRef(0)
  const onResultsRef = useRef(onResults)
  onResultsRef.current = onResults

  const clearStageTimer = () => {
    if (stageTimerRef.current) {
      window.clearInterval(stageTimerRef.current)
      stageTimerRef.current = null
    }
  }

  const simulateStages = useCallback((runId: number) => {
    let stageIndex = 0
    let done = 0
    const total = STAGE_SEQUENCE.length

    const advance = () => {
      if (runIdRef.current !== runId) return
      const stage = STAGE_SEQUENCE[stageIndex]
      if (!stage) {
        clearStageTimer()
        return
      }
      setLocalProgress({
        stage: stage.id,
        detail: stage.detail,
        done,
        total,
      })
      done += 1
      stageIndex += 1
      if (stageIndex >= STAGE_SEQUENCE.length) {
        clearStageTimer()
      }
    }

    advance()
    stageTimerRef.current = window.setInterval(advance, 320)
  }, [])

  const runAnalysis = useCallback(
    async (ios: string, android: string, baseline: Inconsistency[]) => {
      const runId = ++runIdRef.current
      simulateStages(runId)

      const engineResult = await analyzePair(ios, android)
      if (runIdRef.current !== runId) return

      let outcome: ReanalyzeOutcome

      if (engineResult) {
        const items = mergeStatuses(engineResult.inconsistencies, baseline)
        const open = items.filter((i) => i.status === 'open' && i.verdict !== 'hold')
        outcome = {
          items,
          source: 'engine',
          openCount: open.length,
          propagateCount: open.filter((i) => i.verdict === 'propagate').length,
          newCount: items.length,
        }
        setLocalProgress({
          stage: 'review',
          detail: `Engine agents: ${outcome.openCount} open issue${outcome.openCount === 1 ? '' : 's'} (${outcome.propagateCount} to sync)`,
          done: STAGE_SEQUENCE.length,
          total: STAGE_SEQUENCE.length,
        })
      } else {
        const result = analyzeLocally(
          ios,
          android,
          rulebook,
          iosFileName,
          androidFileName,
          screenId,
          baseline,
        )
        const items = mergeStatuses(result.items, baseline)
        outcome = {
          items,
          source: 'local',
          openCount: result.openCount,
          propagateCount: result.propagateCount,
          newCount: result.newCount,
        }
        setLocalProgress({
          stage: 'review',
          detail: `Local agents: ${outcome.openCount} open issue${outcome.openCount === 1 ? '' : 's'} · ${outcome.propagateCount} propose Android sync`,
          done: STAGE_SEQUENCE.length,
          total: STAGE_SEQUENCE.length,
        })
      }

      onResultsRef.current(outcome)

      window.setTimeout(() => {
        if (runIdRef.current === runId) setLocalProgress(null)
      }, 2200)
    },
    [androidFileName, iosFileName, rulebook, screenId, simulateStages],
  )

  const scheduleReanalyze = useCallback(
    (ios: string, android: string, baseline: Inconsistency[]) => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void runAnalysis(ios, android, baseline)
      }, debounceMs)
    },
    [debounceMs, runAnalysis],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      clearStageTimer()
      runIdRef.current += 1
    }
  }, [])

  return { localProgress, scheduleReanalyze }
}
