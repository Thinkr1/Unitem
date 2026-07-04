// ─────────────────────────────────────────────────────────────────────────────
// Engine client (unitem FastAPI on :8787 — see ../../ARCHITECTURE-ALIGNMENT.md).
// Every call returns null when the engine is unreachable, so the UI falls back
// to its local mock behavior and keeps working offline.
// ─────────────────────────────────────────────────────────────────────────────
import type { ComparisonResult, Inconsistency } from '../types'

const BASE = 'http://127.0.0.1:8787'

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, init)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null // engine not running — caller falls back to local state
  }
}

/** Latest engine state for a screen (tickets from the last `unitem diff` run). */
export function fetchComparison(screen = 'login'): Promise<ComparisonResult | null> {
  return request<ComparisonResult>(`/comparison?screen=${screen}`)
}

/** Re-run the full pipeline (discover -> map -> judge agents -> fix previews).
 *  With the live runner this spawns one agent per change — expect ~a minute. */
export function rescan(screen = 'login'): Promise<ComparisonResult | null> {
  return request<ComparisonResult>(`/rescan?screen=${screen}`, { method: 'POST' })
}

/** Whole-screen design transfer: the engine's writer agent regenerates the
 *  Flutter screen + theme from the iOS design (verified before landing).
 *  Expect a couple of minutes with the live runner. */
export function transferDesign(screen = 'login'): Promise<ComparisonResult | null> {
  return request<ComparisonResult>(`/transfer?screen=${screen}`, { method: 'POST' })
}

/** Judge two pasted code snippets; replaces the engine's current ticket set. */
export function analyzePair(
  iosCode: string,
  androidCode: string,
): Promise<ComparisonResult | null> {
  return request<ComparisonResult>('/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ iosCode, androidCode }),
  })
}

/** Accept a finding: engine applies the fix; propagate opens a PR (prUrl). */
export function acceptFinding(id: string): Promise<Inconsistency | null> {
  return request<Inconsistency>(`/findings/${id}/accept`, { method: 'POST' })
}

/** Override a finding with the human's corrected verdict (feeds the learning loop). */
export function overrideFinding(
  id: string,
  verdict: 'propagate' | 'hold' | 'flag' = 'hold',
  note?: string,
): Promise<Inconsistency | null> {
  return request<Inconsistency>(`/findings/${id}/override`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verdict, note }),
  })
}
