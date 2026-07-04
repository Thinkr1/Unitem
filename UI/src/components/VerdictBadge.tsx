import type { Verdict } from '../types'

const STYLE: Record<Verdict, string> = {
  propagate: 'bg-info-blue/15 text-info-blue ring-info-blue/30',
  hold: 'bg-surface-raised text-ink ring-edge-bright',
  flag: 'bg-severity-warning/15 text-severity-warning ring-severity-warning/30',
}

const LABEL: Record<Verdict, string> = {
  propagate: 'Propagate',
  hold: 'Hold',
  flag: 'Flag',
}

export default function VerdictBadge({
  verdict,
  muted = false,
}: {
  verdict: Verdict
  muted?: boolean
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-heading text-[9.5px] font-semibold uppercase tracking-wide ring-1 ${STYLE[verdict]} ${muted ? 'opacity-50' : ''}`}
    >
      {LABEL[verdict]}
    </span>
  )
}
