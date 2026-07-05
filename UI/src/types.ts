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

export type ChangeKind = 'token' | 'platform-native' | 'drift'

export interface ProposedFix {
  targetPlatform: 'ios' | 'android'
  file: string
  /** Unified diff text (`difflib.unified_diff` on the backend), rendered PR-style. */
  diff: string
}

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
  changeKind?: ChangeKind
  confidence?: number
  reason?: string
  conventionRefs?: string[]
  originPlatform?: 'ios' | 'android'
  proposedFix?: ProposedFix | null
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

// ─────────────────────────────────────────────────────────────────────────────
// Whole-app analysis — a codebase is a collection of screens (one iOS/Android
// file pair each) that share a single rulebook. Selected on the launch screen,
// either from the bundled demo apps (src/demoApps.ts) or scanned from a real
// iOS + Android folder pair the user picks (src/lib/codebaseScan.ts).
// ─────────────────────────────────────────────────────────────────────────────

export interface AppScreen {
  /** Stable id used as the engine `screen` query param and React key. */
  id: string
  /** Display name, e.g. "Daily Goals". */
  name: string
  ios: CodePanel
  android: CodePanel
  inconsistencies: Inconsistency[]
}

export interface CodebaseApp {
  id: string
  name: string
  description: string
  /** Emoji glyph shown on the launch screen's app card. */
  icon: string
  rulebook: Record<string, string>
  screens: AppScreen[]
}
