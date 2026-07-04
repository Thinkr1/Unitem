import type { Severity } from '../types'

const STYLES: Record<Severity, string> = {
  error: 'bg-severity-error/15 text-severity-error border-severity-error/30',
  warning:
    'bg-severity-warning/15 text-severity-warning border-severity-warning/30',
  info: 'bg-severity-info/15 text-severity-info border-severity-info/30',
}

export default function SeverityBadge({
  severity,
  muted = false,
}: {
  severity: Severity
  muted?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wider ${
        muted ? 'border-edge bg-transparent text-ink-faint' : STYLES[severity]
      }`}
    >
      {severity}
    </span>
  )
}
