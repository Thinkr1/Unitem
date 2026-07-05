import { useMemo, useState } from 'react'
import type { Inconsistency, Verdict } from '../types'
import InconsistencyCard from './InconsistencyCard'

export type Filter = 'all' | Verdict | 'ignored'

const FILTERS: { id: Filter; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every issue' },
  { id: 'propagate', label: 'Sync', hint: 'Apply token sync' },
  { id: 'hold', label: 'OK as-is', hint: 'Platform-native — leave as-is' },
  { id: 'flag', label: 'Needs fix', hint: 'Requires action' },
  { id: 'ignored', label: 'Dismissed', hint: 'Already skipped' },
]

function ScoreRing({ value }: { value: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const dash = (value / 100) * c
  return (
    <div className="relative h-[52px] w-[52px] shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-edge)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-[13px] font-bold text-ink">{value}%</span>
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

  const openVerdictSummary = useMemo(() => {
    const holds = open.filter((i) => i.verdict === 'hold').length
    const syncs = open.filter((i) => i.verdict === 'propagate').length
    const fixes = open.filter(
      (i) => i.verdict === 'flag' || (!i.verdict && i.status === 'open'),
    ).length
    const parts: string[] = []
    if (holds) parts.push(`${holds} hold`)
    if (syncs) parts.push(`${syncs} sync`)
    if (fixes) parts.push(`${fixes} fix`)
    return parts.join(' · ')
  }, [open])

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
      const haystack = [i.property, i.reason, i.rule, i.ios.value, i.android.value]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, filter, query])

  return (
    <section className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-edge px-4 py-3.5">
        <ScoreRing value={score} />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[15px] font-bold text-ink">Review</h2>
          <p className="text-[11px] text-ink-muted">
            {resolved} fixed · {open.length} open
            {openVerdictSummary ? ` · ${openVerdictSummary}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onResetDemo && (
            <button
              onClick={onResetDemo}
              disabled={transferring}
              title="Reset demo Android design"
              aria-label="Reset demo Android design"
              className="glass-btn-quiet flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
          )}
          <button
            onClick={onResolveAll}
            disabled={transferring}
            className="glass-btn-primary-lg disabled:opacity-50"
          >
            {transferring ? 'Transferring…' : 'Transfer all'}
          </button>
        </div>
      </header>

      <div className="shrink-0 px-4 py-3">
        <div className="glass-inset flex items-center gap-2.5 px-3.5 py-3 focus-within:border-edge-bright focus-within:ring-2 focus-within:ring-accent/25">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-ink-faint" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues…"
            aria-label="Search issues"
            className="min-w-0 flex-1 bg-transparent font-heading text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1 px-4 pb-2.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            title={f.hint}
            className={`chip-filter ${filter === f.id ? 'chip-filter-active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-0.5">
        {visible.length === 0 ? (
          <div className="glass-inset mx-0.5 px-4 py-10 text-center">
            <p className="font-heading text-[13px] font-semibold text-ink">
              {query ? 'No matches' : 'Nothing here'}
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {query ? 'Try a different search term.' : 'Try another filter above.'}
            </p>
          </div>
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
