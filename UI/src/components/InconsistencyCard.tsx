import type { Inconsistency } from '../types'
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
  const verdict = item.verdict ?? 'flag'
  const isHold = verdict === 'hold'
  const isPropagate = verdict === 'propagate'
  const bodyText = item.reason ?? item.rule
  const showExpected = item.expected != null && item.expected !== ''

  const borderClass = isHold
    ? 'border-l-info-blue/70'
    : SEVERITY_BORDER[item.severity]

  const resolveLabel = isPropagate ? 'Approve' : 'Resolve'
  const ignoreLabel = isHold ? 'Override' : 'Ignore'

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
            <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-faint">
              {isHold ? (
                <span className="text-ink-muted">{bodyText}</span>
              ) : (
                <>
                  <span className="text-mismatch">{item.ios.value}</span>
                  <span className="mx-1 text-ink-faint/40">·</span>
                  <span className="text-mismatch">{item.android.value}</span>
                  {showExpected && (
                    <>
                      <span className="mx-1 text-ink-faint/40">→</span>
                      <span className="text-match">{item.expected}</span>
                    </>
                  )}
                </>
              )}
            </span>
          )}
        </div>

        {item.confidence != null && !active && (
          <span className="shrink-0 font-mono text-[9px] text-ink-faint">
            {Math.round(item.confidence * 100)}%
          </span>
        )}

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

            {item.conventionRefs && item.conventionRefs.length > 0 && (
              <p className="mb-2 font-mono text-[10px] text-ink-faint">
                {item.conventionRefs.join(' · ')}
              </p>
            )}

            {!isHold && (
              <div className="space-y-0.5 rounded bg-well px-2.5 py-2 font-mono text-[11px]">
                {showExpected && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-ink-muted">Rulebook expects:</span>
                    <span className="text-accent">{item.expected}</span>
                  </div>
                )}
                {isPropagate && item.originPlatform && (
                  <div className="flex items-baseline gap-2 pb-1 text-ink-muted">
                    <span>Origin:</span>
                    <span className="text-ink">{item.originPlatform}</span>
                  </div>
                )}
                <DiffRow
                  label="iOS"
                  lineRef={`swift:${item.ios.line}`}
                  value={item.ios.value}
                  matches={showExpected ? item.ios.value === item.expected : false}
                />
                <DiffRow
                  label="Android"
                  lineRef={`dart:${item.android.line}`}
                  value={item.android.value}
                  matches={
                    showExpected ? item.android.value === item.expected : false
                  }
                />
              </div>
            )}

            {item.proposedFix?.diff && (
              <pre className="mt-2.5 max-h-40 overflow-auto rounded bg-well px-2.5 py-2 font-mono text-[10px] leading-relaxed text-code whitespace-pre-wrap">
                {item.proposedFix.diff.trim()}
              </pre>
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
