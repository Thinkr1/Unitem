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

export default function NavRail({ page, onNavigate, alertCount = 0 }: NavRailProps) {
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-6 py-4">
      <div className="flex h-9 w-9 items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 4v10a7 7 0 0 0 14 0V4"
            stroke="var(--color-ink)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        {ITEMS.map((item) => {
          const isActive = page === item.id
          return (
            <div key={item.id} className="group relative">
            <button
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface text-ink-muted hover:bg-surface-raised hover:text-ink'
              }`}
            >
              <svg
                width="19"
                height="19"
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
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-severity-error ring-2 ring-surface-deep" />
              )}
            </button>
            <NavTooltip label={item.label} />
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="group relative">
        <button
          aria-label="Sign out"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
        <NavTooltip label="Sign out" />
        </div>
        <div
          className="h-9 w-9 rounded-full border border-edge-bright bg-surface-raised"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #4b72f0 0%, #c4f84b 140%)',
          }}
          aria-hidden
        />
      </div>
    </nav>
  )
}
