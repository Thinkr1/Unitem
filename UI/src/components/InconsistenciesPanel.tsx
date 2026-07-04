import { useMemo, useState } from 'react'
import type { Inconsistency, Verdict } from '../types'
import InconsistencyCard from './InconsistencyCard'

export type Filter = 'all' | Verdict | 'ignored'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'propagate', label: 'Sync' },
  { id: 'hold', label: 'OK as-is' },
  { id: 'flag', label: 'Needs fix' },
  { id: 'ignored', label: 'Dismissed' },
]

function ScoreRing({ value }: { value: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const dash = (value / 100) * c
  return (
    <div className="relative h-[60px] w-[60px] shrink-0">
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
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[14px] font-bold leading-none text-ink">
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
  onResetDemo?: () => void
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
  onResetDemo,
  transferring = false,
}: PanelProps) {
  const [query, setQuery] = useState('')

  const open = items.filter((i) => i.status === 'open')
  const issues = items.filter((i) => i.verdict !== 'hold')
  const resolved = issues.filter((i) => i.status === 'resolved').length
  const total = issues.length
  const score = total === 0 ? 100 : Math.round((resolved / total) * 100)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (filter === 'ignored') {
        if (i.status !== 'ignored') return false
      } else if (filter !== 'all') {
        if (filter === 'flag') {
          if (i.verdict !== 'flag' && i.verdict) return false
        } else if (i.verdict !== filter) return false
      }
      if (!q) return true
      const haystack = [
        i.property,
        i.reason,
        i.rule,
        i.ios.value,
        i.android.value,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, filter, query])

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-edge bg-surface">
      <header className="flex shrink-0 flex-col gap-3 px-4 pb-2 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-[14px] font-semibold tracking-wide text-ink">
            Review
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {onResetDemo && (
              <button
                onClick={onResetDemo}
                disabled={transferring}
                title="Reset demo Android design"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-deep text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
            )}
            <button
              onClick={onResolveAll}
              disabled={transferring}
              className="rounded-full bg-accent px-3.5 py-1.5 font-heading text-[11px] font-semibold text-accent-contrast transition-all hover:bg-accent-bright disabled:bg-surface-raised disabled:text-ink-faint"
            >
              {transferring ? 'Transferring…' : 'Transfer to Android'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-surface-deep px-3 py-2 ring-1 ring-edge transition-shadow focus-within:ring-accent/40">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="shrink-0 text-ink-faint"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues…"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </header>

      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-surface-deep px-3.5 py-3">
        <ScoreRing value={score} />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-[12px] font-semibold text-ink">
            Consistency
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {resolved} of {total} resolved · {open.length} open
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`rounded-full px-3 py-1 font-heading text-[11px] font-medium transition-all duration-200 ${
              filter === f.id
                ? 'bg-accent text-accent-contrast'
                : 'bg-surface-deep text-ink-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 pt-1">
        {visible.length === 0 ? (
          <p className="px-1 py-10 text-center text-[12px] text-ink-faint">
            {query ? 'No issues match your search.' : 'Nothing in this filter.'}
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
