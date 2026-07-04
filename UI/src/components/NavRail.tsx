import type { ReactNode } from 'react'

export type NavPage = 'overview' | 'comparison' | 'agents' | 'rulebook' | 'alerts'

interface NavItem {
  id: NavPage
  label: string
  icon: ReactNode
}

const ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    ),
  },
  {
    id: 'comparison',
    label: 'Comparison',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="18" rx="1.5" />
      </>
    ),
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
        <circle cx="19" cy="7" r="2" opacity="0.6" />
        <circle cx="5" cy="7" r="2" opacity="0.6" />
      </>
    ),
  },
  {
    id: 'rulebook',
    label: 'Rulebook',
    icon: (
      <>
        <path d="M4 5.5A2 2 0 0 1 6 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1.5.86L12 17.5l-5.5 2.36A1 1 0 0 1 5 19V5.5z" />
        <path d="M8 8h8M8 11.5h5" />
      </>
    ),
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: (
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    ),
  },
]

interface NavRailProps {
  page: NavPage
  onNavigate: (page: NavPage) => void
  alertCount?: number
  onEditCode?: () => void
  onRescan?: () => void
  rescanning?: boolean
  engineLive?: boolean | null
}

function NavTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-surface-raised px-2.5 py-1.5 font-heading text-[11px] font-medium text-ink opacity-0 shadow-lg ring-1 ring-edge-bright transition-opacity duration-150 group-hover:opacity-100"
    >
      {label}
    </span>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
          active
            ? 'bg-accent text-accent-contrast shadow-[0_0_20px_rgba(197,232,53,0.25)]'
            : 'bg-surface text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40'
        }`}
      >
        {children}
      </button>
      <NavTooltip label={label} />
    </div>
  )
}

export default function NavRail({
  page,
  onNavigate,
  alertCount = 0,
  onEditCode,
  onRescan,
  rescanning = false,
  engineLive = null,
}: NavRailProps) {
  return (
    <nav className="app-drag flex w-[4.5rem] shrink-0 flex-col items-center gap-4 pb-4 pt-11">
      {/* Logo — sits below macOS traffic lights */}
      <div className="group relative mb-1" data-no-drag>
        <img
          src="./unitem-logo.png"
          alt="Unitem"
          className="h-8 w-auto max-w-[3.25rem] object-contain brightness-110"
          draggable={false}
        />
        {engineLive === false && (
          <span
            title="Engine offline — showing sample data"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-surface-deep"
          />
        )}
      </div>

      {/* Primary actions */}
      {(onEditCode || onRescan) && (
        <div className="flex flex-col items-center gap-1.5" data-no-drag>
          {onEditCode && (
            <ActionButton label="Edit code" onClick={onEditCode}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </ActionButton>
          )}
          {onRescan && page === 'comparison' && (
            <ActionButton
              label={rescanning ? 'Scanning…' : 'Rescan'}
              onClick={onRescan}
              disabled={rescanning}
              active={rescanning}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={rescanning ? 'animate-spin' : ''}
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
              </svg>
            </ActionButton>
          )}
        </div>
      )}

      <div className="h-px w-8 bg-edge" aria-hidden />

      <div className="flex flex-1 flex-col items-center gap-2" data-no-drag>
        {ITEMS.map((item) => {
          const isActive = page === item.id
          return (
            <div key={item.id} className="group relative">
              <button
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-accent text-accent-contrast shadow-[0_0_20px_rgba(197,232,53,0.2)]'
                    : 'bg-surface text-ink-muted hover:bg-surface-raised hover:text-ink'
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {item.icon}
                </svg>
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-severity-error ring-2 ring-surface-deep" />
                )}
              </button>
              <NavTooltip label={item.label} />
            </div>
          )
        })}
      </div>
    </nav>
  )
}
