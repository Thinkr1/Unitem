import type { Inconsistency, Severity } from '../types'
import InconsistencyCard from './InconsistencyCard'

const GROUPS: Severity[] = ['error', 'warning', 'info']

const GROUP_LABEL: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
}

interface AlertsPageProps {
  items: Inconsistency[]
  activeId: string | null
  onSelect: (item: Inconsistency) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
}

export default function AlertsPage({
  items,
  activeId,
  onSelect,
  onResolve,
  onIgnore,
}: AlertsPageProps) {
  const open = items.filter((i) => i.status === 'open')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-2xl space-y-6">
        {open.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface py-16 text-center">
            <p className="font-heading text-[14px] font-semibold text-ink">
              No open alerts
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              All inconsistencies have been resolved or ignored.
            </p>
          </div>
        ) : (
          GROUPS.map((severity) => {
            const group = open.filter((i) => i.severity === severity)
            if (group.length === 0) return null
            return (
              <section key={severity}>
                <h2 className="mb-2.5 font-heading text-[13px] font-semibold text-ink">
                  {GROUP_LABEL[severity]}
                  <span className="ml-2 font-mono text-[11px] font-normal text-ink-faint">
                    {group.length}
                  </span>
                </h2>
                <div className="space-y-2.5">
                  {group.map((item) => (
                    <InconsistencyCard
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      onSelect={onSelect}
                      onResolve={onResolve}
                      onIgnore={onIgnore}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
