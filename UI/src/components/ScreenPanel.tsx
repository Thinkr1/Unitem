import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodePanel as CodePanelData, Inconsistency, Severity } from '../types'
import { highlightLine } from '../lib/highlight'
import LoginPreview from './LoginPreview'
import FlutterPreview from './FlutterPreview'

export interface LinePulse {
  line: number
  nonce: number
}

interface ScreenPanelProps {
  panel: CodePanelData
  title: string
  flaggedLines: Map<number, Severity>
  activeLine: number | null
  pulse: LinePulse | null
  activeInconsistency: Inconsistency | null
  inconsistencies: Inconsistency[]
}

const FLAG_CLASS: Record<Severity, string> = {
  error: 'line-flag-error',
  warning: 'line-flag-warning',
  info: 'line-flag-info',
}

export default function ScreenPanel({
  panel,
  title,
  flaggedLines,
  activeLine,
  pulse,
  activeInconsistency,
  inconsistencies,
}: ScreenPanelProps) {
  const [view, setView] = useState<'visual' | 'code'>('visual')
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
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-edge bg-surface">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="font-heading text-[13px] font-semibold tracking-wide text-ink">
            {title}
          </h2>
          <span className="truncate font-mono text-[11px] text-ink-faint">
            {panel.fileName}
          </span>
        </div>

        {/* View toggle — segmented lime pill */}
        <div className="ml-3 flex shrink-0 rounded-full bg-surface-deep p-0.5">
          <button
            onClick={() => setView('visual')}
            className={`rounded-full px-3 py-1 font-heading text-[10.5px] font-semibold transition-colors ${
              view === 'visual'
                ? 'bg-accent text-accent-contrast'
                : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            Visual
          </button>
          <button
            onClick={() => setView('code')}
            className={`rounded-full px-3 py-1 font-heading text-[10.5px] font-semibold transition-colors ${
              view === 'code'
                ? 'bg-accent text-accent-contrast'
                : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            Code
          </button>
        </div>
      </header>

      {view === 'visual' ? (
        panel.platform === 'android' ? (
          <FlutterPreview code={panel.previewCode ?? panel.code} device="Pixel 7" />
        ) : (
          <LoginPreview
            platform={panel.platform}
            activeInconsistency={activeInconsistency}
            inconsistencies={inconsistencies}
          />
        )
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
