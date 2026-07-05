import type { ReactNode } from 'react'
import NavRail, { type NavPage } from './NavRail'

export const PAGE_COPY: Record<
  NavPage,
  { title: string; subtitle: string }
> = {
  overview: {
    title: 'Overview',
    subtitle: 'Consistency score & summary',
  },
  comparison: {
    title: 'Compare',
    subtitle: 'iOS & Android side by side',
  },
  agents: {
    title: 'Agents',
    subtitle: 'Scan & fix pipeline',
  },
  rulebook: {
    title: 'Rulebook',
    subtitle: 'Design rules & tokens',
  },
}

interface ChromeBar {
  title: string
  subtitle?: string
  action?: ReactNode
}

interface AppShellProps {
  page?: NavPage
  onNavigate?: (page: NavPage) => void
  onEditCode?: () => void
  onRescan?: () => void
  onGoToLaunch?: () => void
  rescanning?: boolean
  engineLive?: boolean | null
  editMode?: boolean
  onBackFromEdit?: () => void
  hideTopChrome?: boolean
  topChrome?: ChromeBar
  children: ReactNode
}

export default function AppShell({
  page = 'comparison',
  onNavigate,
  onEditCode,
  onRescan,
  onGoToLaunch,
  rescanning = false,
  engineLive = null,
  editMode = false,
  onBackFromEdit,
  hideTopChrome = false,
  topChrome,
  children,
}: AppShellProps) {
  const pageCopy = !editMode && page ? PAGE_COPY[page] : null
  const baseChrome: ChromeBar | null = topChrome ?? (hideTopChrome ? null : pageCopy)

  const chrome: ChromeBar | null =
    baseChrome && editMode && onBackFromEdit
      ? {
          ...baseChrome,
          action: (
            <button
              type="button"
              onClick={onBackFromEdit}
              className="glass-btn-ghost rounded-lg px-3 py-1.5 font-heading text-[12px] font-semibold"
            >
              ← Compare
            </button>
          ),
        }
      : baseChrome

  return (
    <div className="app-canvas flex h-screen overflow-hidden text-ink antialiased">
      <NavRail
        page={page}
        onNavigate={onNavigate}
        onEditCode={onEditCode}
        onRescan={onRescan}
        onGoToLaunch={onGoToLaunch}
        rescanning={rescanning}
        engineLive={engineLive}
        editMode={editMode}
      />

      <div className="workspace flex min-h-0 min-w-0 flex-1 flex-col">
        {chrome ? (
          <div className="workspace-chrome workspace-chrome--titled app-drag flex shrink-0 items-center px-4">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4" data-no-drag>
              <div className="min-w-0 py-2">
                <h1 className="font-heading text-[17px] font-bold leading-tight tracking-tight text-ink">
                  {chrome.title}
                </h1>
                {chrome.subtitle ? (
                  <p className="mt-0.5 text-[12px] text-ink-muted">{chrome.subtitle}</p>
                ) : null}
              </div>
              {chrome.action ? <div className="shrink-0">{chrome.action}</div> : null}
            </div>
          </div>
        ) : (
          <div className="workspace-chrome workspace-chrome--bare app-drag shrink-0" aria-hidden />
        )}

        <main
          className={`workspace-content min-h-0 flex-1 overflow-hidden${hideTopChrome ? ' workspace-content--dense' : ''}`}
        >
          <div className="page-slot h-full min-h-0 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  )
}
