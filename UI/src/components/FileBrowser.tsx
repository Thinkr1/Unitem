import type { AppScreen } from '../types'

interface FileBrowserProps {
  appName: string
  appIcon?: string
  screens: AppScreen[]
  activeScreenId: string | null
  /** Open-issue count per screen id, shown as a small badge on the folder row. */
  issueCounts: Record<string, number>
  onSelect: (id: string) => void
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-90" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function FileBadge({ platform }: { platform: 'ios' | 'android' }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded font-heading text-[8px] font-bold ${
        platform === 'ios'
          ? 'bg-severity-warning/20 text-severity-warning'
          : 'bg-info-blue/20 text-info-blue'
      }`}
    >
      {platform === 'ios' ? 'S' : 'D'}
    </span>
  )
}

/** Left-hand file tree for a loaded whole-app codebase — one folder per
 *  screen, each containing its iOS + Android source file. Hidden when
 *  there's only one screen (e.g. a single pasted/imported pair). */
export default function FileBrowser({
  appName,
  appIcon,
  screens,
  activeScreenId,
  issueCounts,
  onSelect,
}: FileBrowserProps) {
  if (screens.length <= 1) return null

  return (
    <section className="glass-card flex h-full min-w-0 flex-col overflow-hidden">
      <header className="flex h-[3rem] shrink-0 items-center gap-2 border-b border-edge px-3">
        <span className="shrink-0 text-[15px]" aria-hidden>
          {appIcon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-[13px] font-bold text-ink">{appName}</h2>
          <p className="truncate font-heading text-[10px] text-ink-faint">Screens</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {screens.map((screen) => {
          const active = screen.id === activeScreenId
          const count = issueCounts[screen.id] ?? 0
          return (
            <div key={screen.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => onSelect(screen.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-1 rounded-lg px-1.5 py-1.5 text-left transition-colors ${
                  active ? 'bg-accent/15 text-ink' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
                }`}
              >
                <ChevronIcon />
                <FolderIcon active={active} />
                <span className="min-w-0 flex-1 truncate font-heading text-[12px] font-semibold">
                  {screen.name}
                </span>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-severity-error/15 px-1.5 py-0.5 text-[9px] font-bold leading-none text-severity-error">
                    {count}
                  </span>
                )}
              </button>

              <div className="ml-[19px] border-l border-edge pl-2">
                <button
                  type="button"
                  onClick={() => onSelect(screen.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-[11px] transition-colors ${
                    active ? 'text-ink' : 'text-ink-faint hover:bg-surface-raised hover:text-ink-muted'
                  }`}
                >
                  <FileBadge platform="ios" />
                  <span className="truncate">{screen.ios.fileName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(screen.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-[11px] transition-colors ${
                    active ? 'text-ink' : 'text-ink-faint hover:bg-surface-raised hover:text-ink-muted'
                  }`}
                >
                  <FileBadge platform="android" />
                  <span className="truncate">{screen.android.fileName}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
