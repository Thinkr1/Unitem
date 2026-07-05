import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzePair } from '../lib/api'
import { runLocalAgentPipeline } from '../lib/localAnalyze'
import type { Inconsistency } from '../types'
import type { LocalAnalysisProgress } from '../components/AgentProgressStrip'

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
  const runIdRef = useRef(0)
  const onResultsRef = useRef(onResults)
  onResultsRef.current = onResults

  const runAnalysis = useCallback(
    async (ios: string, android: string, baseline: Inconsistency[]) => {
      const runId = ++runIdRef.current

      const engineResult = await analyzePair(ios, android)
      if (runIdRef.current !== runId) return

      if (engineResult) {
        const items = mergeStatuses(engineResult.inconsistencies, baseline)
        const open = items.filter((i) => i.status === 'open' && i.verdict !== 'hold')
        setLocalProgress({
          stage: 'review',
          detail: `Engine agents: ${open.length} open issue${open.length === 1 ? '' : 's'}`,
          done: 5,
          total: 5,
          events: [
            {
              ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              text: `Engine pipeline complete — ${open.length} open issues`,
            },
          ],
        })
        onResultsRef.current({
          items,
          source: 'engine',
          openCount: open.length,
          propagateCount: open.filter((i) => i.verdict === 'propagate').length,
          newCount: items.length,
        })
      } else {
        const result = await runLocalAgentPipeline(
          ios,
          android,
          rulebook,
          iosFileName,
          androidFileName,
          screenId,
          baseline,
          (stage, detail, done, events) => {
            if (runIdRef.current !== runId) return
            setLocalProgress({ stage, detail, done, total: 5, events })
          },
        )
        if (runIdRef.current !== runId) return

        const items = mergeStatuses(result.items, baseline)
        onResultsRef.current({
          items,
          source: 'local',
          openCount: result.openCount,
          propagateCount: result.propagateCount,
          newCount: result.newCount,
        })
      }

      window.setTimeout(() => {
        if (runIdRef.current === runId) setLocalProgress(null)
      }, 3500)
    },
    [androidFileName, iosFileName, rulebook, screenId],
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
      runIdRef.current += 1
    }
  }, [])

  return { localProgress, scheduleReanalyze }
}
