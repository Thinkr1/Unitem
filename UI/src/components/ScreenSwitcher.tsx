import type { ScreenInfo } from '../lib/api'

interface ScreenSwitcherProps {
  screens: ScreenInfo[]
  value: string
  onChange: (screen: string) => void
  busy?: boolean
}

/** Compact dropdown that flips the comparison view between mapped screens
 *  (e.g. `login` ↔ `glasslogin`). Hidden until the engine reports >1 screen —
 *  offline/mock mode has nothing to switch between. */
export default function ScreenSwitcher({
  screens,
  value,
  onChange,
  busy = false,
}: ScreenSwitcherProps) {
  if (screens.length < 2) return null

  return (
    <label className="flex shrink-0 items-center gap-2">
      <span className="font-heading text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        Screen
      </span>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-edge bg-surface-raised px-2.5 py-1 font-heading text-[11px] font-medium text-ink outline-none transition-colors hover:border-accent/50 focus:border-accent disabled:opacity-50"
      >
        {screens.map((s) => (
          <option key={s.feature} value={s.feature}>
            {s.feature}
            {s.oneSided ? ' (one-sided)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
