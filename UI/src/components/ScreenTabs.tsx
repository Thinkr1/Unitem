import type { AppScreen } from '../types'

interface ScreenTabsProps {
  appName: string
  appIcon?: string
  screens: AppScreen[]
  activeScreenId: string | null
  /** Open-issue count per screen id, shown as a small badge. */
  issueCounts: Record<string, number>
  onSelect: (id: string) => void
}

/** Horizontal screen switcher for a loaded whole-app codebase — hidden when
 *  there's only one screen (e.g. a pasted single-screen pair). */
export default function ScreenTabs({
  appName,
  appIcon,
  screens,
  activeScreenId,
  issueCounts,
  onSelect,
}: ScreenTabsProps) {
  if (screens.length <= 1) return null

  return (
    <div className="mb-2 flex shrink-0 items-center gap-2 overflow-x-auto glass-card px-2.5 py-2">
      <span className="flex shrink-0 items-center gap-1.5 pl-1 pr-2 font-heading text-[12px] font-bold text-ink">
        <span aria-hidden>{appIcon}</span>
        {appName}
      </span>
      <span className="h-5 w-px shrink-0 bg-edge" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {screens.map((screen) => {
          const count = issueCounts[screen.id] ?? 0
          const active = screen.id === activeScreenId
          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => onSelect(screen.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-heading text-[12px] font-semibold transition-all ${
                active
                  ? 'bg-accent text-accent-contrast shadow-sm'
                  : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
              }`}
            >
              {screen.name}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    active
                      ? 'bg-accent-contrast/15 text-accent-contrast'
                      : 'bg-severity-error/15 text-severity-error'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
