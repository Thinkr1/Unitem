import type { Inconsistency } from '../types'

interface RulebookPageProps {
  rulebook: Record<string, string>
  items: Inconsistency[]
}

export default function RulebookPage({ rulebook, items }: RulebookPageProps) {
  const open = items.filter((i) => i.status === 'open')

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-[12px] text-ink-muted">
          Shared design tokens both platforms should follow. Violations are
          flagged in Comparison.
        </p>

        {Object.entries(rulebook).map(([key, value]) => {
          const violations = open.filter((i) => i.rule.includes(`(${key})`))
          return (
            <div
              key={key}
              className="rounded-xl border border-edge bg-surface px-4 py-3.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[12px] text-accent">{key}</span>
                <span className="font-mono text-[13px] font-semibold text-ink">
                  {value}
                </span>
              </div>
              {violations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {violations.map((v) => (
                    <span
                      key={v.id}
                      className="rounded-full bg-severity-error/15 px-2 py-0.5 font-heading text-[10px] text-severity-error"
                    >
                      {v.property}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
