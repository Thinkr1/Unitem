import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Inconsistency, Severity } from './types'
import { mockComparison } from './mockData'
import {
  acceptFinding,
  analyzePair,
  fetchComparison,
  overrideFinding,
  rescan,
  resetAndroid,
  transferDesign,
} from './lib/api'
import ScreenPanel, { type LinePulse } from './components/ScreenPanel'
import InconsistenciesPanel, {
  type Filter,
} from './components/InconsistenciesPanel'
import NavRail, { type NavPage } from './components/NavRail'
import PipelineStrip from './components/PipelineStrip'
import PasteScreen from './components/PasteScreen'
import OverviewPage from './components/OverviewPage'
import AgentsPage from './components/AgentsPage'
import RulebookPage from './components/RulebookPage'
import AlertsPage from './components/AlertsPage'

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
  const [page, setPage] = useState<NavPage>('comparison')
  const [screenName, setScreenName] = useState('login')
  const [rulebook, setRulebook] = useState<Record<string, string>>(
    mockComparison.rulebook,
  )
  const [iosPanelMeta, setIosPanelMeta] = useState(mockComparison.ios)
  const [androidPanelMeta, setAndroidPanelMeta] = useState(mockComparison.android)
  const [iosCode, setIosCode] = useState(mockComparison.ios.code)
  const [androidCode, setAndroidCode] = useState(mockComparison.android.code)
  const [androidPreview, setAndroidPreview] = useState<string | undefined>()
  const [rescanNonce, setRescanNonce] = useState(0)
  const [rescanning, setRescanning] = useState(false)
  const [transferring, setTransferring] = useState(false)
  // null = not yet checked; false = engine unreachable (mock/sample data shown)
  const [engineLive, setEngineLive] = useState<boolean | null>(null)

  const [items, setItems] = useState<Inconsistency[]>(
    mockComparison.inconsistencies,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [iosPulse, setIosPulse] = useState<LinePulse | null>(null)
  const [androidPulse, setAndroidPulse] = useState<LinePulse | null>(null)

  const applyComparison = (result: NonNullable<Awaited<ReturnType<typeof fetchComparison>>>) => {
    setItems(result.inconsistencies)
    setIosCode(result.ios.code)
    setAndroidCode(result.android.code)
    setAndroidPreview(result.android.previewCode)
    setIosPanelMeta(result.ios)
    setAndroidPanelMeta(result.android)
    if (result.screen) setScreenName(result.screen)
    if (result.rulebook) setRulebook(result.rulebook)
  }

  const refreshFromEngine = async () => {
    const result = await fetchComparison(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
  }

  // On load, pull the engine's latest state (tickets from the last `unitem
  // diff` run + the mapped screens' real source). Falls back to the mock.
  useEffect(() => {
    fetchComparison().then((result) => {
      setEngineLive(result !== null)
      if (result && result.inconsistencies.length > 0) {
        applyComparison(result)
        setView('dashboard') // engine has judged tickets — go straight to review
      }
    })
  }, [])

  // Rescan = run the real pipeline (discover -> map -> judge agents -> fixes).
  const onRescan = async () => {
    setRescanning(true)
    const result = await rescan(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
    setRescanning(false)
    setRescanNonce((n) => n + 1) // remount the preview so it recompiles
  }

  const onResolve = async (id: string) => {
    const updated = await acceptFinding(id) // engine applies the fix / opens PR
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? (updated ?? { ...i, status: 'resolved' }) : i,
      ),
    )
    await refreshFromEngine()
    setRescanNonce((n) => n + 1)
  }

  const onIgnore = async (id: string) => {
    const updated = await overrideFinding(id, 'hold', 'dismissed from console')
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? (updated ?? { ...i, status: 'ignored' }) : i,
      ),
    )
  }

  // Whole-screen transfer: the engine's writer agent regenerates the Flutter
  // screen + theme from the iOS design. Writes ONLY to the Android side.
  // If the request fails (engine down, or the fetch timed out on a long run),
  // re-sync from the engine — never fall back to per-finding accepts, because
  // the token-propagate path regenerates Theme.swift and would clobber manual
  // iOS edits.
  const onTransfer = async () => {
    if (transferring) return
    setTransferring(true)
    try {
      const result = await transferDesign(screenName)
      if (result) {
        setEngineLive(true)
        applyComparison(result)
      } else {
        await refreshFromEngine() // sets the offline badge if truly down
      }
    } finally {
      setTransferring(false)
      setRescanNonce((n) => n + 1) // remount DartPad so it compiles the new screen
    }
  }

  // DEV ONLY: put the old Material design back so the transfer can be re-run.
  const onResetDemo = async () => {
    const result = await resetAndroid(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
    setRescanNonce((n) => n + 1)
  }

  const onSelect = (item: Inconsistency) => {
    setActiveId(item.id)
    const nonce = Date.now()
    setIosPulse({ line: item.ios.line, nonce })
    setAndroidPulse({ line: item.android.line, nonce })
  }

  const onSelectFromAlerts = (item: Inconsistency) => {
    onSelect(item)
    setPage('comparison')
  }

  const onAnalyze = async (payload: { iosCode: string; androidCode: string }) => {
    setIosCode(payload.iosCode)
    setAndroidCode(payload.androidCode)
    setPage('comparison')
    setView('dashboard')
    const result = await analyzePair(payload.iosCode, payload.androidCode)
    if (result) applyComparison(result)
  }

  const active = items.find((i) => i.id === activeId) ?? null
  const iosPanel = { ...iosPanelMeta, code: iosCode }
  const androidPanel = {
    ...androidPanelMeta,
    code: androidCode,
    previewCode: androidPreview,
  }
  const openFlags = items.filter(
    (i) =>
      i.status === 'open' &&
      i.verdict !== 'hold' &&
      (i.verdict === 'flag' || !i.verdict),
  ).length

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
    <div className="flex h-screen bg-surface-deep text-ink antialiased">
      <NavRail
        page={page}
        onNavigate={setPage}
        alertCount={openFlags}
        onEditCode={() => setView('paste')}
        onRescan={onRescan}
        rescanning={rescanning}
        engineLive={engineLive}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pr-4 pb-4 pt-2">
        {page === 'comparison' ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PipelineStrip />
            <Group orientation="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize="34%" minSize="18%" className="!overflow-visible">
              <ScreenPanel
                panel={iosPanel}
                title="iOS"
                rulebook={rulebook}
                flaggedLines={flaggedLines(items, 'ios')}
                activeLine={active?.ios.line ?? null}
                pulse={iosPulse}
                activeInconsistency={active}
                inconsistencies={items}
              />
            </Panel>
            <ResizeHandle />
            <Panel defaultSize="34%" minSize="18%" className="!overflow-visible">
              <ScreenPanel
                key={`android-${rescanNonce}`}
                panel={androidPanel}
                title="Android"
                rulebook={rulebook}
                flaggedLines={flaggedLines(items, 'android')}
                activeLine={active?.android.line ?? null}
                pulse={androidPulse}
                activeInconsistency={active}
                inconsistencies={items}
              />
            </Panel>
            <ResizeHandle />
            <Panel defaultSize="32%" minSize="22%" className="!overflow-visible">
              <InconsistenciesPanel
                items={items}
                filter={filter}
                activeId={activeId}
                onFilterChange={setFilter}
                onSelect={onSelect}
                onResolve={onResolve}
                onIgnore={onIgnore}
                onResolveAll={onTransfer}
                onResetDemo={onResetDemo}
                transferring={transferring}
              />
            </Panel>
            </Group>
          </div>
        ) : page === 'overview' ? (
          <OverviewPage items={items} />
        ) : page === 'agents' ? (
          <AgentsPage />
        ) : page === 'rulebook' ? (
          <RulebookPage rulebook={rulebook} items={items} />
        ) : (
          <AlertsPage
            items={items}
            activeId={activeId}
            onSelect={onSelectFromAlerts}
            onResolve={onResolve}
            onIgnore={onIgnore}
          />
        )}
      </div>
    </div>
  )
}
