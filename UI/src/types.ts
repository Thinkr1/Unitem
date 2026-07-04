// ─────────────────────────────────────────────────────────────────────────────
// Unitem data contract — the integration seam between this UI and the backend.
// The backend produces a ComparisonResult; the UI renders it and reports
// user actions through the stubbed callbacks in App.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info'
export type Status = 'open' | 'resolved' | 'ignored'

export interface CodePanel {
  platform: 'ios' | 'android'
  language: 'swift' | 'dart' | 'kotlin'
  fileName: string
  /** Raw source, shown with line numbers + highlighting. */
  code: string
  /** Single-file version with local imports inlined — what DartPad can compile. */
  previewCode?: string
  /** The platform's theme source (Theme.swift / theme.dart), so previews can
   *  resolve `Theme.*` / `AppTheme.*` constants to real values. */
  themeCode?: string
}

export type Verdict = 'propagate' | 'hold' | 'flag'

export interface Inconsistency {
  id: string
  /** e.g. "Button padding" */
  property: string
  severity: Severity
  /** The rulebook rule being violated. */
  rule: string
  /** Rulebook value, e.g. "16". Absent for propagate/hold findings. */
  expected?: string | null
  ios: { value: string; line: number }
  android: { value: string; line: number }
  status: Status
  // ── engine-provided fields (all optional — see ARCHITECTURE-ALIGNMENT.md) ──
  verdict?: Verdict
  confidence?: number
  reason?: string
  conventionRefs?: string[]
  originPlatform?: 'ios' | 'android'
  proposedFix?: { targetPlatform: string; file: string; diff: string } | null
  prUrl?: string | null
}

/** Outcome of a whole-screen design transfer (engine schema TransferResult). */
export interface TransferSummary {
  ok: boolean
  files_written: string[]
  dependencies_added: string[]
  summary: string
  warnings: string[]
  error?: string | null
  attempts: number
}

export interface ComparisonResult {
  /** Screen id from the engine mapping, e.g. "login". */
  screen?: string
  ios: CodePanel
  android: CodePanel
  inconsistencies: Inconsistency[]
  rulebook: Record<string, string>
  /** Present on POST /transfer responses. */
  transfer?: TransferSummary
}
