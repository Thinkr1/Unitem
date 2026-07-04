import type { Inconsistency } from '../types'
import SeverityBadge from './SeverityBadge'

interface CardProps {
  item: Inconsistency
  active: boolean
  onSelect: (item: Inconsistency) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
}

const SEVERITY_BORDER: Record<string, string> = {
  error: 'border-l-severity-error',
  warning: 'border-l-severity-warning',
  info: 'border-l-severity-info',
}

function DiffRow({
  label,
  lineRef,
  value,
  matches,
}: {
  label: string
  lineRef: string
  value: string
  matches: boolean
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-ink-muted">{label}</span>
      <span className="w-20 shrink-0 text-ink-faint">{lineRef}</span>
      <span className="text-ink-faint">→</span>
      <span className={matches ? 'text-match' : 'text-mismatch'}>{value}</span>
    </div>
  )
}

export default function InconsistencyCard({
  item,
  active,
  onSelect,
  onResolve,
  onIgnore,
}: CardProps) {
  const settled = item.status !== 'open'

  return (
    <article
      onClick={() => onSelect(item)}
      className={[
        'cursor-pointer rounded-md border border-l-2 transition-colors',
        SEVERITY_BORDER[item.severity],
        active
          ? 'border-accent/40 bg-surface-raised'
          : 'border-edge bg-surface hover:border-edge-bright',
        settled ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* ── Resting row — always visible ─────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <SeverityBadge severity={item.severity} muted={settled} />

        <span className="min-w-0 flex-1 truncate font-heading text-[12.5px] font-semibold text-ink">
          {item.property}
        </span>

        {/* Compact one-line value summary */}
        {!active && (
          <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
            <span className="text-mismatch">{item.ios.value}</span>
            <span className="mx-1 text-ink-faint/40">·</span>
            <span className="text-mismatch">{item.android.value}</span>
            <span className="mx-1 text-ink-faint/40">→</span>
            <span className="text-match">{item.expected}</span>
          </span>
        )}

        {settled && (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            {item.status}
          </span>
        )}
      </div>

      {/* ── Expanded detail — visible only when active ──────────────
          Uses the CSS grid trick: grid-rows-[0fr] → grid-rows-[1fr]
          to animate open/close without JS height measuring.          */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-edge/60 px-3 pb-3 pt-2.5">
            {/* Rule text */}
            <p className="mb-2.5 text-[11.5px] leading-snug text-ink-muted">
              {item.rule}
            </p>

            {/* Diff block */}
            <div className="space-y-0.5 rounded bg-well px-2.5 py-2 font-mono text-[11px]">
              <div className="flex items-baseline gap-2">
                <span className="text-ink-muted">Rulebook expects:</span>
                <span className="text-accent">{item.expected}</span>
              </div>
              <DiffRow
                label="iOS"
                lineRef={`swift:${item.ios.line}`}
                value={item.ios.value}
                matches={item.ios.value === item.expected}
              />
              <DiffRow
                label="Android"
                lineRef={`dart:${item.android.line}`}
                value={item.android.value}
                matches={item.android.value === item.expected}
              />
            </div>

            {/* Action buttons */}
            <div className="mt-2.5 flex gap-2">
              <button
                disabled={settled}
                onClick={(e) => {
                  e.stopPropagation()
                  onResolve(item.id)
                }}
                className="rounded border border-accent/50 px-2.5 py-1 font-heading text-[11px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:border-edge disabled:text-ink-faint"
              >
                Resolve
              </button>
              <button
                disabled={settled}
                onClick={(e) => {
                  e.stopPropagation()
                  onIgnore(item.id)
                }}
                className="rounded border border-edge px-2.5 py-1 font-heading text-[11px] font-medium text-ink-muted transition-colors hover:border-edge-bright hover:text-ink disabled:pointer-events-none disabled:text-ink-faint"
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
