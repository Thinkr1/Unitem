import { useState, type ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Left icon rail — presentational chrome that mirrors the reference dashboard.
// No routing exists yet, so the items just track a local "active" selection.
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string
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
    id: 'history',
    label: 'History',
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9h18M8 3v3M16 3v3" />
      </>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <path d="M5 21V10M12 21V4M19 21v-7" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
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

export default function NavRail() {
  const [active, setActive] = useState('overview')

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-6 py-4">
      {/* Logo mark */}
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
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              title={item.label}
              aria-label={item.label}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
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
            </button>
          )
        })}
      </div>

      {/* Bottom: logout + avatar */}
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
          className="h-9 w-9 rounded-full border border-edge-bright bg-surface-raised bg-cover bg-center"
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
