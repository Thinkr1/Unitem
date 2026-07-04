import type { Inconsistency, Verdict } from '../types'
import InconsistencyCard from './InconsistencyCard'

export type Filter = 'all' | Verdict | 'ignored'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'propagate', label: 'Propagate' },
  { id: 'hold', label: 'Hold' },
  { id: 'flag', label: 'Flag' },
  { id: 'ignored', label: 'Ignored' },
]

function ScoreRing({ value }: { value: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const dash = (value / 100) * c
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke="var(--color-surface-deep)"
          strokeWidth="7"
        />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[15px] font-bold leading-none text-ink">
          {value}%
        </span>
      </div>
    </div>
  )
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
  transferring?: boolean
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
  transferring = false,
}: PanelProps) {
  const open = items.filter((i) => i.status === 'open')
  const issues = items.filter((i) => i.verdict !== 'hold')
  const counts: Record<Verdict, number> = {
    propagate: open.filter((i) => i.verdict === 'propagate').length,
    hold: open.filter((i) => i.verdict === 'hold').length,
    flag: open.filter((i) => i.verdict === 'flag' || !i.verdict).length,
  }

  const resolved = issues.filter((i) => i.status === 'resolved').length
  const settled = issues.filter((i) => i.status !== 'open').length
  const total = issues.length
  const score = total === 0 ? 100 : Math.round((settled / total) * 100)

  const visible = items.filter((i) => {
    if (filter === 'all') return true
    if (filter === 'ignored') return i.status === 'ignored'
    if (filter === 'flag') return i.verdict === 'flag' || !i.verdict
    return i.verdict === filter
  })

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-edge bg-surface">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="font-heading text-[13px] font-semibold tracking-wide text-ink">
          Inconsistencies
        </h2>

        <button
          onClick={onResolveAll}
          disabled={transferring}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 font-heading text-[11px] font-semibold text-accent-contrast transition-colors hover:bg-accent-bright disabled:bg-surface-raised disabled:text-ink-faint"
        >
          {transferring ? 'Transferring…' : 'Transfer to Android'}
        </button>
      </header>

      {/* ── Consistency summary ─────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex items-center gap-4 rounded-xl bg-surface-deep px-4 py-3.5">
        <ScoreRing value={score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-heading text-[12px] font-semibold text-ink">
              Consistency score
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              {resolved}/{total} resolved
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${score}%` }}
            />
          </div>
          {/* Verdict breakdown */}
          <div className="mt-2.5 flex items-center gap-3">
            {(['propagate', 'hold', 'flag'] as Verdict[]).map((v) => (
              <span key={v} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    v === 'propagate'
                      ? 'bg-info-blue'
                      : v === 'hold'
                        ? 'bg-ink-faint'
                        : 'bg-severity-warning'
                  }`}
                />
                <span className="font-mono text-[10.5px] text-ink-muted capitalize">
                  {counts[v]} {v}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter chips ────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`rounded-full px-3 py-1 font-heading text-[11px] font-medium transition-colors ${
              filter === f.id
                ? 'bg-accent text-accent-contrast'
                : 'bg-surface-deep text-ink-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Card list ───────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4 pt-1.5">
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
