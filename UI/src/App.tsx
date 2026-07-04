import { useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Inconsistency, Severity } from './types'
import { mockComparison } from './mockData'
import ScreenPanel, { type LinePulse } from './components/ScreenPanel'
import InconsistenciesPanel, {
  type Filter,
} from './components/InconsistenciesPanel'
import LiveFlowPanel from './components/LiveFlowPanel'
import NavRail from './components/NavRail'
import PasteScreen from './components/PasteScreen'

const SEVERITY_RANK: Record<Severity, number> = { error: 3, warning: 2, info: 1 }

/** Line number -> highest severity among open inconsistencies on that line. */
function flaggedLines(
  items: Inconsistency[],
  platform: 'ios' | 'android',
): Map<number, Severity> {
  const map = new Map<number, Severity>()
  for (const item of items) {
    if (item.status !== 'open') continue
    const line = item[platform].line
    const current = map.get(line)
    if (!current || SEVERITY_RANK[item.severity] > SEVERITY_RANK[current]) {
      map.set(line, item.severity)
    }
  }
  return map
}

function ResizeHandle() {
  return (
    <Separator className="group relative w-3 bg-transparent">
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-data-[separator=hover]:bg-accent/60 group-data-[separator=focus]:bg-accent/60 group-data-[separator=active]:bg-accent" />
    </Separator>
  )
}

export default function App() {
  const [view, setView] = useState<'paste' | 'dashboard'>('paste')
  const [iosCode, setIosCode] = useState(mockComparison.ios.code)
  const [androidCode, setAndroidCode] = useState(mockComparison.android.code)
  const [rescanNonce, setRescanNonce] = useState(0)

  const [items, setItems] = useState<Inconsistency[]>(
    mockComparison.inconsistencies,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [iosPulse, setIosPulse] = useState<LinePulse | null>(null)
  const [androidPulse, setAndroidPulse] = useState<LinePulse | null>(null)

  // BACKEND: replace — call the fix service, then update status from the response.
  const onResolve = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'resolved' } : i)),
    )
  }

  // BACKEND: replace — persist the ignore, then update status from the response.
  const onIgnore = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'ignored' } : i)),
    )
  }

  // BACKEND: replace — batch-fix all open inconsistencies via the fix service.
  const onResolveAll = () => {
    setItems((prev) =>
      prev.map((i) => (i.status === 'open' ? { ...i, status: 'resolved' } : i)),
    )
  }

  const onSelect = (item: Inconsistency) => {
    setActiveId(item.id)
    const nonce = Date.now()
    setIosPulse({ line: item.ios.line, nonce })
    setAndroidPulse({ line: item.android.line, nonce })
  }

  const onAnalyze = (payload: { iosCode: string; androidCode: string }) => {
    setIosCode(payload.iosCode)
    setAndroidCode(payload.androidCode)
    setView('dashboard')
  }

  const active = items.find((i) => i.id === activeId) ?? null

  const iosPanel = { ...mockComparison.ios, code: iosCode }
  const androidPanel = { ...mockComparison.android, code: androidCode }

  if (view === 'paste') {
    return (
      <PasteScreen
        initialIos={iosCode}
        initialAndroid={androidCode}
        onAnalyze={onAnalyze}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-surface-deep text-ink antialiased">
      <header className="app-drag flex h-16 shrink-0 items-center gap-4 pl-24 pr-5">
        <div className="min-w-0">
          <h1 className="font-heading text-[15px] font-bold leading-tight tracking-wide text-ink">
            Login screen
          </h1>
          <p className="text-[11.5px] text-ink-muted">
            Ready to reconcile iOS &amp; Android?
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setView('paste')}
            className="rounded-full bg-surface px-3.5 py-2 font-heading text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Edit code
          </button>

          <div
            className="flex items-center gap-2 rounded-full bg-surface px-3.5 py-2"
            data-no-drag
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-ink-faint"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="Search for an inconsistency"
              className="w-52 bg-transparent text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          <button
            onClick={() => setRescanNonce((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-full bg-info-blue px-4 py-2 font-heading text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
            </svg>
            Rescan
          </button>
        </div>
      </header>
      <LiveFlowPanel />

      <div className="flex min-h-0 flex-1 pl-2">
        <NavRail />

        <Group
          orientation="horizontal"
          className="min-h-0 flex-1 pb-4 pr-4 pl-1"
        >
          <Panel defaultSize={34} minSize={18} className="!overflow-visible">
            <ScreenPanel
              panel={iosPanel}
              title="iOS · Swift"
              flaggedLines={flaggedLines(items, 'ios')}
              activeLine={active?.ios.line ?? null}
              pulse={iosPulse}
              activeInconsistency={active}
              inconsistencies={items}
            />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={34} minSize={18} className="!overflow-visible">
            <ScreenPanel
              key={`android-${rescanNonce}`}
              panel={androidPanel}
              title="Android · Dart"
              flaggedLines={flaggedLines(items, 'android')}
              activeLine={active?.android.line ?? null}
              pulse={androidPulse}
              activeInconsistency={active}
              inconsistencies={items}
            />
          </Panel>
          <ResizeHandle />
          <Panel defaultSize={32} minSize={22} className="!overflow-visible">
            <InconsistenciesPanel
              items={items}
              filter={filter}
              activeId={activeId}
              onFilterChange={setFilter}
              onSelect={onSelect}
              onResolve={onResolve}
              onIgnore={onIgnore}
              onResolveAll={onResolveAll}
            />
          </Panel>
        </Group>
      </div>
    </div>
  )
}
