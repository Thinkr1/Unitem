import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodePanel as CodePanelData, Inconsistency, Severity } from '../types'
import { highlightLine } from '../lib/highlight'
import SwiftPreview from './SwiftPreview'
import FlutterPreview from './FlutterPreview'
import SimulatorPreview from './SimulatorPreview'

export interface LinePulse {
  line: number
  nonce: number
}

interface ScreenPanelProps {
  panel: CodePanelData
  title: string
  rulebook?: Record<string, string>
  flaggedLines: Map<number, Severity>
  activeLine: number | null
  pulse: LinePulse | null
  activeInconsistency: Inconsistency | null
  inconsistencies: Inconsistency[]
  /** When true, the Code tab becomes an editable textarea. Edits flow up via
   *  onCodeChange; when `panel.absolutePath` is set (a codebase scanned via
   *  the Electron native folder picker) they're also debounced-saved to disk. */
  editable?: boolean
  onCodeChange?: (code: string) => void
  /** IDE workspace: default to code view, show filename, collapse preview tabs. */
  ideMode?: boolean
  defaultView?: 'visual' | 'simulator' | 'code'
}

const FLAG_CLASS: Record<Severity, string> = {
  error: 'line-flag-error',
  warning: 'line-flag-warning',
  info: 'line-flag-info',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Debounced save-to-disk + a live subscription for external edits (e.g. a
 *  save from VS Code) on `panel.absolutePath`. No-ops entirely outside the
 *  Electron shell, or for files that don't exist on disk (demo apps). */
function useFileEditorSync(absolutePath: string | undefined, onExternalChange?: (code: string) => void) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<number | null>(null)
  const savedIdleTimer = useRef<number | null>(null)

  useEffect(() => {
    setSaveState('idle')
    const bridge = window.fileEditor
    if (!absolutePath || !bridge) return
    bridge.watchFile(absolutePath).catch(() => {})
    const unsubscribe = bridge.onFileChanged(({ path, content }) => {
      if (path !== absolutePath) return
      onExternalChange?.(content)
    })
    return () => {
      unsubscribe()
      bridge.unwatchFile(absolutePath).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absolutePath])

  const scheduleSave = (code: string) => {
    const bridge = window.fileEditor
    if (!absolutePath || !bridge) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    if (savedIdleTimer.current) window.clearTimeout(savedIdleTimer.current)
    setSaveState('saving')
    saveTimer.current = window.setTimeout(async () => {
      try {
        await bridge.writeFile(absolutePath, code)
        setSaveState('saved')
        savedIdleTimer.current = window.setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('error')
      }
    }, 700)
  }

  return { saveState, scheduleSave }
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save failed'
  const cls =
    state === 'error'
      ? 'text-severity-error'
      : state === 'saved'
        ? 'text-accent'
        : 'text-ink-faint'
  return <span className={`font-heading text-[10px] font-semibold ${cls}`}>{label}</span>
}

export default function ScreenPanel({
  panel,
  title,
  rulebook = {},
  flaggedLines,
  activeLine,
  pulse,
  activeInconsistency,
  inconsistencies: _inconsistencies,
  editable = false,
  onCodeChange,
  ideMode = false,
  defaultView,
}: ScreenPanelProps) {
  const [view, setView] = useState<'visual' | 'simulator' | 'code'>(
    defaultView ?? (ideMode ? 'code' : 'visual'),
  )
  const lines = useMemo(() => panel.code.split('\n'), [panel.code])
  const lineRefs = useRef(new Map<number, HTMLDivElement>())
  const canEditOnDisk = !!panel.absolutePath && typeof window !== 'undefined' && !!window.fileEditor
  const { saveState, scheduleSave } = useFileEditorSync(panel.absolutePath, onCodeChange)

  const handleCodeChange = (value: string) => {
    onCodeChange?.(value)
    scheduleSave(value)
  }

  const handleOpenInEditor = () => {
    if (panel.absolutePath) window.fileEditor?.openInEditor(panel.absolutePath).catch(() => {})
  }

  useEffect(() => {
    if (!pulse || view !== 'code') return
    lineRefs.current
      .get(pulse.line)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pulse, view])

  // When an inconsistency is selected, switch to code view is opt-in —
  // visual view handles its own highlight so we don't force a tab switch.

  return (
    <section className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
      <header className="flex h-[3rem] shrink-0 items-center justify-between border-b border-edge px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-6 shrink-0 items-center justify-center rounded-md px-1.5 font-heading text-[9px] font-bold ${
              panel.platform === 'ios'
                ? 'bg-severity-warning/15 text-severity-warning'
                : 'bg-info-blue/15 text-info-blue'
            }`}
          >
            {title}
          </span>
          <h2 className="truncate font-mono text-[12px] font-semibold text-ink">{panel.fileName}</h2>
          <SaveIndicator state={saveState} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleOpenInEditor}
            disabled={!canEditOnDisk}
            title={
              canEditOnDisk
                ? `Open ${panel.fileName} in your editor`
                : 'Only available for a codebase opened from disk in the desktop app'
            }
            aria-label="Open in editor"
            className="glass-btn-quiet flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          {!ideMode && (
            <button
              onClick={() => setView('visual')}
              className={`rounded-lg border px-3 py-1.5 font-heading text-[11px] font-bold transition-all ${
                view === 'visual'
                  ? 'border-[#8fa824] bg-accent text-accent-contrast shadow-sm'
                  : 'glass-btn-quiet border-transparent px-2.5'
              }`}
            >
              Visual
            </button>
          )}
          {(
            ideMode
              ? ([['code', 'Code']] as const)
              : ([
                  ['simulator', 'Sim'],
                  ['code', 'Code'],
                ] as const)
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              title={tab === 'simulator' ? 'Simulator' : 'Source code'}
              className={`rounded-lg px-2 py-1.5 font-heading text-[10px] font-semibold transition-all ${
                view === tab
                  ? 'border border-[#8fa824] bg-surface-raised text-ink'
                  : 'glass-btn-quiet'
              }`}
            >
              {label}
            </button>
          ))}
          {ideMode && (
            <button
              onClick={() => setView('visual')}
              title="Visual preview"
              className={`rounded-lg px-2 py-1.5 font-heading text-[10px] font-semibold transition-all ${
                view === 'visual'
                  ? 'border border-[#8fa824] bg-surface-raised text-ink'
                  : 'glass-btn-quiet'
              }`}
            >
              Preview
            </button>
          )}
        </div>
      </header>

      {/* Android's live preview stays MOUNTED across tab switches — hidden with
          CSS rather than unmounted — so the DartPad iframe never cold-reloads.
          Switching to Code/Simulator and back is now instant. */}
      {panel.platform === 'android' && (
        <div
          className={
            view === 'visual'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'hidden'
          }
        >
          <FlutterPreview
            // Keyed on the file being viewed: switching screens/files forces a
            // clean remount (fresh iframe, fresh compile) so the compiled
            // output can never lag behind the Code tab of a *different* file.
            // Editing/rescanning the SAME file keeps the iframe warm (no key
            // change) and reposts the new source in place instead.
            key={panel.fileName}
            // Prefer the engine's previewCode — theme already inlined, assets
            // already swapped (robustly) and compile-checked. Falls back to the
            // raw file for flows that don't provide it (e.g. pasted/analyze).
            code={panel.previewCode ?? panel.code}
            device="Pixel 7"
            rulebook={rulebook}
            themeCode={panel.themeCode}
          />
        </div>
      )}

      {view === 'visual' ? (
        // Android's visual is the always-mounted FlutterPreview above; only the
        // iOS visual renders inline here.
        panel.platform === 'android' ? null : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SwiftPreview
              code={panel.code}
              themeCode={panel.themeCode}
              rulebook={rulebook}
              activeInconsistency={activeInconsistency}
            />
          </div>
        )
      ) : view === 'simulator' ? (
        <SimulatorPreview platform={panel.platform} />
      ) : editable ? (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <textarea
            value={panel.code}
            onChange={(e) => handleCodeChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="absolute inset-0 resize-none overflow-auto bg-transparent px-4 py-2 font-mono text-[12px] leading-[1.7] text-code caret-accent outline-none"
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto py-2">
          <div className="min-w-max font-mono text-[12px] leading-[1.7]">
            {lines.map((line, i) => {
              const lineNo = i + 1
              const severity = flaggedLines.get(lineNo)
              const isActive = activeLine === lineNo
              const isPulsing = pulse?.line === lineNo

              return (
                <div
                  key={isPulsing ? `${lineNo}-p${pulse.nonce}` : lineNo}
                  ref={(el) => {
                    if (el) lineRefs.current.set(lineNo, el)
                    else lineRefs.current.delete(lineNo)
                  }}
                  className={[
                    'flex border-l-2 border-transparent px-0',
                    severity ? FLAG_CLASS[severity] : '',
                    isActive ? 'line-active' : '',
                    isPulsing ? 'line-pulse' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="w-11 shrink-0 select-none pr-3 text-right text-[11px] leading-[1.85] text-ink-faint">
                    {lineNo}
                  </span>
                  <span className="whitespace-pre pr-6 text-code">
                    {line === '' ? ' ' : highlightLine(line, panel.language)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
