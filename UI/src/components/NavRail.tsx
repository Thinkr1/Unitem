import type { ReactNode } from 'react'

export type NavPage = 'overview' | 'comparison' | 'agents' | 'rulebook' | 'alerts' | 'tasks'

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
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9.5h8M8 13h5M8 16.5h6" />
      </>
    ),
  },
]

interface NavRailProps {
  page: NavPage
  onNavigate: (page: NavPage) => void
  alertCount?: number
  taskReadyCount?: number
}

export default function NavRail({
  page,
  onNavigate,
  alertCount = 0,
  taskReadyCount = 0,
}: NavRailProps) {
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
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={item.label}
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
              {item.id === 'tasks' && taskReadyCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface-deep" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          title="Sign out"
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
