import type { Inconsistency, Severity } from '../types'
import InconsistencyCard from './InconsistencyCard'

export type Filter = 'all' | Severity | 'ignored'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
  { id: 'ignored', label: 'Ignored' },
]

const COUNT_DOT: Record<Severity, string> = {
  error: 'bg-severity-error',
  warning: 'bg-severity-warning',
  info: 'bg-severity-info',
}

interface PanelProps {
  items: Inconsistency[]
  filter: Filter
  activeId: string | null
  onFilterChange: (filter: Filter) => void
  onSelect: (item: Inconsistency) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
  onResolveAll: () => void
}

export default function InconsistenciesPanel({
  items,
  filter,
  activeId,
  onFilterChange,
  onSelect,
  onResolve,
  onIgnore,
  onResolveAll,
}: PanelProps) {
  const open = items.filter((i) => i.status === 'open')
  const counts: Record<Severity, number> = {
    error: open.filter((i) => i.severity === 'error').length,
    warning: open.filter((i) => i.severity === 'warning').length,
    info: open.filter((i) => i.severity === 'info').length,
  }

  const visible = items.filter((i) => {
    if (filter === 'all') return true
    if (filter === 'ignored') return i.status === 'ignored'
    return i.severity === filter
  })

  return (
    <section className="flex h-full min-w-0 flex-col bg-surface-deep">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-edge px-5">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-[13px] font-semibold tracking-wide text-ink">
            Inconsistencies
          </h2>

          {/* Compact dot + count badges */}
          <div className="flex items-center gap-2">
            {(['error', 'warning', 'info'] as Severity[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${COUNT_DOT[s]}`} />
                <span className="font-mono text-[10.5px] text-ink-faint">
                  {counts[s]}
                </span>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onResolveAll}
          disabled={open.length === 0}
          className="shrink-0 rounded bg-accent px-2.5 py-1 font-heading text-[11px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:bg-edge disabled:text-ink-faint"
        >
          Resolve all
        </button>
      </header>

      {/* ── Filter chips ────────────────────────────────────────────── */}
      <div className="flex shrink-0 gap-1.5 border-b border-edge px-5 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`rounded-full border px-2.5 py-0.5 font-heading text-[11px] font-medium transition-colors ${
              filter === f.id
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-edge text-ink-muted hover:border-edge-bright hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Card list ───────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {visible.length === 0 ? (
          <p className="px-1 py-8 text-center text-[12px] text-ink-faint">
            Nothing matches this filter.
          </p>
        ) : (
          visible.map((item) => (
            <InconsistencyCard
              key={item.id}
              item={item}
              active={item.id === activeId}
              onSelect={onSelect}
              onResolve={onResolve}
              onIgnore={onIgnore}
            />
          ))
        )}
      </div>
    </section>
  )
}
