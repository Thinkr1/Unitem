import type { ReactNode } from 'react'
import UnitemLogo from './UnitemLogo'
import ThemeToggle from './ThemeToggle'

export type NavPage = 'overview' | 'comparison' | 'agents' | 'rulebook'

interface NavItem {
  id: NavPage
  label: string
  tier: 'primary' | 'secondary'
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'comparison',
    label: 'Compare',
    tier: 'primary',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="18" rx="1.5" />
      </>
    ),
  },
  {
    id: 'overview',
    label: 'Overview',
    tier: 'primary',
    icon: <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />,
  },
  {
    id: 'agents',
    label: 'Agents',
    tier: 'secondary',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      </>
    ),
  },
  {
    id: 'rulebook',
    label: 'Rulebook',
    tier: 'secondary',
    icon: (
      <>
        <path d="M4 5.5A2 2 0 0 1 6 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1.5.86L12 17.5l-5.5 2.36A1 1 0 0 1 5 19V5.5z" />
        <path d="M8 8h8M8 11.5h5" />
      </>
    ),
  },
]

interface NavRailProps {
  page?: NavPage
  onNavigate?: (page: NavPage) => void
  onEditCode?: () => void
  onRescan?: () => void
  rescanning?: boolean
  engineLive?: boolean | null
  editMode?: boolean
}

function NavIcon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function NavButton({
  label,
  active,
  onClick,
  tier,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  tier: 'primary' | 'secondary'
  children: ReactNode
}) {
  const isPrimary = tier === 'primary'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border px-3 text-left transition-all ${
        active
          ? 'border-[#8fa824] bg-accent text-accent-contrast shadow-sm'
          : isPrimary
            ? 'border-edge bg-surface text-ink hover:border-edge-bright hover:bg-surface-raised'
            : 'border-edge/60 bg-transparent text-ink-muted hover:border-edge hover:bg-surface-raised hover:text-ink'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
          active
            ? 'border-accent-contrast/20 bg-accent-contrast/10 text-accent-contrast'
            : isPrimary
              ? 'border-edge bg-surface-raised text-ink'
              : 'border-edge/50 bg-surface text-ink-faint'
        }`}
      >
        <NavIcon size={20}>{children}</NavIcon>
      </span>
      <span
        className={`truncate font-heading text-[14px] leading-none ${
          isPrimary ? 'font-bold' : 'font-semibold'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function NavQuick({
  title,
  active,
  disabled,
  onClick,
  spinning,
  children,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  spinning?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-current={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border font-heading text-[12px] font-semibold transition-colors disabled:opacity-40 ${
        active
          ? 'border-[#8fa824] bg-accent text-accent-contrast shadow-sm'
          : 'glass-btn-subtle'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-accent-contrast' : ''} ${spinning ? 'animate-spin' : ''}`}>
        <NavIcon size={14}>{children}</NavIcon>
      </span>
      {title}
    </button>
  )
}

export default function NavRail({
  page = 'comparison',
  onNavigate,
  onEditCode,
  onRescan,
  rescanning = false,
  engineLive = null,
  editMode = false,
}: NavRailProps) {
  return (
    <aside className="wraparound-rail app-drag flex h-full shrink-0 flex-col">
      <div className="wraparound-rail-titlebar shrink-0" aria-hidden />

      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden" data-no-drag>
        <div className="wraparound-rail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3 pt-3">
          {onNavigate && (
            <div className="nav-section">
              <p className="nav-label">Workspace</p>
              <div className="flex flex-col gap-1.5">
                {NAV_ITEMS.filter((item) => item.tier === 'primary').map((item) => (
                  <NavButton
                    key={item.id}
                    label={item.label}
                    tier={item.tier}
                    active={!editMode && page === item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.icon}
                  </NavButton>
                ))}
              </div>
              <p className="nav-label mt-4">More</p>
              <div className="flex flex-col gap-1.5">
                {NAV_ITEMS.filter((item) => item.tier === 'secondary').map((item) => (
                  <NavButton
                    key={item.id}
                    label={item.label}
                    tier={item.tier}
                    active={!editMode && page === item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.icon}
                  </NavButton>
                ))}
              </div>
            </div>
          )}

          {(onEditCode || (!editMode && onRescan && page === 'comparison')) && (
            <div className="wraparound-quick-actions mt-1 flex h-9 shrink-0 gap-1.5">
              {onEditCode && (
                <NavQuick title="Edit code" active={editMode} onClick={onEditCode}>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </NavQuick>
              )}
              {!editMode && onRescan && page === 'comparison' && (
                <NavQuick
                  title={rescanning ? 'Scanning…' : 'Rescan'}
                  disabled={rescanning}
                  spinning={rescanning}
                  onClick={onRescan}
                >
                  <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
                </NavQuick>
              )}
            </div>
          )}
        </div>

        <div className="wraparound-rail-footer shrink-0 space-y-3 px-3 py-4">
          {engineLive === false && (
            <p
              title="Run `unitem serve` and reload"
              className="mb-3 flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-surface-raised px-2 py-1.5 text-[10px] font-semibold text-ink-muted"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
              Engine offline
            </p>
          )}
          <div className="flex w-full items-center justify-center">
            <UnitemLogo placement="rail" className="mx-auto" />
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </aside>
  )
}
