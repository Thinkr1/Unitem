import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { AppScreen, CodebaseApp, Inconsistency, Severity } from './types'
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
import { applyUnifiedDiff } from './lib/applyDiff'
import ScreenPanel, { type LinePulse } from './components/ScreenPanel'
import InconsistenciesPanel, {
  type Filter,
} from './components/InconsistenciesPanel'
import AppShell from './components/AppShell'
import { type NavPage } from './components/NavRail'
import PipelineStrip from './components/PipelineStrip'
import PasteScreen from './components/PasteScreen'
import LaunchScreen from './components/LaunchScreen'
import FileBrowser from './components/FileBrowser'
import OverviewPage from './components/OverviewPage'
import AgentsPage from './components/AgentsPage'
import RulebookPage from './components/RulebookPage'
import { cycleTheme } from './lib/theme'

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
  const [view, setView] = useState<'launch' | 'paste' | 'dashboard'>('launch')
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
  const [rescanning, setRescanning] = useState(false)
  const [transferring, setTransferring] = useState(false)
  // Transfer outcome shown as a dismissible banner — a transfer can fail with a
  // 200 OK (the error rides in result.transfer), so we surface it explicitly.
  const [transferMsg, setTransferMsg] = useState<
    { kind: 'error' | 'success'; text: string } | null
  >(null)
  // null = not yet checked; false = engine unreachable (mock/sample data shown)
  const [engineLive, setEngineLive] = useState<boolean | null>(null)
  // Whether the user has picked a demo app / analyzed something at least once
  // — controls whether the "back" arrow from Edit source returns to the
  // dashboard or all the way back to the launch screen.
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  // Whole-app analysis: when set, the comparison page shows a screen switcher
  // and Overview/Rulebook aggregate findings across every screen instead of
  // just the one currently open.
  const [loadedApp, setLoadedApp] = useState<CodebaseApp | null>(null)
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null)
  const [screenItems, setScreenItems] = useState<Record<string, Inconsistency[]>>({})

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

  /** Swap the comparison panels to one screen of a loaded whole-app codebase. */
  const applyScreen = (screen: AppScreen, screenInconsistencies: Inconsistency[]) => {
    setIosPanelMeta(screen.ios)
    setAndroidPanelMeta(screen.android)
    setIosCode(screen.ios.code)
    setAndroidCode(screen.android.code)
    setAndroidPreview(undefined)
    setItems(screenInconsistencies)
    setScreenName(screen.id)
    setActiveScreenId(screen.id)
    setActiveId(null)
    setIosPulse(null)
    setAndroidPulse(null)
  }

  // Launch screen -> load a whole codebase (a bundled demo, or one scanned
  // from the user's own iOS + Android folders) and jump straight to it.
  const onSelectApp = (app: CodebaseApp) => {
    const initialItems = Object.fromEntries(app.screens.map((s) => [s.id, s.inconsistencies]))
    setLoadedApp(app)
    setScreenItems(initialItems)
    setRulebook(app.rulebook)
    setTransferMsg(null)
    applyScreen(app.screens[0], initialItems[app.screens[0].id] ?? [])
    setHasAnalyzed(true)
    setPage('comparison')
    setView('dashboard')
  }

  const onSwitchScreen = (screenId: string) => {
    if (!loadedApp) return
    const screen = loadedApp.screens.find((s) => s.id === screenId)
    if (!screen) return
    setTransferMsg(null)
    applyScreen(screen, screenItems[screenId] ?? screen.inconsistencies)
  }

  const refreshFromEngine = async () => {
    const result = await fetchComparison(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
  }

  // On load, just check whether the engine is reachable (for the nav rail's
  // status badge) — the launch screen always shows first, regardless of
  // whatever state the engine happens to be in.
  useEffect(() => {
    fetchComparison().then((result) => {
      setEngineLive(result !== null)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        cycleTheme()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (activeId != null) return
    const hold = items.find((i) => i.verdict === 'hold' && i.status === 'open')
    if (hold) setActiveId(hold.id)
  }, [items, activeId])

  // Rescan = run the real pipeline (discover -> map -> judge agents -> fixes).
  // Only meaningful when there's an engine behind the current screen — hidden
  // entirely for loaded (demo/custom) apps, see `showFileBrowser`/render below.
  const onRescan = async () => {
    setRescanning(true)
    const result = await rescan(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
    setRescanning(false)
    // No manual remount: applyComparison updates the preview code, which the
    // (mounted) DartPad iframe reposts + recompiles in place. See FlutterPreview.
  }

  // Whole-app mode keeps a per-screen inconsistency list (screenItems) so
  // switching screens and Overview/Rulebook's totals stay in sync with edits.
  const syncScreenItems = (next: Inconsistency[]) => {
    if (loadedApp && activeScreenId) {
      setScreenItems((prev) => ({ ...prev, [activeScreenId]: next }))
    }
  }

  /** Applies a finding's proposedFix diff to the in-memory iOS/Android source —
   *  the client-side equivalent of what the engine's writer agent does on disk.
   *  Loaded (demo/custom) apps have no engine behind them, so this is the only
   *  way "Resolve"/"Transfer all" can actually change anything for them. */
  const applyFixToCode = (fix: NonNullable<Inconsistency['proposedFix']>) => {
    if (fix.targetPlatform === 'ios') {
      setIosCode((prev) => applyUnifiedDiff(prev, fix.diff))
    } else {
      setAndroidCode((prev) => applyUnifiedDiff(prev, fix.diff))
    }
  }

  const onResolve = async (id: string) => {
    if (loadedApp) {
      // Local codebase — no engine to call; apply the fix (if any) ourselves.
      const item = items.find((i) => i.id === id)
      if (item?.proposedFix) applyFixToCode(item.proposedFix)
      const next: Inconsistency[] = items.map((i) =>
        i.id === id ? { ...i, status: 'resolved' as const } : i,
      )
      setItems(next)
      syncScreenItems(next)
      return
    }
    const updated = await acceptFinding(id) // engine applies the fix / opens PR
    const next: Inconsistency[] = items.map((i) =>
      i.id === id ? (updated ?? { ...i, status: 'resolved' as const }) : i,
    )
    setItems(next)
    await refreshFromEngine()
  }

  const onIgnore = async (id: string) => {
    if (loadedApp) {
      const next: Inconsistency[] = items.map((i) =>
        i.id === id ? { ...i, status: 'ignored' as const } : i,
      )
      setItems(next)
      syncScreenItems(next)
      return
    }
    const updated = await overrideFinding(id, 'hold', 'dismissed from console')
    const next: Inconsistency[] = items.map((i) =>
      i.id === id ? (updated ?? { ...i, status: 'ignored' as const }) : i,
    )
    setItems(next)
  }

  // Whole-screen transfer.
  // - Loaded (demo/custom) apps: apply every open flag/propagate finding's
  //   proposedFix to the in-memory code directly — there is no engine mapping
  //   for these screens, so calling `/transfer` would only ever fail with
  //   "isn't a transferable screen".
  // - Engine-backed screens (paste flow / a real `unitem serve`): unchanged —
  //   the writer agent regenerates the Flutter screen + theme from the iOS
  //   design and writes ONLY to the Android side.
  const onTransfer = async () => {
    if (transferring) return
    setTransferring(true)
    setTransferMsg(null)
    try {
      if (loadedApp) {
        const openIssues = items.filter((i) => i.status === 'open' && i.verdict !== 'hold')
        if (openIssues.length === 0) {
          setTransferMsg({ kind: 'success', text: 'Nothing to transfer — no open issues on this screen.' })
          return
        }
        let nextIos = iosCode
        let nextAndroid = androidCode
        for (const item of openIssues) {
          if (!item.proposedFix) continue
          if (item.proposedFix.targetPlatform === 'ios') {
            nextIos = applyUnifiedDiff(nextIos, item.proposedFix.diff)
          } else {
            nextAndroid = applyUnifiedDiff(nextAndroid, item.proposedFix.diff)
          }
        }
        setIosCode(nextIos)
        setAndroidCode(nextAndroid)
        const resolvedIds = new Set(openIssues.map((i) => i.id))
        const next: Inconsistency[] = items.map((i) =>
          resolvedIds.has(i.id) ? { ...i, status: 'resolved' as const } : i,
        )
        setItems(next)
        syncScreenItems(next)
        setTransferMsg({
          kind: 'success',
          text: `Applied ${openIssues.length} fix${openIssues.length === 1 ? '' : 'es'} locally to this screen.`,
        })
        return
      }

      const result = await transferDesign(screenName, iosCode)
      if (!result) {
        // engine unreachable, or the request errored before a JSON reply
        setTransferMsg({
          kind: 'error',
          text: 'Engine unreachable — the transfer did not run.',
        })
        await refreshFromEngine() // sets the offline badge if truly down
        return
      }
      setEngineLive(true)
      const t = result.transfer
      if (t && !t.ok) {
        // A 200 OK can still carry a failed transfer (e.g. an unmapped screen,
        // or a verification failure) — surface it instead of doing nothing.
        // Leave the panels untouched; nothing landed on disk.
        const unmapped = /no (iOS|Flutter) screen file mapped/i.test(t.error ?? '')
        setTransferMsg({
          kind: 'error',
          text: unmapped
            ? `"${screenName}" isn't a transferable screen on the engine — it has no files on disk there.`
            : `Transfer failed: ${t.error ?? 'unknown error'}`,
        })
        return
      }
      if (t?.ok) {
        setTransferMsg({
          kind: 'success',
          text: t.summary || `Transferred to ${t.files_written.join(', ')}`,
        })
      }
      applyComparison(result)
    } finally {
      setTransferring(false)
      // No manual remount: applyComparison swaps in the new preview code, which
      // the (mounted) DartPad iframe reposts + recompiles in place.
    }
  }

  // "Reset demo": for a loaded app, undoes local resolve/transfer edits by
  // restoring the current screen to its original definition. For an
  // engine-backed screen, puts the old Material design back on disk so the
  // transfer can be re-run (unchanged, engine-only feature).
  const onResetDemo = async () => {
    if (loadedApp) {
      const original = loadedApp.screens.find((s) => s.id === activeScreenId)
      if (!original) return
      setTransferMsg(null)
      applyScreen(original, original.inconsistencies)
      setScreenItems((prev) => ({ ...prev, [original.id]: original.inconsistencies }))
      return
    }
    const result = await resetAndroid(screenName)
    setEngineLive(result !== null)
    if (result) applyComparison(result)
  }

  const onSelect = (item: Inconsistency) => {
    setActiveId(item.id)
    const nonce = Date.now()
    setIosPulse({ line: item.ios.line, nonce })
    setAndroidPulse({ line: item.android.line, nonce })
  }

  const onAnalyze = async (payload: { iosCode: string; androidCode: string }) => {
    setLoadedApp(null)
    setScreenItems({})
    setActiveScreenId(null)
    setIosCode(payload.iosCode)
    setAndroidCode(payload.androidCode)
    setHasAnalyzed(true)
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

  // Whole-app aggregation: Overview/Rulebook reflect every screen in the
  // loaded codebase, not just the one currently open in Compare.
  const overviewItems = loadedApp ? Object.values(screenItems).flat() : items
  const screenIssueCounts: Record<string, number> = loadedApp
    ? Object.fromEntries(
        loadedApp.screens.map((s) => [
          s.id,
          (screenItems[s.id] ?? s.inconsistencies).filter(
            (i) => i.status === 'open' && i.verdict !== 'hold',
          ).length,
        ]),
      )
    : {}

  const showFileBrowser = !!loadedApp && loadedApp.screens.length > 1

  const onGoToLaunch = () => setView('launch')

  if (view === 'launch') {
    return <LaunchScreen onSelectApp={onSelectApp} engineLive={engineLive} />
  }

  if (view === 'paste') {
    return (
      <AppShell
        page={page}
        onNavigate={(p) => {
          setPage(p)
          setView('dashboard')
        }}
        onEditCode={() => setView('paste')}
        onRescan={onRescan}
        onGoToLaunch={onGoToLaunch}
        rescanning={rescanning}
        engineLive={engineLive}
        editMode
        onBackFromEdit={() => setView(hasAnalyzed ? 'dashboard' : 'launch')}
        topChrome={{
          title: 'Edit source',
          subtitle: 'Paste or update iOS & Android code',
        }}
      >
        <PasteScreen
          initialIos={iosCode}
          initialAndroid={androidCode}
          onAnalyze={onAnalyze}
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      page={page}
      onNavigate={setPage}
      onEditCode={() => setView('paste')}
      // Rescan re-runs the real engine pipeline — there's nothing to rescan
      // for a loaded (demo/custom) app with no engine behind it.
      onRescan={loadedApp ? undefined : onRescan}
      onGoToLaunch={onGoToLaunch}
      rescanning={rescanning}
      engineLive={engineLive}
      hideTopChrome={page === 'comparison'}
    >
        {page === 'comparison' ? (
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            {transferMsg && (
              <div
                role="status"
                className={`mb-2 flex items-start justify-between gap-3 rounded-xl px-4 py-2.5 font-heading text-[12px] ${
                  transferMsg.kind === 'error'
                    ? 'bg-severity-error/10 text-severity-error ring-1 ring-severity-error/30'
                    : 'bg-accent/10 text-accent ring-1 ring-accent/30'
                }`}
              >
                <span className="font-medium leading-snug">{transferMsg.text}</span>
                <button
                  onClick={() => setTransferMsg(null)}
                  className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}
            <PipelineStrip />
            <Group
              orientation="horizontal"
              className="min-h-0 flex-1 gap-0"
              key={`${loadedApp?.id ?? 'single'}-${showFileBrowser}`}
            >
            {showFileBrowser && loadedApp && (
              <>
                <Panel defaultSize="15%" minSize="11%" maxSize="26%" className="!overflow-visible">
                  <FileBrowser
                    appName={loadedApp.name}
                    appIcon={loadedApp.icon}
                    screens={loadedApp.screens}
                    activeScreenId={activeScreenId}
                    issueCounts={screenIssueCounts}
                    onSelect={onSwitchScreen}
                  />
                </Panel>
                <ResizeHandle />
              </>
            )}
            <Panel defaultSize={showFileBrowser ? '60%' : '72%'} minSize="40%" className="!overflow-visible">
              <Group orientation="horizontal" className="h-full min-h-0">
                <Panel defaultSize="50%" minSize="25%" className="!overflow-visible">
                  <ScreenPanel
                    panel={iosPanel}
                    title="iOS"
                    editable
                    onCodeChange={setIosCode}
                    rulebook={rulebook}
                    flaggedLines={flaggedLines(items, 'ios')}
                    activeLine={active?.ios.line ?? null}
                    pulse={iosPulse}
                    activeInconsistency={active}
                    inconsistencies={items}
                  />
                </Panel>
                <ResizeHandle />
                <Panel defaultSize="50%" minSize="25%" className="!overflow-visible">
                  <ScreenPanel
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
              </Group>
            </Panel>
            <ResizeHandle />
            <Panel defaultSize={showFileBrowser ? '25%' : '28%'} minSize="18%" className="!overflow-visible">
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
          <OverviewPage items={overviewItems} />
        ) : page === 'agents' ? (
          <AgentsPage />
        ) : page === 'rulebook' ? (
          <RulebookPage rulebook={rulebook} items={overviewItems} />
        ) : null}
    </AppShell>
  )
}
