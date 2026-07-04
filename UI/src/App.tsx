import { useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Inconsistency, Severity } from './types'
import { mockComparison } from './mockData'
import ScreenPanel, { type LinePulse } from './components/ScreenPanel'
import InconsistenciesPanel, {
  type Filter,
} from './components/InconsistenciesPanel'
import LiveFlowPanel from './components/LiveFlowPanel'

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
    <Separator className="w-1 bg-edge transition-colors data-[separator=hover]:bg-accent/50 data-[separator=focus]:bg-accent/50 data-[separator=active]:bg-accent" />
  )
}

export default function App() {
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

  const active = items.find((i) => i.id === activeId) ?? null

  return (
    <div className="flex h-screen flex-col bg-surface-deep text-ink antialiased">
      <header className="app-drag flex h-9 shrink-0 items-center border-b border-edge pl-20 pr-4">
        <span className="font-heading text-[13px] font-bold tracking-wide text-ink">
          Unitem
        </span>
        <span className="ml-3 text-[11px] text-ink-faint">
          Cross-platform consistency · Login screen
        </span>
      </header>
      <LiveFlowPanel />

      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={34} minSize={18}>
          <ScreenPanel
            panel={mockComparison.ios}
            title="iOS · Swift"
            flaggedLines={flaggedLines(items, 'ios')}
            activeLine={active?.ios.line ?? null}
            pulse={iosPulse}
            activeInconsistency={active}
            inconsistencies={items}
          />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={34} minSize={18}>
          <ScreenPanel
            panel={mockComparison.android}
            title="Android · Dart"
            flaggedLines={flaggedLines(items, 'android')}
            activeLine={active?.android.line ?? null}
            pulse={androidPulse}
            activeInconsistency={active}
            inconsistencies={items}
          />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={32} minSize={22}>
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
  )
}
