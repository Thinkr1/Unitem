import type { Inconsistency, Severity } from '../types'
import VerdictBadge from './VerdictBadge'

const COUNT_DOT: Record<Severity, string> = {
  error: 'bg-severity-error',
  warning: 'bg-severity-warning',
  info: 'bg-severity-info',
}

function ScoreRing({ value }: { value: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  const dash = (value / 100) * c
  return (
    <div className="relative h-[108px] w-[108px] shrink-0">
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--color-edge)"
          strokeWidth="10"
        />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[22px] font-bold leading-none text-ink">
          {value}%
        </span>
        <span className="mt-1 font-mono text-[10px] text-ink-faint">score</span>
      </div>
    </div>
  )
}

interface OverviewPageProps {
  items: Inconsistency[]
}

export default function OverviewPage({ items }: OverviewPageProps) {
  const open = items.filter((i) => i.status === 'open')
  const resolved = items.filter((i) => i.status === 'resolved').length
  const settled = items.filter((i) => i.status !== 'open').length
  const total = items.length
  const score = total === 0 ? 100 : Math.round((settled / total) * 100)

  const counts: Record<Severity, number> = {
    error: open.filter((i) => i.severity === 'error').length,
    warning: open.filter((i) => i.severity === 'warning').length,
    info: open.filter((i) => i.severity === 'info').length,
  }

  const recent = items.filter((i) => i.status !== 'open').slice(0, 5)

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="grid gap-4">
        {/* Top row — score + progress */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card flex items-center gap-5 p-6">
            <ScoreRing value={score} />
            <div>
              <h2 className="font-heading text-[15px] font-bold text-ink">
                Consistency score
              </h2>
              <p className="mt-1 text-[12px] text-ink-muted">
                {resolved} of {total} inconsistencies resolved
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-heading text-[15px] font-bold text-ink">
              Open by severity
            </h2>
            <div className="mt-4 space-y-3">
              {(['error', 'warning', 'info'] as Severity[]).map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${COUNT_DOT[s]}`}
                  />
                  <span className="w-16 font-heading text-[12px] capitalize text-ink-muted">
                    {s}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className={`h-full rounded-full ${COUNT_DOT[s]}`}
                      style={{
                        width: `${open.length ? (counts[s] / open.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[12px] text-ink">
                    {counts[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Platform drift */}
        <div className="glass-card p-6">
          <h2 className="mb-4 font-heading text-[15px] font-bold text-ink">
            Platform drift
          </h2>
          <div className="space-y-2">
            {open.map((item) => (
              <div
                key={item.id}
                className="glass-inset flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 font-mono text-[11px]"
              >
                <span className="font-heading text-[12px] font-semibold text-ink">
                  {item.property}
                </span>
                {item.verdict && (
                  <VerdictBadge verdict={item.verdict} />
                )}
                <span className="text-ink-faint">iOS</span>
                <span className="text-mismatch">{item.ios.value}</span>
                <span className="text-ink-faint">Android</span>
                <span className="text-mismatch">{item.android.value}</span>
                <span className="text-ink-faint">→</span>
                <span className="text-match">{item.expected}</span>
              </div>
            ))}
            {open.length === 0 && (
              <p className="py-4 text-center text-[12px] text-ink-faint">
                All clear — no open drift.
              </p>
            )}
          </div>
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="mb-3 font-heading text-[15px] font-bold text-ink">
              Recent activity
            </h2>
            <div className="space-y-2">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className="glass-inset flex items-center justify-between px-4 py-2.5"
                >
                  <span className="font-heading text-[12px] text-ink">
                    {item.property}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
