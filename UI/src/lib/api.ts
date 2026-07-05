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

export interface ScreenInfo {
  feature: string
  hasIos: boolean
  hasAndroid: boolean
  oneSided: boolean
}

/** The screens the mapper found, for the console's screen switcher. */
export function fetchScreens(): Promise<{ screens: ScreenInfo[] } | null> {
  return request<{ screens: ScreenInfo[] }>('/screens')
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
 *  Expect a couple of minutes with the live runner.
 *
 *  When `iosCode` is passed (the console's edited iOS source), it's sent in the
 *  body and used as the source of truth — the iOS file on disk is never read or
 *  written, so edits transfer without persisting. */
export function transferDesign(
  screen = 'login',
  iosCode?: string,
  iosThemeCode?: string,
): Promise<ComparisonResult | null> {
  const init: RequestInit = { method: 'POST' }
  if (iosCode !== undefined || iosThemeCode !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify({ iosCode, iosThemeCode })
  }
  return request<ComparisonResult>(`/transfer?screen=${screen}`, init)
}

/** DEV ONLY: restore the pre-transfer (legacy) Android files and reopen the
 *  tickets so the transfer demo can be exercised again. */
export function resetAndroid(screen = 'login'): Promise<ComparisonResult | null> {
  return request<ComparisonResult>(`/debug/reset-android?screen=${screen}`, {
    method: 'POST',
  })
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
