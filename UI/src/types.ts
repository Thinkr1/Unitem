// ─────────────────────────────────────────────────────────────────────────────
// Unitem data contract — the integration seam between this UI and the backend.
// The backend produces a ComparisonResult; the UI renders it and reports
// user actions through the stubbed callbacks in App.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info'
export type Status = 'open' | 'resolved' | 'ignored'

export interface CodePanel {
  platform: 'ios' | 'android'
  language: 'swift' | 'dart'
  fileName: string
  /** Raw source, shown with line numbers + highlighting. */
  code: string
}

export interface Inconsistency {
  id: string
  /** e.g. "Button padding" */
  property: string
  severity: Severity
  /** The rulebook rule being violated. */
  rule: string
  /** Rulebook value, e.g. "16". */
  expected: string
  ios: { value: string; line: number }
  android: { value: string; line: number }
  status: Status
}

export interface ComparisonResult {
  ios: CodePanel
  android: CodePanel
  inconsistencies: Inconsistency[]
  rulebook: Record<string, string>
}
