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
  /** When true, the Code tab becomes an editable textarea (used for the iOS
   *  panel). Edits flow up via onCodeChange and are transferred as-is. */
  editable?: boolean
  onCodeChange?: (code: string) => void
}

const FLAG_CLASS: Record<Severity, string> = {
  error: 'line-flag-error',
  warning: 'line-flag-warning',
  info: 'line-flag-info',
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
}: ScreenPanelProps) {
  const [view, setView] = useState<'visual' | 'simulator' | 'code'>('visual')
  const lines = useMemo(() => panel.code.split('\n'), [panel.code])
  const lineRefs = useRef(new Map<number, HTMLDivElement>())

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
        <h2 className="font-heading text-[14px] font-bold text-ink">{title}</h2>

        <div className="flex shrink-0 items-center gap-1">
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
          {(
            [
              ['simulator', 'Sim'],
              ['code', 'Code'],
            ] as const
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
        </div>
      </header>

      {view === 'visual' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {panel.platform === 'android' ? (
          <FlutterPreview
            // Prefer the engine's previewCode — theme already inlined, assets
            // already swapped (robustly) and compile-checked. Falls back to the
            // raw file for flows that don't provide it (e.g. pasted/analyze).
            code={panel.previewCode ?? panel.code}
            device="Pixel 7"
            rulebook={rulebook}
            themeCode={panel.themeCode}
          />
        ) : (
          <SwiftPreview
            code={panel.code}
            themeCode={panel.themeCode}
            rulebook={rulebook}
            activeInconsistency={activeInconsistency}
          />
        )}
        </div>
      ) : view === 'simulator' ? (
        <SimulatorPreview platform={panel.platform} />
      ) : editable ? (
        <textarea
          value={panel.code}
          onChange={(e) => onCodeChange?.(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-2 font-mono text-[12px] leading-[1.7] text-code caret-accent outline-none"
        />
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
