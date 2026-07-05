import type { ChangeKind } from '../types'

const LABEL: Record<ChangeKind, string> = {
  token: 'Token change',
  'platform-native': 'Platform-native',
  drift: 'Drift',
}

export default function ChangeKindBadge({ kind }: { kind: ChangeKind }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-surface-raised px-2 py-0.5 font-heading text-[9px] font-medium uppercase tracking-wide text-ink-muted ring-1 ring-edge">
      {LABEL[kind]}
    </span>
  )
}
