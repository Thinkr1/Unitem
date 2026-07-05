import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzePair } from '../lib/api'
import { analyzeLocally } from '../lib/localAnalyze'
import type { Inconsistency } from '../types'
import type { LocalAnalysisProgress } from '../components/AgentProgressStrip'

const STAGE_SEQUENCE = [
  { id: 'discover', detail: 'Extracting design facts from both files…', weight: 0.2 },
  { id: 'map', detail: 'Mapping iOS elements to Android counterparts…', weight: 0.2 },
  { id: 'judge', detail: 'Classifying differences — propagate, hold, or flag…', weight: 0.35 },
  { id: 'fix', detail: 'Generating proposed fixes…', weight: 0.15 },
  { id: 'review', detail: 'Updating review panel…', weight: 0.1 },
] as const

function mergeInconsistencies(
  fresh: Inconsistency[],
  previous: Inconsistency[],
): Inconsistency[] {
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
  onResults: (items: Inconsistency[], source: 'engine' | 'local') => void
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
    stageTimerRef.current = window.setInterval(advance, 280)
  }, [])

  const runAnalysis = useCallback(
    async (ios: string, android: string, prev: Inconsistency[]) => {
      const runId = ++runIdRef.current
      simulateStages(runId)

      const engineResult = await analyzePair(ios, android)
      if (runIdRef.current !== runId) return

      let items: Inconsistency[]
      let source: 'engine' | 'local'

      if (engineResult) {
        items = mergeInconsistencies(engineResult.inconsistencies, prev)
        source = 'engine'
      } else {
        items = mergeInconsistencies(
          analyzeLocally(ios, android, rulebook, iosFileName, androidFileName, screenId),
          prev,
        )
        source = 'local'
      }

      setLocalProgress({
        stage: 'review',
        detail: source === 'engine' ? 'Engine analysis complete' : 'Local analysis complete',
        done: STAGE_SEQUENCE.length,
        total: STAGE_SEQUENCE.length,
      })

      onResultsRef.current(items, source)

      window.setTimeout(() => {
        if (runIdRef.current === runId) setLocalProgress(null)
      }, 1200)
    },
    [androidFileName, iosFileName, rulebook, screenId, simulateStages],
  )

  const scheduleReanalyze = useCallback(
    (ios: string, android: string, prev: Inconsistency[]) => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void runAnalysis(ios, android, prev)
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
