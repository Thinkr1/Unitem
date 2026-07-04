import type { Inconsistency } from '../types'
import DiffView from './DiffView'
import SeverityBadge from './SeverityBadge'
import VerdictBadge from './VerdictBadge'

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
  value,
  matches,
}: {
  label: string
  value: string
  matches: boolean
}) {
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-ink-muted">{label}</span>
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
  const verdict = item.verdict ?? 'flag'
  const isHold = verdict === 'hold'
  const isPropagate = verdict === 'propagate'
  const bodyText = item.reason ?? item.rule
  const showExpected = item.expected != null && item.expected !== ''

  const borderClass = isHold
    ? 'border-l-info-blue/70'
    : SEVERITY_BORDER[item.severity]

  const resolveLabel = isPropagate ? 'Apply fix' : 'Fix it'
  const ignoreLabel = isHold ? 'Disagree' : 'Dismiss'

  return (
    <article
      onClick={() => onSelect(item)}
      className={[
        'cursor-pointer overflow-hidden rounded-xl border border-l-2 transition-colors',
        borderClass,
        active
          ? isHold
            ? 'border-info-blue/40 bg-surface-raised'
            : 'border-accent/50 bg-surface-raised'
          : 'border-edge bg-surface-deep hover:border-edge-bright',
        settled ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {isHold ? (
          <VerdictBadge verdict="hold" muted={settled} />
        ) : (
          <SeverityBadge severity={item.severity} muted={settled} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="block truncate font-heading text-[12.5px] font-semibold text-ink">
              {item.property}
            </span>
            {item.verdict && item.verdict !== 'flag' && (
              <VerdictBadge verdict={item.verdict} muted={settled} />
            )}
          </div>

          {!active && (
            <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-muted">
              {bodyText}
            </span>
          )}
        </div>

        {settled && (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
            {item.status}
          </span>
        )}
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-edge/60 px-3 pb-3 pt-2.5">
            <p className="mb-2.5 text-[11.5px] leading-snug text-ink-muted">
              {bodyText}
            </p>

            {!isHold && (
              <div className="space-y-1 rounded-lg bg-well px-2.5 py-2">
                {showExpected && (
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-ink-muted">Should be:</span>
                    <span className="text-accent">{item.expected}</span>
                  </div>
                )}
                <DiffRow
                  label="iOS"
                  value={item.ios.value}
                  matches={showExpected ? item.ios.value === item.expected : false}
                />
                <DiffRow
                  label="Android"
                  value={item.android.value}
                  matches={
                    showExpected ? item.android.value === item.expected : false
                  }
                />
              </div>
            )}

            {item.proposedFix?.diff && (
              <div className="mt-2.5">
                <p className="mb-1 font-heading text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                  Proposed fix
                </p>
                <DiffView
                  diff={item.proposedFix.diff}
                  file={item.proposedFix.file}
                  targetPlatform={item.proposedFix.targetPlatform}
                />
              </div>
            )}

            {item.prUrl && (
              <a
                href={item.prUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-flex items-center gap-1 font-heading text-[11px] font-medium text-info-blue hover:underline"
              >
                View PR ↗
              </a>
            )}

            <div className="mt-2.5 flex gap-2">
              {!isHold && (
                <button
                  disabled={settled}
                  onClick={(e) => {
                    e.stopPropagation()
                    onResolve(item.id)
                  }}
                  className="rounded border border-accent/50 px-2.5 py-1 font-heading text-[11px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:border-edge disabled:text-ink-faint"
                >
                  {resolveLabel}
                </button>
              )}
              <button
                disabled={settled}
                onClick={(e) => {
                  e.stopPropagation()
                  onIgnore(item.id)
                }}
                className="rounded border border-edge px-2.5 py-1 font-heading text-[11px] font-medium text-ink-muted transition-colors hover:border-edge-bright hover:text-ink disabled:pointer-events-none disabled:text-ink-faint"
              >
                {ignoreLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
