import { useEffect, useRef, useState } from 'react'

export interface EngineProgress {
  state: 'idle' | 'running'
  stage: string
  detail: string
  done: number
  total: number
  events?: { ts: string; text: string }[]
}

const ENGINE_URL = 'http://127.0.0.1:8787/progress'

/** Polls the unitem engine for live pipeline progress. Returns null when idle/offline. */
export function useEngineProgress(pollMs = 600) {
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const lingerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(ENGINE_URL)
        if (!res.ok) return
        const next = (await res.json()) as EngineProgress
        if (cancelled) return
        if (next.state === 'running') {
          if (lingerRef.current) window.clearTimeout(lingerRef.current)
          setProgress(next)
        } else {
          lingerRef.current = window.setTimeout(() => setProgress(null), 2500)
        }
      } catch {
        if (!cancelled) setProgress(null)
      }
    }
    const timer = window.setInterval(poll, pollMs)
    poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (lingerRef.current) window.clearTimeout(lingerRef.current)
    }
  }, [pollMs])

  return progress
}
